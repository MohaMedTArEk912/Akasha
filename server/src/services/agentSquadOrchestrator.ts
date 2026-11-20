/**
 * Akasha V2 Real Agent Mission Orchestrator
 *
 * ZERO fake sleep() loops. Every mission is persisted to MongoDB (`AgentMission` & `AgentTelemetry`)
 * and streams live events to Mission Control via SSE (`telemetryBus.ts`).
 *
 * Supports two real execution modes:
 * 1. `handoff` (MCP IDE Agent Dispatch): Compiles a scoped Feature Build Pack (or full blueprint),
 *    persists `.akasha/blueprint.json` + `.akasha/missions/<id>.md`, and enters `awaiting_agent`
 *    until an external agent (Antigravity, Cursor, Claude Code) claims and completes it via MCP.
 * 2. `generate` (Real Server-Side Full-Stack Synthesis): Runs real `GeneratorService.generateFullStack()`,
 *    syncs generated files to MongoDB GridFS, runs real Drift Detection on generated code, and runs
 *    a real `tsc --noEmit` check when dependencies are present.
 */

import fs from 'fs-extra';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import prisma from '../lib/prisma.js';
import { safeJsonParse } from '../utils/safeJsonParse.js';
import {
    compileProjectBlueprint,
    compileFeatureBuildPack,
    persistBlueprintToFile,
} from './structuredBlueprintService.js';
import { GeneratorService } from './generator.js';
import { storageService } from './storageService.js';
import { runProjectDriftCheck } from './driftDetectionService.js';
import {
    publishTelemetryEvent,
    getRecentTelemetry,
    emitMissionUpdate,
    type PersistedTelemetryLog,
} from './telemetryBus.js';
import { getLLMProvider } from '../lib/llmProvider.js';

const execFileAsync = promisify(execFile);

export type AgentRole = 'architect' | 'frontend' | 'backend' | 'qa_verifier';
export type ExecutionMode = 'series' | 'parallel';
export type DispatchStrategy = 'generate' | 'handoff';

export interface SquadMember {
    id: string;
    role: AgentRole;
    name: string;
    description: string;
    avatarGradient: string;
    status: 'idle' | 'thinking' | 'executing' | 'completed' | 'error';
    currentTask?: string;
    activeTool?: string;
    lastThought?: string;
    filesModified: string[];
    tokensUsed: number;
}

export type TelemetryLog = PersistedTelemetryLog;

export interface SquadConfiguration {
    projectId: string;
    executionMode: ExecutionMode;
    dispatchStrategy: DispatchStrategy;
    members: SquadMember[];
    autoSelfHealBuild: boolean;
    syncToGridFS: boolean;
    updatedAt: string;
}

export interface ActiveSquadMission {
    id: string;
    projectId: string;
    prompt: string;
    sliceId?: string;
    executionMode: ExecutionMode;
    dispatchStrategy: DispatchStrategy;
    status: 'idle' | 'awaiting_agent' | 'running' | 'completed' | 'failed';
    progress: number;
    startedAt: string;
    completedAt?: string;
    logs: TelemetryLog[];
    filesChanged: string[];
    buildPackMarkdown?: string;
    outputPath?: string;
    stats: {
        totalTokensSaved: number;
        totalTokensUsed: number;
        toolsExecuted: number;
        buildErrorsSelfHealed: number;
    };
    error?: string;
}

const squadConfigs = new Map<string, SquadConfiguration>();

