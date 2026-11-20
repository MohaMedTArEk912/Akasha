import readline from 'node:readline';
import fs from 'fs-extra';
import path from 'node:path';
import { storageService } from '../services/storageService.js';
import prisma from '../lib/prisma.js';
import { safeJsonParse } from '../utils/safeJsonParse.js';
import { compileProjectBlueprint, compileFeatureBuildPack } from '../services/structuredBlueprintService.js';
import { getSquadConfig, reportAgentAction, type AgentRole } from '../services/agentSquadOrchestrator.js';
import { listProjectWorkspaceSlices, addProjectDecision } from '../services/featureSliceService.js';
import { runProjectDriftCheck } from '../services/driftDetectionService.js';

interface JsonRpcRequest {
    jsonrpc: string;
    id?: string | number | null;
    method: string;
    params?: any;
}

interface JsonRpcResponse {
    jsonrpc: string;
    id: string | number | null;
    result?: any;
    error?: {
        code: number;
        message: string;
        data?: any;
    };
}

interface QuotaProfile {
    userId: string;
    totalTokens: number;
    usedTokens: number;
    tier: 'free' | 'pro' | 'enterprise';
    dailyLimit: number;
    lastReset: string;
}

async function getOrCreateQuota(userId = 'default_user'): Promise<QuotaProfile> {
    const existing = await prisma.quotaProfile.findFirst({ where: { userId } }).catch(() => null);
    if (existing) {
        return {
            userId: existing.userId,
            totalTokens: Number(existing.totalTokens ?? 250000),
            usedTokens: Number(existing.usedTokens ?? 0),
            tier: existing.tier || 'pro',
            dailyLimit: Number(existing.dailyLimit ?? 250000),
            lastReset: existing.lastReset || new Date().toISOString(),
        };
    }

    const created: QuotaProfile = {
        userId,
        totalTokens: 250000,
        usedTokens: 0,
        tier: 'pro',
        dailyLimit: 250000,
        lastReset: new Date().toISOString(),
    };
    await prisma.quotaProfile.create({ data: created }).catch(() => null);
    return created;
}

async function incrementQuotaUsage(userId: string, tokens: number): Promise<QuotaProfile> {
    const current = await getOrCreateQuota(userId);
    const nextUsed = current.usedTokens + Math.max(0, tokens);
    const existing = await prisma.quotaProfile.findFirst({ where: { userId } }).catch(() => null);
    if (existing) {
        await prisma.quotaProfile.update({
            where: { id: existing.id },
            data: { usedTokens: nextUsed },
        }).catch(() => null);
    }
    return { ...current, usedTokens: nextUsed };
}

