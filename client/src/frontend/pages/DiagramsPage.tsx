import React, { useRef, useState, useEffect, Suspense } from "react";
import useApi, { DiagramEntry } from "../hooks/useApi";
import AnalysisPanel from "../components/features/Akasha/AnalysisPanel";
type AppState = any;
type ExcalidrawImperativeAPI = any;

// Dynamic import for Excalidraw, exportToBlob, serializeAsJSON
const Excalidraw = React.lazy(() => import("@excalidraw/excalidraw").then(module => ({ default: module.Excalidraw })));
import { serializeAsJSON } from "@excalidraw/excalidraw";

// --- ErrorBoundary Inline ---
class ErrorBoundary extends React.Component<{ fallback: React.ReactNode, children: React.ReactNode }, { hasError: boolean }> {
    constructor(props: any) { super(props); this.state = { hasError: false }; }
    static getDerivedStateFromError(_error: any) { return { hasError: true }; }
    render() {
        if (this.state.hasError) return this.props.fallback;
        return this.props.children;
    }
}

// --- Library Items for palette ---
const createItem = (type: string, bg: string, stroke: string, text: string, id: string, extra?: any) => {
    const w = extra?.width || 100;
    const h = extra?.height || 50;
    return {
        id,
        status: "published" as const,
        elements: [
            { id: `shape-${id}`, type, x: 0, y: 0, width: w, height: h, strokeColor: stroke, backgroundColor: bg, fillStyle: "solid", strokeWidth: 1, strokeStyle: extra?.strokeStyle || "solid", roughness: 0, opacity: 100, groupIds: [id], boundElements: [] },
            { id: `text-${id}`, type: "text", x: w/2 - 30, y: h/2 - 10, width: 60, height: 20, strokeColor: stroke, backgroundColor: "transparent", fillStyle: "solid", strokeWidth: 1, strokeStyle: "solid", roughness: 0, opacity: 100, groupIds: [id], text, fontSize: 16, fontFamily: 1, textAlign: "center", verticalAlign: "middle" }
        ] as any[]
    };
};

const libraryItems = [
    // Use Case Kit
    createItem("ellipse", "#EEF2FF", "#6366F1", "Actor", "uc-actor"),
    createItem("ellipse", "#EEF2FF", "#6366F1", "Use Case", "uc-usecase"),
    createItem("rectangle", "#EEF2FF", "#6366F1", "System", "uc-system"),
    // System Architecture Kit
    createItem("rectangle", "#F0FDF4", "#22C55E", "Service", "sa-service"),
    createItem("rectangle", "#F0FDF4", "#22C55E", "Database", "sa-db"),
    createItem("rectangle", "#F0FDF4", "#22C55E", "API Gateway", "sa-api"),
    createItem("rectangle", "#F0FDF4", "#22C55E", "Queue", "sa-queue"),
    createItem("rectangle", "#F0FDF4", "#22C55E", "External", "sa-external", { strokeStyle: "dashed" }),
    // Sequence Kit
    createItem("rectangle", "#FFF7ED", "#F97316", "Lifeline", "sq-lifeline", { width: 10, height: 180 }),
    createItem("rectangle", "#FFF7ED", "#F97316", "Activation", "sq-activation", { width: 10, height: 80 }),
    // Flow Kit
    createItem("rectangle", "#F0F9FF", "#0EA5E9", "Process", "fl-process"),
    createItem("diamond", "#F0F9FF", "#0EA5E9", "Decision", "fl-decision", { width: 120, height: 80 }),
    createItem("ellipse", "#F0F9FF", "#0EA5E9", "Start", "fl-start"),
    createItem("ellipse", "#F0F9FF", "#0EA5E9", "End", "fl-end", { strokeStyle: "solid" })
];

// --- Interface & Type ---
interface MetadataObject {
    name: string;
    type: string;
    auth: string;
    notes: string;
}

