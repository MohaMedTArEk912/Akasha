/**
 * Project Store - React-friendly state management
 * 
 * Manages the current project and provides reactive access to its parts for React.
 */

import { useApi, ProjectSchema, BlockSchema, PageSchema, InstallResult } from "../hooks/useTauri";

// Store state type
interface ProjectState {
    project: ProjectSchema | null;
    loading: boolean;
    loadingMessage: string | null;
    installLog: string | null;
    installError: string | null;
    error: string | null;
    selectedBlockId: string | null;
    selectedPageId: string | null;
    activeTab: "canvas" | "logic" | "api" | "erd";
    viewport: "desktop" | "tablet" | "mobile";
    editMode: "visual" | "code";
    selectedFilePath: string | null;

    // Workspace state
    workspacePath: string | null;
    projects: ProjectSchema[];
    isDashboardActive: boolean;
}

// Initial state
const initialState: ProjectState = {
    project: null,
    loading: false,
    loadingMessage: null,
    installLog: null,
    installError: null,
    error: null,
    selectedBlockId: null,
    selectedPageId: null,
    activeTab: "canvas",
    viewport: "desktop",
    editMode: "visual",
    workspacePath: null,
    projects: [],
    isDashboardActive: true,
    selectedFilePath: null,
};

// Internal state
let state: ProjectState = { ...initialState };
let listeners: Set<() => void> = new Set();
let isDirtyValue = false;

// HTTP API client — useApi() returns a plain object of static functions (no React hooks inside),
// so it is safe to call at module level despite the "use" naming convention.
const api = useApi();

/**
 * Subscribe to state changes
 */
export function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

/**
 * Get current state
 */
export function getSnapshot() {
    return state;
}

/**
 * Update state
 */
function updateState(updater: (prev: ProjectState) => Partial<ProjectState>) {
    state = { ...state, ...updater(state) };
    listeners.forEach(l => l());
}

function formatInstallResult(result: InstallResult): string {
    return result.steps.map(step => {
        const header = `=== ${step.target} (${step.status}) | ${step.duration_ms}ms ===`;
        const stdout = step.stdout?.trim() ? `\n${step.stdout.trim()}` : "";
        const stderr = step.stderr?.trim() ? `\n[stderr]\n${step.stderr.trim()}` : "";
        return `${header}${stdout}${stderr}`;
    }).join("\n\n");
}

export async function installProjectDependencies(): Promise<boolean> {
    updateState(() => ({
        loadingMessage: "Installing dependencies (client + server)...",
        installError: null,
        installLog: null
    }));

    try {
        const result = await api.installDependencies();
        const log = formatInstallResult(result);

        if (!result.success) {
            updateState(() => ({
                loadingMessage: "Dependency installation failed",
                installError: "Dependency installation failed",
                installLog: log
            }));
            return false;
        }

        updateState(() => ({
            loadingMessage: "Dependencies installed!",
            installLog: log
        }));
        await new Promise(resolve => setTimeout(resolve, 1000));
        updateState(() => ({
            loadingMessage: null,
            installError: null,
            installLog: null
        }));
        return true;
    } catch (err) {
        updateState(() => ({
            loadingMessage: "Dependency installation failed",
            installError: String(err),
            installLog: String(err)
        }));
        return false;
    }
}

export function clearInstallStatus(): void {
    updateState(() => ({
        loadingMessage: null,
        installError: null,
        installLog: null
    }));
}

/**
 * Initialize workspace state
 */
export async function initWorkspace(): Promise<void> {
    try {
        const { workspace_path, projects } = await api.getWorkspaceStatus();
        updateState(() => ({
            workspacePath: workspace_path,
            projects,
            isDashboardActive: !!workspace_path && !state.project
        }));
    } catch (err) {
        console.error("Failed to init workspace:", err);
    }
}

/**
 * Set the global workspace path
 */
export async function setWorkspace(path: string): Promise<void> {
    updateState(() => ({ loading: true }));
    try {
        await api.setWorkspacePath(path);
        await initWorkspace();
    } finally {
        updateState(() => ({ loading: false }));
    }
}

/**
 * Rename the current project
 */
