/**
 * IDE Layout Component - VS Code Style
 * 
 * Simplified VS Code-like layout:
 * - Top title bar
 * - Left Activity Bar (icon strip)
 * - Left Explorer Panel
 * - Main Editor Area with file tabs
 * - Bottom Status Bar
 */

import React, { useState } from "react";
import { useProjectStore } from "../../hooks/useProjectStore";
import { setActiveTab, closeProject, installProjectDependencies, clearInstallStatus } from "../../stores/projectStore";
import LogicCanvas from "../Canvas/LogicCanvas";
import ApiList from "../Canvas/ApiList";
import SchemaEditor from "../Editors/SchemaEditor";
import CodeEditor from "../Canvas/CodeEditor";
import ProjectSettingsModal from "../Modals/ProjectSettingsModal";
import ComponentPalette from "../Visual/ComponentPalette";
import Inspector from "../Visual/Inspector";

interface IDELayoutProps {
    toolbar: React.ReactNode;
    fileTree: React.ReactNode;
    canvas: React.ReactNode;
    inspector?: React.ReactNode;
    terminal?: React.ReactNode;
}

/**
 * Main IDE Layout - Mimics VS Code structure
 */
const IDELayout: React.FC<IDELayoutProps> = ({
    toolbar,
    fileTree,
    canvas,
    terminal
}) => {
    const { project, activeTab, editMode, loading, loadingMessage, installLog, installError } = useProjectStore();

    // Sidebar state (only for Explorer)
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [terminalOpen, setTerminalOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);

    // Toggle explorer sidebar
    const toggleExplorer = () => {
        setSidebarOpen(!sidebarOpen);
    };

    // Handle view tab click (Logic/API/ERD) - switches main content
    const handleViewTabClick = (tab: "canvas" | "logic" | "api" | "erd") => {
        setActiveTab(tab);
    };

    return (
        <div className="h-screen w-screen flex flex-col bg-[#1e1e1e] text-[#cccccc] overflow-hidden">

            {/* ===== TOP: Title Bar ===== */}
            <header className="h-9 bg-[#323233] border-b border-[#252526] flex items-center px-4 select-none flex-shrink-0">
                <span className="text-xs text-[#cccccc]/80 font-medium">
                    {project?.name || "Untitled"} — Grapes IDE
                </span>
            </header>

            {/* ===== MAIN CONTENT AREA ===== */}
            <div className="flex-1 flex overflow-hidden">

                {/* ===== LEFT: Activity Bar (Icon Strip) ===== */}
                <aside className="w-12 bg-[#333333] flex flex-col items-center py-2 flex-shrink-0">
                    <ActivityIcon
                        icon="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                        label="Explorer"
                        active={sidebarOpen}
                        onClick={toggleExplorer}
                    />
                    {/* Logic Tab - Code icon */}
                    <button
                        className={`w-12 h-10 flex items-center justify-center relative group transition-colors ${activeTab === "logic" ? "text-white" : "text-[#858585] hover:text-white"
                            }`}
                        onClick={() => handleViewTabClick("logic")}
                        title="Logic"
                        aria-label="Logic"
                    >
                        {activeTab === "logic" && (
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-white" />
                        )}
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                        </svg>
                    </button>

                    {/* API Tab - Globe/Network icon */}
                    <button
                        className={`w-12 h-10 flex items-center justify-center relative group transition-colors ${activeTab === "api" ? "text-white" : "text-[#858585] hover:text-white"
                            }`}
                        onClick={() => handleViewTabClick("api")}
                        title="API"
                        aria-label="API"
                    >
                        {activeTab === "api" && (
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-white" />
                        )}
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                        </svg>
                    </button>

                    {/* ERD / Schema Tab - Database icon */}
                    <button
                        className={`w-12 h-10 flex items-center justify-center relative group transition-colors ${activeTab === "erd" ? "text-white" : "text-[#858585] hover:text-white"
                            }`}
                        onClick={() => handleViewTabClick("erd")}
                        title="Schema"
                        aria-label="Schema"
                    >
                        {activeTab === "erd" && (
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-white" />
                        )}
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                        </svg>
                    </button>

                    {/* Spacer pushes bottom icons */}
                    <div className="flex-1" />

                    {/* Home Button - returns to Dashboard */}
                    <button
                        className="w-12 h-10 flex items-center justify-center relative group transition-colors text-[#858585] hover:text-white"
                        onClick={closeProject}
                        title="Return to Dashboard"
                        aria-label="Return to Dashboard"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                    </button>

                    {/* Settings Button */}
                    <ActivityIcon
                        icon="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                        label="Settings"
                        active={settingsOpen}
                        onClick={() => setSettingsOpen(true)}
                    />
                </aside>

                {/* ===== LEFT: Conditional Sidebar (Explorer or Component Palette) ===== */}
                {sidebarOpen && (
                    <aside className="bg-[#252526] border-r border-[#1e1e1e] flex flex-col flex-shrink-0">
                        {editMode === "code" ? (
                            /* Code Mode: File Explorer */
                            <div className="w-60 flex flex-col h-full">
                                <div className="h-9 px-4 flex items-center border-b border-[#1e1e1e]">
                                    <span className="text-[11px] font-semibold text-[#bbbbbb] uppercase tracking-wider">
                                        Explorer
                                    </span>
                                </div>
                                <div className="flex-1 overflow-y-auto overflow-x-hidden">
                                    {fileTree}
                                </div>
                            </div>
                        ) : (
                            /* Visual Mode: Component Palette */
                            <ComponentPalette />
                        )}
                    </aside>
                )}

                {/* ===== CENTER: Editor Area + Inspector (Visual Mode) ===== */}
                <div className="flex-1 flex overflow-hidden">
                    <main className="flex-1 flex flex-col overflow-hidden bg-[#1e1e1e]">
                        {/* Toolbar / Tab Bar */}
                        <div className="h-9 bg-[#252526] border-b border-[#1e1e1e] flex items-center flex-shrink-0">
                            {toolbar}
                        </div>

                        {/* Editor Content - switches based on activeTab */}
                        <div className={`flex-1 overflow-auto relative ${terminalOpen ? 'h-[60%]' : ''}`}>
                            {loading && (
                                <div className="absolute inset-0 bg-[#1e1e1e]/50 backdrop-blur-sm z-50 flex items-center justify-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0e639c]"></div>
                                </div>
                            )}
                            {activeTab === "canvas" && (editMode === "visual" ? canvas : <CodeEditor />)}
                            {activeTab === "logic" && <LogicCanvas />}
                            {activeTab === "api" && <ApiList />}
                            {activeTab === "erd" && <SchemaEditor />}
                        </div>

                        {/* Terminal Panel (toggleable) */}
                        {terminalOpen && terminal && (
                            <div className="h-[35%] border-t border-[#1e1e1e] bg-[#1e1e1e]">
                                <div className="h-8 bg-[#252526] px-4 flex items-center gap-4 text-xs border-b border-[#1e1e1e]">
                                    <span className="text-[#cccccc] font-medium">Terminal</span>
                                </div>
                                <div className="h-[calc(100%-2rem)] overflow-auto">
                                    {terminal}
                                </div>
                            </div>
                        )}
                    </main>

                    {/* Inspector Panel (Visual Mode Only) */}
                    {editMode === "visual" && activeTab === "canvas" && <Inspector />}
                </div>
            </div>

            {/* NPM Install Loading Overlay */}
            {loadingMessage && (
                <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center">
                    <div className="bg-[#1e1e1e] p-8 rounded-xl shadow-2xl border border-[#0e639c]/30 max-w-2xl w-[90%]">
                        <div className="flex items-center gap-4 mb-4">
                            {!installError && (
                                <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#0e639c] border-t-transparent"></div>
                            )}
                            {installError && (
                                <div className="h-10 w-10 rounded-full border-4 border-red-500 flex items-center justify-center text-red-500 font-bold">!</div>
                            )}
                            <div>
                                <h3 className="text-white text-lg font-semibold">Setting up project...</h3>
                                <p className="text-[#858585] text-sm">{loadingMessage}</p>
                            </div>
                        </div>
                        {!installError && (
                            <div className="w-full bg-[#2d2d2d] rounded-full h-1.5 overflow-hidden">
                                <div className="h-full bg-[#0e639c] animate-pulse" style={{ width: '70%' }}></div>
                            </div>
                        )}
                        {installLog && (
                            <pre className="mt-4 max-h-64 overflow-auto text-xs bg-[#111] text-[#d4d4d4] p-3 rounded border border-[#2d2d2d] whitespace-pre-wrap">
                                {installLog}
                            </pre>
                        )}
                        {installError && (
                            <div className="mt-4 flex items-center justify-end gap-3">
                                <button
                                    onClick={() => clearInstallStatus()}
                                    className="px-3 py-1.5 text-sm rounded bg-[#2d2d2d] hover:bg-[#3a3a3a] text-white"
                                >
                                    Close
                                </button>
                                <button
                                    onClick={() => installProjectDependencies()}
                                    className="px-3 py-1.5 text-sm rounded bg-[#0e639c] hover:bg-[#1177bb] text-white"
                                >
                                    Retry
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ===== BOTTOM: Status Bar ===== */}
            <footer className="h-6 bg-[#007acc] flex items-center px-3 text-[11px] text-white select-none flex-shrink-0">
                {/* Left side */}
                <div className="flex items-center gap-4">
                    <span>{project?.name || "No Project"}</span>
                </div>

                {/* Right side */}
                <div className="ml-auto flex items-center gap-4">
                    <span>Ln 1, Col 1</span>
                    <span>UTF-8</span>
                    <span>TypeScript React</span>
                    <button
                        onClick={() => setTerminalOpen(!terminalOpen)}
                        className="hover:bg-white/20 px-2 py-0.5 rounded transition-colors"
                    >
                        Terminal
                    </button>
                </div>
            </footer>

            {/* Settings Modal */}
            <ProjectSettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
        </div>
    );
};

/* ===== Activity Icon Component ===== */
interface ActivityIconProps {
    icon: string;
    label: string;
    active: boolean;
    onClick: () => void;
}

const ActivityIcon: React.FC<ActivityIconProps> = ({ icon, label, active, onClick }) => (
    <button
        className={`w-12 h-12 flex items-center justify-center relative group transition-colors ${active ? "text-white" : "text-[#858585] hover:text-white"
            }`}
        onClick={onClick}
        title={label}
        aria-label={label}
    >
        {/* Active indicator bar */}
        {active && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-white" />
        )}
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d={icon} />
        </svg>
    </button>
);

export default IDELayout;
