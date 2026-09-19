import React, { useState, useEffect } from "react";
import { useProjectStore } from "../hooks/useProjectStore";
import { useSettings } from "../context/SettingsContext";
import { useTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";
import { renameProject, resetProject, deleteProject, closeProject } from "../stores/projectStore";
import ConfirmModal from "../components/Modals/ConfirmModal";

interface SettingsPageProps {
    onBack?: () => void;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ onBack }) => {
    const { theme, toggleTheme } = useTheme();
    const { project } = useProjectStore();
    const { apiKey } = useSettings();
    const toast = useToast();

    // Local states for Project Administration
    const [projectName, setProjectName] = useState(project?.name || "");
    const [isSavingProject, setIsSavingProject] = useState(false);
    const [isDestructiveAction, setIsDestructiveAction] = useState(false);
    const [deleteFromDisk, setDeleteFromDisk] = useState(false);
    const [clearDiskOnReset, setClearDiskOnReset] = useState(true);
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        type: "reset" | "delete" | null;
    }>({ isOpen: false, type: null });

    // Sync state on load
    useEffect(() => {
        if (project) {
            setProjectName(project.name);
        }
    }, [project]);

    const handleSaveProjectName = async () => {
        if (!projectName.trim()) {
            toast.showToast("Project name cannot be empty", "error");
            return;
        }

        setIsSavingProject(true);
        try {
            if (projectName !== project?.name) {
                await renameProject(projectName.trim());
                toast.showToast("Project renamed successfully", "success");
            } else {
                toast.showToast("No changes to save", "info");
            }
        } catch (err) {
            toast.showToast(`Failed to save: ${err}`, "error");
        } finally {
            setIsSavingProject(false);
        }
    };

    const handleResetConfirm = async () => {
        setIsDestructiveAction(true);
        try {
            await resetProject(clearDiskOnReset);
            toast.showToast("Project reset to initial state", "success");
            setConfirmModal({ isOpen: false, type: null });
            setClearDiskOnReset(true);
        } catch (err) {
            toast.showToast(`Failed to reset project: ${err}`, "error");
        } finally {
            setIsDestructiveAction(false);
        }
    };

    const handleDeleteConfirm = async () => {
        if (!project) return;
        setIsDestructiveAction(true);
        try {
            await deleteProject(project.id, deleteFromDisk);
            toast.showToast(deleteFromDisk
                ? "Project and files deleted successfully"
                : "Project deleted from database (files kept on disk)", "success");
            closeProject();
            setConfirmModal({ isOpen: false, type: null });
            setDeleteFromDisk(false);
        } catch (err) {
            toast.showToast(`Failed to delete project: ${err}`, "error");
        } finally {
            setIsDestructiveAction(false);
        }
    };

    return (
        <div className="ide-page h-full w-full overflow-auto relative page-enter p-8 select-none bg-[var(--ide-bg)] text-[var(--ide-text)]">
            {/* Visual Background Glow */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute w-[500px] h-[500px] rounded-full opacity-[0.03] blur-[120px] bg-indigo-500 top-[-10%] right-[10%]" />
                <div className="absolute w-[400px] h-[400px] rounded-full opacity-[0.02] blur-[100px] bg-cyan-500 bottom-[10%] left-[5%]" />
            </div>

            <div className="relative z-10 max-w-5xl mx-auto space-y-8">
                
                {/* Header Title Section */}
                <div className="flex justify-between items-end border-b border-[var(--ide-border)] pb-6">
                    <div className="flex items-center gap-4">
                        {onBack && (
                            <button
                                onClick={onBack}
                                className="btn-ghost h-10 px-4 text-xs gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                                Back
                            </button>
                        )}
                        <div>
                            <h1 className="text-2xl font-black text-[var(--ide-text)] tracking-tight uppercase">Settings</h1>
                            <p className="text-xs text-[var(--ide-text-muted)] mt-1">Configure workspace integrations, system theme, and project data.</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start animate-fade-in">
                    
                    {/* Left Column: top cards aligned, note below */}
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="ide-settings-card p-5 flex flex-col justify-between min-h-[168px]">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-[var(--ide-accent-subtle)] border border-[var(--ide-border)] flex items-center justify-center shrink-0">
                                        {theme === "dark" ? (
                                            <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                                            </svg>
                                        ) : (
                                            <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                                            </svg>
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="text-xs font-bold text-[var(--ide-text)] uppercase tracking-widest">Interface Theme</h3>
                                        <p className="text-[10px] text-[var(--ide-text-muted)] italic mt-0.5">
                                            Currently: {theme === "dark" ? "Dark" : "Light"} — synced across Community & IDE
                                        </p>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center bg-[var(--ide-accent-subtle)] p-2.5 rounded-xl border border-[var(--ide-border)]">
                                    <span className="text-[10px] font-bold text-[var(--ide-text-secondary)] tracking-wider">DARK MODE</span>
                                    <button
                                        onClick={toggleTheme}
                                        className={`relative w-11 h-6 rounded-full transition-all duration-300 p-0.5 flex items-center ${
                                            theme === "dark" ? "bg-[var(--ide-primary)]" : "bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)]"
                                        }`}
                                        aria-label="Toggle theme"
                                    >
                                        <span
                                            className={`block w-5 h-5 rounded-full bg-white transition-transform duration-300 shadow-md ${
                                                theme === "dark" ? "translate-x-5" : "translate-x-0"
                                            }`}
                                        />
                                    </button>
                                </div>
                            </div>

                            <div className="ide-settings-card p-5 space-y-4 min-h-[168px]">
                                <h3 className="text-xs font-bold text-[var(--ide-text-muted)] uppercase tracking-widest">SYSTEM STATUS</h3>
                                <div className="space-y-3.5">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-[var(--ide-text-muted)] text-[10px]">Backend Server</span>
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                            <span className="font-semibold text-[var(--ide-text)] text-[10px]">Online</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-[var(--ide-text-muted)] text-[10px]">Active Project</span>
                                        <span className="font-bold text-[10px] text-[var(--ide-text-secondary)] tracking-wide uppercase truncate max-w-[170px]">
                                            {project?.name || "None"}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-[var(--ide-text-muted)] text-[10px]">AI Integration</span>
                                        <span className={`text-[10px] font-semibold ${apiKey ? "text-cyan-400" : "text-amber-500"}`}>
                                            {apiKey ? "Provisioned (via Profile)" : "API Key Needed"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="ide-settings-card border-[var(--ide-primary)]/20 p-5 space-y-3 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-[var(--ide-primary)]/5 rounded-full blur-xl pointer-events-none" />
                            <h3 className="text-xs font-bold text-[var(--ide-primary)] uppercase tracking-widest flex items-center gap-2">
                                🤖 AI Configuration
                            </h3>
                            <p className="text-[11px] text-[var(--ide-text-secondary)] leading-relaxed">
                                To centralize account security, API keys and model configurations are managed exclusively within the <strong>Profile Page</strong>.
                            </p>
                            <div className="text-[10px] text-[var(--ide-text-muted)]">
                                Navigate to: <strong>User Dashboard &rarr; Profile</strong> to configure OpenRouter, OpenAI, or Gemini credentials.
                            </div>
                        </div>

                    </div>

                    {/* Right Column: Project Preferences & Danger Zone */}
                    <div className="space-y-6">
                        
                        {/* Project Preferences */}
                        {project && (
                            <div className="ide-settings-card p-6 space-y-6">
                                <div>
                                    <h2 className="text-sm font-black text-[var(--ide-text)] tracking-widest uppercase mb-1">Project Preferences</h2>
                                    <p className="text-[10px] text-[var(--ide-text-muted)]">Rename the project schema representation.</p>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-[var(--ide-text-secondary)] uppercase tracking-widest">Project Name</label>
                                    <input
                                        type="text"
                                        value={projectName}
                                        onChange={(e) => setProjectName(e.target.value)}
                                        placeholder="Enter project name..."
                                        className="input-modern w-full text-xs font-semibold"
                                    />
                                </div>

                                <div className="pt-4 flex justify-end border-t border-[var(--ide-border)]">
                                    <button
                                        onClick={handleSaveProjectName}
                                        disabled={isSavingProject}
                                        className="btn-primary px-6 py-2.5 text-[11px] disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {isSavingProject ? "Saving..." : "Save Project Settings"}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Danger Zone Section */}
                        {project && (
                            <div className="bg-red-500/[0.02] border border-red-500/10 rounded-2xl p-6 space-y-6">
                                <div className="flex items-center gap-2">
                                    <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    <div>
                                        <h2 className="text-sm font-black text-[var(--ide-text)] tracking-widest uppercase mb-1">Danger Zone</h2>
                                        <p className="text-[10px] text-red-500/50">These actions are destructive and cannot be undone.</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-red-500/10 items-start">
                                    
                                    {/* Reset card */}
                                    <div className="border border-[var(--ide-border)] rounded-xl p-4 flex flex-col justify-between gap-4 bg-[var(--ide-accent-subtle)] min-h-[150px]">
                                        <div>
                                            <h4 className="text-[11px] font-bold text-[var(--ide-text)]">Reset Project Content</h4>
                                            <p className="text-[9px] text-[var(--ide-text-muted)] mt-1 leading-relaxed">
                                                Resets all database entries (pages, blocks, logic flows) back to the original starter template.
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => setConfirmModal({ isOpen: true, type: "reset" })}
                                            disabled={isDestructiveAction}
                                            className="w-full py-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 transition-colors text-amber-500 text-[10px] font-bold uppercase tracking-wider disabled:opacity-50"
                                        >
                                            Reset Project
                                        </button>
                                    </div>

                                    {/* Delete card */}
                                    <div className="border border-[var(--ide-border)] rounded-xl p-4 flex flex-col justify-between gap-4 bg-[var(--ide-accent-subtle)] min-h-[150px]">
                                        <div>
                                            <h4 className="text-[11px] font-bold text-[var(--ide-text)]">Delete Project</h4>
                                            <p className="text-[9px] text-[var(--ide-text-muted)] mt-1 leading-relaxed">
                                                Removes this project registration. You can choose to optionally delete files on disk or keep them.
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => setConfirmModal({ isOpen: true, type: "delete" })}
                                            disabled={isDestructiveAction}
                                            className="w-full py-2.5 rounded-lg border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 transition-colors text-red-500 text-[10px] font-bold uppercase tracking-wider disabled:opacity-50"
                                        >
                                            Delete Project
                                        </button>
                                    </div>

                                </div>
                            </div>
                        )}

                    </div>

                </div>

            </div>

            {/* Confirmation Dialogs */}
            <ConfirmModal
                isOpen={confirmModal.isOpen && confirmModal.type === "reset"}
                title="Reset Project Content"
                message="This will permanently delete ALL content (pages, blocks, logic) in this project. The project folder will be reset to a fresh starter template. This cannot be undone."
                confirmText="Reset Everything"
                variant="warning"
                onConfirm={handleResetConfirm}
                onCancel={() => setConfirmModal({ isOpen: false, type: null })}
                isLoading={isDestructiveAction}
            />

            <ConfirmModal
                isOpen={confirmModal.isOpen && confirmModal.type === "delete"}
                title={`Delete "${project?.name}"?`}
                message="This will permanently remove the project from the database and close the editor."
                confirmText="Delete Project"
                variant="danger"
                onConfirm={handleDeleteConfirm}
                onCancel={() => {
                    setConfirmModal({ isOpen: false, type: null });
                    setDeleteFromDisk(false);
                }}
                isLoading={isDestructiveAction}
                checkboxConfig={{
                    label: "Also delete project folder from disk",
                    checked: deleteFromDisk,
                    onChange: setDeleteFromDisk,
                }}
            />
        </div>
    );
};

export default SettingsPage;
