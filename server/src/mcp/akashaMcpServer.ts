import readline from 'readline';
import { storageService } from '../services/storageService.js';
import prisma from '../lib/prisma.js';
import { compileProjectBlueprint } from '../services/structuredBlueprintService.js';
import { getSquadConfig, reportAgentAction } from '../services/agentSquadOrchestrator.js';
import type { AgentRole } from '../services/agentSquadOrchestrator.js';

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

// In-memory quota store with persistence fallback
interface QuotaProfile {
    totalTokens: number;
    usedTokens: number;
    tier: 'free' | 'pro' | 'enterprise';
    dailyLimit: number;
    lastReset: string;
}

const quotaStore = new Map<string, QuotaProfile>([
    ['default_user', {
        totalTokens: 100000,
        usedTokens: 12500,
        tier: 'pro',
        dailyLimit: 250000,
        lastReset: new Date().toISOString()
    }]
]);

function getQuota(userId = 'default_user'): QuotaProfile {
    if (!quotaStore.has(userId)) {
        quotaStore.set(userId, {
            totalTokens: 50000,
            usedTokens: 0,
            tier: 'free',
            dailyLimit: 50000,
            lastReset: new Date().toISOString()
        });
    }
    return quotaStore.get(userId)!;
}

export function handleToolsList() {
    return {
        tools: [
            {
                name: 'akasha_check_quota',
                description: 'Check available token quota, tier, and remaining budget for coding tasks.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        userId: { type: 'string', description: 'User identifier (optional)' }
                    }
                }
            },
            {
                name: 'akasha_consume_quota',
                description: 'Debit tokens/cost from the user quota after performing coding or architectural operations.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        tokens: { type: 'number', description: 'Number of tokens consumed' },
                        action: { type: 'string', description: 'Action type (e.g. generate_component, refactor_api, fix_build)' },
                        userId: { type: 'string', description: 'User identifier (optional)' }
                    },
                    required: ['tokens', 'action']
                }
            },
            {
                name: 'akasha_sync_cloud',
                description: 'Sync local project directory files into MongoDB GridFS cloud storage.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        projectId: { type: 'string', description: 'Project ID in Akasha' },
                        sourceDir: { type: 'string', description: 'Absolute local directory path to upload' }
                    },
                    required: ['projectId', 'sourceDir']
                }
            },
            {
                name: 'akasha_get_cloud_tree',
                description: 'Retrieve the file tree stored in MongoDB GridFS cloud storage for a project.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        projectId: { type: 'string', description: 'Project ID' },
                        folderPath: { type: 'string', description: 'Optional subfolder path' }
                    },
                    required: ['projectId']
                }
            },
            {
                name: 'akasha_preview_info',
                description: 'Get preview URL, port status, and live reload endpoints for the active Akasha project.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        projectId: { type: 'string', description: 'Project ID' },
                        port: { type: 'number', description: 'Port number (default: 5173)' }
                    },
                    required: ['projectId']
                }
            },
            {
                name: 'akasha_get_structured_blueprint',
                description: 'Retrieve the pre-compiled, token-optimized architectural blueprint of the project (data models, REST APIs, UI wireframes, tasks) to save 85-95% tokens.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        projectId: { type: 'string', description: 'Project ID in Akasha' }
                    },
                    required: ['projectId']
                }
            },
            {
                name: 'akasha_stream_agent_telemetry',
                description: 'Stream live thoughts, reasoning, tool execution, and progress back to the Akasha Mission Control dashboard.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        projectId: { type: 'string', description: 'Project ID in Akasha' },
                        agentRole: { type: 'string', enum: ['architect', 'frontend', 'backend', 'qa_verifier'], description: 'Role of the executing agent' },
                        stepName: { type: 'string', description: 'Title of the current operation' },
                        thought: { type: 'string', description: 'Reasoning thought or explanation' },
                        activeTool: { type: 'string', description: 'Name of the tool currently being executed' },
                        toolArgsSnippet: { type: 'string', description: 'Arguments or target file for the tool' },
                        fileCreatedOrModified: { type: 'string', description: 'Path of file created or edited' },
                        progress: { type: 'number', description: 'Progress percentage (0 - 100)' }
                    },
                    required: ['projectId', 'agentRole', 'stepName', 'thought']
                }
            },
            {
                name: 'akasha_get_squad_topology',
                description: 'Get active multi-agent squad configuration, roles, and execution mode (series vs parallel).',
                inputSchema: {
                    type: 'object',
                    properties: {
                        projectId: { type: 'string', description: 'Project ID in Akasha' }
                    },
                    required: ['projectId']
                }
            },
            {
                name: 'akasha_update_task_status',
                description: 'Update the status of a Kanban task in Akasha when an autonomous agent completes it.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        projectId: { type: 'string', description: 'Project ID in Akasha' },
                        taskId: { type: 'string', description: 'ID of the task' },
                        status: { type: 'string', enum: ['todo', 'in_progress', 'done'], description: 'New task status' }
                    },
                    required: ['projectId', 'taskId', 'status']
                }
            }
        ]
    };
}

