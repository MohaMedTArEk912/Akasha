/**
 * API Client - HTTP API for the Grapes backend
 * 
 * This replaces the Tauri IPC layer for web deployment.
 * When running as a desktop app (Tauri), this can be swapped for the IPC bridge.
 */

import { invoke } from '@tauri-apps/api/core';

// Helper to detect Tauri environment
const isTauri = () => "isTauri" in window || !!(window as any).__TAURI_INTERNALS__;

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
    root_path?: string;
}

export interface InstallStep {
    target: string;
    success: boolean;
    timed_out: boolean;
    duration_ms: number;
    stdout: string;
    stderr: string;
    status: string;
}

export interface InstallResult {
    success: boolean;
    steps: InstallStep[];
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
    styles: Record<string, string | number | boolean>;
    responsive_styles: Record<string, Record<string, string | number | boolean>>;
    bindings: Record<string, DataBinding>;
    event_handlers: EventHandler[];
    archived: boolean;
}

export type StyleValue = string | number | boolean;

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
    primary_key: boolean;
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

export interface FileEntry {
    name: string;
    path: string;
    is_directory: boolean;
    size?: number;
    extension?: string;
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
        // Workspace operations
        getWorkspaceStatus: () => apiCall<{ workspace_path: string | null; projects: ProjectSchema[] }>('GET', '/api/workspace'),

        setWorkspacePath: (path: string) => apiCall<boolean>('POST', '/api/workspace', { path }),

        pickFolder: () => apiCall<string | null>('GET', '/api/workspace/pick-folder'),

        loadProjectById: (id: string) => apiCall<ProjectSchema>('GET', `/api/workspace/projects/${id}`),

        deleteProjectById: (id: string) => apiCall<boolean>('DELETE', `/api/workspace/projects/${id}`),

        // Project operations
        getProject: async () => {
            if (isTauri()) return await invoke<ProjectSchema | null>('get_project');
            return apiCall<ProjectSchema | null>('GET', '/api/project');
        },

        createProject: (name: string) =>
            apiCall<ProjectSchema>('POST', '/api/project', { name }),

        renameProject: (name: string) =>
            apiCall<ProjectSchema>('PATCH', '/api/project', { name }),

        resetProject: () =>
            apiCall<ProjectSchema>('POST', '/api/project/reset'),

        importProjectJson: (json: string) =>
            apiCall<ProjectSchema>('POST', '/api/project/import', { json }),

        exportProjectJson: () =>
            apiCall<string>('GET', '/api/project/export'),

        setProjectRoot: (path: string) =>
            apiCall<boolean>('POST', '/api/project/sync/root', { path }),

        syncToDisk: async () => {
            if (isTauri()) return await invoke('sync_to_disk');
            return apiCall<boolean>('POST', '/api/project/sync/now');
        },

        syncDiskToProject: async () => {
            if (isTauri()) return await invoke('sync_disk_to_project');
            return apiCall<boolean>('POST', '/api/project/sync/from_disk');
        },

        // Block operations
        addBlock: (blockType: string, name: string, parentId?: string, pageId?: string) =>
            apiCall<BlockSchema>('POST', '/api/blocks', {
                block_type: blockType,
                name,
                parent_id: parentId,
                page_id: pageId,
            }),

        updateBlockProperty: (blockId: string, property: string, value: unknown) =>
            apiCall<BlockSchema>('PUT', `/api/blocks/${blockId}`, { property, value }),

        updateBlockStyle: (blockId: string, style: string, value: string) =>
            apiCall<BlockSchema>('PUT', `/api/blocks/${blockId}`, {
                property: `styles.${style}`,
                value,
            }),

        archiveBlock: (blockId: string) =>
            apiCall<boolean>('DELETE', `/api/blocks/${blockId}`),

        // Page operations
        addPage: (name: string, path: string) =>
            apiCall<PageSchema>('POST', '/api/pages', { name, path }),

        getPageContent: (id: string) =>
            apiCall<{ content: string }>('GET', `/api/pages/${id}/content`),

        // Logic flow operations
        getLogicFlows: () =>
            apiCall<LogicFlowSchema[]>('GET', '/api/logic'),

        createLogicFlow: (name: string, context: 'frontend' | 'backend') =>
            apiCall<LogicFlowSchema>('POST', '/api/logic', { name, context }),

        deleteLogicFlow: (id: string) =>
            apiCall<boolean>('DELETE', `/api/logic/${id}`),

        // Data model operations
        addDataModel: (name: string) =>
            apiCall<DataModelSchema>('POST', '/api/models', { name }),

        addFieldToModel: (modelId: string, name: string, fieldType: string, required: boolean) =>
            apiCall<DataModelSchema>('POST', `/api/models/${modelId}/fields`, {
                name,
                field_type: fieldType,
                required,
            }),

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
        },

        // File system operations
        listDirectory: (path?: string) =>
            apiCall<{ path: string; entries: FileEntry[] }>('GET', `/api/files${path ? `?path=${encodeURIComponent(path)}` : ''}`),

        createFile: (path: string, content?: string) =>
            apiCall<FileEntry>('POST', '/api/files', { path, content }),

        createFolder: (path: string) =>
            apiCall<FileEntry>('POST', '/api/files/folder', { path }),

        renameFile: (oldPath: string, newPath: string) =>
            apiCall<FileEntry>('PUT', '/api/files/rename', { old_path: oldPath, new_path: newPath }),

        deleteFile: (path: string) =>
            apiCall<boolean>('DELETE', '/api/files/delete', { path }),

        readFileContent: (path: string) =>
            apiCall<{ content: string; path: string }>('GET', `/api/files/content?path=${encodeURIComponent(path)}`),

        installDependencies: async () => {
            return apiCall<InstallResult>('POST', '/api/project/install');
        },
    };
}

// Default export for backwards compatibility
export default useApi;