export function handleToolsList() {
    return {
        tools: [
            {
                name: 'akasha_get_structured_blueprint',
                description: 'Retrieve the full single-source-of-truth architectural blueprint (Feature Slices, Data Models with typed fields, REST API contracts, UI Pages, Team Decisions, and Tasks).',
                inputSchema: {
                    type: 'object',
                    properties: { projectId: { type: 'string', description: 'Project ID in Akasha' } },
                    required: ['projectId'],
                },
            },
            {
                name: 'akasha_list_feature_slices',
                description: 'List all vertical Feature Slices for a project, including MVP/V1.1/Later lanes, owners, acceptance criteria, and linked models/APIs.',
                inputSchema: {
                    type: 'object',
                    properties: { projectId: { type: 'string', description: 'Project ID in Akasha' } },
                    required: ['projectId'],
                },
            },
            {
                name: 'akasha_get_feature_build_pack',
                description: 'Compile a focused, low-token Build Pack for ONE Feature Slice (acceptance criteria, domain edge cases, exact entity fields, exact REST endpoints, and team ADRs).',
                inputSchema: {
                    type: 'object',
                    properties: {
                        projectId: { type: 'string', description: 'Project ID' },
                        sliceId: { type: 'string', description: 'Feature Slice ID or title' },
                    },
                    required: ['projectId', 'sliceId'],
                },
            },
            {
                name: 'akasha_claim_task',
                description: 'Claim a team Kanban task (marks status=in_progress and records claimedBy) so teammates and parallel agents do not collide.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        projectId: { type: 'string' },
                        taskId: { type: 'string' },
                        agentName: { type: 'string', description: 'Name of the developer or coding agent claiming the task' },
                    },
                    required: ['projectId', 'taskId', 'agentName'],
                },
            },
            {
                name: 'akasha_update_task_status',
                description: 'Update the status of a Kanban task in Akasha when work progresses or finishes.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        projectId: { type: 'string' },
                        taskId: { type: 'string' },
                        status: { type: 'string', enum: ['todo', 'in_progress', 'done'] },
                    },
                    required: ['projectId', 'taskId', 'status'],
                },
            },
            {
                name: 'akasha_stream_agent_telemetry',
                description: 'Persist and stream live thoughts, tool executions, modified files, and progress to Akasha Mission Control over SSE (works across stdio and HTTP).',
                inputSchema: {
                    type: 'object',
                    properties: {
                        projectId: { type: 'string' },
                        agentRole: { type: 'string', enum: ['architect', 'frontend', 'backend', 'qa_verifier'] },
                        stepName: { type: 'string' },
                        thought: { type: 'string' },
                        activeTool: { type: 'string' },
                        toolArgsSnippet: { type: 'string' },
                        fileCreatedOrModified: { type: 'string' },
                        type: { type: 'string', enum: ['thought', 'tool_call', 'tool_result', 'file_change', 'build_check', 'success', 'error'] },
                        progress: { type: 'number' },
                    },
                    required: ['projectId', 'agentRole', 'stepName', 'thought'],
                },
            },
            {
                name: 'akasha_upsert_data_model',
                description: 'Bi-directionally create or update a DataModel entity in Akasha so the team blueprint stays synced with implemented code.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        projectId: { type: 'string' },
                        name: { type: 'string' },
                        description: { type: 'string' },
                        fields: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    name: { type: 'string' },
                                    field_type: { type: 'string' },
                                    required: { type: 'boolean' },
                                    unique: { type: 'boolean' },
                                    primary_key: { type: 'boolean' },
                                },
                                required: ['name', 'field_type'],
                            },
                        },
                    },
                    required: ['projectId', 'name', 'fields'],
                },
            },
            {
                name: 'akasha_upsert_api_endpoint',
                description: 'Bi-directionally create or update a REST API endpoint contract in Akasha.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        projectId: { type: 'string' },
                        method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
                        path: { type: 'string' },
                        name: { type: 'string' },
                        description: { type: 'string' },
                    },
                    required: ['projectId', 'method', 'path'],
                },
            },
            {
                name: 'akasha_record_decision',
                description: 'Record an Architecture or Product Decision (ADR) into the shared team log.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        projectId: { type: 'string' },
                        title: { type: 'string' },
                        decision: { type: 'string' },
                        context: { type: 'string' },
                        author: { type: 'string' },
                        linkedSliceId: { type: 'string' },
                    },
                    required: ['projectId', 'title', 'decision'],
                },
            },
            {
                name: 'akasha_check_drift',
                description: 'Scan a local workspace directory and compare implemented code models/routes against Akasha\'s Living Blueprint.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        projectId: { type: 'string' },
                        workspaceDir: { type: 'string', description: 'Optional absolute path to scan' },
                    },
                    required: ['projectId'],
                },
            },
            {
                name: 'akasha_sync_cloud',
                description: 'Sync generated project files or a local sourceDir into MongoDB GridFS cloud storage.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        projectId: { type: 'string' },
                        sourceDir: { type: 'string', description: 'Optional local folder to upload into GridFS' },
                    },
                    required: ['projectId'],
                },
            },
            {
                name: 'akasha_get_cloud_tree',
                description: 'Retrieve the file tree stored in MongoDB GridFS cloud storage for a project.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        projectId: { type: 'string' },
                        folderPath: { type: 'string' },
                    },
                    required: ['projectId'],
                },
            },
            {
                name: 'akasha_preview_info',
                description: 'Get live clickable prototype URL, Shareable Preview URL, and Live Stateful Mock API base URL for a project.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        projectId: { type: 'string' },
                        port: { type: 'number' },
                    },
                    required: ['projectId'],
                },
            },
            {
                name: 'akasha_get_squad_topology',
                description: 'Get active squad configuration and execution mode.',
                inputSchema: {
                    type: 'object',
                    properties: { projectId: { type: 'string' } },
                    required: ['projectId'],
                },
            },
            {
                name: 'akasha_check_quota',
                description: 'Check MongoDB-persisted token quota and remaining budget.',
                inputSchema: {
                    type: 'object',
                    properties: { userId: { type: 'string' } },
                },
            },
            {
                name: 'akasha_consume_quota',
                description: 'Debit consumed tokens from the MongoDB-persisted user quota.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        tokens: { type: 'number' },
                        action: { type: 'string' },
                        userId: { type: 'string' },
                    },
                    required: ['tokens', 'action'],
                },
            },
        ],
    };
}

