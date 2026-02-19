import { httpApi } from './useHttpApi';
import {
    ProjectSchema, BlockSchema, PageSchema, LogicFlowSchema, DataModelSchema, VariableSchema,
    ApiSchema, GitCommitInfo, GitStatus, FileEntry, DiagramEntry, ProjectSettings, InstallResult,
    LogicNode, TriggerType, DataShape, AnalysisResult
} from '../types/api';

// For pure web build, we disable Tauri
const isTauri = false;

// Mock tauriApi object if needed for types, but unused
// Dummy invoke for compilation
const invoke = async <T>(..._args: any[]): Promise<T> => {
    throw new Error("Tauri API is not available in web mode");
};

// Mock tauriApi object if needed for types, but unused
// Mock tauriApi object if needed for types, but unused
const tauriApi: any = {
    mode: 'desktop',
    // ─── Workspace ──────────────────────────────────
    getWorkspaceStatus: () => invoke('ipc_get_workspace'),
    setWorkspacePath: (path: string) => invoke('ipc_set_workspace', { path }),
    pickFolder: () => invoke('ipc_pick_folder'),
    loadProjectById: (id: string) => invoke('ipc_load_project_by_id', { id }),
    deleteProjectById: (id: string, deleteFromDisk?: boolean) => invoke('ipc_delete_project', { id, deleteFromDisk }),

    // ─── Project ────────────────────────────────────
    getProject: () => invoke('ipc_get_project'),
    createProject: (name: string) => invoke('ipc_create_project', { name }),
    renameProject: (name: string) => invoke('ipc_rename_project', { name }),
    updateSettings: (settings: Partial<ProjectSettings>) => invoke('ipc_update_settings', { settings }),
    resetProject: (clearDiskFiles?: boolean) => invoke('ipc_reset_project', { clearDiskFiles }),
    importProjectJson: (json: string) => invoke('ipc_import_project', { jsonStr: json }),
    exportProjectJson: () => invoke('ipc_export_project'),
    setProjectRoot: (path: string) => invoke('ipc_set_sync_root', { path }),
    syncToDisk: () => invoke('ipc_trigger_sync'),
    syncDiskToProject: () => invoke('ipc_sync_from_disk'),

    // ─── Blocks ─────────────────────────────────────
    addBlock: (blockType: string, name: string, parentId?: string, pageId?: string, componentId?: string) =>
        invoke('ipc_add_block', { blockType, name, parentId, pageId, componentId }),

    // Adapted signature for compatibility
    bulkSyncPageBlocks: (_projectId: string, pageId: string, blocks: BlockSchema[]) => {
        return invoke('ipc_bulk_sync_page_blocks', { pageId, blocks });
    },

    updateBlockProperty: (blockId: string, property: string, value: unknown) =>
        invoke('ipc_update_block', { id: blockId, property, value }),
    updateBlockStyle: (blockId: string, style: string, value: string) =>
        invoke('ipc_update_block', { id: blockId, property: `styles.${style}`, value }),
    archiveBlock: (blockId: string) => invoke('ipc_delete_block', { id: blockId }),
    moveBlock: (blockId: string, newParentId: string | null, index: number) =>
        invoke('ipc_move_block', { id: blockId, newParentId, index }),

    // ─── Pages ──────────────────────────────────────
    addPage: (name: string, path: string) => invoke('ipc_add_page', { name, path }),
    updatePage: (id: string, name?: string, path?: string) => invoke('ipc_update_page', { id, name, path }),
    archivePage: (id: string) => invoke('ipc_delete_page', { id }),
    getPageContent: (id: string) => invoke('ipc_get_page_content', { id }),

    // ─── Logic flows ────────────────────────────────
    getLogicFlows: () => invoke('ipc_get_logic_flows'),
    createLogicFlow: (name: string, context: 'frontend' | 'backend') =>
        invoke('ipc_create_logic_flow', { name, context }),
    deleteLogicFlow: (id: string) => invoke('ipc_delete_logic_flow', { id }),
    updateLogicFlow: (id: string, updates: { name?: string; nodes?: LogicNode[]; entry_node_id?: string | null; description?: string; trigger?: TriggerType }) =>
        invoke('ipc_update_logic_flow', { id, ...updates }),

    // ─── Data Models ────────────────────────────────
    getModels: () => invoke('ipc_get_models'),
    addDataModel: (name: string) => invoke('ipc_add_model', { name }),
    updateModel: (id: string, updates: { name?: string; description?: string }) =>
        invoke('ipc_update_model', { modelId: id, ...updates }),
    addFieldToModel: (modelId: string, name: string, fieldType: string, required: boolean) =>
        invoke('ipc_add_field', { modelId, name, fieldType, required }),
    updateField: (modelId: string, fieldId: string, updates: { name?: string; field_type?: string; required?: boolean; unique?: boolean; description?: string }) =>
        invoke('ipc_update_field', { modelId, fieldId, ...updates }),
    archiveDataModel: (id: string) => invoke('ipc_delete_model', { modelId: id }),
    deleteField: (modelId: string, fieldId: string) => invoke('ipc_delete_field', { modelId, fieldId }),
    addRelation: (modelId: string, name: string, targetModelId: string, relationType: string) =>
        invoke('ipc_add_relation', { modelId, name, targetModelId, relationType }),
    deleteRelation: (modelId: string, relationId: string) =>
        invoke('ipc_delete_relation', { modelId, relationId }),

    // ─── API Endpoints ──────────────────────────────
    getEndpoints: () => invoke('ipc_get_endpoints'),
    addApi: (method: string, path: string, name: string) => invoke('ipc_add_endpoint', { method, path, name }),
    updateEndpoint: (id: string, updates: any) => invoke('ipc_update_endpoint', { id, ...updates }),
    archiveApi: (id: string) => invoke('ipc_delete_endpoint', { id }),

    // ─── Variables ──────────────────────────────────
    getVariables: () => invoke('ipc_get_variables'),
    createVariable: (data: any) => invoke('ipc_create_variable', data),
    updateVariable: (id: string, updates: any) => invoke('ipc_update_variable', { id, ...updates }),
    deleteVariable: (id: string) => invoke('ipc_delete_variable', { id }),

    // ─── Code Generation ────────────────────────────
    generateFrontend: () => invoke('ipc_generate_frontend'),
    generateBackend: () => invoke('ipc_generate_backend'),
    generateDatabase: () => invoke('ipc_generate_database'),
    downloadZip: async () => {
        const bytes = await invoke<number[]>('ipc_generate_zip');
        return new Blob([new Uint8Array(bytes)], { type: 'application/zip' });
    },

    // ─── File System ────────────────────────────────
    listDirectory: (path?: string) => invoke('ipc_list_directory', { path }),
    createFile: (path: string, content?: string) => invoke('ipc_create_file', { path, content }),
    createFolder: (path: string) => invoke('ipc_create_folder', { path }),
    renameFile: (oldPath: string, newPath: string) => invoke('ipc_rename_file', { oldPath, newPath }),
    deleteFile: (path: string) => invoke('ipc_delete_file', { path }),
    readFileContent: (path: string) => invoke('ipc_read_file_content', { path }),
    writeFileContent: (path: string, content: string) => invoke('ipc_write_file_content', { path, content }),
    installDependencies: () => invoke('ipc_install_dependencies'),

    // ─── Components ─────────────────────────────────
    getComponents: () => invoke('ipc_list_components'),
    createComponent: (name: string, description?: string) => invoke('ipc_create_component', { name, description }),
    getComponent: (id: string) => invoke('ipc_get_component', { id }),
    instantiateComponent: (componentId: string, parentId?: string) =>
        invoke('ipc_add_block', { blockType: 'instance', name: 'Instance', parentId, componentId }),

    // ─── Git Version Control ────────────────────────
    gitHistory: (limit?: number) => invoke('ipc_git_history', { limit }),
    gitRestore: (commitId: string) => invoke('ipc_git_restore', { commitId }),
    gitDiff: (commitId: string) => invoke('ipc_git_diff', { commitId }),
    gitDiscard: (filePath: string) => invoke('ipc_git_discard_changes', { filePath }),
    gitCommit: (message: string) => invoke('ipc_git_commit', { message }),
    initGitRepo: () => invoke('ipc_git_init'),
    gitStatus: () => invoke('ipc_git_status'),
    gitGetFileContent: (filePath: string, revision: string) => invoke("ipc_git_get_file_content", { filePath, revision }),

    // ─── Diagrams ───────────────────────────────────
    listDiagrams: () => invoke('ipc_list_diagrams'),
    createDiagram: (name: string) => invoke('ipc_create_diagram', { name }),
    readDiagram: (name: string) => invoke('ipc_read_diagram', { name }),
    saveDiagram: (name: string, content: string) => invoke('ipc_save_diagram', { name, content }),
    deleteDiagram: (name: string) => invoke('ipc_delete_diagram', { name }),
    analyzeDiagram: (name: string) => invoke('ipc_analyze_diagram', { name }),
    analyzeDiagramRaw: (xml: string) => invoke('ipc_analyze_diagram_raw', { xml }),
};

// Export the selected API
export const api = isTauri ? tauriApi : httpApi;
