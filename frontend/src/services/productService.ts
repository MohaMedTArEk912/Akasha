const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export interface Product {
    _id: string;
    projectId: string;
    name: string;
    description?: string;
    price: number;
    currency: string;
    image?: string;
    status: 'draft' | 'active';
    createdAt: string;
    updatedAt: string;
}

export interface CreateProductDto {
    name: string;
    description?: string;
    price: number;
    currency?: string;
    image?: string;
    status?: Product['status'];
}

export interface UpdateProductDto extends Partial<CreateProductDto> {}

const getAuthHeaders = (): HeadersInit => {
    const userStr = localStorage.getItem('grapes_user');
    const user = userStr ? JSON.parse(userStr) : null;
    const token = user?.token;

    return {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
};

export const getProducts = async (projectId: string): Promise<Product[]> => {
    const response = await fetch(`${API_URL}/products/${projectId}`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch products');
    }
    return response.json();
};

export const createProduct = async (projectId: string, data: CreateProductDto): Promise<Product> => {
    const response = await fetch(`${API_URL}/products/${projectId}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create product');
    }
    return response.json();
};

export const updateProduct = async (
    projectId: string,
    productId: string,
    data: UpdateProductDto
): Promise<Product> => {
    const response = await fetch(`${API_URL}/products/${projectId}/${productId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update product');
    }
    return response.json();
};

export const deleteProduct = async (projectId: string, productId: string): Promise<void> => {
    const response = await fetch(`${API_URL}/products/${projectId}/${productId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete product');
    }
};
