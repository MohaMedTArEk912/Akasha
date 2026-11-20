/**
 * Akasha Workspace Layout — Daylight Architectural Studio Shell
 *
 * Clean, lightweight navigation without 3D WebGL clock clutter:
 * - Unified top bar with Breadcrumbs, Global Quick Jump (⌘K), Live Prototype link, and Light/Dark Toggle
 * - Smooth spring-animated sidebar rail with plain-English navigation and Launch Readiness meter
 * - Responsive mobile drawer for small screens
 * - Crisp AnimatePresence view transitions
 */

import React, { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useProjectStore } from "../../hooks/useProjectStore";
import { setActivePage, toggleTerminal, goBackPage, closeProject } from "../../stores/projectStore";
import type { FeaturePage } from "../../stores/projectStore";
import { useBackgroundLoading } from "../../context/BackgroundLoadingContext";
import { useTheme } from "../../context/ThemeContext";
import { useToast } from "../../context/ToastContext";
import ThemeToggle from "../ui/ThemeToggle";
import { Logo } from "../ui/Logo";
import { useDocumentMeta } from "../../hooks/useDocumentMeta";
import { fetchReleaseReadiness } from "../../services/akashaV2Service";

const ProductHubPage = lazy(() => import("../../pages/ProductHubPage"));
const ScopeFeaturesPage = lazy(() => import("../../pages/ScopeFeaturesPage"));
const InteractiveStudioPage = lazy(() => import("../../pages/InteractiveStudioPage"));
const SystemBlueprintPage = lazy(() => import("../../pages/SystemBlueprintPage"));
const BuildShipPage = lazy(() => import("../../pages/BuildShipPage"));
const SettingsPage = lazy(() => import("../../pages/SettingsPage"));
const InitiationWizard = lazy(() => import("../project/InitiationWizard"));

import {
  LayoutGrid,
  Layers,
  Play,
  Database,
  Rocket,
  Settings,
  ArrowLeft,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  ExternalLink,
  Menu,
  X,
  Sun,
  Moon,
  Copy,
  CheckCircle2,
} from "lucide-react";

type CanonicalView = "hub" | "scope" | "studio" | "blueprint" | "build" | "settings";

