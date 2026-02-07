/**
 * DashboardView Component
 * 
 * Main landing screen to see all projects, search, create, and delete.
 */

import React, { useState } from "react";
import { useProjectStore } from "../../hooks/useProjectStore";
import { openProject, deleteProject, createProject } from "../../stores/projectStore";
import { useToast } from "../../context/ToastContext";
import IDESettingsModal from "../Modals/IDESettingsModal";

interface ProjectSummary {
    id: string;
    name: string;
    updated_at: string;
}

const DashboardView: React.FC = () => {
    const { projects, workspacePath, loading } = useProjectStore();
    const toast = useToast();
    const [searchQuery, setSearchQuery] = useState("");
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [projectName, setProjectName] = useState("");
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    const filteredProjects = projects.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
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
            await deleteProject(id);
            setConfirmDeleteId(null);
        } catch (err) {
            toast.showToast(`Failed to delete project: ${err}`, "error");
        }
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] flex flex-col p-8 md:p-12 overflow-y-auto selection:bg-indigo-500/30">
            {/* Top Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12 animate-fade-in">
                <div className="space-y-2">
                    <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic">
                        Projects <span className="text-indigo-500">.</span>
                    </h1>
                    <div className="flex items-center gap-3 text-white/40 text-[10px] font-black uppercase tracking-[0.2em]">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                        <span>Workspace</span>
                        <span className="text-white/10">/</span>
                        <span className="text-white/60 truncate max-w-xs">{workspacePath}</span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Settings Button */}
                    <button
                        onClick={() => setShowSettingsModal(true)}
                        className="p-2.5 hover:bg-white/5 rounded-xl text-white/40 hover:text-white transition-all border border-transparent hover:border-white/5"
                        title="IDE Settings"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <circle cx="12" cy="12" r="3" strokeWidth="2" />
                        </svg>
                    </button>

                    <div className="w-px h-6 bg-white/5" />

                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                            <svg className="w-4 h-4 text-white/20 transition-colors group-focus-within:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <input
                            type="text"
                            placeholder="Search projects..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-white/5 border border-white/5 rounded-2xl pl-11 pr-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/5 transition-all w-full md:w-64"
                        />
                    </div>
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="btn-modern-primary !h-11 !px-8"
                    >
                        New Project
                    </button>
                </div>
            </div>

            {/* Project Grid */}
            {filteredProjects.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 animate-fade-in delay-100 pb-12">
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
                <div className="flex-1 flex flex-col items-center justify-center p-20 bg-white/[0.02] border-2 border-dashed border-white/5 rounded-[3rem] animate-fade-in delay-100 group cursor-pointer hover:bg-white/[0.04] transition-all duration-500">
                    <div className="w-24 h-24 rounded-3xl bg-white/5 border border-white/5 flex items-center justify-center mb-8 shadow-2xl group-hover:scale-110 transition-transform duration-500">
                        <svg className="w-10 h-10 text-white/20 group-hover:text-indigo-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                    </div>
                    <h3 className="text-2xl font-black text-white mb-3">Welcome to Grapes IDE</h3>
                    <p className="text-white/40 text-sm text-center max-w-xs mb-10 leading-relaxed font-medium">
                        {searchQuery ? "No projects match your search criteria." : "Experience the future of visual full-stack development. Create your first project to begin."}
                    </p>
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="btn-modern-primary !h-12 !px-12"
                    >
                        Create Project
                    </button>
                </div>
            )}

            {/* Modals */}
            <IDESettingsModal
                isOpen={showSettingsModal}
                onClose={() => setShowSettingsModal(false)}
            />

            {/* Delete Confirmation */}
            {confirmDeleteId && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-xl animate-fade-in" onClick={() => setConfirmDeleteId(null)} />
                    <div className="relative w-full max-w-sm bg-[#0e0e10] border border-white/10 rounded-3xl shadow-2xl p-8 animate-slide-up">
                        <h3 className="text-lg font-black text-white mb-2">Delete Project?</h3>
                        <p className="text-sm text-white/50 mb-6">
                            This action cannot be undone. The project and all its data will be permanently removed.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="flex-1 py-3 rounded-xl border border-white/10 text-white/60 font-bold text-xs uppercase tracking-wider hover:bg-white/5 transition-all"
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
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-2xl animate-fade-in" onClick={() => setIsCreateModalOpen(false)} />
                    <div className="relative w-full max-w-lg bg-[#0e0e10] border border-white/10 rounded-[2.5rem] shadow-[0_32px_128px_-12px_rgba(0,0,0,0.8)] overflow-hidden animate-slide-up">
                        <div className="p-10">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-12 h-12 rounded-2xl bg-white text-black flex items-center justify-center shadow-xl">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                                    </svg>
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-white leading-tight">New Project</h2>
                                    <p className="text-[10px] text-white/40 font-black uppercase tracking-widest mt-1">Full-Stack Scaffolding</p>
                                </div>
                            </div>

                            <form onSubmit={handleCreate} className="space-y-8">
                                <div className="space-y-3">
                                    <label className="text-xs font-black text-white/50 uppercase tracking-widest ml-1">
                                        Project Identity
                                    </label>
                                    <input
                                        type="text"
                                        autoFocus
                                        value={projectName}
                                        onChange={(e) => setProjectName(e.target.value)}
                                        placeholder="e.g. Neo-Commerce"
                                        className="w-full bg-white/5 border border-white/5 rounded-2xl px-6 py-4 text-white font-bold text-lg focus:outline-none focus:ring-4 focus:ring-white/5 focus:border-white/10 transition-all placeholder:text-white/10"
                                        required
                                    />
                                </div>

                                <div className="flex gap-4 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setIsCreateModalOpen(false)}
                                        className="flex-1 py-4 rounded-2xl border border-white/5 text-white/60 font-black text-[11px] uppercase tracking-widest hover:bg-white/5 hover:text-white transition-all"
                                    >
                                        Dismiss
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading || !projectName.trim()}
                                        className="flex-1 py-4 rounded-2xl bg-white text-black font-black text-[11px] uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-20 shadow-xl shadow-white/5"
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
    );
};

