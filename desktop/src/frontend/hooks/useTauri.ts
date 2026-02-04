/**
 * API Client - HTTP API for the Grapes backend
 * 
 * This replaces the Tauri IPC layer for web deployment.
 * When running as a desktop app (Tauri), this can be swapped for the IPC bridge.
 */

// ===== Types =====

export interface ProjectSchema {
    version: string;
    id: string;
    name: string;
    description?: string;
    created_at: string;
    updated_at: string;
    blocks: BlockSchema[];
    pages: PageSchema[];
    apis: ApiSchema[];
    logic_flows: LogicFlowSchema[];
    data_models: DataModelSchema[];
    variables: VariableSchema[];
    settings: ProjectSettings;
}

export interface BlockSchema {
    id: string;
    block_type: string;
    name: string;
    parent_id?: string;
    page_id?: string;
    slot?: string;
    order: number;
    properties: Record<string, unknown>;
    styles: Record<string, StyleValue>;
    bindings: Record<string, DataBinding>;
    event_handlers: EventHandler[];
    archived: boolean;
}

export interface StyleValue {
    default?: string;
    sm?: string;
    md?: string;
    lg?: string;
    xl?: string;
}

export interface DataBinding {
    type: string;
    value: unknown;
}

export interface EventHandler {
    event: string;
    logic_flow_id: string;
}

export interface PageSchema {
    id: string;
    name: string;
    path: string;
    meta?: PageMeta;
    is_dynamic: boolean;
    dynamic_param?: string;
    layout_id?: string;
    archived: boolean;
}

export interface PageMeta {
    title?: string;
    description?: string;
    og_image?: string;
}

export interface ApiSchema {
    id: string;
    method: string;
    path: string;
    name: string;
    description?: string;
    logic_flow_id?: string;
    permissions: string[];
    archived: boolean;
}

export interface LogicFlowSchema {
    id: string;
    name: string;
    description?: string;
    trigger: TriggerType;
    nodes: LogicNode[];
    entry_node_id?: string;
    context: string;
    archived: boolean;
}

export interface TriggerType {
    type: string;
    component_id?: string;
    event?: string;
    api_id?: string;
}

export interface LogicNode {
    id: string;
    node_type: string;
    data: unknown;
    label?: string;
    next_nodes: string[];
    else_nodes: string[];
    position: { x: number; y: number };
}

export interface DataModelSchema {
    id: string;
    name: string;
    fields: FieldSchema[];
    relations: RelationSchema[];
    timestamps: boolean;
    soft_delete: boolean;
    archived: boolean;
}

export interface FieldSchema {
    name: string;
    field_type: string;
    required: boolean;
    unique: boolean;
    default?: string;
}

export interface RelationSchema {
    name: string;
    target_model: string;
    relation_type: string;
}

export interface VariableSchema {
    id: string;
    name: string;
    variable_type: string;
    scope: string;
    default_value?: unknown;
    archived: boolean;
}

export interface ProjectSettings {
    default_locale: string;
    locales: string[];
}

// ===== API Configuration =====

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// ===== API Client =====

async function apiCall<T>(
    method: string,
    endpoint: string,
    body?: unknown
): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;

    const options: RequestInit = {
        method,
        headers: {
            'Content-Type': 'application/json',
        },
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
}

// ===== API Functions =====

/**
 * API client hook - compatible interface with useTauri
 */
export function useApi() {
    return {
        // Project operations
        getProject: () => apiCall<ProjectSchema | null>('GET', '/api/project'),

        createProject: (name: string) =>
            apiCall<ProjectSchema>('POST', '/api/project', { name }),

        importProjectJson: (json: string) =>
            apiCall<ProjectSchema>('POST', '/api/project/import', { json }),

        exportProjectJson: () =>
            apiCall<string>('GET', '/api/project/export'),

        // Block operations
        addBlock: (blockType: string, name: string, parentId?: string) =>
            apiCall<BlockSchema>('POST', '/api/blocks', {
                block_type: blockType,
                name,
                parent_id: parentId,
            }),

        updateBlockProperty: (blockId: string, property: string, value: unknown) =>
            apiCall<BlockSchema>('PUT', `/api/blocks/${blockId}`, { property, value }),

        updateBlockStyle: (blockId: string, style: string, value: string) =>
            apiCall<BlockSchema>('PUT', `/api/blocks/${blockId}`, {
                property: `style.${style}`,
                value,
            }),

        archiveBlock: (blockId: string) =>
            apiCall<boolean>('DELETE', `/api/blocks/${blockId}`),

        // Page operations
        addPage: (name: string, path: string) =>
            apiCall<PageSchema>('POST', '/api/pages', { name, path }),

        // Data model operations
        addDataModel: (name: string) =>
            apiCall<DataModelSchema>('POST', '/api/models', { name }),

        // API endpoint operations
        addApi: (method: string, path: string, name: string) =>
            apiCall<ApiSchema>('POST', '/api/endpoints', { method, path, name }),

        // Code generation
        generateFrontend: () =>
            apiCall<{ files: { path: string; content: string }[] }>('POST', '/api/generate/frontend'),

        generateBackend: () =>
            apiCall<{ files: { path: string; content: string }[] }>('POST', '/api/generate/backend'),

        generateDatabase: () =>
            apiCall<{ files: { path: string; content: string }[] }>('POST', '/api/generate/database'),

        downloadZip: async () => {
            const response = await fetch(`${API_BASE_URL}/api/generate/zip`, {
                method: 'GET',
            });
            if (!response.ok) throw new Error("Failed to generate ZIP");
            return response.blob();
        }
    };
}

// Default export for backwards compatibility
export default useApi;
