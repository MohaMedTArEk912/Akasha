/**
 * Source Code Page — Unified Code + Git
 *
 * Layout:
 * ┌──────────┬───────────────────────┬──────────────┐
 * │ Explorer │  EditorTabs           │  Git Panel   │
 * │ FileTree │  CodeEditor/DiffView  │ (toggleable) │
 * └──────────┴───────────────────────┴──────────────┘
 */

import React, { useState } from "react";
import { useProjectStore } from "../hooks/useProjectStore";
import CodeEditor from "../components/features/CodeEditor/CodeEditor";
import DiffViewer from "../components/features/CodeEditor/DiffViewer";
import EditorTabs from "../components/layout/EditorTabs";
import FileTree from "../components/features/FileTree/FileTree";
import SourceControlPanel from "../components/features/SourceControl/SourceControlPanel";

const SourceCodePage: React.FC = () => {
    const { diffView } = useProjectStore();
    const [gitOpen, setGitOpen] = useState(false);

    return (
        <div className="flex flex-1 overflow-hidden h-full">
            {/* ── Left Sidebar: File Tree ── */}
            <aside className="w-60 bg-[var(--ide-chrome)] border-r border-[var(--ide-border)] flex flex-col flex-shrink-0 overflow-hidden">
                <div className="h-9 px-4 flex items-center justify-between border-b border-[var(--ide-border)] flex-shrink-0">
                    <span className="text-[10px] font-black text-[var(--ide-text-secondary)] uppercase tracking-[0.2em]">
                        Explorer
                    </span>
                </div>
                <div className="flex-1 overflow-auto custom-scrollbar">
                    <FileTree />
                </div>
            </aside>

            {/* ── Center: Code Editor ── */}
            <main className="flex-1 flex flex-col overflow-hidden min-w-0">
                <EditorTabs />
                <div className="flex-1 overflow-hidden">
                    {diffView ? <DiffViewer /> : <CodeEditor />}
                </div>
            </main>

            {/* ── Right: Git Toggle Strip ── */}
            <div
                onClick={() => setGitOpen(!gitOpen)}
                className={`w-9 flex flex-col items-center py-3 gap-2 border-l cursor-pointer transition-all duration-200 select-none flex-shrink-0 ${gitOpen
                        ? "bg-indigo-500/10 border-indigo-500/30"
                        : "bg-[var(--ide-chrome)] border-[var(--ide-border)] hover:bg-white/[0.04]"
                    }`}
                title={gitOpen ? "Close Source Control" : "Open Source Control"}
            >
                {/* Git icon */}
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${gitOpen
                        ? "bg-indigo-500/20 text-indigo-400"
                        : "bg-white/[0.05] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"
                    }`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                    </svg>
                </div>

                {/* Vertical label */}
                <span className={`text-[9px] font-bold uppercase tracking-[0.15em] transition-colors ${gitOpen ? "text-indigo-400" : "text-[var(--ide-text-muted)]"
                    }`} style={{ writingMode: "vertical-rl" }}>
                    Git
                </span>

                {/* Active indicator dot */}
                {gitOpen && (
                    <div className="mt-auto w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                )}
            </div>

            {/* ── Right Panel: Source Control ── */}
            {gitOpen && (
                <aside
                    className="w-[380px] flex-shrink-0 border-l border-[var(--ide-border)] bg-[var(--ide-bg)] overflow-hidden flex flex-col"
                    style={{ animation: "slideInRight 0.15s ease-out" }}
                >
                    {/* Panel header */}
                    <div className="h-9 px-4 flex items-center justify-between border-b border-[var(--ide-border)] flex-shrink-0 bg-[var(--ide-chrome)]">
                        <div className="flex items-center gap-2">
                            <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                            </svg>
                            <span className="text-[10px] font-black text-[var(--ide-text-secondary)] uppercase tracking-[0.2em]">
                                Source Control
                            </span>
                        </div>
                        <button
                            onClick={(e) => { e.stopPropagation(); setGitOpen(false); }}
                            className="w-6 h-6 flex items-center justify-center rounded-md text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-white/10 transition-colors"
                            title="Close"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    {/* Panel content */}
                    <div className="flex-1 overflow-auto">
                        <SourceControlPanel />
                    </div>
                </aside>
            )}
        </div>
    );
};

export default SourceCodePage;
