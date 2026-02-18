/**
 * Toolbar – VS Code-style tab bar for pages
 *
 * Each open page gets a closeable tab.  Middle-click to close.
 * Right-click for context menu (Close, Close Others, Close All, Reopen).
 * "+" button creates a new page.
 */

import React, { useState, useRef, useEffect } from "react";
import { useProjectStore } from "../../hooks/useProjectStore";
import {
    createPage,
    selectPage,
    closePageTab,
    closeOtherPageTabs,
} from "../../stores/projectStore";
import PromptModal from "../UI/PromptModal";
import { useToast } from "../../context/ToastContext";

/* ─── Page icon ─────────────────────────────────────── */
const PageIcon: React.FC<{ className?: string }> = ({ className = "w-3.5 h-3.5" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
    </svg>
);

/* ─── Context menu ──────────────────────────────────── */
interface ContextMenuState {
    x: number;
    y: number;
    pageId: string;
}

const Toolbar: React.FC = () => {
    const { project, selectedPageId, openPageIds } = useProjectStore();
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [ctx, setCtx] = useState<ContextMenuState | null>(null);
    const ctxRef = useRef<HTMLDivElement>(null);
    const toast = useToast();

    const pages = project?.pages.filter(p => !p.archived) ?? [];
    // Only show tabs that are in openPageIds, preserving tab order
    const openPages = openPageIds
        .map(id => pages.find(p => p.id === id))
        .filter(Boolean) as typeof pages;


    /* ── Close context menu on outside click ── */
    useEffect(() => {
        if (!ctx) return;
        const close = (e: MouseEvent) => {
            if (ctxRef.current && !ctxRef.current.contains(e.target as Node)) setCtx(null);
        };
        document.addEventListener("mousedown", close);
        return () => document.removeEventListener("mousedown", close);
    }, [ctx]);

    /* ── Handlers ── */
    const handleCreate = () => setCreateModalOpen(true);

    const submitCreate = async (values: Record<string, string>) => {
        const name = values.pageName?.trim();
        if (!name) return;
        try {
            await createPage(name);
            toast.success(`Page "${name}" created`);
        } catch (err) {
            toast.error(`Failed to create page: ${err}`);
        }
    };

    const handleMiddleClick = (e: React.MouseEvent, pageId: string) => {
        if (e.button === 1) {
            e.preventDefault();
            closePageTab(pageId);
        }
    };

    const handleContextMenu = (e: React.MouseEvent, pageId: string) => {
        e.preventDefault();
        setCtx({ x: e.clientX, y: e.clientY, pageId });
    };

    return (
        <>
            <div className="w-full h-full flex items-center bg-[var(--ide-chrome)]">
                {/* ── Page tabs ── */}
                <div className="flex items-center h-full overflow-x-auto scrollbar-none">
                    {openPages.map(page => {
                        const active = page.id === selectedPageId;
                        return (
                            <div
                                key={page.id}
                                className={[
                                    "group h-full flex items-center gap-1.5 pl-3 pr-1 text-xs font-medium border-r border-[var(--ide-border)] transition-colors whitespace-nowrap select-none cursor-pointer",
                                    active
                                        ? "bg-[var(--ide-bg)] text-[var(--ide-text)] border-b-2 border-b-[var(--ide-primary)]"
                                        : "text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-bg-elevated)]",
                                ].join(" ")}
                                onClick={() => selectPage(page.id)}
                                onMouseDown={(e) => handleMiddleClick(e, page.id)}
                                onContextMenu={(e) => handleContextMenu(e, page.id)}
                            >
                                <PageIcon className="w-3.5 h-3.5 opacity-50 shrink-0" />
                                <span className="max-w-[120px] truncate">{page.name}</span>

                                {/* Close button */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        closePageTab(page.id);
                                    }}
                                    className={[
                                        "w-5 h-5 ml-1 rounded flex items-center justify-center transition-all shrink-0",
                                        active
                                            ? "opacity-60 hover:opacity-100 hover:bg-[var(--ide-text)]/10"
                                            : "opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:bg-[var(--ide-text)]/10",
                                    ].join(" ")}
                                    title="Close"
                                >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        );
                    })}

                    {/* Add page button */}
                    <button
                        onClick={handleCreate}
                        className="h-full w-9 flex items-center justify-center text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-bg-elevated)] transition-colors border-r border-[var(--ide-border)] shrink-0"
                        title="New Page"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* ── Context menu ── */}
            {ctx && (
                <div
                    ref={ctxRef}
                    className="fixed z-[9999] bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] rounded-lg shadow-xl py-1 min-w-[180px] text-xs animate-fade-in"
                    style={{ left: ctx.x, top: ctx.y }}
                >
                    <CtxItem label="Close" shortcut="Ctrl+W" onClick={() => { closePageTab(ctx.pageId); setCtx(null); }} />
                    <CtxItem label="Close Others" onClick={() => { closeOtherPageTabs(ctx.pageId); setCtx(null); }} />
                    <CtxItem label="Close All" onClick={() => {
                        openPageIds.forEach(id => closePageTab(id));
                        setCtx(null);
                    }} />
                </div>
            )}

            {/* ── Create page modal ── */}
            <PromptModal
                isOpen={createModalOpen}
                title="Create New Page"
                confirmText="Create"
                fields={[
                    { name: "pageName", label: "Page Name", placeholder: "New Page", value: "New Page", required: true },
                ]}
                onClose={() => setCreateModalOpen(false)}
                onSubmit={submitCreate}
            />
        </>
    );
};

/* ═══════════════════  Helpers  ═════════════════════ */

const CtxItem: React.FC<{
    label: string;
    shortcut?: string;
    disabled?: boolean;
    onClick: () => void;
}> = ({ label, shortcut, disabled, onClick }) => (
    <button
        className={`w-full px-3 py-1.5 text-left flex items-center justify-between ${disabled
            ? "text-[var(--ide-text-muted)] cursor-default"
            : "text-[var(--ide-text)] hover:bg-[var(--ide-primary)]/10"
            }`}
        onClick={disabled ? undefined : onClick}
        disabled={disabled}
    >
        <span>{label}</span>
        {shortcut && <span className="text-[10px] text-[var(--ide-text-muted)] ml-4">{shortcut}</span>}
    </button>
);

export default Toolbar;