const DEFAULT_MEMBERS: SquadMember[] = [
    {
        id: 'member-architect',
        role: 'architect',
        name: 'Aria (Product Architect)',
        description: 'Compiles structured blueprints, Feature Build Packs, and verifies contract boundaries.',
        avatarGradient: 'from-indigo-500 to-purple-600',
        status: 'idle',
        filesModified: [],
        tokensUsed: 0,
    },
    {
        id: 'member-frontend',
        role: 'frontend',
        name: 'Leo (Frontend Engineer)',
        description: 'Generates typed React 18 + Tailwind views bound to live API contracts.',
        avatarGradient: 'from-cyan-500 to-blue-600',
        status: 'idle',
        filesModified: [],
        tokensUsed: 0,
    },
    {
        id: 'member-backend',
        role: 'backend',
        name: 'Rex (Backend Engineer)',
        description: 'Synthesizes Express 5 REST routes, MongoDB collections, and seed scripts.',
        avatarGradient: 'from-emerald-500 to-teal-600',
        status: 'idle',
        filesModified: [],
        tokensUsed: 0,
    },
    {
        id: 'member-qa',
        role: 'qa_verifier',
        name: 'Vera (Drift & Build Verifier)',
        description: 'Audits Blueprint-vs-Code drift, syncs GridFS, and verifies TypeScript compilation.',
        avatarGradient: 'from-rose-500 to-orange-600',
        status: 'idle',
        filesModified: [],
        tokensUsed: 0,
    },
];

export function getSquadConfig(projectId: string): SquadConfiguration {
    let config = squadConfigs.get(projectId);
    if (!config) {
        config = {
            projectId,
            executionMode: 'parallel',
            dispatchStrategy: 'generate',
            members: JSON.parse(JSON.stringify(DEFAULT_MEMBERS)),
            autoSelfHealBuild: true,
            syncToGridFS: true,
            updatedAt: new Date().toISOString(),
        };
        squadConfigs.set(projectId, config);
    }
    return config;
}

export function updateSquadConfig(projectId: string, updates: Partial<SquadConfiguration>): SquadConfiguration {
    const current = getSquadConfig(projectId);
    const updated: SquadConfiguration = {
        ...current,
        ...updates,
        projectId,
        updatedAt: new Date().toISOString(),
    };
    squadConfigs.set(projectId, updated);
    return updated;
}

function hydrateMissionDoc(doc: any, logs: TelemetryLog[]): ActiveSquadMission {
    return {
        id: doc.id,
        projectId: doc.projectId,
        prompt: doc.prompt || '',
        sliceId: doc.sliceId || undefined,
        executionMode: doc.executionMode || 'parallel',
        dispatchStrategy: doc.dispatchStrategy || 'generate',
        status: doc.status || 'idle',
        progress: Number(doc.progress || 0),
        startedAt: doc.startedAt || new Date().toISOString(),
        completedAt: doc.completedAt || undefined,
        logs,
        filesChanged: Array.isArray(doc.filesChanged) ? doc.filesChanged : [],
        buildPackMarkdown: doc.buildPackMarkdown || undefined,
        outputPath: doc.outputPath || undefined,
        stats: doc.stats || {
            totalTokensSaved: 0,
            totalTokensUsed: 0,
            toolsExecuted: 0,
            buildErrorsSelfHealed: 0,
        },
        error: doc.error || undefined,
    };
}

export async function getActiveMission(projectId: string): Promise<ActiveSquadMission> {
    const [latest, logs] = await Promise.all([
        prisma.agentMission.findFirst({
            where: { projectId },
            orderBy: { createdAt: 'desc' },
        }).catch(() => null),
        getRecentTelemetry(projectId, 80),
    ]);

    if (latest) {
        return hydrateMissionDoc(latest, logs);
    }

    return {
        id: `mission-idle-${projectId}`,
        projectId,
        prompt: 'Idle — Ready to generate full-stack code or hand off a Feature Build Pack via MCP',
        executionMode: getSquadConfig(projectId).executionMode,
        dispatchStrategy: getSquadConfig(projectId).dispatchStrategy,
        status: 'idle',
        progress: 0,
        startedAt: new Date().toISOString(),
        logs,
        filesChanged: [],
        stats: {
            totalTokensSaved: 0,
            totalTokensUsed: 0,
            toolsExecuted: 0,
            buildErrorsSelfHealed: 0,
        },
    };
}

