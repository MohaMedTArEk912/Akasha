import React, { useCallback, useEffect, useState } from 'react';
import { Package, Plus, Trash2, X } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { createProduct, deleteProduct, getProducts, Product } from '../../services/productService';

const getErrorMessage = (err: unknown, fallback: string) => {
    if (err instanceof Error) return err.message;
    return fallback;
};

export const EcommercePanel: React.FC = () => {
    const { currentProject } = useProject();
    const projectId = currentProject?._id || '';

    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [name, setName] = useState('');
    const [price, setPrice] = useState('');
    const [currency, setCurrency] = useState('USD');
    const [description, setDescription] = useState('');

    const loadProducts = useCallback(async () => {
        if (!projectId) return;
        try {
            setLoading(true);
            const data = await getProducts(projectId);
            setProducts(data);
            setError(null);
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to load products'));
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        loadProducts();
    }, [loadProducts]);

    const handleCreate = async () => {
        if (!projectId || !name.trim() || !price) return;
        try {
            const created = await createProduct(projectId, {
                name: name.trim(),
                price: Number(price),
                currency,
                description: description.trim() || undefined,
                status: 'active',
            });
            setProducts([created, ...products]);
            setShowCreate(false);
            setName('');
            setPrice('');
            setDescription('');
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to create product'));
        }
    };

    const handleDelete = async (productId: string) => {
        if (!confirm('Delete this product?')) return;
        try {
            await deleteProduct(projectId, productId);
            setProducts(products.filter((p) => p._id !== productId));
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to delete product'));
        }
    };

    if (!projectId) {
        return <div className="p-4 text-slate-400 text-sm">Select a project to manage products.</div>;
    }

    return (
        <div className="p-4 text-slate-200">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Package size={18} />
                    Products
                </h3>
                <button
                    onClick={() => setShowCreate(true)}
                    className="p-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 transition-colors"
                    aria-label="Add product"
                >
                    <Plus size={16} />
                </button>
            </div>

            {error && (
                <div className="mb-3 p-2 bg-red-500/20 text-red-300 rounded text-sm flex items-center justify-between">
                    <span>{error}</span>
                    <button onClick={() => setError(null)} className="text-red-300">
                        <X size={14} />
                    </button>
                </div>
            )}

            {loading && products.length === 0 && (
                <div className="text-slate-400 text-sm">Loading products...</div>
            )}

            {!loading && products.length === 0 && (
                <div className="text-slate-400 text-sm">No products yet.</div>
            )}

            <div className="space-y-2">
                {products.map((product) => (
                    <div
                        key={product._id}
                        className="flex items-center justify-between p-3 rounded-lg bg-[#141428] border border-[#2a2a4a]"
                    >
                        <div className="min-w-0">
                            <div className="font-medium truncate">{product.name}</div>
                            <div className="text-xs text-slate-400 truncate">
                                {product.currency} {product.price}
                            </div>
                        </div>
                        <button
                            onClick={() => handleDelete(product._id)}
                            className="text-red-400 hover:text-red-300 p-1"
                            title="Delete"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                ))}
            </div>

            {showCreate && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60">
                    <div className="w-full max-w-md bg-[#101020] border border-[#2a2a4a] rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold">New Product</h4>
                            <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-white">
                                <X size={16} />
                            </button>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Name</label>
                                <input
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1 text-sm text-white"
                                    placeholder="Product name"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Price</label>
                                <input
                                    value={price}
                                    onChange={(e) => setPrice(e.target.value)}
                                    className="w-full bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1 text-sm text-white"
                                    placeholder="99.00"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Currency</label>
                                <input
                                    value={currency}
                                    onChange={(e) => setCurrency(e.target.value)}
                                    className="w-full bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1 text-sm text-white"
                                    placeholder="USD"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Description</label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="w-full bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1 text-xs text-white h-16"
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => setShowCreate(false)}
                                    className="px-3 py-1 text-xs text-slate-400 hover:text-white"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreate}
                                    className="px-3 py-1 text-xs bg-indigo-500 text-white rounded hover:bg-indigo-600"
                                >
                                    Create
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