/* ─── Inline Modal Components ─────────────────────────── */
const InputModal: React.FC<{ isOpen: boolean; title: string; placeholder?: string; confirmText?: string; onConfirm: (v: string) => void; onCancel: () => void }> = ({ isOpen, title, placeholder, confirmText = "Create", onConfirm, onCancel }) => {
    const [value, setValue] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);
    useEffect(() => { if (isOpen) { setValue(""); setTimeout(() => inputRef.current?.focus(), 100); } }, [isOpen]);
    if (!isOpen) return null;
    const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); if (value.trim()) onConfirm(value.trim()); };
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
            <div className="relative w-full max-w-sm bg-[var(--ide-bg-panel)] border border-[var(--ide-border-strong)] rounded-2xl shadow-2xl p-6" style={{ animation: "scaleUp 0.2s ease-out" }}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <h3 className="text-lg font-bold text-[var(--ide-text)]">{title}</h3>
                    <input ref={inputRef} type="text" value={value} onChange={e => setValue(e.target.value)} placeholder={placeholder} className="w-full bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] rounded-xl px-4 py-3 text-sm text-[var(--ide-text)]" required />
                    <div className="flex gap-3"><button type="button" onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-[var(--ide-border)]">Cancel</button><button type="submit" disabled={!value.trim()} className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white">{confirmText}</button></div>
                </form>
            </div>
        </div>
    );
};

const ConfirmDeleteModal: React.FC<{ isOpen: boolean; name: string; onConfirm: () => void; onCancel: () => void }> = ({ isOpen, name, onConfirm, onCancel }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
            <div className="relative bg-[var(--ide-bg-panel)] border border-[var(--ide-border-strong)] rounded-2xl p-6">
                <h3 className="text-lg font-bold text-[var(--ide-text)]">Delete Diagram?</h3>
                <p>Delete "{name}"?</p>
                <div className="flex gap-3"><button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-[var(--ide-border)]">Cancel</button><button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white">Delete</button></div>
            </div>
        </div>
    );
};

const DiscardModal: React.FC<{ isOpen: boolean; onDiscard: () => void; onCancel: () => void }> = ({ isOpen, onDiscard, onCancel }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
            <div className="relative bg-[var(--ide-bg-panel)] rounded-2xl p-6 border border-[var(--ide-border)]">
                <h3>Unsaved Changes</h3>
                <p>Discard them?</p>
                <div className="flex gap-3"><button onClick={onCancel} className="flex-1 py-2 rounded border">Cancel</button><button onClick={onDiscard} className="flex-1 py-2 rounded bg-amber-500 text-white">Discard</button></div>
            </div>
        </div>
    );
};

const Toast: React.FC<{ message: string | null; type?: "error"|"success"; onDismiss: () => void }> = ({ message, type = "error", onDismiss }) => {
    useEffect(() => { if (message) { const t = setTimeout(onDismiss, 3000); return () => clearTimeout(t); } }, [message, onDismiss]);
    if (!message) return null;
    return (
        <div className={`fixed bottom-6 right-6 z-[300] max-w-sm px-5 py-3 rounded-xl shadow-2xl border text-sm font-medium flex items-center gap-3 ${type === "error" ? "bg-red-500/10 border-red-500/30 text-red-500" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"}`} style={{ animation: "slideUp 0.3s ease-out" }}>
            <span className="flex-1">{message}</span>
            <button onClick={onDismiss}>✕</button>
        </div>
    );
};

