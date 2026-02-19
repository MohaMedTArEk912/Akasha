import React, { useState } from "react";
import { useProjectStore } from "../../hooks/useProjectStore";
import {
    selectPage,
    setActivePage,
    createPage,
    updatePage,
    archivePage
} from "../../stores/projectStore";
import { useToast } from "../../context/ToastContext";
import ConfirmModal from "../Modals/ConfirmModal";

interface SidebarSectionProps {
    title: string;
    children: React.ReactNode;
    defaultExpanded?: boolean;
    /** Optional action button (e.g., add page) */
    actionButton?: React.ReactNode;
}

/**
 * Collapsible sidebar section with optional header action button.
 * @param title - Section title
 * @param children - Section content
 * @param defaultExpanded - Initial expand state
 * @param actionButton - Optional button in header (e.g., "+" for add)
 */
export const SidebarSection: React.FC<SidebarSectionProps> = ({
    title,
    children,
    defaultExpanded = true,
    actionButton,
}) => {
    const [expanded, setExpanded] = useState(defaultExpanded);

    return (
        <div className="flex flex-col h-full">
            <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-2 px-3 py-1.5 bg-[var(--ide-chrome)] hover:bg-[var(--ide-bg-hover)] transition-colors text-[10px] font-black uppercase tracking-widest text-[var(--ide-text-muted)] border-b border-[var(--ide-border)]/30 flex-shrink-0"
            >
                <svg
                    className={`w-3 h-3 transition-transform ${expanded ? "rotate-90" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" />
                </svg>
                <span className="flex-1 text-left">{title}</span>
                {actionButton && (
                    <span onClick={(e) => e.stopPropagation()}>
                        {actionButton}
                    </span>
                )}
            </button>
            {expanded && <div className="flex-1 min-h-0 overflow-hidden animate-fade-in">{children}</div>}
        </div>
    );
};

/**
 * Pages list component with full CRUD functionality.
 * - Create new pages
 * - Rename pages inline
 * - Delete pages with confirmation
 * - Display page route
 */
export const PagesList: React.FC = () => {
    const { project, selectedPageId } = useProjectStore();
    const toast = useToast();

    // UI State
    const [isCreating, setIsCreating] = useState(false);
    const [editingPageId, setEditingPageId] = useState<string | null>(null);
    const [editName, setEditName] = useState("");
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    if (!project || !project.pages) return null;

    // Filter out archived pages
    const pages = project.pages.filter(p => !p.archived);

    /**
     * Handle page selection - switches to visual mode
     * @param id - Page ID to select
     */
    const handlePageClick = (id: string) => {
        selectPage(id);
        setActivePage("ui");
    };

    /**
     * Create a new page with default name
     */
    const handleCreatePage = async () => {
        setIsCreating(true);
        try {
            await createPage("New Page");
            toast.success("Page created");
        } catch {
            toast.error("Failed to create page");
        } finally {
            setIsCreating(false);
        }
    };

    /**
     * Start editing a page name
     * @param pageId - ID of page to edit
     * @param currentName - Current name for input default
     */
    const startEditing = (pageId: string, currentName: string) => {
        setEditingPageId(pageId);
        setEditName(currentName);
    };

    /**
     * Finish editing and save the new name
     */
    const finishEditing = async () => {
        if (editingPageId && editName.trim()) {
            await updatePage(editingPageId, editName.trim());
        }
        setEditingPageId(null);
    };

    /**
     * Confirm and execute page deletion
     */
    const confirmDelete = async () => {
        if (!pendingDeleteId) return;
        setIsDeleting(true);
        try {
            await archivePage(pendingDeleteId);
            toast.success("Page deleted");
            setPendingDeleteId(null);
        } catch {
            toast.error("Failed to delete page");
        } finally {
            setIsDeleting(false);
        }
    };

    // Get name for deletion modal
    const pendingPageName = pages.find(p => p.id === pendingDeleteId)?.name || "this page";

    return (
        <>
            <div className="py-1">
                {/* Add Page Button as Section Action */}
                {pages.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                        <p className="text-[10px] text-[var(--ide-text-muted)] uppercase tracking-wider mb-3">No pages yet</p>
                        <button
                            onClick={handleCreatePage}
                            disabled={isCreating}
                            className="px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-xs font-semibold rounded-lg transition-colors"
                        >
                            {isCreating ? "Creating..." : "+ Create First Page"}
                        </button>
                    </div>
                ) : (
                    pages.map((page) => (
                        <div
                            key={page.id}
                            className={`group w-full flex items-center gap-2.5 px-4 py-2 transition-all cursor-pointer ${selectedPageId === page.id
                                ? "bg-indigo-500/10 border-r-2 border-indigo-500"
                                : "hover:bg-[var(--ide-text)]/5"
                                }`}
                            onClick={() => handlePageClick(page.id)}
                        >
                            {/* Page Icon */}
                            <svg
                                className={`w-4 h-4 shrink-0 ${selectedPageId === page.id
                                    ? "text-indigo-500"
                                    : "text-[var(--ide-text-muted)] group-hover:text-[var(--ide-text)]"
                                    }`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="1.5"
                                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                />
                            </svg>

                            {/* Page Name / Edit Input */}
                            <div className="flex-1 min-w-0">
                                {editingPageId === page.id ? (
                                    <input
                                        autoFocus
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        onBlur={finishEditing}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") finishEditing();
                                            if (e.key === "Escape") setEditingPageId(null);
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        className="w-full bg-transparent text-xs font-semibold text-[var(--ide-text)] border-none focus:outline-none focus:ring-0 p-0"
                                        aria-label="Edit page name"
                                    />
                                ) : (
                                    <>
                                        <div
                                            className={`text-[13px] font-semibold truncate ${selectedPageId === page.id
                                                ? "text-indigo-400"
                                                : "text-[var(--ide-text-muted)] group-hover:text-[var(--ide-text)]"
                                                }`}
                                        >
                                            {page.name}
                                        </div>
                                        <div className="text-[9px] text-[var(--ide-text-muted)] truncate font-mono opacity-50">
                                            {page.path}
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Action Buttons (Edit/Delete) */}
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                {/* Rename Button */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        startEditing(page.id, page.name);
                                    }}
                                    className="p-1 hover:bg-white/10 rounded text-[var(--ide-text-secondary)] hover:text-indigo-400 transition-colors"
                                    title="Rename page"
                                    aria-label="Rename page"
                                >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth="2"
                                            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                                        />
                                    </svg>
                                </button>

                                {/* Delete Button */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setPendingDeleteId(page.id);
                                    }}
                                    className="p-1 hover:bg-red-500/10 rounded text-red-500/40 hover:text-red-500 transition-colors"
                                    title="Delete page"
                                    aria-label="Delete page"
                                >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth="2"
                                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                        />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Delete Confirmation Modal */}
            <ConfirmModal
                isOpen={pendingDeleteId !== null}
                title="Delete Page"
                message={`Delete "${pendingPageName}" permanently? This cannot be undone.`}
                confirmText="Delete"
                variant="danger"
                isLoading={isDeleting}
                onConfirm={confirmDelete}
                onCancel={() => !isDeleting && setPendingDeleteId(null)}
            />
        </>
    );
};

/**
 * Add Page Button - for use in SidebarSection actionButton prop
 */
export const AddPageButton: React.FC = () => {
    const [isCreating, setIsCreating] = useState(false);
    const toast = useToast();

    const handleCreate = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsCreating(true);
        try {
            await createPage("New Page");
            toast.success("Page created");
        } catch {
            toast.error("Failed to create page");
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <span
            onClick={handleCreate}
            className="p-0.5 hover:bg-indigo-500/20 rounded text-indigo-400 transition-colors cursor-pointer inline-flex items-center"
            title="Add new page"
            aria-label="Add new page"
        >
            <svg
                className={`w-3.5 h-3.5 ${isCreating ? "animate-spin" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
            >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
            </svg>
        </span>
    );
};
