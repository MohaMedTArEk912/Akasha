/**
 * EditorTabs - VS Code-style tab bar for open files in Code mode
 * 
 * Features:
 * - Shows only in Code mode when a file is selected
 * - File type icons based on extension
 * - Active tab highlight with indigo top border
 * - Dirty indicator (unsaved dot)
 * - Close button on hover
 */

import React from "react";
import { useProjectStore } from "../../hooks/useProjectStore";
import { selectFile } from "../../stores/projectStore";

/** File extension to icon mapping */
const getFileIcon = (path: string): { icon: string; color: string } => {
    const ext = path.split(".").pop()?.toLowerCase() || "";

    const iconMap: Record<string, { icon: string; color: string }> = {
        // Web
        tsx: { icon: "⚛", color: "text-cyan-400" },
        jsx: { icon: "⚛", color: "text-cyan-400" },
        ts: { icon: "TS", color: "text-blue-400" },
        js: { icon: "JS", color: "text-yellow-400" },
        html: { icon: "◇", color: "text-orange-400" },
        css: { icon: "#", color: "text-blue-300" },
        scss: { icon: "#", color: "text-pink-400" },
        json: { icon: "{}", color: "text-yellow-300" },
        md: { icon: "M↓", color: "text-white" },
        // Config
        toml: { icon: "⚙", color: "text-gray-400" },
        yaml: { icon: "⚙", color: "text-red-300" },
        yml: { icon: "⚙", color: "text-red-300" },
        // Other
        rs: { icon: "🦀", color: "text-orange-500" },
        py: { icon: "🐍", color: "text-yellow-400" },
    };

    return iconMap[ext] || { icon: "📄", color: "text-gray-400" };
};

interface EditorTabsProps {
    isDirty?: boolean;
}

const EditorTabs: React.FC<EditorTabsProps> = ({ isDirty = false }) => {
    const { selectedFilePath, editMode } = useProjectStore();

    // Only render in Code mode when a FILE is selected
    // Visual mode uses the toolbar's page tabs instead
    if (editMode === "visual" || !selectedFilePath) {
        return null;
    }

    const activeLabel = selectedFilePath.split(/[/\\]/).pop() ?? "Untitled";
    const { icon, color } = getFileIcon(selectedFilePath);

    const handleClose = () => {
        selectFile(null);
    };

    return (
        <div className="h-9 bg-[var(--ide-chrome)] border-b border-[var(--ide-border)] flex items-center px-1 select-none shrink-0">
            {/* Active Tab */}
            <div className="h-full flex items-center">
                <div
                    className="group h-full flex items-center gap-2 px-3 bg-[var(--ide-bg)] border-t-2 border-t-[var(--ide-primary)] border-x border-[var(--ide-border)] rounded-t-sm cursor-default relative"
                >
                    {/* File Icon */}
                    <span className={`text-[10px] font-bold ${color}`}>
                        {icon}
                    </span>

                    {/* File Name */}
                    <span className="text-[12px] font-medium text-[var(--ide-text)] whitespace-nowrap">
                        {activeLabel}
                    </span>

                    {/* Dirty Indicator or Close Button */}
                    <div className="w-4 h-4 flex items-center justify-center">
                        {isDirty ? (
                            <span className="w-2 h-2 rounded-full bg-[var(--ide-text-muted)]" title="Unsaved changes" />
                        ) : (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleClose();
                                }}
                                className="opacity-0 group-hover:opacity-100 w-4 h-4 rounded hover:bg-[var(--ide-text)]/10 flex items-center justify-center text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-all"
                                title="Close"
                                aria-label="Close tab"
                            >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* File Path Info */}
            <div className="ml-auto flex items-center gap-2 pr-2">
                <span className="text-[10px] text-[var(--ide-text-muted)] truncate max-w-[200px]">
                    {selectedFilePath}
                </span>
            </div>
        </div>
    );
};

export default EditorTabs;
