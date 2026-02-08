import React, { useState, useEffect } from "react";
import { useProjectStore } from "../../hooks/useProjectStore";
import { renameProject, resetProject, deleteProject, closeProject } from "../../stores/projectStore";
import { useToast } from "../../context/ToastContext";
import ConfirmModal from "./ConfirmModal";

interface ProjectSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

/**
 * Premium Project Settings Modal
 * 
 * Features:
 * - High-fidelity visual design matching the IDE's premium aesthetic.
 * - Interactive cards for destructive actions.
 * - Clear visual hierarchy and typography.
 * - Detailed status indicators and feedback.
 */
const ProjectSettingsModal: React.FC<ProjectSettingsModalProps> = ({ isOpen, onClose }) => {
    const { project } = useProjectStore();
    const [projectName, setProjectName] = useState(project?.name || "");
    const [isSaving, setIsSaving] = useState(false);
    const [isDestructiveAction, setIsDestructiveAction] = useState(false);
    const [deleteFromDisk, setDeleteFromDisk] = useState(false);
    const [clearDiskOnReset, setClearDiskOnReset] = useState(true);
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        type: "reset" | "delete" | null;
    }>({ isOpen: false, type: null });
    const toast = useToast();

    useEffect(() => {
        if (project) {
            setProjectName(project.name);
        }
    }, [project]);

    if (!isOpen) return null;

    const handleSave = async () => {
        if (!projectName.trim()) {
            toast.error("Project name cannot be empty");
            return;
        }

        setIsSaving(true);
        try {
            if (projectName !== project?.name) {
                await renameProject(projectName.trim());
            }
            toast.success("Settings saved successfully");
            onClose();
        } catch (err) {
            toast.error(`Failed to save settings: ${err}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleResetConfirm = async () => {
        setIsDestructiveAction(true);
        try {
            await resetProject(clearDiskOnReset);
            toast.success("Project reset to initial state");
            setConfirmModal({ isOpen: false, type: null });
            setClearDiskOnReset(true);
            onClose();
        } catch (err) {
            toast.error(`Failed to reset project: ${err}`);
        } finally {
            setIsDestructiveAction(false);
        }
    };

    const handleDeleteConfirm = async () => {
        if (!project) return;
        setIsDestructiveAction(true);
        try {
            await deleteProject(project.id, deleteFromDisk);
            toast.success(deleteFromDisk
                ? "Project and files deleted successfully"
                : "Project deleted from database (files kept on disk)");
            closeProject();
            setConfirmModal({ isOpen: false, type: null });
            setDeleteFromDisk(false);
            onClose();
        } catch (err) {
            toast.error(`Failed to delete project: ${err}`);
        } finally {
            setIsDestructiveAction(false);
        }
    };

    return (
        <>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                {/* Backdrop */}
                <div
                    className="absolute inset-0 bg-black/65 backdrop-blur-md"
                    onClick={onClose}
                    style={{ animation: "fadeIn 0.3s ease-out" }}
                />

                {/* Modal Container */}
                <div
                    className="relative bg-[var(--ide-bg-panel)] border border-[var(--ide-border-strong)] rounded-[2.5rem] w-full max-w-xl shadow-[0_32px_128px_-16px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col"
                    style={{ animation: "scaleUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)" }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="px-10 py-8 flex items-center justify-between border-b border-[var(--ide-border)] bg-gradient-to-b from-[var(--ide-bg-elevated)] to-[var(--ide-bg-panel)]">
                        <div className="flex items-center gap-5">
                            <div className="w-12 h-12 rounded-[1.25rem] bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shadow-inner">
                                <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <circle cx="12" cy="12" r="3" strokeWidth="2" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-[var(--ide-text)] tracking-tight">Project Settings</h3>
                                <p className="text-xs text-[var(--ide-text-muted)] font-medium uppercase tracking-[0.2em] opacity-60 mt-0.5">Configuration & Control</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-12 h-12 flex items-center justify-center hover:bg-[var(--ide-bg-sidebar)] rounded-full text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-all active:scale-95"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Body */}
                    <div className="p-10 space-y-12 overflow-y-auto max-h-[60vh] custom-scrollbar">
                        {/* Section: General Info */}
                        <div className="space-y-8">
                            <div className="space-y-3">
                                <label className="text-[11px] font-bold text-[var(--ide-text-muted)] uppercase tracking-[0.3em] ml-1 opacity-80">
                                    Project Identity
                                </label>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-[var(--ide-text-muted)] uppercase tracking-wider ml-1">Name</label>
                                    <input
                                        type="text"
                                        value={projectName}
                                        onChange={(e) => setProjectName(e.target.value)}
                                        placeholder="Enter project name..."
                                        className="w-full bg-[var(--ide-bg-sidebar)] border border-[var(--ide-border)] rounded-2xl px-6 py-4 text-sm text-[var(--ide-text)] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)] placeholder:text-[var(--ide-text-muted)]/40"
                                    />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-[10px] font-bold text-[var(--ide-text-muted)] uppercase tracking-wider ml-1">Workspace Path</label>
                                <div className="relative group">
                                    <div className="w-full bg-[var(--ide-bg-sidebar)]/50 border border-[var(--ide-border)] rounded-2xl px-6 py-4 text-xs text-[var(--ide-text-secondary)] font-mono flex items-center gap-4 transition-colors group-hover:border-[var(--ide-border-strong)]">
                                        <div className="w-8 h-8 rounded-xl bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] flex items-center justify-center shrink-0">
                                            <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                            </svg>
                                        </div>
                                        <span className="truncate opacity-70 select-all" title={project?.root_path}>{project?.root_path || "Loading path..."}</span>
                                    </div>
                                    <p className="text-[10px] text-[var(--ide-text-muted)] mt-2.5 flex items-center gap-2 ml-1 italic opacity-60 font-medium">
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        The absolute location where your React components are synchronized.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Section: Danger Zone */}
                        <div className="space-y-6 pt-2">
                            <div className="flex items-center gap-4 ml-1">
                                <div className="w-7 h-7 rounded-xl bg-red-500/10 flex items-center justify-center border border-red-500/10">
                                    <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                </div>
                                <h4 className="text-[11px] font-black text-red-500/80 uppercase tracking-[0.3em]">Critical Operations</h4>
                            </div>

                            <div className="grid grid-cols-2 gap-5">
                                <button
                                    onClick={() => setConfirmModal({ isOpen: true, type: "reset" })}
                                    disabled={isDestructiveAction}
                                    className="relative flex flex-col items-center justify-center p-8 rounded-[2rem] border border-amber-500/10 bg-amber-500/[0.02] hover:bg-amber-500/[0.06] hover:border-amber-500/30 transition-all duration-300 group"
                                >
                                    <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-5 group-hover:rotate-12 transition-transform shadow-sm">
                                        <svg className="w-7 h-7 text-amber-500/80 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                    </div>
                                    <span className="text-[11px] font-black text-amber-500/90 uppercase tracking-[0.2em]">Reset Template</span>
                                    <span className="text-[10px] text-[var(--ide-text-muted)] mt-2 font-semibold opacity-60">Full content wipe</span>
                                </button>

                                <button
                                    onClick={() => setConfirmModal({ isOpen: true, type: "delete" })}
                                    disabled={isDestructiveAction}
                                    className="relative flex flex-col items-center justify-center p-8 rounded-[2rem] border border-red-500/10 bg-red-500/[0.02] hover:bg-red-500/[0.06] hover:border-red-500/30 transition-all duration-300 group"
                                >
                                    <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center mb-5 group-hover:-rotate-12 transition-transform shadow-sm">
                                        <svg className="w-7 h-7 text-red-500/80 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </div>
                                    <span className="text-[11px] font-black text-red-500/90 uppercase tracking-[0.2em]">Destroy Project</span>
                                    <span className="text-[10px] text-[var(--ide-text-muted)] mt-2 font-semibold opacity-60">Permanent deletion</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-10 py-7 bg-[var(--ide-bg-sidebar)]/30 border-t border-[var(--ide-border)] flex items-center justify-end gap-6">
                        <button
                            onClick={onClose}
                            className="px-6 py-2 text-xs font-bold text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] transition-all uppercase tracking-widest active:scale-95"
                            disabled={isSaving || isDestructiveAction}
                        >
                            Dismiss
                        </button>
                        <button
                            onClick={handleSave}
                            className="h-12 px-10 rounded-[1.25rem] bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-widest transition-all shadow-[0_8px_24px_-8px_rgba(79,70,229,0.5)] active:scale-95 disabled:opacity-50 disabled:scale-100 flex items-center gap-3"
                            disabled={isSaving || isDestructiveAction}
                        >
                            {isSaving ? (
                                <>
                                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    SYNCING...
                                </>
                            ) : (
                                "Apply Changes"
                            )}
                        </button>
                    </div>
                </div>

                {/* Local Scoped Animations */}
                <style>{`
                    @keyframes fadeIn {
                        from { opacity: 0; }
                        to { opacity: 1; }
                    }
                    @keyframes scaleUp {
                        from { opacity: 0; transform: scale(0.9) translateY(20px); }
                        to { opacity: 1; transform: scale(1) translateY(0); }
                    }
                `}</style>
            </div>

            {/* Confirmation Modals */}
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

        </>
    );
};

export default ProjectSettingsModal;