/**
 * Persists a telemetry event to MongoDB and updates the active mission + squad member state.
 * Works identically whether invoked via HTTP API or a separate stdio MCP process!
 */
export async function reportAgentAction(
    projectId: string,
    logData: {
        missionId?: string;
        agentRole: AgentRole;
        stepName: string;
        thought: string;
        activeTool?: string;
        toolArgsSnippet?: string;
        fileCreatedOrModified?: string;
        type?: 'thought' | 'tool_call' | 'tool_result' | 'file_change' | 'build_check' | 'success' | 'error';
        progress?: number;
        tokensUsedDelta?: number;
        source?: 'server' | 'mcp_stdio' | 'mcp_http';
    }
): Promise<TelemetryLog> {
    const config = getSquadConfig(projectId);
    const member = config.members.find((m) => m.role === logData.agentRole);
    const agentName = member ? member.name : logData.agentRole.toUpperCase();

    if (member) {
        member.lastThought = logData.thought;
        if (logData.activeTool) member.activeTool = logData.activeTool;
        if (logData.fileCreatedOrModified && !member.filesModified.includes(logData.fileCreatedOrModified)) {
            member.filesModified.push(logData.fileCreatedOrModified);
        }
        if (logData.tokensUsedDelta) member.tokensUsed += logData.tokensUsedDelta;
        member.status = logData.type === 'error' ? 'error' : logData.type === 'success' ? 'completed' : 'executing';
    }

    const latestMission = logData.missionId
        ? await prisma.agentMission.findUnique({ where: { id: logData.missionId } }).catch(() => null)
        : await prisma.agentMission.findFirst({ where: { projectId }, orderBy: { createdAt: 'desc' } }).catch(() => null);

    const entry = await publishTelemetryEvent({
        projectId,
        missionId: latestMission?.id || logData.missionId,
        agentRole: logData.agentRole,
        agentName,
        stepName: logData.stepName,
        thought: logData.thought,
        activeTool: logData.activeTool,
        toolArgsSnippet: logData.toolArgsSnippet,
        fileCreatedOrModified: logData.fileCreatedOrModified,
        type: logData.type,
        progress: logData.progress,
        tokensUsedDelta: logData.tokensUsedDelta,
        source: logData.source || 'server',
    });

    // Update persisted mission record so cross-process MCP telemetry reflects on Mission Control
    if (latestMission) {
        const filesChanged: string[] = Array.isArray(latestMission.filesChanged) ? [...latestMission.filesChanged] : [];
        if (logData.fileCreatedOrModified && !filesChanged.includes(logData.fileCreatedOrModified)) {
            filesChanged.push(logData.fileCreatedOrModified);
        }
        const stats = {
            totalTokensSaved: Number(latestMission.stats?.totalTokensSaved || 0),
            totalTokensUsed: Number(latestMission.stats?.totalTokensUsed || 0) + Number(logData.tokensUsedDelta || 0),
            toolsExecuted: Number(latestMission.stats?.toolsExecuted || 0) + (logData.activeTool ? 1 : 0),
            buildErrorsSelfHealed: Number(latestMission.stats?.buildErrorsSelfHealed || 0),
        };
        const nextProgress = typeof logData.progress === 'number'
            ? Math.min(100, Math.max(0, logData.progress))
            : Number(latestMission.progress || 0);
        const nextStatus =
            logData.type === 'error'
                ? 'failed'
                : nextProgress >= 100 && logData.type === 'success'
                    ? 'completed'
                    : latestMission.status === 'awaiting_agent'
                        ? 'running'
                        : latestMission.status;

        const updated = await prisma.agentMission.update({
            where: { id: latestMission.id },
            data: {
                progress: nextProgress,
                status: nextStatus,
                filesChanged,
                stats,
                ...(nextStatus === 'completed' ? { completedAt: new Date().toISOString() } : {}),
            },
        }).catch(() => null);

        if (updated) {
            emitMissionUpdate(projectId, updated);
        }
    }

    return entry;
}