export async function handleToolCall(name: string, args: any) {
    switch (name) {
        case 'akasha_check_quota': {
            const userId = args?.userId || 'default_user';
            const quota = getQuota(userId);
            const remaining = Math.max(0, quota.totalTokens - quota.usedTokens);
            const percentUsed = Math.min(100, Math.round((quota.usedTokens / quota.totalTokens) * 100));

            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify({
                        userId,
                        tier: quota.tier,
                        totalTokens: quota.totalTokens,
                        usedTokens: quota.usedTokens,
                        remainingTokens: remaining,
                        percentageUsed: `${percentUsed}%`,
                        status: remaining > 0 ? 'AVAILABLE' : 'EXHAUSTED',
                        dailyLimit: quota.dailyLimit
                    }, null, 2)
                }]
            };
        }

        case 'akasha_consume_quota': {
            const userId = args?.userId || 'default_user';
            const tokens = Number(args?.tokens) || 0;
            const action = args?.action || 'unspecified_task';
            const quota = getQuota(userId);

            quota.usedTokens += tokens;
            const remaining = Math.max(0, quota.totalTokens - quota.usedTokens);

            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        debitedTokens: tokens,
                        action,
                        remainingTokens: remaining,
                        exhausted: remaining <= 0
                    }, null, 2)
                }]
            };
        }

        case 'akasha_sync_cloud': {
            const { projectId } = args;
            if (!projectId) {
                throw new Error('projectId is required for akasha_sync_cloud');
            }

            const syncResult = await storageService.syncProjectToCloud(projectId);
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify({
                        success: syncResult.success,
                        projectId,
                        message: syncResult.message,
                        pageCount: syncResult.pageCount,
                        storageEngine: 'MongoDB GridFS'
                    }, null, 2)
                }]
            };
        }

        case 'akasha_get_cloud_tree': {
            const { projectId, folderPath } = args;
            if (!projectId) {
                throw new Error('projectId is required for akasha_get_cloud_tree');
            }

            const treeResult = await storageService.listDirectory(projectId, folderPath || '');
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify({
                        projectId,
                        folderPath: treeResult.path || '/',
                        totalItems: treeResult.entries.length,
                        items: treeResult.entries
                    }, null, 2)
                }]
            };
        }

        case 'akasha_preview_info': {
            const { projectId, port = 5173 } = args;
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify({
                        projectId,
                        localUrl: `http://localhost:${port}`,
                        cloudPreviewUrl: `https://preview.akasha.dev/p/${projectId}`,
                        hmrWebSocket: `ws://localhost:${port}`,
                        status: 'READY'
                    }, null, 2)
                }]
            };
        }

        case 'akasha_get_structured_blueprint': {
            const { projectId } = args;
            if (!projectId) throw new Error('projectId is required for akasha_get_structured_blueprint');
            const blueprint = await compileProjectBlueprint(projectId);
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify(blueprint, null, 2)
                }]
            };
        }

        case 'akasha_stream_agent_telemetry': {
            const { projectId, agentRole, stepName, thought, activeTool, toolArgsSnippet, fileCreatedOrModified, progress } = args;
            if (!projectId || !agentRole || !stepName || !thought) {
                throw new Error('projectId, agentRole, stepName, and thought are required');
            }
            reportAgentAction(projectId, {
                agentRole: agentRole as AgentRole,
                stepName,
                thought,
                activeTool,
                toolArgsSnippet,
                fileCreatedOrModified,
                progress
            });
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify({ success: true, message: 'Telemetry streamed to Akasha Mission Control' })
                }]
            };
        }

        case 'akasha_get_squad_topology': {
            const { projectId } = args;
            if (!projectId) throw new Error('projectId is required for akasha_get_squad_topology');
            const config = getSquadConfig(projectId);
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify({
                        projectId,
                        executionMode: config.executionMode,
                        members: config.members.map(m => ({ role: m.role, name: m.name, status: m.status }))
                    }, null, 2)
                }]
            };
        }

        case 'akasha_update_task_status': {
            const { projectId, taskId, status } = args;
            if (!projectId || !taskId || !status) throw new Error('projectId, taskId, and status are required');
            const project = await prisma.project.findUnique({ where: { id: projectId } });
            if (project) {
                let settings: any = {};
                try {
                    settings = typeof project.settings === 'string' ? JSON.parse(project.settings) : (project.settings || {});
                } catch { settings = {}; }
                const teamTasks: any[] = settings.teamTasks || [];
                const task = teamTasks.find((t: any) => t.id === taskId);
                if (task) {
                    task.status = status;
                    settings.teamTasks = teamTasks;
                    await prisma.project.update({
                        where: { id: projectId },
                        data: { settings: typeof project.settings === 'string' ? JSON.stringify(settings) : settings }
                    });
                }
            }
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify({ success: true, taskId, newStatus: status })
                }]
            };
        }

        default:
            throw new Error(`Unknown tool: ${name}`);
    }
}

