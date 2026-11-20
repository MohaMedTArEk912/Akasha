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

export interface TelemetryLog {
    id: string;
    timestamp: string;
    createdAt?: string;
    agentRole: AgentRole;
    agentName: string;
    stepName: string;
    thought: string;
    activeTool?: string;
    toolArgsSnippet?: string;
    fileCreatedOrModified?: string;
    type: 'thought' | 'tool_call' | 'tool_result' | 'file_change' | 'build_check' | 'success' | 'error';
    progress: number;
    source?: 'server' | 'mcp_stdio' | 'mcp_http';
}

export interface SquadConfiguration {
    projectId: string;
    executionMode: ExecutionMode;
    dispatchStrategy?: DispatchStrategy;
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
    dispatchStrategy?: DispatchStrategy;
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

export interface TokenMetrics {
    baselineExplorationTokens: number;
    structuredBlueprintTokens: number;
    tokensSaved: number;
    savingsPercent: number;
    measurementSource?: 'measured' | 'estimated';
}

export interface CompiledProjectBlueprint {
    projectId: string;
    projectName: string;
    projectDescription: string;
    archetype?: string;
    compiledAt: string;
    version: string;
    architectureOverview: {
        frontend: string;
        backend: string;
        database: string;
        storage: string;
    };
    entities: Array<{
        id?: string;
        name: string;
        description?: string;
        fields: Array<{ name: string; type: string; required?: boolean; isId?: boolean }>;
        relations?: any[];
    }>;
    apiContracts: Array<{
        id?: string;
        method: string;
        path: string;
        summary?: string;
        description?: string;
    }>;
    pages: Array<{
        id: string;
        name: string;
        path: string;
        pageType?: string;
        componentCount: number;
    }>;
    useCases: Array<{
        title: string;
        actor: string;
        scenario: string;
    }>;
    featureSlices?: Array<{
        id: string;
        title: string;
        summary: string;
        lane: 'mvp' | 'v1_1' | 'later';
        status: string;
        owner?: string;
        linkedModels: string[];
        linkedApis: string[];
        linkedPages: string[];
    }>;
    decisions?: Array<{
        id: string;
        title: string;
        decision: string;
        author?: string;
    }>;
    tasks: Array<{
        id: string;
        title: string;
        priority: string;
        status: string;
        assigneeRole: string;
        claimedBy?: string;
    }>;
    tokenMetrics: TokenMetrics;
    agentDirectives: {
        rules: string[];
        codingStandards: string[];
    };
    markdownSystemPrompt: string;
}
