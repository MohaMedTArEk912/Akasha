/**
 * DashboardLanding — Daylight Architectural Studio Launchpad
 *
 * Clean, bright entry experience for small teams:
 * - Instant project creation & workspace search
 * - 6 ready-to-run Product Archetypes (slices + schemas + live mock API + clickable prototype)
 * - Clean recent workspaces grid
 * - Light & dark compatible GitHub / JSON import dialog
 */

import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useProjectStore } from "../hooks/useProjectStore";
import { useSettings } from "../context/SettingsContext";
import {
  createProject,
  deleteProject,
  importProject,
  ingestGitHubProject,
  openProject,
  initWorkspace,
} from "../stores/projectStore";
import {
  fetchPlaybooks,
  bootstrapPlaybook,
  type PlaybookSummary,
  type ArchetypeId,
} from "../services/akashaV2Service";
import { useApi } from "../hooks/useApi";
import { useToast } from "../context/ToastContext";
import ThemeToggle from "../components/ui/ThemeToggle";
import { Logo } from "../components/ui/Logo";
import { useDocumentMeta } from "../hooks/useDocumentMeta";

const SettingsPage = lazy(() => import("./SettingsPage"));

import {
  Search,
  Upload,
  Settings as SettingsIcon,
  X,
  CornerDownLeft,
  GitBranch,
  CheckCircle2,
  Loader2,
  ArrowUpRight,
  ChevronDown,
  Lock,
  Globe,
  Check,
  User,
  Star,
  Building2,
  GitFork,
  FolderGit2,
  Trash2,
  ShoppingBag,
  Wrench,
  Calendar,
  Layers,
  Store,
  Megaphone,
  Plus,
} from "lucide-react";

interface ProjectSummary {
  id: string;
  name: string;
  updated_at: string;
}

const ARCHETYPE_ICON: Record<string, React.ReactNode> = {
  ecommerce: <ShoppingBag className="w-4 h-4" />,
  internal_tool: <Wrench className="w-4 h-4" />,
  booking_service: <Calendar className="w-4 h-4" />,
  saas_app: <Layers className="w-4 h-4" />,
  marketplace: <Store className="w-4 h-4" />,
  marketing_site: <Megaphone className="w-4 h-4" />,
};

