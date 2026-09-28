/**
 * DashboardLanding — Apple Liquid Glass Minimalism (Zero Icons)
 *
 * Consolidated Architecture:
 * - Single Floating Liquid Glass Command Island (merges Header + Search + Vision Launcher + Actions)
 * - Pure Typography Minimalism: Zero icons, crisp Apple HIG hierarchy
 * - Minimal words: Concise labels, no verbose explanations
 * - 1-Click Streamlined Workflow: Type & Enter to create, live search, 1-click presets
 */

import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
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
import { useApi } from "../hooks/useApi";
import { useToast } from "../context/ToastContext";

const SettingsPage = lazy(() => import("./SettingsPage"));
import {
  LiquidPill,
  LiquidCard,
} from "../components/ui/LiquidGlass";
import {
  Search,
  Upload,
  Settings as SettingsIcon,
  X,
  CornerDownLeft,
  GitBranch,
  Sparkles,
  CheckCircle2,
  Loader2,
  ArrowRight,
  ShieldCheck,
  ChevronDown,
  Lock,
  Globe,
  Check,
  User,
  Star,
  Building2,
  GitFork,
  FolderGit2,
} from "lucide-react";

interface ProjectSummary {
  id: string;
  name: string;
  updated_at: string;
}

const PRESETS = [
  { label: "SaaS", prompt: "SaaS Platform" },
  { label: "Agent", prompt: "AI Assistant" },
  { label: "Store", prompt: "Storefront" },
  { label: "App", prompt: "Mobile App" },
];

