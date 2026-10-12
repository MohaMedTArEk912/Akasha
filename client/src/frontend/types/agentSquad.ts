export type AgentRole = 'architect' | 'frontend' | 'backend' | 'qa_verifier';
export type ExecutionMode = 'series' | 'parallel';

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

export interface TelemetryLog {
    id: string;
    timestamp: string;
    agentRole: AgentRole;
    agentName: string;
    stepName: string;
    thought: string;
    activeTool?: string;
    toolArgsSnippet?: string;
    fileCreatedOrModified?: string;
    type: 'thought' | 'tool_call' | 'tool_result' | 'file_change' | 'build_check' | 'success' | 'error';
    progress: number;
}

export interface SquadConfiguration {
    projectId: string;
    executionMode: ExecutionMode;
    members: SquadMember[];
    autoSelfHealBuild: boolean;
    syncToGridFS: boolean;
    updatedAt: string;
}

export interface ActiveSquadMission {
    id: string;
    projectId: string;
    prompt: string;
    executionMode: ExecutionMode;
    status: 'idle' | 'running' | 'completed' | 'failed';
    progress: number;
    startedAt: string;
    completedAt?: string;
    logs: TelemetryLog[];
    filesChanged: string[];
    stats: {
        totalTokensSaved: number;
        totalTokensUsed: number;
        toolsExecuted: number;
        buildErrorsSelfHealed: number;
    };
    error?: string;
}

export interface TokenMetrics {
    baselineExplorationTokens: number;
    structuredBlueprintTokens: number;
    tokensSaved: number;
    savingsPercent: number;
}

export interface CompiledProjectBlueprint {
    projectId: string;
    projectName: string;
    projectDescription: string;
    compiledAt: string;
    version: string;
    architectureOverview: {
        frontend: string;
        backend: string;
        database: string;
        storage: string;
    };
    entities: Array<{
        name: string;
        description?: string;
        fields: Array<{ name: string; type: string; required?: boolean; isId?: boolean }>;
        relations?: any[];
    }>;
    apiContracts: Array<{
        method: string;
        path: string;
        summary?: string;
        description?: string;
    }>;
    pages: Array<{
        id: string;
        name: string;
        path: string;
        componentCount: number;
    }>;
    useCases: Array<{
        title: string;
        actor: string;
        scenario: string;
    }>;
    tasks: Array<{
        id: string;
        title: string;
        priority: string;
        status: string;
        assigneeRole: string;
    }>;
    tokenMetrics: TokenMetrics;
    agentDirectives: {
        rules: string[];
        codingStandards: string[];
    };
    markdownSystemPrompt: string;
}
