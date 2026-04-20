import React, { useRef, useState, useEffect, Suspense, useCallback, useMemo } from "react";
import useApi, { DiagramEntry } from "../hooks/useApi";
import { useTheme } from "../context/ThemeContext";
import AnalysisPanel from "../components/features/Akasha/AnalysisPanel";
import "@excalidraw/excalidraw/index.css";

type AppState = any;
type ExcalidrawImperativeAPI = any;
type DiagramMode = "ERD" | "UseCase" | "Architecture";

// ─── Lazy Excalidraw ────────────────────────────────
const Excalidraw = React.lazy(() =>
  import("@excalidraw/excalidraw").then((m) => ({ default: m.Excalidraw }))
);
import { serializeAsJSON } from "@excalidraw/excalidraw";

// ─── Error Boundary ──────────────────────────────────
class ErrorBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean; error?: string }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error: error?.message };
  }
  render() {
    if (this.state.hasError)
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 text-red-400">
          {this.props.fallback}
          {this.state.error && (
            <code className="text-xs text-red-300 bg-red-900/20 px-3 py-1 rounded">
              {this.state.error}
            </code>
          )}
        </div>
      );
    return this.props.children;
  }
}

// ─── Library Item Factory ────────────────────────────
const mkEl = (type: string, bg: string, stroke: string, text: string, id: string, extra?: any) => {
  const w = extra?.w || 140;
  const h = extra?.h || 70;
  return {
    id,
    status: "published" as const,
    elements: [
      {
        id: `shape-${id}`, type, x: 0, y: 0, width: w, height: h,
        strokeColor: stroke, backgroundColor: bg, fillStyle: "solid",
        strokeWidth: 2, strokeStyle: extra?.strokeStyle || "solid",
        roughness: 0, opacity: 100, groupIds: [id], boundElements: [],
        angle: 0, seed: Math.floor(Math.random() * 10000), version: 1,
        versionNonce: 1, isDeleted: false, frameId: null, link: null, locked: false,
      },
      {
        id: `text-${id}`, type: "text", x: w / 2 - 50, y: h / 2 - 10, width: 100, height: 20,
        strokeColor: stroke, backgroundColor: "transparent", fillStyle: "solid",
        strokeWidth: 1, strokeStyle: "solid", roughness: 0, opacity: 100,
        groupIds: [id], text, fontSize: 14, fontFamily: 1,
        textAlign: "center", verticalAlign: "middle",
        angle: 0, seed: Math.floor(Math.random() * 10000), version: 1,
        versionNonce: 1, isDeleted: false, frameId: null, link: null, locked: false,
      },
    ] as any[],
  };
};

const buildLibrary = (stroke: string, bg: string): Record<DiagramMode, any[]> => ({
  ERD: [
    mkEl("rectangle", bg, stroke, "📋 Table", "erd-table"),
    mkEl("rectangle", bg, stroke, "🔑 Entity", "erd-entity"),
    mkEl("rectangle", bg, stroke, "🔗 Junction", "erd-junction", { w: 120, h: 60 }),
  ],
  Architecture: [
    mkEl("rectangle", "#1a1a2e", "#7c3aed", "🟢 NestJS API", "arch-nest", { w: 150, h: 70 }),
    mkEl("rectangle", "#0f172a", "#2563eb", "🐘 PostgreSQL", "arch-pg", { w: 150, h: 70 }),
    mkEl("rectangle", "#1e293b", "#0ea5e9", "🐳 Docker", "arch-docker", { w: 150, h: 70 }),
    mkEl("rectangle", "#1c1917", "#f97316", "⚛️ React UI", "arch-react", { w: 150, h: 70 }),
    mkEl("ellipse",   "#fef3c7", "#d97706", "👤 Actor",   "arch-actor",  { w: 100, h: 100 }),
  ],
  UseCase: [
    mkEl("ellipse",    bg, stroke,     "👤 Actor",    "uc-actor",   { w: 100, h: 100 }),
    mkEl("ellipse",    bg, "#0ea5e9",  "⚙️ Use Case", "uc-usecase", { w: 160, h: 70 }),
    mkEl("rectangle",  bg, "#16a34a",  "🖥 System",   "uc-system",  { w: 180, h: 80 }),
  ],
});