// Project Card Sub-component
const ProjectCard: React.FC<{
    project: ProjectSummary;
    index: number;
    onOpen: () => void;
    onDelete: () => void;
}> = ({ project, index, onOpen, onDelete }) => {
    return (
        <div
            className="group bg-white/5 border border-white/5 rounded-[2rem] p-8 hover:bg-white/[0.07] hover:border-white/10 transition-all duration-500 flex flex-col h-72 relative overflow-hidden cursor-pointer"
            style={{ animationDelay: `${index * 50}ms` }}
            onClick={onOpen}
        >
            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 blur-[80px] rounded-full -mr-24 -mt-24 group-hover:bg-indigo-500/20 transition-all duration-700" />

            <div className="relative z-10 flex-1">
                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shadow-2xl">
                    <svg className="w-7 h-7 text-indigo-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                </div>
                <h3 className="text-2xl font-black text-white mb-2 leading-tight tracking-tight group-hover:translate-x-1 transition-transform">{project.name}</h3>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-white/30 font-black uppercase tracking-widest bg-white/5 px-2 py-1 rounded-md">
                        {new Date(project.updated_at).toLocaleDateString()}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-white/10" />
                    <span className="text-[10px] text-white/30 font-black uppercase tracking-widest">
                        IDE v0.1.0
                    </span>
                </div>
            </div>

            <div className="relative z-10 flex items-center gap-3 mt-4 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500">
                <div className="flex-1 text-[11px] font-black text-indigo-400 uppercase tracking-widest">Open Project</div>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete();
                    }}
                    className="p-3 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl transition-all shadow-lg"
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
