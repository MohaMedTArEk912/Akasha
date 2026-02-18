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
    selectedComponentId: string | null;
    activePage: "dashboard" | "ui" | "usecases" | "apis" | "database" | "diagrams" | "code" | "git";
    viewport: "desktop" | "tablet" | "mobile";
    editMode: "visual" | "code";
    inspectorOpen: boolean;
    selectedFilePath: string | null;
    terminalOpen: boolean;

    /** Diff viewer state — when set, the editor area shows a diff view */
    diffView: {
        filename: string;
        lines: { text: string; type: "add" | "del" | "context" | "hunk" }[];
        commitId: string;
        commitMessage: string;
    } | null;

    /** Page IDs that are open as tabs (VS Code-style). */
    openPageIds: string[];

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
    selectedComponentId: null,
    activePage: "ui",
    viewport: "desktop",
    editMode: "visual",
    inspectorOpen: true,
    workspacePath: null,
    projects: [],
    isDashboardActive: true,
    selectedFilePath: null,
    terminalOpen: false,
    openPageIds: [],
    diffView: null,
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

function getFirstActivePageId(project: ProjectSchema | null | undefined): string | null {
    return project?.pages.find((page) => !page.archived)?.id ?? null;
}

/** All active (non-archived) page IDs. Used to seed openPageIds on project load. */
function allActivePageIds(project: ProjectSchema | null | undefined): string[] {
    return project?.pages.filter(p => !p.archived).map(p => p.id) ?? [];
}

function resolveSelectedPageId(project: ProjectSchema, preferredPageId: string | null): string | null {
    if (preferredPageId && project.pages.some((page) => page.id === preferredPageId && !page.archived)) {
        return preferredPageId;
    }
    return getFirstActivePageId(project);
}

function normalizePageName(name: string): string {
    const trimmed = name.trim();
    return trimmed.length > 0 ? trimmed : "New Page";
}

function toKebabCase(input: string): string {
    const kebab = input
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    return kebab.length > 0 ? kebab : "page";
}