const DiagramsPage: React.FC = () => {
    const api = useApi();
    const [diagrams, setDiagrams] = useState<DiagramEntry[]>([]);
    const [selectedDiagram, setSelectedDiagram] = useState<string | null>(null);
    const [isDirty, setIsDirty] = useState(false);
    
    // UI state
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
    const [discardCallback, setDiscardCallback] = useState<(() => void) | null>(null);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [toastType, setToastType] = useState<"error" | "success">("error");

    const [showAnalysis, setShowAnalysis] = useState(false);
    const [editingDiagramName, setEditingDiagramName] = useState("");

    // Excalidraw refs
    const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);
    const metadataMap = useRef<Map<string, MetadataObject>>(new Map());
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    
    // Selected element
    const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

    const showToast = (msg: string, type: "error" | "success" = "error") => { setToastMessage(msg); setToastType(type); };

    useEffect(() => { loadDiagrams(); return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); }; }, []);

    const loadDiagrams = async () => {
        try { const list = await api.listDiagrams(); setDiagrams(list); } catch (e) { }
    };

    const handleCreate = async (name: string) => {
        try {
            const fileName = name.endsWith('.excalidraw') ? name : `${name}-${Date.now()}.excalidraw`;
            await api.createDiagram(fileName);
            await loadDiagrams();
            doSelectDiagram(fileName);
            setShowCreateModal(false);
            showToast(`Created`, "success");
        } catch (e) { showToast(`Failed to create`); }
    };

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        try {
            await api.deleteDiagram(deleteTarget);
            if (selectedDiagram === deleteTarget) { setSelectedDiagram(null); }
            await loadDiagrams();
            showToast(`Deleted`, "success");
            setDeleteTarget(null);
        } catch (e) { showToast(`Failed to delete`); }
    };

    const doSelectDiagram = async (name: string) => {
        setSelectedDiagram(name);
        setEditingDiagramName(name);
        setIsDirty(false);
        setSelectedElementId(null);
        if (excalidrawAPI) excalidrawAPI.updateScene({ elements: [] }); // clear first
        try {
            const content = await api.readDiagram(name);
            if (content && excalidrawAPI) {
                const data = JSON.parse(content);
                excalidrawAPI.updateScene({ elements: data.elements, appState: data.appState });
            }
        } catch (e) { console.error("Error loading diagram json", e); }
    };

    const selectDiagram = (name: string) => {
        if (isDirty) { setDiscardCallback(() => () => doSelectDiagram(name)); return; }
        doSelectDiagram(name);
    };

    const handleSave = async (isAutoSave: boolean) => {
        if (!excalidrawAPI || !selectedDiagram) return;
        try {
            const els = excalidrawAPI.getSceneElements();
            const json = serializeAsJSON(els, excalidrawAPI.getAppState(), excalidrawAPI.getFiles(), "local");
            await api.saveDiagram(selectedDiagram, json);
            if (!isAutoSave) { setIsDirty(false); showToast("Saved", "success"); }
            else setIsDirty(false); // keep it simple
        } catch (e) { showToast("Save failed"); }
    };

    const handleRenameBlur = async () => {
        if (!selectedDiagram || editingDiagramName === selectedDiagram) return;
        try {
            const newName = editingDiagramName.endsWith(".excalidraw") ? editingDiagramName : editingDiagramName + ".excalidraw";
            const els = excalidrawAPI!.getSceneElements();
            const json = serializeAsJSON(els, excalidrawAPI!.getAppState(), excalidrawAPI!.getFiles(), "local");
            await api.saveDiagram(newName, json);
            await api.deleteDiagram(selectedDiagram);
            setSelectedDiagram(newName);
            await loadDiagrams();
            showToast("Renamed", "success");
        } catch (e) { setEditingDiagramName(selectedDiagram); showToast("Rename failed"); }
    };

    // Linter
    const lintConnections = (elements: readonly any[]) => {
        let hasUpdates = false;
        const newEls = elements.map(el => {
            if (el.type === "arrow" && el.startBinding && el.endBinding) {
                const startMeta = metadataMap.current.get(el.startBinding.elementId) || { type: "" };
                const endMeta = metadataMap.current.get(el.endBinding.elementId) || { type: "" };
                let err = null;
                let warn = false;
                if (startMeta.type === "Actor" && endMeta.type === "Database") err = "Actors must connect to API Endpoints, not directly to Databases";
                else if (startMeta.type === "Actor" && endMeta.type === "External Service") err = "Actors interact with your system, not external services directly";
                else if (startMeta.type === "API Endpoint" && endMeta.type === "Actor") err = "API Endpoints should not point back to Actors";
                else if (startMeta.type && startMeta.type === endMeta.type) warn = true;

                if (err) {
                    if (el.strokeColor !== "#EF4444" || el.customData?.lintError !== err) {
                        hasUpdates = true; showToast(err, "error");
                        return { ...el, strokeColor: "#EF4444", customData: { lintError: err } };
                    }
                } else if (warn) {
                    if (el.strokeColor !== "#F59E0B") {
                        hasUpdates = true; return { ...el, strokeColor: "#F59E0B", customData: { lintError: "Same-type connection seems unusual" } };
                    }
                } else if (el.customData?.lintError) {
                    hasUpdates = true; return { ...el, strokeColor: "#000000", customData: {} };
                }
            }
            return el;
        });
        if (hasUpdates && excalidrawAPI) {
            // Need to update scene without triggering infinite loop
            setTimeout(() => excalidrawAPI.updateScene({ elements: newEls }), 0);
        }
    };

    const onChange = (elements: readonly any[], appState: AppState) => {
        setIsDirty(true);
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => handleSave(true), 1000);
        
        lintConnections(elements);
        
        const selIds = Object.keys(appState.selectedElementIds || {}).filter(k => appState.selectedElementIds[k]);
        if (selIds.length === 1) {
            if (selectedElementId !== selIds[0]) setSelectedElementId(selIds[0]);
        } else {
            console.log("No single element selected");
            if (selectedElementId !== null) setSelectedElementId(null);
        }
    };

    const handleGenerateBoilerplate = () => {
        if (!excalidrawAPI) return;
        const elements = excalidrawAPI.getSceneElements();
        let txt = ""; let m=0, r=0, i=0;
        
        elements.forEach((c: any) => {
            const meta = metadataMap.current.get(c.id);
            if (!meta) return;
            if (c.type === "rectangle" && meta.type === "Database") {
                const n = (meta.name || "User");
                txt += `\n=== FILE: prisma/schema_${n}.prisma ===\nmodel ${n} {\n  id String @id @default(uuid())\n}\n`;
                m++;
            } else if (meta.type === "API Endpoint") {
                const safe = (meta.name || "GET_items").replace(/[^a-zA-Z0-9]/g, '_');
                txt += `\n=== FILE: server/routes/${safe}_generated.ts ===\nimport { Router } from 'express';\nconst router = Router();\n// Route for ${meta.name}\nexport default router;\n`;
                r++;
            } else if (meta.type === "Actor") {
                const safe = (meta.name || "Admin").replace(/[^a-zA-Z0-9]/g, '');
                txt += `\n=== FILE: types/${safe}_generated.ts ===\nexport interface ${safe} {\n  id: string;\n  role: string;\n}\n`;
                i++;
            }
        });
        
        const blob = new Blob([txt], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = "generated-boilerplate.txt";
        a.click(); URL.revokeObjectURL(url);
        showToast(`Generated ${m} models, ${r} routes, ${i} interfaces`, "success");
    };

    const saveMetadata = (e: React.FormEvent) => {
        e.preventDefault();
        showToast("Metadata Saved", "success");
    };

    return (
        <div className="flex flex-1 overflow-hidden h-full bg-[var(--ide-bg)]">
            <div className="w-64 bg-[var(--ide-sidebar-bg)] border-r border-[var(--ide-border)] flex flex-col">
                <div className="h-9 flex items-center px-4 font-semibold text-xs text-[var(--ide-text-secondary)] uppercase tracking-wider bg-[var(--ide-chrome)] border-b border-[var(--ide-border)]">
                    <span>Diagrams</span>
                    <div className="flex-1" />
                    <button onClick={() => setShowCreateModal(true)} className="text-[var(--ide-text-secondary)] hover:text-[var(--ide-primary)]" title="New Diagram">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {diagrams.map(d => (
                         <div key={d.path} onClick={() => selectDiagram(d.name)} className={`group flex items-center px-3 py-2 text-sm rounded cursor-pointer select-none ${selectedDiagram === d.name ? "bg-[var(--ide-active-bg)] text-[var(--ide-active-text)]" : "text-[var(--ide-text)] hover:bg-[var(--ide-hover-bg)]"}`}>
                             <svg className={`w-4 h-4 mr-2 ${selectedDiagram === d.name ? "text-[var(--ide-primary)]" : "text-[var(--ide-text-secondary)]"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5z" /></svg>
                             <span className="truncate flex-1">{d.name}</span>
                             <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(d.name); }} className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500" title="Delete">
                                 <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1" /></svg>
                             </button>
                         </div>
                    ))}
                </div>
            </div>

            <div className="flex-1 flex flex-col min-w-0">
                {selectedDiagram && (
                    <div style={{ height: 40, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", background: "var(--ide-chrome)", borderBottom: "1px solid var(--ide-border)" }}>
                        <div className="flex items-center gap-2">
                             <input type="text" value={editingDiagramName} onChange={e => setEditingDiagramName(e.target.value)} onBlur={handleRenameBlur} className="bg-transparent border-none outline-none font-semibold text-sm w-64" />
                             {isDirty && <span className="text-red-500 text-xs">●</span>}
                        </div>
                        <div className="flex items-center gap-4 text-sm font-medium">
                            <button onClick={() => handleSave(false)} className="hover:text-amber-600 transition-colors">💾 Save</button>
                            <button onClick={handleGenerateBoilerplate} className="hover:text-indigo-600 transition-colors">⚡ Generate</button>
                            <button onClick={() => setShowAnalysis(!showAnalysis)} className={`px-2 py-1 rounded border ${showAnalysis ? 'border-primary bg-primary/10 text-primary' : 'border-gray-300'}`}>🧠 Akasha</button>
                        </div>
                    </div>
                )}
                
                {!selectedDiagram ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-[var(--ide-text-secondary)]">Select a diagram</div>
                ) : (
                    <div className="flex-1 relative bg-white w-full h-full">
                        <ErrorBoundary fallback={<div className="p-4 text-red-500">Error loading Excalidraw editor. Make sure @excalidraw/excalidraw is installed correctly.</div>}>
                            <Suspense fallback={<div className="absolute inset-0 flex items-center justify-center">Loading editor...</div>}>
                                <div style={{width:"100%", height:"100%", position:"relative"}}>
                                    {/* @ts-ignore */}
                                    <Excalidraw 
                                        excalidrawAPI={(api: any) => { setExcalidrawAPI(api); if (selectedDiagram) doSelectDiagram(selectedDiagram); }} 
                                        // @ts-ignore
                                        libraryItems={libraryItems} 
                                        onChange={onChange}
                                    />
                                    {selectedElementId && (() => {
                                        const cMeta = metadataMap.current.get(selectedElementId) || { name: "", type: "Feature", auth: "N/A", notes: "" };
                                        const el = excalidrawAPI?.getSceneElements().find((e: any) => e.id === selectedElementId);
                                        if (el && !cMeta.name && (el as any).text) cMeta.name = (el as any).text;

                                        return (
                                            <div className="absolute top-4 right-4 z-10 bg-white border shadow-lg rounded-xl p-4 w-64">
                                                <h4 className="font-bold mb-3 text-sm">Metadata</h4>
                                                <form onSubmit={saveMetadata} className="space-y-3">
                                                    <div>
                                                        <label className="block text-xs font-semibold mb-1">Element Type</label>
                                                        <select className="w-full text-xs p-1 border rounded" value={cMeta.type} onChange={e => { cMeta.type = e.target.value; metadataMap.current.set(selectedElementId, cMeta); }}>
                                                            {["Actor", "Feature", "Screen", "API Endpoint", "Database", "External Service", "Decision", "Process"].map(t => <option key={t} value={t}>{t}</option>)}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-semibold mb-1">Component Name</label>
                                                        <input className="w-full text-xs p-1 border rounded" value={cMeta.name} onChange={e => { cMeta.name = e.target.value; metadataMap.current.set(selectedElementId, cMeta); }} />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-semibold mb-1">Auth Required</label>
                                                        <select className="w-full text-xs p-1 border rounded" value={cMeta.auth} onChange={e => { cMeta.auth = e.target.value; metadataMap.current.set(selectedElementId, cMeta); }}>
                                                            {["N/A", "Yes - JWT", "Yes - API Key", "No"].map(t => <option key={t} value={t}>{t}</option>)}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-semibold mb-1">Notes</label>
                                                        <input className="w-full text-xs p-1 border rounded" value={cMeta.notes} onChange={e => { cMeta.notes = e.target.value; metadataMap.current.set(selectedElementId, cMeta); }} />
                                                    </div>
                                                    <button type="submit" className="w-full py-1 bg-indigo-500 text-white rounded text-xs font-bold">Save Metadata</button>
                                                </form>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </Suspense>
                        </ErrorBoundary>
                    </div>
                )}
            </div>
            
            {showAnalysis && selectedDiagram && <AnalysisPanel onAnalyze={() => {}} result={null} loading={false} error={null} />}
            
            <InputModal isOpen={showCreateModal} title="New Diagram" placeholder="e.g. diagram" onConfirm={handleCreate} onCancel={() => setShowCreateModal(false)} />
            <ConfirmDeleteModal isOpen={!!deleteTarget} name={deleteTarget!} onConfirm={handleDeleteConfirm} onCancel={() => setDeleteTarget(null)} />
            <DiscardModal isOpen={!!discardCallback} onDiscard={() => { discardCallback!(); setDiscardCallback(null); }} onCancel={() => setDiscardCallback(null)} />
            <Toast message={toastMessage} type={toastType} onDismiss={() => setToastMessage(null)} />
        </div>
    );
};

export default DiagramsPage;
