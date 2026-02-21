/**
 * UI Design Page — Production-ready Visual Builder.
 *
 * Layout:
 * ┌──────────────────────────────────────────────────────────┐
 * │                   CraftEditor (context)                   │
 * ├─────────┬──────────────────────────┬─────────────────────┤
 * │  Left   │     CraftFrame           │  Inspector          │
 * │ Sidebar │     (craft.js canvas)    │  (properties panel) │
 * │ (Pages/ │                          │                     │
 * │ Insert/ │                          │                     │
 * │ Layers) │                          │                     │
 * └─────────┴──────────────────────────┴─────────────────────┘
 */

import React, { useState } from "react";
import { CraftEditor } from "../VisualBuilder/craft/CraftEditor";
import { CraftFrame } from "../VisualBuilder/craft/CraftFrame";
import Inspector from "../VisualBuilder/Inspector";
import ComponentPalette from "../VisualBuilder/ComponentPalette";
import LayersPanel from "../VisualBuilder/LayersPanel";
import ExportModal from "../VisualBuilder/ExportModal";
import { useProjectStore } from "../../hooks/useProjectStore";
import { addPage, updatePage, archivePage, selectPage, setActivePage } from "../../stores/projectStore";
import { useToast } from "../../context/ToastContext";

type LeftTab = "pages" | "components" | "layers";

/* ═══════════════════  Page List Panel  ═════════════════ */

const PagesPanel: React.FC = () => {
    const { project, selectedPageId } = useProjectStore();
    const toast = useToast();
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState("");

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

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Delete page "${name}"? This cannot be undone.`)) return;
        try {
            await archivePage(id);
            toast.success(`"${name}" deleted`);
        } catch (err) {
            toast.error(`Delete failed: ${err}`);
        }
    };

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="h-10 px-3 flex items-center justify-between border-b border-[var(--ide-border)] shrink-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ide-text-muted)]">
                    Pages ({pages.length})
                </span>
                <button
                    onClick={handleAdd}
                    className="w-6 h-6 flex items-center justify-center rounded-md text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-white/10 transition-colors"
                    title="Add Page"
                >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                    </svg>
                </button>
            </div>

            {/* Page List */}
            <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
                {pages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                        <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center mb-3">
                            <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
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
                                {/* Page Icon */}
                                <svg className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-indigo-400" : "opacity-50"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>

                                {/* Name / Rename Input */}
                                {isRenaming ? (
                                    <input
                                        autoFocus
                                        value={renameValue}
                                        onChange={(e) => setRenameValue(e.target.value)}
                                        onBlur={() => handleRenameSubmit(page.id)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") handleRenameSubmit(page.id);
                                            if (e.key === "Escape") setRenamingId(null);
                                        }}
                                        className="flex-1 min-w-0 bg-[var(--ide-bg)] border border-indigo-500/50 rounded px-1.5 py-0.5 text-xs text-[var(--ide-text)] focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                ) : (
                                    <span className="flex-1 text-xs font-medium truncate">{page.name}</span>
                                )}

                                {/* Path indicator */}
                                {!isRenaming && (
                                    <span className="text-[9px] text-[var(--ide-text-muted)] opacity-0 group-hover:opacity-100 truncate max-w-[60px] transition-opacity">
                                        {page.path}
                                    </span>
                                )}

                                {/* Actions */}
                                {!isRenaming && (
                                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleRenameStart(page.id, page.name);
                                            }}
                                            className="w-5 h-5 flex items-center justify-center rounded text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-white/10 transition-colors"
                                            title="Rename"
                                        >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDelete(page.id, page.name);
                                            }}
                                            className="w-5 h-5 flex items-center justify-center rounded text-[var(--ide-text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                            title="Delete"
                                        >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
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

/* ═══════════════════  Main Page  ═══════════════════════ */

const UIDesignPage: React.FC = () => {
    const [leftTab, setLeftTab] = useState<LeftTab>("pages");
    const [inspectorOpen, setInspectorOpen] = useState(true);
    const [exportOpen, setExportOpen] = useState(false);

    const tabs: { key: LeftTab; label: string }[] = [
        { key: "pages", label: "Pages" },
        { key: "components", label: "Insert" },
        { key: "layers", label: "Layers" },
    ];

    return (
        <CraftEditor>
            <div className="size-full flex flex-col bg-[var(--ide-bg)] overflow-hidden">
                {/* Main content area */}
                <div className="flex-1 flex overflow-hidden">

                    {/* ── Left Sidebar ── */}
                    <div className="w-64 bg-[var(--ide-bg-sidebar)] border-r border-[var(--ide-border)] flex flex-col flex-shrink-0">
                        {/* Home + Tab Switcher */}
                        <div className="h-10 flex items-center border-b border-[var(--ide-border)] select-none">
                            {/* Home button */}
                            <button
                                onClick={() => setActivePage("dashboard")}
                                className="h-full px-3 flex items-center justify-center text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-white/5 transition-colors border-r border-[var(--ide-border)]"
                                title="Back to Dashboard"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                </svg>
                            </button>
                            {tabs.map((tab) => (
                                <button
                                    key={tab.key}
                                    onClick={() => setLeftTab(tab.key)}
                                    className={`flex-1 h-full text-[11px] font-semibold uppercase tracking-wider transition-colors relative ${leftTab === tab.key
                                        ? "text-[var(--ide-text)] bg-white/5"
                                        : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text-secondary)]"
                                        }`}
                                >
                                    {tab.label}
                                    {leftTab === tab.key && (
                                        <div className="absolute bottom-0 inset-x-0 h-[2px] bg-[var(--ide-primary)]" />
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Tab Content */}
                        <div className="flex-1 overflow-y-auto">
                            {leftTab === "pages" && <PagesPanel />}
                            {leftTab === "components" && <ComponentPalette />}
                            {leftTab === "layers" && <LayersPanel />}
                        </div>

                        {/* Export Button */}
                        <div className="p-2 border-t border-[var(--ide-border)]">
                            <button
                                onClick={() => setExportOpen(true)}
                                className="w-full px-3 py-2 text-xs font-medium rounded-lg bg-[var(--ide-primary)]/10 text-[var(--ide-primary)] hover:bg-[var(--ide-primary)]/20 transition-colors flex items-center justify-center gap-2"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                                </svg>
                                Export Code
                            </button>
                        </div>
                    </div>

                    {/* ── Center: Canvas ── */}
                    <div className="flex-1 overflow-hidden">
                        <CraftFrame />
                    </div>

                    {/* ── Right: Inspector ── */}
                    {inspectorOpen && (
                        <div className="w-72 flex-shrink-0 border-l border-[var(--ide-border)] overflow-y-auto bg-[var(--ide-bg-sidebar)]">
                            <Inspector />
                        </div>
                    )}
                </div>

                {/* Inspector toggle (when closed) */}
                {!inspectorOpen && (
                    <button
                        onClick={() => setInspectorOpen(true)}
                        className="fixed right-4 top-1/2 -translate-y-1/2 z-30 p-2 rounded-lg bg-[var(--ide-bg-sidebar)] border border-[var(--ide-border)] shadow-lg hover:bg-[var(--ide-bg-elevated)] transition-colors"
                        title="Open Inspector"
                    >
                        <svg className="w-4 h-4 text-[var(--ide-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                        </svg>
                    </button>
                )}

                {/* Export Modal */}
                <ExportModal isOpen={exportOpen} onClose={() => setExportOpen(false)} />
            </div>
        </CraftEditor>
    );
};

export default UIDesignPage;
