const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export interface SymbolData {
    _id?: string;
    name: string;
    description?: string;
    content: any;
    styles: string;
    thumbnail?: string;
    updatedAt?: string;
}

const getConfig = () => {
    const user = JSON.parse(localStorage.getItem('grapes_user') || 'null');
    return {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': user?.token ? `Bearer ${user.token}` : '',
        }
    };
};

export const SymbolService = {
    async getAllSymbols(): Promise<SymbolData[]> {
        const response = await fetch(`${API_URL}/symbols`, getConfig());
        if (!response.ok) throw new Error('Failed to fetch symbols');
        return response.json();
    },

    async getSymbolById(id: string): Promise<SymbolData> {
        const response = await fetch(`${API_URL}/symbols/${id}`, getConfig());
        if (!response.ok) throw new Error('Failed to fetch symbol');
        return response.json();
    },

    async saveSymbol(data: SymbolData): Promise<SymbolData> {
        const response = await fetch(`${API_URL}/symbols`, {
            method: 'POST',
            ...getConfig(),
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to save symbol');
        return response.json();
    },

    async updateSymbol(id: string, data: Partial<SymbolData>): Promise<SymbolData> {
        const response = await fetch(`${API_URL}/symbols/${id}`, {
            method: 'PUT',
            ...getConfig(),
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to update symbol');
        return response.json();
    },

    async deleteSymbol(id: string): Promise<void> {
        const response = await fetch(`${API_URL}/symbols/${id}`, {
            method: 'DELETE',
            ...getConfig(),
        });
        if (!response.ok) throw new Error('Failed to delete symbol');
    }
};