export interface AsideNavItemDef {
  id: CanonicalView;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const PRIMARY_NAV_ITEMS: AsideNavItemDef[] = [
  {
    id: "hub",
    label: "Overview",
    description: "Launch readiness and team overview",
    icon: LayoutGrid,
  },
  {
    id: "scope",
    label: "Features & scope",
    description: "Feature slices, team votes, and decisions",
    icon: Layers,
  },
  {
    id: "studio",
    label: "Live prototype",
    description: "Interactive screens wired to mock data",
    icon: Play,
  },
  {
    id: "blueprint",
    label: "Data & APIs",
    description: "Models, REST contracts, mock server, and impact",
    icon: Database,
  },
  {
    id: "build",
    label: "Build & ship",
    description: "Agent control, team board, drift, and export",
    icon: Rocket,
  },
];

function normalizeCanonicalView(page: FeaturePage): CanonicalView {
  switch (page) {
    case "hub":
    case "dashboard":
      return "hub";
    case "scope":
    case "idea":
    case "usecases":
      return "scope";
    case "studio":
    case "ui":
      return "studio";
    case "blueprint":
    case "database":
    case "apis":
    case "diagrams":
      return "blueprint";
    case "build":
    case "team":
    case "agent-squad":
    case "code":
    case "source":
    case "git":
      return "build";
    case "settings":
      return "settings";
    default:
      return "hub";
  }
}

const IDELayout: React.FC = () => {
  const { project, activePage, loading, terminalOpen, builderActive, pageHistory } = useProjectStore();
  const { isLoading, activeTasks } = useBackgroundLoading();
  const { theme, toggleTheme } = useTheme();
  const toast = useToast();

  const [isSidebarExpanded, setIsSidebarExpanded] = useState(() => {
    try {
      const saved = localStorage.getItem("akasha:sidebar-expanded");
      return saved === null ? true : saved === "true";
    } catch {
      return true;
    }
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [selectedCmdIndex, setSelectedCmdIndex] = useState(0);
  const [readinessScore, setReadinessScore] = useState<number | null>(null);

  const isWorking = isLoading || activeTasks.length > 0;
  const canonicalView = normalizeCanonicalView(activePage);
  const canGoBack = pageHistory && pageHistory.length > 0;

  const projectSettings: Record<string, any> = useMemo(() => {
    if (!project?.settings) return {};
    if (typeof project.settings === "string") {
      try {
        return JSON.parse(project.settings);
      } catch {
        return {};
      }
    }
    return project.settings;
  }, [project?.settings]);

  const shareUrl = project
    ? `${window.location.origin}/preview/${project.id}${projectSettings.shareToken ? `?token=${projectSettings.shareToken}` : ""}`
    : "";

  // Fetch lightweight readiness indicator for sidebar footer
  useEffect(() => {
    if (!project?.id) return;
    let mounted = true;
    fetchReleaseReadiness(project.id)
      .then((r) => {
        if (mounted) setReadinessScore(r.score);
      })
      .catch(() => null);
    return () => {
      mounted = false;
    };
  }, [project?.id, canonicalView]);

  const toggleSidebar = () => {
    setIsSidebarExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("akasha:sidebar-expanded", String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Global keyboard shortcuts: Cmd/Ctrl+B (sidebar), Cmd/Ctrl+K (quick jump), Cmd/Ctrl+, (settings)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const inInput = tag === "input" || tag === "textarea" || tag === "select";

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen((open) => !open);
        setCommandQuery("");
        setSelectedCmdIndex(0);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === ",") {
        e.preventDefault();
        setActivePage("settings");
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b" && !inInput) {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const toggle = () => toggleTerminal();
    window.addEventListener("akasha:toggle-terminal", toggle);
    return () => window.removeEventListener("akasha:toggle-terminal", toggle);
  }, []);

  const commandActions = useMemo(() => {
    const base = [
      ...PRIMARY_NAV_ITEMS.map((item) => ({
        id: `nav-${item.id}`,
        label: `Go to ${item.label}`,
        hint: item.description,
        icon: <item.icon className="w-4 h-4" />,
        run: () => setActivePage(item.id),
      })),
      {
        id: "nav-settings",
        label: "Open Settings",
        hint: "Appearance, AI provider, and project preferences",
        icon: <Settings className="w-4 h-4" />,
        run: () => setActivePage("settings"),
      },
      {
        id: "action-preview",
        label: "Open shareable prototype in new tab",
        hint: "Test your live mock-API prototype cleanly",
        icon: <ExternalLink className="w-4 h-4" />,
        run: () => {
          if (shareUrl) window.open(shareUrl, "_blank", "noopener");
        },
      },
      {
        id: "action-copy-link",
        label: "Copy prototype share link",
        hint: "Share with teammates or clients for feedback",
        icon: <Copy className="w-4 h-4" />,
        run: () => {
          if (shareUrl) {
            navigator.clipboard.writeText(shareUrl);
            toast.showToast("Share link copied", "success");
          }
        },
      },
      {
        id: "action-theme",
        label: theme === "light" ? "Switch to Dark mode" : "Switch to Light mode",
        hint: "Toggle studio appearance",
        icon: theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />,
        run: () => toggleTheme(),
      },
      {
        id: "action-projects",
        label: "Return to all projects",
        hint: "Switch workspace or start a new product",
        icon: <ArrowLeft className="w-4 h-4" />,
        run: () => closeProject(),
      },
    ];

    const q = commandQuery.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (c) => c.label.toLowerCase().includes(q) || c.hint.toLowerCase().includes(q)
    );
  }, [commandQuery, shareUrl, theme, toggleTheme, toast]);

  const activeNavMeta =
    PRIMARY_NAV_ITEMS.find((i) => i.id === canonicalView) ||
    (canonicalView === "settings" ? { label: "Settings", description: "Workspace appearance, AI provider, and project settings." } : { label: "Overview", description: "Launch readiness and team overview." });

  useDocumentMeta({
    title: project?.name ? `${activeNavMeta.label} · ${project.name} — Akasha` : "Akasha — Product Studio for Small Teams",
    description: project?.description || activeNavMeta.description,
  });

  const renderPage = () => {
    if (project?.status === "initializing") {
      return <InitiationWizard project={project} projectId={project.id} />;
    }
    switch (canonicalView) {
      case "hub":
        return <ProductHubPage />;
      case "scope":
        return <ScopeFeaturesPage />;
      case "studio":
        return <InteractiveStudioPage />;
      case "blueprint":
        return <SystemBlueprintPage />;
      case "build":
        return <BuildShipPage />;
      case "settings":
        return (
          <SettingsPage
            onBack={() => (canGoBack ? goBackPage() : setActivePage("hub"))}
          />
        );
      default:
        return <ProductHubPage />;
    }
  };

  const navigateTo = (id: CanonicalView) => {
    setActivePage(id);
    setMobileMenuOpen(false);
  };

  return (
    <div className="akasha-ide-root h-screen w-screen flex flex-col bg-[var(--ide-bg)] text-[var(--ide-text)] overflow-hidden relative selection:bg-[#1B5BFF]/15">
      {/* Top Studio Header */}
      {!builderActive && (
        <header className="h-13 min-h-[52px] flex items-center justify-between px-4 select-none flex-shrink-0 relative z-20 bg-[var(--ide-titlebar)] border-b border-[var(--ide-border)] shadow-[0_1px_2px_rgba(11,18,32,0.05)]">
          {/* Left: Mobile Menu + Brand + Breadcrumb */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="md:hidden p-1.5 rounded-lg text-[var(--ide-text-secondary)] hover:bg-[var(--ide-accent-subtle)] cursor-pointer"
            >
              <Menu className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => closeProject()}
              title="All projects"
              className="inline-flex items-center px-1.5 py-1 rounded-lg hover:bg-[var(--ide-accent-subtle)] transition-colors cursor-pointer"
            >
              <Logo size={24} showText={false} />
              <span className="ml-2 text-sm font-bold tracking-tight text-[var(--ide-text)] hidden sm:inline">
                Akasha
              </span>
            </button>

            <span className="text-[var(--ide-border-strong)] select-none">/</span>

            <button
              type="button"
              onClick={() => navigateTo("hub")}
              className="text-sm font-semibold text-[var(--ide-text)] hover:text-[#1B5BFF] dark:hover:text-[#7AA3FF] truncate max-w-[180px] sm:max-w-[260px] transition-colors cursor-pointer"
            >
              {project?.name || "Workspace"}
            </button>

            <span className="hidden lg:inline text-[var(--ide-border-strong)] select-none">/</span>
            <span className="hidden lg:inline text-sm text-[var(--ide-text-muted)] truncate">
              {activeNavMeta.label}
            </span>
          </div>

          {/* Center: Quick Jump Command Trigger */}
          <button
            type="button"
            onClick={() => {
              setCommandOpen(true);
              setCommandQuery("");
              setSelectedCmdIndex(0);
            }}
            className="hidden md:flex items-center justify-between gap-3 w-64 lg:w-80 h-8 px-3 rounded-lg bg-[var(--ide-accent-subtle)] hover:bg-[var(--ide-border)]/60 border border-[var(--ide-border)] text-xs text-[var(--ide-text-muted)] transition-colors cursor-pointer"
          >
            <span className="inline-flex items-center gap-2 truncate">
              <Search className="w-3.5 h-3.5 shrink-0" />
              <span>Jump to view or action...</span>
            </span>
            <kbd className="px-1.5 py-0.5 rounded bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] text-[10px] font-mono text-[var(--ide-text-secondary)]">
              ⌘K
            </kbd>
          </button>

          {/* Right: Live Activity, Preview, Theme Switch, Settings */}
          <div className="flex items-center gap-2">
            {isWorking && (
              <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1B5BFF]/10 text-[#1B5BFF] dark:text-[#7AA3FF] text-xs font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1B5BFF] animate-pulse" />
                <span>{activeTasks[activeTasks.length - 1]?.title || "Syncing"}</span>
              </div>
            )}

            {shareUrl && (
              <button
                type="button"
                onClick={() => window.open(shareUrl, "_blank", "noopener")}
                className="hidden sm:inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold border border-[var(--ide-border)] bg-[var(--ide-bg-elevated)] hover:bg-[var(--ide-accent-subtle)] text-[var(--ide-text)] transition-colors cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5 text-[#1B5BFF] dark:text-[#7AA3FF]" />
                <span>Preview</span>
              </button>
            )}

            <ThemeToggle />

            <button
              type="button"
              onClick={() => navigateTo("settings")}
              aria-label="Open settings"
              title="Settings (⌘,)"
              className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border transition-colors cursor-pointer ${
                canonicalView === "settings"
                  ? "bg-[#1B5BFF]/10 border-[#1B5BFF]/30 text-[#1B5BFF] dark:text-[#7AA3FF]"
                  : "border-[var(--ide-border)] bg-[var(--ide-bg-elevated)] hover:bg-[var(--ide-accent-subtle)] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)]"
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>
      )}

      {/* Workspace Body */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Desktop Collapsible Sidebar */}
        {!builderActive && project?.status !== "initializing" && (
          <motion.aside
            initial={false}
            animate={{ width: isSidebarExpanded ? 232 : 68 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="hidden md:flex flex-col py-3 flex-shrink-0 bg-[var(--ide-bg-sidebar)] border-r border-[var(--ide-border)] relative z-10 overflow-hidden"
          >
            <nav className="flex-1 px-2.5 space-y-1 overflow-y-auto" aria-label="Workspace navigation">
              {PRIMARY_NAV_ITEMS.map((item) => (
                <AsideNavItem
                  key={item.id}
                  item={item}
                  active={canonicalView === item.id}
                  expanded={isSidebarExpanded}
                  onClick={() => navigateTo(item.id)}
                />
              ))}
            </nav>

            {/* Launch Readiness Mini-Gauge */}
            {isSidebarExpanded && readinessScore !== null && (
              <div className="mx-2.5 mb-2.5 p-3 rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[var(--ide-text-secondary)]">Launch readiness</span>
                  <span className="font-bold text-[var(--ide-text)]">{readinessScore}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-[var(--ide-border)] overflow-hidden">
                  <motion.div
                    initial={false}
                    animate={{ width: `${Math.max(4, readinessScore)}%` }}
                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                    className={`h-full rounded-full ${
                      readinessScore >= 75
                        ? "bg-emerald-500"
                        : readinessScore >= 40
                        ? "bg-[#1B5BFF]"
                        : "bg-amber-500"
                    }`}
                  />
                </div>
              </div>
            )}

            {/* Footer Controls */}
            <div className="px-2.5 pt-2 border-t border-[var(--ide-border)] space-y-1 shrink-0">
              <AsideNavItem
                item={{
                  id: "settings",
                  label: "Settings",
                  description: "Appearance, AI, and project controls",
                  icon: Settings,
                }}
                active={canonicalView === "settings"}
                expanded={isSidebarExpanded}
                onClick={() => navigateTo("settings")}
              />

              <button
                type="button"
                onClick={() => closeProject()}
                title={!isSidebarExpanded ? "All projects" : undefined}
                className={`w-full h-9 flex items-center rounded-xl text-[13px] font-medium text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-accent-subtle)] transition-colors cursor-pointer ${
                  isSidebarExpanded ? "px-2.5 gap-2.5" : "justify-center"
                }`}
              >
                <ArrowLeft className="w-4 h-4 shrink-0" />
                {isSidebarExpanded && <span className="truncate">All projects</span>}
              </button>

              <button
                type="button"
                onClick={toggleSidebar}
                title={isSidebarExpanded ? "Collapse sidebar (Ctrl+B)" : "Expand sidebar (Ctrl+B)"}
                className={`w-full h-8 flex items-center rounded-xl text-xs font-medium text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-accent-subtle)] transition-colors cursor-pointer ${
                  isSidebarExpanded ? "px-2.5 justify-between" : "justify-center"
                }`}
              >
                {isSidebarExpanded ? (
                  <>
                    <span className="inline-flex items-center gap-2">
                      <PanelLeftClose className="w-3.5 h-3.5" />
                      <span>Collapse</span>
                    </span>
                    <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--ide-bg)] border border-[var(--ide-border)]">
                      ^B
                    </kbd>
                  </>
                ) : (
                  <PanelLeftOpen className="w-4 h-4" />
                )}
              </button>
            </div>
          </motion.aside>
        )}

        {/* Mobile Drawer Navigation */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <div className="fixed inset-0 z-50 md:hidden flex">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMobileMenuOpen(false)}
                className="fixed inset-0 bg-slate-900/35 backdrop-blur-[2px]"
              />
              <motion.div
                initial={{ x: -260 }}
                animate={{ x: 0 }}
                exit={{ x: -260 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="relative z-10 w-64 max-w-[82vw] h-full bg-[var(--ide-bg-elevated)] border-r border-[var(--ide-border)] flex flex-col p-3"
              >
                <div className="flex items-center justify-between px-2 pb-3 border-b border-[var(--ide-border)]">
                  <span className="text-sm font-bold text-[var(--ide-text)] truncate">
                    {project?.name || "Akasha"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-1.5 rounded-lg text-[var(--ide-text-muted)] hover:bg-[var(--ide-accent-subtle)] cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex-1 py-3 space-y-1">
                  {PRIMARY_NAV_ITEMS.map((item) => (
                    <AsideNavItem
                      key={item.id}
                      item={item}
                      active={canonicalView === item.id}
                      expanded
                      onClick={() => navigateTo(item.id)}
                    />
                  ))}
                  <AsideNavItem
                    item={{
                      id: "settings",
                      label: "Settings",
                      description: "Workspace preferences",
                      icon: Settings,
                    }}
                    active={canonicalView === "settings"}
                    expanded
                    onClick={() => navigateTo("settings")}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    closeProject();
                  }}
                  className="h-9 px-3 rounded-xl flex items-center gap-2 text-sm font-medium text-[var(--ide-text-secondary)] hover:bg-[var(--ide-accent-subtle)] cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  All projects
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Main View Area with Smooth Crossfade */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0 bg-[var(--ide-bg)]">
          <div className={`ide-page flex-1 relative overflow-hidden ${terminalOpen ? "h-[65%]" : ""}`}>
            {loading && (
              <div className="absolute inset-0 bg-[var(--ide-bg)]/70 backdrop-blur-[2px] z-40 flex items-center justify-center">
                <span className="px-3.5 py-2 rounded-xl bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] text-xs font-medium text-[var(--ide-text-secondary)] shadow-sm">
                  Syncing workspace...
                </span>
              </div>
            )}

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={canonicalView}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.17, ease: [0.22, 1, 0.36, 1] }}
                className="h-full w-full"
              >
                <Suspense
                  fallback={
                    <div className="h-full w-full flex items-center justify-center text-sm text-[var(--ide-text-muted)]">
                      Loading view...
                    </div>
                  }
                >
                  {renderPage()}
                </Suspense>
              </motion.div>
            </AnimatePresence>
          </div>

          {terminalOpen && (
            <div className="h-[35%] border-t border-[var(--ide-border)] bg-[var(--ide-bg-elevated)]">
              <div className="h-8 px-4 flex items-center justify-between text-xs border-b border-[var(--ide-border)] text-[var(--ide-text-secondary)] font-medium">
                <span>Activity console</span>
                <button
                  type="button"
                  onClick={() => toggleTerminal()}
                  className="text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Global Quick Jump Command Palette (⌘K) */}
      <AnimatePresence>
        {commandOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-[14vh] px-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setCommandOpen(false)}
              className="fixed inset-0 bg-slate-900/30 dark:bg-black/60 backdrop-blur-[2px]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: -4 }}
              transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
              className="relative z-10 w-full max-w-lg rounded-2xl bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] shadow-[var(--ide-shadow-premium)] overflow-hidden"
            >
              <div className="flex items-center gap-2.5 px-4 h-12 border-b border-[var(--ide-border)]">
                <Search className="w-4 h-4 text-[var(--ide-text-muted)]" />
                <input
                  autoFocus
                  value={commandQuery}
                  onChange={(e) => {
                    setCommandQuery(e.target.value);
                    setSelectedCmdIndex(0);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setCommandOpen(false);
                    } else if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setSelectedCmdIndex((i) => Math.min(i + 1, Math.max(0, commandActions.length - 1)));
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setSelectedCmdIndex((i) => Math.max(0, i - 1));
                    } else if (e.key === "Enter" && commandActions[selectedCmdIndex]) {
                      e.preventDefault();
                      commandActions[selectedCmdIndex]!.run();
                      setCommandOpen(false);
                    }
                  }}
                  placeholder="Jump to a view, copy preview link, or switch theme..."
                  className="flex-1 bg-transparent text-sm text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)] focus:outline-none"
                />
                <kbd className="px-1.5 py-0.5 rounded bg-[var(--ide-accent-subtle)] text-[10px] font-mono text-[var(--ide-text-muted)]">
                  Esc
                </kbd>
              </div>
              <div className="max-h-72 overflow-y-auto p-1.5 space-y-0.5">
                {commandActions.length === 0 ? (
                  <div className="py-8 text-center text-sm text-[var(--ide-text-muted)]">
                    No matching commands.
                  </div>
                ) : (
                  commandActions.map((cmd, idx) => {
                    const active = idx === selectedCmdIndex;
                    return (
                      <button
                        key={cmd.id}
                        type="button"
                        onMouseEnter={() => setSelectedCmdIndex(idx)}
                        onClick={() => {
                          cmd.run();
                          setCommandOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-3 transition-colors cursor-pointer ${
                          active
                            ? "bg-[#1B5BFF]/10 text-[#1B5BFF] dark:text-[#7AA3FF]"
                            : "text-[var(--ide-text)] hover:bg-[var(--ide-accent-subtle)]"
                        }`}
                      >
                        <span className="shrink-0 opacity-80">{cmd.icon}</span>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">{cmd.label}</div>
                          <div className="text-xs text-[var(--ide-text-muted)] truncate">{cmd.hint}</div>
                        </div>
                        {active && <CheckCircle2 className="w-3.5 h-3.5 shrink-0 opacity-75" />}
                      </button>
                    );
                  })
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface AsideNavItemProps {
  item: AsideNavItemDef;
  active: boolean;
  expanded: boolean;
  onClick: () => void;
}

const AsideNavItem: React.FC<AsideNavItemProps> = ({
  item,
  active,
  expanded,
  onClick,
}) => {
  const Icon = item.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      title={!expanded ? `${item.label} — ${item.description}` : undefined}
      className={`group relative w-full h-9.5 min-h-[38px] flex items-center select-none cursor-pointer rounded-xl transition-colors duration-150 ${
        expanded ? "px-2.5 justify-start gap-2.5" : "px-0 justify-center"
      } ${
        active
          ? "text-[#1B5BFF] dark:text-[#7AA3FF] font-semibold"
          : "text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-accent-subtle)] font-medium"
      }`}
    >
      {active && (
        <motion.span
          layoutId="sidebar-active-pill"
          transition={{ type: "spring", stiffness: 460, damping: 35 }}
          className="absolute inset-0 rounded-xl bg-[#1B5BFF]/[0.09] dark:bg-[#5B8CFF]/15 border border-[#1B5BFF]/20 dark:border-[#5B8CFF]/30"
        />
      )}
      <span className="relative z-10 flex items-center justify-center shrink-0 w-5 h-5">
        <Icon className="w-[17px] h-[17px]" />
      </span>
      {expanded && (
        <span className="relative z-10 text-[13px] truncate">{item.label}</span>
      )}
    </button>
  );
};

export default IDELayout;