/**
 * Dispatches a real, persisted mission (`generate` or `handoff`).
 */
export async function dispatchSquadMission(
    projectId: string,
    options: {
        prompt: string;
        executionMode?: ExecutionMode;
        dispatchStrategy?: DispatchStrategy;
        sliceId?: string;
        taskIds?: string[];
    }
): Promise<ActiveSquadMission> {
    const config = getSquadConfig(projectId);
    const executionMode = options.executionMode || config.executionMode;
    const dispatchStrategy: DispatchStrategy = options.dispatchStrategy || config.dispatchStrategy || 'generate';
    config.executionMode = executionMode;
    config.dispatchStrategy = dispatchStrategy;

    config.members.forEach((m) => {
        m.status = 'idle';
        m.activeTool = undefined;
        m.lastThought = undefined;
        m.filesModified = [];
    });

    const missionId = `mission-${Date.now()}`;
    const startedAt = new Date().toISOString();

    const createdDoc = await prisma.agentMission.create({
        data: {
            id: missionId,
            projectId,
            prompt: options.prompt,
            sliceId: options.sliceId || null,
            executionMode,
            dispatchStrategy,
            status: dispatchStrategy === 'handoff' ? 'awaiting_agent' : 'running',
            progress: 5,
            startedAt,
            filesChanged: [],
            stats: {
                totalTokensSaved: 0,
                totalTokensUsed: 0,
                toolsExecuted: 0,
                buildErrorsSelfHealed: 0,
            },
        },
    });

    emitMissionUpdate(projectId, createdDoc);

    if (dispatchStrategy === 'handoff') {
        await executeHandoffMission(projectId, missionId, options);
    } else {
        // Run real full-stack generation & verification asynchronously
        executeRealGenerateMission(projectId, missionId, options).catch(async (err) => {
            console.error('[SquadGenerate error]:', err);
            await prisma.agentMission.update({
                where: { id: missionId },
                data: { status: 'failed', error: err?.message || 'Mission failed' },
            }).catch(() => null);
            await reportAgentAction(projectId, {
                missionId,
                agentRole: 'qa_verifier',
                stepName: 'Mission Failed',
                thought: `Execution failed: ${err?.message || err}`,
                type: 'error',
            });
        });
    }

    return getActiveMission(projectId);
}

/**
 * Strategy A: MCP IDE Agent Handoff (Zero-Key Friendly, Built for Antigravity / Cursor / Claude Code)
 */