export const DashboardLanding: React.FC = () => {
  const { projects } = useProjectStore();
  const { apiKey } = useSettings();
  const toast = useToast();
  const api = useApi();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const repoDropdownRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const [workspaceSearch, setWorkspaceSearch] = useState("");
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importTab, setImportTab] = useState<"github" | "json">("github");

  // GitHub Ingestion State
  const [repoUrl, setRepoUrl] = useState("");
  const [repoBranch, setRepoBranch] = useState("main");
  const [ghConnected, setGhConnected] = useState(false);
  const [ghUser, setGhUser] = useState<any>(null);
  const [userRepos, setUserRepos] = useState<any[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [repoDropdownOpen, setRepoDropdownOpen] = useState(false);
  const [repoFilterTab, setRepoFilterTab] = useState<"all" | "self" | "starred" | "org">("all");
  const [repoSearchQuery, setRepoSearchQuery] = useState("");
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestStep, setIngestStep] = useState(1);

  // JSON Import State
  const [importJson, setImportJson] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [playbooks, setPlaybooks] = useState<PlaybookSummary[]>([]);
  const [launchingArchetype, setLaunchingArchetype] = useState<string | null>(null);

  const allProjects = useMemo(() => projects || [], [projects]);

  useDocumentMeta({
    title: showSettings ? "Settings — Akasha" : "Akasha — Product Studio for Small Teams",
    description:
      "Turn small-team product ideas into vertical feature slices, clickable mock-API prototypes, shared data contracts, and exportable full-stack apps.",
  });

  useEffect(() => {
    void initWorkspace();
    fetchPlaybooks().then(setPlaybooks).catch(() => []);
  }, []);

  useEffect(() => {
    if (!repoDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (repoDropdownRef.current && !repoDropdownRef.current.contains(e.target as Node)) {
        setRepoDropdownOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setRepoDropdownOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [repoDropdownOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (isImportOpen && importTab === "github") {
      void checkGhStatus();
    }
  }, [isImportOpen, importTab]);

  useEffect(() => {
    const handleFocus = () => {
      if (isImportOpen && importTab === "github") {
        void checkGhStatus();
      }
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [isImportOpen, importTab]);

  const checkGhStatus = async () => {
    try {
      const status = await api.githubStatus();
      setGhConnected(status.connected);
      setGhUser(status.user);
      if (status.connected) {
        setReposLoading(true);
        try {
          const [allRepos, starredRepos] = await Promise.all([
            api.githubRepos(1, 100).catch(() => []),
            api.githubRepos(1, 100, "starred").catch(() => []),
          ]);
          const starredIds = new Set(
            (Array.isArray(starredRepos) ? starredRepos : []).map((r: any) => r.id)
          );
          const reposMap = new Map<number, any>();
          if (Array.isArray(allRepos)) {
            for (const r of allRepos) {
              reposMap.set(r.id, { ...r, isStarred: starredIds.has(r.id) });
            }
          }
          if (Array.isArray(starredRepos)) {
            for (const r of starredRepos) {
              if (reposMap.has(r.id)) reposMap.get(r.id).isStarred = true;
              else reposMap.set(r.id, { ...r, isStarred: true });
            }
          }
          setUserRepos(Array.from(reposMap.values()));
        } finally {
          setReposLoading(false);
        }
      }
    } catch {
      setGhConnected(false);
    }
  };

  const selectedRepo = useMemo(() => {
    if (!repoUrl) return null;
    return userRepos.find(
      (r) =>
        r.full_name?.toLowerCase() === repoUrl.toLowerCase() ||
        r.html_url?.toLowerCase() === repoUrl.toLowerCase() ||
        r.name?.toLowerCase() === repoUrl.toLowerCase()
    );
  }, [userRepos, repoUrl]);

  const repoCounts = useMemo(() => {
    let selfCount = 0;
    let starredCount = 0;
    let orgCount = 0;
    for (const r of userRepos) {
      const isSelf = Boolean(ghUser?.login && r.owner?.login?.toLowerCase() === ghUser.login.toLowerCase());
      if (isSelf) selfCount++;
      else orgCount++;
      if (r.isStarred || (typeof r.stargazers_count === "number" && r.stargazers_count > 0)) starredCount++;
    }
    return { all: userRepos.length, self: selfCount, starred: starredCount, org: orgCount };
  }, [userRepos, ghUser]);

  const filteredRepos = useMemo(() => {
    return userRepos.filter((r) => {
      if (repoFilterTab === "self") {
        const isSelf = Boolean(ghUser?.login && r.owner?.login?.toLowerCase() === ghUser.login.toLowerCase());
        if (!isSelf) return false;
      } else if (repoFilterTab === "starred") {
        const isStarred = Boolean(r.isStarred || (typeof r.stargazers_count === "number" && r.stargazers_count > 0));
        if (!isStarred) return false;
      } else if (repoFilterTab === "org") {
        const isOrg = Boolean(
          r.owner?.type === "Organization" ||
            (ghUser?.login && r.owner?.login?.toLowerCase() !== ghUser.login.toLowerCase())
        );
        if (!isOrg) return false;
      }
      if (repoSearchQuery.trim()) {
        const q = repoSearchQuery.toLowerCase().trim();
        return Boolean(
          r.name?.toLowerCase().includes(q) ||
            r.full_name?.toLowerCase().includes(q) ||
            r.description?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [userRepos, repoFilterTab, repoSearchQuery, ghUser]);

  const filteredProjects = useMemo(() => {
    const q = workspaceSearch.trim().toLowerCase();
    if (!q) return allProjects;
    return allProjects.filter((p) => p.name.toLowerCase().includes(q));
  }, [allProjects, workspaceSearch]);

  const jsonError = useMemo(() => {
    if (!importJson.trim()) return "Paste JSON to continue";
    try {
      JSON.parse(importJson);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : "Invalid JSON";
    }
  }, [importJson]);

  const handleCreate = async (nameToCreate: string) => {
    const finalName = nameToCreate.trim();
    if (!finalName || isCreating) return;
    setIsCreating(true);
    try {
      await createProject(finalName, "");
      setQuery("");
      toast.showToast(`Created ${finalName}`, "success");
    } catch (err) {
      toast.showToast(`Could not create project: ${err}`, "error");
    } finally {
      setIsCreating(false);
    }
  };

  const handleLaunchArchetype = async (pb: PlaybookSummary) => {
    if (launchingArchetype) return;
    setLaunchingArchetype(pb.id);
    try {
      const customName = query.trim() || pb.name;
      const res = await bootstrapPlaybook({
        archetype: pb.id as ArchetypeId,
        productName: customName,
        pitch: pb.tagline,
      });
      await initWorkspace();
      await openProject(res.projectId);
      setQuery("");
      toast.showToast(`Created ${customName} with ${res.stats.slicesCount} slices and live mock data`, "success");
    } catch (err: any) {
      toast.showToast(`Launch failed: ${err?.message || err}`, "error");
    } finally {
      setLaunchingArchetype(null);
    }
  };

  const handleGitHubIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = repoUrl.trim();
    if (!target) {
      toast.showToast("Enter a repository name or URL", "error");
      return;
    }
    setIsIngesting(true);
    setIngestStep(1);
    const t1 = setTimeout(() => setIngestStep(2), 2500);
    const t2 = setTimeout(() => setIngestStep(3), 5500);
    const t3 = setTimeout(() => setIngestStep(4), 8500);

    try {
      const res = await ingestGitHubProject({
        url: target,
        branch: repoBranch.trim() || undefined,
        apiKey: apiKey || undefined,
      });
      setIngestStep(5);
      toast.showToast(
        `Imported ${res?.stats?.modelsCount || 0} models and ${res?.stats?.tasksCount || 0} tasks`,
        "success"
      );
      setIsImportOpen(false);
      setRepoUrl("");
    } catch (err: any) {
      toast.showToast(`Import failed: ${err.message || err}`, "error");
    } finally {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      setIsIngesting(false);
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (jsonError) {
      toast.showToast(jsonError, "error");
      return;
    }
    setIsImporting(true);
    try {
      await importProject(importJson);
      setImportJson("");
      setIsImportOpen(false);
      toast.showToast("Project imported", "success");
    } catch (err) {
      toast.showToast(`Import error: ${err}`, "error");
    } finally {
      setIsImporting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setImportJson(text);
      toast.showToast(`Loaded ${file.name}`, "success");
    } catch {
      toast.showToast("Could not read file", "error");
    } finally {
      e.target.value = "";
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteProject(id, true);
      setConfirmDeleteId(null);
      toast.showToast("Project deleted", "success");
    } catch (err) {
      toast.showToast(`Delete failed: ${err}`, "error");
    }
  };

  if (showSettings) {
    return (
      <div className="h-screen w-screen overflow-hidden flex flex-col bg-[var(--ide-bg)] text-[var(--ide-text)]">
        <Suspense
          fallback={
            <div className="h-full w-full flex items-center justify-center text-sm text-[var(--ide-text-muted)]">
              Loading settings...
            </div>
          }
        >
          <SettingsPage onBack={() => setShowSettings(false)} />
        </Suspense>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden flex flex-col studio-canvas-textured text-[var(--ide-text)] selection:bg-[#164EE0]/15">
      {/* Clean Studio Top Bar */}
      <header className="h-14 flex-shrink-0 border-b border-[var(--ide-border)] bg-[var(--ide-titlebar)] px-5 sm:px-8 flex items-center justify-between shadow-[0_1px_2px_rgba(11,18,32,0.05)]">
        <div className="flex items-center gap-2.5">
          <Logo size={28} />
          <span className="hidden sm:inline text-xs text-[var(--ide-text-muted)] pl-1">
            Product studio for small teams
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsImportOpen(true)}
            className="btn-ghost h-8 px-3 text-xs"
          >
            <Upload className="w-3.5 h-3.5" />
            Import
          </button>
          <ThemeToggle showLabel />
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="btn-ghost h-8 px-3 text-xs"
          >
            <SettingsIcon className="w-3.5 h-3.5" />
            Settings
          </button>
        </div>
      </header>

      {/* Scrollable Studio Canvas */}
      <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-10">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-5xl mx-auto space-y-12 pb-16"
        >
          {/* Editorial Hero & Instant Product Creator */}
          <section className="space-y-5 max-w-2xl">
            <div className="space-y-2">
              <h1 className="text-3xl sm:text-[34px] font-extrabold tracking-[-0.03em] text-[var(--ide-text)] leading-[1.15]">
                What is your team building next?
              </h1>
              <p className="text-[15px] text-[var(--ide-text-secondary)] leading-relaxed">
                Start from a working storefront, internal tool, booking portal, or SaaS app—complete with shared feature slices, live mock APIs, and exportable code.
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCreate(query);
              }}
              className="flex items-center gap-2 p-1.5 rounded-2xl bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] shadow-[var(--ide-shadow-sm)] focus-within:border-[#1B5BFF] focus-within:ring-4 focus-within:ring-[#1B5BFF]/10 transition-all"
            >
              <div className="flex-1 flex items-center pl-3 min-w-0">
                <Plus className="w-4 h-4 text-[var(--ide-text-muted)] shrink-0 mr-2.5" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Name a new product (e.g. Ember Roasters Store) or pick a starter below..."
                  className="w-full h-10 bg-transparent text-sm text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)] focus:outline-none"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="p-1.5 rounded-lg text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] cursor-pointer"
                    aria-label="Clear name"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <button
                type="submit"
                disabled={!query.trim() || isCreating}
                className="btn-primary h-10 px-4 rounded-xl shrink-0"
              >
                <span>{isCreating ? "Creating..." : "Start blank"}</span>
                <CornerDownLeft className="w-3.5 h-3.5 opacity-80" />
              </button>
            </form>
          </section>

          {/* Starter Blueprints (Product Archetypes) */}
          {playbooks.length > 0 && (
            <section className="space-y-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold tracking-tight text-[var(--ide-text)]">
                    Starter blueprints
                  </h2>
                  <p className="text-sm text-[var(--ide-text-secondary)]">
                    Launch a complete workspace with pre-seeded data, clickable screens, and MVP slices.
                  </p>
                </div>
                {query.trim() && (
                  <span className="text-xs font-medium text-[#1B5BFF] dark:text-[#7AA3FF]">
                    Will launch as “{query.trim()}”
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {playbooks.map((pb) => {
                  const isBusy = launchingArchetype === pb.id;
                  return (
                    <button
                      key={pb.id}
                      type="button"
                      disabled={Boolean(launchingArchetype)}
                      onClick={() => handleLaunchArchetype(pb)}
                      className="group text-left p-5 studio-surface hover:border-[#164EE0]/70 dark:hover:border-[#5B8CFF]/60 hover:shadow-[var(--ide-shadow)] transition-all duration-150 cursor-pointer disabled:opacity-50 flex flex-col justify-between gap-4"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="w-8 h-8 rounded-xl bg-[#1B5BFF]/[0.08] dark:bg-[#5B8CFF]/15 text-[#1B5BFF] dark:text-[#7AA3FF] flex items-center justify-center">
                            {ARCHETYPE_ICON[pb.id] || <Layers className="w-4 h-4" />}
                          </span>
                          <span className="text-xs font-medium text-[var(--ide-text-muted)] group-hover:text-[#1B5BFF] dark:group-hover:text-[#7AA3FF] inline-flex items-center gap-1 transition-colors">
                            {isBusy ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Setting up...
                              </>
                            ) : (
                              <>
                                Launch <ArrowUpRight className="w-3.5 h-3.5" />
                              </>
                            )}
                          </span>
                        </div>

                        <div>
                          <div className="text-[15px] font-bold text-[var(--ide-text)] tracking-tight">
                            {pb.name}
                          </div>
                          <p className="text-[13px] text-[var(--ide-text-secondary)] mt-1 leading-relaxed line-clamp-2">
                            {pb.tagline}
                          </p>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-[var(--ide-border)] flex items-center justify-between text-xs text-[var(--ide-text-muted)]">
                        <span>{pb.stats.slices} slices</span>
                        <span>{pb.stats.models} models</span>
                        <span>{pb.stats.pages} screens</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Your Workspaces */}
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold tracking-tight text-[var(--ide-text)]">
                  Your workspaces
                  {allProjects.length > 0 && (
                    <span className="ml-2 text-xs font-medium text-[var(--ide-text-muted)]">
                      {allProjects.length}
                    </span>
                  )}
                </h2>
              </div>

              {allProjects.length > 3 && (
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-[var(--ide-text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={workspaceSearch}
                    onChange={(e) => setWorkspaceSearch(e.target.value)}
                    placeholder="Filter workspaces..."
                    className="input-modern h-9 w-full pl-8 pr-3 text-xs"
                  />
                </div>
              )}
            </div>

            {filteredProjects.length > 0 ? (
              <div className="rounded-2xl bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] divide-y divide-[var(--ide-border)] overflow-hidden">
                {filteredProjects.map((proj) => (
                  <ProjectRow
                    key={proj.id}
                    project={proj}
                    onOpen={() => openProject(proj.id)}
                    onDelete={() => setConfirmDeleteId(proj.id)}
                  />
                ))}
              </div>
            ) : allProjects.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--ide-border-strong)] p-10 text-center space-y-2 bg-[var(--ide-bg-elevated)]/60">
                <p className="text-sm font-semibold text-[var(--ide-text)]">
                  No workspaces yet
                </p>
                <p className="text-xs text-[var(--ide-text-secondary)]">
                  Pick any starter blueprint above or enter a product name to create your first workspace.
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-[var(--ide-border)] p-8 text-center space-y-2 bg-[var(--ide-bg-elevated)]">
                <p className="text-sm text-[var(--ide-text-secondary)]">
                  No workspaces match “{workspaceSearch}”.
                </p>
                <button
                  type="button"
                  onClick={() => setWorkspaceSearch("")}
                  className="text-xs font-semibold text-[#1B5BFF] dark:text-[#7AA3FF] hover:underline cursor-pointer"
                >
                  Clear filter
                </button>
              </div>
            )}
          </section>
        </motion.div>
      </div>

      {/* Import Modal (GitHub & JSON) */}
      <AnimatePresence>
        {isImportOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/35 dark:bg-black/65 backdrop-blur-[2px]"
              onClick={() => {
                if (repoDropdownOpen) setRepoDropdownOpen(false);
                else if (!isIngesting) setIsImportOpen(false);
              }}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
              className="relative z-10 w-full max-w-xl rounded-2xl bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] shadow-[var(--ide-shadow-premium)] p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-[var(--ide-text)]">Import project</h3>
                <button
                  type="button"
                  disabled={isIngesting}
                  onClick={() => setIsImportOpen(false)}
                  className="p-1.5 rounded-lg text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-accent-subtle)] cursor-pointer disabled:opacity-40"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 p-1 rounded-xl bg-[var(--ide-accent-subtle)] border border-[var(--ide-border)]">
                <button
                  type="button"
                  disabled={isIngesting}
                  onClick={() => setImportTab("github")}
                  className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    importTab === "github"
                      ? "bg-[var(--ide-bg-elevated)] text-[var(--ide-text)] shadow-xs"
                      : "text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)]"
                  }`}
                >
                  <GitBranch className="w-3.5 h-3.5 text-[#1B5BFF] dark:text-[#7AA3FF]" />
                  GitHub repository
                </button>
                <button
                  type="button"
                  disabled={isIngesting}
                  onClick={() => setImportTab("json")}
                  className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    importTab === "json"
                      ? "bg-[var(--ide-bg-elevated)] text-[var(--ide-text)] shadow-xs"
                      : "text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)]"
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  JSON blueprint
                </button>
              </div>

              {importTab === "github" && (
                <div>
                  {isIngesting ? (
                    <div className="py-6 space-y-4 text-center">
                      <Loader2 className="w-8 h-8 mx-auto animate-spin text-[#1B5BFF]" />
                      <div>
                        <h4 className="text-sm font-bold text-[var(--ide-text)]">Importing repository</h4>
                        <p className="text-xs text-[var(--ide-text-secondary)] mt-0.5">
                          Scanning schemas, routes, and building your living blueprint.
                        </p>
                      </div>
                      <div className="space-y-2 text-left bg-[var(--ide-bg)] p-3.5 rounded-xl border border-[var(--ide-border)]">
                        {[
                          { step: 1, label: "Scanning repository structure" },
                          { step: 2, label: "Reading models, routes, and manifests" },
                          { step: 3, label: "Building data models and API contracts" },
                          { step: 4, label: "Preparing team tasks and checks" },
                          { step: 5, label: "Finalizing workspace" },
                        ].map((item) => (
                          <div key={item.step} className="flex items-center gap-2.5 text-xs">
                            {ingestStep > item.step ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                            ) : ingestStep === item.step ? (
                              <Loader2 className="w-4 h-4 text-[#1B5BFF] animate-spin shrink-0" />
                            ) : (
                              <span className="w-4 h-4 rounded-full border border-[var(--ide-border-strong)] shrink-0" />
                            )}
                            <span
                              className={
                                ingestStep >= item.step
                                  ? "text-[var(--ide-text)] font-medium"
                                  : "text-[var(--ide-text-muted)]"
                              }
                            >
                              {item.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleGitHubIngest} className="space-y-4">
                      <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)] text-xs">
                        {ghConnected && ghUser ? (
                          <div className="flex items-center gap-2">
                            <img
                              src={ghUser.avatar_url}
                              alt=""
                              className="w-5 h-5 rounded-full border border-[var(--ide-border)]"
                            />
                            <span className="text-[var(--ide-text)]">
                              Signed in as <strong>@{ghUser.login}</strong>
                            </span>
                          </div>
                        ) : (
                          <span className="text-[var(--ide-text-secondary)]">
                            Enter a public repo or connect GitHub for private repos
                          </span>
                        )}

                        {!ghConnected ? (
                          <button
                            type="button"
                            onClick={() => {
                              const w = 600, h = 700;
                              const left = window.screen.width / 2 - w / 2;
                              const top = window.screen.height / 2 - h / 2;
                              window.open("/api/github/login", "github-oauth", `width=${w},height=${h},top=${top},left=${left}`);
                            }}
                            className="btn-primary h-7 px-3 text-xs"
                          >
                            Connect GitHub
                          </button>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Connected
                          </span>
                        )}
                      </div>

                      {ghConnected && (
                        <div className="space-y-1.5" ref={repoDropdownRef}>
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-[var(--ide-text)]">Choose a repository</span>
                            <span className="text-[var(--ide-text-muted)]">
                              {reposLoading ? "Loading..." : `${userRepos.length} available`}
                            </span>
                          </div>
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setRepoDropdownOpen((prev) => !prev)}
                              className="w-full h-10 px-3 rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)] flex items-center justify-between text-xs cursor-pointer hover:border-[var(--ide-border-strong)]"
                            >
                              <span className="font-mono text-[var(--ide-text)] truncate">
                                {selectedRepo ? selectedRepo.full_name : repoUrl || "Select a repository..."}
                              </span>
                              <ChevronDown
                                className={`w-4 h-4 text-[var(--ide-text-muted)] transition-transform ${
                                  repoDropdownOpen ? "rotate-180" : ""
                                }`}
                              />
                            </button>

                            {repoDropdownOpen && (
                              <div className="absolute left-0 right-0 top-full mt-1.5 z-50 p-3 rounded-xl bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] shadow-[var(--ide-shadow-premium)] space-y-2.5">
                                <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-[var(--ide-border)]">
                                  {(
                                    [
                                      { key: "all", label: "All", icon: <FolderGit2 className="w-3 h-3" />, count: repoCounts.all },
                                      { key: "self", label: "Yours", icon: <User className="w-3 h-3" />, count: repoCounts.self },
                                      { key: "starred", label: "Starred", icon: <Star className="w-3 h-3" />, count: repoCounts.starred },
                                      { key: "org", label: "Orgs", icon: <Building2 className="w-3 h-3" />, count: repoCounts.org },
                                    ] as const
                                  ).map((tab) => (
                                    <button
                                      key={tab.key}
                                      type="button"
                                      onClick={() => setRepoFilterTab(tab.key)}
                                      className={`px-2.5 py-1 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer ${
                                        repoFilterTab === tab.key
                                          ? "bg-[#1B5BFF]/10 text-[#1B5BFF] dark:text-[#7AA3FF]"
                                          : "text-[var(--ide-text-secondary)] hover:bg-[var(--ide-accent-subtle)]"
                                      }`}
                                    >
                                      {tab.icon}
                                      {tab.label}
                                      <span className="text-[10px] opacity-75">{tab.count}</span>
                                    </button>
                                  ))}
                                </div>

                                <input
                                  type="text"
                                  value={repoSearchQuery}
                                  onChange={(e) => setRepoSearchQuery(e.target.value)}
                                  placeholder="Filter repositories..."
                                  className="input-modern h-8 w-full text-xs"
                                  autoFocus
                                />

                                <div className="max-h-52 overflow-y-auto space-y-1">
                                  {filteredRepos.length === 0 ? (
                                    <div className="py-6 text-center text-xs text-[var(--ide-text-muted)]">
                                      No repositories found.
                                    </div>
                                  ) : (
                                    filteredRepos.map((r: any) => {
                                      const isSelected = repoUrl.toLowerCase() === r.full_name?.toLowerCase();
                                      return (
                                        <button
                                          key={r.id}
                                          type="button"
                                          onClick={() => {
                                            setRepoUrl(r.full_name || r.name);
                                            if (r.default_branch) setRepoBranch(r.default_branch);
                                            setRepoDropdownOpen(false);
                                          }}
                                          className={`w-full text-left p-2 rounded-lg text-xs flex items-center justify-between gap-2 cursor-pointer ${
                                            isSelected
                                              ? "bg-[#1B5BFF]/10 text-[#1B5BFF] dark:text-[#7AA3FF]"
                                              : "hover:bg-[var(--ide-accent-subtle)] text-[var(--ide-text)]"
                                          }`}
                                        >
                                          <div className="min-w-0">
                                            <div className="font-mono font-semibold truncate flex items-center gap-1.5">
                                              <span>{r.full_name || r.name}</span>
                                              {r.private ? (
                                                <Lock className="w-3 h-3 text-amber-500 shrink-0" />
                                              ) : (
                                                <Globe className="w-3 h-3 text-emerald-500 shrink-0" />
                                              )}
                                              {r.fork && <GitFork className="w-3 h-3 text-[var(--ide-text-muted)] shrink-0" />}
                                            </div>
                                            {r.description && (
                                              <p className="text-[11px] text-[var(--ide-text-muted)] truncate mt-0.5">
                                                {r.description}
                                              </p>
                                            )}
                                          </div>
                                          {isSelected && <Check className="w-4 h-4 shrink-0" />}
                                        </button>
                                      );
                                    })
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-3 gap-2.5">
                        <div className="col-span-2 space-y-1">
                          <label className="text-xs font-semibold text-[var(--ide-text)] block">
                            Repository
                          </label>
                          <input
                            type="text"
                            required
                            value={repoUrl}
                            onChange={(e) => setRepoUrl(e.target.value)}
                            placeholder="owner/repo or GitHub URL"
                            className="input-modern w-full h-9 font-mono text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-[var(--ide-text)] block">
                            Branch
                          </label>
                          <input
                            type="text"
                            value={repoBranch}
                            onChange={(e) => setRepoBranch(e.target.value)}
                            placeholder="main"
                            className="input-modern w-full h-9 font-mono text-xs"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setIsImportOpen(false)}
                          className="btn-ghost h-9 px-4 text-xs"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={!repoUrl.trim()}
                          className="btn-primary h-9 px-4 text-xs"
                        >
                          Import repository
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {importTab === "json" && (
                <form onSubmit={handleImport} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="btn-ghost h-8 px-3 text-xs"
                      >
                        Upload JSON file
                      </button>
                      {importJson.trim() && (
                        <button
                          type="button"
                          onClick={() => setImportJson("")}
                          className="text-xs text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json,application/json"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                    <span className={`text-xs font-medium ${jsonError ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                      {jsonError ? "Waiting for valid JSON" : "Valid JSON"}
                    </span>
                  </div>

                  <textarea
                    value={importJson}
                    onChange={(e) => setImportJson(e.target.value)}
                    placeholder="Paste an exported Akasha JSON blueprint..."
                    spellCheck={false}
                    className="w-full h-44 p-3 rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)] text-xs font-mono text-[var(--ide-text)] focus:outline-none focus:border-[#1B5BFF] resize-none"
                  />

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsImportOpen(false)}
                      className="btn-ghost h-9 px-4 text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={Boolean(jsonError) || isImporting}
                      className="btn-primary h-9 px-4 text-xs"
                    >
                      {isImporting ? "Importing..." : "Import blueprint"}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation */}
      <AnimatePresence>
        {confirmDeleteId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/35 dark:bg-black/65 backdrop-blur-[2px]"
              onClick={() => setConfirmDeleteId(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="relative z-10 w-full max-w-xs rounded-2xl bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] shadow-[var(--ide-shadow-premium)] p-5 space-y-4"
            >
              <div>
                <h3 className="text-base font-bold text-[var(--ide-text)]">Delete workspace?</h3>
                <p className="text-xs text-[var(--ide-text-secondary)] mt-1">
                  This permanently deletes the project and its mock data.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(null)}
                  className="btn-ghost flex-1 h-9 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(confirmDeleteId)}
                  className="flex-1 h-9 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ProjectRow: React.FC<{
  project: ProjectSummary;
  onOpen: () => void;
  onDelete: () => void;
}> = ({ project, onOpen, onDelete }) => {
  const formattedDate = useMemo(() => {
    try {
      const d = new Date(project.updated_at);
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return "Recently";
    }
  }, [project.updated_at]);

  return (
    <div
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="group flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-[var(--ide-accent-subtle)]/70 transition-colors cursor-pointer"
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="w-8 h-8 rounded-lg bg-[var(--ide-accent-subtle)] border border-[var(--ide-border)] text-xs font-bold text-[var(--ide-text-secondary)] flex items-center justify-center shrink-0">
          {project.name.slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[var(--ide-text)] group-hover:text-[#1B5BFF] dark:group-hover:text-[#7AA3FF] truncate transition-colors">
            {project.name}
          </div>
          <div className="text-xs text-[var(--ide-text-muted)]">
            Updated {formattedDate}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          aria-label={`Delete ${project.name}`}
          className="p-1.5 rounded-lg text-[var(--ide-text-muted)] hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
        <span className="text-xs font-semibold text-[#1B5BFF] dark:text-[#7AA3FF] inline-flex items-center gap-1">
          Open <ArrowUpRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </div>
  );
};

export default DashboardLanding;
