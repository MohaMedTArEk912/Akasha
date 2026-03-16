import React, { useMemo, useState } from "react";
import { useProjectStore } from "../../../hooks/useProjectStore";
import { addPage, archivePage, selectPage, updatePage } from "../../../stores/projectStore";
import { useToast } from "../../../context/ToastContext";
import { FileEdit, Trash2, LayoutTemplate, Layers, Check, X } from "lucide-react";

interface PagesListProps {
    onOpenBuilder: () => void;
}

function slugify(input: string): string {
    return input
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "page";
}

const PagesList: React.FC<PagesListProps> = ({ onOpenBuilder }) => {
    const { project } = useProjectStore();
    const toast = useToast();
    const [search, setSearch] = useState("");

    const [editingPageId, setEditingPageId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState("");
    const [deletingPageId, setDeletingPageId] = useState<string | null>(null);

    const pages = useMemo(() => project?.pages.filter((p) => !p.archived) ?? [], [project]);

    const filteredPages = useMemo(() => {
        if (!search.trim()) return pages;
        const query = search.toLowerCase();
        return pages.filter((page) => page.name.toLowerCase().includes(query) || page.path.toLowerCase().includes(query));
    }, [pages, search]);

    const handleCreateBlankPage = async () => {
        const index = pages.length + 1;
        const name = `Page ${index}`;
        try {
            const page = await addPage(name, `/${slugify(name)}`);
            selectPage(page.id);
            toast.success(`Created ${name}.`);
        } catch {
            toast.error("Could not create page.");
        }
    };

    const handleDeletePage = async (id: string, name: string) => {
        try {
            await archivePage(id);
            toast.success(`${name} deleted.`);
            setDeletingPageId(null);
        } catch {
            toast.error("Could not delete page.");
        }
    };

    const startEditing = (id: string, currentName: string) => {
        setEditingPageId(id);
        setEditingName(currentName);
    };

    const cancelEditing = () => {
        setEditingPageId(null);
        setEditingName("");
    };

    const handleRenamePage = async (id: string) => {
        if (!editingName.trim()) {
            cancelEditing();
            return;
        }
        try {
            const path = `/${slugify(editingName)}`;
            await updatePage(id, editingName, path);
            toast.success("Page renamed successfully.");
            setEditingPageId(null);
        } catch (error) {
            toast.error("Failed to rename page.");
        }
    };

    return (
        <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-between gap-3 mb-5">
                    <div className="relative w-64 max-w-full">
                        <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search pages"
                            className="h-9 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-white/80 placeholder:text-white/30 focus:outline-none focus:border-cyan-400/40"
                        />
                    </div>
                    <button
                        onClick={handleCreateBlankPage}
                        className="h-9 px-4 rounded-lg border border-white/15 bg-white/[0.03] text-sm font-semibold text-white/80 hover:bg-white/[0.08] flex items-center gap-2"
                    >
                        <Layers className="size-4" />
                        New Page
                    </button>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {filteredPages.map((page) => {
                        const isEditing = editingPageId === page.id;
                        
                        return (
                            <article
                                key={page.id}
                                className="group rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] p-3 hover:border-cyan-400/40 transition-all flex flex-col items-stretch overflow-hidden shadow-sm"
                            >
                                {/* Preview Thumbnail Area */}
                                <div 
                                    className="relative w-full aspect-video rounded-lg bg-black/40 border border-white/5 overflow-hidden mb-3 cursor-pointer"
                                    onClick={() => {
                                        selectPage(page.id);
                                        onOpenBuilder();
                                    }}
                                >
                                    <div className="absolute inset-0 flex items-center justify-center opacity-40 group-hover:opacity-60 transition-opacity bg-gradient-to-br from-cyan-900/10 to-blue-900/10">
                                        <LayoutTemplate className="w-10 h-10 text-cyan-400/30" strokeWidth={1.5} />
                                    </div>
                                    <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
                                </div>

                                {/* Details & Actions Area */}
                                <div className="flex items-center justify-between gap-2 px-1 pb-1">
                                    {isEditing ? (
                                        <div className="flex-1 flex items-center gap-1.5 min-w-0">
                                            <input
                                                autoFocus
                                                value={editingName}
                                                onChange={(e) => setEditingName(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") handleRenamePage(page.id);
                                                    if (e.key === "Escape") cancelEditing();
                                                }}
                                                className="h-7 flex-1 w-full rounded border border-cyan-500/50 bg-black/40 px-2 text-[13px] text-white focus:outline-none"
                                            />
                                            <button 
                                                onClick={() => handleRenamePage(page.id)}
                                                className="p-1.5 rounded-md hover:bg-green-500/20 text-green-400/70 hover:text-green-400 transition-colors"
                                            >
                                                <Check className="size-3.5" />
                                            </button>
                                            <button 
                                                onClick={cancelEditing}
                                                className="p-1.5 rounded-md hover:bg-white/10 text-white/40 hover:text-white/80 transition-colors"
                                            >
                                                <X className="size-3.5" />
                                            </button>
                                        </div>
                                    ) : deletingPageId === page.id ? (
                                        <div className="flex-1 flex items-center justify-between min-w-0 bg-red-500/10 rounded px-2 py-0.5 border border-red-500/20">
                                            <span className="text-[12px] text-red-400 font-medium truncate pr-2" title={`Delete ${page.name}?`}>Delete?</span>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <button 
                                                    onClick={() => handleDeletePage(page.id, page.name)}
                                                    className="p-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/40 transition-colors"
                                                    title="Confirm"
                                                >
                                                    <Check className="size-3.5" />
                                                </button>
                                                <button 
                                                    onClick={() => setDeletingPageId(null)}
                                                    className="p-1 rounded bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80 transition-colors"
                                                    title="Cancel"
                                                >
                                                    <X className="size-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex-1 min-w-0 pr-2">
                                                <h2 className="text-[14px] font-semibold text-white/90 truncate" title={page.name}>
                                                    {page.name}
                                                </h2>
                                                <p className="text-[11px] text-emerald-300/60 truncate mt-0.5">
                                                    {page.path}
                                                </p>
                                            </div>
                                            
                                            <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => startEditing(page.id, page.name)}
                                                    className="p-1.5 rounded-md text-white/40 hover:text-cyan-300 hover:bg-cyan-500/10 transition-colors"
                                                    title="Rename Page"
                                                >
                                                    <FileEdit className="size-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => setDeletingPageId(page.id)}
                                                    className="p-1.5 rounded-md text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                                    title="Delete Page"
                                                >
                                                    <Trash2 className="size-3.5" />
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </article>
                        );
                    })}
                </div>
                
                {filteredPages.length === 0 && (
                    <div className="rounded-xl border border-dashed border-white/15 p-12 flex flex-col items-center justify-center text-center mt-4 bg-white/[0.01]">
                        <LayoutTemplate className="w-12 h-12 text-white/20 mb-3" />
                        <h3 className="text-sm font-semibold text-white/70">No pages found</h3>
                        <p className="text-xs text-white/40 mt-1">Create a new page to get started with the visual builder.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PagesList;
