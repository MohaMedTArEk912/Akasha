/**
 * IDE Layout Component — Feature-Page Architecture
 *
 * Layout structure:
 * ┌──────────────────────────────────────────────┐
 * │  Title Bar                                    │
 * ├──────┬───────────────────────────────────────┤
 * │ Nav  │  [Feature Page Content]               │
 * │ Rail │  (Hub & Spoke Model)                  │
 * │      │                                       │
 * ├──────┴───────────────────────────────────────┤
 * │  Status Bar                                   │
 * └──────────────────────────────────────────────┘
 */

import React, { useEffect, useState } from "react";
import { useProjectStore } from "../../hooks/useProjectStore";
import { setActivePage, installProjectDependencies, clearInstallStatus, toggleTerminal } from "../../stores/projectStore";
import type { FeaturePage } from "../../stores/projectStore";



import ProjectSettingsModal from "../Modals/ProjectSettingsModal";

import Terminal from "../Terminal/Terminal";
import { Logo } from "../Shared/Logo";

// Feature Pages
import UIDesignPage from "../Pages/UIDesignPage";
import UseCasesPage from "../Pages/UseCasesPage";
import APIsPage from "../Pages/APIsPage";
import DatabasePage from "../Pages/DatabasePage";
import DiagramsPage from "../Pages/DiagramsPage";
import SourceCodePage from "../Pages/SourceCodePage";

import ProjectDashboard from "../Pages/ProjectDashboard";

/* ───── Feature Page Definitions ───── */
interface FeaturePageDef {
    id: FeaturePage;
    label: string;
    icon: string;
}

