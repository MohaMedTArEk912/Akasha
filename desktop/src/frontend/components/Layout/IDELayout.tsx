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
import { useEditorSettings } from "../../hooks/useEditorSettings";
import { setActiveTab, setEditMode, closeProject, installProjectDependencies, clearInstallStatus, toggleInspector } from "../../stores/projectStore";
import * as EditorSettingsStore from "../../stores/editorSettingsStore";
import LogicCanvas from "../Canvas/LogicCanvas";
import ApiList from "../Canvas/ApiList";
import SchemaEditor from "../Editors/SchemaEditor";
import CodeEditor from "../Canvas/CodeEditor";
import ProjectSettingsModal from "../Modals/ProjectSettingsModal";
import ComponentPalette from "../Visual/ComponentPalette";
import Inspector from "../Visual/Inspector";
import WindowControls from "../UI/WindowControls";
import { SidebarSection, PagesList } from "./SidebarComponents";

interface IDELayoutProps {
    toolbar: React.ReactNode;
    fileTree: React.ReactNode;
    canvas: React.ReactNode;
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
    const { project, activeTab, editMode, inspectorOpen, loading, loadingMessage, installLog, installError } = useProjectStore();
    const editorSettings = useEditorSettings();

    // Sidebar state
    type SidebarType = "explorer" | "components" | "logic" | "api" | "erd";
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [activeSidebar, setActiveSidebar] = useState<SidebarType>(editMode === "visual" ? "components" : "explorer");
    const [terminalOpen, setTerminalOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);

    // Toggle or switch sidebar
    const handleActivityClick = (sidebar: SidebarType) => {
        if (activeSidebar === sidebar) {
            setSidebarOpen(!sidebarOpen);
        } else {
            setActiveSidebar(sidebar);
            setSidebarOpen(true);
        }
    };