export async function renameProject(name: string): Promise<void> {
    updateState(() => ({ loading: true, error: null }));
    try {
        const project = await api.renameProject(name);
        updateState(() => ({ project }));
        await initWorkspace(); // Refresh project list in dashboard
    } catch (err) {
        updateState(() => ({ error: String(err) }));
        throw err;
    } finally {
        updateState(() => ({ loading: false }));
    }
}

/**
 * Reset the current project to initial state
 */
export async function resetProject(): Promise<void> {
    updateState(() => ({ loading: true, error: null }));
    try {
        const project = await api.resetProject();
        updateState(() => ({
            project,
            selectedPageId: null,
            selectedBlockId: null
        }));
    } catch (err) {
        updateState(() => ({ error: String(err) }));
        throw err;
    } finally {
        updateState(() => ({ loading: false }));
    }
}

/**
 * Create a new project in the workspace
 */
export async function createProject(name: string): Promise<void> {
    updateState(() => ({ loading: true, error: null }));

    try {
        let project = await api.createProject(name);

        // If workspace is set, we automatically configure the sync root 
        // as a subfolder within the workspace
        if (state.workspacePath) {
            const projectPath = `${state.workspacePath}/${name}`.replace(/\\/g, '/');
            await api.setProjectRoot(projectPath);
            // Reload project to get updated root_path
            project = await api.getProject() as ProjectSchema;

            // AUTO-INSTALL DEPENDENCIES
            await installProjectDependencies();
        }

        updateState(() => ({
            project,
            selectedPageId: null,
            isDashboardActive: false,
            loadingMessage: null
        }));
        await initWorkspace(); // Refresh projects list
    } catch (err) {
        updateState(() => ({ error: String(err) }));
        throw err;
    } finally {
        updateState(prev => ({
            loading: false,
            loadingMessage: prev.installError ? prev.loadingMessage : null
        }));
    }
}

/**
 * Open an existing project
 */
export async function openProject(id: string): Promise<void> {
    updateState(() => ({ loading: true, error: null }));
    try {
        let project = await api.loadProjectById(id);

        // If project has no root_path but workspace is set, auto-set it
        if (!project.root_path && state.workspacePath) {
            const projectPath = `${state.workspacePath}/${project.name}`.replace(/\\/g, '/');
            await api.setProjectRoot(projectPath);
            // Reload to get updated root_path
            project = await api.getProject() as ProjectSchema;
        }

        // CHECK IF node_modules EXISTS
        if (project.root_path) {
            try {
                const listing = await api.listDirectory(project.root_path);
                const hasNodeModules = listing.entries.some(
                    e => e.name === 'node_modules' && e.is_directory
                );

                if (!hasNodeModules) {
                    await installProjectDependencies();
                }
            } catch (err) {
                console.error("Failed to check/install dependencies:", err);
            }
        }

        updateState(() => ({
            project,
            selectedPageId: null,
            isDashboardActive: false
        }));
    } catch (err) {
        updateState(() => ({ error: String(err) }));
        throw err;
    } finally {
        updateState(prev => ({
            loading: false,
            loadingMessage: prev.installError ? prev.loadingMessage : null
        }));
    }
}

/**
 * Delete a project
 */
export async function deleteProject(id: string): Promise<void> {
    await api.deleteProjectById(id);
    await initWorkspace();
}

/**
 * Return to dashboard
 */
export function closeProject(): void {
    updateState(() => ({
        project: null,
        isDashboardActive: true,
        selectedBlockId: null,
        selectedPageId: null
    }));
}

/**
 * Refresh the current project from backend (useful after setting root_path)
 */
export async function refreshCurrentProject(): Promise<void> {
    try {
        const project = await api.getProject();
        if (project) {
            updateState(() => ({ project }));
        }
    } catch (err) {
        console.error("Failed to refresh project:", err);
    }
}

/**
 * Load the current project from the backend.
 * Preserves selectedPageId and selectedBlockId so mutations don't lose user context.
 */
export async function loadProject(): Promise<void> {
    updateState(() => ({ loading: true, error: null }));

    try {
        const project = await api.getProject();
        if (project) {
            updateState(() => ({
                project,
                isDashboardActive: false
            }));
        } else {
            await initWorkspace();
        }
    } catch (err) {
        updateState(() => ({ error: String(err) }));
    } finally {
        updateState(() => ({ loading: false }));
    }
}

