/**
 * Project Store - SolidJS reactive store for project state
 * 
 * Manages the current project and provides reactive access to its parts.
 */

import { createStore } from "solid-js/store";
import { createSignal } from "solid-js";
import { useApi, ProjectSchema, BlockSchema, PageSchema } from "../hooks/useTauri";

// Store state type
interface ProjectState {
    project: ProjectSchema | null;
    loading: boolean;
    error: string | null;
    selectedBlockId: string | null;
    selectedPageId: string | null;
    activeTab: "canvas" | "logic" | "api" | "erd";
    viewport: "desktop" | "tablet" | "mobile";
}

// Initial state
const initialState: ProjectState = {
    project: null,
    loading: false,
    error: null,
    selectedBlockId: null,
    selectedPageId: null,
    activeTab: "canvas",
    viewport: "desktop",
};

// Create the store
const [state, setState] = createStore<ProjectState>(initialState);

// Create signals for derived values
const [isDirty, setIsDirty] = createSignal(false);

// HTTP API client
const api = useApi();

/**
 * Create a new project
 */
export async function createProject(name: string): Promise<void> {
    setState("loading", true);
    setState("error", null);

    try {
        const project = await api.createProject(name);
        setState("project", project);

        // Select the first page if available
        if (project.pages.length > 0) {
            setState("selectedPageId", project.pages[0].id);
        }
    } catch (err) {
        setState("error", String(err));
        throw err;
    } finally {
        setState("loading", false);
    }
}

/**
 * Load the current project from the backend
 */
export async function loadProject(): Promise<void> {
    setState("loading", true);
    setState("error", null);

    try {
        const project = await api.getProject();
        setState("project", project);

        if (project && project.pages.length > 0) {
            setState("selectedPageId", project.pages[0].id);
        }
    } catch (err) {
        setState("error", String(err));
    } finally {
        setState("loading", false);
    }
}

/**
 * Import a project from JSON
 */
export async function importProject(json: string): Promise<void> {
    setState("loading", true);
    setState("error", null);

    try {
        const project = await api.importProjectJson(json);
        setState("project", project);

        if (project.pages.length > 0) {
            setState("selectedPageId", project.pages[0].id);
        }
    } catch (err) {
        setState("error", String(err));
        throw err;
    } finally {
        setState("loading", false);
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
    const block = await api.addBlock(blockType, name, parentId);

    // Refresh project to get updated state
    await loadProject();
    setIsDirty(true);

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
    setIsDirty(true);
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
    setIsDirty(true);
}

/**
 * Archive (soft delete) a block
 */
export async function archiveBlock(blockId: string): Promise<void> {
    await api.archiveBlock(blockId);
    await loadProject();
    setIsDirty(true);

    // Clear selection if the deleted block was selected
    if (state.selectedBlockId === blockId) {
        setState("selectedBlockId", null);
    }
}

/**
 * Add a new page
 */
export async function addPage(name: string, path: string): Promise<PageSchema> {
    const page = await api.addPage(name, path);
    await loadProject();
    setIsDirty(true);
    return page;
}

/**
 * Add a new data model
 */
export async function addDataModel(name: string): Promise<void> {
    await api.addDataModel(name);
    await loadProject();
    setIsDirty(true);
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
    setIsDirty(true);
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
    setState("selectedBlockId", blockId);
}

/**
 * Select a page
 */
export function selectPage(pageId: string): void {
    setState("selectedPageId", pageId);
    setState("selectedBlockId", null);
}

/**
 * Switch the active tab
 */
export function setActiveTab(tab: "canvas" | "logic" | "api" | "erd"): void {
    setState("activeTab", tab);
}

/**
 * Set the viewport size
 */
export function setViewport(viewport: "desktop" | "tablet" | "mobile"): void {
    setState("viewport", viewport);
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
 * Get the selected block
 */
export function getSelectedBlock(): BlockSchema | undefined {
    if (!state.selectedBlockId) return undefined;
    return getBlock(state.selectedBlockId);
}

/**
 * Get the selected page
 */
export function getSelectedPage(): PageSchema | undefined {
    if (!state.selectedPageId || !state.project) return undefined;
    return state.project.pages.find(
        p => p.id === state.selectedPageId && !p.archived
    );
}

// Export store and helpers
export { state as projectState, isDirty };
