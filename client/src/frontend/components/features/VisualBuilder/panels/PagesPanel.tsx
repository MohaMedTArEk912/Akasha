import React, { useState } from "react";
import { useProjectStore } from "../../../../hooks/useProjectStore";
import { addPage, archivePage, selectPage, updatePage } from "../../../../stores/projectStore";
import { useToast } from "../../../../context/ToastContext";
import ConfirmModal from "../../../Modals/ConfirmModal";

const PagesPanel: React.FC = () => {
    const { project, selectedPageId } = useProjectStore();
    const toast = useToast();
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState("");
    const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

    const pages = project?.pages.filter((p) => !p.archived) || [];

    const handleAdd = async () => {
        const name = `Page ${pages.length + 1}`;
        const path = `/${name.toLowerCase().replace(/\s+/g, "-")}`;
        try {
            const page = await addPage(name, path);
            selectPage(page.id);
            toast.success(`"${name}" created`);
        } catch (err) {
            toast.error(`Failed to create page: ${err}`);
        }
    };

    const handleRenameStart = (id: string, currentName: string) => {
        setRenamingId(id);
        setRenameValue(currentName);
    };

    const handleRenameSubmit = async (id: string) => {
        const trimmed = renameValue.trim();
        if (!trimmed) {
            setRenamingId(null);
            return;
        }

        try {
            await updatePage(id, trimmed);
            toast.success("Page renamed");
        } catch (err) {
            toast.error(`Rename failed: ${err}`);
        }

        setRenamingId(null);
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;

        try {
            await archivePage(deleteTarget.id);
            toast.success(`"${deleteTarget.name}" deleted`);
        } catch (err) {
            toast.error(`Delete failed: ${err}`);
        }
        setDeleteTarget(null);
    };

    return (
        <div className="flex flex-col h-full">
            <ConfirmModal
                isOpen={!!deleteTarget}
                title="Delete Page"
                message={`Are you sure you want to delete the page "${deleteTarget?.name}"?`}
                confirmText="Delete"
                cancelText="Cancel"
                variant="danger"
                onConfirm={handleDelete}
                onCancel={() => setDeleteTarget(null)}
            />
            <div className="h-10 px-3 flex items-center justify-between border-b border-[var(--ide-border)] shrink-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ide-text-muted)]">
                    Pages ({pages.length})
                </span>
                <button
                    onClick={handleAdd}
                    className="w-6 h-6 flex items-center justify-center rounded-md text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-white/10 transition-colors font-bold text-xs"
                    title="Add Page"
                >
                    +
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
                {pages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                        <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-3">
                            <span className="font-mono text-[10px] font-black text-indigo-400 uppercase tracking-wider">EMPTY</span>
                        </div>
                        <p className="text-xs text-[var(--ide-text-muted)] mb-3">No pages yet</p>
                        <button
                            onClick={handleAdd}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white transition-colors"
                        >
                            Create First Page
                        </button>
                    </div>
                ) : (
                    pages.map((page) => {
                        const isActive = page.id === selectedPageId;
                        const isRenaming = renamingId === page.id;

                        return (
                            <div
                                key={page.id}
                                className={`group flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-all ${isActive
                                    ? "bg-indigo-500/15 border border-indigo-500/30 text-[var(--ide-text)]"
                                    : "border border-transparent text-[var(--ide-text-secondary)] hover:bg-white/5 hover:text-[var(--ide-text)]"
                                    }`}
                                onClick={() => !isRenaming && selectPage(page.id)}
                            >
                                <span className={`font-mono text-[9px] font-bold px-1 rounded shrink-0 ${isActive ? "text-indigo-400 bg-indigo-500/20" : "text-[var(--ide-text-muted)] bg-white/5"}`}>
                                    PG
                                </span>

                                {isRenaming ? (
                                    <input
                                        autoFocus
                                        value={renameValue}
                                        onChange={(e) => setRenameValue(e.target.value)}
                                        onBlur={() => void handleRenameSubmit(page.id)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") void handleRenameSubmit(page.id);
                                            if (e.key === "Escape") setRenamingId(null);
                                        }}
                                        className="flex-1 min-w-0 bg-[var(--ide-bg)] border border-indigo-500/50 rounded px-1.5 py-0.5 text-xs text-[var(--ide-text)] focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                ) : (
                                    <span className="flex-1 text-xs font-medium truncate">{page.name}</span>
                                )}

                                {!isRenaming && (
                                    <span className="text-[9px] text-[var(--ide-text-muted)] opacity-0 group-hover:opacity-100 truncate max-w-[60px] transition-opacity">
                                        {page.path}
                                    </span>
                                )}

                                {!isRenaming && (
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleRenameStart(page.id, page.name);
                                            }}
                                            className="px-1 py-0.5 rounded text-[8px] font-mono font-bold text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-white/10 transition-colors uppercase"
                                            title="Rename"
                                        >
                                            REN
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setDeleteTarget({ id: page.id, name: page.name });
                                            }}
                                            className="px-1 py-0.5 rounded text-[8px] font-mono font-bold text-[var(--ide-text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors uppercase"
                                            title="Delete"
                                        >
                                            DEL
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default PagesPanel;
