import React, { useCallback, useEffect, useState } from 'react';
import { Database, Plus, Trash2, X, Pencil } from 'lucide-react';
import {
    Collection,
    createCollection,
    deleteCollection,
    getCollections,
    updateCollection,
    CollectionItem,
    getCollectionItems,
    createCollectionItem,
    updateCollectionItem,
    deleteCollectionItem,
} from '../../services/cmsService';

const getErrorMessage = (err: unknown, fallback: string) => {
    if (err instanceof Error) return err.message;
    return fallback;
};

export const DataModelPanel: React.FC = () => {
    const [collections, setCollections] = useState<Collection[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [showEdit, setShowEdit] = useState(false);
    const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [fieldName, setFieldName] = useState('');
    const [fieldType, setFieldType] = useState<Collection['fields'][number]['type']>('text');
    const [fieldRequired, setFieldRequired] = useState(false);
    const [fieldDefault, setFieldDefault] = useState('');
    const [showItems, setShowItems] = useState(false);
    const [itemsCollection, setItemsCollection] = useState<Collection | null>(null);
    const [items, setItems] = useState<CollectionItem[]>([]);
    const [itemData, setItemData] = useState('{}');
    const [itemStatus, setItemStatus] = useState<CollectionItem['status']>('draft');

    const loadCollections = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getCollections();
            setCollections(data);
            setError(null);
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to load collections'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadCollections();
    }, [loadCollections]);

    const handleCreate = async () => {
        if (!name.trim()) return;
        try {
            const created = await createCollection({ name: name.trim(), description: description.trim() || undefined });
            setCollections([created, ...collections]);
            setName('');
            setDescription('');
            setShowCreate(false);
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to create collection'));
        }
    };

    const openEdit = (collection: Collection) => {
        setEditingCollection({ ...collection });
        setShowEdit(true);
    };

    const handleAddField = () => {
        if (!editingCollection || !fieldName.trim()) return;
        const next = {
            name: fieldName.trim(),
            type: fieldType,
            required: fieldRequired,
            defaultValue: fieldDefault || undefined,
        };
        setEditingCollection({
            ...editingCollection,
            fields: [...(editingCollection.fields || []), next],
        });
        setFieldName('');
        setFieldDefault('');
        setFieldRequired(false);
        setFieldType('text');
    };

    const handleRemoveField = (index: number) => {
        if (!editingCollection) return;
        const nextFields = editingCollection.fields.filter((_, i) => i !== index);
        setEditingCollection({
            ...editingCollection,
            fields: nextFields,
        });
    };

    const handleSaveCollection = async () => {
        if (!editingCollection) return;
        try {
            const updated = await updateCollection(editingCollection._id, {
                name: editingCollection.name,
                description: editingCollection.description,
                fields: editingCollection.fields,
            });
            setCollections(collections.map((c) => (c._id === updated._id ? updated : c)));
            setShowEdit(false);
            setEditingCollection(null);
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to update collection'));
        }
    };

    const openItems = async (collection: Collection) => {
        setItemsCollection(collection);
        setShowItems(true);
        try {
            const data = await getCollectionItems(collection._id);
            setItems(data);
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to load items'));
        }
    };

    const handleCreateItem = async () => {
        if (!itemsCollection) return;
        try {
            const parsed = JSON.parse(itemData || '{}');
            const created = await createCollectionItem(itemsCollection._id, parsed, itemStatus);
            setItems([created, ...items]);
            setItemData('{}');
            setItemStatus('draft');
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to create item'));
        }
    };

    const handleUpdateItem = async (item: CollectionItem) => {
        try {
            const updated = await updateCollectionItem(item._id, item.data, item.status);
            setItems(items.map((i) => (i._id === updated._id ? updated : i)));
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to update item'));
        }
    };

    const handleDeleteItem = async (id: string) => {
        if (!confirm('Delete this item?')) return;
        try {
            await deleteCollectionItem(id);
            setItems(items.filter((i) => i._id !== id));
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to delete item'));
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this collection and all items?')) return;
        try {
            await deleteCollection(id);
            setCollections(collections.filter((c) => c._id !== id));
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to delete collection'));
        }
    };

    return (
        <div className="p-4 text-slate-200">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Database size={18} />
                    Data Models
                </h3>
                <button
                    onClick={() => setShowCreate(true)}
                    className="p-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 transition-colors"
                    aria-label="Add collection"
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

            {loading && collections.length === 0 && (
                <div className="text-slate-400 text-sm">Loading collections...</div>
            )}

            {!loading && collections.length === 0 && (
                <div className="text-slate-400 text-sm">No collections yet.</div>
            )}

            <div className="space-y-2">
                {collections.map((collection) => (
                    <div
                        key={collection._id}
                        className="flex items-center justify-between p-3 rounded-lg bg-[#141428] border border-[#2a2a4a]"
                    >
                        <div className="min-w-0">
                            <div className="font-medium truncate">{collection.name}</div>
                            {collection.description && (
                                <div className="text-xs text-slate-400 truncate">{collection.description}</div>
                            )}
                            <div className="text-xs text-slate-500 mt-1">
                                Fields: {collection.fields?.length || 0}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => openEdit(collection)}
                                className="text-slate-400 hover:text-white p-1"
                                title="Edit fields"
                            >
                                <Pencil size={16} />
                            </button>
                            <button
                                onClick={() => openItems(collection)}
                                className="text-slate-400 hover:text-white p-1"
                                title="Manage items"
                            >
                                <Database size={16} />
                            </button>
                            <button
                                onClick={() => handleDelete(collection._id)}
                                className="text-red-400 hover:text-red-300 p-1"
                                title="Delete"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {showCreate && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60">
                    <div className="w-full max-w-md bg-[#101020] border border-[#2a2a4a] rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold">New Collection</h4>
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
                                    placeholder="Blog Posts"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Description</label>
                                <input
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="w-full bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1 text-sm text-white"
                                    placeholder="Optional"
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

            {showEdit && editingCollection && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60">
                    <div className="w-full max-w-xl bg-[#101020] border border-[#2a2a4a] rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold">Edit Collection</h4>
                            <button onClick={() => setShowEdit(false)} className="text-slate-400 hover:text-white">
                                <X size={16} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="grid grid-cols-1 gap-3">
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Name</label>
                                    <input
                                        value={editingCollection.name}
                                        onChange={(e) => setEditingCollection({ ...editingCollection, name: e.target.value })}
                                        className="w-full bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1 text-sm text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Description</label>
                                    <input
                                        value={editingCollection.description || ''}
                                        onChange={(e) => setEditingCollection({ ...editingCollection, description: e.target.value })}
                                        className="w-full bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1 text-sm text-white"
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="text-xs text-slate-400 mb-2">Fields</div>
                                <div className="space-y-2">
                                    {(editingCollection.fields || []).map((field, index) => (
                                        <div key={`${field.name}-${index}`} className="flex items-center justify-between bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1">
                                            <div className="text-sm text-slate-200">
                                                {field.name} · {field.type}{field.required ? ' *' : ''}
                                            </div>
                                            <button
                                                onClick={() => handleRemoveField(index)}
                                                className="text-red-400 hover:text-red-300"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-3">
                                    <div className="text-[11px] text-slate-500 mb-1">Schema preview</div>
                                    <pre className="text-[11px] bg-[#0a0a1a] border border-[#2a2a4a] rounded p-2 overflow-auto max-h-40 text-slate-300">
{JSON.stringify(
    (editingCollection.fields || []).reduce<Record<string, unknown>>((acc, field) => {
        acc[field.name] = {
            type: field.type,
            required: field.required || false,
            default: field.defaultValue ?? undefined,
        };
        return acc;
    }, {}),
    null,
    2
)}
                                    </pre>
                                </div>
                            </div>

                            <div className="border-t border-[#2a2a4a] pt-3">
                                <div className="text-xs text-slate-400 mb-2">Add Field</div>
                                <div className="grid grid-cols-2 gap-2">
                                    <input
                                        value={fieldName}
                                        onChange={(e) => setFieldName(e.target.value)}
                                        className="bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1 text-sm text-white"
                                        placeholder="Field name"
                                    />
                                    <select
                                        value={fieldType}
                                        onChange={(e) => setFieldType(e.target.value as Collection['fields'][number]['type'])}
                                        className="bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1 text-sm text-white"
                                    >
                                        <option value="text">Text</option>
                                        <option value="richtext">Rich Text</option>
                                        <option value="number">Number</option>
                                        <option value="boolean">Boolean</option>
                                        <option value="date">Date</option>
                                        <option value="image">Image</option>
                                        <option value="reference">Reference</option>
                                    </select>
                                    <input
                                        value={fieldDefault}
                                        onChange={(e) => setFieldDefault(e.target.value)}
                                        className="bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1 text-sm text-white"
                                        placeholder="Default value"
                                    />
                                    <label className="flex items-center gap-2 text-xs text-slate-300">
                                        <input
                                            type="checkbox"
                                            checked={fieldRequired}
                                            onChange={(e) => setFieldRequired(e.target.checked)}
                                        />
                                        Required
                                    </label>
                                </div>
                                <div className="flex justify-end mt-2">
                                    <button
                                        onClick={handleAddField}
                                        className="px-3 py-1 text-xs bg-indigo-500 text-white rounded hover:bg-indigo-600"
                                    >
                                        Add Field
                                    </button>
                                </div>
                            </div>

                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => setShowEdit(false)}
                                    className="px-3 py-1 text-xs text-slate-400 hover:text-white"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveCollection}
                                    className="px-3 py-1 text-xs bg-indigo-500 text-white rounded hover:bg-indigo-600"
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showItems && itemsCollection && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60">
                    <div className="w-full max-w-2xl bg-[#101020] border border-[#2a2a4a] rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold">Items · {itemsCollection.name}</h4>
                            <button onClick={() => setShowItems(false)} className="text-slate-400 hover:text-white">
                                <X size={16} />
                            </button>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <div className="text-xs text-slate-400 mb-1">New item (JSON)</div>
                                <textarea
                                    value={itemData}
                                    onChange={(e) => setItemData(e.target.value)}
                                    className="w-full bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1 text-xs text-white h-24"
                                />
                                <div className="flex items-center justify-between mt-2">
                                    <select
                                        value={itemStatus}
                                        onChange={(e) => setItemStatus(e.target.value as CollectionItem['status'])}
                                        className="bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1 text-xs text-white"
                                    >
                                        <option value="draft">Draft</option>
                                        <option value="published">Published</option>
                                    </select>
                                    <button
                                        onClick={handleCreateItem}
                                        className="px-3 py-1 text-xs bg-indigo-500 text-white rounded hover:bg-indigo-600"
                                    >
                                        Create Item
                                    </button>
                                </div>
                            </div>

                            <div className="border-t border-[#2a2a4a] pt-3 space-y-2 max-h-64 overflow-auto">
                                {items.length === 0 && (
                                    <div className="text-xs text-slate-400">No items yet.</div>
                                )}
                                {items.map((item) => (
                                    <div key={item._id} className="bg-[#0a0a1a] border border-[#2a2a4a] rounded p-2">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs text-slate-400">{new Date(item.createdAt).toLocaleString()}</span>
                                            <div className="flex items-center gap-2">
                                                <select
                                                    value={item.status}
                                                    onChange={(e) => {
                                                        const next = e.target.value as CollectionItem['status'];
                                                        const updated = { ...item, status: next };
                                                        setItems(items.map((i) => (i._id === item._id ? updated : i)));
                                                    }}
                                                    className="bg-[#101020] border border-[#2a2a4a] rounded px-2 py-1 text-[11px] text-white"
                                                >
                                                    <option value="draft">Draft</option>
                                                    <option value="published">Published</option>
                                                </select>
                                                <button
                                                    onClick={() => handleUpdateItem(item)}
                                                    className="text-xs text-slate-300 hover:text-white"
                                                >
                                                    Save
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteItem(item._id)}
                                                    className="text-xs text-red-400 hover:text-red-300"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                        <pre className="text-[11px] text-slate-300 overflow-auto">
{JSON.stringify(item.data, null, 2)}
                                        </pre>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
