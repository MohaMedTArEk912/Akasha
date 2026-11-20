/**
 * Persistent Telemetry Bus & Real-Time SSE Bridge
 *
 * Fixes the stdio <-> HTTP split-brain problem:
 * 1. Every telemetry log & mission state transition is persisted to MongoDB (`AgentTelemetry` & `AgentMission`).
 * 2. Local HTTP callers emit immediately via an EventEmitter for zero-latency delivery.
 * 3. External stdio MCP processes write directly to MongoDB; the SSE handler tails `AgentTelemetry`
 *    every 1s for cross-process inserts so live thoughts/tool calls from Antigravity, Cursor, or
 *    Claude Code stream into every team member's browser automatically.
 */

import { EventEmitter } from 'node:events';
import type { Response } from 'express';
import prisma from '../lib/prisma.js';
import { randomUUID } from 'node:crypto';

export type TelemetryEventType =
    | 'thought'
    | 'tool_call'
    | 'tool_result'
    | 'file_change'
    | 'build_check'
    | 'success'
    | 'error';

export interface PersistedTelemetryLog {
    id: string;
    projectId: string;
    missionId?: string;
    timestamp: string;
    createdAt: string;
    agentRole: 'architect' | 'frontend' | 'backend' | 'qa_verifier';
    agentName: string;
    stepName: string;
    thought: string;
    activeTool?: string;
    toolArgsSnippet?: string;
    fileCreatedOrModified?: string;
    type: TelemetryEventType;
    progress: number;
    tokensUsedDelta?: number;
    source?: 'server' | 'mcp_stdio' | 'mcp_http';
}

const bus = new EventEmitter();
bus.setMaxListeners(100);

export async function publishTelemetryEvent(input: {
    projectId: string;
    missionId?: string;
    agentRole: 'architect' | 'frontend' | 'backend' | 'qa_verifier';
    agentName: string;
    stepName: string;
    thought: string;
    activeTool?: string;
    toolArgsSnippet?: string;
    fileCreatedOrModified?: string;
    type?: TelemetryEventType;
    progress?: number;
    tokensUsedDelta?: number;
    source?: 'server' | 'mcp_stdio' | 'mcp_http';
}): Promise<PersistedTelemetryLog> {
    const now = new Date();
    const logId = `tel-${Date.now()}-${randomUUID().slice(0, 6)}`;
    const entry: PersistedTelemetryLog = {
        id: logId,
        projectId: input.projectId,
        missionId: input.missionId,
        timestamp: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        createdAt: now.toISOString(),
        agentRole: input.agentRole,
        agentName: input.agentName,
        stepName: input.stepName,
        thought: input.thought,
        activeTool: input.activeTool,
        toolArgsSnippet: input.toolArgsSnippet,
        fileCreatedOrModified: input.fileCreatedOrModified,
        type: input.type || (input.activeTool ? 'tool_call' : 'thought'),
        progress: typeof input.progress === 'number' ? Math.min(100, Math.max(0, input.progress)) : 0,
        tokensUsedDelta: input.tokensUsedDelta || 0,
        source: input.source || 'server',
    };

    try {
        await prisma.agentTelemetry.create({
            data: {
                id: logId,
                projectId: entry.projectId,
                missionId: entry.missionId || null,
                timestamp: entry.timestamp,
                agentRole: entry.agentRole,
                agentName: entry.agentName,
                stepName: entry.stepName,
                thought: entry.thought,
                activeTool: entry.activeTool || null,
                toolArgsSnippet: entry.toolArgsSnippet || null,
                fileCreatedOrModified: entry.fileCreatedOrModified || null,
                type: entry.type,
                progress: entry.progress,
                tokensUsedDelta: entry.tokensUsedDelta || 0,
                source: entry.source,
                createdAt: now,
            },
        });
    } catch (err) {
        console.warn('[telemetryBus] Failed to persist telemetry log to MongoDB:', err);
    }

    bus.emit(`telemetry:${input.projectId}`, entry);
    return entry;
}