    return (
        <div className="h-screen w-screen flex flex-col bg-[var(--ide-bg)] text-[var(--ide-text)] overflow-hidden">

            {/* ===== TOP: Title Bar (Draggable for frameless window) ===== */}
            <header
                className="h-9 bg-[var(--ide-titlebar)] border-b border-[var(--ide-border)] flex items-center justify-between px-4 select-none flex-shrink-0"
                data-tauri-drag-region
            >

                <span className="text-xs text-[var(--ide-text-secondary)] font-medium">
                    {project?.name || "Untitled"} — Grapes IDE
                </span>
                <div className="flex items-center gap-2">
                    <div className="flex bg-[var(--ide-chrome)] rounded-md overflow-hidden border border-[var(--ide-border)]">
                        <button
                            onClick={() => {
                                if (activeTab !== "canvas") setActiveTab("canvas");
                                void setEditMode("visual");
                            }}
                            className={`px-3 py-1 text-xs flex items-center gap-1.5 transition-colors ${editMode === "visual"
                                ? "bg-[var(--ide-primary)] text-white"
                                : "text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)]"
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
                            onClick={() => {
                                if (activeTab !== "canvas") setActiveTab("canvas");
                                void setEditMode("code");
                            }}
                            className={`px-3 py-1 text-xs flex items-center gap-1.5 transition-colors ${editMode === "code"
                                ? "bg-[var(--ide-primary)] text-white"
                                : "text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)]"
                                }`}
                            title="Code Editor"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                            </svg>
                            Code
                        </button>
                    </div>

                    {/* Inspector Toggle (Always visible in Visual Mode) */}
                    {editMode === "visual" && (
                        <button
                            onClick={() => toggleInspector()}
                            className={`h-6 px-2.5 flex items-center gap-1.5 rounded border transition-all text-[10px] font-bold uppercase tracking-wider ${inspectorOpen
                                ? "bg-[var(--ide-accent-subtle)] border-[var(--ide-primary)] text-[var(--ide-primary)] shadow-[0_0_8px_rgba(99,102,241,0.2)]"
                                : "bg-transparent border-[var(--ide-border-strong)] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:border-[var(--ide-text-secondary)]"
                                }`}
                            title={inspectorOpen ? "Hide Inspector" : "Show Inspector"}
                        >
                            <svg className={`w-3 h-3 transition-transform duration-300 ${inspectorOpen ? "" : "rotate-180"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 5h1m0 0h10M5 19h10" />
                            </svg>
                            Inspector
                        </button>
                    )}

                    <WindowControls />
                </div>
            </header>

            {/* ===== MAIN CONTENT AREA ===== */}
            <div className="flex-1 flex overflow-hidden">

                {/* ===== LEFT: Activity Bar (Icon Strip) ===== */}
                <aside className="w-12 bg-[var(--ide-activity)] flex flex-col items-center py-2 flex-shrink-0 border-r border-[var(--ide-border)]">
                    <ActivityIcon
                        icon="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                        label="Explorer (Pages & Files)"
                        active={sidebarOpen && activeSidebar === "explorer"}
                        onClick={() => handleActivityClick("explorer")}
                    />

                    <ActivityIcon
                        icon="M4 5h16M4 12h16m-7 7h7"
                        label="Component Palette"
                        active={sidebarOpen && activeSidebar === "components"}
                        onClick={() => handleActivityClick("components")}
                    />

                    <ActivityIcon
                        icon="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                        label="Logic Flows"
                        active={sidebarOpen && activeSidebar === "logic"}
                        onClick={() => handleActivityClick("logic")}
                    />

                    <ActivityIcon
                        icon="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9"
                        label="API Endpoints"
                        active={sidebarOpen && activeSidebar === "api"}
                        onClick={() => handleActivityClick("api")}
                    />

                    <ActivityIcon
                        icon="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4"
                        label="Database Schema"
                        active={sidebarOpen && activeSidebar === "erd"}
                        onClick={() => handleActivityClick("erd")}
                    />

                    {/* Spacer pushes bottom icons */}
                    <div className="flex-1" />

                    <button
                        className="w-12 h-10 flex items-center justify-center relative group transition-colors text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)]"
                        onClick={closeProject}
                        title="Return to Dashboard"
                        aria-label="Return to Dashboard"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                    </button>

                    <ActivityIcon
                        icon="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                        label="Settings"
                        active={settingsOpen}
                        onClick={() => setSettingsOpen(true)}
                    />
                </aside>

                {/* ===== LEFT: Conditional Sidebar Panel ===== */}
                {sidebarOpen && (
                    <aside className="bg-[var(--ide-chrome)] border-r border-[var(--ide-border)] flex flex-col flex-shrink-0 w-64 overflow-hidden">
                        <div className="h-9 px-4 flex items-center border-b border-[var(--ide-border)] flex-shrink-0">
                            <span className="text-[10px] font-black text-[var(--ide-text-secondary)] uppercase tracking-[0.2em]">
                                {activeSidebar}
                            </span>
                        </div>

                        <div className="flex-1 overflow-y-auto overflow-x-hidden">
                            {activeSidebar === "explorer" && (
                                <div className="flex flex-col h-full divide-y divide-[var(--ide-border)]/30">
                                    <SidebarSection title="Visual Pages" defaultExpanded={true}>
                                        <PagesList />
                                    </SidebarSection>
                                    <SidebarSection title="Files" defaultExpanded={true}>
                                        {fileTree}
                                    </SidebarSection>
                                </div>
                            )}
                            {activeSidebar === "components" && <ComponentPalette />}
                            {activeSidebar === "logic" && (
                                <div className="py-2">
                                    <button
                                        onClick={() => setActiveTab("logic")}
                                        className={`w-full flex items-center gap-2 px-4 py-2 text-xs transition-colors hover:bg-[var(--ide-bg-hover)] ${activeTab === "logic" ? "text-indigo-400 font-bold bg-indigo-500/5" : "text-[var(--ide-text-secondary)]"}`}
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                        </svg>
                                        Project Logic Flows
                                    </button>
                                </div>
                            )}
                            {activeSidebar === "api" && (
                                <div className="py-2">
                                    <button
                                        onClick={() => setActiveTab("api")}
                                        className={`w-full flex items-center gap-2 px-4 py-2 text-xs transition-colors hover:bg-[var(--ide-bg-hover)] ${activeTab === "api" ? "text-indigo-400 font-bold bg-indigo-500/5" : "text-[var(--ide-text-secondary)]"}`}
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9" />
                                        </svg>
                                        API Management
                                    </button>
                                </div>
                            )}
                            {activeSidebar === "erd" && (
                                <div className="py-2">
                                    <button
                                        onClick={() => setActiveTab("erd")}
                                        className={`w-full flex items-center gap-2 px-4 py-2 text-xs transition-colors hover:bg-[var(--ide-bg-hover)] ${activeTab === "erd" ? "text-indigo-400 font-bold bg-indigo-500/5" : "text-[var(--ide-text-secondary)]"}`}
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7" />
                                        </svg>
                                        Database Schema
                                    </button>
                                </div>
                            )}
                        </div>
                    </aside>
                )}

                {/* ===== CENTER: Editor Area + Inspector (Visual Mode) ===== */}
                <div className="flex-1 flex overflow-hidden">
                    <main className="flex-1 flex flex-col overflow-hidden bg-[var(--ide-bg)]">
                        {/* Toolbar / Tab Bar */}
                        <div className="h-9 bg-[var(--ide-chrome)] border-b border-[var(--ide-border)] flex items-center flex-shrink-0">
                            {toolbar}
                        </div>

                        {/* Editor Content - switches based on activeTab */}
                        <div className={`flex-1 relative ${terminalOpen ? 'h-[60%]' : ''}`}>
                            {loading && (
                                <div className="absolute inset-0 bg-black/25 backdrop-blur-sm z-50 flex items-center justify-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--ide-primary)]"></div>
                                </div>
                            )}
                            {activeTab === "canvas" && (editMode === "visual" ? canvas : <CodeEditor />)}
                            {activeTab === "logic" && <LogicCanvas />}
                            {activeTab === "api" && <ApiList />}
                            {activeTab === "erd" && <SchemaEditor />}
                        </div>

                        {/* Terminal Panel (toggleable) */}
                        {terminalOpen && terminal && (
                            <div className="h-[35%] border-t border-[var(--ide-border)] bg-[var(--ide-bg)]">
                                <div className="h-8 bg-[var(--ide-chrome)] px-4 flex items-center gap-4 text-xs border-b border-[var(--ide-border)]">
                                    <span className="text-[var(--ide-text)] font-medium">Terminal</span>
                                </div>
                                <div className="h-[calc(100%-2rem)] overflow-auto">
                                    {terminal}
                                </div>
                            </div>
                        )}
                    </main>

                    {/* Inspector Panel (Visual Mode Only - All Tabs) */}
                    {editMode === "visual" && inspectorOpen && <Inspector />}
                </div>
            </div>

            {/* NPM Install Loading Overlay */}
            {loadingMessage && (
                <div className="fixed inset-0 bg-black/55 z-[100] flex items-center justify-center">
                    <div className="bg-[var(--ide-bg-panel)] p-8 rounded-xl shadow-2xl border border-[var(--ide-border-strong)] max-w-2xl w-[90%]">
                        <div className="flex items-center gap-4 mb-4">
                            {!installError && (
                                <div className="animate-spin rounded-full h-10 w-10 border-4 border-[var(--ide-primary)] border-t-transparent"></div>
                            )}
                            {installError && (
                                <div className="h-10 w-10 rounded-full border-4 border-red-500 flex items-center justify-center text-red-500 font-bold">!</div>
                            )}
                            <div>
                                <h3 className="text-[var(--ide-text)] text-lg font-semibold">Setting up project...</h3>
                                <p className="text-[var(--ide-text-secondary)] text-sm">{loadingMessage}</p>
                            </div>
                        </div>
                        {!installError && (
                            <div className="w-full bg-[var(--ide-bg-elevated)] rounded-full h-1.5 overflow-hidden">
                                <div className="h-full bg-[var(--ide-primary)] animate-pulse" style={{ width: '70%' }}></div>
                            </div>
                        )}
                        {installLog && (
                            <pre className="mt-4 max-h-64 overflow-auto text-xs bg-[var(--ide-bg-elevated)] text-[var(--ide-text-secondary)] p-3 rounded border border-[var(--ide-border)] whitespace-pre-wrap">
                                {installLog}
                            </pre>
                        )}
                        {installError && (
                            <div className="mt-4 flex items-center justify-end gap-3">
                                <button
                                    onClick={() => clearInstallStatus()}
                                    className="px-3 py-1.5 text-sm rounded bg-[var(--ide-bg-elevated)] hover:bg-[var(--ide-bg-sidebar)] text-[var(--ide-text)]"
                                >
                                    Close
                                </button>
                                <button
                                    onClick={() => installProjectDependencies()}
                                    className="px-3 py-1.5 text-sm rounded bg-[var(--ide-primary)] hover:bg-[var(--ide-primary-hover)] text-white"
                                >
                                    Retry
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ===== BOTTOM: Enhanced Status Bar ===== */}
            <footer className="h-6 bg-[var(--ide-statusbar)] flex items-center px-3 text-[11px] text-white select-none flex-shrink-0">
                {/* Left side */}
                <div className="flex items-center gap-4">
                    <span className="font-medium">{project?.name || "No Project"}</span>
                    {editMode === "code" && (
                        <>
                            <span className="opacity-60">|</span>
                            <span className="opacity-90">Code Mode</span>
                        </>
                    )}
                </div>

                {/* Right side */}
                <div className="ml-auto flex items-center gap-4">
                    <span className="opacity-90">UTF-8</span>
                    <span className="opacity-90">LF</span>
                    {editMode === "code" && (
                        <button
                            onClick={() => EditorSettingsStore.resetZoom()}
                            className="hover:bg-white/20 px-2 py-0.5 rounded transition-colors opacity-90 hover:opacity-100"
                            title="Click to reset zoom"
                        >
                            Zoom: {editorSettings.zoomLevel}%
                        </button>
                    )}
                    <button
                        onClick={() => setTerminalOpen(!terminalOpen)}
                        className="hover:bg-white/20 px-2 py-0.5 rounded transition-colors"
                    >
                        {terminalOpen ? "Hide Terminal" : "Terminal"}
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
        className={`w-12 h-12 flex items-center justify-center relative group transition-colors ${active ? "text-[var(--ide-text)]" : "text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)]"
            }`}
        onClick={onClick}
        title={label}
        aria-label={label}
    >
        {/* Active indicator bar */}
        {active && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-[var(--ide-primary)]" />
        )}
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d={icon} />
        </svg>
    </button>
);

export default IDELayout;