// Used for Title Bar labels and Dashboard cards (but not rail anymore)
const FEATURE_PAGES: FeaturePageDef[] = [
    { id: "dashboard", label: "Dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
    { id: "ui", label: "UI Design", icon: "M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" },
    { id: "usecases", label: "Use Cases", icon: "M13 10V3L4 14h7v7l9-11h-7z" },
    { id: "apis", label: "APIs", icon: "M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" },
    { id: "database", label: "Database", icon: "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" },
    { id: "diagrams", label: "Diagrams", icon: "M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" },
    { id: "code", label: "Source Code", icon: "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" },
];

/**
 * Main IDE Layout — Feature Page Architecture
 */
const IDELayout: React.FC = () => {
    const { project, activePage, loading, loadingMessage, installLog, installError, terminalOpen } = useProjectStore();
    const [settingsOpen, setSettingsOpen] = useState(false);

    // Global keyboard shortcut: toggle terminal
    useEffect(() => {
        const toggle = () => toggleTerminal();
        window.addEventListener("akasha:toggle-terminal", toggle);
        return () => window.removeEventListener("akasha:toggle-terminal", toggle);
    }, []);

    /* ─── Render active page ─── */
    const renderPage = () => {
        switch (activePage) {
            case "dashboard": return <ProjectDashboard />;
            case "ui": return <UIDesignPage />;
            case "usecases": return <UseCasesPage />;
            case "apis": return <APIsPage />;
            case "database": return <DatabasePage />;
            case "diagrams": return <DiagramsPage />;
            case "code":
            case "git": return <SourceCodePage />;
            default: return <UIDesignPage />;
        }
    };

    /* When the UI Design page is active, give it full viewport control
       — it has its own TopActionBar, sidebars, and canvas. */
    if (activePage === "ui") {
        return (
            <div className="h-screen w-screen flex flex-col bg-[var(--ide-bg)] text-[var(--ide-text)] overflow-hidden">
                <div className="flex-1 overflow-hidden">
                    {renderPage()}
                </div>
                <ProjectSettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
            </div>
        );
    }

    return (
        <div className="h-screen w-screen flex flex-col bg-[var(--ide-bg)] text-[var(--ide-text)] overflow-hidden">

            {/* ===== TOP: Title Bar ===== */}
            <header
                className="h-10 bg-[#050508] border-b border-white/[0.04] flex items-center justify-between px-4 select-none flex-shrink-0 relative overflow-hidden"
                data-tauri-drag-region
            >
                {/* Background glow effects */}
                <div className="absolute top-0 left-1/4 w-1/4 h-full bg-indigo-500-[0.02] blur-xl pointer-events-none" />
                <div className="absolute top-0 right-1/3 w-1/6 h-full bg-purple-500-[0.02] blur-xl pointer-events-none" />

                {/* Subtle gradient line at bottom */}
                <div className="absolute bottom-0 left-0 right-0 h-[1px]" style={{
                    background: "linear-gradient(90deg, transparent 0%, rgba(99,102,241,0.15) 50%, transparent 100%)"
                }} />

                {/* Left: App name */}
                <div className="flex items-center gap-3 relative z-10" data-tauri-drag-region>
                    <div className="relative group flex items-center justify-center">
                        <div className="absolute inset-0 bg-indigo-500/20 rounded-lg blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
                        <Logo size={20} className="relative transition-transform duration-300 group-hover:scale-110" />
                    </div>
                    <span className="text-[11px] font-black tracking-[0.2em] text-white/90 drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]" data-tauri-drag-region>
                        AKASHA
                    </span>
                    <div className="w-[1px] h-3.5 bg-white/[0.08]" />
                    <div className="px-2 py-0.5 rounded-md bg-white/[0.02] border border-white/[0.04] flex items-center">
                        <span className="text-[9px] font-semibold text-white/50 tracking-wider uppercase" data-tauri-drag-region>
                            {project?.name || ""}
                        </span>
                    </div>
                </div>

                {/* Center: Feature Page Name */}
                <div className="flex-1 flex justify-center items-center relative z-10" data-tauri-drag-region>
                    <div className="px-4 py-1 rounded-full bg-white/[0.02] border border-white/[0.03] flex items-center gap-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
                        <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-indigo-100/70" data-tauri-drag-region>
                            {FEATURE_PAGES.find(p => p.id === activePage)?.label || "Dashboard"}
                        </span>
                    </div>
                </div>

                {/* Right: Empty space for balance */}
                <div className="flex items-center gap-3 opacity-0 pointer-events-none" aria-hidden="true">
                    {/* Mirroring left side width roughly for true center alignment */}
                    <div className="w-20"></div>
                </div>
            </header>

            {/* ===== MAIN CONTENT AREA ===== */}
            <div className="flex-1 flex overflow-hidden">

                {/* ===== LEFT: Feature Navigation Rail ===== */}
                <aside className="w-14 bg-[#0c0c14] flex flex-col items-center py-3 flex-shrink-0 border-r border-white/[0.06] relative">
                    {/* Subtle gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/[0.03] to-transparent pointer-events-none" />

                    {/* Home (Dashboard) */}
                    <NavRailIcon
                        icon="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                        label="Dashboard"
                        active={activePage === "dashboard"}
                        onClick={() => setActivePage("dashboard")}
                    />

                    {/* Spacer */}
                    <div className="flex-1" />

                    {/* Settings */}
                    <NavRailIcon
                        icon="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                        label="Settings"
                        active={settingsOpen}
                        onClick={() => setSettingsOpen(true)}
                    />
                </aside>

                {/* ===== CENTER: Page Content + Terminal ===== */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Page Content */}
                    <div className={`flex-1 relative overflow-hidden ${terminalOpen ? "h-[60%]" : ""}`}>
                        {loading && (
                            <div className="absolute inset-0 bg-black/25 backdrop-blur-sm z-50 flex items-center justify-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--ide-primary)]"></div>
                            </div>
                        )}
                        {renderPage()}
                    </div>

                    {/* Terminal Panel (toggleable) */}
                    {terminalOpen && (
                        <div className="h-[35%] border-t border-[var(--ide-border)] bg-[var(--ide-bg)]">
                            <div className="h-8 bg-[var(--ide-chrome)] px-4 flex items-center gap-4 text-xs border-b border-[var(--ide-border)]">
                                <span className="text-[var(--ide-text)] font-medium">Terminal</span>
                            </div>
                            <div className="h-[calc(100%-2rem)] overflow-auto">
                                <Terminal />
                            </div>
                        </div>
                    )}
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

            {/* ===== BOTTOM: Status Bar (hidden on code page — CodeEditor has its own) ===== */}
            {activePage !== "code" && activePage !== "git" && activePage !== "dashboard" && (
                <footer className="h-6 bg-[var(--ide-statusbar)] flex items-center px-3 text-[11px] text-white select-none flex-shrink-0">
                    {/* Left side */}
                    <div className="flex items-center gap-4">
                        <span className="font-medium">{project?.name || "No Project"}</span>
                        <span className="opacity-60">|</span>
                        <span className="opacity-90 capitalize">{activePage}</span>
                    </div>

                    {/* Right side */}
                    <div className="ml-auto flex items-center gap-4">
                        <span className="opacity-90">UTF-8</span>
                        <span className="opacity-90">LF</span>
                        <button
                            onClick={() => toggleTerminal()}
                            className="hover:bg-white/20 px-2 py-0.5 rounded transition-colors"
                        >
                            {terminalOpen ? "Hide Terminal" : "Terminal"}
                        </button>
                    </div>
                </footer>
            )}

            {/* Settings Modal */}
            <ProjectSettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
        </div>
    );
};

/* ===== Navigation Rail Icon ===== */
interface NavRailIconProps {
    icon: string;
    label: string;
    active: boolean;
    onClick: () => void;
}

const NavRailIcon: React.FC<NavRailIconProps> = ({ icon, label, active, onClick }) => (
    <button
        className={`w-10 h-10 mx-auto my-0.5 flex items-center justify-center relative group rounded-xl transition-all duration-300 ${active
            ? "text-indigo-400 bg-indigo-500/15"
            : "text-white/30 hover:text-white/70 hover:bg-white/[0.06]"
            }`}
        onClick={onClick}
        title={label}
        aria-label={label}
    >
        {/* Active glow */}
        {active && (
            <>
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-5 bg-indigo-400 rounded-r-full" />
                <div className="absolute inset-0 rounded-xl bg-indigo-500/10 blur-md" />
            </>
        )}
        <svg className="w-[18px] h-[18px] relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d={icon} />
        </svg>
    </button>
);

export default IDELayout;
