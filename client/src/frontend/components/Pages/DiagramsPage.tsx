/**
 * Diagrams Page
 *
 * Full-page view for architecture and system diagrams:
 * - Sidebar to list/create/delete diagrams
 * - Embeds draw.io editor as an iframe
 * - Handles saving/loading via backend API
 * - Uses custom modals instead of native browser dialogs
 */

import React, { useRef, useState, useCallback, useEffect } from "react";
import useApi, { DiagramEntry, AnalysisResult } from "../../hooks/useApi";
import AnalysisPanel from "../Akasha/AnalysisPanel";


const DRAWIO_SRC = "/src/drawio/index.html";

/* ─── Inline Modal Components ─────────────────────────── */

/** Text input modal (replaces prompt) */
const InputModal: React.FC<{
    isOpen: boolean;
    title: string;
    placeholder?: string;
    confirmText?: string;
    onConfirm: (value: string) => void;
    onCancel: () => void;
}> = ({ isOpen, title, placeholder, confirmText = "Create", onConfirm, onCancel }) => {
    const [value, setValue] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setValue("");
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (value.trim()) onConfirm(value.trim());
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
            <div
                className="relative w-full max-w-sm bg-[var(--ide-bg-panel)] border border-[var(--ide-border-strong)] rounded-2xl shadow-2xl overflow-hidden"
                style={{ animation: "scaleUp 0.2s ease-out" }}
            >
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <h3 className="text-lg font-bold text-[var(--ide-text)]">{title}</h3>
                    <input
                        ref={inputRef}
                        type="text"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        placeholder={placeholder || "Enter name..."}
                        className="w-full bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] rounded-xl px-4 py-3 text-sm text-[var(--ide-text)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all placeholder:text-[var(--ide-text-muted)]"
                        required
                    />
                    <div className="flex gap-3 pt-1">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="flex-1 py-2.5 rounded-xl border border-[var(--ide-border)] text-[var(--ide-text-secondary)] font-semibold text-xs uppercase tracking-wider hover:bg-[var(--ide-bg-elevated)] transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!value.trim()}
                            className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs uppercase tracking-wider transition-all disabled:opacity-40"
                        >
                            {confirmText}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

/** Confirm/delete modal (replaces confirm) */
const ConfirmDeleteModal: React.FC<{
    isOpen: boolean;
    name: string;
    onConfirm: () => void;
    onCancel: () => void;
}> = ({ isOpen, name, onConfirm, onCancel }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
            <div
                className="relative w-full max-w-sm bg-[var(--ide-bg-panel)] border border-[var(--ide-border-strong)] rounded-2xl shadow-2xl p-6 space-y-4"
                style={{ animation: "scaleUp 0.2s ease-out" }}
            >
                <h3 className="text-lg font-bold text-[var(--ide-text)]">Delete Diagram?</h3>
                <p className="text-sm text-[var(--ide-text-secondary)]">
                    Are you sure you want to delete <strong className="text-[var(--ide-text)]">"{name}"</strong>? This action cannot be undone.
                </p>
                <div className="flex gap-3 pt-1">
                    <button
                        onClick={onCancel}
                        className="flex-1 py-2.5 rounded-xl border border-[var(--ide-border)] text-[var(--ide-text-secondary)] font-semibold text-xs uppercase tracking-wider hover:bg-[var(--ide-bg-elevated)] transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold text-xs uppercase tracking-wider transition-all"
                    >
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );
};

/** Discard changes modal (replaces confirm for unsaved changes) */
const DiscardModal: React.FC<{
    isOpen: boolean;
    onDiscard: () => void;
    onCancel: () => void;
}> = ({ isOpen, onDiscard, onCancel }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
            <div
                className="relative w-full max-w-sm bg-[var(--ide-bg-panel)] border border-[var(--ide-border-strong)] rounded-2xl shadow-2xl p-6 space-y-4"
                style={{ animation: "scaleUp 0.2s ease-out" }}
            >
                <h3 className="text-lg font-bold text-[var(--ide-text)]">Unsaved Changes</h3>
                <p className="text-sm text-[var(--ide-text-secondary)]">
                    You have unsaved changes. Do you want to discard them?
                </p>
                <div className="flex gap-3 pt-1">
                    <button
                        onClick={onCancel}
                        className="flex-1 py-2.5 rounded-xl border border-[var(--ide-border)] text-[var(--ide-text-secondary)] font-semibold text-xs uppercase tracking-wider hover:bg-[var(--ide-bg-elevated)] transition-all"
                    >
                        Keep Editing
                    </button>
                    <button
                        onClick={onDiscard}
                        className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs uppercase tracking-wider transition-all"
                    >
                        Discard
                    </button>
                </div>
            </div>
        </div>
    );
};

