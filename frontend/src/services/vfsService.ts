/**
 * VFS Service - Frontend API client for Virtual File System
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// ============================================================================
// TYPES
// ============================================================================

export interface VFSFile {
    _id: string;
    projectId: string;
    name: string;
    path: string;
    type: FileType;
    protection: ProtectionLevel;
    schema: Record<string, unknown>;
    isArchived: boolean;
    archivedAt?: string;
    createdAt: string;
    updatedAt: string;
}

export interface VFSBlock {
    _id: string;
    fileId: string;
    projectId: string;
    type: string;
    props: Record<string, unknown>;
    events: BlockEvent[];
    styles: TailwindStyles;
    constraints: BlockConstraints;
    order: number;
    parentBlockId?: string;
    createdAt: string;
    updatedAt: string;
}

export interface VFSVersion {
    _id: string;
    projectId: string;
    label?: string;
    trigger: 'auto' | 'manual' | 'before_risky_operation';
    createdAt: string;
}

export interface FolderNode {
    name: string;
    path: string;
    children: FolderNode[];
    files: VFSFile[];
}

export interface BlockEvent {
    trigger: 'click' | 'submit' | 'load' | 'hover' | 'scroll';
    actions: Array<{
        type: 'setState' | 'apiCall' | 'navigate' | 'showHide' | 'custom';
        config: Record<string, unknown>;
    }>;
}

export interface TailwindStyles {
    base: string[];
    hover?: string[];
    focus?: string[];
    responsive?: {
        sm?: string[];
        md?: string[];
        lg?: string[];
        xl?: string[];
    };
}

export interface BlockConstraints {
    canDelete: boolean;
    canMove: boolean;
    canEdit: boolean;
    lockedProps: string[];
}

export type FileType =
    | 'page'
    | 'component'
    | 'flow'
    | 'store'
    | 'config'
    | 'tokens'
    | 'css'
    | 'js'
    | 'inject';

export type ProtectionLevel = 'protected' | 'semi_editable' | 'free_code';

export interface FileCapabilities {
    delete: boolean;
    rename: boolean;
    rawEdit: boolean;
    uiEdit: boolean;
    move: boolean;
    archive: boolean;
    duplicate: boolean;
    export: boolean;
    protectionLevel: ProtectionLevel;
    hint: string;
}

export interface OrganizationStats {
    total: number;
    archived: number;
    misplaced: number;
    [key: string]: number;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

// ============================================================================
// HELPER
// ============================================================================

/**
 * Get auth token from storage
 */
function getAuthToken(): string | null {
    const userStr = localStorage.getItem('grapes_user');
    if (userStr) {
        try {
            const user = JSON.parse(userStr);
            if (user?.token) return user.token;
        } catch {
            // ignore parse errors
        }
    }
    return localStorage.getItem('token');
}

/**
 * Build headers with auth
 */
function buildHeaders(): HeadersInit {
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
    };

    const token = getAuthToken();
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
}

/**
 * Handle API response
 */
async function handleResponse<T>(response: Response): Promise<T> {
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
    }

    if (!data.success) {
        throw new Error(data.error || 'API request failed');
    }

    return data.data;
}

// ============================================================================
// FILE OPERATIONS
// ============================================================================

/**
 * Get all files for a project with tree structure
 */
export async function getProjectFiles(
    projectId: string,
    includeArchived = false
): Promise<{
    files: VFSFile[];
    tree: FolderNode;
    stats: OrganizationStats;
}> {
    const url = `${API_BASE}/vfs/project/${projectId}/files${includeArchived ? '?includeArchived=true' : ''}`;

    const response = await fetch(url, {
        method: 'GET',
        headers: buildHeaders(),
    });

    return handleResponse(response);
}

/**
 * Get single file with capabilities
 */
export async function getFile(fileId: string): Promise<{
    file: VFSFile;
    capabilities: FileCapabilities;
}> {
    const response = await fetch(`${API_BASE}/vfs/file/${fileId}`, {
        method: 'GET',
        headers: buildHeaders(),
    });

    return handleResponse(response);
}

/**
 * Create new file
 */
export async function createFile(
    projectId: string,
    name: string,
    type: FileType,
    schema?: Record<string, unknown>
): Promise<{ file: VFSFile }> {
    const response = await fetch(`${API_BASE}/vfs/project/${projectId}/file`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({ name, type, schema }),
    });

    return handleResponse(response);
}

/**
 * Update file
 */
export async function updateFile(
    fileId: string,
    updates: {
        name?: string;
        schema?: Record<string, unknown>;
    }
): Promise<{ file: VFSFile }> {
    const response = await fetch(`${API_BASE}/vfs/file/${fileId}`, {
        method: 'PUT',
        headers: buildHeaders(),
        body: JSON.stringify(updates),
    });

    return handleResponse(response);
}

/**
 * Move file to new path
 */