/**
 * Import a project from JSON
 */
export async function importProject(json: string): Promise<void> {
    updateState(() => ({ loading: true, error: null }));

    try {
        const project = await api.importProjectJson(json);
        updateState(() => ({
            project,
            selectedPageId: null
        }));
    } catch (err) {
        updateState(() => ({ error: String(err) }));
        throw err;
    } finally {
        updateState(() => ({ loading: false }));
    }
}

/**
 * Export the project to JSON
 */
export async function exportProject(): Promise<string> {
    return api.exportProjectJson();
}

/**
 * Add a new block
 */
export async function addBlock(
    blockType: string,
    name: string,
    parentId?: string
): Promise<BlockSchema> {
    const block = await api.addBlock(blockType, name, parentId, state.selectedPageId || undefined);
    await loadProject();
    isDirtyValue = true;
    return block;
}

/**
 * Update a block property
 */
export async function updateBlockProperty(
    blockId: string,
    property: string,
    value: unknown
): Promise<void> {
    await api.updateBlockProperty(blockId, property, value);
    await loadProject();
    isDirtyValue = true;

    // Auto-sync to disk in visual mode
    if (state.editMode === "visual" && state.project?.root_path) {
        await api.syncToDisk().catch(err =>
            console.error("Auto-sync failed:", err)
        );
    }
}

/**
 * Update a block style
 */
export async function updateBlockStyle(
    blockId: string,
    style: string,
    value: string
): Promise<void> {
    await api.updateBlockStyle(blockId, style, value);
    await loadProject();
    isDirtyValue = true;

    // Auto-sync to disk in visual mode
    if (state.editMode === "visual" && state.project?.root_path) {
        await api.syncToDisk().catch(err =>
            console.error("Auto-sync failed:", err)
        );
    }
}

/**
 * Archive (soft delete) a block
 */
export async function archiveBlock(blockId: string): Promise<void> {
    await api.archiveBlock(blockId);
    await loadProject();
    isDirtyValue = true;

    if (state.selectedBlockId === blockId) {
        updateState(() => ({ selectedBlockId: null }));
    }
}

/**
 * Add a new page
 */
export async function addPage(name: string, path: string): Promise<PageSchema> {
    const page = await api.addPage(name, path);
    await loadProject();
    isDirtyValue = true;
    return page;
}

/**
 * Add a new data model
 */
export async function addDataModel(name: string): Promise<void> {
    await api.addDataModel(name);
    await loadProject();
    isDirtyValue = true;
}

/**
 * Add a new API endpoint
 */
export async function addApi(
    method: string,
    path: string,
    name: string
): Promise<void> {
    await api.addApi(method, path, name);
    await loadProject();
    isDirtyValue = true;
}

/**
 * Add a field to a data model
 */
export async function addField(
    modelId: string,
    name: string,
    fieldType: string,
    required: boolean = true
): Promise<void> {
    await api.addFieldToModel(modelId, name, fieldType, required);
    await loadProject();
    isDirtyValue = true;
}

/**
 * Generate frontend code
 */
export async function generateFrontend(): Promise<{ path: string; content: string }[]> {
    const res = await api.generateFrontend();
    return res.files;
}

/**
 * Generate backend code
 */
export async function generateBackend(): Promise<{ path: string; content: string }[]> {
    const res = await api.generateBackend();
    return res.files;
}

/**
 * Generate database schema
 */
export async function generateDatabase(): Promise<{ path: string; content: string }[]> {
    const res = await api.generateDatabase();
    return res.files;
}

/**
 * Download the project as a ZIP file
 */
