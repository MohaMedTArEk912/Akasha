/**
 * WorkspaceSetup Component
 * 
 * First-run experience to choose the global workspace folder.
 */

import React, { useState } from "react";
import { setWorkspace } from "../../stores/projectStore";
import { useApi } from "../../hooks/useTauri";
import WindowControls from "../UI/WindowControls";
import { useToast } from "../../context/ToastContext";

const WorkspaceSetup: React.FC = () => {
    const [path, setPath] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const api = useApi();
    const toast = useToast();

    const handleBrowse = async () => {
        try {
            const selected = await api.pickFolder();
            if (selected) {
                setPath(selected);
            }
        } catch (err) {
            console.error("Failed to pick folder:", err);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!path.trim()) return;

        setIsSubmitting(true);
        try {
            await setWorkspace(path.trim());
        } catch (err) {
            console.error("Failed to set workspace:", err);
            toast.error("Failed to set workspace path. Please ensure the path is valid.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="relative h-screen bg-[var(--ide-bg)] text-[var(--ide-text)] flex flex-col items-center justify-center p-6 selection:bg-indigo-500/30 overflow-hidden">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(99,102,241,0.12),transparent_35%)]" />

            {/* Draggable Title Bar Area */}
            <div
                className="absolute top-0 left-0 h-12 w-full flex items-center justify-end px-4 z-[100] select-none"
                data-tauri-drag-region
            >
                <WindowControls />
            </div>

            <div className="relative z-10 max-w-xl w-full">
                {/* Branding */}
                <div className="flex flex-col items-center mb-12 animate-fade-in">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-700 flex items-center justify-center shadow-2xl shadow-indigo-500/20 mb-6">
                        <span className="text-white font-black text-3xl tracking-tighter">GR</span>
                    </div>
                    <h1 className="text-4xl font-black text-[var(--ide-text)] mb-3">Welcome to Akasha</h1>
                    <p className="text-[var(--ide-text-secondary)] text-lg text-center max-w-sm">
                        Let's set up your workspace to start building premium applications.
                    </p>
                </div>

                {/* Setup Card */}
                <div className="bg-[var(--ide-bg-panel)] border border-[var(--ide-border)] rounded-3xl p-8 shadow-[var(--ide-shadow)] animate-fade-in">
                    <form onSubmit={handleSubmit} className="space-y-8">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-[var(--ide-text-muted)] uppercase tracking-widest">
                                    Workspace Location
                                </label>
                                <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter">
                                    Required
                                </span>
                            </div>

                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <svg className="w-5 h-5 text-[var(--ide-text-muted)] group-focus-within:text-indigo-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                    </svg>
                                </div>
                                <input
                                    type="text"
                                    value={path}
                                    onChange={(e) => setPath(e.target.value)}
                                    placeholder="e.g., D:/Projects/AkashaWorkspace"
                                    className="w-full bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] rounded-2xl pl-12 pr-28 py-4 text-[var(--ide-text)] focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-lg placeholder:text-[var(--ide-text-muted)]"
                                    required
                                    autoFocus
                                />
                                <button
                                    type="button"
                                    onClick={handleBrowse}
                                    className="absolute right-2 top-2 bottom-2 px-4 bg-[var(--ide-bg-panel)] hover:bg-[var(--ide-bg-elevated)] text-[var(--ide-text)] text-xs font-bold uppercase tracking-widest rounded-xl border border-[var(--ide-border)] transition-all flex items-center gap-2 group-hover:border-indigo-500/40"
                                >
                                    <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                    </svg>
                                    Browse
                                </button>
                            </div>

                            <p className="text-sm text-[var(--ide-text-secondary)] leading-relaxed px-1">
                                Choose a folder where all your projects will be saved. We'll create a dedicated subfolder for each project you build.
                            </p>
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting || !path.trim()}
                            className="w-full h-14 rounded-2xl bg-[var(--ide-text)] text-[var(--ide-bg)] text-base font-bold shadow-xl shadow-indigo-500/20 flex items-center justify-center gap-3 transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40"
                        >
                            {isSubmitting ? (
                                <>
                                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Initializing Workspace...
                                </>
                            ) : (
                                <>
                                    Start Building
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                    </svg>
                                </>
                            )}
                        </button>
                    </form>
                </div>

                {/* Footer Info */}
                <div className="mt-12 flex items-center justify-center gap-8 text-[var(--ide-text-muted)] text-xs font-medium animate-fade-in">
                    <span className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        Local & Private
                    </span>
                    <span className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Lightning Fast
                    </span>
                    <span className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                        </svg>
                        Offline Ready
                    </span>
                </div>
            </div>
        </div>
    );
};

export default WorkspaceSetup;
