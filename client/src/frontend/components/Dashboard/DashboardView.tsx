/**
 * DashboardView Component
 *
 * Main landing screen to see all projects, search, create, and delete.
 */

import React, { useMemo, useState } from "react";
import { useProjectStore } from "../../hooks/useProjectStore";
import { openProject, deleteProject, createProject } from "../../stores/projectStore";
import { useToast } from "../../context/ToastContext";
import { useTheme } from "../../context/ThemeContext";
import IDESettingsModal from "../Modals/IDESettingsModal";
import WindowControls from "../UI/WindowControls";

interface ProjectSummary {
    id: string;
    name: string;
    updated_at: string;
}

const DashboardView: React.FC = () => {
    const { projects, workspacePath, loading } = useProjectStore();
    const { theme } = useTheme();
    const toast = useToast();
    const [searchQuery, setSearchQuery] = useState("");
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [projectName, setProjectName] = useState("");
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    const filteredProjects = useMemo(
        () => projects.filter((project) => project.name.toLowerCase().includes(searchQuery.toLowerCase())),
        [projects, searchQuery]
    );

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!projectName.trim()) return;

        try {
            await createProject(projectName.trim());
            setProjectName("");
            setIsCreateModalOpen(false);
        } catch (err) {
            toast.showToast(`Failed to create project: ${err}`, "error");
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteProject(id, true);
            setConfirmDeleteId(null);
        } catch (err) {
            toast.showToast(`Failed to delete project: ${err}`, "error");
        }
    };

    const ambientBackground =
        theme === "light"
            ? "radial-gradient(circle at 14% -8%, rgba(148, 163, 184, 0.34), transparent 40%), radial-gradient(circle at 86% 10%, rgba(99, 102, 241, 0.14), transparent 34%), linear-gradient(180deg, rgba(255, 255, 255, 0.28), rgba(255, 255, 255, 0))"
            : "radial-gradient(circle at 20% 0%, rgba(99, 102, 241, 0.18), transparent 35%)";

    return (
        <div className="relative h-screen bg-[var(--ide-bg)] text-[var(--ide-text)] flex flex-col overflow-hidden selection:bg-indigo-500/30">
            <div className="pointer-events-none absolute inset-0" style={{ background: ambientBackground }} />

            {/* Draggable Title Bar Area */}
            <div
                className="h-10 w-full flex-shrink-0 flex items-center justify-end px-4 z-[100] select-none"
                data-tauri-drag-region
            >
                <WindowControls />
            </div>

            <div className="relative z-10 flex-1 overflow-y-auto p-6 md:p-10 lg:p-12 pt-2 md:pt-4">
                <div className="max-w-[1600px] mx-auto space-y-8">
                    {/* Top Header */}
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 animate-fade-in group">
                        <div className="space-y-2">
                            <h1 className="text-4xl md:text-5xl font-black tracking-tighter uppercase italic flex items-center gap-3">
                                Projects <span className="text-indigo-500">.</span>
                            </h1>
                            <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--ide-text-muted)]">
                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                                <span>Workspace</span>
                                <span className="text-[var(--ide-border-strong)]">/</span>
                                <span className="text-[var(--ide-text-secondary)] truncate max-w-[200px] sm:max-w-xs md:max-w-md">
                                    {workspacePath || "Not configured"}
                                </span>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setShowSettingsModal(true)}
                                    className="h-11 w-11 flex items-center justify-center rounded-xl text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] transition-all border border-[var(--ide-border)] hover:border-[var(--ide-border-strong)] hover:bg-[var(--ide-bg-elevated)]"
                                    title="IDE Settings"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                        <circle cx="12" cy="12" r="3" strokeWidth="2" />
                                    </svg>
                                </button>

                                <div className="relative flex-1 sm:flex-initial group/search">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                        <svg className="w-4 h-4 text-[var(--ide-text-muted)] group-focus-within/search:text-[var(--ide-text-secondary)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Search..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] rounded-2xl pl-11 pr-4 h-11 text-sm text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/40 transition-all w-full sm:w-48 md:w-64"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={() => setIsCreateModalOpen(true)}
                                className="btn-modern-primary !h-11 !px-8 whitespace-nowrap shadow-lg shadow-indigo-500/10"
                            >
                                New Project
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-[var(--ide-text-muted)] font-semibold">
                        <span>{filteredProjects.length} project{filteredProjects.length === 1 ? "" : "s"}</span>
                    </div>

                    {/* Project Grid */}
                    {filteredProjects.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-fade-in pb-12">
                            {filteredProjects.map((project, idx) => (
                                <ProjectCard
                                    key={project.id}
                                    project={project}
                                    index={idx}
                                    onOpen={() => openProject(project.id)}
                                    onDelete={() => setConfirmDeleteId(project.id)}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="flex-1 min-h-[360px] flex flex-col items-center justify-center p-14 bg-[var(--ide-bg-elevated)] border-2 border-dashed border-[var(--ide-border)] rounded-3xl animate-fade-in transition-all">
                            <div className="w-20 h-20 rounded-3xl bg-[var(--ide-bg-panel)] border border-[var(--ide-border)] flex items-center justify-center mb-6 shadow-[var(--ide-shadow)]">
                                <svg className="w-9 h-9 text-[var(--ide-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                </svg>
                            </div>
                            <h3 className="text-2xl font-black mb-3">Welcome to Akasha</h3>
                            <p className="text-[var(--ide-text-secondary)] text-sm text-center max-w-sm mb-8 leading-relaxed font-medium">
                                {searchQuery
                                    ? "No projects match your search criteria."
                                    : "Create your first project to start building with visual full-stack tools."}
                            </p>
                            <button
                                onClick={() => setIsCreateModalOpen(true)}
                                className="btn-modern-primary !h-12 !px-12"
                            >
                                Create Project
                            </button>
                        </div>
                    )}
                </div>

                {/* Modals */}
                <IDESettingsModal
                    isOpen={showSettingsModal}
                    onClose={() => setShowSettingsModal(false)}
                />

                {/* Delete Confirmation */}
                {confirmDeleteId && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/55 backdrop-blur-md animate-fade-in" onClick={() => setConfirmDeleteId(null)} />
                        <div className="relative w-full max-w-sm bg-[var(--ide-bg-panel)] border border-[var(--ide-border-strong)] rounded-3xl shadow-[var(--ide-shadow)] p-8 animate-slide-up">
                            <h3 className="text-lg font-black text-[var(--ide-text)] mb-2">Delete Project?</h3>
                            <p className="text-sm text-[var(--ide-text-secondary)] mb-6">
                                This action cannot be undone. The project and all its data will be permanently removed.
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
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/55 backdrop-blur-xl animate-fade-in" onClick={() => setIsCreateModalOpen(false)} />
                        <div className="relative w-full max-w-lg bg-[var(--ide-bg-panel)] border border-[var(--ide-border-strong)] rounded-[2rem] shadow-[var(--ide-shadow)] overflow-hidden animate-slide-up">
                            <div className="p-8 md:p-10">
                                <div className="flex items-center gap-4 mb-8">
                                    <div className="w-12 h-12 rounded-2xl bg-[var(--ide-text)] text-[var(--ide-bg)] flex items-center justify-center shadow-xl">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-black leading-tight text-[var(--ide-text)]">New Project</h2>
                                        <p className="text-[10px] text-[var(--ide-text-muted)] font-black uppercase tracking-widest mt-1">Full-Stack Scaffolding</p>
                                    </div>
                                </div>

                                <form onSubmit={handleCreate} className="space-y-8">
                                    <div className="space-y-3">
                                        <label className="text-xs font-black text-[var(--ide-text-secondary)] uppercase tracking-widest ml-1">
                                            Project Identity
                                        </label>
                                        <input
                                            type="text"
                                            autoFocus
                                            value={projectName}
                                            onChange={(e) => setProjectName(e.target.value)}
                                            placeholder="e.g. Neo-Commerce"
                                            className="w-full bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] rounded-2xl px-6 py-4 text-[var(--ide-text)] font-bold text-lg focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/40 transition-all placeholder:text-[var(--ide-text-muted)]"
                                            required
                                        />
                                    </div>

                                    <div className="flex gap-4 pt-4">
                                        <button
                                            type="button"
                                            onClick={() => setIsCreateModalOpen(false)}
                                            className="flex-1 py-4 rounded-2xl border border-[var(--ide-border)] text-[var(--ide-text-secondary)] font-black text-[11px] uppercase tracking-widest hover:bg-[var(--ide-bg-elevated)] hover:text-[var(--ide-text)] transition-all"
                                        >
                                            Dismiss
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={loading || !projectName.trim()}
                                            className="flex-1 py-4 rounded-2xl bg-[var(--ide-text)] text-[var(--ide-bg)] font-black text-[11px] uppercase tracking-widest hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-30"
                                        >
                                            {loading ? "Scaffolding..." : "Initialize"}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// Project Card Sub-component
const ProjectCard: React.FC<{
    project: ProjectSummary;
    index: number;
    onOpen: () => void;
    onDelete: () => void;
}> = ({ project, index, onOpen, onDelete }) => {
    const cardBackground = "linear-gradient(165deg, var(--ide-bg-elevated) 0%, var(--ide-bg-panel) 100%)";

    return (
        <div
            className="group border border-[var(--ide-border)] rounded-3xl p-7 hover:border-[var(--ide-border-strong)] hover:shadow-[var(--ide-shadow-sm)] transition-all duration-300 flex flex-col h-64 relative overflow-hidden cursor-pointer"
            style={{ animationDelay: `${index * 40}ms`, background: cardBackground }}
            onClick={onOpen}
        >
            <div className="absolute -top-14 -right-14 w-44 h-44 bg-indigo-500/10 blur-[80px] rounded-full group-hover:bg-indigo-500/20 transition-all duration-500" />

            <div className="relative z-10 flex-1">
                <div className="w-14 h-14 rounded-2xl bg-[var(--ide-bg-panel)] border border-[var(--ide-border)] flex items-center justify-center mb-5 group-hover:scale-105 transition-transform duration-300">
                    <svg className="w-7 h-7 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                </div>
                <h3 className="text-2xl font-black text-[var(--ide-text)] mb-2 leading-tight tracking-tight">{project.name}</h3>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[var(--ide-text-muted)] font-black uppercase tracking-widest bg-[var(--ide-bg-panel)] px-2 py-1 rounded-md border border-[var(--ide-border)]">
                        {new Date(project.updated_at).toLocaleDateString()}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-[var(--ide-border-strong)]" />
                    <span className="text-[10px] text-[var(--ide-text-muted)] font-black uppercase tracking-widest">
                        IDE v0.1.0
                    </span>
                </div>
            </div>

            <div className="relative z-10 flex items-center gap-3 mt-4 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
                <div className="flex-1 text-[11px] font-black text-indigo-500 uppercase tracking-widest">Open Project</div>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete();
                    }}
                    className="p-2.5 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl transition-all"
                    title="Delete Project"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </button>
            </div>
        </div>
    );
};

export default DashboardView;