function asTextResult(payload: unknown) {
    return {
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
    };
}

export async function handleToolCall(name: string, args: any, source: 'mcp_stdio' | 'mcp_http' = 'mcp_http') {
    switch (name) {
        case 'akasha_check_quota': {
            const userId = args?.userId || 'default_user';
            const quota = await getOrCreateQuota(userId);
            const remaining = Math.max(0, quota.totalTokens - quota.usedTokens);
            const percentUsed = Math.min(100, Math.round((quota.usedTokens / quota.totalTokens) * 100));
            return asTextResult({
                userId,
                tier: quota.tier,
                totalTokens: quota.totalTokens,
                usedTokens: quota.usedTokens,
                remainingTokens: remaining,
                percentageUsed: `${percentUsed}%`,
                status: remaining > 0 ? 'AVAILABLE' : 'EXHAUSTED',
                persistedIn: 'MongoDB',
            });
        }

        case 'akasha_consume_quota': {
            const userId = args?.userId || 'default_user';
            const tokens = Number(args?.tokens) || 0;
            const updated = await incrementQuotaUsage(userId, tokens);
            const remaining = Math.max(0, updated.totalTokens - updated.usedTokens);
            return asTextResult({
                success: true,
                debitedTokens: tokens,
                action: args?.action || 'unspecified_task',
                remainingTokens: remaining,
                exhausted: remaining <= 0,
            });
        }

        case 'akasha_get_structured_blueprint': {
            const { projectId } = args || {};
            if (!projectId) throw new Error('projectId is required');
            const blueprint = await compileProjectBlueprint(projectId);
            return asTextResult(blueprint);
        }

        case 'akasha_list_feature_slices': {
            const { projectId } = args || {};
            if (!projectId) throw new Error('projectId is required');
            const ws = await listProjectWorkspaceSlices(projectId);
            return asTextResult({ projectId, slices: ws.slices, decisions: ws.decisions });
        }

        case 'akasha_get_feature_build_pack': {
            const { projectId, sliceId } = args || {};
            if (!projectId || !sliceId) throw new Error('projectId and sliceId are required');
            const pack = await compileFeatureBuildPack(projectId, sliceId);
            return asTextResult(pack);
        }

        case 'akasha_claim_task': {
            const { projectId, taskId, agentName } = args || {};
            if (!projectId || !taskId || !agentName) throw new Error('projectId, taskId, and agentName are required');
            const project = await prisma.project.findUnique({ where: { id: projectId } });
            if (!project) throw new Error(`Project ${projectId} not found`);

            const settings = safeJsonParse<Record<string, any>>(project.settings, {});
            const tasks: any[] = Array.isArray(settings.teamTasks) ? settings.teamTasks : [];
            const task = tasks.find((t: any) => t.id === taskId);
            if (!task) throw new Error(`Task ${taskId} not found`);

            task.status = 'in_progress';
            task.claimedBy = agentName;
            task.claimedAt = new Date().toISOString();
            settings.teamTasks = tasks;

            await prisma.project.update({
                where: { id: projectId },
                data: { settings: JSON.stringify(settings) },
            });

            return asTextResult({ success: true, taskId, claimedBy: agentName, status: 'in_progress' });
        }

        case 'akasha_update_task_status': {
            const { projectId, taskId, status } = args || {};
            if (!projectId || !taskId || !status) throw new Error('projectId, taskId, and status are required');
            const project = await prisma.project.findUnique({ where: { id: projectId } });
            if (!project) throw new Error(`Project ${projectId} not found`);

            const settings = safeJsonParse<Record<string, any>>(project.settings, {});
            const tasks: any[] = Array.isArray(settings.teamTasks) ? settings.teamTasks : [];
            const task = tasks.find((t: any) => t.id === taskId);
            if (task) {
                task.status = status;
                if (status === 'done') task.completedAt = new Date().toISOString();
                settings.teamTasks = tasks;
                await prisma.project.update({
                    where: { id: projectId },
                    data: { settings: JSON.stringify(settings) },
                });
            }
            return asTextResult({ success: true, taskId, newStatus: status });
        }

        case 'akasha_stream_agent_telemetry': {
            const { projectId, agentRole, stepName, thought, activeTool, toolArgsSnippet, fileCreatedOrModified, type, progress } = args || {};
            if (!projectId || !agentRole || !stepName || !thought) {
                throw new Error('projectId, agentRole, stepName, and thought are required');
            }
            const entry = await reportAgentAction(projectId, {
                agentRole: agentRole as AgentRole,
                stepName,
                thought,
                activeTool,
                toolArgsSnippet,
                fileCreatedOrModified,
                type,
                progress,
                source,
            });
            return asTextResult({ success: true, telemetryId: entry.id, persistedToMongo: true });
        }

        case 'akasha_upsert_data_model': {
            const { projectId, name: modelName, description, fields } = args || {};
            if (!projectId || !modelName || !Array.isArray(fields)) {
                throw new Error('projectId, name, and fields[] are required');
            }
            const existingModels = await prisma.dataModel.findMany({ where: { projectId } });
            const existing = (existingModels || []).find(
                (m: any) => m.archived !== true && String(m.name).toLowerCase() === String(modelName).toLowerCase()
            );
            const schema = {
                description: description || '',
                fields: fields.map((f: any) => ({
                    id: f.name,
                    name: f.name,
                    field_type: f.field_type || f.type || 'string',
                    required: f.required !== false,
                    unique: Boolean(f.unique || f.primary_key),
                    primary_key: Boolean(f.primary_key || f.name === 'id'),
                })),
                relations: [],
            };
            if (existing) {
                await prisma.dataModel.update({
                    where: { id: existing.id },
                    data: { name: modelName, schema: JSON.stringify(schema) },
                });
                return asTextResult({ success: true, action: 'updated', id: existing.id, name: modelName });
            }
            const created = await prisma.dataModel.create({
                data: { projectId, name: modelName, schema: JSON.stringify(schema), archived: false },
            });
            return asTextResult({ success: true, action: 'created', id: created.id, name: modelName });
        }

        case 'akasha_upsert_api_endpoint': {
            const { projectId, method, path: routePath, name: apiName, description } = args || {};
            if (!projectId || !method || !routePath) {
                throw new Error('projectId, method, and path are required');
            }
            const existingApis = await prisma.apiEndpoint.findMany({ where: { projectId } });
            const existing = (existingApis || []).find(
                (a: any) => a.archived !== true && String(a.method).toUpperCase() === String(method).toUpperCase() && a.path === routePath
            );
            const config = { description: description || '' };
            if (existing) {
                await prisma.apiEndpoint.update({
                    where: { id: existing.id },
                    data: { name: apiName || existing.name, config: JSON.stringify(config) },
                });
                return asTextResult({ success: true, action: 'updated', id: existing.id, method, path: routePath });
            }
            const created = await prisma.apiEndpoint.create({
                data: {
                    projectId,
                    method: String(method).toUpperCase(),
                    path: routePath,
                    name: apiName || `${String(method).toUpperCase()} ${routePath}`,
                    config: JSON.stringify(config),
                    archived: false,
                },
            });
            return asTextResult({ success: true, action: 'created', id: created.id, method, path: routePath });
        }

        case 'akasha_record_decision': {
            const { projectId, title, decision, context, author, linkedSliceId } = args || {};
            if (!projectId || !title || !decision) throw new Error('projectId, title, and decision are required');
            const created = await addProjectDecision({ projectId, title, decision, context, author, linkedSliceId });
            return asTextResult({ success: true, decision: created });
        }

        case 'akasha_check_drift': {
            const { projectId, workspaceDir } = args || {};
            if (!projectId) throw new Error('projectId is required');
            const report = await runProjectDriftCheck({ projectId, workspaceDir });
            return asTextResult(report);
        }

        case 'akasha_sync_cloud': {
            const { projectId, sourceDir } = args || {};
            if (!projectId) throw new Error('projectId is required');
            if (sourceDir && (await fs.pathExists(sourceDir))) {
                const uploaded: string[] = [];
                const ignored = new Set(['node_modules', '.git', 'dist', 'build']);
                const walk = async (dir: string) => {
                    const entries = await fs.readdir(dir, { withFileTypes: true });
                    for (const entry of entries) {
                        if (ignored.has(entry.name)) continue;
                        const full = path.join(dir, entry.name);
                        if (entry.isDirectory()) {
                            await walk(full);
                        } else if (uploaded.length < 100) {
                            const rel = path.relative(sourceDir, full).replace(/\\/g, '/');
                            const buf = await fs.readFile(full);
                            await storageService.saveFile(projectId, rel, buf);
                            uploaded.push(rel);
                        }
                    }
                };
                await walk(sourceDir);
                return asTextResult({ success: true, projectId, uploadedCount: uploaded.length, storageEngine: 'MongoDB GridFS' });
            }
            const syncResult = await storageService.syncProjectToCloud(projectId);
            return asTextResult({ ...syncResult, projectId, storageEngine: 'MongoDB GridFS' });
        }

        case 'akasha_get_cloud_tree': {
            const { projectId, folderPath } = args || {};
            if (!projectId) throw new Error('projectId is required');
            const treeResult = await storageService.listDirectory(projectId, folderPath || '');
            return asTextResult({
                projectId,
                folderPath: treeResult.path || '/',
                totalItems: treeResult.entries.length,
                items: treeResult.entries,
            });
        }

        case 'akasha_preview_info': {
            const { projectId, port = 5173 } = args || {};
            if (!projectId) throw new Error('projectId is required');
            const project = await prisma.project.findUnique({ where: { id: projectId } }).catch(() => null);
            const settings = safeJsonParse<Record<string, any>>(project?.settings, {});
            const tokenQuery = settings.shareToken ? `?token=${settings.shareToken}` : '';
            return asTextResult({
                projectId,
                studioUrl: `http://localhost:${port}`,
                shareablePreviewUrl: `http://localhost:${port}/preview/${projectId}${tokenQuery}`,
                liveMockApiBaseUrl: `http://localhost:${process.env.PORT || 3001}/api/mock/${projectId}`,
                shareEnabled: settings.shareEnabled !== false,
            });
        }

        case 'akasha_get_squad_topology': {
            const { projectId } = args || {};
            if (!projectId) throw new Error('projectId is required');
            const config = getSquadConfig(projectId);
            return asTextResult({
                projectId,
                executionMode: config.executionMode,
                dispatchStrategy: config.dispatchStrategy,
                members: config.members.map((m) => ({ role: m.role, name: m.name, status: m.status })),
            });
        }

        default:
            throw new Error(`Unknown tool: ${name}`);
    }
}