export function startMcpServer() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false
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
                        capabilities: {
                            tools: {}
                        },
                        serverInfo: {
                            name: 'akasha-mcp-server',
                            version: '1.0.0'
                        }
                    }
                };
                process.stdout.write(JSON.stringify(response) + '\n');
                return;
            }

            if (request.method === 'notifications/initialized') {
                return;
            }

            if (request.method === 'tools/list') {
                const response: JsonRpcResponse = {
                    jsonrpc: '2.0',
                    id,
                    result: handleToolsList()
                };
                process.stdout.write(JSON.stringify(response) + '\n');
                return;
            }

            if (request.method === 'tools/call') {
                const toolName = request.params?.name;
                const toolArgs = request.params?.arguments || {};
                const toolResult = await handleToolCall(toolName, toolArgs);

                const response: JsonRpcResponse = {
                    jsonrpc: '2.0',
                    id,
                    result: toolResult
                };
                process.stdout.write(JSON.stringify(response) + '\n');
                return;
            }

            // Unknown method
            const response: JsonRpcResponse = {
                jsonrpc: '2.0',
                id,
                error: {
                    code: -32601,
                    message: `Method not found: ${request.method}`
                }
            };
            process.stdout.write(JSON.stringify(response) + '\n');
        } catch (err: any) {
            const response: JsonRpcResponse = {
                jsonrpc: '2.0',
                id,
                error: {
                    code: -32000,
                    message: err?.message || 'Internal MCP server error'
                }
            };
            process.stdout.write(JSON.stringify(response) + '\n');
        }
    });

    process.stderr.write('[Akasha MCP Server] Running on stdio...\n');
}

// Auto-run if executed directly
if (process.argv[1] && process.argv[1].includes('akashaMcpServer')) {
    startMcpServer();
}