export async function downloadProjectZip(): Promise<void> {
    const blob = await api.downloadZip();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${state.project?.name || "grapes-project"}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Select a block
 */
export function selectBlock(blockId: string | null): void {
    updateState(() => ({ selectedBlockId: blockId }));
}

/**
 * Select a page
 */
export function selectPage(pageId: string): void {
    updateState(() => ({ selectedPageId: pageId, selectedBlockId: null, selectedFilePath: null }));
}

/**
 * Select a generic file from the file explorer
 */
export function selectFile(path: string | null): void {
    updateState(() => ({
        selectedFilePath: path,
        selectedPageId: null,
        selectedBlockId: null,
        editMode: path ? "code" : state.editMode
    }));
}

/**
 * Switch the active tab
 */
export function setActiveTab(tab: "canvas" | "logic" | "api" | "erd"): void {
    updateState(() => ({ activeTab: tab }));
}

/**
 * Set the viewport size
 */
export function setViewport(viewport: "desktop" | "tablet" | "mobile"): void {
    updateState(() => ({ viewport }));
}

/**
 * Set the edit mode (visual blocks or code)
 * Implements bidirectional sync between visual and code modes
 */
export async function setEditMode(mode: "visual" | "code"): Promise<void> {
    // Don't sync if no project or root path
    if (!state.project?.root_path) {
        updateState(() => ({ editMode: mode }));
        return;
    }

    const previousMode = state.editMode;

    // 1. Optimistic update - switch immediately for instant UI feedback
    updateState(() => ({ editMode: mode }));

    // 2. Bidirectional sync based on mode
    updateState(() => ({ loading: true }));
    try {
        if (mode === "visual") {
            // Entering visual mode: Load latest changes from disk
            await api.syncDiskToProject();
            await loadProject();
        } else if (mode === "code") {
            // Entering code mode: Save visual changes to disk
            await api.syncToDisk();
        }
    } catch (err) {
        console.error(`Failed to sync when switching to ${mode} mode:`, err);
        // Rollback to previous mode on failure
        updateState(() => ({ editMode: previousMode }));
    } finally {
        updateState(() => ({ loading: false }));
    }
}

/**
 * Set the project root path on disk
 */
export async function setProjectRoot(path: string): Promise<void> {
    await api.setProjectRoot(path);
    await loadProject();
}

/**
 * Add a new logic flow
 */
export async function addLogicFlow(name: string, context: 'frontend' | 'backend'): Promise<void> {
    await api.createLogicFlow(name, context);
    await loadProject();
    isDirtyValue = true;
}

/**
 * Delete a logic flow
 */
export async function deleteLogicFlow(id: string): Promise<void> {
    await api.deleteLogicFlow(id);
    await loadProject();
    isDirtyValue = true;
}

/**
 * Get physical page content from disk
 */
export async function getPageContent(id: string): Promise<string> {
    const res = await api.getPageContent(id);
    return res.content;
}

/**
 * Get physical file content from disk by absolute path
 */
export async function getFileContent(path: string): Promise<string> {
    const res = await api.readFileContent(path);
    return res.content;
}

/**
 * Force a manual sync to disk
 */
export async function syncToDisk(): Promise<void> {
    await api.syncToDisk();
    isDirtyValue = false;
}

/**
 * List directory contents
 */
export async function listDirectory(path?: string) {
    return await api.listDirectory(path);
}

/**
 * Recursively find all directories in the project root
 */
export async function getAllFolders(basePath: string = ""): Promise<{ label: string; value: string }[]> {
    const listing = await api.listDirectory(basePath);
    let folders = listing.entries
        .filter(e => e.is_directory)
        .map(e => ({ label: e.path, value: e.path }));

    for (const entry of listing.entries) {
        if (entry.is_directory) {
            const subfolders = await getAllFolders(entry.path);
            folders = [...folders, ...subfolders];
        }
    }
    return folders;
}

/**
 * Get a block by ID
 */
export function getBlock(blockId: string): BlockSchema | undefined {
    return state.project?.blocks.find(b => b.id === blockId && !b.archived);
}

/**
 * Get root blocks (blocks without a parent)
 */
export function getRootBlocks(): BlockSchema[] {
    if (!state.project) return [];
    return state.project.blocks.filter(b => !b.parent_id && !b.archived);
}

/**
 * Get children of a block
 */
export function getBlockChildren(parentId: string): BlockSchema[] {
    if (!state.project) return [];
    return state.project.blocks.filter(
        b => b.parent_id === parentId && !b.archived
    );
}

/**
 * Get any page by ID
 */
export function getPage(pageId: string): PageSchema | undefined {
    return state.project?.pages.find(p => p.id === pageId && !p.archived);
}

// Export reactive state access — use getSnapshot() for current state
export const isDirty = () => isDirtyValue;
export function clearDirty(): void { isDirtyValue = false; }