export async function moveFile(
    fileId: string,
    path: string
): Promise<{ file: VFSFile }> {
    const response = await fetch(`${API_BASE}/vfs/file/${fileId}/move`, {
        method: 'PUT',
        headers: buildHeaders(),
        body: JSON.stringify({ path }),
    });

    return handleResponse(response);
}

/**
 * Delete file (only for free_code files)
 */
export async function deleteFile(fileId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/vfs/file/${fileId}`, {
        method: 'DELETE',
        headers: buildHeaders(),
    });

    await handleResponse(response);
}

/**
 * Archive file (safe delete)
 */
export async function archiveFile(fileId: string): Promise<{ file: VFSFile }> {
    const response = await fetch(`${API_BASE}/vfs/file/${fileId}/archive`, {
        method: 'POST',
        headers: buildHeaders(),
    });

    return handleResponse(response);
}

/**
 * Restore archived file
 */
export async function restoreFile(fileId: string): Promise<{ file: VFSFile }> {
    const response = await fetch(`${API_BASE}/vfs/file/${fileId}/restore`, {
        method: 'POST',
        headers: buildHeaders(),
    });

    return handleResponse(response);
}

// ============================================================================
// BLOCK OPERATIONS
// ============================================================================

/**
 * Get blocks for a file
 */
export async function getFileBlocks(fileId: string): Promise<{
    blocks: VFSBlock[];
    tree: any; // Block tree structure
}> {
    const response = await fetch(`${API_BASE}/vfs/file/${fileId}/blocks`, {
        method: 'GET',
        headers: buildHeaders(),
    });

    return handleResponse(response);
}

/**
 * Create block
 */
export async function createBlock(
    fileId: string,
    type: string,
    props?: Record<string, unknown>,
    styles?: Partial<TailwindStyles>,
    parentBlockId?: string
): Promise<{ block: VFSBlock }> {
    const response = await fetch(`${API_BASE}/vfs/file/${fileId}/block`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({ type, props, styles, parentBlockId }),
    });

    return handleResponse(response);
}

/**
 * Update block
 */
export async function updateBlock(
    blockId: string,
    updates: {
        props?: Record<string, unknown>;
        styles?: TailwindStyles;
        events?: BlockEvent[];
        order?: number;
        parentBlockId?: string;
    }
): Promise<{ block: VFSBlock }> {
    const response = await fetch(`${API_BASE}/vfs/block/${blockId}`, {
        method: 'PUT',
        headers: buildHeaders(),
        body: JSON.stringify(updates),
    });

    return handleResponse(response);
}

/**
 * Delete block
 */
export async function deleteBlock(blockId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/vfs/block/${blockId}`, {
        method: 'DELETE',
        headers: buildHeaders(),
    });

    await handleResponse(response);
}

/**
 * Reorder blocks
 */
export async function reorderBlocks(
    fileId: string,
    order: string[]
): Promise<void> {
    const response = await fetch(`${API_BASE}/vfs/file/${fileId}/blocks/reorder`, {
        method: 'PUT',
        headers: buildHeaders(),
        body: JSON.stringify({ order }),
    });

    await handleResponse(response);
}

// ============================================================================
// VERSION OPERATIONS
// ============================================================================

/**
 * Get versions for project
 */
export async function getVersions(
    projectId: string,
    limit = 20
): Promise<{ versions: VFSVersion[] }> {
    const response = await fetch(
        `${API_BASE}/vfs/project/${projectId}/versions?limit=${limit}`,
        {
            method: 'GET',
            headers: buildHeaders(),
        }
    );

    return handleResponse(response);
}

/**
 * Create named version
 */
export async function createVersion(
    projectId: string,
    label?: string
): Promise<{ version: VFSVersion }> {
    const response = await fetch(`${API_BASE}/vfs/project/${projectId}/version`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({ label }),
    });

    return handleResponse(response);
}

/**
 * Restore version
 */
export async function restoreVersion(versionId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/vfs/version/${versionId}/restore`, {
        method: 'POST',
        headers: buildHeaders(),
    });

    await handleResponse(response);
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Get file type from path
 */
export function getFileTypeFromPath(path: string): FileType | null {
    const extension = path.split('.').pop()?.toLowerCase();

    const typeMap: Record<string, FileType> = {
        page: 'page',
        comp: 'component',
        flow: 'flow',
        store: 'store',
        config: 'config',
        tokens: 'tokens',
        css: 'css',
        js: 'js',
        inject: 'inject',
    };

    return extension ? typeMap[extension] || null : null;
}

/**
 * Check if file type is protected
 */
export function isProtectedType(type: FileType): boolean {
    return ['page', 'component', 'flow'].includes(type);
}

/**
 * Get protection level for file type
 */
export function getProtectionLevel(type: FileType): ProtectionLevel {
    if (['page', 'component', 'flow'].includes(type)) {
        return 'protected';
    }
    if (['store', 'config', 'tokens'].includes(type)) {
        return 'semi_editable';
    }
    return 'free_code';
}
