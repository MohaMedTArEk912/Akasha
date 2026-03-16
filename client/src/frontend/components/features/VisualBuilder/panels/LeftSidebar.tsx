import React from "react";
import { setActivePage } from "../../../../stores/projectStore";
import ComponentPalette from "../ComponentPalette";
import LayersPanel from "../LayersPanel";
import PagesPanel from "./PagesPanel";
import type { BuilderLeftTab } from "../hooks/panels/types";

interface LeftSidebarProps {
    tab: BuilderLeftTab;
    onTabChange: (tab: BuilderLeftTab) => void;
    onExportClick: () => void;
}

const tabs: Array<{ key: BuilderLeftTab; label: string }> = [
    { key: "pages", label: "Pages" },
    { key: "components", label: "Insert" },
    { key: "layers", label: "Layers" },
];

const LeftSidebar: React.FC<LeftSidebarProps> = ({ tab, onTabChange, onExportClick }) => {
    return (
        <div className="w-64 bg-[var(--ide-bg-sidebar)] border-r border-[var(--ide-border)] flex flex-col flex-shrink-0">
            <div className="h-10 flex items-center border-b border-[var(--ide-border)] select-none">
                <button
                    onClick={() => setActivePage("ui")}
                    className="h-full px-4 flex items-center gap-2 justify-center text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-white/5 transition-colors border-r border-[var(--ide-border)]"
                    title="Back to UI Design"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    <span className="text-[11px] font-bold tracking-wider uppercase">Back</span>
                </button>

                {tabs.map((tabItem) => (
                    <button
                        key={tabItem.key}
                        onClick={() => onTabChange(tabItem.key)}
                        className={`flex-1 h-full text-[11px] font-semibold uppercase tracking-wider transition-colors relative ${tab === tabItem.key
                            ? "text-[var(--ide-text)] bg-white/5"
                            : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text-secondary)]"
                            }`}
                    >
                        {tabItem.label}
                        {tab === tabItem.key && <div className="absolute bottom-0 inset-x-0 h-[2px] bg-[var(--ide-primary)]" />}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-y-auto">
                {tab === "pages" && <PagesPanel />}
                {tab === "components" && <ComponentPalette />}
                {tab === "layers" && <LayersPanel />}
            </div>

            <div className="p-2 border-t border-[var(--ide-border)]">
                <button
                    onClick={onExportClick}
                    className="w-full px-3 py-2 text-xs font-medium rounded-lg bg-[var(--ide-primary)]/10 text-[var(--ide-primary)] hover:bg-[var(--ide-primary)]/20 transition-colors flex items-center justify-center gap-2"
                >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                    Export Code
                </button>
            </div>
        </div>
    );
};

export default LeftSidebar;
