/**
 * UI Design Page — full-page visual builder powered by craft.js.
 *
 * Layout:
 * ┌──────────────────────────────────────────────────────────┐
 * │  ┌─────────┐ ┌──────────────────────────┐ ┌───────────┐ │
 * │  │  LEFT   │ │        CANVAS            │ │  RIGHT    │ │
 * │  │ SIDEBAR │ │  ┌────────────────────┐  │ │ INSPECTOR │ │
 * │  │         │ │  │  Page Tabs Bar     │  │ │           │ │
 * │  │ Pages   │ │  ├────────────────────┤  │ │ Props /   │ │
 * │  │         │ │  │                    │  │ │ Styles /  │ │
 * │  │ ─────── │ │  │  craft.js Canvas   │  │ │ Events    │ │
 * │  │         │ │  │                    │  │ │           │ │
 * │  │ Palette │ │  │                    │  │ │ OR        │ │
 * │  │         │ │  └────────────────────┘  │ │           │ │
 * │  │         │ │                          │ │ Layers /  │ │
 * │  └─────────┘ └──────────────────────────┘ │ Assets    │ │
 * │                                           └───────────┘ │
 * └──────────────────────────────────────────────────────────┘
 *
 * Everything is inside <CraftEditor> so useEditor() is available
 * in ComponentPalette, Inspector, CraftFrame, and ToolboxDropZone.
 */

import React from "react";
import { useProjectStore } from "../../hooks/useProjectStore";
import {
    setInspectorOpen,
    selectPage,
} from "../../stores/projectStore";
import { CraftEditor } from "../Canvas/craft/CraftEditor";
import { CraftFrame } from "../Canvas/craft/CraftFrame";
import { ToolboxDropZone } from "../Canvas/craft/ToolboxDropZone";
import { useCraftSync } from "../Canvas/craft/useCraftSync";
import ComponentPalette from "../Visual/ComponentPalette";
import Inspector from "../Visual/Inspector";
import { PagesList, AddPageButton } from "../Layout/SidebarComponents";

/* ═══════════════════  Page Tabs Bar  ═══════════════════ */

const PageTabsBar: React.FC = () => {
    const { project, selectedPageId, openPageIds } = useProjectStore();
    if (!project) return null;

    const pages = project.pages.filter((p) => !p.archived);
    const tabPages = openPageIds.length > 0
        ? pages.filter((p) => openPageIds.includes(p.id))
        : pages;

    if (tabPages.length <= 1) return null; // No tabs needed for single page

    return (
        <div className="flex items-center gap-0.5 px-2 py-1 bg-[var(--ide-bg-elevated)] border-b border-[var(--ide-border)] overflow-x-auto custom-scrollbar flex-shrink-0">
            {tabPages.map((page) => {
                const isActive = page.id === selectedPageId;
                return (
                    <button
                        key={page.id}
                        onClick={() => selectPage(page.id)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all ${isActive
                            ? "bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 shadow-sm"
                            : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-bg-panel)] border border-transparent"
                            }`}
                    >
                        {page.name}
                    </button>
                );
            })}
        </div>
    );
};

const LeftSidebar: React.FC = () => {
    const [activeTab, setActiveTab] = React.useState<"pages" | "components">("pages");

    return (
        <aside className="w-60 bg-[var(--ide-chrome)] border-r border-[var(--ide-border)] flex flex-col flex-shrink-0 overflow-hidden">
            {/* Tab Switcher */}
            <div className="flex items-center border-b border-[var(--ide-border)] shrink-0">
                <button
                    onClick={() => setActiveTab("pages")}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === "pages"
                        ? "text-indigo-400 border-b-2 border-indigo-400 bg-indigo-500/5"
                        : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-bg-panel)]"
                        }`}
                >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    Pages
                </button>
                <button
                    onClick={() => setActiveTab("components")}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === "components"
                        ? "text-indigo-400 border-b-2 border-indigo-400 bg-indigo-500/5"
                        : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-bg-panel)]"
                        }`}
                >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
                    </svg>
                    Components
                </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                {activeTab === "pages" ? (
                    <div className="flex-1 flex flex-col overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-2 shrink-0">
                            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--ide-text-muted)]">
                                All Pages
                            </span>
                            <AddPageButton />
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            <PagesList />
                        </div>
                    </div>
                ) : (
                    <ComponentPalette />
                )}
            </div>
        </aside>
    );
};

/* ═══════════════════  Inspector Toggle  ═══════════════ */

const InspectorToggle: React.FC = () => (
    <button
        onClick={() => setInspectorOpen(true)}
        className="absolute right-3 top-3 z-10 px-2.5 py-1.5 rounded-lg border border-[var(--ide-border-strong)] bg-[var(--ide-chrome)]/90 backdrop-blur-sm text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-chrome)] text-[10px] font-bold uppercase tracking-wider transition-all shadow-lg"
        title="Show Inspector"
    >
        <svg className="w-4 h-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
        Inspector
    </button>
);

/* ═══════════════════  Craft Content (Inner)  ═════════ */

/** Inner component mounted inside <CraftEditor> — has access to craft.js context */
const CraftContent: React.FC = () => {
    const { inspectorOpen } = useProjectStore();

    // Enable debounced backend sync
    useCraftSync();

    return (
        <div className="flex flex-1 overflow-hidden h-full">
            {/* Left Sidebar */}
            <LeftSidebar />

            {/* Center: Canvas Area */}
            <main className="flex-1 flex flex-col overflow-hidden relative">
                <PageTabsBar />
                <div className="flex-1 overflow-hidden">
                    <ToolboxDropZone>
                        <CraftFrame />
                    </ToolboxDropZone>
                </div>
            </main>

            {/* Right: Inspector */}
            {inspectorOpen && <Inspector />}
            {!inspectorOpen && <InspectorToggle />}
        </div>
    );
};

/* ═══════════════════  UIDesignPage  ═══════════════════ */

const UIDesignPage: React.FC = () => {
    return (
        <CraftEditor>
            <CraftContent />
        </CraftEditor>
    );
};

export default UIDesignPage;