// ─── Metadata types ───────────────────────────────────
interface ElementMeta {
  componentName: string;
  apiMethod: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  dataType: string;
  isProtected: boolean;
  layer: "UI" | "API" | "DB" | "Actor" | "";
}

const defaultMeta = (): ElementMeta => ({
  componentName: "",
  apiMethod: "GET",
  dataType: "",
  isProtected: false,
  layer: "",
});

// ─── Modals ───────────────────────────────────────────
const InputModal: React.FC<{
  isOpen: boolean; title: string; placeholder?: string;
  confirmText?: string; onConfirm: (v: string) => void; onCancel: () => void;
}> = ({ isOpen, title, placeholder, confirmText = "Create", onConfirm, onCancel }) => {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (isOpen) { setValue(""); setTimeout(() => inputRef.current?.focus(), 100); }
  }, [isOpen]);
  if (!isOpen) return null;
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); if (value.trim()) onConfirm(value.trim()); };
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-sm bg-[var(--ide-bg-panel)] border border-[var(--ide-border-strong)] rounded-2xl shadow-2xl p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <h3 className="text-lg font-bold text-[var(--ide-text)]">{title}</h3>
          <input
            ref={inputRef} type="text" value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            className="w-full bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] rounded-xl px-4 py-3 text-sm text-[var(--ide-text)]"
            required
          />
          <div className="flex gap-3">
            <button type="button" onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-[var(--ide-border)] text-[var(--ide-text-secondary)] text-sm">Cancel</button>
            <button type="submit" disabled={!value.trim()} className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold disabled:opacity-40">{confirmText}</button>
          </div>
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
      <div className="relative bg-[var(--ide-bg-panel)] border border-red-500/30 rounded-2xl p-6 max-w-xs w-full">
        <h3 className="text-base font-bold text-[var(--ide-text)] mb-2">Delete Diagram?</h3>
        <p className="text-sm text-[var(--ide-text-secondary)] mb-4 truncate">"{name}"</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2 rounded-xl border border-[var(--ide-border)] text-sm text-[var(--ide-text-secondary)]">Cancel</button>
          <button onClick={onConfirm} className="flex-1 py-2 rounded-xl bg-red-500 text-white text-sm font-semibold">Delete</button>
        </div>
      </div>
    </div>
  );
};

const DiscardModal: React.FC<{ isOpen: boolean; onDiscard: () => void; onCancel: () => void }> = ({ isOpen, onDiscard, onCancel }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div className="relative bg-[var(--ide-bg-panel)] rounded-2xl p-6 border border-amber-500/30 max-w-xs w-full">
        <h3 className="font-bold text-[var(--ide-text)] mb-2">Unsaved Changes</h3>
        <p className="text-sm text-[var(--ide-text-secondary)] mb-4">You have unsaved changes. Discard them?</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2 rounded-xl border border-[var(--ide-border)] text-sm">Keep Editing</button>
          <button onClick={onDiscard} className="flex-1 py-2 rounded-xl bg-amber-500 text-white text-sm font-semibold">Discard</button>
        </div>
      </div>
    </div>
  );
};

// ─── Toast ─────────────────────────────────────────────
const Toast: React.FC<{ message: string | null; type?: "error" | "success" | "warn"; onDismiss: () => void }> = ({ message, type = "error", onDismiss }) => {
  useEffect(() => {
    if (message) { const t = setTimeout(onDismiss, 4000); return () => clearTimeout(t); }
  }, [message, onDismiss]);
  if (!message) return null;
  const styles: Record<string, string> = {
    error:   "bg-red-950/90 border-red-500/50 text-red-300",
    success: "bg-emerald-950/90 border-emerald-500/50 text-emerald-300",
    warn:    "bg-amber-950/90 border-amber-500/50 text-amber-300",
  };
  const icons: Record<string, string> = { error: "⚠️", success: "✅", warn: "🚨" };
  return (
    <div
      className={`fixed bottom-6 right-6 z-[300] max-w-sm px-5 py-3 rounded-2xl shadow-2xl border text-sm font-medium flex items-start gap-3 backdrop-blur-xl ${styles[type]}`}
      style={{ animation: "slideUp 0.3s ease-out" }}
    >
      <span className="text-base mt-0.5">{icons[type]}</span>
      <span className="flex-1 leading-snug">{message}</span>
      <button onClick={onDismiss} className="opacity-60 hover:opacity-100 text-xs mt-0.5">✕</button>
    </div>
  );
};

