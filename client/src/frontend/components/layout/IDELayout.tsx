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
import { setActivePage, toggleTerminal, goBackPage } from "../../stores/projectStore";
import type { FeaturePage } from "../../stores/projectStore";

import { Logo } from "../ui/Logo";
import ThemeToggle from "../ui/ThemeToggle";

// Feature Pages
import UIIdeationPage from "../../pages/UIIdeationPage";
import UseCasesPage from "../../pages/UseCasesPage";
import APIsPage from "../../pages/APIsPage";
import DatabasePage from "../../pages/DatabasePage";
import DiagramsPage from "../../pages/DiagramsPage";
import SourceCodePage from "../../pages/SourceCodePage";
import IdeaPage from "../../pages/IdeaPage";
import SettingsPage from "../../pages/SettingsPage";
import TeamSpacePage from "../../pages/TeamSpacePage";

import InitiationWizard from "../project/InitiationWizard";
import ProjectDashboard from "../../pages/ProjectDashboard";

/* ───── Feature Page Definitions ───── */
interface FeaturePageDef {
    id: FeaturePage;
    label: string;
    icon: string | React.ReactNode;
}

// Used for Title Bar labels and Dashboard cards (but not rail anymore)
const FEATURE_PAGES: FeaturePageDef[] = [
    { id: "dashboard", label: "Dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
    { id: "idea", label: "Project Idea", icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" },
    { id: "ui", label: "UI Design", icon: "M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" },
    { id: "usecases", label: "Use Cases", icon: "M13 10V3L4 14h7v7l9-11h-7z" },
    { id: "apis", label: "APIs", icon: "M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" },
    { id: "database", label: "Database", icon: "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" },
    { id: "diagrams", label: "Diagrams", icon: "M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" },
    { id: "code", label: "Source Code", icon: "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" },
    { id: "settings", label: "Settings", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" },
    { id: "team", label: "Team Space", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" },
];

/**
 * Main IDE Layout — Feature Page Architecture
 */
const IDELayout: React.FC = () => {
    const { project, activePage, loading, terminalOpen, builderActive, pageHistory } = useProjectStore();
    const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);

    const canGoBack = pageHistory && pageHistory.length > 0;

    // Global keyboard shortcut: toggle terminal
    useEffect(() => {
        const toggle = () => toggleTerminal();
        window.addEventListener("akasha:toggle-terminal", toggle);
        return () => window.removeEventListener("akasha:toggle-terminal", toggle);
    }, []);

    /* ─── Render active page ─── */
    const renderPage = () => {
        if (project?.status === "initializing") {
            return <InitiationWizard project={project} projectId={project.id} />;
        }
        switch (activePage) {
            case "dashboard": return <ProjectDashboard />;
            case "idea": return <IdeaPage />;
            case "ui": return <UIIdeationPage />;
            case "usecases": return <UseCasesPage />;
            case "apis": return <APIsPage />;
            case "database": return <DatabasePage />;
            case "diagrams": return <DiagramsPage />;
            case "settings": return <SettingsPage />;
            case "team": return <TeamSpacePage />;
            case "code":
            case "git": return <SourceCodePage />;
            default: return <UIIdeationPage />;
        }
    };

    return (
        <div className="akasha-ide-root h-screen w-screen flex flex-col bg-[var(--ide-bg)] text-[var(--ide-text)] overflow-hidden">

            {/* ===== TOP: Title Bar ===== */}
            {!builderActive && (
                <header className="ide-shell-header h-10 flex items-center justify-between px-4 select-none flex-shrink-0 relative overflow-hidden">
                    <div className="absolute top-0 left-1/4 w-1/4 h-full bg-[var(--ide-accent-subtle)] blur-xl pointer-events-none opacity-50" />
                    <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-[var(--ide-border)]" />

                    {/* Left: App name */}
                    <div className="flex items-center gap-3 relative z-10">
                        {(canGoBack || project?.status === "initializing") && (
                            <button
                                onClick={project?.status === "initializing" ? () => window.location.href = '/dashboard' : goBackPage}
                                className="bg-[var(--ide-accent-subtle)] hover:bg-[var(--ide-bg-elevated)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-colors w-6 h-6 flex items-center justify-center rounded-md border border-[var(--ide-border)] hover:border-[var(--ide-border-strong)] press-effect"
                                title="Go Back"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>
                        )}
                        <button
                            onClick={() => setActivePage("dashboard")}
                            className="flex items-center gap-3 relative group text-left hover:opacity-80 transition-opacity press-effect bg-transparent border-0 p-0 focus:outline-none"
                            title="Go to Project Tools"
                        >
                            <div className="relative flex items-center justify-center">
                                <div className="absolute inset-0 bg-white/10 rounded-lg blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
                                <Logo size={20} className="relative transition-transform duration-300 group-hover:scale-110" />
                            </div>
                            <span className="text-[11px] font-black tracking-[0.2em] text-[var(--ide-text)]">
                                AKASHA
                            </span>
                        </button>
                        <div className="w-[1px] h-3.5 bg-[var(--ide-border)]" />
                        <div className="px-2 py-0.5 rounded-md bg-[var(--ide-accent-subtle)] border border-[var(--ide-border)] flex items-center">
                            <span className="text-[9px] font-semibold text-[var(--ide-text-secondary)] tracking-wider uppercase">
                                {project?.name || ""}
                            </span>
                        </div>
                    </div>

                    {/* Center: Feature Page Name */}
                    <div className="flex-1 flex justify-center items-center relative z-10">
                        <div className="px-4 py-1 rounded-full bg-[var(--ide-accent-subtle)] border border-[var(--ide-border)] flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-[var(--ide-primary)] shadow-[0_0_8px_rgba(37,99,235,0.3)]" />
                            <span
                                key={activePage}
                                className="text-[9px] font-bold uppercase tracking-[0.25em] text-[var(--ide-text-secondary)] page-shell-enter"
                            >
                                {project?.status === "initializing" ? "Project Initiation Wizard" : (FEATURE_PAGES.find(p => p.id === activePage)?.label || "Dashboard")}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 relative z-10">
                        <ThemeToggle size="sm" />
                    </div>
                </header>
            )}

            {/* ===== MAIN CONTENT AREA ===== */}
            <div className="flex-1 flex overflow-hidden p-0 gap-0 bg-[var(--ide-bg)]">

                {/* ===== LEFT: Feature Navigation Rail ===== */}
                {!builderActive && project?.status !== "initializing" && (
                    <aside className={`ide-shell-sidebar transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${isSidebarExpanded ? 'w-48 items-start px-2' : 'w-14 items-center'} flex flex-col py-3 flex-shrink-0 border-y-0 border-l-0 border-r border-[var(--ide-border)] relative overflow-hidden`}>
                        <div className="absolute inset-0 bg-gradient-to-b from-[var(--ide-accent-subtle)] to-transparent pointer-events-none opacity-60" />

                        {/* Project Tools */}
                        <NavRailIcon
                            icon="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                            label="Project Tools"
                            active={activePage === "dashboard"}
                            onClick={() => setActivePage("dashboard")}
                            expanded={isSidebarExpanded}
                        />
                        {/* Workshop */}
                        <NavRailIcon
                            icon="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                            label="AI Workshop"
                            active={activePage === "idea"}
                            onClick={() => setActivePage("idea")}
                            expanded={isSidebarExpanded}
                        />
                        {/* Team Space */}
                        <NavRailIcon
                            icon="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                            label="Team Space"
                            active={activePage === "team"}
                            onClick={() => setActivePage("team")}
                            expanded={isSidebarExpanded}
                        />

                        {/* Spacer */}
                        <div className="flex-1" />

                        {/* Settings */}
                        <NavRailIcon
                            icon="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                            label="Settings"
                            active={activePage === "settings"}
                            onClick={() => setActivePage("settings")}
                            expanded={isSidebarExpanded}
                        />

                        {/* Back to Website */}
                        <NavRailIcon
                            icon="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                            label="Back to Website"
                            active={false}
                            onClick={() => window.location.href = '/dashboard'}
                            expanded={isSidebarExpanded}
                        />

                        {/* Expand/Collapse Toggle */}
                        <div className="mt-2 pt-2 border-t border-[var(--ide-border)] w-full">
                            <button
                                className={`h-10 mx-auto flex items-center ${isSidebarExpanded ? 'w-full justify-start px-3' : 'w-10 justify-center'} rounded-xl transition-all duration-300 text-[var(--ide-nav-text)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-accent-subtle)]`}
                                onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
                                title={isSidebarExpanded ? "Collapse Sidebar" : "Expand Sidebar"}
                            >
                                <svg className={`w-4 h-4 transition-transform duration-300 ${isSidebarExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                                </svg>
                                {isSidebarExpanded && <span className="ml-3 text-xs font-semibold uppercase tracking-wider">Collapse</span>}
                            </button>
                        </div>
                    </aside>
                )}

                {/* ===== CENTER: Page Content + Terminal ===== */}
                <div className="flex-1 flex flex-col overflow-hidden min-w-0 bg-[var(--ide-bg)]">
                    {/* Page Content */}
                    <div
                        key={activePage}
                        className={`ide-page flex-1 relative overflow-hidden page-shell-enter-strong ${terminalOpen ? "h-[60%]" : ""}`}
                    >
                        {loading && (
                            <div className="absolute inset-0 bg-[var(--bg-overlay,rgba(0,0,0,0.25))] backdrop-blur-sm z-50 flex items-center justify-center">
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
                        </div>
                    )}
                </div>
            </div>

        </div>
    );
};

/* ===== Navigation Rail Icon ===== */
interface NavRailIconProps {
    icon: string;
    label: string;
    active: boolean;
    onClick: () => void;
    expanded?: boolean;
}

const NavRailIcon: React.FC<NavRailIconProps> = ({ icon, label, active, onClick, expanded }) => (
    <button
        className={`h-10 mx-auto my-0.5 flex items-center relative group rounded-xl transition-all duration-300 press-effect overflow-hidden ${expanded ? "w-full justify-start px-3" : "w-10 justify-center"
            } ${active
                ? "text-[var(--ide-nav-active)] bg-[var(--ide-accent-muted)] border border-[var(--ide-border)]"
                : "text-[var(--ide-nav-text)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-accent-subtle)]"
            }`}
        onClick={onClick}
        title={!expanded ? label : undefined}
        aria-label={label}
    >
        {/* Active glow */}
        {active && !expanded && (
            <>
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[1px] h-4 bg-[var(--ide-primary)] rounded-r-full" />
                <div className="absolute inset-0 rounded-xl bg-[var(--ide-accent-muted)] blur-sm" />
            </>
        )}
        <svg className="w-[18px] h-[18px] shrink-0 relative z-10 transition-transform duration-300 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d={icon} />
        </svg>

        {expanded && (
            <span className="ml-3 text-[11px] font-semibold tracking-wider whitespace-nowrap overflow-hidden text-ellipsis relative z-10">
                {label}
            </span>
        )}
    </button>
);

export default IDELayout;
