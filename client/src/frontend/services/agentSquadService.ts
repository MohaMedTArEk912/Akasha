import { client } from '../hooks/useHttpApi';
import type {
    CompiledProjectBlueprint,
    SquadConfiguration,
    ActiveSquadMission,
    ExecutionMode
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
        workspacePath
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

