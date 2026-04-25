/**
 * DashboardLanding Component
 *
 * Main landing screen to see all projects, search, create, delete, or import.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useProjectStore } from "../hooks/useProjectStore";
import { useSettings } from "../context/SettingsContext";
import {
  createProject,
  deleteProject,
  generateStructuredIdea,
  getProjectImportTemplate,
  importProject,
  openProject,
  setActivePage,
} from "../stores/projectStore";
import { useToast } from "../context/ToastContext";
import { useTheme } from "../context/ThemeContext";
import IDESettingsModal from "../components/Modals/IDESettingsModal";
import IdeaWorkshop from "./IdeaWorkshop";

interface ProjectSummary {
  id: string;
  name: string;
  updated_at: string;
}

type CreateMode = "workshop" | "json";

const DashboardLanding: React.FC = () => {
  const { projects, workspacePath } = useProjectStore();
  const { theme } = useTheme();
  const { apiKey, model, apiBaseUrl } = useSettings();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreateWorkshopOpen, setIsCreateWorkshopOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectJson, setProjectJson] = useState("");
  const [createMode, setCreateMode] = useState<CreateMode>("workshop");
  const [jsonLoading, setJsonLoading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const filteredProjects = useMemo(
    () =>
      (projects || []).filter((project) =>
        project.name.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    [projects, searchQuery],
  );

  const jsonError = useMemo(() => {
    if (!projectJson.trim()) return "JSON template is empty.";

    try {
      JSON.parse(projectJson);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "Invalid JSON";
    }
  }, [projectJson]);

  useEffect(() => {
    if (!isCreateModalOpen || createMode !== "json" || projectJson.trim()) {
      return;
    }

    void loadJsonTemplate(projectName);
  }, [createMode, isCreateModalOpen, projectJson, projectName]);

  const ambientBackground =
    theme === "light"
      ? "radial-gradient(circle at 14% -8%, rgba(148, 163, 184, 0.34), transparent 40%), radial-gradient(circle at 86% 10%, rgba(99, 102, 241, 0.14), transparent 34%), linear-gradient(180deg, rgba(255, 255, 255, 0.28), rgba(255, 255, 255, 0))"
      : "radial-gradient(circle at 20% 0%, rgba(99, 102, 241, 0.15), transparent 40%), radial-gradient(circle at 80% 80%, rgba(168, 85, 247, 0.05), transparent 40%)";

  const createModeLabel = createMode === "workshop" ? "Guided flow" : "Structured import";

  async function loadJsonTemplate(name?: string) {
    setJsonLoading(true);
    try {
      const template = await getProjectImportTemplate(name?.trim() || undefined);
      setProjectJson(template);
    } catch (error) {
      toast.showToast(`Failed to load sample JSON: ${error}`, "error");
    } finally {
      setJsonLoading(false);
    }
  }

  const openCreateModal = () => {
    setIsCreateWorkshopOpen(false);
    setIsCreateModalOpen(true);
    setCreateMode("workshop");
    setProjectJson("");
  };

  const handleNextStep = (event: React.FormEvent) => {
    event.preventDefault();
    if (!projectName.trim()) return;
    setIsCreateModalOpen(false);
    setIsCreateWorkshopOpen(true);
  };

  const handleCreateProjectFinal = async (refinedIdea: string) => {
    try {
      await createProject(projectName.trim(), refinedIdea);
      try {
        await generateStructuredIdea(refinedIdea, apiKey, model, apiBaseUrl);
      } catch (ideaError) {
        toast.showToast(`Project created, but PRD generation failed: ${ideaError}`, "warning");
      }
      setActivePage("idea");
      setProjectName("");
      setProjectJson("");
      setIsCreateModalOpen(false);
      setIsCreateWorkshopOpen(false);
      setCreateMode("workshop");
      toast.showToast("Project created successfully.", "success");
    } catch (error) {
      toast.showToast(`Failed to create project: ${error}`, "error");
    }
  };

  const handleImportProject = async (event: React.FormEvent) => {
    event.preventDefault();

    if (jsonError) {
      toast.showToast(`Invalid JSON: ${jsonError}`, "error");
      return;
    }

    try {
      await importProject(projectJson);
      setProjectName("");
      setProjectJson("");
      setCreateMode("workshop");
      setIsCreateModalOpen(false);
      toast.showToast("Project imported from JSON.", "success");
    } catch (error) {
      toast.showToast(`Failed to import project: ${error}`, "error");
    }
  };

  const handleJsonFileSelected = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const nextJson = await file.text();
      setProjectJson(nextJson);
      setCreateMode("json");
      toast.showToast(`${file.name} loaded into the editor.`, "success");
    } catch (error) {
      toast.showToast(`Failed to read JSON file: ${error}`, "error");
    } finally {
      event.target.value = "";
    }
  };

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(projectJson);
      toast.showToast("JSON copied to clipboard.", "success");
    } catch {
      toast.showToast("Clipboard copy failed.", "error");
    }
  };

  const handleDownloadJson = () => {
    const blob = new Blob([projectJson], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${(projectName.trim() || "project-sample")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "project-sample"}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const handleCancelCreate = () => {
    setIsCreateModalOpen(false);
    setIsCreateWorkshopOpen(false);
    setProjectName("");
    setProjectJson("");
    setCreateMode("workshop");
    setJsonLoading(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteProject(id, true);
      setConfirmDeleteId(null);
    } catch (error) {
      toast.showToast(`Failed to delete project: ${error}`, "error");
    }
  };

  return (
    <div className="relative h-full w-full bg-[#050508] text-white flex flex-col overflow-hidden selection:bg-indigo-500/30">
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: ambientBackground }}
      />

      <div className="relative z-10 flex-1 overflow-y-auto p-6 md:p-10 lg:p-12 pt-6 custom-scrollbar">
        <div className="max-w-[1600px] mx-auto space-y-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 animate-fade-in group">
            <div className="space-y-2">
              <h1 className="text-4xl md:text-5xl font-black tracking-[-0.04em] uppercase italic flex items-center gap-3 drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                PROJECTS <span className="text-indigo-500">.</span>
              </h1>
              <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
                <span>WORKSPACE</span>
                <span className="text-white/20">/</span>
                <span className="text-white/70 truncate max-w-[200px] sm:max-w-xs md:max-w-md drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">
                  {workspacePath ? "CLOUD WORKSPACE" : "LOCAL WORKSPACE"}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setShowSettingsModal(true)}
                  className="h-10 w-10 flex items-center justify-center rounded-xl text-white/40 hover:text-white transition-all border border-white/5 hover:border-white/20 hover:bg-white/5"
                  title="IDE Settings"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                    />
                    <circle cx="12" cy="12" r="3" strokeWidth="2" />
                  </svg>
                </button>

                <div className="relative flex-1 sm:flex-initial group/search bg-[#111116] border border-white/5 rounded-2xl flex items-center transition-all hover:border-white/10 focus-within:ring-2 focus-within:ring-[#0ea5e9]/30 focus-within:border-[#0ea5e9]/50 w-full sm:w-56 md:w-64">
                  <div className="pl-4 pr-3 flex items-center pointer-events-none">
                    <svg
                      className="w-4 h-4 text-white/30 group-focus-within/search:text-[#0ea5e9] transition-colors"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2.5"
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                  </div>
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className="bg-transparent h-10 w-full text-xs text-white placeholder:text-white/20 focus:outline-none"
                  />
                </div>
              </div>

              <button
                onClick={openCreateModal}
                className="h-10 px-6 rounded-xl bg-[#0ea5e9] hover:bg-[#0284c7] text-[#050508] font-bold text-xs transition-all shadow-[0_0_20px_rgba(14,165,233,0.3)] hover:shadow-[0_0_25px_rgba(14,165,233,0.5)] flex items-center justify-center gap-2 whitespace-nowrap"
              >
                New Project
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-white/30 font-bold tracking-widest uppercase">
            <span>
              {filteredProjects.length} project
              {filteredProjects.length === 1 ? "" : "s"}
            </span>
          </div>

          {filteredProjects.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-fade-in pb-12">
              {filteredProjects.map((project, index) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  index={index}
                  onOpen={() => openProject(project.id)}
                  onDelete={() => setConfirmDeleteId(project.id)}
                />
              ))}
            </div>
          ) : (
            <div className="flex-1 min-h-[360px] flex flex-col items-center justify-center p-14 bg-[var(--ide-bg-elevated)] border-2 border-dashed border-[var(--ide-border)] rounded-3xl animate-fade-in transition-all">
              <div className="w-20 h-20 rounded-3xl bg-[var(--ide-bg-panel)] border border-[var(--ide-border)] flex items-center justify-center mb-6 shadow-[var(--ide-shadow)]">
                <svg
                  className="w-9 h-9 text-[var(--ide-text-muted)]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.5"
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
              </div>
              <h3 className="text-2xl font-black mb-3">Welcome to Akasha</h3>
              <p className="text-[var(--ide-text-secondary)] text-sm text-center max-w-sm mb-8 leading-relaxed font-medium">
                {searchQuery
                  ? "No projects match your search criteria."
                  : "Create your first project to start building with visual full-stack tools."}
              </p>
              <button
                onClick={openCreateModal}
                className="btn-modern-primary !h-12 !px-12"
              >
                Create Project
              </button>
            </div>
          )}
        </div>

        <IDESettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
        />

        {confirmDeleteId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/55 backdrop-blur-md animate-fade-in"
              onClick={() => setConfirmDeleteId(null)}
            />
            <div className="relative w-full max-w-sm bg-[var(--ide-bg-panel)] border border-[var(--ide-border-strong)] rounded-3xl shadow-[var(--ide-shadow)] p-8 animate-slide-up">
              <h3 className="text-lg font-black text-[var(--ide-text)] mb-2">
                Delete Project?
              </h3>
              <p className="text-sm text-[var(--ide-text-secondary)] mb-6">
                This action cannot be undone. The project and all its data will
                be permanently removed.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  className="flex-1 py-3 rounded-xl border border-[var(--ide-border)] text-[var(--ide-text-secondary)] font-bold text-xs uppercase tracking-wider hover:bg-[var(--ide-bg-elevated)] hover:text-[var(--ide-text)] transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(confirmDeleteId)}
                  className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold text-xs uppercase tracking-wider hover:bg-red-600 transition-all"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {isCreateModalOpen && (
          <div className="fixed inset-0 z-[100] bg-[rgba(5,5,8,0.94)] backdrop-blur-xl animate-fade-in">
            <button
              type="button"
              aria-label="Close create project screen"
              onClick={handleCancelCreate}
              className="absolute inset-0 cursor-default"
            />

            <div className="relative z-10 flex h-full w-full flex-col">
              <div className="flex items-center justify-between border-b border-white/10 bg-black/25 px-5 py-4 md:px-8">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-500 text-white flex items-center justify-center shadow-xl shadow-indigo-500/20 shrink-0">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300/90">
                      Project Setup
                    </p>
                    <h2 className="truncate text-xl md:text-2xl font-black leading-tight text-white">
                      Start with a workshop or direct JSON import
                    </h2>
                  </div>
                </div>

                <div className="inline-flex rounded-2xl border border-white/10 bg-white/[0.03] p-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setCreateMode("workshop")}
                    className={`h-10 px-4 rounded-xl text-[11px] font-black uppercase tracking-[0.22em] transition-all ${
                      createMode === "workshop"
                        ? "bg-gradient-to-r from-indigo-500 to-cyan-500 text-white shadow-lg shadow-indigo-500/20"
                        : "text-[var(--ide-text-secondary)] hover:text-white"
                    }`}
                  >
                    Workshop
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCreateMode("json");
                      if (!projectJson.trim()) {
                        void loadJsonTemplate(projectName);
                      }
                    }}
                    className={`h-10 px-4 rounded-xl text-[11px] font-black uppercase tracking-[0.22em] transition-all ${
                      createMode === "json"
                        ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/20"
                        : "text-[var(--ide-text-secondary)] hover:text-white"
                    }`}
                  >
                    Direct JSON Import
                  </button>
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-hidden">
                <div className="grid h-full min-h-0 items-stretch lg:grid-cols-[360px_minmax(0,1fr)]">
                  <aside className="h-full min-h-0 self-stretch overflow-auto border-b border-white/10 bg-black/20 px-5 py-5 md:px-8 lg:border-b-0 lg:border-r lg:px-6">
                    <div className="flex h-full flex-col justify-between gap-5">
                      <div className="space-y-3">
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-white/70">
                          <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,0.8)]" />
                          {createModeLabel}
                        </div>
                        <p className="max-w-md text-sm leading-6 text-[var(--ide-text-secondary)]">
                          Start clean with a guided brief or skip the workshop entirely by importing JSON directly.
                        </p>
                      </div>

                      <div className="rounded-[1.6rem] border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.02] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.22em] text-white/45">
                          <span>Creation pipeline</span>
                          <span>3 steps</span>
                        </div>
                        <div className="mt-4 grid gap-3">
                          {[
                            ["01", "Name the project", "Give the workspace a clear product identity."],
                            ["02", "Choose the source", "Use workshop planning or direct JSON import."],
                            ["03", "Move into build", "Continue into the visual builder with structure."],
                          ].map(([index, title, description]) => (
                            <div key={index} className="flex gap-3 rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
                              <div className="mt-0.5 h-8 w-8 shrink-0 rounded-xl bg-white/[0.04] text-[10px] font-black text-white flex items-center justify-center">
                                {index}
                              </div>
                              <div className="min-w-0">
                                <div className="text-[11px] font-black uppercase tracking-[0.2em] text-white">{title}</div>
                                <p className="mt-1 text-xs leading-5 text-white/55">{description}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
                        <div>
                          <label className="text-[10px] font-black uppercase tracking-[0.24em] text-white/55">
                            Project Name
                          </label>
                          <input
                            type="text"
                            autoFocus
                            value={projectName}
                            onChange={(event) => setProjectName(event.target.value)}
                            placeholder="e.g. Neo-Commerce"
                            className="mt-3 w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-base font-semibold text-white placeholder:text-white/25 focus:outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500/40 transition-all"
                            required={createMode === "workshop"}
                          />
                        </div>

                        <div className="rounded-2xl border border-cyan-500/15 bg-cyan-500/6 p-4">
                          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">
                            Recommended first step
                          </div>
                          <p className="mt-2 text-sm leading-6 text-[var(--ide-text-secondary)]">
                            Use the workshop if you want the app to turn an idea into a product brief before implementation.
                          </p>
                        </div>
                      </div>
                      <div className="hidden lg:block rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-[10px] uppercase tracking-[0.22em] text-white/35">
                        Left panel stays full height for project setup context.
                      </div>
                    </div>
                  </aside>

                  {createMode === "workshop" ? (
                    <form onSubmit={handleNextStep} className="h-full min-h-0 overflow-auto px-5 py-5 md:px-8 lg:px-8 lg:py-6">
                      <div className="mx-auto flex max-w-5xl min-h-full flex-col justify-between gap-6">
                        <div className="space-y-5">
                          <div className="rounded-3xl border border-emerald-500/15 bg-[linear-gradient(180deg,rgba(16,185,129,0.14),rgba(16,185,129,0.05))] p-5">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-300">
                                  Workshop Mode
                                </div>
                                <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-50/78">
                                  Turn the idea into a clear product brief, then continue into the visual builder with a stronger plan.
                                </p>
                              </div>
                              <div className="hidden md:flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-200 shadow-[0_0_30px_rgba(16,185,129,0.15)]">
                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m0 7a9 9 0 11-6-16.19" />
                                </svg>
                              </div>
                            </div>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            {[
                              ["Output", "Refined project brief"],
                              ["Best for", "New ideas and discovery"],
                              ["Includes", "AI-assisted planning"],
                                ["Next step", "Visual Builder"],
                            ].map(([label, value]) => (
                              <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/35">{label}</div>
                                <div className="mt-1 text-sm font-semibold text-white">{value}</div>
                              </div>
                            ))}
                          </div>

                          <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-white/45">
                                  Preview
                                </div>
                                <p className="mt-2 text-sm leading-6 text-[var(--ide-text-secondary)]">
                                  A concise planning pass keeps the first build step focused and professional.
                                </p>
                              </div>
                              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/55">
                                PRD → Builder
                              </div>
                            </div>

                            <div className="mt-5 grid gap-3 sm:grid-cols-3">
                              {[
                                ["Scope", "Capture the product intent."],
                                ["Flow", "Map the experience before design."],
                                ["Build", "Enter the builder with context."],
                              ].map(([title, description]) => (
                                <div key={title} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                                  <div className="text-[11px] font-black uppercase tracking-[0.2em] text-white">{title}</div>
                                  <p className="mt-2 text-xs leading-5 text-white/55">{description}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-3 sm:gap-4 pt-2">
                          <button
                            type="button"
                            onClick={handleCancelCreate}
                            className="flex-1 h-11 rounded-2xl border border-white/10 text-[11px] font-black uppercase tracking-[0.22em] text-[var(--ide-text-secondary)] hover:text-white hover:bg-white/[0.04] transition-all"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={!projectName.trim()}
                            className="flex-1 h-11 rounded-2xl bg-gradient-to-r from-indigo-500 to-cyan-500 text-white font-black text-[11px] uppercase tracking-[0.22em] hover:opacity-95 active:scale-[0.98] transition-all disabled:opacity-30 shadow-lg shadow-indigo-500/20"
                          >
                            Next: Workshop &rarr;
                          </button>
                        </div>
                      </div>
                    </form>
                  ) : (
                    <form onSubmit={handleImportProject} className="h-full min-h-0 overflow-auto px-5 py-5 md:px-8 lg:px-8 lg:py-6">
                      <div className="mx-auto flex max-w-5xl min-h-full flex-col">
                        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 lg:flex lg:flex-col lg:flex-1">
                          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                            <div className="space-y-2">
                              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">
                                Direct JSON Import
                              </div>
                              <p className="max-w-xl text-sm leading-6 text-[var(--ide-text-secondary)]">
                                Paste or upload a project JSON file and import it directly. This path skips the workshop and refinement flow.
                              </p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => void loadJsonTemplate(projectName)}
                                className="h-10 px-4 rounded-xl border border-white/10 bg-white/[0.02] text-[11px] font-black uppercase tracking-[0.22em] text-white/80 hover:bg-white/[0.06] transition-all"
                              >
                                {jsonLoading ? "Loading..." : "Reload Sample JSON"}
                              </button>
                              <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="h-10 px-4 rounded-xl border border-white/10 bg-white/[0.02] text-[11px] font-black uppercase tracking-[0.22em] text-white/80 hover:bg-white/[0.06] transition-all"
                              >
                                Upload JSON File
                              </button>
                              <button
                                type="button"
                                onClick={handleCopyJson}
                                disabled={!projectJson.trim()}
                                className="h-10 px-4 rounded-xl border border-white/10 bg-white/[0.02] text-[11px] font-black uppercase tracking-[0.22em] text-white/80 hover:bg-white/[0.06] transition-all disabled:opacity-40"
                              >
                                Copy JSON
                              </button>
                              <button
                                type="button"
                                onClick={handleDownloadJson}
                                disabled={!projectJson.trim()}
                                className="h-10 px-4 rounded-xl border border-white/10 bg-white/[0.02] text-[11px] font-black uppercase tracking-[0.22em] text-white/80 hover:bg-white/[0.06] transition-all disabled:opacity-40"
                              >
                                Download JSON
                              </button>
                            </div>
                          </div>

                          <input
                            ref={fileInputRef}
                            type="file"
                            accept=".json,application/json"
                            className="hidden"
                            onChange={handleJsonFileSelected}
                          />

                          <div className="mt-4 rounded-[1.5rem] border border-cyan-500/20 bg-[#06080d] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                            <div className="flex items-center justify-between border-b border-white/5 pb-3">
                              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45">
                                JSON editor
                              </div>
                              <div className={`text-[10px] font-black uppercase tracking-[0.22em] ${jsonError ? "text-rose-300" : "text-emerald-300"}`}>
                                {jsonError ? "Invalid JSON" : "Valid JSON"}
                              </div>
                            </div>

                            <textarea
                              value={projectJson}
                              onChange={(event) => setProjectJson(event.target.value)}
                              spellCheck={false}
                              className="mt-4 min-h-[56vh] w-full resize-none rounded-2xl border border-white/5 bg-transparent px-1 py-1 text-sm leading-6 text-slate-100 font-mono focus:outline-none placeholder:text-slate-400/40"
                              placeholder="Paste JSON here, or load the sample and import directly."
                            />
                          </div>

                          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
                            <div className={`rounded-2xl border px-4 py-3 text-xs font-semibold ${jsonError ? "border-rose-500/20 bg-rose-500/8 text-rose-200" : "border-emerald-500/20 bg-emerald-500/8 text-emerald-200"}`}>
                              {jsonError
                                ? `Invalid JSON: ${jsonError}`
                                : "JSON is valid and ready for direct import."}
                            </div>
                            <div className="text-[10px] uppercase tracking-[0.22em] text-white/35 md:text-right">
                              Tip: this path bypasses workshop and AI refinement.
                            </div>
                          </div>

                          <div className="mt-4 rounded-3xl border border-white/10 bg-black/20 p-4">
                            <div className="flex items-center justify-between">
                              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-white/45">
                                Direct import checklist
                              </div>
                              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">
                                Ready when valid
                              </div>
                            </div>
                            <div className="mt-3 grid gap-2 sm:grid-cols-3">
                              {[
                                ["Schema", "Valid JSON"],
                                ["Structure", "Pages and blocks align"],
                                ["Action", "Direct import to workspace"],
                              ].map(([label, value]) => (
                                <div key={label} className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/35">{label}</div>
                                  <div className="mt-1 text-sm font-semibold text-white">{value}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="mt-5 flex gap-3 sm:gap-4">
                          <button
                            type="button"
                            onClick={handleCancelCreate}
                            className="flex-1 h-11 rounded-2xl border border-white/10 text-[11px] font-black uppercase tracking-[0.22em] text-[var(--ide-text-secondary)] hover:text-white hover:bg-white/[0.04] transition-all"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={Boolean(jsonError) || jsonLoading}
                            className="flex-1 h-11 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black text-[11px] uppercase tracking-[0.22em] hover:opacity-95 active:scale-[0.98] transition-all disabled:opacity-30 shadow-lg shadow-emerald-500/20"
                          >
                            Import Project JSON
                          </button>
                        </div>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {isCreateWorkshopOpen && (
          <div className="fixed inset-0 z-[10010] bg-[#050508] animate-fade-in">
            <div
              className="pointer-events-none absolute inset-0"
              style={{ background: ambientBackground }}
            />
            <div className="relative h-full w-full">
              <IdeaWorkshop
                projectName={projectName || "New Project"}
                fullScreen
                onRefined={handleCreateProjectFinal}
                onCancel={handleCancelCreate}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const ProjectCard: React.FC<{
  project: ProjectSummary;
  index: number;
  onOpen: () => void;
  onDelete: () => void;
}> = ({ project, index, onOpen, onDelete }) => {
  return (
    <div
      className="group bg-[#111116] border border-white/[0.03] rounded-3xl p-6 hover:border-white/10 transition-all duration-300 flex flex-col h-64 relative overflow-hidden cursor-pointer shadow-lg hover:shadow-[0_10px_40px_rgba(0,0,0,0.5)]"
      style={{ animationDelay: `${index * 40}ms` }}
      onClick={onOpen}
    >
      <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-indigo-500/[0.02] to-transparent pointer-events-none" />

      <div className="absolute -top-16 -right-16 w-32 h-32 bg-indigo-500/10 blur-[50px] rounded-full group-hover:bg-[#0ea5e9]/20 transition-all duration-700" />

      <div className="relative z-10 flex-1">
        <div className="w-12 h-12 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-center mb-6 group-hover:border-white/10 group-hover:bg-white/[0.04] transition-all duration-300 shadow-inner">
          <svg
            className="w-5 h-5 text-indigo-400 group-hover:text-[#0ea5e9] transition-colors duration-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
        </div>
        <h3 className="text-xl font-black text-white mb-2 leading-tight tracking-tight drop-shadow-sm">
          {project.name}
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-white/30 font-black uppercase tracking-widest bg-white/5 px-2 py-1 rounded border border-white/5">
            {new Date(project.updated_at).toLocaleDateString()}
          </span>
          <span className="w-1 h-1 rounded-full bg-white/10" />
          <span className="text-[9px] text-white/30 font-black uppercase tracking-widest">
            IDE v0.1.0
          </span>
        </div>
      </div>

      <div className="relative z-10 flex items-center gap-3 mt-4 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
        <div className="flex-1 text-[11px] font-black text-indigo-500 uppercase tracking-widest">
          Open Project
        </div>
        <button
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
          className="p-2.5 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl transition-all"
          title="Delete Project"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default DashboardLanding;
