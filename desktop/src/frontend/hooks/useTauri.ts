/**
 * API Client — Tauri IPC bridge
 *
 * Every method calls a `#[tauri::command]` in the Rust backend via `invoke`.
 * No HTTP requests are made.
 */

import { invoke } from '@tauri-apps/api/core';

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
    components: BlockSchema[];
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
    component_id?: string;
    children?: string[];
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
    root_block_id?: string;
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
    request_body?: DataShape;
    response_body?: DataShape;
    query_params?: ParamSchema[];
    path_params?: ParamSchema[];
    logic_flow_id?: string;
    permissions: string[];
    archived: boolean;
}

export interface DataShape {
    shape_type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'model';
    fields?: ShapeField[];
    item_shape?: DataShape;
    model_ref?: string;
}

export interface ShapeField {
    name: string;
    field_type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'model';
    required: boolean;
    nested?: DataShape;
}

export interface ParamSchema {
    name: string;
    param_type: string;
    required: boolean;
    default?: string;
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
    type: 'event' | 'api' | 'mount' | 'schedule' | 'manual';
    component_id?: string;
    event?: string;
    api_id?: string;
    cron?: string;
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
    id: string;
    name: string;
    field_type: string;
    required: boolean;
    unique: boolean;
    primary_key: boolean;
    default?: string;
    description?: string;
}

export interface RelationSchema {
    id: string;
    name: string;
    target_model_id: string;
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
    theme?: {
        primary_color?: string;
        secondary_color?: string;
        font_family?: string;
        border_radius?: number;
    };
    build?: {
        frontend_framework?: string;
        backend_framework?: string;
        database_provider?: string;
        typescript?: boolean;
    };
    seo?: {
        title_suffix?: string;
        default_description?: string;
        default_og_image?: string;
        favicon?: string;
    };
}

export interface FileEntry {
    name: string;
    path: string;
    is_directory: boolean;
    size?: number;
    extension?: string;
}

export interface GitCommitInfo {
    id: string;
    message: string;
    author: string;
    timestamp: number;
    summary: string;
}

export interface GitFileStatus {
    path: string;
    status: string; // "M", "A", "D", "R", etc.
}

export interface GitStatus {
    is_repo: boolean;
    changed_files: GitFileStatus[];
    total_commits: number;
}

export interface DiagramEntry {
    name: string;
    path: string;
    last_modified?: number;
}

// ===== API Functions (all via Tauri IPC) =====

/**
 * API client hook — every call is a Tauri `invoke`.
 */
