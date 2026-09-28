/**
 * IDE Layout Component — Pure Apple Minimalism (Zero Icons)
 *
 * Implements:
 * - 100% typography-driven navigation (no icons)
 * - Liquid glass light & tinted aesthetic
 * - Fluid ambient background
 * - Unobtrusive, focused creative canvas
 */

import React, { lazy, Suspense, useEffect, useState } from "react";
import { useProjectStore } from "../../hooks/useProjectStore";
import { setActivePage, toggleTerminal, goBackPage, closeProject } from "../../stores/projectStore";
import type { FeaturePage } from "../../stores/projectStore";
import { useBackgroundLoading } from "../../context/BackgroundLoadingContext";

// Feature Pages
import { LiquidBackground } from "../ui/LiquidGlass";
const UIIdeationPage = lazy(() => import("../../pages/UIIdeationPage"));
const UseCasesPage = lazy(() => import("../../pages/UseCasesPage"));
const APIsPage = lazy(() => import("../../pages/APIsPage"));
const DatabasePage = lazy(() => import("../../pages/DatabasePage"));
const DiagramsPage = lazy(() => import("../../pages/DiagramsPage"));
const SourceCodePage = lazy(() => import("../../pages/SourceCodePage"));
const IdeaPage = lazy(() => import("../../pages/IdeaPage"));
const SettingsPage = lazy(() => import("../../pages/SettingsPage"));
const TeamSpacePage = lazy(() => import("../../pages/TeamSpacePage"));
const InitiationWizard = lazy(() => import("../project/InitiationWizard"));
const ProjectDashboard = lazy(() => import("../../pages/ProjectDashboard"));

import {
    LayoutDashboard,
    Sparkles,
    Network,
    Palette,
    Database,
    Cable,
    GitFork,
    Code2,
    Users,
    Settings,
    LogOut,
    PanelLeftClose,
    PanelLeftOpen,
} from "lucide-react";

/* ───── Navigation Item Definitions ───── */
export interface AsideNavItemDef {
    id: FeaturePage | "exit";
    label: string;
    shortLabel: string;
    badge?: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
}

const BLUEPRINT_NAV_ITEMS: AsideNavItemDef[] = [
    {
        id: "dashboard",
        label: "Mission Hub",
        shortLabel: "Hub",
        badge: "01",
        description: "Project overview",
        icon: LayoutDashboard,
    },
    {
        id: "idea",
        label: "AI Workshop",
        shortLabel: "Idea",
        badge: "AI",
        description: "Plan the product",
        icon: Sparkles,
    },
    {
        id: "diagrams",
        label: "Diagrams & ERD",
        shortLabel: "Draw",
        badge: "ARCH",
        description: "Map the architecture",
        icon: Network,
    },
    {
        id: "ui",
        label: "UI Studio",
        shortLabel: "UI",
        badge: "PROT",
        description: "Build the interface",
        icon: Palette,
    },
];

const ENGINEERING_NAV_ITEMS: AsideNavItemDef[] = [
    {
        id: "database",
        label: "Data Models",
        shortLabel: "Data",
        badge: "SQL",
        description: "Manage data",
        icon: Database,
    },
    {
        id: "apis",
        label: "REST APIs",
        shortLabel: "APIs",
        badge: "REST",
        description: "Manage endpoints",
        icon: Cable,
    },
    {
        id: "usecases",
        label: "Workflows",
        shortLabel: "Cases",
        badge: "FLOW",
        description: "Map workflows",
        icon: GitFork,
    },
    {
        id: "code",
        label: "Source Code",
        shortLabel: "Code",
        badge: "SRC",
        description: "Edit source",
        icon: Code2,
    },
];

const WORKSPACE_NAV_ITEMS: AsideNavItemDef[] = [
    {
        id: "team",
        label: "Team Space",
        shortLabel: "Team",
        badge: "SYNC",
        description: "Manage the team",
        icon: Users,
    },
];

const SETTINGS_NAV_ITEM: AsideNavItemDef = {
    id: "settings",
    label: "Settings",
    shortLabel: "Prefs",
    badge: "CFG",
    description: "App preferences",
    icon: Settings,
};

