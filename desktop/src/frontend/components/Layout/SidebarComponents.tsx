import React, { useState } from "react";
import { useProjectStore } from "../../hooks/useProjectStore";
import { selectPage, setActiveTab, setEditMode } from "../../stores/projectStore";

interface SidebarSectionProps {
    title: string;
    children: React.ReactNode;
    defaultExpanded?: boolean;
}

export const SidebarSection: React.FC<SidebarSectionProps> = ({
    title,
    children,
    defaultExpanded = true,
}) => {
    const [expanded, setExpanded] = useState(defaultExpanded);

    return (
        <div className="flex flex-col">
            <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-2 px-3 py-1.5 bg-[var(--ide-chrome)] hover:bg-[var(--ide-bg-hover)] transition-colors text-[10px] font-black uppercase tracking-widest text-[var(--ide-text-muted)] border-b border-[var(--ide-border)]/30"
            >
                <svg
                    className={`w-3 h-3 transition-transform ${expanded ? "rotate-90" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" />
                </svg>
                {title}
            </button>
            {expanded && <div className="animate-fade-in">{children}</div>}
        </div>
    );
};

export const PagesList: React.FC = () => {
    const { project, selectedPageId } = useProjectStore();

    if (!project || !project.pages) return null;

    const handlePageClick = (id: string) => {
        selectPage(id);
        setActiveTab("canvas");
        void setEditMode("visual");
    };

    return (
        <div className="py-1">
            {project.pages.map((page) => (
                <button
                    key={page.id}
                    onClick={() => handlePageClick(page.id)}
                    className={`w-full flex items-center gap-2.5 px-4 py-1.5 text-[13px] transition-all group ${selectedPageId === page.id
                            ? "bg-indigo-500/10 text-indigo-400 font-semibold border-r-2 border-indigo-500"
                            : "text-[var(--ide-text-muted)] hover:bg-[var(--ide-text)]/5 hover:text-[var(--ide-text)]"
                        }`}
                >
                    <svg className={`w-4 h-4 ${selectedPageId === page.id ? "text-indigo-500" : "text-[var(--ide-text-muted)] group-hover:text-[var(--ide-text)]"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="truncate">{page.name}</span>
                </button>
            ))}
        </div>
    );
};