export function useApi() {
    return {
        // ─── Workspace ──────────────────────────────────
        getWorkspaceStatus: () =>
            invoke<{ workspace_path: string | null; projects: ProjectSchema[] }>('ipc_get_workspace'),

        setWorkspacePath: (path: string) =>
            invoke<boolean>('ipc_set_workspace', { path }),

        pickFolder: () =>
            invoke<string | null>('ipc_pick_folder'),

        loadProjectById: (id: string) =>
            invoke<ProjectSchema>('ipc_load_project_by_id', { id }),

        deleteProjectById: (id: string, deleteFromDisk?: boolean) =>
            invoke<boolean>('ipc_delete_project', { id, deleteFromDisk }),

        // ─── Project ────────────────────────────────────
        getProject: () =>
            invoke<ProjectSchema | null>('ipc_get_project'),

        createProject: (name: string) =>
            invoke<ProjectSchema>('ipc_create_project', { name }),

        renameProject: (name: string) =>
            invoke<ProjectSchema>('ipc_rename_project', { name }),

        updateSettings: (settings: Partial<ProjectSettings>) =>
            invoke<ProjectSchema>('ipc_update_settings', { settings }),

        resetProject: (clearDiskFiles?: boolean) =>
            invoke<ProjectSchema>('ipc_reset_project', { clearDiskFiles }),

        importProjectJson: (json: string) =>
            invoke<ProjectSchema>('ipc_import_project', { jsonStr: json }),

        exportProjectJson: () =>
            invoke<string>('ipc_export_project'),

        setProjectRoot: (path: string) =>
            invoke<boolean>('ipc_set_sync_root', { path }),

        syncToDisk: () =>
            invoke<boolean>('ipc_trigger_sync'),

        syncDiskToProject: () =>
            invoke<boolean>('ipc_sync_from_disk'),

        // ─── Blocks ─────────────────────────────────────
        addBlock: (blockType: string, name: string, parentId?: string, pageId?: string, componentId?: string) =>
            invoke<BlockSchema>('ipc_add_block', {
                blockType,
                name,
                parentId,
                pageId,
                componentId,
            }),

        updateBlockProperty: (blockId: string, property: string, value: unknown) =>
            invoke<BlockSchema>('ipc_update_block', { id: blockId, property, value }),

        updateBlockStyle: (blockId: string, style: string, value: string) =>
            invoke<BlockSchema>('ipc_update_block', {
                id: blockId,
                property: `styles.${style}`,
                value,
            }),

        archiveBlock: (blockId: string) =>
            invoke<boolean>('ipc_delete_block', { id: blockId }),

        moveBlock: (blockId: string, newParentId: string | null, index: number) =>
            invoke<boolean>('ipc_move_block', {
                id: blockId,
                newParentId,
                index,
            }),

        // ─── Pages ──────────────────────────────────────
        addPage: (name: string, path: string) =>
            invoke<PageSchema>('ipc_add_page', { name, path }),

        updatePage: (id: string, name?: string, path?: string) =>
            invoke<PageSchema>('ipc_update_page', { id, name, path }),

        archivePage: (id: string) =>
            invoke<boolean>('ipc_delete_page', { id }),

        getPageContent: (id: string) =>
            invoke<{ content: string }>('ipc_get_page_content', { id }),

        // ─── Logic flows ────────────────────────────────
        getLogicFlows: () =>
            invoke<LogicFlowSchema[]>('ipc_get_logic_flows'),

        createLogicFlow: (name: string, context: 'frontend' | 'backend') =>
            invoke<LogicFlowSchema>('ipc_create_logic_flow', { name, context }),

        deleteLogicFlow: (id: string) =>
            invoke<boolean>('ipc_delete_logic_flow', { id }),

        updateLogicFlow: (id: string, updates: { name?: string; nodes?: LogicNode[]; entry_node_id?: string | null; description?: string; trigger?: TriggerType }) =>
            invoke<LogicFlowSchema>('ipc_update_logic_flow', { id, ...updates }),

        // ─── Data Models ────────────────────────────────
        getModels: () =>
            invoke<DataModelSchema[]>('ipc_get_models'),

        addDataModel: (name: string) =>
            invoke<DataModelSchema>('ipc_add_model', { name }),

        updateModel: (id: string, updates: { name?: string; description?: string }) =>
            invoke<DataModelSchema>('ipc_update_model', { modelId: id, ...updates }),

        addFieldToModel: (modelId: string, name: string, fieldType: string, required: boolean) =>
            invoke<DataModelSchema>('ipc_add_field', { modelId, name, fieldType, required }),

        updateField: (modelId: string, fieldId: string, updates: { name?: string; field_type?: string; required?: boolean; unique?: boolean; description?: string }) =>
            invoke<DataModelSchema>('ipc_update_field', { modelId, fieldId, ...updates }),

        archiveDataModel: (id: string) =>
            invoke<boolean>('ipc_delete_model', { modelId: id }),

        deleteField: (modelId: string, fieldId: string) =>
            invoke<DataModelSchema>('ipc_delete_field', { modelId, fieldId }),

        addRelation: (modelId: string, name: string, targetModelId: string, relationType: string) =>
            invoke<DataModelSchema>('ipc_add_relation', { modelId, name, targetModelId, relationType }),

        deleteRelation: (modelId: string, relationId: string) =>
            invoke<DataModelSchema>('ipc_delete_relation', { modelId, relationId }),

        // ─── API Endpoints ──────────────────────────────
        getEndpoints: () =>
            invoke<ApiSchema[]>('ipc_get_endpoints'),

        addApi: (method: string, path: string, name: string) =>
            invoke<ApiSchema>('ipc_add_endpoint', { method, path, name }),

        updateEndpoint: (id: string, updates: {
            method?: string;
            path?: string;
            name?: string;
            description?: string;
            auth_required?: boolean;
            request_body?: DataShape | null;
            response_body?: DataShape | null;
            permissions?: string[];
            logic_flow_id?: string | null;
        }) =>
            invoke<ApiSchema>('ipc_update_endpoint', { id, ...updates }),

        archiveApi: (id: string) =>
            invoke<boolean>('ipc_delete_endpoint', { id }),

        // ─── Variables ──────────────────────────────────
        getVariables: () =>
            invoke<VariableSchema[]>('ipc_get_variables'),

        createVariable: (data: { name: string; var_type: string; default_value?: unknown; scope?: string; page_id?: string; description?: string; persist?: boolean }) =>
            invoke<VariableSchema>('ipc_create_variable', data),

        updateVariable: (id: string, updates: { name?: string; var_type?: string; default_value?: unknown; scope?: string; page_id?: string; description?: string; persist?: boolean }) =>
            invoke<VariableSchema>('ipc_update_variable', { id, ...updates }),

        deleteVariable: (id: string) =>
            invoke<boolean>('ipc_delete_variable', { id }),

        // ─── Code Generation ────────────────────────────
        generateFrontend: () =>
            invoke<{ files: { path: string; content: string }[] }>('ipc_generate_frontend'),

        generateBackend: () =>
            invoke<{ files: { path: string; content: string }[] }>('ipc_generate_backend'),

        generateDatabase: () =>
            invoke<{ files: { path: string; content: string }[] }>('ipc_generate_database'),

        downloadZip: async () => {
            // ZIP is returned as byte array from IPC; convert to Blob on the frontend.
            const bytes = await invoke<number[]>('ipc_generate_zip');
            return new Blob([new Uint8Array(bytes)], { type: 'application/zip' });
        },

        // ─── File System ────────────────────────────────
        listDirectory: (path?: string) =>
            invoke<{ path: string; entries: FileEntry[] }>('ipc_list_directory', { path }),

        createFile: (path: string, content?: string) =>
            invoke<FileEntry>('ipc_create_file', { path, content }),

        createFolder: (path: string) =>
            invoke<FileEntry>('ipc_create_folder', { path }),

        renameFile: (oldPath: string, newPath: string) =>
            invoke<FileEntry>('ipc_rename_file', { oldPath, newPath }),

        deleteFile: (path: string) =>
            invoke<boolean>('ipc_delete_file', { path }),

        readFileContent: (path: string) =>
            invoke<{ content: string; path: string }>('ipc_read_file_content', { path }),

        writeFileContent: (path: string, content: string) =>
            invoke<{ content: string; path: string }>('ipc_write_file_content', { path, content }),

        installDependencies: () =>
            invoke<InstallResult>('ipc_install_dependencies'),

        // ─── Components ─────────────────────────────────
        getComponents: () => invoke<BlockSchema[]>('ipc_list_components'),

        createComponent: (name: string, description?: string) =>
            invoke<BlockSchema>('ipc_create_component', { name, description }),

        getComponent: (id: string) => invoke<BlockSchema>('ipc_get_component', { id }),

        // ─── Git Version Control ────────────────────────
        gitHistory: (limit?: number) =>
            invoke<GitCommitInfo[]>('ipc_git_history', { limit }),

        gitRestore: (commitId: string) =>
            invoke<GitCommitInfo>('ipc_git_restore', { commitId }),

        gitDiff: (commitId: string) =>
            invoke<string>('ipc_git_diff', { commitId }),

        gitDiscard: (filePath: string) =>
            invoke<void>('ipc_git_discard_changes', { filePath }),

        gitCommit: (message: string) =>
            invoke<GitCommitInfo | null>('ipc_git_commit', { message }),

        initGitRepo: () =>
            invoke<boolean>('ipc_git_init'),

        gitStatus: () =>
            invoke<GitStatus>('ipc_git_status'),

        gitGetFileContent: (filePath: string, revision: string) =>
            invoke<string>("ipc_git_get_file_content", { filePath, revision }),

        // ─── Diagrams ───────────────────────────────────
        listDiagrams: () =>
            invoke<DiagramEntry[]>('ipc_list_diagrams'),

        createDiagram: (name: string) =>
            invoke<DiagramEntry>('ipc_create_diagram', { name }),

        readDiagram: (name: string) =>
            invoke<string>('ipc_read_diagram', { name }),

        saveDiagram: (name: string, content: string) =>
            invoke<boolean>('ipc_save_diagram', { name, content }),

        deleteDiagram: (name: string) =>
            invoke<boolean>('ipc_delete_diagram', { name }),
    };
}

// Default export for backwards compatibility
export default useApi;
