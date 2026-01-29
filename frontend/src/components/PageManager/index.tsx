import React, { useState, useEffect, useCallback } from 'react';
import {
    FileText,
    Plus,
    Copy,
    Trash2,
    Home,
    Settings,
    GripVertical,
    X,
    Check,
    ExternalLink,
} from 'lucide-react';
import {
    Page,
    getPages,
    createPage,
    updatePage,
    deletePage,
    duplicatePage,
    reorderPages,
} from '../../services/pageService';

interface PageManagerProps {
    projectId: string;
    currentPageId?: string;
    onPageSelect: (page: Page) => void;
    onPageCreate?: (page: Page) => void;
}

export const PageManager: React.FC<PageManagerProps> = ({
    projectId,
    currentPageId,
    onPageSelect,
    onPageCreate,
}) => {
    const [pages, setPages] = useState<Page[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showNewPageModal, setShowNewPageModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingPage, setEditingPage] = useState<Page | null>(null);
    const [newPageName, setNewPageName] = useState('');
    const [newPageSlug, setNewPageSlug] = useState('');
    const [draggedId, setDraggedId] = useState<string | null>(null);

    // Fetch pages
    const fetchPages = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getPages(projectId);
            setPages(data);
            setError(null);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        if (projectId) {
            fetchPages();
        }
    }, [projectId, fetchPages]);

    // Create new page
    const handleCreatePage = async () => {
        if (!newPageName.trim()) return;

        try {
            const page = await createPage(projectId, {
                name: newPageName,
                slug: newPageSlug || undefined,
            });
            setPages([...pages, page]);
            setShowNewPageModal(false);
            setNewPageName('');
            setNewPageSlug('');
            onPageCreate?.(page);
        } catch (err: any) {
            setError(err.message);
        }
    };

    // Update page
    const handleUpdatePage = async () => {
        if (!editingPage) return;

        try {
            const updated = await updatePage(projectId, editingPage._id, {
                name: editingPage.name,
                slug: editingPage.slug,
                isHome: editingPage.isHome,
                meta: editingPage.meta,
                transition: editingPage.transition,
            });
            setPages(pages.map((p) => (p._id === updated._id ? updated : p)));
            setShowEditModal(false);
            setEditingPage(null);
        } catch (err: any) {
            setError(err.message);
        }
    };

    // Delete page
    const handleDeletePage = async (pageId: string) => {
        if (!confirm('Are you sure you want to delete this page?')) return;

        try {
            await deletePage(projectId, pageId);
            setPages(pages.filter((p) => p._id !== pageId));
        } catch (err: any) {
            setError(err.message);
        }
    };

    // Duplicate page
    const handleDuplicatePage = async (pageId: string) => {
        try {
            const duplicated = await duplicatePage(projectId, pageId);
            setPages([...pages, duplicated]);
        } catch (err: any) {
            setError(err.message);
        }
    };

    // Set as home page
    const handleSetHome = async (pageId: string) => {
        try {
            const updated = await updatePage(projectId, pageId, { isHome: true });
            setPages(
                pages.map((p) =>
                    p._id === updated._id ? updated : { ...p, isHome: false }
                )
            );
        } catch (err: any) {
            setError(err.message);
        }
    };

    // Drag and drop reordering
    const handleDragStart = (pageId: string) => {
        setDraggedId(pageId);
    };

    const handleDragOver = (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        if (!draggedId || draggedId === targetId) return;

        const draggedIndex = pages.findIndex((p) => p._id === draggedId);
        const targetIndex = pages.findIndex((p) => p._id === targetId);

        if (draggedIndex === -1 || targetIndex === -1) return;

        const newPages = [...pages];
        const [removed] = newPages.splice(draggedIndex, 1);
        newPages.splice(targetIndex, 0, removed);
        setPages(newPages);
    };

    const handleDragEnd = async () => {
        if (!draggedId) return;

        const pageOrder = pages.map((p, index) => ({
            id: p._id,
            order: index,
        }));

        try {
            await reorderPages(projectId, pageOrder);
        } catch (err: any) {
            setError(err.message);
            fetchPages(); // Revert on error
        }

        setDraggedId(null);
    };

    const openEditModal = (page: Page) => {
        setEditingPage({ ...page });
        setShowEditModal(true);
    };

    if (loading && pages.length === 0) {
        return (
            <div className="p-4 text-slate-400 text-center">
                Loading pages...
            </div>
        );
    }

    return (
        <div className="p-4 text-slate-200">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <FileText size={20} />
                    Pages
                </h3>
                <button
                    onClick={() => setShowNewPageModal(true)}
                    className="p-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 transition-colors"
                    aria-label="Add new page"
                >
                    <Plus size={16} />
                </button>
            </div>

            {/* Error display */}
            {error && (
                <div className="mb-4 p-2 bg-red-500/20 text-red-300 rounded text-sm">
                    {error}
                    <button
                        onClick={() => setError(null)}
                        className="ml-2 text-red-400"
                    >
                        <X size={14} />
                    </button>
                </div>
            )}

            {/* Page list */}
            <div className="space-y-2">
                {pages.map((page) => (
                    <div
                        key={page._id}
                        draggable
                        onDragStart={() => handleDragStart(page._id)}
                        onDragOver={(e) => handleDragOver(e, page._id)}
                        onDragEnd={handleDragEnd}
                        className={`group flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-all ${page._id === currentPageId
                                ? 'bg-indigo-500/20 border border-indigo-500'
                                : 'bg-gray-700 hover:bg-gray-600'
                            } ${draggedId === page._id ? 'opacity-50' : ''}`}
                        onClick={() => onPageSelect(page)}
                    >
                        <GripVertical
                            size={16}
                            className="text-gray-500 cursor-grab active:cursor-grabbing"
                        />

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="font-medium truncate">
                                    {page.name}
                                </span>
                                {page.isHome && (
                                    <Home
                                        size={14}
                                        className="text-yellow-400"
                                        title="Home page"
                                    />
                                )}
                            </div>
                            <div className="text-xs text-gray-400 truncate">
                                /{page.slug}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    openEditModal(page);
                                }}
                                className="p-1 text-gray-400 hover:text-white"
                                title="Edit settings"
                            >
                                <Settings size={14} />
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDuplicatePage(page._id);
                                }}
                                className="p-1 text-gray-400 hover:text-white"
                                title="Duplicate"
                            >
                                <Copy size={14} />
                            </button>
                            {!page.isHome && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleSetHome(page._id);
                                    }}
                                    className="p-1 text-gray-400 hover:text-yellow-400"
                                    title="Set as home"
                                >
                                    <Home size={14} />
                                </button>
                            )}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeletePage(page._id);
                                }}
                                className="p-1 text-red-400 hover:text-red-300"
                                title="Delete"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {pages.length === 0 && !loading && (
                <div className="text-center py-8 text-gray-400">
                    <FileText size={48} className="mx-auto mb-2 opacity-50" />
                    <p>No pages yet</p>
                    <button
                        onClick={() => setShowNewPageModal(true)}
                        className="mt-2 text-indigo-400 hover:text-indigo-300"
                    >
                        Create your first page
                    </button>
                </div>
            )}

            {/* New Page Modal */}
            {showNewPageModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
                    <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-lg font-semibold">New Page</h4>
                            <button
                                onClick={() => setShowNewPageModal(false)}
                                className="text-gray-400 hover:text-white"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">
                                    Page Name *
                                </label>
                                <input
                                    type="text"
                                    value={newPageName}
                                    onChange={(e) => setNewPageName(e.target.value)}
                                    placeholder="About Us"
                                    className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">
                                    URL Slug (optional)
                                </label>
                                <div className="flex items-center gap-1">
                                    <span className="text-gray-500">/</span>
                                    <input
                                        type="text"
                                        value={newPageSlug}
                                        onChange={(e) =>
                                            setNewPageSlug(
                                                e.target.value
                                                    .toLowerCase()
                                                    .replace(/\s+/g, '-')
                                                    .replace(/[^a-z0-9-]/g, '')
                                            )
                                        }
                                        placeholder="about-us"
                                        className="flex-1 bg-gray-700 border border-gray-600 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    Auto-generated from name if left empty
                                </p>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 mt-6">
                            <button
                                onClick={() => setShowNewPageModal(false)}
                                className="px-4 py-2 text-gray-400 hover:text-white"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreatePage}
                                disabled={!newPageName.trim()}
                                className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Create Page
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Page Modal */}
            {showEditModal && editingPage && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
                    <div className="bg-gray-800 rounded-lg p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-lg font-semibold">Page Settings</h4>
                            <button
                                onClick={() => setShowEditModal(false)}
                                className="text-gray-400 hover:text-white"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Basic Info */}
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">
                                    Page Name
                                </label>
                                <input
                                    type="text"
                                    value={editingPage.name}
                                    onChange={(e) =>
                                        setEditingPage({
                                            ...editingPage,
                                            name: e.target.value,
                                        })
                                    }
                                    className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs text-slate-400 mb-1">
                                    URL Slug
                                </label>
                                <div className="flex items-center gap-1">
                                    <span className="text-gray-500">/</span>
                                    <input
                                        type="text"
                                        value={editingPage.slug}
                                        onChange={(e) =>
                                            setEditingPage({
                                                ...editingPage,
                                                slug: e.target.value
                                                    .toLowerCase()
                                                    .replace(/\s+/g, '-')
                                                    .replace(/[^a-z0-9-]/g, ''),
                                            })
                                        }
                                        className="flex-1 bg-gray-700 border border-gray-600 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                            </div>

                            {/* SEO Meta */}
                            <div className="border-t border-gray-700 pt-4">
                                <h5 className="text-sm font-medium mb-3">SEO Settings</h5>

                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs text-slate-400 mb-1">
                                            Page Title
                                        </label>
                                        <input
                                            type="text"
                                            value={editingPage.meta?.title || ''}
                                            onChange={(e) =>
                                                setEditingPage({
                                                    ...editingPage,
                                                    meta: {
                                                        ...editingPage.meta,
                                                        title: e.target.value,
                                                    },
                                                })
                                            }
                                            placeholder="Page title for SEO"
                                            className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs text-slate-400 mb-1">
                                            Meta Description
                                        </label>
                                        <textarea
                                            value={editingPage.meta?.description || ''}
                                            onChange={(e) =>
                                                setEditingPage({
                                                    ...editingPage,
                                                    meta: {
                                                        ...editingPage.meta,
                                                        description: e.target.value,
                                                    },
                                                })
                                            }
                                            placeholder="Brief description for search engines"
                                            rows={2}
                                            className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs text-slate-400 mb-1">
                                            Keywords
                                        </label>
                                        <input
                                            type="text"
                                            value={editingPage.meta?.keywords || ''}
                                            onChange={(e) =>
                                                setEditingPage({
                                                    ...editingPage,
                                                    meta: {
                                                        ...editingPage.meta,
                                                        keywords: e.target.value,
                                                    },
                                                })
                                            }
                                            placeholder="keyword1, keyword2, keyword3"
                                            className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Transition */}
                            <div className="border-t border-gray-700 pt-4">
                                <h5 className="text-sm font-medium mb-3">Page Transition</h5>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs text-slate-400 mb-1">
                                            Transition Type
                                        </label>
                                        <select
                                            value={editingPage.transition?.type || 'none'}
                                            onChange={(e) =>
                                                setEditingPage({
                                                    ...editingPage,
                                                    transition: {
                                                        ...editingPage.transition,
                                                        type: e.target.value as any,
                                                        duration:
                                                            editingPage.transition?.duration || 300,
                                                    },
                                                })
                                            }
                                            className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                        >
                                            <option value="none">None</option>
                                            <option value="fade">Fade</option>
                                            <option value="slide">Slide</option>
                                            <option value="zoom">Zoom</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs text-slate-400 mb-1">
                                            Duration (ms)
                                        </label>
                                        <input
                                            type="number"
                                            value={editingPage.transition?.duration || 300}
                                            onChange={(e) =>
                                                setEditingPage({
                                                    ...editingPage,
                                                    transition: {
                                                        type:
                                                            editingPage.transition?.type || 'none',
                                                        duration: parseInt(e.target.value) || 300,
                                                    },
                                                })
                                            }
                                            min={0}
                                            max={2000}
                                            step={50}
                                            className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 mt-6">
                            <button
                                onClick={() => setShowEditModal(false)}
                                className="px-4 py-2 text-gray-400 hover:text-white"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUpdatePage}
                                className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 flex items-center gap-2"
                            >
                                <Check size={16} />
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PageManager;
