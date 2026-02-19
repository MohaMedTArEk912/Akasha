import React, { useState, useEffect } from "react";
import { useProjectStore } from "../../hooks/useProjectStore";
import { renameProject, resetProject, deleteProject, closeProject, updateProjectSettings } from "../../stores/projectStore";
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

    // Build settings
    const [frontendFramework, setFrontendFramework] = useState(project?.settings?.build?.frontend_framework || "react");
    const [backendFramework, setBackendFramework] = useState(project?.settings?.build?.backend_framework || "nest_js");
    const [databaseProvider, setDatabaseProvider] = useState(project?.settings?.build?.database_provider || "postgre_sql");
    const [useTypescript, setUseTypescript] = useState(project?.settings?.build?.typescript !== false);

    // Theme settings
    const [primaryColor, setPrimaryColor] = useState(project?.settings?.theme?.primary_color || "#6366f1");
    const [secondaryColor, setSecondaryColor] = useState(project?.settings?.theme?.secondary_color || "#8b5cf6");
    const [fontFamily, setFontFamily] = useState(project?.settings?.theme?.font_family || "Inter");
    const [borderRadius, setBorderRadius] = useState(project?.settings?.theme?.border_radius ?? 8);

    // SEO settings
    const [titleSuffix, setTitleSuffix] = useState(project?.settings?.seo?.title_suffix || "");
    const [defaultDescription, setDefaultDescription] = useState(project?.settings?.seo?.default_description || "");
    const [favicon, setFavicon] = useState(project?.settings?.seo?.favicon || "");

    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        type: "reset" | "delete" | null;
    }>({ isOpen: false, type: null });
    const toast = useToast();

    useEffect(() => {
        if (project) {
            setProjectName(project.name);
            setFrontendFramework(project.settings?.build?.frontend_framework || "react");
            setBackendFramework(project.settings?.build?.backend_framework || "nest_js");
            setDatabaseProvider(project.settings?.build?.database_provider || "postgre_sql");
            setUseTypescript(project.settings?.build?.typescript !== false);
            setPrimaryColor(project.settings?.theme?.primary_color || "#6366f1");
            setSecondaryColor(project.settings?.theme?.secondary_color || "#8b5cf6");
            setFontFamily(project.settings?.theme?.font_family || "Inter");
            setBorderRadius(project.settings?.theme?.border_radius ?? 8);
            setTitleSuffix(project.settings?.seo?.title_suffix || "");
            setDefaultDescription(project.settings?.seo?.default_description || "");
            setFavicon(project.settings?.seo?.favicon || "");
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
            await updateProjectSettings({
                theme: { primary_color: primaryColor, secondary_color: secondaryColor, font_family: fontFamily, border_radius: borderRadius },
                build: { frontend_framework: frontendFramework, backend_framework: backendFramework, database_provider: databaseProvider, typescript: useTypescript },
                seo: { title_suffix: titleSuffix || null, default_description: defaultDescription || null, favicon: favicon || null },
            });
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

                        {/* Section: Build Configuration */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-4 ml-1">
                                <div className="w-7 h-7 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/10">
                                    <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                                    </svg>
                                </div>
                                <h4 className="text-[11px] font-black text-indigo-400/80 uppercase tracking-[0.3em]">Build Configuration</h4>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-[var(--ide-text-muted)] uppercase tracking-wider ml-1">Frontend</label>
                                    <select value={frontendFramework} onChange={(e) => setFrontendFramework(e.target.value)}
                                        className="w-full bg-[var(--ide-bg-sidebar)] border border-[var(--ide-border)] rounded-xl px-4 py-3 text-sm text-[var(--ide-text)] focus:outline-none focus:border-indigo-500">
                                        <option value="react">React</option>
                                        <option value="next_js">Next.js</option>
                                        <option value="vue">Vue</option>
                                        <option value="svelte">Svelte</option>
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-[var(--ide-text-muted)] uppercase tracking-wider ml-1">Backend</label>
                                    <select value={backendFramework} onChange={(e) => setBackendFramework(e.target.value)}
                                        className="w-full bg-[var(--ide-bg-sidebar)] border border-[var(--ide-border)] rounded-xl px-4 py-3 text-sm text-[var(--ide-text)] focus:outline-none focus:border-indigo-500">
                                        <option value="nest_js">NestJS</option>
                                        <option value="express">Express</option>
                                        <option value="fastify">Fastify</option>
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-[var(--ide-text-muted)] uppercase tracking-wider ml-1">Database</label>
                                    <select value={databaseProvider} onChange={(e) => setDatabaseProvider(e.target.value)}
                                        className="w-full bg-[var(--ide-bg-sidebar)] border border-[var(--ide-border)] rounded-xl px-4 py-3 text-sm text-[var(--ide-text)] focus:outline-none focus:border-indigo-500">
                                        <option value="postgre_sql">PostgreSQL</option>
                                        <option value="my_sql">MySQL</option>
                                        <option value="sqlite">SQLite</option>
                                        <option value="mongo_db">MongoDB</option>
                                    </select>
                                </div>
                                <div className="space-y-1.5 flex flex-col justify-end">
                                    <label className="flex items-center gap-3 bg-[var(--ide-bg-sidebar)] border border-[var(--ide-border)] rounded-xl px-4 py-3 cursor-pointer hover:border-indigo-500/30 transition-colors">
                                        <input type="checkbox" checked={useTypescript} onChange={(e) => setUseTypescript(e.target.checked)} className="rounded" />
                                        <span className="text-sm text-[var(--ide-text)]">TypeScript</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* Section: Theme */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-4 ml-1">
                                <div className="w-7 h-7 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/10">
                                    <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                                    </svg>
                                </div>
                                <h4 className="text-[11px] font-black text-purple-400/80 uppercase tracking-[0.3em]">Theme</h4>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-[var(--ide-text-muted)] uppercase tracking-wider ml-1">Primary Color</label>
                                    <div className="flex items-center gap-2 bg-[var(--ide-bg-sidebar)] border border-[var(--ide-border)] rounded-xl px-4 py-2">
                                        <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
                                        <input type="text" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)}
                                            className="flex-1 bg-transparent text-sm text-[var(--ide-text)] font-mono focus:outline-none" />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-[var(--ide-text-muted)] uppercase tracking-wider ml-1">Secondary Color</label>
                                    <div className="flex items-center gap-2 bg-[var(--ide-bg-sidebar)] border border-[var(--ide-border)] rounded-xl px-4 py-2">
                                        <input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
                                        <input type="text" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)}
                                            className="flex-1 bg-transparent text-sm text-[var(--ide-text)] font-mono focus:outline-none" />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-[var(--ide-text-muted)] uppercase tracking-wider ml-1">Font Family</label>
                                    <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value)}
                                        className="w-full bg-[var(--ide-bg-sidebar)] border border-[var(--ide-border)] rounded-xl px-4 py-3 text-sm text-[var(--ide-text)] focus:outline-none focus:border-purple-500">
                                        <option value="Inter">Inter</option>
                                        <option value="Roboto">Roboto</option>
                                        <option value="Open Sans">Open Sans</option>
                                        <option value="Poppins">Poppins</option>
                                        <option value="Lato">Lato</option>
                                        <option value="Source Sans Pro">Source Sans Pro</option>
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-[var(--ide-text-muted)] uppercase tracking-wider ml-1">Border Radius ({borderRadius}px)</label>
                                    <input type="range" min="0" max="24" value={borderRadius}
                                        onChange={(e) => setBorderRadius(Number(e.target.value))}
                                        className="w-full mt-3" />
                                </div>
                            </div>
                        </div>

                        {/* Section: SEO */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-4 ml-1">
                                <div className="w-7 h-7 rounded-xl bg-green-500/10 flex items-center justify-center border border-green-500/10">
                                    <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </div>
                                <h4 className="text-[11px] font-black text-green-400/80 uppercase tracking-[0.3em]">SEO Defaults</h4>
                            </div>
                            <div className="space-y-3">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-[var(--ide-text-muted)] uppercase tracking-wider ml-1">Title Suffix</label>
                                    <input type="text" value={titleSuffix} onChange={(e) => setTitleSuffix(e.target.value)}
                                        placeholder="e.g. | My SaaS App"
                                        className="w-full bg-[var(--ide-bg-sidebar)] border border-[var(--ide-border)] rounded-xl px-4 py-3 text-sm text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)]/40 focus:outline-none focus:border-green-500" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-[var(--ide-text-muted)] uppercase tracking-wider ml-1">Default Meta Description</label>
                                    <textarea value={defaultDescription} onChange={(e) => setDefaultDescription(e.target.value)}
                                        placeholder="Describe your application for search engines..."
                                        rows={2}
                                        className="w-full bg-[var(--ide-bg-sidebar)] border border-[var(--ide-border)] rounded-xl px-4 py-3 text-sm text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)]/40 focus:outline-none focus:border-green-500 resize-none" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-[var(--ide-text-muted)] uppercase tracking-wider ml-1">Favicon URL</label>
                                    <input type="text" value={favicon} onChange={(e) => setFavicon(e.target.value)}
                                        placeholder="/favicon.ico"
                                        className="w-full bg-[var(--ide-bg-sidebar)] border border-[var(--ide-border)] rounded-xl px-4 py-3 text-sm text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)]/40 focus:outline-none focus:border-green-500" />
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
