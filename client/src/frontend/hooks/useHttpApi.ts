
import axios from 'axios';
import {
    ProjectSchema, BlockSchema, PageSchema, LogicFlowSchema, DataModelSchema, VariableSchema,
    ApiSchema, GitCommitInfo, GitStatus, FileEntry, ProjectSettings, FieldSchema, RelationSchema
} from '../types/api';

const API_BASE_URL = 'http://localhost:3001/api';

const client = axios.create({
    baseURL: API_BASE_URL
});

// State to track current project context (since HTTP is stateless)
let activeProjectId: string | null = null;

export const httpApi = {
    mode: 'web',
    // ─── Workspace ──────────────────────────────────
    getWorkspaceStatus: async () => {
        const res = await client.get('/workspace');
        return res.data;
    },
    setWorkspacePath: async (_path: string) => true,
    pickFolder: async () => null,
    loadProjectById: async (id: string): Promise<ProjectSchema> => {
        const res = await client.get(`/project/${id}`);
        activeProjectId = id; // Set active context
        return res.data;
    },
    deleteProjectById: async (id: string, deleteFromDisk?: boolean) => {
        const res = await client.delete(`/project/${id}`, { params: { deleteFromDisk } });
        return res.data;
    },

    // ─── Project ────────────────────────────────────
    getProject: async (): Promise<ProjectSchema | null> => {
        console.warn('getProject called in web mode without ID context.');
        return null; // Return null explicitly
    },
    createProject: async (name: string): Promise<ProjectSchema> => {
        const res = await client.post('/project', { name });
        if (res.data && res.data.id) {
            activeProjectId = res.data.id;
        }
        return res.data;
    },
    renameProject: async (_name: string) => {
        // Needs ID context usually
        throw new Error('Rename not implemented in HTTP hook without ID');
    },
    updateSettings: async (_settings: Partial<ProjectSettings>) => {
        throw new Error('Update settings not implemented');
    },
    resetProject: async (_clearDiskFiles?: boolean): Promise<ProjectSchema> => {
        // Mock implementation for reset
        if (!activeProjectId) throw new Error("No active project");
        // For now just return getProject
        const res = await client.get(`/project/${activeProjectId}`);
        return res.data;
    },
    importProjectJson: async (_json: string): Promise<ProjectSchema> => {
        throw new Error("Import not implemented");
    },
    exportProjectJson: async () => "{}",
    setProjectRoot: async (_path: string) => true,
    syncToDisk: async () => {
        if (!activeProjectId) return false;
        await client.post('/codegen/sync', { projectId: activeProjectId });
        return true;
    },
    syncDiskToProject: async () => true,

    // ─── Blocks ─────────────────────────────────────
    addBlock: async (_blockType: string, _name: string, _parentId?: string, _pageId?: string, _componentId?: string): Promise<BlockSchema> => {
        // Need Implementation
        throw new Error("Not implemented");
    },
    bulkSyncPageBlocks: (_projectId: string, pageId: string, blocks: BlockSchema[]) => {
        return client.post('/blocks/sync', { page_id: pageId, blocks });
    },
    updateBlockProperty: async (_blockId: string, _property: string, _value: unknown) => { },
    updateBlockStyle: async (_blockId: string, _style: string, _value: string) => { },
    archiveBlock: async (_blockId: string) => { },
    moveBlock: async (_blockId: string, _newParentId: string | null, _index: number) => { },

    // ─── Pages ──────────────────────────────────────
    addPage: async (name: string, path: string): Promise<PageSchema> => {
        // Mock return for now since backend might not support it yet via http?
        // Actually backend supports it.
        if (!activeProjectId) throw new Error("No active project");
        const res = await client.post('/pages', { projectId: activeProjectId, name, path });
        return res.data;
    },
    updatePage: async (_id: string, _name?: string, _path?: string) => { },
    archivePage: async (_id: string) => { },
    getPageContent: async (_id: string) => ({ content: "{}" }),

    // ─── Logic Flows ────────────────────────────────
    getLogicFlows: async () => {
        if (!activeProjectId) return [] as LogicFlowSchema[];
        const res = await client.get('/logic-flows', { params: { projectId: activeProjectId } });
        return res.data;
    },
    createLogicFlow: async (name: string, context: 'frontend' | 'backend') => {
        if (!activeProjectId) throw new Error("No active project");
        const res = await client.post('/logic-flows', { projectId: activeProjectId, name, context });
        return res.data;
    },
    deleteLogicFlow: async (id: string) => {
        await client.delete(`/logic-flows/${id}`);
        return true;
    },
    updateLogicFlow: async (id: string, updates: any) => {
        const res = await client.put(`/logic-flows/${id}`, updates);
        return res.data;
    },

    // ─── Data Models ────────────────────────────────
    getModels: async () => {
        if (!activeProjectId) return [] as DataModelSchema[];
        const res = await client.get('/data-models', { params: { projectId: activeProjectId } });
        return res.data;
    },
    addDataModel: async (name: string) => {
        if (!activeProjectId) throw new Error("No active project");
        const res = await client.post('/data-models', { projectId: activeProjectId, name });
        return res.data;
    },
    updateModel: async (id: string, updates: any) => {
        const res = await client.put(`/data-models/${id}`, updates);
        return res.data;
    },
    addFieldToModel: async (modelId: string, name: string, fieldType: string, required: boolean) => {
        // Fetch current model to get generic schema, then update
        // In a real app, backend should have specific endpoint, but generic update works for now
        const models = (await httpApi.getModels()) as DataModelSchema[];
        const model = models.find(m => m.id === modelId);
        if (!model) throw new Error("Model not found");

        const newField: FieldSchema = {
            id: crypto.randomUUID(),
            name,
            field_type: fieldType,
            required,
            unique: false,
            primary_key: false
        };
        const fields = [...model.fields, newField];

        return httpApi.updateModel(modelId, { fields });
    },
    updateField: async (modelId: string, fieldId: string, updates: any) => {
        const models = (await httpApi.getModels()) as DataModelSchema[];
        const model = models.find(m => m.id === modelId);
        if (!model) throw new Error("Model not found");

        const fields = model.fields.map(f => f.id === fieldId ? { ...f, ...updates } : f);
        return httpApi.updateModel(modelId, { fields });
    },
    archiveDataModel: async (id: string) => {
        await client.delete(`/data-models/${id}`);
        return true;
    },
    deleteField: async (modelId: string, fieldId: string) => {
        const models = (await httpApi.getModels()) as DataModelSchema[];
        const model = models.find(m => m.id === modelId);
        if (!model) throw new Error("Model not found");

        const fields = model.fields.filter(f => f.id !== fieldId);
        return httpApi.updateModel(modelId, { fields });
    },
    addRelation: async (modelId: string, name: string, targetModelId: string, relationType: string) => {
        const models = (await httpApi.getModels()) as DataModelSchema[];
        const model = models.find(m => m.id === modelId);
        if (!model) throw new Error("Model not found");

        const newRelation: RelationSchema = {
            id: crypto.randomUUID(),
            name,
            target_model_id: targetModelId,
            relation_type: relationType
        };
        const relations = [...model.relations, newRelation];
        return httpApi.updateModel(modelId, { relations });
    },
    deleteRelation: async (modelId: string, relationId: string) => {
        const models = (await httpApi.getModels()) as DataModelSchema[];
        const model = models.find(m => m.id === modelId);
        if (!model) throw new Error("Model not found");

        const relations = model.relations.filter(r => r.id !== relationId);
        return httpApi.updateModel(modelId, { relations });
    },

    // ─── API Endpoints ──────────────────────────────
    getEndpoints: async () => [] as ApiSchema[],
    addApi: async (_method: string, _path: string, _name: string) => { throw new Error("Not implemented") },
    updateEndpoint: async (_id: string, _updates: any) => { throw new Error("Not implemented") },
    archiveApi: async (_id: string) => true,

    // ─── Variables ──────────────────────────────────
    getVariables: async () => {
        if (!activeProjectId) return [] as VariableSchema[];
        const res = await client.get('/variables', { params: { projectId: activeProjectId } });
        return res.data;
    },
    createVariable: async (data: any) => {
        if (!activeProjectId) throw new Error("No active project");
        const res = await client.post('/variables', { projectId: activeProjectId, ...data });
        return res.data;
    },
    updateVariable: async (_id: string, _updates: any) => {
        // We only implemented create/delete in backend variables.ts for now
        // But let's assume we might add update later or use create to overwrite?
        // Actually, schema supports update. I should add PUT to variables.ts if needed.
        // For now, throw not implemented or just return true if strictly following backend capability.
        throw new Error("Update Variable not implemented in backend yet");
    },
    deleteVariable: async (id: string) => {
        await client.delete(`/variables/${id}`);
        return true;
    },

    // ─── Code Generation ────────────────────────────
    generateFrontend: async () => {
        if (!activeProjectId) throw new Error("No active project");
        // Export to default project path for now, or let backend decide
        const res = await client.post('/codegen/export', { projectId: activeProjectId });
        return res.data;
    },
    generateBackend: async () => ({ files: [] }),
    generateDatabase: async () => ({ files: [] }),
    downloadZip: async () => new Blob([], { type: 'application/zip' }),



    // ─── File System ────────────────────────────────
    listDirectory: async (path?: string) => ({ path: path || '', entries: [] as FileEntry[] }),
    createFile: async (path: string, _content?: string) => ({ name: '', path, is_directory: false }),
    createFolder: async (path: string) => ({ name: '', path, is_directory: true }),
    renameFile: async (_oldPath: string, newPath: string) => ({ name: '', path: newPath, is_directory: false }),
    deleteFile: async (_path: string) => true,
    readFileContent: async (path: string) => ({ content: "", path }),
    writeFileContent: async (path: string, content: string) => ({ content, path }),
    installDependencies: async () => ({ success: true, steps: [] }),

    // ─── Components ─────────────────────────────────
    getComponents: async () => {
        if (!activeProjectId) return [] as BlockSchema[];
        const res = await client.get('/components', { params: { projectId: activeProjectId } });
        return res.data;
    },
    createComponent: async (name: string, description?: string): Promise<BlockSchema> => {
        if (!activeProjectId) throw new Error("No active project");
        const res = await client.post('/components', { projectId: activeProjectId, name, description });
        return res.data;
    },
    getComponent: async (_id: string) => { throw new Error("Not implemented") },
    instantiateComponent: async (_componentId: string, _parentId?: string) => { throw new Error("Not implemented") },

    // ─── Git Version Control ────────────────────────
    // Basic stubs calling the implemented endpoints
    gitHistory: async (limit?: number) => {
        if (!activeProjectId) return [] as GitCommitInfo[];
        const res = await client.get(`/git/${activeProjectId}/history`, { params: { limit } });
        return res.data;
    },
    gitRestore: async (_commitId: string) => { throw new Error("Not implemented") },
    gitDiff: async (commitId: string) => {
        if (!activeProjectId) return "";
        const res = await client.get(`/git/${activeProjectId}/diff`, { params: { commitId } });
        return res.data;
    },
    gitDiscard: async (_filePath: string) => { },
    gitCommit: async (message: string) => {
        if (!activeProjectId) return null;
        const res = await client.post(`/git/${activeProjectId}/commit`, { message });
        return res.data;
    },
    gitStatus: async () => {
        if (!activeProjectId) return { is_repo: false, changed_files: [] as any[], total_commits: 0 } as GitStatus;
        const res = await client.get(`/git/${activeProjectId}/status`);
        return res.data;
    },
    gitGetFileContent: async (_filePath: string, _revision: string) => "",
    initGitRepo: async () => true,

    // ─── Diagrams ───────────────────────────────────
    listDiagrams: async () => {
        if (!activeProjectId) return [];
        const res = await client.get('/diagrams', { params: { projectId: activeProjectId } });
        return res.data;
    },
    createDiagram: async (name: string) => {
        if (!activeProjectId) throw new Error("No active project");
        const res = await client.post('/diagrams', { projectId: activeProjectId, name });
        return res.data;
    },
    readDiagram: async (name: string) => {
        if (!activeProjectId) return "";
        const res = await client.get(`/diagrams/${name}`, { params: { projectId: activeProjectId } });
        return res.data;
    },
    saveDiagram: async (name: string, content: string) => {
        if (!activeProjectId) throw new Error("No active project");
        // We reuse POST /diagrams or implement PUT?
        // My diagrams.ts POST overwrites if exists?
        // "await fs.writeFile(filePath, content ...)" -> Yes it overwrites.
        const res = await client.post('/diagrams', { projectId: activeProjectId, name, content });
        return res.data.success;
    },
    deleteDiagram: async (name: string) => {
        if (!activeProjectId) throw new Error("No active project");
        const res = await client.delete(`/diagrams/${name}`, { params: { projectId: activeProjectId } });
        return res.data.success;
    },
    analyzeDiagram: async (_name: string) => ({ graph: { nodes: [], edges: [] }, issues: [], stats: { total_nodes: 0, total_edges: 0, unknown_type_count: 0, issue_count: 0 } }),
    analyzeDiagramRaw: async (_xml: string) => ({ graph: { nodes: [], edges: [] }, issues: [], stats: { total_nodes: 0, total_edges: 0, unknown_type_count: 0, issue_count: 0 } }),

    // ─── Use Cases ─────────────────────────────────
    listUseCases: async () => {
        if (!activeProjectId) return [];
        const res = await client.get('/usecases', { params: { projectId: activeProjectId } });
        return res.data;
    },
    createUseCase: async (data: any) => {
        if (!activeProjectId) throw new Error("No active project");
        const res = await client.post('/usecases', { ...data, projectId: activeProjectId });
        return res.data;
    },
    updateUseCase: async (id: string, data: any) => {
        if (!activeProjectId) throw new Error("No active project");
        const res = await client.put(`/usecases/${id}`, data);
        return res.data;
    },
    deleteUseCase: async (id: string) => {
        if (!activeProjectId) throw new Error("No active project");
        const res = await client.delete(`/usecases/${id}`);
        return res.data;
    },

    // ─── API Client (Proxy + History) ──────────────
    sendProxyRequest: async (data: { method: string; url: string; headers?: Record<string, string>; body?: string; params?: Record<string, string> }) => {
        const res = await client.post('/proxy', data);
        return res.data;
    },
    listApiHistory: async () => {
        if (!activeProjectId) return [];
        const res = await client.get('/api-history', { params: { projectId: activeProjectId } });
        return res.data;
    },
    saveApiHistory: async (data: any) => {
        if (!activeProjectId) throw new Error("No active project");
        const res = await client.post('/api-history', { ...data, projectId: activeProjectId });
        return res.data;
    },
    deleteApiHistory: async (id: string) => {
        const res = await client.delete(`/api-history/${id}`);
        return res.data;
    },
    clearApiHistory: async () => {
        if (!activeProjectId) throw new Error("No active project");
        const res = await client.delete(`/api-history/clear/${activeProjectId}`);
        return res.data;
    },
};