async function executeHandoffMission(
    projectId: string,
    missionId: string,
    options: { prompt: string; sliceId?: string; taskIds?: string[] }
) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    const targetDir = project?.rootPath || path.join(process.cwd(), 'projects', projectId);

    const blueprint = await compileProjectBlueprint(projectId);
    const bpPath = await persistBlueprintToFile(targetDir, blueprint);

    let buildPackMarkdown = blueprint.markdownSystemPrompt;
    let packTitle = blueprint.projectName;
    if (options.sliceId) {
        try {
            const pack = await compileFeatureBuildPack(projectId, options.sliceId);
            buildPackMarkdown = pack.markdownPrompt;
            packTitle = `Slice: ${pack.slice.title}`;
        } catch {
            // Fall back to full blueprint prompt
        }
    }

    const missionDir = path.join(targetDir, '.akasha', 'missions');
    await fs.ensureDir(missionDir);
    const missionFile = path.join(missionDir, `${missionId}.md`);
    const handoffDoc = `${buildPackMarkdown}\n\n## Mission Instruction\n${options.prompt}\n\n## MCP Reporting Contract\n1. Call \`akasha_claim_task\` before starting.\n2. Stream real progress via \`akasha_stream_agent_telemetry\` with \`projectId: "${projectId}"\`.\n3. Update completed tasks via \`akasha_update_task_status\` and run \`akasha_check_drift\`.\n`;
    await fs.writeFile(missionFile, handoffDoc, 'utf-8');

    await prisma.agentMission.update({
        where: { id: missionId },
        data: {
            status: 'awaiting_agent',
            progress: 25,
            buildPackMarkdown: handoffDoc,
            outputPath: missionFile,
            filesChanged: ['.akasha/blueprint.json', '.akasha/BLUEPRINT.md', `.akasha/missions/${missionId}.md`],
            stats: {
                totalTokensSaved: blueprint.tokenMetrics.tokensSaved,
                totalTokensUsed: blueprint.tokenMetrics.structuredBlueprintTokens,
                toolsExecuted: 2,
                buildErrorsSelfHealed: 0,
            },
        },
    });

    await reportAgentAction(projectId, {
        missionId,
        agentRole: 'architect',
        stepName: 'Feature Build Pack Compiled & Queued for IDE Agent',
        thought: `Compiled ${packTitle} (${blueprint.entities.length} models, ${blueprint.apiContracts.length} APIs, ${blueprint.featureSlices.length} slices) to ${bpPath}. Waiting for your connected IDE agent (Antigravity / Cursor / Claude Code) via MCP.`,
        activeTool: 'akasha_get_feature_build_pack',
        fileCreatedOrModified: `.akasha/missions/${missionId}.md`,
        type: 'tool_result',
        progress: 25,
    });
}

/**
 * Strategy B: Real Server-Side Full-Stack Generation + GridFS Cloud Sync + Drift Check + Real Compiler Check
 */
