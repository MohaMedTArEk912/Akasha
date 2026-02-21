import React, { useState, useEffect } from "react";
import { useProjectStore } from "../../hooks/useProjectStore";
import { renameProject, resetProject, deleteProject, closeProject, setExportModalOpen } from "../../stores/projectStore";
import { useToast } from "../../context/ToastContext";
import ConfirmModal from "./ConfirmModal";

interface ProjectSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

/**
 * Project Settings Modal
 * 
 * Minimal interface for:
 * - Renaming project
 * - Destructive actions (reset, delete)
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
                toast.success("Project name updated");
            } else {
                toast.info("No changes to save");
            }
            onClose();
        } catch (err) {
            toast.error(`Failed to save: ${err}`);
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
                    className="relative bg-[var(--ide-bg-panel)] border border-[var(--ide-border-strong)] rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col"
                    style={{ animation: "scaleUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)" }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="px-6 py-5 flex items-center justify-between border-b border-[var(--ide-border)]">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                                <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <circle cx="12" cy="12" r="3" strokeWidth="2" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-[var(--ide-text)]">Project Settings</h3>
                                <p className="text-xs text-[var(--ide-text-muted)]">Configure your project</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-9 h-9 flex items-center justify-center hover:bg-[var(--ide-bg-sidebar)] rounded-lg text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-all"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Body */}
                    <div className="p-6 space-y-6 overflow-y-auto max-h-[65vh] custom-scrollbar">
                        {/* Project Name */}
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-[var(--ide-text-muted)] uppercase tracking-wide">
                                Project Name
                            </label>
                            <input
                                type="text"
                                value={projectName}
                                onChange={(e) => setProjectName(e.target.value)}
                                placeholder="Enter project name..."
                                className="w-full bg-[var(--ide-bg-sidebar)] border border-[var(--ide-border)] rounded-lg px-4 py-2.5 text-sm text-[var(--ide-text)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all placeholder:text-[var(--ide-text-muted)]/40"
                            />
                        </div>

                        {/* Export Code */}
                        <div className="space-y-3 pt-2 border-t border-[var(--ide-border)]">
                            <div className="flex items-center gap-2">
                                <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                                </svg>
                                <h4 className="text-xs font-bold text-[var(--ide-text)] uppercase tracking-wide">Developer Tools</h4>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        onClose();
                                        setExportModalOpen(true);
                                    }}
                                    className="flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border border-indigo-500/20 bg-indigo-500/10 hover:bg-indigo-500/20 transition-all text-indigo-400 text-xs font-semibold"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                                    </svg>
                                    Export to React
                                </button>
                            </div>
                        </div>

                        {/* Danger Zone */}
                        <div className="space-y-3 pt-2 border-t border-[var(--ide-border)]">
                            <div className="flex items-center gap-2">
                                <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <h4 className="text-xs font-bold text-[var(--ide-text)] uppercase tracking-wide">Danger Zone</h4>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setConfirmModal({ isOpen: true, type: "reset" })}
                                    disabled={isDestructiveAction}
                                    className="flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 transition-all text-amber-500 text-xs font-semibold"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    Reset
                                </button>

                                <button
                                    onClick={() => setConfirmModal({ isOpen: true, type: "delete" })}
                                    disabled={isDestructiveAction}
                                    className="flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 transition-all text-red-500 text-xs font-semibold"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 bg-[var(--ide-bg-sidebar)]/30 border-t border-[var(--ide-border)] flex items-center justify-end gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-xs font-semibold text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] transition-all"
                            disabled={isSaving || isDestructiveAction}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all disabled:opacity-50 flex items-center gap-2"
                            disabled={isSaving || isDestructiveAction}
                        >
                            {isSaving ? (
                                <>
                                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Saving...
                                </>
                            ) : (
                                "Save Changes"
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