function normalizePagePath(path: string): string {
    const trimmed = path.trim();
    if (!trimmed || trimmed === "/") return "/";

    const compact = trimmed.replace(/^\/+|\/+$/g, "");
    const slug = toKebabCase(compact.replace(/\//g, "-"));
    return `/${slug}`;
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
 * Update project settings (theme, build, seo)
 */
export async function updateProjectSettings(settings: Record<string, unknown>): Promise<void> {
    updateState(() => ({ loading: true, error: null }));
    try {
        const project = await api.updateSettings(settings);
        updateState(() => ({ project }));
    } catch (err) {
        updateState(() => ({ error: String(err) }));
        throw err;
    } finally {
        updateState(() => ({ loading: false }));
    }
}

/**
 * Reset the current project to initial state
 * @param clearDiskFiles - If true, clears all files in the project folder before resetting
 */
export async function resetProject(clearDiskFiles?: boolean): Promise<void> {
    updateState(() => ({ loading: true, error: null }));
    try {
        const project = await api.resetProject(clearDiskFiles);
        updateState(() => ({
            project,
            selectedPageId: getFirstActivePageId(project),
            selectedBlockId: null,
            openPageIds: allActivePageIds(project),
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
        if (state.workspacePath && !project.root_path) {
            const projectPath = `${state.workspacePath}/${name}`.replace(/\\/g, '/');
            await api.setProjectRoot(projectPath);
            // Reload the specific project by ID to get updated root_path
            const refreshedProject = await api.loadProjectById(project.id);
            if (refreshedProject) {
                project = refreshedProject;
            }

            // AUTO-INSTALL DEPENDENCIES
            await installProjectDependencies();
        }

        updateState(() => ({
            project,
            selectedPageId: getFirstActivePageId(project),
            isDashboardActive: false,
            activePage: "dashboard",
            loadingMessage: null,
            openPageIds: allActivePageIds(project),
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
            // Reload the specific project by ID to get updated root_path
            const refreshedProject = await api.loadProjectById(id);
            if (refreshedProject) {
                project = refreshedProject;
            }
        }

        // Show IDE immediately — don't block on dependency check
        updateState(() => ({
            project,
            selectedPageId: getFirstActivePageId(project),
            isDashboardActive: false,
            activePage: "dashboard",
            openPageIds: allActivePageIds(project),
        }));

        // CHECK IF node_modules EXISTS (non-blocking, runs in background)
        if (project.root_path) {
            // Fire-and-forget: check client/node_modules (npm installs into client/ and server/)
            (async () => {
                try {
                    const listing = await api.listDirectory("client");
                    const hasNodeModules = listing.entries.some(
                        e => e.name === 'node_modules' && e.is_directory
                    );

                    if (!hasNodeModules) {
                        await installProjectDependencies();
                    }
                } catch (err) {
                    console.error("Failed to check/install dependencies:", err);
                }
            })();
        }
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
 * @param deleteFromDisk - If true, also deletes the project folder from disk
 */
export async function deleteProject(id: string, deleteFromDisk?: boolean): Promise<void> {
    await api.deleteProjectById(id, deleteFromDisk);
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
        selectedPageId: null,
        inspectorOpen: true
    }));
}

/**
 * Refresh the current project from backend (useful after setting root_path)
 */
export async function refreshCurrentProject(): Promise<void> {
    try {
        const project = await api.getProject();
        if (project) {
            const activeIds = new Set(allActivePageIds(project));
            const open = state.openPageIds.filter(id => activeIds.has(id));
            updateState(() => ({
                project,
                selectedPageId: resolveSelectedPageId(project, state.selectedPageId),
                openPageIds: open.length > 0 ? open : allActivePageIds(project),
            }));
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
            const activeIds = new Set(allActivePageIds(project));
            const open = state.openPageIds.filter(id => activeIds.has(id));
            updateState(() => ({
                project,
                selectedPageId: resolveSelectedPageId(project, state.selectedPageId),
                isDashboardActive: false,
                openPageIds: open.length > 0 ? open : allActivePageIds(project),
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
            selectedPageId: getFirstActivePageId(project),
            openPageIds: allActivePageIds(project),
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
 * Select a master component for editing
 */
export function selectComponent(componentId: string | null): void {
    updateState(() => ({
        selectedComponentId: componentId,
        selectedPageId: null, // Deselect page
        selectedBlockId: null, // Deselect any page block
        activePage: "ui",
        isDashboardActive: false
    }));
}

/**
 * Close component editor and return to dashboard
 */
export function closeComponentEditor(): void {
    updateState(() => ({
        selectedComponentId: null,
        activePage: "ui",
        isDashboardActive: true
    }));
}

/**
 * Add a new block (wrapper with component support)
 */
export async function addBlock(
    blockType: string,
    name: string,
    parentId?: string,
    componentId?: string
): Promise<BlockSchema> {
    const block = await api.addBlock(blockType, name, parentId, state.selectedPageId || undefined, componentId);
    await loadProject();
    isDirtyValue = true;
    return block;
}

/**
 * Create a new master component
 */
export async function createMasterComponent(
    name: string,
    description?: string
): Promise<BlockSchema> {
    const component = await api.createComponent(name, description);
    await loadProject();
    isDirtyValue = true;
    return component;
}

/**
 * Instantiate a reusable component
 */
export async function instantiateComponent(
    componentId: string,
    parentId?: string
): Promise<BlockSchema> {
    const component = state.project?.components.find(c => c.id === componentId);
    if (!component) throw new Error("Component not found");

    // Create an instance block
    // We pass "instance" as block type (which backend maps to BlockType::Instance)
    // And componentId to link it
    return addBlock("instance", component.name, parentId, componentId);
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
 * Update a block binding (data source connection for a property)
 */
export async function updateBlockBinding(
    blockId: string,
    propertyName: string,
    binding: { type: string; value: unknown } | null
): Promise<void> {
    await api.updateBlockProperty(blockId, `bindings.${propertyName}`, binding);
    await loadProject();
    isDirtyValue = true;
}

/**
 * Update a block event handler (event -> logic flow mapping)
 */
export async function updateBlockEvent(
    blockId: string,
    eventName: string,
    logicFlowId: string | null
): Promise<void> {
    await api.updateBlockProperty(blockId, `events.${eventName}`, logicFlowId);
    await loadProject();
    isDirtyValue = true;
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
 * Move a block to a new parent and/or reorder it
 */
export async function moveBlock(
    blockId: string,
    newParentId: string | null,
    index: number
): Promise<void> {
    await api.moveBlock(blockId, newParentId, index);
    await loadProject();
    isDirtyValue = true;
}

/**
 * Update a block's canvas position (x, y) in a single batch.
 * Only persists to backend DB — skips disk sync since position is visual metadata.
 */
export async function updateBlockPosition(
    blockId: string,
    x: number,
    y: number
): Promise<void> {
    await api.updateBlockProperty(blockId, "x", x);
    await api.updateBlockProperty(blockId, "y", y);
    await loadProject();
    isDirtyValue = true;
}

/**
 * Add a new block at a specific canvas position.
 * NOTE: We intentionally omit page_id here. The backend auto-nests blocks
 * under a page root when page_id is provided, which breaks free-position
 * layout (subsequent blocks get parent_id set and vanish from root).
 * Blocks are kept as true root-level entries for the freeform canvas.
 */
export async function addBlockAtPosition(
    blockType: string,
    name: string,
    x: number,
    y: number,
    componentId?: string,
    options?: { parentId?: string; index?: number }
): Promise<BlockSchema> {
    let parentId: string | undefined;

    if (options?.parentId) {
        parentId = options.parentId;
    } else if (state.selectedComponentId) {
        parentId = state.selectedComponentId;
    } else if (state.selectedPageId) {
        const page = state.project?.pages.find(p => p.id === state.selectedPageId);
        parentId = page?.root_block_id;
    }

    const block = await api.addBlock(blockType, name, parentId, undefined, componentId);
    if (typeof options?.index === "number" && parentId) {
        await api.moveBlock(block.id, parentId, options.index);
    }
    await api.updateBlockProperty(block.id, "x", x);
    await api.updateBlockProperty(block.id, "y", y);
    await loadProject();
    isDirtyValue = true;
    return block;
}

/**
 * Add a new page
 */
export async function addPage(name: string, path: string): Promise<PageSchema> {
    const normalizedName = normalizePageName(name);
    const normalizedPath = normalizePagePath(path);
    const page = await api.addPage(normalizedName, normalizedPath);
    await loadProject();
    const open = state.openPageIds.includes(page.id)
        ? state.openPageIds
        : [...state.openPageIds, page.id];
    updateState(() => ({
        selectedPageId: page.id,
        selectedBlockId: null,
        selectedFilePath: null,
        activePage: "ui",
        openPageIds: open,
    }));
    isDirtyValue = true;

    if (state.editMode === "visual" && state.project?.root_path) {
        await api.syncToDisk().catch(err =>
            console.error("Auto-sync failed:", err)
        );
    }

    return page;
}

/**
 * Update a page
 */
export async function updatePage(id: string, name?: string, path?: string): Promise<void> {
    await api.updatePage(id, name, path);
    await loadProject();
    isDirtyValue = true;

    if (state.editMode === "visual" && state.project?.root_path) {
        await api.syncToDisk().catch(err =>
            console.error("Auto-sync failed:", err)
        );
    }
}

/**
 * Archive a page
 */
export async function archivePage(id: string): Promise<void> {
    await api.archivePage(id);
    await loadProject();
    isDirtyValue = true;

    // If the archived page was selected, select the first available page
    if (state.selectedPageId === id) {
        const nextId = getFirstActivePageId(state.project);
        updateState(() => ({ selectedPageId: nextId }));
    }

    if (state.editMode === "visual" && state.project?.root_path) {
        await api.syncToDisk().catch(err =>
            console.error("Auto-sync failed:", err)
        );
    }
}

/**
 * Create a page with automatic naming/path under client/src/pages sync flow.
 */
export async function createPage(name: string): Promise<PageSchema> {
    if (!state.project) {
        throw new Error("No project loaded");
    }

    const baseName = normalizePageName(name);
    const baseSlug = toKebabCase(baseName);
    const existingPages = state.project.pages.filter((page) => !page.archived);
    const usedNames = new Set(existingPages.map((page) => page.name.toLowerCase()));
    const usedPaths = new Set(existingPages.map((page) => page.path.toLowerCase()));

    let candidateName = baseName;
    let candidatePath = `/${baseSlug}`;
    let suffix = 2;

    while (
        usedNames.has(candidateName.toLowerCase()) ||
        usedPaths.has(candidatePath.toLowerCase())
    ) {
        candidateName = `${baseName} ${suffix}`;
        candidatePath = `/${baseSlug}-${suffix}`;
        suffix += 1;
    }

    return addPage(candidateName, candidatePath);
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
 * Update a field in a data model
 */
export async function updateField(
    modelId: string,
    fieldId: string,
    updates: { name?: string; field_type?: string; required?: boolean; unique?: boolean; description?: string }
): Promise<void> {
    await api.updateField(modelId, fieldId, updates);
    await loadProject();
    isDirtyValue = true;
}

/**
 * Archive (soft-delete) an API endpoint
 */
export async function archiveApi(id: string): Promise<void> {
    await api.archiveApi(id);
    await loadProject();
    isDirtyValue = true;
}

/**
 * Update an API endpoint
 */
export async function updateEndpoint(
    id: string,
    updates: {
        method?: string;
        path?: string;
        name?: string;
        description?: string;
        auth_required?: boolean;
        request_body?: import("../hooks/useTauri").DataShape | null;
        response_body?: import("../hooks/useTauri").DataShape | null;
        permissions?: string[];
        logic_flow_id?: string | null;
    }
): Promise<void> {
    await api.updateEndpoint(id, updates);
    await loadProject();
    isDirtyValue = true;
}

/**
 * Update a data model
 */
export async function updateModel(
    id: string,
    updates: { name?: string; description?: string }
): Promise<void> {
    await api.updateModel(id, updates);
    await loadProject();
    isDirtyValue = true;
}

/**
 * Archive (soft-delete) a data model
 */
export async function archiveDataModel(id: string): Promise<void> {
    await api.archiveDataModel(id);
    await loadProject();
    isDirtyValue = true;
}

/**
 * Delete a field from a data model
 */
export async function deleteField(modelId: string, fieldId: string): Promise<void> {
    await api.deleteField(modelId, fieldId);
    await loadProject();
    isDirtyValue = true;
}

/**
 * Add a relation to a data model
 */
export async function addRelation(
    modelId: string,
    name: string,
    targetModelId: string,
    relationType: string
): Promise<void> {
    await api.addRelation(modelId, name, targetModelId, relationType);
    await loadProject();
    isDirtyValue = true;
}

/**
 * Delete a relation from a data model
 */
export async function deleteRelation(modelId: string, relationId: string): Promise<void> {
    await api.deleteRelation(modelId, relationId);
    await loadProject();
    isDirtyValue = true;
}

/**
 * Create a new variable
 */
export async function createVariable(data: {
    name: string;
    var_type: string;
    default_value?: unknown;
    scope?: string;
    page_id?: string;
    description?: string;
    persist?: boolean;
}): Promise<void> {
    await api.createVariable(data);
    await loadProject();
    isDirtyValue = true;
}

/**
 * Update a variable
 */
export async function updateVariable(
    id: string,
    updates: { name?: string; var_type?: string; default_value?: unknown; scope?: string; description?: string; persist?: boolean }
): Promise<void> {
    await api.updateVariable(id, updates);
    await loadProject();
    isDirtyValue = true;
}

/**
 * Delete a variable
 */
export async function deleteVariable(id: string): Promise<void> {
    await api.deleteVariable(id);
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
    a.download = `${state.project?.name || "akasha-project"}.zip`;
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
    const open = state.openPageIds.includes(pageId)
        ? state.openPageIds
        : [...state.openPageIds, pageId];
    updateState(() => ({ selectedPageId: pageId, selectedBlockId: null, selectedFilePath: null, openPageIds: open }));
}

/**
 * Open a page tab without selecting it.
 */
export function openPageTab(pageId: string): void {
    if (!state.openPageIds.includes(pageId)) {
        updateState(() => ({ openPageIds: [...state.openPageIds, pageId] }));
    }
}

/**
 * Close a page tab (VS Code-style). Selects a neighbour if it was active.
 */
export function closePageTab(pageId: string): void {
    const open = state.openPageIds.filter(id => id !== pageId);
    if (state.selectedPageId === pageId) {
        // Pick the previous tab, or the next one, or null
        const idx = state.openPageIds.indexOf(pageId);
        const next = state.openPageIds[idx - 1] ?? state.openPageIds[idx + 1] ?? null;
        updateState(() => ({
            openPageIds: open,
            selectedPageId: next,
            selectedBlockId: null,
        }));
    } else {
        updateState(() => ({ openPageIds: open }));
    }
}

/**
 * Close all page tabs except the given one.
 */
export function closeOtherPageTabs(keepPageId: string): void {
    updateState(() => ({
        openPageIds: state.openPageIds.includes(keepPageId) ? [keepPageId] : [],
        selectedPageId: keepPageId,
        selectedBlockId: null,
    }));
}

/**
 * Select a generic file from the file explorer
 */
export function selectFile(path: string | null): void {
    updateState(() => ({
        selectedFilePath: path,
        selectedPageId: null,
        selectedBlockId: null,
        diffView: null,
        activePage: path ? "code" as const : state.activePage,
        editMode: path ? "code" : state.editMode
    }));
}

/**
 * Open the diff viewer for a specific file from a commit
 */
export function openDiffView(data: {
    filename: string;
    lines: { text: string; type: "add" | "del" | "context" | "hunk" }[];
    commitId: string;
    commitMessage: string;
}): void {
    updateState(() => ({
        diffView: data,
        editMode: "code",
        activePage: "code" as const,
        selectedFilePath: null,
        selectedPageId: null,
        selectedBlockId: null,
    }));
}

/**
 * Close the diff viewer
 */
export function closeDiffView(): void {
    updateState(() => ({ diffView: null }));
}

/**
 * Switch the active feature page
 */
export type FeaturePage = "dashboard" | "ui" | "usecases" | "apis" | "database" | "diagrams" | "code" | "git";

export function setActivePage(page: FeaturePage): void {
    const editMode: "visual" | "code" = page === "code" ? "code" : "visual";
    updateState(() => ({ activePage: page, editMode }));
}

/**
 * Legacy alias — maps old tab names to new feature pages
 */
export function setActiveTab(tab: "canvas" | "logic" | "api" | "erd" | "variables"): void {
    const pageMap: Record<string, FeaturePage> = {
        canvas: "ui",
        logic: "usecases",
        api: "apis",
        erd: "database",
        variables: "database",
    };
    setActivePage(pageMap[tab] || "ui");
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
        // Keep the selected mode so the UI still switches even when sync fails.
        // This avoids trapping users in one mode due transient filesystem/sync errors.
        updateState(() => ({ error: `Sync failed while switching to ${mode} mode: ${String(err)}` }));
    } finally {
        updateState(() => ({ loading: false }));
    }
}

/**
 * Toggle visual inspector visibility
 */
export function toggleInspector(): void {
    updateState((prev) => ({ inspectorOpen: !prev.inspectorOpen }));
}

/**
 * Set visual inspector visibility explicitly.
 */
export function setInspectorOpen(open: boolean): void {
    updateState(() => ({ inspectorOpen: open }));
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
export async function addLogicFlow(
    name: string,
    context: 'frontend' | 'backend'
): Promise<import("../hooks/useTauri").LogicFlowSchema> {
    const created = await api.createLogicFlow(name, context);
    await loadProject();
    isDirtyValue = true;
    return created;
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
 * Update a logic flow (name, nodes, etc.)
 */
export async function updateLogicFlow(
    id: string,
    updates: {
        name?: string;
        nodes?: import("../hooks/useTauri").LogicNode[];
        entry_node_id?: string | null;
        description?: string;
        trigger?: import("../hooks/useTauri").TriggerType;
    }
): Promise<void> {
    await api.updateLogicFlow(id, updates);
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
 * Save physical file content to disk by relative project path.
 */
export async function saveFileContent(path: string, content: string): Promise<void> {
    await api.writeFileContent(path, content);
    isDirtyValue = true;
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
 * Create a new file
 */
export async function createFile(path: string, content?: string) {
    return await api.createFile(path, content);
}

/**
 * Delete a file
 */
export async function deleteFile(path: string) {
    return await api.deleteFile(path);
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
    if (!state.project) return undefined;
    const inBlocks = state.project.blocks.find(b => b.id === blockId && !b.archived);
    if (inBlocks) return inBlocks;
    return state.project.components.find(b => b.id === blockId && !b.archived);
}

/**
 * Get root blocks (blocks without a parent)
 */
export function getRootBlocks(): BlockSchema[] {
    if (!state.project) return [];

    // Prioritize component editing
    if (state.selectedComponentId) {
        const comp = state.project.components.find(c => c.id === state.selectedComponentId && !c.archived);
        return comp ? [comp] : [];
    }

    const activePageId = state.selectedPageId;
    if (!activePageId) return [];

    const activePage = state.project.pages.find((page) => page.id === activePageId && !page.archived);
    const selectedRootId = activePage?.root_block_id;

    if (!selectedRootId) return [];

    // STRICT SCOPING: Only return the root block expressly bound to this page.
    return state.project.blocks.filter((block) => block.id === selectedRootId && !block.archived);
}

/**
 * Get children of a block
 */
export function getBlockChildren(parentId: string): BlockSchema[] {
    if (!state.project) return [];

    const parent = getBlock(parentId);
    if (!parent) return [];

    const allChildren = [
        ...state.project.blocks.filter(
            b => b.parent_id === parentId && !b.archived
        ),
        ...state.project.components.filter(
            b => b.parent_id === parentId && !b.archived
        ),
    ];

    const childById = new Map(allChildren.map(child => [child.id, child]));
    const orderedFromParent = (parent.children || [])
        .map(childId => childById.get(childId))
        .filter((child): child is BlockSchema => Boolean(child));

    const missingChildren = allChildren
        .filter(child => !(parent.children || []).includes(child.id))
        .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

    return [...orderedFromParent, ...missingChildren];
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

/**
 * Toggle the terminal panel
 */
export function toggleTerminal(open?: boolean): void {
    updateState((prev) => ({
        terminalOpen: open ?? !prev.terminalOpen
    }));
}

/**
 * Create a new diagram
 */
export async function createDiagram(name: string): Promise<void> {
    await api.createDiagram(name);
    // No need to reload project, just return. The caller should reload the list.
}

/**
 * Delete a diagram
 */
export async function deleteDiagram(name: string): Promise<void> {
    await api.deleteDiagram(name);
}
