import { client } from '../hooks/useHttpApi';
import type {
    CompiledProjectBlueprint,
    SquadConfiguration,
    ActiveSquadMission,
    ExecutionMode,
    DispatchStrategy,
    TelemetryLog,
} from '../types/agentSquad';

export async function fetchProjectBlueprint(projectId: string): Promise<CompiledProjectBlueprint> {
    const res = await client.get(`/agent-squad/blueprint/${projectId}`);
    return res.data.blueprint;
}

export async function syncBlueprintToWorkspace(projectId: string, workspacePath?: string): Promise<{
    filePath: string;
    tokenMetrics: any;
}> {
    const res = await client.post('/agent-squad/sync-blueprint-file', {
        projectId,
        workspacePath,
    });
    return res.data;
}

export async function fetchSquadConfig(projectId: string): Promise<SquadConfiguration> {
    const res = await client.get(`/agent-squad/config/${projectId}`);
    return res.data.config;
}

export async function updateSquadConfig(projectId: string, updates: Partial<SquadConfiguration>): Promise<SquadConfiguration> {
    const res = await client.post(`/agent-squad/config/${projectId}`, updates);
    return res.data.config;
}

export async function dispatchSquadMission(params: {
    projectId: string;
    prompt: string;
    executionMode?: ExecutionMode;
    dispatchStrategy?: DispatchStrategy;
    sliceId?: string;
    taskIds?: string[];
}): Promise<ActiveSquadMission> {
    const res = await client.post('/agent-squad/dispatch', params);
    return res.data.mission;
}

export async function fetchMissionStatus(projectId: string): Promise<{
    mission: ActiveSquadMission;
    config: SquadConfiguration;
}> {
    const res = await client.get(`/agent-squad/mission/${projectId}`);
    return res.data;
}

/**
 * Subscribe to real-time SSE telemetry & mission updates (replaces HTTP polling).
 * Receives live events from BOTH server-side generation AND external stdio MCP agents!
 */
export function subscribeMissionStream(
    projectId: string,
    handlers: {
        onSnapshot?: (data: { mission: ActiveSquadMission; config: SquadConfiguration }) => void;
        onTelemetry?: (log: TelemetryLog) => void;
        onMission?: (mission: Partial<ActiveSquadMission>) => void;
        onError?: () => void;
    }
): () => void {
    const url = `/api/akasha/agent-squad/stream/${encodeURIComponent(projectId)}`;
    const es = new EventSource(url);

    es.addEventListener('snapshot', (ev: MessageEvent) => {
        try {
            handlers.onSnapshot?.(JSON.parse(ev.data));
        } catch {}
    });

    es.addEventListener('telemetry', (ev: MessageEvent) => {
        try {
            handlers.onTelemetry?.(JSON.parse(ev.data));
        } catch {}
    });

    es.addEventListener('mission', (ev: MessageEvent) => {
        try {
            handlers.onMission?.(JSON.parse(ev.data));
        } catch {}
    });

    es.onerror = () => {
        handlers.onError?.();
    };

    return () => {
        es.close();
    };
}

export interface McpServerConfig {
    antigravity?: {
        mcpServers: Record<string, { command: string; args: string[] }>;
    };
    claudeDesktop?: {
        mcpServers: Record<string, { command: string; args: string[] }>;
    };
    httpEndpoint?: string;
    workspaceRoot?: string;
}

export async function fetchMcpConfig(): Promise<McpServerConfig> {
    const res = await client.get('/mcp/config');
    return res.data;
}
