const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export interface FieldDefinition {
    name: string;
    type: 'text' | 'richtext' | 'number' | 'boolean' | 'date' | 'image' | 'reference';
    required?: boolean;
    defaultValue?: unknown;
}

export interface Collection {
    _id: string;
    name: string;
    slug: string;
    description?: string;
    fields: FieldDefinition[];
    createdAt: string;
    updatedAt: string;
}

export interface CollectionItem {
    _id: string;
    collectionId: string;
    data: Record<string, unknown>;
    status: 'draft' | 'published';
    createdAt: string;
    updatedAt: string;
}

export interface CreateCollectionDto {
    name: string;
    description?: string;
    fields?: FieldDefinition[];
}

export interface UpdateCollectionDto {
    name?: string;
    description?: string;
    fields?: FieldDefinition[];
}

const getAuthHeaders = (): HeadersInit => {
    const userStr = localStorage.getItem('grapes_user');
    const user = userStr ? JSON.parse(userStr) : null;
    const token = user?.token;

    return {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
};

export const getCollections = async (): Promise<Collection[]> => {
    const response = await fetch(`${API_URL}/cms/collections`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch collections');
    }
    return response.json();
};

export const createCollection = async (data: CreateCollectionDto): Promise<Collection> => {
    const response = await fetch(`${API_URL}/cms/collections`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create collection');
    }
    return response.json();
};

export const updateCollection = async (id: string, data: UpdateCollectionDto): Promise<Collection> => {
    const response = await fetch(`${API_URL}/cms/collections/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update collection');
    }
    return response.json();
};

export const deleteCollection = async (id: string): Promise<void> => {
    const response = await fetch(`${API_URL}/cms/collections/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete collection');
    }
};

export const getCollectionItems = async (collectionId: string): Promise<CollectionItem[]> => {
    const response = await fetch(`${API_URL}/cms/collections/${collectionId}/items`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch collection items');
    }
    return response.json();
};

export const createCollectionItem = async (
    collectionId: string,
    data: Record<string, unknown>,
    status: CollectionItem['status'] = 'draft'
): Promise<CollectionItem> => {
    const response = await fetch(`${API_URL}/cms/collections/${collectionId}/items`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ data, status }),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create collection item');
    }
    return response.json();
};

export const updateCollectionItem = async (
    id: string,
    data: Record<string, unknown>,
    status?: CollectionItem['status']
): Promise<CollectionItem> => {
    const response = await fetch(`${API_URL}/cms/items/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ data, status }),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update collection item');
    }
    return response.json();
};

export const deleteCollectionItem = async (id: string): Promise<void> => {
    const response = await fetch(`${API_URL}/cms/items/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete collection item');
    }
};