export function startMcpServer() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false,
    });

    rl.on('line', async (line) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        let request: JsonRpcRequest;
        try {
            request = JSON.parse(trimmed);
        } catch {
            return;
        }

        const id = request.id ?? null;

        try {
            if (request.method === 'initialize') {
                const response: JsonRpcResponse = {
                    jsonrpc: '2.0',
                    id,
                    result: {
                        protocolVersion: '2024-11-05',
                        capabilities: { tools: {} },
                        serverInfo: { name: 'akasha-mcp-server', version: '2.0.0' },
                    },
                };
                process.stdout.write(JSON.stringify(response) + '\n');
                return;
            }

            if (request.method === 'notifications/initialized') return;

            if (request.method === 'tools/list') {
                const response: JsonRpcResponse = {
                    jsonrpc: '2.0',
                    id,
                    result: handleToolsList(),
                };
                process.stdout.write(JSON.stringify(response) + '\n');
                return;
            }

            if (request.method === 'tools/call') {
                const toolName = request.params?.name;
                const toolArgs = request.params?.arguments || {};
                const toolResult = await handleToolCall(toolName, toolArgs, 'mcp_stdio');
                const response: JsonRpcResponse = { jsonrpc: '2.0', id, result: toolResult };
                process.stdout.write(JSON.stringify(response) + '\n');
                return;
            }

            const response: JsonRpcResponse = {
                jsonrpc: '2.0',
                id,
                error: { code: -32601, message: `Method not found: ${request.method}` },
            };
            process.stdout.write(JSON.stringify(response) + '\n');
        } catch (err: any) {
            const response: JsonRpcResponse = {
                jsonrpc: '2.0',
                id,
                error: { code: -32000, message: err?.message || 'Internal MCP server error' },
            };
            process.stdout.write(JSON.stringify(response) + '\n');
        }
    });

    process.stderr.write('[Akasha MCP Server v2.0] Running on stdio (MongoDB-persisted telemetry)...\n');
}

if (process.argv[1] && process.argv[1].includes('akashaMcpServer')) {
    startMcpServer();
}
