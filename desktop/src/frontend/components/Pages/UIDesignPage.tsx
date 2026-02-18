/**
 * UI Design Page
 *
 * Full-page view for visual UI building:
 * - Left sidebar: Pages list + Component palette
 * - Center: Visual Canvas (drag-drop block editor)
 * - Right: Inspector panel (properties, styles, events)
 */

import React from "react";
import { useProjectStore } from "../../hooks/useProjectStore";
import { setInspectorOpen } from "../../stores/projectStore";
import Canvas from "../Canvas/VisualCanvas/Canvas";
import ComponentPalette from "../Visual/ComponentPalette";
import Inspector from "../Visual/Inspector";
import { SidebarSection, PagesList, AddPageButton } from "../Layout/SidebarComponents";

const UIDesignPage: React.FC = () => {
    const { inspectorOpen } = useProjectStore();

    return (
        <div className="flex flex-1 overflow-hidden h-full">
            {/* Left Sidebar: Pages + Components */}
            <aside className="w-60 bg-[var(--ide-chrome)] border-r border-[var(--ide-border)] flex flex-col flex-shrink-0 overflow-hidden">
                <SidebarSection title="Pages" defaultExpanded={true} actionButton={<AddPageButton />}>
                    <PagesList />
                </SidebarSection>
                <SidebarSection title="Components" defaultExpanded={true}>
                    <ComponentPalette />
                </SidebarSection>
            </aside>

            {/* Center: Visual Canvas */}
            <main className="flex-1 overflow-hidden relative">
                <Canvas />
            </main>

            {/* Right: Inspector */}
            {inspectorOpen && <Inspector />}

            {/* Inspector toggle button (floating) */}
            {!inspectorOpen && (
                <button
                    onClick={() => setInspectorOpen(true)}
                    className="absolute right-3 top-3 z-10 px-2.5 py-1.5 rounded border border-[var(--ide-border-strong)] bg-[var(--ide-chrome)] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] text-[10px] font-bold uppercase tracking-wider transition-all"
                    title="Show Inspector"
                >
                    Inspector
                </button>
            )}
        </div>
    );
};

export default UIDesignPage;