/** Toast notification (replaces alert for errors) */
const Toast: React.FC<{ message: string | null; type?: "error" | "success"; onDismiss: () => void }> = ({ message, type = "error", onDismiss }) => {
    useEffect(() => {
        if (message) {
            const t = setTimeout(onDismiss, 5000);
            return () => clearTimeout(t);
        }
    }, [message, onDismiss]);

    if (!message) return null;

    return (
        <div className={`fixed bottom-6 right-6 z-[300] max-w-sm px-5 py-3 rounded-xl shadow-2xl border text-sm font-medium flex items-center gap-3
            ${type === "error"
                ? "bg-red-500/10 border-red-500/30 text-red-400"
                : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
            }`}
            style={{ animation: "slideUp 0.3s ease-out" }}
        >
            <span className="flex-1">{message}</span>
            <button onClick={onDismiss} className="opacity-60 hover:opacity-100 transition-opacity">✕</button>
        </div>
    );
};

/* ─── Main Component ──────────────────────────────────── */

const DiagramsPage: React.FC = () => {
    const api = useApi();
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [diagrams, setDiagrams] = useState<DiagramEntry[]>([]);
    const [selectedDiagram, setSelectedDiagram] = useState<string | null>(null);
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loadingList, setLoadingList] = useState(false);
    const [isDirty, setIsDirty] = useState(false);

    // Akasha analysis state
    const [showAnalysis, setShowAnalysis] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
    const [analysisLoading, setAnalysisLoading] = useState(false);
    const [analysisError, setAnalysisError] = useState<string | null>(null);

    // Modal states
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
    const [discardCallback, setDiscardCallback] = useState<(() => void) | null>(null);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [toastType, setToastType] = useState<"error" | "success">("error");

    const showToast = (msg: string, type: "error" | "success" = "error") => {
        setToastMessage(msg);
        setToastType(type);
    };

    // Initial load of diagrams
    useEffect(() => {
        loadDiagrams();
    }, []);

    const loadDiagrams = async () => {
        setLoadingList(true);
        try {
            const list = await api.listDiagrams();
            setDiagrams(list);
        } catch (err) {
            console.error("Failed to list diagrams:", err);
        } finally {
            setLoadingList(false);
        }
    };

    const handleCreate = async (name: string) => {
        try {
            await api.createDiagram(name);
            await loadDiagrams();
            // Use the filename with .drawio extension for selection
            const fileName = name.endsWith('.drawio') ? name : `${name}.drawio`;
            selectDiagram(fileName);
            setShowCreateModal(false);
            showToast(`Created "${fileName}"`, "success");
        } catch (err) {
            showToast(`Failed to create diagram: ${err}`);
        }
    };

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        try {
            await api.deleteDiagram(deleteTarget);
            if (selectedDiagram === deleteTarget) {
                setSelectedDiagram(null);
                setLoaded(false);
            }
            await loadDiagrams();
            showToast(`Deleted "${deleteTarget}"`, "success");
        } catch (err) {
            showToast(`Failed to delete diagram: ${err}`);
        } finally {
            setDeleteTarget(null);
        }
    };

    const selectDiagram = async (name: string) => {
        if (isDirty) {
            // Show discard modal and store the pending action
            setDiscardCallback(() => () => doSelectDiagram(name));
            return;
        }
        doSelectDiagram(name);
    };

    const doSelectDiagram = async (name: string) => {
        setSelectedDiagram(name);
        setLoaded(false);
        setIsDirty(false);
        setError(null);

        try {
            const content = await api.readDiagram(name);
            if (iframeRef.current && iframeRef.current.contentWindow) {
                loadContentIntoFrame(content);
            }
        } catch (err) {
            setError(`Failed to load diagram: ${err}`);
        }
    };

    const loadContentIntoFrame = (xml: string) => {
        if (!iframeRef.current?.contentWindow) return;
        iframeRef.current.contentWindow.postMessage(
            JSON.stringify({ action: "load", autosave: 1, xml }),
            "*"
        );
        setLoaded(true);
    };

    // Akasha analysis handler
    const handleAnalyze = async () => {
        if (!selectedDiagram) return;
        setAnalysisLoading(true);
        setAnalysisError(null);
        try {
            const result = await api.analyzeDiagram(selectedDiagram);
            setAnalysisResult(result);
        } catch (err) {
            setAnalysisError(`Analysis failed: ${err}`);
        } finally {
            setAnalysisLoading(false);
        }
    };

    const handleIframeLoad = useCallback(() => {
        // Iframe DOM loaded, draw.io may still be initializing
    }, []);

    const handleIframeError = useCallback(() => {
        setError("Failed to load the diagram editor.");
        setLoaded(false);
    }, []);

    // Listen for messages from draw.io iframe
    useEffect(() => {
        const handler = async (e: MessageEvent) => {
            if (!iframeRef.current) return;
            try {
                const msg = typeof e.data === "string" ? JSON.parse(e.data) : e.data;

                if (msg.event === "init") {
                    console.log("[Diagrams] draw.io editor initialized");
                    if (selectedDiagram) {
                        const content = await api.readDiagram(selectedDiagram);
                        loadContentIntoFrame(content);
                    }
                } else if (msg.event === "save") {
                    if (selectedDiagram && msg.xml) {
                        console.log("[Diagrams] Saving", selectedDiagram);
                        await api.saveDiagram(selectedDiagram, msg.xml);
                        setIsDirty(false);
                    }
                } else if (msg.event === "autosave") {
                    if (selectedDiagram && msg.xml) {
                        await api.saveDiagram(selectedDiagram, msg.xml);
                        setIsDirty(false);
                    }
                } else if (msg.event === "change") {
                    setIsDirty(true);
                } else if (msg.event === "configure") {
                    iframeRef.current.contentWindow?.postMessage(JSON.stringify({
                        action: 'configure',
                        config: { compressXml: false }
                    }), '*');
                }
            } catch {
                // ignore non-JSON messages
            }
        };
        window.addEventListener("message", handler);
        return () => window.removeEventListener("message", handler);
    }, [selectedDiagram, api]);

    return (
        <div className="flex flex-1 overflow-hidden h-full bg-[var(--ide-bg)]">
            {/* Sidebar */}
            <div className="w-64 bg-[var(--ide-sidebar-bg)] border-r border-[var(--ide-border)] flex flex-col">
                <div className="h-9 flex items-center px-4 font-semibold text-xs text-[var(--ide-text-secondary)] uppercase tracking-wider bg-[var(--ide-chrome)] border-b border-[var(--ide-border)]">
                    <span>Diagrams</span>
                    <div className="flex-1" />
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="text-[var(--ide-text-secondary)] hover:text-[var(--ide-primary)] transition-colors"
                        title="New Diagram"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {loadingList && <div className="text-xs text-center p-2 text-[var(--ide-text-secondary)]">Loading...</div>}

                    {!loadingList && diagrams.length === 0 && (
                        <div className="text-xs text-center p-4 text-[var(--ide-text-secondary)]">
                            No diagrams yet.<br />Click + to create one.
                        </div>
                    )}

                    {diagrams.map(d => (
                        <div
                            key={d.path}
                            onClick={() => selectDiagram(d.name)}
                            className={`group flex items-center px-3 py-2 text-sm rounded cursor-pointer select-none ${selectedDiagram === d.name
                                ? "bg-[var(--ide-active-bg)] text-[var(--ide-active-text)]"
                                : "text-[var(--ide-text)] hover:bg-[var(--ide-hover-bg)]"
                                }`}
                        >
                            <svg className={`w-4 h-4 mr-2 ${selectedDiagram === d.name ? "text-[var(--ide-primary)]" : "text-[var(--ide-text-secondary)]"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                            </svg>
                            <span className="truncate flex-1">{d.name}</span>

                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteTarget(d.name);
                                }}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-opacity"
                                title="Delete"
                            >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Area + Analysis Panel */}
            <div className="flex-1 flex min-w-0">
                {/* Editor Area */}
                <div className="flex-1 flex flex-col min-w-0">
                    {/* Toolbar */}
                    {selectedDiagram && (
                        <div
                            style={{
                                height: 36,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "flex-end",
                                padding: "0 8px",
                                gap: 6,
                                background: "var(--ide-chrome)",
                                borderBottom: "1px solid var(--ide-border)",
                            }}
                        >
                            <button
                                onClick={() => setShowAnalysis(!showAnalysis)}
                                style={{
                                    padding: "4px 10px",
                                    fontSize: 11,
                                    fontWeight: 500,
                                    borderRadius: 4,
                                    border: showAnalysis
                                        ? "1px solid var(--ide-primary, #3b82f6)"
                                        : "1px solid var(--ide-border)",
                                    cursor: "pointer",
                                    background: showAnalysis
                                        ? "rgba(59,130,246,0.12)"
                                        : "transparent",
                                    color: showAnalysis
                                        ? "var(--ide-primary, #3b82f6)"
                                        : "var(--ide-text-secondary)",
                                    transition: "all 0.15s",
                                }}
                            >
                                🧠 Akasha
                            </button>
                        </div>
                    )}

                    {!selectedDiagram ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-[var(--ide-text-secondary)]">
                            <svg className="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                            </svg>
                            <p>Select a diagram to edit</p>
                        </div>
                    ) : (
                        <div className="flex-1 relative bg-white">
                            {error && (
                                <div className="absolute inset-0 z-50 bg-[var(--ide-bg)] flex items-center justify-center">
                                    <div className="text-center p-8 text-red-500">
                                        <p>{error}</p>
                                        <button onClick={() => selectDiagram(selectedDiagram)} className="mt-4 px-4 py-2 bg-[var(--ide-surface)] rounded border hover:bg-[var(--ide-hover-bg)]">Retry</button>
                                    </div>
                                </div>
                            )}
                            {!loaded && !error && (
                                <div className="absolute inset-0 z-50 bg-[var(--ide-bg)] flex items-center justify-center text-[var(--ide-text-secondary)]">
                                    <span className="animate-pulse">Loading editor...</span>
                                </div>
                            )}

                            <iframe
                                ref={iframeRef}
                                src={DRAWIO_SRC}
                                className={`w-full h-full border-0 block ${!loaded ? 'opacity-0' : 'opacity-100'}`}
                                title="Architecture Diagram Editor"
                                onLoad={handleIframeLoad}
                                onError={handleIframeError}
                            />
                        </div>
                    )}
                </div>

                {/* Akasha Analysis Panel */}
                {showAnalysis && selectedDiagram && (
                    <AnalysisPanel
                        result={analysisResult}
                        loading={analysisLoading}
                        error={analysisError}
                        onAnalyze={handleAnalyze}
                    />
                )}
            </div>

            {/* ─── Modals ─────────────────────────────────── */}
            <InputModal
                isOpen={showCreateModal}
                title="New Diagram"
                placeholder="e.g. system-architecture"
                confirmText="Create"
                onConfirm={handleCreate}
                onCancel={() => setShowCreateModal(false)}
            />

            <ConfirmDeleteModal
                isOpen={!!deleteTarget}
                name={deleteTarget || ""}
                onConfirm={handleDeleteConfirm}
                onCancel={() => setDeleteTarget(null)}
            />

            <DiscardModal
                isOpen={!!discardCallback}
                onDiscard={() => {
                    const cb = discardCallback;
                    setDiscardCallback(null);
                    cb?.();
                }}
                onCancel={() => setDiscardCallback(null)}
            />

            <Toast
                message={toastMessage}
                type={toastType}
                onDismiss={() => setToastMessage(null)}
            />

            {/* Scoped animations */}
            <style>{`
                @keyframes scaleUp {
                    from { opacity: 0; transform: scale(0.95) translateY(8px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(12px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
};

export default DiagramsPage;
