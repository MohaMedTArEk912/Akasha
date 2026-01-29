const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export interface Page {
    _id: string;
    projectId: string;
    name: string;
    slug: string;
    content: object;
    styles: string;
    isHome: boolean;
    order: number;
    meta: {
        title?: string;
        description?: string;
        ogImage?: string;
        keywords?: string;
    };
    transition?: {
        type: 'none' | 'fade' | 'slide' | 'zoom';
        duration: number;
    };
    createdAt: string;
    updatedAt: string;
}

export interface CreatePageDto {
    name: string;
    slug?: string;
    content?: object;
    styles?: string;
    isHome?: boolean;
    meta?: Page['meta'];
    transition?: Page['transition'];
}

export interface UpdatePageDto {
    name?: string;
    slug?: string;
    content?: object;
    styles?: string;
    isHome?: boolean;
    order?: number;
    meta?: Page['meta'];
    transition?: Page['transition'];
}

const getAuthHeaders = (): HeadersInit => {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
};

/**
 * Get all pages for a project
 */
export const getPages = async (projectId: string): Promise<Page[]> => {
    const response = await fetch(`${API_URL}/pages/${projectId}`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch pages');
    }
    return response.json();
};

/**
 * Get a single page by ID
 */
export const getPage = async (projectId: string, pageId: string): Promise<Page> => {
    const response = await fetch(`${API_URL}/pages/${projectId}/${pageId}`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch page');
    }
    return response.json();
};

/**
 * Create a new page
 */
export const createPage = async (projectId: string, data: CreatePageDto): Promise<Page> => {
    const response = await fetch(`${API_URL}/pages/${projectId}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create page');
    }
    return response.json();
};

/**
 * Update a page
 */
export const updatePage = async (
    projectId: string,
    pageId: string,
    data: UpdatePageDto
): Promise<Page> => {
    const response = await fetch(`${API_URL}/pages/${projectId}/${pageId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update page');
    }
    return response.json();
};

/**
 * Delete a page
 */
export const deletePage = async (projectId: string, pageId: string): Promise<void> => {
    const response = await fetch(`${API_URL}/pages/${projectId}/${pageId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete page');
    }
};

/**
 * Duplicate a page
 */
export const duplicatePage = async (projectId: string, pageId: string): Promise<Page> => {
    const response = await fetch(`${API_URL}/pages/${projectId}/${pageId}/duplicate`, {
        method: 'POST',
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to duplicate page');
    }
    return response.json();
};

/**
 * Reorder pages
 */
export const reorderPages = async (
    projectId: string,
    pageOrder: { id: string; order: number }[]
): Promise<Page[]> => {
    const response = await fetch(`${API_URL}/pages/${projectId}/reorder`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ pageOrder }),
    });
    if (!response.ok) {
        throw new Error('Failed to reorder pages');
    }
    return response.json();
};
