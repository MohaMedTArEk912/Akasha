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
                    className="relative bg-white/90 dark:bg-black/85 backdrop-blur-2xl border border-black/10 dark:border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col"
                    style={{ animation: "scaleUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)" }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="relative px-6 py-5 flex items-center justify-between border-b border-black/[0.08] dark:border-white/[0.08]">
                        <div className="flex items-center gap-3">
                            <span className="px-2 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 font-mono text-[9px] font-bold text-indigo-600 dark:text-indigo-400 uppercase">
                                CONFIG
                            </span>
                            <div>
                                <h3 className="text-lg font-bold text-neutral-950 dark:text-white">Project Settings</h3>
                                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-mono">Configure your project</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="font-mono text-sm px-2.5 py-1 rounded-lg text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                            title="Close"
                        >
                            ✕
                        </button>
                    </div>

                    {/* Body */}
                    <div className="p-6 space-y-6 overflow-y-auto max-h-[65vh] custom-scrollbar">
                        {/* Project Name */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 font-mono uppercase tracking-[0.2em]">
                                Project Name
                            </label>
                            <input
                                type="text"
                                value={projectName}
                                onChange={(e) => setProjectName(e.target.value)}
                                placeholder="Enter project name..."
                                className="w-full bg-neutral-100/80 dark:bg-white/[0.04] border border-black/10 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-neutral-950 dark:text-white font-mono focus:outline-none focus:border-indigo-500 transition-all placeholder:text-neutral-400 dark:placeholder:text-white/20"
                            />
                        </div>

                        {/* Danger Zone */}
                        <div className="space-y-3 pt-4 border-t border-black/[0.08] dark:border-white/[0.08]">
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-[0.2em]">
                                    Danger Zone
                                </span>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setConfirmModal({ isOpen: true, type: "reset" })}
                                    disabled={isDestructiveAction}
                                    className="flex-1 flex items-center justify-center p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 transition-all text-amber-600 dark:text-amber-400 text-xs font-bold font-mono uppercase disabled:opacity-50"
                                >
                                    RESET PROJECT
                                </button>

                                <button
                                    onClick={() => setConfirmModal({ isOpen: true, type: "delete" })}
                                    disabled={isDestructiveAction}
                                    className="flex-1 flex items-center justify-center p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 transition-all text-rose-600 dark:text-rose-400 text-xs font-bold font-mono uppercase disabled:opacity-50"
                                >
                                    DELETE PROJECT
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 bg-neutral-100/60 dark:bg-black/40 border-t border-black/[0.08] dark:border-white/[0.08] flex items-center justify-end gap-3 rounded-b-2xl">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 font-mono text-xs font-bold text-neutral-600 dark:text-white/60 hover:text-neutral-950 dark:hover:text-white transition-all uppercase"
                            disabled={isSaving || isDestructiveAction}
                        >
                            CANCEL
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs font-bold transition-all disabled:opacity-50 shadow-md uppercase"
                            disabled={isSaving || isDestructiveAction}
                        >
                            {isSaving ? "SAVING..." : "SAVE CHANGES"}
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
                message="This will permanently delete ALL content (pages, blocks, logic) in this project and reset it to a clean slate. This cannot be undone."
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