export async function getRecentTelemetry(projectId: string, limit = 80): Promise<PersistedTelemetryLog[]> {
    try {
        const rows = await prisma.agentTelemetry.findMany({
            where: { projectId },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
        return (rows || []).map((r: any) => ({
            id: r.id,
            projectId: r.projectId,
            missionId: r.missionId || undefined,
            timestamp: r.timestamp || '',
            createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt || ''),
            agentRole: r.agentRole || 'architect',
            agentName: r.agentName || 'Agent',
            stepName: r.stepName || '',
            thought: r.thought || '',
            activeTool: r.activeTool || undefined,
            toolArgsSnippet: r.toolArgsSnippet || undefined,
            fileCreatedOrModified: r.fileCreatedOrModified || undefined,
            type: r.type || 'thought',
            progress: Number(r.progress || 0),
            tokensUsedDelta: Number(r.tokensUsedDelta || 0),
            source: r.source || 'server',
        }));
    } catch {
        return [];
    }
}

export function emitMissionUpdate(projectId: string, mission: unknown) {
    bus.emit(`mission:${projectId}`, mission);
}

/**
 * Attaches an Express Response to a Server-Sent Events (SSE) stream for a project.
 * Bridges both in-process events AND cross-process MongoDB inserts (e.g., stdio MCP calls).
 */
export function attachProjectSseStream(projectId: string, res: Response, getSnapshot: () => Promise<unknown>) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const seenIds = new Set<string>();
    let lastCheckedAt = new Date(Date.now() - 2000);
    let closed = false;

    const writeEvent = (event: string, data: unknown) => {
        if (closed || res.writableEnded) return;
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Send initial snapshot
    void getSnapshot().then((snap) => {
        writeEvent('snapshot', snap);
    }).catch(() => null);

    const onTelemetry = (entry: PersistedTelemetryLog) => {
        seenIds.add(entry.id);
        writeEvent('telemetry', entry);
    };

    const onMission = (mission: unknown) => {
        writeEvent('mission', mission);
    };

    bus.on(`telemetry:${projectId}`, onTelemetry);
    bus.on(`mission:${projectId}`, onMission);

    // Cross-process MongoDB tailing (picks up events written by external stdio MCP servers!)
    const tailInterval = setInterval(async () => {
        if (closed) return;
        try {
            const newRows = await prisma.agentTelemetry.findMany({
                where: {
                    projectId,
                    createdAt: { gt: lastCheckedAt },
                },
                orderBy: { createdAt: 'asc' },
                take: 30,
            });
            for (const r of newRows || []) {
                const ts = r.createdAt instanceof Date ? r.createdAt : new Date(r.createdAt);
                if (ts > lastCheckedAt) lastCheckedAt = ts;
                if (seenIds.has(r.id)) continue;
                seenIds.add(r.id);
                writeEvent('telemetry', {
                    id: r.id,
                    projectId: r.projectId,
                    missionId: r.missionId || undefined,
                    timestamp: r.timestamp,
                    createdAt: ts.toISOString(),
                    agentRole: r.agentRole,
                    agentName: r.agentName,
                    stepName: r.stepName,
                    thought: r.thought,
                    activeTool: r.activeTool || undefined,
                    toolArgsSnippet: r.toolArgsSnippet || undefined,
                    fileCreatedOrModified: r.fileCreatedOrModified || undefined,
                    type: r.type,
                    progress: Number(r.progress || 0),
                    source: r.source || 'mcp_stdio',
                });
            }
            if ((newRows || []).length > 0) {
                const snap = await getSnapshot();
                writeEvent('snapshot', snap);
            }
        } catch {
            // Transient DB polling error ignored
        }
    }, 1200);

    // Keep-alive ping every 20s
    const heartbeat = setInterval(() => {
        if (!closed && !res.writableEnded) {
            res.write(': ping\n\n');
        }
    }, 20000);

    const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(tailInterval);
        clearInterval(heartbeat);
        bus.off(`telemetry:${projectId}`, onTelemetry);
        bus.off(`mission:${projectId}`, onMission);
    };

    res.on('close', cleanup);
    res.on('error', cleanup);
}