const EXIT_NAV_ITEM: AsideNavItemDef = {
    id: "exit",
    label: "Exit Project",
    shortLabel: "Exit",
    badge: "ESC",
    description: "Return to projects",
    icon: LogOut,
};

/**
 * Main IDE Layout — Sleek Liquid Glass Cyberpunk Architecture
 */
const IDELayout: React.FC = () => {
    const { project, activePage, loading, terminalOpen, builderActive, pageHistory } = useProjectStore();
    const { is3DFocused, setIs3DFocused, isLoading, activeTasks } = useBackgroundLoading();
    const [isSidebarExpanded, setIsSidebarExpanded] = useState(() => {
        try {
            return localStorage.getItem("akasha:sidebar-expanded") === "true";
        } catch {
            return false;
        }
    });
    const isWorking = isLoading || activeTasks.length > 0;

    const toggleSidebar = () => {
        setIsSidebarExpanded((prev) => {
            const next = !prev;
            try {
                localStorage.setItem("akasha:sidebar-expanded", String(next));
            } catch {}
            return next;
        });
    };

    // Keyboard shortcut for toggling sidebar (Ctrl+B or Cmd+B)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
                const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
                if (tag !== "input" && tag !== "textarea") {
                    e.preventDefault();
                    toggleSidebar();
                }
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

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
            case "settings": return <SettingsPage onBack={() => (canGoBack ? goBackPage() : setActivePage("dashboard"))} />;
            case "team": return <TeamSpacePage />;
            case "source":
            case "code":
            case "git": return <SourceCodePage />;
            default: return <UIIdeationPage />;
        }
    };

    return (
        <div className={`akasha-ide-root h-screen w-screen flex flex-col bg-[#f8fafc] dark:bg-[#07080c] text-neutral-900 dark:text-neutral-100 overflow-hidden relative selection:bg-blue-500/20 ${isWorking ? 'code-runtime-active' : ''} ${is3DFocused ? 'is-3d-focused' : ''}`}>
            {/* Ambient 3D WebGL Code Runtime & Liquid Mesh Background (Always Visible & Light) */}
            <LiquidBackground />
            {/* ===== TOP: Apple Liquid Glass Title Bar (Zero Icons) ===== */}
            {!builderActive && (
                <header className="h-12 flex items-center justify-between px-4 select-none flex-shrink-0 relative z-20 backdrop-blur-[32px] saturate-[210%] bg-white/75 dark:bg-black/55 border-b border-black/[0.08] dark:border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_30px_rgba(0,0,0,0.6)]">
                    {/* Left: App & Project */}
                    <div className="flex items-center gap-2.5 relative z-10">
                        <button
                            onClick={() => {
                                if (project?.status === "initializing") {
                                    closeProject();
                                } else if (activePage !== "dashboard") {
                                    if (canGoBack) goBackPage();
                                    else setActivePage("dashboard");
                                } else {
                                    closeProject();
                                }
                            }}
                            className="px-3 py-1 text-[11px] font-bold tracking-tight rounded-full bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.14] border border-black/[0.08] dark:border-white/10 text-neutral-800 dark:text-neutral-200 transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-[0.97]"
                        >
                            <span className="font-mono text-[10px]">←</span>
                            <span>{activePage === "dashboard" ? "Projects" : "Back"}</span>
                        </button>

                        <button
                            onClick={() => closeProject()}
                            className="text-xs font-black tracking-widest uppercase text-neutral-950 dark:text-white hover:opacity-75 transition-opacity bg-transparent border-0 p-0 focus:outline-none cursor-pointer"
                        >
                            Akasha
                        </button>

                        <span className="text-neutral-400 dark:text-neutral-600 font-light text-xs">/</span>

                        <div className="px-3 py-1 rounded-full bg-black/[0.04] dark:bg-white/[0.07] border border-black/[0.08] dark:border-white/10 shadow-xs flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse" />
                            <span className="text-[11px] font-semibold text-neutral-900 dark:text-neutral-100 tracking-tight">
                                {project?.name || "Project"}
                            </span>
                        </div>
                    </div>

                    {/* Spacer */}
                    <div className="flex-1" />
                </header>
            )}

            {/* ===== MAIN CONTENT AREA ===== */}
            <div className={`akasha-foreground-content flex-1 flex overflow-hidden p-0 gap-0 bg-transparent transition-all duration-500 ${is3DFocused ? 'opacity-15 pointer-events-none scale-[0.985] blur-xs' : 'opacity-100'}`}>

                {/* ===== LEFT: Feature Navigation Rail ===== */}
                {!builderActive && project?.status !== "initializing" && (
                    <aside
                        className={`ide-shell-sidebar transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                            isSidebarExpanded ? "w-[236px] px-2.5" : "w-[68px] px-2"
                        } flex flex-col py-2.5 flex-shrink-0 border-y-0 border-l-0 border-r border-black/[0.06] dark:border-white/[0.08] backdrop-blur-[36px] saturate-[210%] bg-white/85 dark:bg-[#07090e]/85 shadow-[4px_0_24px_rgba(0,0,0,0.02)] dark:shadow-[4px_0_35px_rgba(0,0,0,0.55)] relative overflow-hidden z-20`}
                    >
                        {/* Specular lighting accents */}
                        <div className="absolute top-0 right-0 bottom-0 w-[1px] bg-gradient-to-b from-cyan-400/40 via-blue-500/20 to-transparent pointer-events-none" />
                        <div className="absolute top-0 left-0 right-0 h-28 bg-gradient-to-b from-cyan-500/[0.06] via-blue-500/[0.02] to-transparent pointer-events-none" />

                        {/* Top: Section Navigation List */}
                        <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-3 py-1 pr-0.5 custom-scrollbar">
                            {/* Blueprint Group */}
                            <div className="space-y-1">
                                {isSidebarExpanded ? (
                                    <div className="px-2 pt-1 pb-1 flex items-center justify-between text-[9px] font-mono font-bold tracking-widest uppercase text-neutral-400 dark:text-neutral-500 select-none">
                                        <span>Blueprint</span>
                                        <span className="text-[8px] text-cyan-600 dark:text-cyan-400">SPEC</span>
                                    </div>
                                ) : (
                                    <div className="h-[1px] bg-black/[0.04] dark:bg-white/[0.06] my-1 mx-2" />
                                )}
                                {BLUEPRINT_NAV_ITEMS.map((item) => (
                                    <AsideNavItem
                                        key={item.id}
                                        item={item}
                                        active={activePage === item.id}
                                        expanded={isSidebarExpanded}
                                        onClick={() => setActivePage(item.id as FeaturePage)}
                                    />
                                ))}
                            </div>

                            {/* Engineering Group */}
                            <div className="space-y-1">
                                {isSidebarExpanded ? (
                                    <div className="px-2 pt-2 pb-1 flex items-center justify-between text-[9px] font-mono font-bold tracking-widest uppercase text-neutral-400 dark:text-neutral-500 select-none">
                                        <span>Engineering</span>
                                        <span className="text-[8px] text-blue-600 dark:text-blue-400">CORE</span>
                                    </div>
                                ) : (
                                    <div className="h-[1px] bg-black/[0.04] dark:bg-white/[0.06] my-1 mx-2" />
                                )}
                                {ENGINEERING_NAV_ITEMS.map((item) => (
                                    <AsideNavItem
                                        key={item.id}
                                        item={item}
                                        active={activePage === item.id}
                                        expanded={isSidebarExpanded}
                                        onClick={() => setActivePage(item.id as FeaturePage)}
                                    />
                                ))}
                            </div>

                            {/* Workspace Group */}
                            <div className="space-y-1">
                                {isSidebarExpanded ? (
                                    <div className="px-2 pt-2 pb-1 flex items-center justify-between text-[9px] font-mono font-bold tracking-widest uppercase text-neutral-400 dark:text-neutral-500 select-none">
                                        <span>Workspace</span>
                                        <span className="text-[8px] text-emerald-600 dark:text-emerald-400">TEAM</span>
                                    </div>
                                ) : (
                                    <div className="h-[1px] bg-black/[0.04] dark:bg-white/[0.06] my-1 mx-2" />
                                )}
                                {WORKSPACE_NAV_ITEMS.map((item) => (
                                    <AsideNavItem
                                        key={item.id}
                                        item={item}
                                        active={activePage === item.id}
                                        expanded={isSidebarExpanded}
                                        onClick={() => setActivePage(item.id as FeaturePage)}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Bottom Utility (Settings, Exit, Collapse) */}
                        <div className="pt-2 border-t border-black/[0.06] dark:border-white/10 space-y-1 shrink-0 w-full">
                            <AsideNavItem
                                item={SETTINGS_NAV_ITEM}
                                active={activePage === "settings"}
                                expanded={isSidebarExpanded}
                                onClick={() => setActivePage("settings")}
                            />
                            <AsideNavItem
                                item={EXIT_NAV_ITEM}
                                active={false}
                                expanded={isSidebarExpanded}
                                onClick={() => closeProject()}
                                variant="danger"
                            />

                            <button
                                type="button"
                                onClick={toggleSidebar}
                                title={isSidebarExpanded ? "Collapse Sidebar (Ctrl+B)" : "Expand Sidebar (Ctrl+B)"}
                                className={`w-full h-8 flex items-center rounded-xl transition-all duration-200 select-none cursor-pointer text-neutral-500 hover:text-neutral-900 dark:hover:text-white ${
                                    isSidebarExpanded
                                        ? "px-2.5 justify-between bg-black/[0.03] dark:bg-white/[0.04] hover:bg-black/[0.06] dark:hover:bg-white/[0.08] border border-black/[0.05] dark:border-white/10"
                                        : "justify-center hover:bg-black/[0.04] dark:hover:bg-white/[0.08]"
                                }`}
                            >
                                {isSidebarExpanded ? (
                                    <>
                                        <div className="flex items-center gap-2">
                                            <PanelLeftClose className="w-3.5 h-3.5 text-neutral-500" />
                                            <span className="text-[10px] font-mono font-bold tracking-wider uppercase">Collapse</span>
                                        </div>
                                        <kbd className="text-[9px] font-mono text-neutral-400 dark:text-neutral-500 bg-black/[0.05] dark:bg-white/[0.07] px-1.5 py-0.5 rounded">
                                            ^B
                                        </kbd>
                                    </>
                                ) : (
                                    <PanelLeftOpen className="w-4 h-4 text-neutral-500 hover:text-cyan-400 transition-colors" />
                                )}
                            </button>
                        </div>
                    </aside>
                )}

                {/* ===== CENTER: Page Content + Terminal ===== */}
                <div className="flex-1 flex flex-col overflow-hidden min-w-0 bg-transparent">
                    {/* Page Content */}
                    <div
                        key={activePage}
                        className={`ide-page flex-1 relative overflow-hidden page-shell-enter ${terminalOpen ? "h-[60%]" : ""}`}
                    >
                        {loading && (
                            <div className="absolute inset-0 bg-white/40 dark:bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center">
                                <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                                    Loading...
                                </span>
                            </div>
                        )}
                        <Suspense fallback={<PageLoadingState />}>
                            {renderPage()}
                        </Suspense>
                    </div>

                    {/* Terminal Panel (toggleable) */}
                    {terminalOpen && (
                        <div className="h-[35%] border-t border-white/40 dark:border-white/10 bg-white/[0.6] dark:bg-neutral-900/[0.6] backdrop-blur-xl">
                            <div className="h-7 px-3 flex items-center gap-4 text-[11px] border-b border-white/40 dark:border-white/10 text-neutral-600 dark:text-neutral-400 font-medium">
                                <span>Terminal</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* 3D Horizon Inspection Return Button */}
            {is3DFocused && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-bounce">
                    <button
                        type="button"
                        onClick={() => setIs3DFocused(false)}
                        className="px-5 py-2.5 rounded-full bg-[#070b14]/95 hover:bg-[#0f172a] text-cyan-300 border border-cyan-400/60 backdrop-blur-2xl font-bold text-xs shadow-[0_12px_40px_rgba(6,182,212,0.45)] flex items-center gap-2.5 cursor-pointer transition-all active:scale-95"
                    >
                        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                        <span>3D Horizon View Active • Click to Return to Project</span>
                        <span className="text-neutral-400 font-mono text-sm">✕</span>
                    </button>
                </div>
            )}
        </div>
    );
};

const PageLoadingState: React.FC = () => (
    <div className="h-full w-full flex items-center justify-center text-xs text-neutral-500 dark:text-neutral-400">
        Loading workspace...
    </div>
);

/* ===== Aside Navigation Item with Liquid Glass Aesthetics & Lucide Icons ===== */
interface AsideNavItemProps {
    item: AsideNavItemDef;
    active: boolean;
    expanded: boolean;
    onClick: () => void;
    variant?: "default" | "danger";
}

const AsideNavItem: React.FC<AsideNavItemProps> = ({
    item,
    active,
    expanded,
    onClick,
    variant = "default",
}) => {
    const Icon = item.icon;
    const isDanger = variant === "danger";

    return (
        <button
            type="button"
            onClick={onClick}
            title={!expanded ? `${item.label} • ${item.description || item.badge || ""}` : undefined}
            className={`group relative w-full flex items-center select-none cursor-pointer rounded-xl transition-all duration-200 outline-none ${
                expanded ? "h-9 px-2.5 justify-start gap-2.5" : "h-10 px-0 justify-center"
            } ${
                active
                    ? "bg-gradient-to-r from-cyan-500/18 via-blue-500/12 to-transparent dark:from-cyan-400/22 dark:via-blue-500/15 dark:to-transparent text-cyan-900 dark:text-cyan-100 border border-cyan-500/35 dark:border-cyan-400/40 shadow-[0_0_20px_rgba(6,182,212,0.18)] font-semibold"
                    : isDanger
                    ? "text-neutral-500 dark:text-neutral-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/25 border border-transparent font-medium"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-100 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] hover:border-black/[0.05] dark:hover:border-white/10 border border-transparent font-medium"
            }`}
        >
            {/* Glowing Accent Indicator Bar when active */}
            {active && (
                <span className="absolute left-1 top-2 bottom-2 w-1 rounded-full bg-gradient-to-b from-cyan-400 to-blue-500 shadow-[0_0_10px_rgba(6,182,212,0.9)] animate-pulse" />
            )}

            {/* Icon */}
            <div
                className={`flex items-center justify-center shrink-0 transition-all duration-200 ${
                    expanded ? "w-5 h-5 ml-1" : "w-8 h-8 rounded-lg"
                } ${
                    active
                        ? "text-cyan-600 dark:text-cyan-300 drop-shadow-[0_0_8px_rgba(6,182,212,0.55)] scale-105"
                        : isDanger
                        ? "text-neutral-500 dark:text-neutral-400 group-hover:text-rose-500 group-hover:scale-110"
                        : "text-neutral-500 dark:text-neutral-400 group-hover:text-cyan-500 dark:group-hover:text-cyan-300 group-hover:scale-110"
                }`}
            >
                <Icon className="w-4 h-4 stroke-[2]" />
            </div>

            {/* Expanded Label + Mono Badge */}
            {expanded && (
                <div className="flex-1 flex items-center justify-between min-w-0 pr-0.5">
                    <span className="text-[11px] font-medium tracking-tight truncate">
                        {item.label}
                    </span>
                    {item.badge && (
                        <span
                            className={`text-[8.5px] font-mono px-1.5 py-0.2 rounded uppercase tracking-wider shrink-0 transition-colors ${
                                active
                                    ? "bg-cyan-500/20 text-cyan-800 dark:text-cyan-300 border border-cyan-400/40 font-bold"
                                    : "bg-black/[0.04] dark:bg-white/[0.06] text-neutral-500 dark:text-neutral-400 border border-black/[0.06] dark:border-white/10 font-medium"
                            }`}
                        >
                            {item.badge}
                        </span>
                    )}
                </div>
            )}
        </button>
    );
};

export default IDELayout;