async function executeRealGenerateMission(
    projectId: string,
    missionId: string,
    options: { prompt: string; sliceId?: string; taskIds?: string[] }
) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new Error(`Project ${projectId} not found`);

    const outputDir = project.rootPath || path.join(process.cwd(), 'projects', projectId);
    const providerHealth = getLLMProvider().getHealth();

    // Step 1: Compile Single-Source-of-Truth Blueprint
    await reportAgentAction(projectId, {
        missionId,
        agentRole: 'architect',
        stepName: 'Compiling Living Project Blueprint',
        thought: `Compiling Data Models, REST contracts, Feature Slices, and Decisions (${providerHealth.mode === 'live' ? `Live AI: ${providerHealth.provider}` : 'Deterministic Offline Playbook Engine'}).`,
        activeTool: 'compileProjectBlueprint',
        progress: 15,
    });

    const blueprint = await compileProjectBlueprint(projectId);
    await persistBlueprintToFile(outputDir, blueprint);

    await prisma.agentMission.update({
        where: { id: missionId },
        data: {
            stats: {
                totalTokensSaved: blueprint.tokenMetrics.tokensSaved,
                totalTokensUsed: blueprint.tokenMetrics.structuredBlueprintTokens,
                toolsExecuted: 1,
                buildErrorsSelfHealed: 0,
            },
        },
    });

    // Step 2: Generate Real Full-Stack Express + MongoDB + React + Tailwind Files
    await reportAgentAction(projectId, {
        missionId,
        agentRole: 'backend',
        stepName: 'Synthesizing Express 5 Routes, Models & Seed Script',
        thought: `Generating typed Express routes and MongoDB collections for ${blueprint.entities.length} entities and ${blueprint.apiContracts.length} APIs into ${outputDir}.`,
        activeTool: 'GeneratorService.generateFullStack',
        toolArgsSnippet: `outputDir: ${outputDir}`,
        progress: 40,
    });

    const generator = new GeneratorService();
    const genResult = await generator.generateFullStack(projectId, outputDir);

    const serverFiles = genResult.files.filter(f => f.startsWith('server/'));
    const clientFiles = genResult.files.filter(f => f.startsWith('client/'));

    await reportAgentAction(projectId, {
        missionId,
        agentRole: 'frontend',
        stepName: `Synthesized ${clientFiles.length} React Views & Typed API Client`,
        thought: `Generated ${clientFiles.length} client files and ${serverFiles.length} server files directly wired to your project schema.`,
        activeTool: 'write_full_stack_files',
        fileCreatedOrModified: clientFiles[0] || 'client/src/App.tsx',
        type: 'file_change',
        progress: 65,
    });

    // Step 3: Real Cloud Persistence to MongoDB GridFS
    await reportAgentAction(projectId, {
        missionId,
        agentRole: 'qa_verifier',
        stepName: 'Syncing Generated Codebase to MongoDB GridFS',
        thought: `Uploading all ${genResult.fileCount} generated files to MongoDB GridFS for versioned team access.`,
        activeTool: 'storageService.syncProjectToCloud',
        progress: 80,
    });

    await storageService.syncProjectToCloud(projectId);

    // Step 4: Real Blueprint-vs-Code Drift Verification & Optional Local tsc Check
    const drift = await runProjectDriftCheck({ projectId, workspaceDir: outputDir });

    let tscSummary = 'Static Blueprint-vs-Code drift check passed';
    const hasServerNodeModules = await fs.pathExists(path.join(outputDir, 'server', 'node_modules'));
    if (hasServerNodeModules) {
        try {
            await execFileAsync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['tsc', '--noEmit'], {
                cwd: path.join(outputDir, 'server'),
                timeout: 45000,
            });
            tscSummary = 'Real TypeScript check (`tsc --noEmit`) passed with exit code 0';
        } catch (tscErr: any) {
            const stderr = String(tscErr?.stdout || tscErr?.stderr || tscErr?.message || '').slice(0, 300);
            tscSummary = `TypeScript reported diagnostics: ${stderr}`;
        }
    } else {
        tscSummary = `Generated ${genResult.fileCount} files (run \`npm install && npm run build\` in exported folder to compile dependencies). Drift health: ${drift.healthScore}%.`;
    }

    await reportAgentAction(projectId, {
        missionId,
        agentRole: 'qa_verifier',
        stepName: 'Drift & Integrity Verification Complete',
        thought: tscSummary,
        activeTool: 'runProjectDriftCheck',
        type: 'build_check',
        progress: 92,
    });

    // Update target tasks if specified
    if (options.taskIds && options.taskIds.length > 0) {
        await syncTasksOnCompletion(projectId, options.taskIds);
    }

    await prisma.agentMission.update({
        where: { id: missionId },
        data: {
            status: 'completed',
            progress: 100,
            completedAt: new Date().toISOString(),
            outputPath: outputDir,
            filesChanged: genResult.files,
        },
    });

    await reportAgentAction(projectId, {
        missionId,
        agentRole: 'architect',
        stepName: 'Full-Stack Export & Cloud Sync Complete',
        thought: `Completed real full-stack generation: ${genResult.fileCount} files written to ${outputDir} and persisted to MongoDB GridFS (Drift Health: ${drift.healthScore}%).`,
        type: 'success',
        progress: 100,
    });
}

async function syncTasksOnCompletion(projectId: string, targetTaskIds: string[]) {
    try {
        const project = await prisma.project.findUnique({ where: { id: projectId } });
        if (!project) return;
        const settings = safeJsonParse<Record<string, any>>(project.settings, {});
        const teamTasks: any[] = Array.isArray(settings.teamTasks) ? settings.teamTasks : [];
        let updated = false;
        for (const task of teamTasks) {
            if (targetTaskIds.includes(task.id) && task.status !== 'done') {
                task.status = 'done';
                task.completedAt = new Date().toISOString();
                updated = true;
            }
        }
        if (updated) {
            settings.teamTasks = teamTasks;
            await prisma.project.update({
                where: { id: projectId },
                data: { settings: JSON.stringify(settings) },
            });
        }
    } catch (e) {
        console.warn('[syncTasksOnCompletion] failed:', e);
    }
}
