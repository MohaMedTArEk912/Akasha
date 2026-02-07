/**
 * Toolbar Component - VS Code Style Tab Bar
 * 
 * Simplified tab bar mimicking VS Code file tabs.
 * Clean, minimal, no over-design.
 */

import React, { useState } from "react";
import { useProjectStore } from "../../hooks/useProjectStore";
import { createPage, selectPage, setActiveTab, setEditMode } from "../../stores/projectStore";

const Toolbar: React.FC = () => {
    const { project, selectedPageId, activeTab, editMode } = useProjectStore();
    const [hoveredTab, setHoveredTab] = useState<string | null>(null);
    const pages = project?.pages.filter((page) => !page.archived) ?? [];

    // Derive selectedPage from the project's pages array
    const selectedPage = project?.pages.find((p) => p.id === selectedPageId);

    // Only show the main canvas tab if a page is selected
    const openTabs = selectedPage ? [
        { id: "canvas", label: selectedPage.name, icon: "tsx" },
    ] : [];

    const getFileIcon = (type: string) => {
        switch (type) {
            case "tsx":
                return <span className="text-[#519aba]">TS</span>;
            case "ts":
                return <span className="text-[#3178c6]">TS</span>;
            case "prisma":
                return <span className="text-[#5a67d8]">P</span>;
            default:
                return <span className="text-[#858585]">F</span>;
        }
    };

    const handleCreatePage = async () => {
        const pageName = window.prompt("Enter new page name:", "New Page");
        if (!pageName?.trim()) return;

        try {
            await createPage(pageName);
        } catch (err) {
            console.error("Failed to create page:", err);
            window.alert(`Failed to create page: ${err}`);
        }
    };

    return (
        <div className="w-full h-full flex items-center bg-[#252526] overflow-x-auto">
            {/* File Tabs */}
            <div className="flex h-full">
                {openTabs.map((tab) => (
                    <button
                        key={tab.id}
                        className={`h-full px-4 flex items-center gap-2 text-xs border-r border-[#1e1e1e] transition-colors relative ${activeTab === tab.id
                            ? "bg-[#1e1e1e] text-white"
                            : "text-[#969696] hover:bg-[#2d2d2d]"
                            }`}
                        onClick={() => setActiveTab(tab.id as "canvas" | "logic" | "api" | "erd")}
                        onMouseEnter={() => setHoveredTab(tab.id)}
                        onMouseLeave={() => setHoveredTab(null)}
                    >
                        {/* File type icon placeholder */}
                        <span className="text-[10px] font-bold">{getFileIcon(tab.icon)}</span>

                        {/* File name */}
                        <span>{tab.label}</span>

                        {/* Close button on hover (optional VS Code feature) */}
                        {(hoveredTab === tab.id || activeTab === tab.id) && (
                            <span
                                className="ml-1 w-4 h-4 flex items-center justify-center rounded hover:bg-[#3c3c3c] text-[#858585] hover:text-white"
                                onClick={(e) => { e.stopPropagation(); }}
                            >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </span>
                        )}

                        {/* Active tab indicator (top border like VS Code) */}
                        {activeTab === tab.id && (
                            <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#007acc]" />
                        )}
                    </button>
                ))}
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Visual / Code Toggle (only show on canvas view) */}
            {activeTab === "canvas" && (
                <div className="flex items-center h-full px-2 border-l border-[#1e1e1e] gap-2">
                    {editMode === "visual" && (
                        <>
                            <select
                                value={selectedPageId ?? ""}
                                onChange={(e) => selectPage(e.target.value)}
                                className="h-7 max-w-[180px] bg-[#1e1e1e] border border-[#3c3c3c] text-[#cccccc] text-xs rounded px-2 focus:outline-none focus:border-[#0e639c]"
                                title="Select Page"
                            >
                                {pages.map((page) => (
                                    <option key={page.id} value={page.id}>
                                        {page.name}
                                    </option>
                                ))}
                            </select>
                            <button
                                onClick={handleCreatePage}
                                className="h-7 px-3 text-xs rounded bg-[#0e639c] text-white hover:bg-[#1177bb] transition-colors"
                                title="Create Page in client/page"
                            >
                                + Page
                            </button>
                        </>
                    )}
                    <div className="flex bg-[#1e1e1e] rounded-md overflow-hidden">
                        <button
                            onClick={() => setEditMode("visual")}
                            className={`px-3 py-1 text-xs flex items-center gap-1.5 transition-colors ${editMode === "visual"
                                ? "bg-[#0e639c] text-white"
                                : "text-[#858585] hover:text-white"
                                }`}
                            title="Visual Editor"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            Visual
                        </button>
                        <button
                            onClick={() => setEditMode("code")}
                            className={`px-3 py-1 text-xs flex items-center gap-1.5 transition-colors ${editMode === "code"
                                ? "bg-[#0e639c] text-white"
                                : "text-[#858585] hover:text-white"
                                }`}
                            title="Code Editor"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                            </svg>
                            Code
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Toolbar;