// ─── Semantic Metadata Sidebar ────────────────────────
const MetadataSidebar: React.FC<{
  elementId: string | null;
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}> = ({ elementId, excalidrawAPI }) => {
  const [meta, setMeta] = useState<ElementMeta>(defaultMeta());

  useEffect(() => {
    if (!elementId || !excalidrawAPI) { setMeta(defaultMeta()); return; }
    const el = excalidrawAPI.getSceneElements().find((e: any) => e.id === elementId);
    if (el?.customData) setMeta({ ...defaultMeta(), ...el.customData });
    else setMeta(defaultMeta());
  }, [elementId, excalidrawAPI]);

  const commit = (updates: Partial<ElementMeta>) => {
    const merged = { ...meta, ...updates };
    setMeta(merged);
    if (!excalidrawAPI || !elementId) return;
    const els = excalidrawAPI.getSceneElements();
    const newEls = els.map((e: any) =>
      e.id === elementId ? { ...e, customData: { ...(e.customData || {}), ...merged } } : e
    );
    excalidrawAPI.updateScene({ elements: newEls });
  };

  const inputCls = "w-full text-xs px-3 py-2 rounded-lg bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] text-[var(--ide-text)] focus:outline-none focus:border-indigo-500 transition-colors";
  const labelCls = "block text-[10px] font-bold uppercase tracking-wider mb-1 text-[var(--ide-text-secondary)]";

  return (
    <div style={{ width: 260, background: "var(--ide-bg-panel)", borderLeft: "1px solid var(--ide-border)", height: "100%", overflowY: "auto", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid var(--ide-border)" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ide-text-secondary)", marginBottom: 2 }}>
          Semantic Metadata
        </div>
        <div style={{ fontSize: 12, color: "var(--ide-text)" }}>
          {elementId ? "Editing selected element" : "No element selected"}
        </div>
      </div>

      {!elementId ? (
        <div style={{ padding: 16, flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, textAlign: "center" }}>
          <div style={{ fontSize: 32 }}>🖱️</div>
          <p style={{ fontSize: 12, color: "var(--ide-text-secondary)", lineHeight: 1.5 }}>
            Click on a rectangle or ellipse to inspect and edit its semantic metadata.
          </p>
        </div>
      ) : (
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Component Name */}
          <div>
            <label className={labelCls}>Component Name</label>
            <input
              className={inputCls}
              value={meta.componentName}
              onChange={(e) => commit({ componentName: e.target.value })}
              placeholder="e.g. UserService"
            />
          </div>

          {/* Layer */}
          <div>
            <label className={labelCls}>Architectural Layer</label>
            <select
              className={inputCls}
              value={meta.layer}
              onChange={(e) => commit({ layer: e.target.value as any })}
            >
              {["", "UI", "API", "DB", "Actor"].map((l) => (
                <option key={l} value={l}>{l || "— Select Layer —"}</option>
              ))}
            </select>
          </div>

          {/* API Method */}
          <div>
            <label className={labelCls}>API Method</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {(["GET", "POST", "PUT", "DELETE", "PATCH"] as const).map((m) => {
                const colors: Record<string, string> = {
                  GET: "#16a34a", POST: "#2563eb", PUT: "#d97706", DELETE: "#dc2626", PATCH: "#7c3aed"
                };
                const active = meta.apiMethod === m;
                return (
                  <button
                    key={m}
                    onClick={() => commit({ apiMethod: m })}
                    style={{
                      fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 6,
                      border: `1.5px solid ${active ? colors[m] : "var(--ide-border)"}`,
                      background: active ? `${colors[m]}22` : "transparent",
                      color: active ? colors[m] : "var(--ide-text-secondary)",
                      cursor: "pointer", letterSpacing: "0.05em",
                    }}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Data Type */}
          <div>
            <label className={labelCls}>Data Type / Schema</label>
            <input
              className={inputCls}
              value={meta.dataType}
              onChange={(e) => commit({ dataType: e.target.value })}
              placeholder="e.g. UserDTO, { id: string }"
            />
          </div>

          {/* Protected */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, background: "var(--ide-bg-elevated)", border: "1px solid var(--ide-border)", cursor: "pointer" }} onClick={() => commit({ isProtected: !meta.isProtected })}>
            <div style={{
              width: 32, height: 18, borderRadius: 9, position: "relative",
              background: meta.isProtected ? "#4f46e5" : "var(--ide-border)",
              transition: "background 0.2s",
            }}>
              <div style={{
                position: "absolute", top: 2, left: meta.isProtected ? 16 : 2,
                width: 14, height: 14, borderRadius: "50%", background: "#fff",
                transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.4)"
              }} />
            </div>
            <span style={{ fontSize: 12, color: "var(--ide-text)", fontWeight: 600, userSelect: "none" }}>
              {meta.isProtected ? "🔒 Protected Route" : "🔓 Public Route"}
            </span>
          </div>

          {/* Summary Preview */}
          {meta.componentName && (
            <div style={{ borderRadius: 10, background: "#1e1b4b22", border: "1px solid #4f46e544", padding: "10px 12px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#818cf8", marginBottom: 6 }}>Preview</div>
              <code style={{ fontSize: 11, color: "#a5b4fc", display: "block", lineHeight: 1.7 }}>
                {`@${meta.layer || "Component"}("/${meta.componentName.toLowerCase()}")`}<br />
                {`${meta.apiMethod} → ${meta.dataType || "any"}`}<br />
                {meta.isProtected ? "@UseGuard(JwtGuard)" : "// No Auth"}
              </code>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Main Page ─────────────────────────────────────────
const DiagramsPage: React.FC = () => {
  const api = useApi();
  const { theme } = useTheme();

  // State
  const [diagrams, setDiagrams] = useState<DiagramEntry[]>([]);
  const [selectedDiagram, setSelectedDiagram]  = useState<string | null>(null);
  const [editingDiagramName, setEditingDiagramName] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [currentMode, setCurrentMode] = useState<DiagramMode>("Architecture");
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  // Modals / Toast
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteTarget, setDeleteTarget]   = useState<string | null>(null);
  const [discardCallback, setDiscardCallback] = useState<(() => void) | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType]   = useState<"error" | "success" | "warn">("error");

  // Excalidraw
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);
  const saveTimeoutRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lintCooldownRef  = useRef<Set<string>>(new Set());
  // Guard: prevent doSelectDiagram from firing again just because mode changed
  const apiReadyRef      = useRef(false);
  // Always-current ref to selectedDiagram so the API callback reads the latest value
  const selectedDiagramRef = useRef<string | null>(null);

  const showToast = useCallback((msg: string, type: "error" | "success" | "warn" = "error") => {
    setToastMessage(msg);
    setToastType(type);
  }, []);

  // Library items — memoized so Excalidraw doesn't see new references on every render
  const stroke = theme === "dark" ? "#e2e8f0" : "#0f172a";
  const bg     = theme === "dark" ? "#1e293b" : "#f8fafc";
  const library = useMemo(() => buildLibrary(stroke, bg), [theme]);


  // ── Load diagrams ────────────────────────────────────
  useEffect(() => {
    loadDiagrams();
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, []);

  const loadDiagrams = async () => {
    try { setDiagrams(await api.listDiagrams()); } catch {}
  };

  // ── CRUD ─────────────────────────────────────────────
  const handleCreate = async (name: string) => {
    try {
      const fileName = name.endsWith(".excalidraw") ? name : `${name}-${Date.now()}.excalidraw`;
      await api.createDiagram(fileName);
      await loadDiagrams();
      doSelectDiagram(fileName);
      setShowCreateModal(false);
      showToast("Diagram created", "success");
    } catch { showToast("Failed to create diagram"); }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await api.deleteDiagram(deleteTarget);
      if (selectedDiagram === deleteTarget) setSelectedDiagram(null);
      await loadDiagrams();
      showToast("Deleted", "success");
      setDeleteTarget(null);
    } catch { showToast("Failed to delete"); }
  };

  const doSelectDiagram = async (name: string) => {
    // Reset the API-ready guard so the new diagram's content is loaded
    apiReadyRef.current = false;
    selectedDiagramRef.current = name;
    setSelectedDiagram(name);
    setEditingDiagramName(name);
    setIsDirty(false);
    setSelectedElementId(null);
    if (excalidrawAPI) excalidrawAPI.updateScene({ elements: [] });
    try {
      const content = await api.readDiagram(name);
      if (content && excalidrawAPI) {
        const data = typeof content === "string" ? JSON.parse(content) : content;
        excalidrawAPI.updateScene({ elements: data.elements || [], appState: data.appState });
      }
    } catch (e) {
      console.error("Error loading diagram", e);
      showToast("Failed to load diagram data");
    }
  };

  const selectDiagram = (name: string) => {
    if (isDirty) { setDiscardCallback(() => () => doSelectDiagram(name)); return; }
    doSelectDiagram(name);
  };

  // ── Save ─────────────────────────────────────────────
  const handleSave = async (isAutoSave: boolean) => {
    if (!excalidrawAPI || !selectedDiagram) return;
    try {
      const els  = excalidrawAPI.getSceneElements();
      const json = serializeAsJSON(els, excalidrawAPI.getAppState(), excalidrawAPI.getFiles(), "local");
      await api.saveDiagram(selectedDiagram, json);
      setIsDirty(false);
      if (!isAutoSave) showToast("Saved ✓", "success");
    } catch { showToast("Save failed"); }
  };

  const handleRenameBlur = async () => {
    if (!selectedDiagram || editingDiagramName === selectedDiagram) return;
    try {
      const newName = editingDiagramName.endsWith(".excalidraw") ? editingDiagramName : editingDiagramName + ".excalidraw";
      const els  = excalidrawAPI!.getSceneElements();
      const json = serializeAsJSON(els, excalidrawAPI!.getAppState(), excalidrawAPI!.getFiles(), "local");
      await api.saveDiagram(newName, json);
      await api.deleteDiagram(selectedDiagram);
      setSelectedDiagram(newName);
      await loadDiagrams();
      showToast("Renamed", "success");
    } catch { setEditingDiagramName(selectedDiagram!); showToast("Rename failed"); }
  };

  // ── Architectural Linter ──────────────────────────────
  const lintConnections = useCallback((elements: readonly any[]) => {
    let hasUpdates = false;
    const newEls = elements.map((el) => {
      if (el.type !== "arrow" || !el.startBinding || !el.endBinding) return el;

      const startEl = elements.find((e: any) => e.id === el.startBinding?.elementId);
      const endEl   = elements.find((e: any) => e.id === el.endBinding?.elementId);
      if (!startEl || !endEl) return el;

      const startMeta: ElementMeta = startEl.customData || {};
      const endMeta:   ElementMeta = endEl.customData   || {};
      const startName = (startMeta.componentName || "").toLowerCase();
      const endName   = (endMeta.componentName   || "").toLowerCase();
      const startLayer = startMeta.layer || "";
      const endLayer   = endMeta.layer   || "";

      const isActor = startLayer === "Actor" || startName.includes("actor") || startName.includes("stick figure") || startName.includes("user");
      const isDB    = endLayer   === "DB"    || endName.includes("database")|| endName.includes("postgresql") || endName.includes("db") || endName.includes("postgres");

      if (isActor && isDB) {
        const errKey = el.id;
        if (!lintCooldownRef.current.has(errKey)) {
          lintCooldownRef.current.add(errKey);
          setTimeout(() => lintCooldownRef.current.delete(errKey), 5000);
          showToast("🚨 Architectural Error: Actors cannot bypass the API layer.", "warn");
        }
        if (el.strokeColor !== "#ef4444") {
          hasUpdates = true;
          return { ...el, strokeColor: "#ef4444", strokeWidth: 3, customData: { ...el.customData, lintError: "actor-db-bypass" } };
        }
        return el;
      }

      // No error — restore if was linted before
      if (el.customData?.lintError) {
        hasUpdates = true;
        return { ...el, strokeColor: theme === "dark" ? "#94a3b8" : "#334155", strokeWidth: 1.5, customData: { ...el.customData, lintError: null } };
      }
      return el;
    });

    if (hasUpdates && excalidrawAPI) {
      setTimeout(() => excalidrawAPI.updateScene({ elements: newEls }), 0);
    }
  }, [excalidrawAPI, showToast, theme]);

  // ── onChange handler ──────────────────────────────────
  const onChange = useCallback((elements: readonly any[], _appState: AppState) => {
    setIsDirty(true);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => handleSave(true), 1500);
    lintConnections(elements);
  }, [lintConnections]);

  // ── Pointer → selection tracking ─────────────────────
  const onPointerUpdate = useCallback((_payload: any) => {
    if (!excalidrawAPI) return;
    const appState = excalidrawAPI.getAppState();
    const selIds = Object.keys(appState.selectedElementIds || {}).filter((k) => appState.selectedElementIds[k]);
    if (selIds.length === 1) {
      const el = excalidrawAPI.getSceneElements().find((e: any) => e.id === selIds[0]);
      if (el && (el.type === "rectangle" || el.type === "ellipse" || el.type === "diamond")) {
        setSelectedElementId((prev) => (prev !== selIds[0] ? selIds[0] : prev));
        return;
      }
    }
    setSelectedElementId((prev) => (prev !== null ? null : prev));
  }, [excalidrawAPI]);

  // ── Generate Code ─────────────────────────────────────
  const handleGenerateCode = () => {
    if (!excalidrawAPI) return;
    const elements = excalidrawAPI.getSceneElements();
    const result = {
      components: [] as any[],
      connections: [] as any[],
      lintErrors: [] as any[],
    };
    elements.forEach((el: any) => {
      if (el.type === "rectangle" || el.type === "ellipse") {
        result.components.push({
          id: el.id,
          type: el.type,
          ...el.customData,
        });
      } else if (el.type === "arrow" && el.startBinding && el.endBinding) {
        const from = elements.find((e: any) => e.id === el.startBinding?.elementId);
        const to   = elements.find((e: any) => e.id === el.endBinding?.elementId);
        result.connections.push({
          from: from?.customData?.componentName || from?.id || "?",
          to:   to?.customData?.componentName   || to?.id   || "?",
          hasLintError: !!el.customData?.lintError,
        });
        if (el.customData?.lintError) result.lintErrors.push(el.id);
      }
    });
    console.log("=== AKASHA GENERATED CODE ENTITIES ===");
    console.log(JSON.stringify(result, null, 2));
    showToast(`Exported ${result.components.length} components, ${result.connections.length} connections`, "success");
  };

  // ── Mode selector styles ──────────────────────────────
  const modeColors: Record<DiagramMode, string> = {
    Architecture: "#7c3aed",
    ERD: "#2563eb",
    UseCase: "#0ea5e9",
  };

  // ── Render ────────────────────────────────────────────
  return (
    <div className="flex flex-1 overflow-hidden h-full bg-[var(--ide-bg)]">

      {/* ── Left Sidebar: Diagram List ── */}
      <div className="w-60 bg-[var(--ide-sidebar-bg)] border-r border-[var(--ide-border)] flex flex-col shrink-0">
        <div className="h-9 flex items-center px-4 font-bold text-xs text-[var(--ide-text-secondary)] uppercase tracking-widest bg-[var(--ide-chrome)] border-b border-[var(--ide-border)]">
          <span className="flex-1">Diagrams</span>
          <button
            onClick={() => setShowCreateModal(true)}
            className="p-1 rounded hover:bg-[var(--ide-border)] text-[var(--ide-text-secondary)] hover:text-[var(--ide-primary)] transition-colors"
            title="New Diagram"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {diagrams.length === 0 && (
            <div className="text-center text-xs text-[var(--ide-text-muted)] py-8 px-4">
              <div className="text-3xl mb-2">📐</div>
              No diagrams yet.<br />Click <strong>+</strong> to create one.
            </div>
          )}
          {diagrams.map((d) => (
            <div
              key={d.path}
              onClick={() => selectDiagram(d.name)}
              className={`group flex items-center px-3 py-2 text-xs rounded-lg cursor-pointer select-none transition-colors ${
                selectedDiagram === d.name
                  ? "bg-indigo-600/20 text-indigo-400 font-semibold"
                  : "text-[var(--ide-text-secondary)] hover:bg-[var(--ide-bg-elevated)] hover:text-[var(--ide-text)]"
              }`}
            >
              <span className="mr-2 text-sm">📄</span>
              <span className="truncate flex-1">{d.name.replace(/\.excalidraw$/, "")}</span>
              <button
                onClick={(e) => { e.stopPropagation(); setDeleteTarget(d.name); }}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:text-red-400 transition-all"
                title="Delete"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Main Editor Area ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Toolbar */}
        {selectedDiagram && (
          <div style={{
            height: 44, display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "0 12px", gap: 8,
            background: "var(--ide-chrome)", borderBottom: "1px solid var(--ide-border)", zIndex: 50, flexShrink: 0,
          }}>
            {/* Left: Name + dirty indicator */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
              <input
                type="text"
                value={editingDiagramName.replace(/\.excalidraw$/, "")}
                onChange={(e) => setEditingDiagramName(e.target.value + ".excalidraw")}
                onBlur={handleRenameBlur}
                style={{
                  background: "transparent", border: "none", outline: "none",
                  fontWeight: 600, fontSize: 13, color: "var(--ide-text)",
                  minWidth: 0, flexShrink: 1, maxWidth: 220,
                }}
              />
              {isDirty && <span style={{ fontSize: 10, color: "#f59e0b", fontWeight: 700 }}>● UNSAVED</span>}
            </div>

            {/* Center: Mode Selector */}
            <div style={{ display: "flex", gap: 4 }}>
              {(["Architecture", "ERD", "UseCase"] as DiagramMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setCurrentMode(m)}
                  style={{
                    fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 8,
                    border: `1.5px solid ${currentMode === m ? modeColors[m] : "var(--ide-border)"}`,
                    background: currentMode === m ? `${modeColors[m]}22` : "transparent",
                    color: currentMode === m ? modeColors[m] : "var(--ide-text-secondary)",
                    cursor: "pointer", letterSpacing: "0.04em", transition: "all 0.15s",
                  }}
                >
                  {m === "Architecture" ? "🏗 Arch" : m === "ERD" ? "🗃 ERD" : "👤 UseCase"}
                </button>
              ))}
            </div>

            {/* Right: Actions */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                onClick={() => handleSave(false)}
                style={{
                  fontSize: 11, fontWeight: 600, padding: "4px 12px", borderRadius: 8,
                  background: "#15803d22", border: "1.5px solid #16a34a66",
                  color: "#4ade80", cursor: "pointer",
                }}
              >
                💾 Save
              </button>
              <button
                onClick={handleGenerateCode}
                style={{
                  fontSize: 11, fontWeight: 600, padding: "4px 12px", borderRadius: 8,
                  background: "#4f46e522", border: "1.5px solid #7c3aed66",
                  color: "#a78bfa", cursor: "pointer",
                }}
              >
                ⚡ Export
              </button>
              <button
                onClick={() => setShowAnalysis(!showAnalysis)}
                style={{
                  fontSize: 11, fontWeight: 600, padding: "4px 12px", borderRadius: 8,
                  background: showAnalysis ? "#0ea5e922" : "transparent",
                  border: `1.5px solid ${showAnalysis ? "#0ea5e9" : "var(--ide-border)"}`,
                  color: showAnalysis ? "#38bdf8" : "var(--ide-text-secondary)",
                  cursor: "pointer",
                }}
              >
                🧠 Akasha
              </button>
            </div>
          </div>
        )}

        {/* Canvas or empty state */}
        {!selectedDiagram ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-[var(--ide-text-secondary)]">
            <div style={{ fontSize: 64 }}>📐</div>
            <p style={{ fontSize: 14, fontWeight: 600 }}>Select or create a diagram to begin</p>
            <button
              onClick={() => setShowCreateModal(true)}
              style={{
                fontSize: 13, fontWeight: 600, padding: "8px 20px", borderRadius: 10,
                background: "#4f46e5", color: "#fff", border: "none", cursor: "pointer",
              }}
            >
              + New Diagram
            </button>
          </div>
        ) : (
          <div style={{ flex: 1, display: "flex", minHeight: 0, position: "relative" }}>
            {/* Excalidraw canvas */}
            <div style={{ flex: 1, position: "relative", minWidth: 0 }}>
              <ErrorBoundary
                fallback={<div className="text-red-400 text-sm p-4">Failed to load Excalidraw editor.</div>}
              >
                <Suspense
                  fallback={
                    <div className="absolute inset-0 flex items-center justify-center bg-[var(--ide-bg)]">
                      <div className="text-sm text-[var(--ide-text-secondary)]">Loading canvas…</div>
                    </div>
                  }
                >
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
                    {/* @ts-ignore */}
                    <Excalidraw
                      excalidrawAPI={(apiRef: any) => {
                        setExcalidrawAPI(apiRef);
                        // Only load diagram content the first time the API is set for this
                        // diagram. Subsequent calls happen when libraryItems/mode changes —
                        // we must NOT reload or it clears the user's drawings.
                        if (!apiReadyRef.current && selectedDiagramRef.current) {
                          apiReadyRef.current = true;
                          setTimeout(() => doSelectDiagram(selectedDiagramRef.current!), 100);
                        }
                      }}
                      onChange={onChange}
                      onPointerUpdate={onPointerUpdate}
                      theme={theme}
                      // @ts-ignore
                      libraryItems={library[currentMode]}
                      UIOptions={{
                        canvasActions: {
                          saveToActiveFile: false,
                          loadScene: false,
                          export: false,
                          toggleTheme: false,
                        },
                      }}
                      initialData={{
                        appState: {
                          currentItemStrokeColor: theme === "dark" ? "#e2e8f0" : "#0f172a",
                          currentItemBackgroundColor: "transparent",
                          currentItemFillStyle: "solid",
                          currentItemStrokeWidth: 2,
                          gridSize: 20,
                          viewBackgroundColor: theme === "dark" ? "#0f172a" : "#f8fafc",
                        },
                      }}
                    />
                  </div>
                </Suspense>
              </ErrorBoundary>
            </div>

            {/* Metadata Sidebar */}
            <MetadataSidebar elementId={selectedElementId} excalidrawAPI={excalidrawAPI} />
          </div>
        )}
      </div>

      {/* Analysis Panel */}
      {showAnalysis && selectedDiagram && (
        <AnalysisPanel onAnalyze={() => {}} result={null} loading={false} error={null} />
      )}

      {/* Modals */}
      <InputModal
        isOpen={showCreateModal}
        title="New Diagram"
        placeholder="e.g. auth-flow"
        onConfirm={handleCreate}
        onCancel={() => setShowCreateModal(false)}
      />
      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        name={deleteTarget!}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
      <DiscardModal
        isOpen={!!discardCallback}
        onDiscard={() => { discardCallback!(); setDiscardCallback(null); }}
        onCancel={() => setDiscardCallback(null)}
      />
      <Toast message={toastMessage} type={toastType} onDismiss={() => setToastMessage(null)} />
    </div>
  );
};

export default DiagramsPage;