export const DashboardLanding: React.FC = () => {
  const { projects } = useProjectStore();

  const { apiKey, noAi } = useSettings();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Unified State
  const api = useApi();
  const [query, setQuery] = useState("");
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
  const repoDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    if (!repoDropdownOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        repoDropdownRef.current &&
        !repoDropdownRef.current.contains(e.target as Node)
      ) {
        setRepoDropdownOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setRepoDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [repoDropdownOpen]);
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestStep, setIngestStep] = useState(1);

  // JSON Import State
  const [importJson, setImportJson] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const allProjects = useMemo(() => projects || [], [projects]);

  // Refresh workspace projects on mount
  useEffect(() => {
    void initWorkspace();
  }, []);

  // Check GitHub status and repos when import modal opens
  useEffect(() => {
    if (isImportOpen && importTab === "github") {
      void checkGhStatus();
    }
  }, [isImportOpen, importTab]);

  // Re-check when window refocuses (e.g. after returning from GitHub OAuth popup)
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
              reposMap.set(r.id, {
                ...r,
                isStarred: starredIds.has(r.id),
              });
            }
          }

          if (Array.isArray(starredRepos)) {
            for (const r of starredRepos) {
              if (reposMap.has(r.id)) {
                reposMap.get(r.id).isStarred = true;
              } else {
                reposMap.set(r.id, {
                  ...r,
                  isStarred: true,
                });
              }
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
      if (isSelf) {
        selfCount++;
      } else {
        orgCount++;
      }

      if (r.isStarred || (typeof r.stargazers_count === "number" && r.stargazers_count > 0)) {
        starredCount++;
      }
    }

    return {
      all: userRepos.length,
      self: selfCount,
      starred: starredCount,
      org: orgCount,
    };
  }, [userRepos, ghUser]);

  const filteredRepos = useMemo(() => {
    return userRepos.filter((r) => {
      // 1. Tab filter
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

      // 2. Search query filter
      if (repoSearchQuery.trim()) {
        const q = repoSearchQuery.toLowerCase().trim();
        const nameMatch = r.name?.toLowerCase().includes(q);
        const fullNameMatch = r.full_name?.toLowerCase().includes(q);
        const descMatch = r.description?.toLowerCase().includes(q);
        return Boolean(nameMatch || fullNameMatch || descMatch);
      }

      return true;
    });
  }, [userRepos, repoFilterTab, repoSearchQuery, ghUser]);

  const handleGitHubIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = repoUrl.trim();
    if (!target) {
      toast.showToast("Please enter a repository (e.g. owner/repo or URL)", "error");
      return;
    }
    setIsIngesting(true);
    setIngestStep(1);

    const timer1 = setTimeout(() => setIngestStep(2), 2500);
    const timer2 = setTimeout(() => setIngestStep(3), 5500);
    const timer3 = setTimeout(() => setIngestStep(4), 8500);

    try {
      const res = await ingestGitHubProject({
        url: target,
        branch: repoBranch.trim() || undefined,
        apiKey: apiKey || undefined,
      });
      setIngestStep(5);
      toast.showToast(
        `✨ Ingested ${res?.stats?.modelsCount || 0} models and ${res?.stats?.tasksCount || 0} tasks!`,
        "success"
      );
      setIsImportOpen(false);
      setRepoUrl("");
    } catch (err: any) {
      toast.showToast(`Ingestion failed: ${err.message || err}`, "error");
    } finally {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      setIsIngesting(false);
    }
  };

  // Keyboard shortcut to focus search (Cmd/Ctrl + K or /)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
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

  // Live filter matching projects
  const filteredProjects = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allProjects;
    return allProjects.filter((p) => p.name.toLowerCase().includes(q));
  }, [allProjects, query]);

  // Validate JSON for import
  const jsonError = useMemo(() => {
    if (!importJson.trim()) return "Empty";
    try {
      JSON.parse(importJson);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : "Invalid JSON";
    }
  }, [importJson]);

  // 1-Click / Enter Project Creation
  const handleCreate = async (nameToCreate: string) => {
    const finalName = nameToCreate.trim();
    if (!finalName || isCreating) return;

    setIsCreating(true);
    try {
      await createProject(finalName, "");
      setQuery("");
      toast.showToast("Created", "success");
    } catch (err) {
      toast.showToast(`Error: ${err}`, "error");
    } finally {
      setIsCreating(false);
    }
  };

  // Import project
  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (jsonError) {
      toast.showToast(`Invalid JSON: ${jsonError}`, "error");
      return;
    }

    setIsImporting(true);
    try {
      await importProject(importJson);
      setImportJson("");
      setIsImportOpen(false);
      toast.showToast("Imported", "success");
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
      toast.showToast(`${file.name} loaded`, "success");
    } catch {
      toast.showToast("File read failed", "error");
    } finally {
      e.target.value = "";
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteProject(id, true);
      setConfirmDeleteId(null);
      toast.showToast("Deleted", "success");
    } catch (err) {
      toast.showToast(`Delete error: ${err}`, "error");
    }
  };

  // Fullscreen Settings View
  if (showSettings) {
    return (
      <div className="relative h-screen w-screen overflow-hidden flex flex-col bg-[#f8fafc] dark:bg-[#07080c] text-neutral-900 dark:text-neutral-100">
        <div className="relative z-10 flex-1 overflow-auto">
          <Suspense fallback={<div className="h-full w-full flex items-center justify-center text-xs text-neutral-500">Loading settings...</div>}>
            <SettingsPage onBack={() => setShowSettings(false)} />
          </Suspense>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden flex flex-col bg-[#f8fafc] dark:bg-[#07080c] text-neutral-900 dark:text-neutral-100 selection:bg-blue-500/20">
      {/* Iridescent fluid ambient mesh */}
      {/* Main Canvas */}
      <div className="relative z-10 flex-1 overflow-y-auto px-4 sm:px-8 py-6">
        <div className="max-w-4xl mx-auto space-y-8">

          {/* ===== STREAMLINED COMMAND BAR (Search, Import, Settings Only) ===== */}
          <header className="w-full flex justify-center sticky top-0 z-30 pt-1 pb-2">
            <div
              className="
                relative w-full max-w-2xl
                rounded-full p-1.5 sm:p-2
                backdrop-blur-2xl saturate-[190%]
                bg-white/80 dark:bg-[#0c0d16]/80
                border border-black/[0.08] dark:border-white/[0.14]
                shadow-[0_12px_36px_-8px_rgba(0,0,0,0.1),0_1px_2px_rgba(0,0,0,0.04),inset_0_1px_1px_0_rgba(255,255,255,0.7)]
                dark:shadow-[0_18px_45px_-10px_rgba(0,0,0,0.65),0_1px_2px_rgba(0,0,0,0.4),inset_0_1px_1px_0_rgba(255,255,255,0.1)]
                flex items-center gap-1.5 sm:gap-2
                transition-all duration-300
                hover:border-black/15 dark:hover:border-white/25
              "
            >
              {/* Search & Create Command Input */}
              <div className="flex-1 relative flex items-center min-w-0">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleCreate(query);
                  }}
                  className="w-full relative flex items-center"
                >
                  <Search className="absolute left-3 w-4 h-4 text-neutral-400 dark:text-neutral-500 pointer-events-none transition-colors" />

                  <input
                    ref={searchInputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search or create project..."
                    className="
                      w-full h-9 sm:h-10 pl-9 pr-24 rounded-full
                      bg-black/[0.03] dark:bg-white/[0.05]
                      hover:bg-black/[0.05] dark:hover:bg-white/[0.08]
                      focus:bg-white/95 dark:focus:bg-[#151724]/95
                      border border-black/[0.05] dark:border-white/[0.08]
                      focus:border-blue-500/40 dark:focus:border-blue-400/40
                      text-xs sm:text-sm font-medium text-neutral-950 dark:text-white
                      placeholder:text-neutral-400 dark:placeholder:text-neutral-500
                      focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-400/20
                      transition-all duration-200
                    "
                  />

                  {/* Inline Action or Shortcut */}
                  <div className="absolute right-2 flex items-center gap-1">
                    {query.trim() ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setQuery("")}
                          className="p-1 rounded-full text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
                          title="Clear search"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="submit"
                          disabled={isCreating}
                          className="
                            flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold
                            bg-blue-600 hover:bg-blue-500 text-white
                            shadow-[0_2px_10px_rgba(37,99,235,0.35)]
                            disabled:opacity-50 transition-all cursor-pointer active:scale-95
                          "
                        >
                          <span>{isCreating ? "..." : "Create"}</span>
                          <CornerDownLeft className="w-3 h-3 opacity-80" />
                        </button>
                      </>
                    ) : (
                      <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-neutral-400 dark:text-neutral-500 bg-black/[0.04] dark:bg-white/[0.06] rounded border border-black/[0.06] dark:border-white/10 select-none">
                        ⌘K
                      </kbd>
                    )}
                  </div>
                </form>
              </div>

              {/* Subtle Hairline Divider */}
              <div className="h-5 w-px bg-black/[0.08] dark:bg-white/12 flex-shrink-0 mx-0.5" />

              {/* Import Action */}
              <button
                type="button"
                onClick={() => setIsImportOpen(true)}
                className="
                  group flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold
                  text-neutral-800 dark:text-neutral-200
                  bg-black/[0.03] dark:bg-white/[0.06]
                  hover:bg-black/[0.07] dark:hover:bg-white/[0.12]
                  border border-black/[0.06] dark:border-white/12
                  hover:border-black/12 dark:hover:border-white/20
                  active:scale-[0.97] transition-all duration-200 flex-shrink-0 cursor-pointer
                "
                title="Import Project"
              >
                <Upload className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400 group-hover:scale-105 transition-transform" />
                <span>Import</span>
              </button>

              {/* Settings Action */}
              <button
                type="button"
                onClick={() => setShowSettings(true)}
                className="
                  group relative flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold
                  text-neutral-800 dark:text-neutral-200
                  bg-black/[0.03] dark:bg-white/[0.06]
                  hover:bg-black/[0.07] dark:hover:bg-white/[0.12]
                  border border-black/[0.06] dark:border-white/12
                  hover:border-black/12 dark:hover:border-white/20
                  active:scale-[0.97] transition-all duration-200 flex-shrink-0 cursor-pointer
                "
                title="Settings"
              >
                <SettingsIcon className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400 group-hover:rotate-45 transition-transform duration-300" />
                <span>Settings</span>
              </button>
            </div>
          </header>

          {/* ===== PROJECTS CANVAS ===== */}
          <main className="space-y-4">
            {filteredProjects.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
                {filteredProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onOpen={() => openProject(project.id)}
                    onDelete={() => setConfirmDeleteId(project.id)}
                  />
                ))}
              </div>
            ) : allProjects.length === 0 ? (
              /* Ultra-minimalist empty state */
              <div className="py-24 text-center flex flex-col items-center justify-center space-y-4">
                <div className="space-y-1">
                  <h2 className="text-sm font-semibold tracking-tight text-neutral-800 dark:text-neutral-200">
                    No projects
                  </h2>
                  <p className="text-xs text-neutral-400 max-w-xs">
                    Type above or pick a preset to begin.
                  </p>
                </div>
                <div className="flex items-center gap-2 pt-2 flex-wrap justify-center">
                  {PRESETS.map((p) => (
                    <LiquidPill
                      key={p.label}
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => handleCreate(p.prompt)}
                    >
                      {p.label}
                    </LiquidPill>
                  ))}
                </div>
              </div>
            ) : (
              /* Search no matches */
              <div className="py-16 text-center space-y-2">
                <p className="text-xs text-neutral-400">No matches</p>
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Clear search
                </button>
              </div>
            )}
          </main>
        </div>


      </div>

      {/* ===== EXPANDED DUAL-MODE IMPORT SHEET ===== */}
      {isImportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-md animate-fade-in"
            onClick={() => {
              if (repoDropdownOpen) {
                setRepoDropdownOpen(false);
              } else if (!isIngesting) {
                setIsImportOpen(false);
              }
            }}
          />

          <LiquidCard
            variant="elevated"
            interactive={false}
            className="relative z-10 w-full max-w-xl p-6 shadow-2xl animate-scale-up border border-black/10 dark:border-white/10 !overflow-visible"
            style={{ borderRadius: "24px" }}
          >
            {/* Header & Tabs */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold tracking-tight text-neutral-950 dark:text-white">
                  Import Project
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                  AI Architecture
                </span>
              </div>
              <button
                type="button"
                disabled={isIngesting}
                onClick={() => setIsImportOpen(false)}
                className="text-xs font-medium text-neutral-400 hover:text-neutral-800 dark:hover:text-white disabled:opacity-40"
              >
                Close
              </button>
            </div>

            {/* Segmented Control Tabs */}
            <div className="grid grid-cols-2 p-1 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/10 mb-4">
              <button
                type="button"
                disabled={isIngesting}
                onClick={() => setImportTab("github")}
                className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
                  importTab === "github"
                    ? "bg-white dark:bg-[#1a1d2e] text-neutral-900 dark:text-white shadow-sm border border-black/[0.05] dark:border-white/10"
                    : "text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                }`}
              >
                <GitBranch className="w-3.5 h-3.5 text-cyan-500" />
                <span>GitHub Repository</span>
              </button>
              <button
                type="button"
                disabled={isIngesting}
                onClick={() => setImportTab("json")}
                className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
                  importTab === "json"
                    ? "bg-white dark:bg-[#1a1d2e] text-neutral-900 dark:text-white shadow-sm border border-black/[0.05] dark:border-white/10"
                    : "text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>JSON Schema</span>
              </button>
            </div>

            {/* TAB 1: GITHUB INGESTION */}
            {importTab === "github" && (
              <div>
                {isIngesting ? (
                  /* Progress State */
                  <div className="py-6 px-4 space-y-5 text-center animate-fade-in">
                    <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                      <div className="absolute inset-0 rounded-full border-2 border-cyan-500/20 animate-ping" />
                      <div className="w-14 h-14 rounded-full bg-cyan-500/10 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                        <Loader2 className="w-7 h-7 animate-spin" />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-neutral-900 dark:text-white">
                        Autonomous Ingestion in Progress
                      </h4>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">
                        Reading source code, detecting schemas & generating full architecture
                      </p>
                    </div>

                    {/* Step Indicators */}
                    <div className="space-y-2 text-left bg-black/[0.02] dark:bg-white/[0.03] p-3.5 rounded-xl border border-black/[0.05] dark:border-white/10">
                      {[
                        { step: 1, label: "Scanning Git tree & discovering file structure" },
                        { step: 2, label: "Reading manifests, models, routes & controllers" },
                        { step: 3, label: "Synthesizing data models, REST APIs & UI pages" },
                        { step: 4, label: "Auditing bugs & crafting External Agent Prompts" },
                        { step: 5, label: "Formulating future roadmap & finalizing project" },
                      ].map((item) => (
                        <div key={item.step} className="flex items-center gap-2.5 text-xs">
                          {ingestStep > item.step ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                          ) : ingestStep === item.step ? (
                            <Loader2 className="w-4 h-4 text-cyan-400 animate-spin flex-shrink-0" />
                          ) : (
                            <div className="w-4 h-4 rounded-full border border-neutral-300 dark:border-white/20 flex-shrink-0" />
                          )}
                          <span
                            className={`font-mono text-[11px] ${
                              ingestStep >= item.step
                                ? "text-neutral-900 dark:text-white font-medium"
                                : "text-neutral-400 dark:text-white/30"
                            }`}
                          >
                            {item.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* Repository Setup Form */
                  <form onSubmit={handleGitHubIngest} className="space-y-4">
                    {/* GitHub Connection Banner */}
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/10 text-xs">
                      {ghConnected && ghUser ? (
                        <div className="flex items-center gap-2">
                          <img
                            src={ghUser.avatar_url}
                            alt=""
                            className="w-5 h-5 rounded-full border border-black/10 dark:border-white/20"
                          />
                          <span className="font-mono text-[11px] text-neutral-800 dark:text-neutral-200">
                            Connected as <strong>@{ghUser.login}</strong>
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400 text-[11px]">
                          <GitBranch className="w-4 h-4 text-neutral-400" />
                          <span>Enter public repo or connect GitHub</span>
                        </div>
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
                          className="px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 hover:opacity-90 transition-opacity cursor-pointer"
                        >
                          Sign In
                        </button>
                      ) : (
                        <span className="text-[10px] font-mono text-emerald-500 flex items-center gap-1 font-bold">
                          <CheckCircle2 className="w-3 h-3" /> OAuth Active
                        </span>
                      )}
                    </div>

                    {/* Pre-fill from User Repos if available */}
                    {ghConnected && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
                            <FolderGit2 className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Select from your repositories</span>
                          </label>
                          {reposLoading ? (
                            <span className="flex items-center gap-1 text-[10px] text-cyan-400 font-mono">
                              <Loader2 className="w-3 h-3 animate-spin" /> Fetching...
                            </span>
                          ) : (
                            <span className="text-[10px] text-neutral-400 font-mono">
                              {userRepos.length} available
                            </span>
                          )}
                        </div>

                        {/* Custom Obsidian Glass Repository Picker */}
                        <div ref={repoDropdownRef} className="relative z-30">
                          <button
                            type="button"
                            onClick={() => setRepoDropdownOpen((prev) => !prev)}
                            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left transition-all duration-200 cursor-pointer ${
                              repoDropdownOpen
                                ? "bg-black/[0.06] dark:bg-white/[0.08] border-cyan-500/50 ring-2 ring-cyan-500/20 shadow-lg"
                                : "bg-white/80 dark:bg-[#0c0d16]/90 hover:bg-black/[0.04] dark:hover:bg-white/[0.05] border-black/10 dark:border-white/12 shadow-sm"
                            } border`}
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                              {selectedRepo?.owner?.avatar_url ? (
                                <img
                                  src={selectedRepo.owner.avatar_url}
                                  alt=""
                                  className="w-5 h-5 rounded-md border border-black/10 dark:border-white/10 flex-shrink-0"
                                />
                              ) : selectedRepo ? (
                                <FolderGit2 className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                              ) : (
                                <GitBranch className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                              )}
                              <span className="font-mono text-xs font-semibold text-neutral-900 dark:text-white truncate">
                                {selectedRepo ? selectedRepo.full_name : (repoUrl || "Choose one of your repositories...")}
                              </span>
                              {selectedRepo && (
                                selectedRepo.private ? (
                                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20 flex-shrink-0">
                                    <Lock className="w-2.5 h-2.5" /> Private
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex-shrink-0">
                                    <Globe className="w-2.5 h-2.5" /> Public
                                  </span>
                                )
                              )}
                            </div>

                            <div className="flex items-center gap-1 flex-shrink-0">
                              {repoUrl && (
                                <div
                                  role="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRepoUrl("");
                                    setRepoBranch("main");
                                  }}
                                  className="p-1 rounded-md text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                                  title="Clear selection"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </div>
                              )}
                              <ChevronDown
                                className={`w-4 h-4 text-neutral-400 transition-transform duration-200 ${
                                  repoDropdownOpen ? "rotate-180 text-cyan-400" : ""
                                }`}
                              />
                            </div>
                          </button>

                          {/* Floating Overlay Dropdown Container */}
                          {repoDropdownOpen && (
                            <div className="absolute left-0 right-0 top-full mt-1.5 z-50 p-3 rounded-2xl bg-[#0c0d16]/98 border border-white/20 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.95)] backdrop-blur-3xl space-y-2.5 animate-in fade-in zoom-in-95 duration-150">
                              {/* Filter Tabs Header */}
                              <div className="flex items-center justify-between gap-1 pb-1 border-b border-white/[0.08]">
                                <div className="flex items-center gap-1 overflow-x-auto py-0.5 custom-scrollbar w-full">
                                  {(
                                    [
                                      { key: "all", label: "All", icon: <FolderGit2 className="w-3 h-3 text-cyan-400" />, count: repoCounts.all },
                                      { key: "self", label: "Self", icon: <User className="w-3 h-3 text-emerald-400" />, count: repoCounts.self },
                                      { key: "starred", label: "Starred", icon: <Star className="w-3 h-3 text-amber-400" />, count: repoCounts.starred },
                                      { key: "org", label: "Organization", icon: <Building2 className="w-3 h-3 text-indigo-400" />, count: repoCounts.org },
                                    ] as const
                                  ).map((tab) => {
                                    const isActive = repoFilterTab === tab.key;
                                    return (
                                      <button
                                        key={tab.key}
                                        type="button"
                                        onClick={() => setRepoFilterTab(tab.key)}
                                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1.5 cursor-pointer flex-shrink-0 ${
                                          isActive
                                            ? "bg-white/20 text-white font-semibold shadow-sm border border-white/25"
                                            : "text-neutral-400 hover:text-white hover:bg-white/5"
                                        }`}
                                      >
                                        {tab.icon}
                                        <span>{tab.label}</span>
                                        <span
                                          className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono ${
                                            isActive
                                              ? "bg-white/25 text-white font-bold"
                                              : "bg-white/10 text-neutral-400"
                                          }`}
                                        >
                                          {tab.count}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Search Input within Dropdown */}
                              <div className="relative">
                                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                                <input
                                  type="text"
                                  value={repoSearchQuery}
                                  onChange={(e) => setRepoSearchQuery(e.target.value)}
                                  placeholder="Search repositories by name or description..."
                                  className="w-full h-8 pl-8 pr-7 rounded-lg bg-white/[0.05] border border-white/10 text-xs font-mono text-white placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                                  autoFocus
                                />
                                {repoSearchQuery && (
                                  <button
                                    type="button"
                                    onClick={() => setRepoSearchQuery("")}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white cursor-pointer"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                )}
                              </div>

                              {/* Repository Cards List */}
                              <div className="max-h-56 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                                {reposLoading && userRepos.length === 0 ? (
                                  <div className="py-8 text-center text-xs text-neutral-400 font-mono space-y-2">
                                    <Loader2 className="w-5 h-5 mx-auto animate-spin text-cyan-400" />
                                    <div>Fetching your repositories from GitHub...</div>
                                  </div>
                                ) : filteredRepos.length === 0 ? (
                                  <div className="py-6 text-center text-xs text-neutral-400 font-mono space-y-2">
                                    <div>No repositories found</div>
                                    <div className="text-[10px] text-neutral-500">
                                      {repoSearchQuery
                                        ? `No matches found for "${repoSearchQuery}"`
                                        : "No repositories under this tab"}
                                    </div>
                                    {(repoSearchQuery || repoFilterTab !== "all") && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setRepoSearchQuery("");
                                          setRepoFilterTab("all");
                                        }}
                                        className="text-[10px] text-cyan-400 hover:underline cursor-pointer"
                                      >
                                        Reset filters
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  filteredRepos.map((r: any) => {
                                    const isSelected =
                                      repoUrl.toLowerCase() === r.full_name?.toLowerCase() ||
                                      repoUrl.toLowerCase() === r.html_url?.toLowerCase() ||
                                      repoUrl.toLowerCase() === r.name?.toLowerCase();
                                    const isOrg =
                                      r.owner?.type === "Organization" ||
                                      (ghUser?.login && r.owner?.login?.toLowerCase() !== ghUser.login.toLowerCase());

                                    return (
                                      <button
                                        key={r.id}
                                        type="button"
                                        onClick={() => {
                                          setRepoUrl(r.full_name || r.name);
                                          if (r.default_branch) setRepoBranch(r.default_branch);
                                          setRepoDropdownOpen(false);
                                        }}
                                        className={`w-full text-left p-2.5 rounded-xl transition-all duration-150 flex items-start justify-between gap-2.5 group cursor-pointer ${
                                          isSelected
                                            ? "bg-cyan-500/15 border border-cyan-500/40 shadow-sm"
                                            : "hover:bg-white/[0.07] border border-transparent"
                                        }`}
                                      >
                                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                          {r.owner?.avatar_url ? (
                                            <img
                                              src={r.owner.avatar_url}
                                              alt=""
                                              className="w-5 h-5 rounded-md mt-0.5 border border-white/10 flex-shrink-0"
                                            />
                                          ) : isOrg ? (
                                            <Building2 className="w-4 h-4 mt-0.5 text-indigo-400 flex-shrink-0" />
                                          ) : (
                                            <User className="w-4 h-4 mt-0.5 text-cyan-400 flex-shrink-0" />
                                          )}

                                          <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              <span className="font-mono text-xs font-semibold text-white group-hover:text-cyan-300 transition-colors truncate">
                                                {r.full_name || r.name}
                                              </span>
                                              {r.private ? (
                                                <span className="flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                                  <Lock className="w-2.5 h-2.5" /> Private
                                                </span>
                                              ) : (
                                                <span className="flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                  <Globe className="w-2.5 h-2.5" /> Public
                                                </span>
                                              )}
                                              {r.fork && (
                                                <span className="flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-mono bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                                  <GitFork className="w-2.5 h-2.5" /> Fork
                                                </span>
                                              )}
                                            </div>

                                            {r.description && (
                                              <p className="text-[10px] text-neutral-400 line-clamp-1 mt-0.5">
                                                {r.description}
                                              </p>
                                            )}
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-2 flex-shrink-0 pt-0.5">
                                          {(r.isStarred || (typeof r.stargazers_count === "number" && r.stargazers_count > 0)) && (
                                            <span className="flex items-center gap-1 text-[10px] font-mono text-amber-400/90">
                                              <Star className="w-3 h-3 fill-amber-400/40 text-amber-400" />
                                              <span>{r.stargazers_count ?? 1}</span>
                                            </span>
                                          )}
                                          {isSelected ? (
                                            <Check className="w-4 h-4 text-cyan-400" />
                                          ) : (
                                            <ArrowRight className="w-3.5 h-3.5 text-neutral-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                                          )}
                                        </div>
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

                    {/* Repository Input & Branch */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2 space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center justify-between">
                          <span>Repository URL or Name</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={repoUrl}
                          onChange={(e) => setRepoUrl(e.target.value)}
                          placeholder="e.g. owner/repo or URL"
                          className="w-full h-9 px-3 rounded-xl bg-white/90 dark:bg-[#121422] border border-black/[0.1] dark:border-white/10 text-xs font-mono text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
                          <GitBranch className="w-3 h-3 text-cyan-500" />
                          <span>Branch</span>
                        </label>
                        <input
                          type="text"
                          value={repoBranch}
                          onChange={(e) => setRepoBranch(e.target.value)}
                          placeholder="main"
                          className="w-full h-9 px-3 rounded-xl bg-white/90 dark:bg-[#121422] border border-black/[0.1] dark:border-white/10 text-xs font-mono text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
                        />
                      </div>
                    </div>

                    {/* Feature Highlights */}
                    <div className="grid grid-cols-3 gap-2 p-2 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/10 text-xs">
                      <div className="flex items-center gap-1.5 text-neutral-700 dark:text-neutral-300 min-w-0">
                        <Sparkles className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                        <span className="text-[10px] font-medium truncate">Models & APIs</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-neutral-700 dark:text-neutral-300 min-w-0">
                        <ShieldCheck className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                        <span className="text-[10px] font-medium truncate">Bug Audit</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-neutral-700 dark:text-neutral-300 min-w-0">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                        <span className="text-[10px] font-medium truncate">Task Tracking</span>
                      </div>
                    </div>

                    {/* Submit Actions */}
                    <div className="flex justify-end gap-2 pt-2">
                      <LiquidPill
                        type="button"
                        variant="subtle"
                        size="sm"
                        onClick={() => setIsImportOpen(false)}
                      >
                        Cancel
                      </LiquidPill>
                      <button
                        type="submit"
                        disabled={!repoUrl.trim()}
                        className="
                          flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold
                          bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 text-white
                          hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all cursor-pointer shadow-lg
                        "
                      >
                        <span>Import & Ingest with AI</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* TAB 2: JSON SPECIFICATION IMPORT */}
            {importTab === "json" && (
              <div>
                {/* Quick Actions */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-black/[0.03] dark:bg-white/[0.06] hover:bg-black/[0.07] dark:hover:bg-white/[0.12] border border-black/[0.06] dark:border-white/10 text-neutral-800 dark:text-neutral-200 transition-colors"
                    >
                      <span>Upload File</span>
                    </button>
                    {importJson.trim() && (
                      <button
                        type="button"
                        onClick={() => setImportJson("")}
                        className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-black/[0.03] dark:bg-white/[0.06] hover:bg-black/[0.07] dark:hover:bg-white/[0.12] border border-black/[0.06] dark:border-white/10 text-neutral-800 dark:text-neutral-200 transition-colors"
                      >
                        <span>Clear</span>
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

                  <span
                    className={`text-[10px] font-medium ${
                      jsonError ? "text-amber-500" : "text-emerald-500"
                    }`}
                  >
                    {jsonError ? "Invalid JSON" : "Ready"}
                  </span>
                </div>

                {/* JSON Area */}
                <form onSubmit={handleImport} className="space-y-3">
                  <textarea
                    value={importJson}
                    onChange={(e) => setImportJson(e.target.value)}
                    placeholder="Paste JSON schema..."
                    spellCheck={false}
                    className="
                      w-full h-44 p-3 rounded-xl
                      bg-white/85 dark:bg-[#121422]/90
                      border border-black/[0.08] dark:border-white/[0.1]
                      text-[11px] font-mono leading-relaxed text-neutral-900 dark:text-neutral-100
                      focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none
                    "
                  />

                  <div className="flex justify-end gap-2 pt-1">
                    <LiquidPill
                      type="button"
                      variant="subtle"
                      size="sm"
                      onClick={() => setIsImportOpen(false)}
                    >
                      Cancel
                    </LiquidPill>
                    <LiquidPill
                      type="submit"
                      variant="primary"
                      size="sm"
                      disabled={Boolean(jsonError) || isImporting}
                    >
                      <span>{isImporting ? "Importing..." : "Import"}</span>
                    </LiquidPill>
                  </div>
                </form>
              </div>
            )}
          </LiquidCard>
        </div>
      )}

      {/* ===== MINIMALIST DELETE CONFIRMATION ===== */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
            onClick={() => setConfirmDeleteId(null)}
          />

          <LiquidCard
            variant="elevated"
            className="relative z-10 w-full max-w-xs p-4 text-center shadow-2xl animate-scale-up"
            style={{ borderRadius: "20px" }}
          >
            <h3 className="text-xs font-semibold text-neutral-900 dark:text-white mb-1">
              Delete project?
            </h3>
            <p className="text-[11px] text-neutral-400 mb-3">
              Cannot be undone.
            </p>
            <div className="flex gap-2">
              <LiquidPill
                variant="subtle"
                size="sm"
                className="flex-1"
                onClick={() => setConfirmDeleteId(null)}
              >
                Cancel
              </LiquidPill>
              <LiquidPill
                variant="danger"
                size="sm"
                className="flex-1"
                onClick={() => handleDelete(confirmDeleteId)}
              >
                Delete
              </LiquidPill>
            </div>
          </LiquidCard>
        </div>
      )}
    </div>
  );
};

/* ─── Ultra-Minimalist Apple Liquid Project Card (Zero Icons) ─── */
const ProjectCard: React.FC<{
  project: ProjectSummary;
  onOpen: () => void;
  onDelete: () => void;
}> = ({ project, onOpen, onDelete }) => {
  const formattedDate = useMemo(() => {
    try {
      const d = new Date(project.updated_at);
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    } catch {
      return "Recent";
    }
  }, [project.updated_at]);

  return (
    <LiquidCard
      variant="glass"
      className="p-5 flex flex-col justify-between h-36 group transition-all duration-300"
      onClick={onOpen}
    >
      {/* Top row: Date pill badge & Delete text */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-neutral-700 dark:text-neutral-300 px-2 py-0.5 rounded-full bg-black/[0.06] dark:bg-white/[0.08] border border-black/[0.06] dark:border-white/10">
          {formattedDate}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="text-[11px] font-medium text-neutral-500 hover:text-rose-600 dark:text-neutral-400 dark:hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100 px-1.5 py-0.5 rounded-md hover:bg-rose-500/10"
        >
          Delete
        </button>
      </div>

      {/* Middle: Project Title */}
      <div className="my-auto">
        <h3 className="text-sm font-bold text-neutral-950 dark:text-white tracking-tight line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          {project.name}
        </h3>
      </div>

      {/* Bottom: Subtle status & Open text */}
      <div className="pt-2 flex items-center justify-between">
        <span className="text-[10px] font-medium text-neutral-600 dark:text-neutral-400">
          Ready
        </span>
        <span className="text-xs font-bold text-blue-600 dark:text-blue-400 group-hover:translate-x-0.5 transition-transform">
          Open
        </span>
      </div>
    </LiquidCard>
  );
};

export default DashboardLanding;
