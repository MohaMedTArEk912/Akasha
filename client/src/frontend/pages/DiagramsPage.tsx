import React, { useRef, useState, useEffect, Suspense, useCallback, useMemo } from "react";
import useApi, { DiagramEntry } from "../hooks/useApi";
import { useTheme } from "../context/ThemeContext";
import "@excalidraw/excalidraw/index.css";
import {
  loadGlobalLibraryItems,
  subscribeToLibrarySync,
  handleAddLibraryFromUrlIfPresent,
} from "../utils/excalidrawLibrarySync";
import GlassSelect from "../components/ui/GlassSelect";

type AppState = any;
type ExcalidrawImperativeAPI = any;
type DiagramMode = "ERD" | "UseCase" | "Architecture";

// ─── Lazy Excalidraw ────────────────────────────────
const Excalidraw = React.lazy(() =>
  import("@excalidraw/excalidraw").then((m) => ({ default: m.Excalidraw }))
);

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
        <div className="flex flex-col items-center justify-center h-full gap-4 text-white/70">
          {this.props.fallback}
          {this.state.error && (
            <code className="text-xs text-white/40 bg-white/5 px-3 py-1 rounded border border-white/10">
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
    mkEl("rectangle", bg, stroke, "Table", "erd-table"),
    mkEl("rectangle", bg, stroke, "Entity", "erd-entity"),
    mkEl("rectangle", bg, stroke, "Junction", "erd-junction", { w: 120, h: 60 }),
  ],
  Architecture: [
    mkEl("rectangle", "rgba(255,255,255,0.05)", stroke, "NestJS API", "arch-nest", { w: 150, h: 70 }),
    mkEl("rectangle", "rgba(255,255,255,0.03)", stroke, "PostgreSQL", "arch-pg", { w: 150, h: 70 }),
    mkEl("rectangle", "rgba(255,255,255,0.05)", stroke, "Docker", "arch-docker", { w: 150, h: 70 }),
    mkEl("rectangle", "rgba(255,255,255,0.03)", stroke, "React UI", "arch-react", { w: 150, h: 70 }),
    mkEl("ellipse",   "rgba(255,255,255,0.05)", stroke, "Actor",   "arch-actor",  { w: 100, h: 100 }),
  ],
  UseCase: [
    mkEl("ellipse",    bg, stroke,     "Actor",    "uc-actor",   { w: 100, h: 100 }),
    mkEl("ellipse",    bg, stroke,  "Use Case", "uc-usecase", { w: 160, h: 70 }),
    mkEl("rectangle",  bg, stroke,  "System",   "uc-system",  { w: 180, h: 80 }),
  ],
});

// ─── Library Persistence Helpers ────────────────────────
const LIBRARY_STORAGE_PREFIX = "akasha_diagram_library_";

const getLibraryKey = (diagramName: string) => `${LIBRARY_STORAGE_PREFIX}${diagramName}`;

const loadUserLibrary = (diagramName: string): any[] => {
  try {
    const globalItems = loadGlobalLibraryItems();
    const raw = localStorage.getItem(getLibraryKey(diagramName));
    const diagramItems = raw ? JSON.parse(raw) : [];
    const existingIds = new Set((Array.isArray(diagramItems) ? diagramItems : []).map((i: any) => i.id));
    return [...globalItems.filter((g: any) => !existingIds.has(g.id)), ...(Array.isArray(diagramItems) ? diagramItems : [])];
  } catch {
    return loadGlobalLibraryItems();
  }
};

const saveUserLibrary = (diagramName: string, items: any[]) => {
  try {
    // Only save items the user added (not our presets)
    const userItems = items.filter((item: any) => {
      const id = item?.id || "";
      return !id.startsWith("erd-") && !id.startsWith("arch-") && !id.startsWith("uc-");
    });
    localStorage.setItem(getLibraryKey(diagramName), JSON.stringify(userItems));
  } catch { /* ignore quota errors */ }
};

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
            <button type="submit" disabled={!value.trim()} className="flex-1 py-2.5 rounded-xl bg-white text-black text-sm font-semibold disabled:opacity-40">{confirmText}</button>
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
      <div className="relative bg-[var(--ide-bg-panel)] border border-white/20 rounded-2xl p-6 max-w-xs w-full">
        <h3 className="text-base font-bold text-[var(--ide-text)] mb-2">Delete Diagram?</h3>
        <p className="text-sm text-[var(--ide-text-secondary)] mb-4 truncate">"{name}"</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2 rounded-xl border border-[var(--ide-border)] text-sm text-[var(--ide-text-secondary)]">Cancel</button>
          <button onClick={onConfirm} className="flex-1 py-2 rounded-xl bg-white text-black text-sm font-semibold">Delete</button>
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
      <div className="relative bg-[var(--ide-bg-panel)] rounded-2xl p-6 border border-white/20 max-w-xs w-full">
        <h3 className="font-bold text-[var(--ide-text)] mb-2">Unsaved Changes</h3>
        <p className="text-sm text-[var(--ide-text-secondary)] mb-4">You have unsaved changes. Discard them?</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2 rounded-xl border border-[var(--ide-border)] text-sm">Keep Editing</button>
          <button onClick={onDiscard} className="flex-1 py-2 rounded-xl bg-white text-black text-sm font-semibold">Discard</button>
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
    error:   "bg-white/10 border-white/20 text-white",
    success: "bg-white/10 border-white/20 text-white",
    warn:    "bg-white/10 border-white/20 text-white",
  };
  const labels: Record<string, string> = { error: "ERROR", success: "SUCCESS", warn: "NOTICE" };
  return (
    <div
      className={`fixed bottom-6 right-6 z-[300] max-w-sm px-5 py-3 rounded-2xl shadow-2xl border text-sm font-medium flex items-start gap-3 backdrop-blur-xl ${styles[type]}`}
      style={{ animation: "slideUp 0.3s ease-out" }}
    >
      <span className="text-[10px] font-black uppercase tracking-widest mt-1 opacity-50">{labels[type]}</span>
      <span className="flex-1 leading-snug">{message}</span>
      <button onClick={onDismiss} className="opacity-60 hover:opacity-100 text-xs mt-0.5">✕</button>
    </div>
  );
};

// ─── Semantic Metadata Sidebar ────────────────────────
const MetadataSidebar: React.FC<{
  elementId: string | null;
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  onClose?: () => void;
}> = ({ elementId, excalidrawAPI, onClose }) => {
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
      <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid var(--ide-border)", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ide-text-secondary)", marginBottom: 2 }}>
            Semantic Metadata
          </div>
          <div style={{ fontSize: 12, color: "var(--ide-text)" }}>
            {elementId ? "Editing selected element" : "No element selected"}
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "var(--ide-text-secondary)", cursor: "pointer", padding: "4px 8px", borderRadius: 6, lineHeight: 1, fontWeight: "bold" }}
            title="Close metadata panel"
          >
            ✕
          </button>
        )}
      </div>

      {!elementId ? (
        <div style={{ padding: 16, flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, textAlign: "center" }}>
          <div style={{ fontSize: 10, fontWeight: "black", opacity: 0.2, textTransform: "uppercase", letterSpacing: "0.1em" }}>Selection Required</div>
          <p style={{ fontSize: 12, color: "var(--ide-text-secondary)", lineHeight: 1.5 }}>
            Select an element to edit semantic metadata.
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
            <GlassSelect
              value={meta.layer || ""}
              onChange={(val) => commit({ layer: val as any })}
              options={[
                { value: "", label: "— Select Layer —" },
                { value: "UI", label: "UI" },
                { value: "API", label: "API" },
                { value: "DB", label: "DB" },
                { value: "Actor", label: "Actor" },
              ]}
            />
          </div>

          {/* API Method */}
          <div>
            <label className={labelCls}>API Method</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {(["GET", "POST", "PUT", "DELETE", "PATCH"] as const).map((m) => {
                const active = meta.apiMethod === m;
                return (
                  <button
                    key={m}
                    onClick={() => commit({ apiMethod: m })}
                    style={{
                      fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 6,
                      border: `1.5px solid ${active ? "white" : "var(--ide-border)"}`,
                      background: active ? "rgba(255,255,255,0.1)" : "transparent",
                      color: active ? "white" : "var(--ide-text-secondary)",
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
              background: meta.isProtected ? "white" : "var(--ide-border)",
              transition: "background 0.2s",
            }}>
              <div style={{
                position: "absolute", top: 2, left: meta.isProtected ? 16 : 2,
                width: 14, height: 14, borderRadius: "50%", background: meta.isProtected ? "black" : "#fff",
                transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.4)"
              }} />
            </div>
            <span style={{ fontSize: 12, color: "var(--ide-text)", fontWeight: 600, userSelect: "none" }}>
              {meta.isProtected ? "Protected Route" : "Public Route"}
            </span>
          </div>

          {/* Summary Preview */}
          {meta.componentName && (
            <div style={{ borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", padding: "10px 12px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>Preview</div>
              <code style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", display: "block", lineHeight: 1.7 }}>
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
  const [diagramModesData, setDiagramModesData] = useState<Record<DiagramMode, { elements: any[]; appState?: any }>>({
    Architecture: { elements: [] },
    ERD: { elements: [] },
    UseCase: { elements: [] }
  });
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [showMetadataPanel, setShowMetadataPanel] = useState(false);

  // Modals / Toast
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteTarget, setDeleteTarget]   = useState<string | null>(null);
  const [discardCallback, setDiscardCallback] = useState<(() => void) | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType]   = useState<"error" | "success" | "warn">("error");

  // Excalidraw
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);
  const [userLibraryItems, setUserLibraryItems] = useState<any[]>([]);
  const saveTimeoutRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lintCooldownRef  = useRef<Set<string>>(new Set());
  // Guard: prevent doSelectDiagram from firing again just because mode changed
  const apiReadyRef      = useRef(false);
  // Always-current ref to selectedDiagram so the API callback reads the latest value
  const selectedDiagramRef = useRef<string | null>(null);
  const libFileInputRef = useRef<HTMLInputElement>(null);

  const showToast = useCallback((msg: string, type: "error" | "success" | "warn" = "error") => {
    setToastMessage(msg);
    setToastType(type);
  }, []);

  // Library items — memoized so Excalidraw doesn't see new references on every render
  const stroke = theme === "dark" ? "#e2e8f0" : "#0f172a";
  const bg     = theme === "dark" ? "#1e293b" : "#f8fafc";
  const presetLibrary = useMemo(() => buildLibrary(stroke, bg), [theme]);

  // Merged library: preset items for current mode + user-saved items
  const mergedLibrary = useMemo(() => {
    const presetIds = new Set(presetLibrary[currentMode].map((item: any) => item.id));
    const uniqueUser = userLibraryItems.filter((item: any) => !presetIds.has(item?.id));
    return [...presetLibrary[currentMode], ...uniqueUser];
  }, [presetLibrary, currentMode, userLibraryItems]);


  // ── Load diagrams and listen for library sync ──────────────
  useEffect(() => {
    loadDiagrams();

    // Check if this window was opened with #addLibrary=<url>
    void handleAddLibraryFromUrlIfPresent();

    // Subscribe to library synchronization events from cross-tab or opener
    const unsubscribe = subscribeToLibrarySync((newItems) => {
      setUserLibraryItems((prev) => {
        const existingIds = new Set(prev.map((i: any) => i.id));
        return [...prev, ...newItems.filter((i: any) => !existingIds.has(i.id))];
      });

      if (selectedDiagramRef.current) {
        saveUserLibrary(selectedDiagramRef.current, newItems);
      }

      if (excalidrawAPI?.updateLibrary) {
        excalidrawAPI.updateLibrary({
          libraryItems: newItems,
          merge: true,
          prompt: false,
        });

        // Automatically open the library sidebar so the user can immediately see the new items!
        try {
          excalidrawAPI.updateScene({
            appState: { openSidebar: { name: "library" } },
          });
        } catch {}
      }

      showToast("Library successfully added to Excalidraw!", "success");
    });

    return () => {
      unsubscribe();
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [excalidrawAPI, showToast]);

  // ── Auto-select first diagram if none selected ───────
  useEffect(() => {
    if (!selectedDiagram && diagrams.length > 0 && diagrams[0]?.name) {
      doSelectDiagram(diagrams[0]!.name);
    }
  }, [diagrams]);

  // ── Listen for cross-page navigation events ──────────
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.diagramName) {
        // Navigate to this diagram from wherever in the app
        const target = detail.diagramName;
        // Check if this diagram exists
        const exists = diagrams.some(d => d.name === target);
        if (exists) {
          doSelectDiagram(target);
        } else {
          showToast(`Diagram "${target}" not found`, "warn");
        }
      }
    };
    window.addEventListener("akasha:open-diagram", handler);
    return () => window.removeEventListener("akasha:open-diagram", handler);
  }, [diagrams]);

  const loadDiagrams = async () => {
    try { setDiagrams(await api.listDiagrams()); } catch {}
  };

  // ── CRUD ─────────────────────────────────────────────
  const handleCreate = async (name: string) => {
    try {
      const fileName = name.endsWith(".excalidraw") ? name : `${name}.excalidraw`;
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
      if (selectedDiagram === deleteTarget) {
        setSelectedDiagram(null);
      }
      selectedDiagramRef.current = null;
      apiReadyRef.current = false;
      await loadDiagrams();
      showToast("Deleted", "success");
      setDeleteTarget(null);
    } catch { showToast("Failed to delete"); }
  };

  const doSelectDiagram = async (name: string, apiInstance?: any) => {
    const activeAPI = apiInstance || excalidrawAPI;
    // Reset the API-ready guard so the new diagram's content is loaded
    apiReadyRef.current = false;
    selectedDiagramRef.current = name;
    setSelectedDiagram(name);
    setEditingDiagramName(name);
    setIsDirty(false);
    setSelectedElementId(null);

    // Load user-saved library items for this diagram
    setUserLibraryItems(loadUserLibrary(name));

    let loadedModesData: Record<DiagramMode, { elements: any[]; appState?: any }> = {
      Architecture: { elements: [] },
      ERD: { elements: [] },
      UseCase: { elements: [] },
    };

    try {
      const content = await api.readDiagram(name);
      if (content) {
        let data: any = null;
        try {
          data = typeof content === "string" ? JSON.parse(content) : content;
        } catch {
          data = null;
        }
        if (data) {
          if (data.modes) {
            loadedModesData = data.modes;
          } else if (data.elements) {
            loadedModesData.Architecture = {
              elements: data.elements || [],
              appState: data.appState || {},
            };
          }
        }
      }
    } catch (e) {
      console.warn("Diagram not yet initialized on server, starting empty:", e);
    }

    setDiagramModesData(loadedModesData);

    if (activeAPI) {
      const activeScene = loadedModesData[currentMode] || { elements: [] };
      activeAPI.updateScene({
        elements: activeScene.elements,
        appState: activeScene.appState,
      });
    }
  };

  const selectDiagram = (name: string) => {
    if (isDirty) { setDiscardCallback(() => () => doSelectDiagram(name)); return; }
    doSelectDiagram(name);
  };

  // ── Mode Switcher ────────────────────────────────────
  const handleModeChange = (newMode: DiagramMode) => {
    if (newMode === currentMode) return;
    if (!excalidrawAPI) {
      setCurrentMode(newMode);
      return;
    }

    const currentEls = excalidrawAPI.getSceneElements();
    const currentAppState = excalidrawAPI.getAppState();

    setDiagramModesData(prev => {
      const updated = {
        ...prev,
        [currentMode]: {
          elements: currentEls,
          appState: currentAppState
        }
      };

      const targetScene = updated[newMode] || { elements: [] };
      excalidrawAPI.updateScene({
        elements: targetScene.elements || [],
        appState: targetScene.appState || {}
      });

      return updated;
    });

    setCurrentMode(newMode);
    setIsDirty(true);
  };

  // ── Save ─────────────────────────────────────────────
  const handleSave = async (isAutoSave: boolean) => {
    if (!excalidrawAPI || !selectedDiagram) return;
    try {
      const els = excalidrawAPI.getSceneElements();
      const appState = excalidrawAPI.getAppState();

      const updatedModes = {
        ...diagramModesData,
        [currentMode]: {
          elements: els,
          appState: appState
        }
      };
      setDiagramModesData(updatedModes);

      const json = JSON.stringify({
        type: "excalidraw",
        version: 2,
        source: "akasha",
        modes: updatedModes
      });

      await api.saveDiagram(selectedDiagram, json);
      setIsDirty(false);
      if (!isAutoSave) showToast("Saved ✓", "success");
    } catch { showToast("Save failed"); }
  };

  const handleRenameBlur = async () => {
    if (!selectedDiagram || editingDiagramName === selectedDiagram) return;
    try {
      const newName = editingDiagramName.endsWith(".excalidraw") ? editingDiagramName : editingDiagramName + ".excalidraw";
      const els = excalidrawAPI!.getSceneElements();
      const appState = excalidrawAPI!.getAppState();

      const updatedModes = {
        ...diagramModesData,
        [currentMode]: {
          elements: els,
          appState: appState
        }
      };
      setDiagramModesData(updatedModes);

      const json = JSON.stringify({
        type: "excalidraw",
        version: 2,
        source: "akasha",
        modes: updatedModes
      });

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
          showToast("Architectural Error: Actors cannot bypass the API layer.", "warn");
        }
        if (el.strokeColor !== "#ffffff") {
          hasUpdates = true;
          return { ...el, strokeColor: "#ffffff", strokeWidth: 3, customData: { ...el.customData, lintError: "actor-db-bypass" } };
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

  // ── Library change handler — persist user-added items ─
  const onLibraryChange = useCallback(async (itemsOrPromise: any) => {
    if (!selectedDiagram) return;
    try {
      const items = await Promise.resolve(itemsOrPromise);
      const libraryArray = Array.isArray(items) ? items : [];
      // Only keep user items that are not our hardcoded preset IDs
      const userItems = libraryArray.filter((item: any) => {
        const id = item?.id || "";
        return !id.startsWith("erd-") && !id.startsWith("arch-") && !id.startsWith("uc-");
      });
      setUserLibraryItems(userItems);
      saveUserLibrary(selectedDiagram, libraryArray);
    } catch (err) {
      console.warn("[Excalidraw] onLibraryChange error:", err);
    }
  }, [selectedDiagram]);

  // ── Library import handler (.excalidrawlib or JSON) ────
  const handleImportLibraryFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedDiagram) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      let itemsToImport: any[] = [];

      if (Array.isArray(data)) {
        itemsToImport = data;
      } else if (Array.isArray(data.libraryItems)) {
        itemsToImport = data.libraryItems;
      } else if (Array.isArray(data.library)) {
        itemsToImport = data.library;
      } else {
        throw new Error("Unrecognized library format. Expected libraryItems array.");
      }

      // Normalize items
      const normalizedItems = itemsToImport.map((item: any, idx: number) => {
        if (Array.isArray(item)) {
          return {
            id: `custom-lib-${Date.now()}-${idx}`,
            status: "published" as const,
            elements: item,
          };
        }
        return {
          id: item.id || `custom-lib-${Date.now()}-${idx}`,
          status: item.status || "published",
          elements: item.elements || [],
        };
      });

      const existing = loadUserLibrary(selectedDiagram);
      const existingIds = new Set(existing.map((it: any) => it.id));
      const merged = [...existing, ...normalizedItems.filter((it: any) => !existingIds.has(it.id))];

      saveUserLibrary(selectedDiagram, merged);
      setUserLibraryItems(merged);

      if (excalidrawAPI?.updateLibrary) {
        excalidrawAPI.updateLibrary({
          libraryItems: merged,
          merge: true,
          prompt: false,
        });
      }

      showToast(`Imported ${normalizedItems.length} library items`, "success");
    } catch (err: any) {
      showToast(`Library import failed: ${err?.message || "Invalid JSON"}`, "error");
    } finally {
      if (libFileInputRef.current) libFileInputRef.current.value = "";
    }
  };

  // ── Pointer → selection tracking ─────────────────────
  const onPointerUpdate = useCallback((_payload: any) => {
    if (!excalidrawAPI) return;
    const appState = excalidrawAPI.getAppState();
    const selIds = Object.keys(appState.selectedElementIds || {}).filter((k) => appState.selectedElementIds[k]);
    if (selIds.length === 1) {
      const el = excalidrawAPI.getSceneElements().find((e: any) => e.id === selIds[0]);
      if (el && (el.type === "rectangle" || el.type === "ellipse" || el.type === "diamond")) {
        const id = selIds[0]!;
        setSelectedElementId((prev) => (prev !== id ? id : prev));
        return;
      }
    }
    setSelectedElementId(null);
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



  // ── Render ────────────────────────────────────────────
  return (
    <div className="flex flex-1 overflow-hidden h-full bg-transparent">

      {/* ── Left Sidebar: Diagram List ── */}
      <div className="w-60 bg-white/60 dark:bg-black/30 backdrop-blur-xl border-r border-black/[0.08] dark:border-white/10 flex flex-col shrink-0">
        <div className="h-10 flex items-center px-4 font-bold text-xs text-[var(--ide-text-secondary)] uppercase tracking-widest bg-transparent border-b border-black/[0.06] dark:border-white/10">
          <span className="flex-1">Diagrams</span>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider hover:bg-[var(--ide-border)] text-[var(--ide-text-secondary)] hover:text-[var(--ide-primary)] transition-colors uppercase"
            title="New Diagram"
          >
            + NEW
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {diagrams.length === 0 && (
            <div className="text-center text-xs text-[var(--ide-text-muted)] py-8 px-4">
              <div style={{ fontSize: 10, fontWeight: "black", opacity: 0.2, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Empty</div>
              No diagrams.<br />Use <strong>+ NEW</strong> to start.
            </div>
          )}
          {diagrams.map((d) => (
            <div
              key={d.path}
              onClick={() => selectDiagram(d.name)}
              className={`group flex items-center px-3 py-2 text-xs rounded-lg cursor-pointer select-none transition-colors ${
                selectedDiagram === d.name
                  ? "bg-white/10 text-white font-semibold"
                  : "text-[var(--ide-text-secondary)] hover:bg-[var(--ide-bg-elevated)] hover:text-[var(--ide-text)]"
              }`}
            >
              <span className="truncate flex-1">{d.name.replace(/\.excalidraw$/, "")}</span>
              {(() => {
                const libCount = loadUserLibrary(d.name).length;
                return libCount > 0 ? (
                  <span className="ml-1.5 px-1.5 py-0.5 text-[9px] font-bold rounded-md bg-white/10 text-white border border-white/20"
                    title={`${libCount} saved library item${libCount > 1 ? 's' : ''}`}
                  >
                    LIB {libCount}
                  </span>
                ) : null;
              })()}
               <button
                onClick={(e) => { e.stopPropagation(); setDeleteTarget(d.name); }}
                className="opacity-0 group-hover:opacity-100 px-1.5 py-0.5 text-[10px] font-bold text-red-500 rounded hover:bg-red-500/10 transition-all uppercase"
                title="Delete"
              >
                DEL
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
              {isDirty && <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: 700 }}>● UNSAVED</span>}
            </div>

            {/* Center: Mode Selector */}
            <div style={{ display: "flex", gap: 4 }}>
              {(["Architecture", "ERD", "UseCase"] as DiagramMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => handleModeChange(m)}
                  style={{
                    fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 8,
                    border: `1.5px solid ${currentMode === m ? "var(--ide-text)" : "var(--ide-border)"}`,
                    background: "transparent",
                    color: currentMode === m ? "var(--ide-text)" : "var(--ide-text-secondary)",
                    cursor: "pointer", letterSpacing: "0.04em", transition: "all 0.15s",
                  }}
                >
                  {m === "Architecture" ? "ARCH" : m === "ERD" ? "ERD" : "USE CASE"}
                </button>
              ))}
            </div>

            {/* Right: Actions */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                onClick={() => handleSave(false)}
                style={{
                  fontSize: 11, fontWeight: 600, padding: "4px 12px", borderRadius: 8,
                  background: "rgba(255,255,255,0.1)", border: "1.5px solid rgba(255,255,255,0.2)",
                  color: "white", cursor: "pointer",
                }}
              >
                Save
              </button>
              <button
                onClick={handleGenerateCode}
                style={{
                  fontSize: 11, fontWeight: 600, padding: "4px 12px", borderRadius: 8,
                  background: "rgba(255,255,255,0.05)", border: "1.5px solid rgba(255,255,255,0.1)",
                  color: "rgba(255,255,255,0.8)", cursor: "pointer",
                }}
              >
                Export
              </button>
              <button
                onClick={() => libFileInputRef.current?.click()}
                style={{
                  fontSize: 11, fontWeight: 600, padding: "4px 12px", borderRadius: 8,
                  background: "rgba(255,255,255,0.05)", border: "1.5px solid rgba(255,255,255,0.1)",
                  color: "rgba(255,255,255,0.8)", cursor: "pointer",
                }}
                title="Import .excalidrawlib or JSON library file"
              >
                Import Lib
              </button>
              <input
                ref={libFileInputRef}
                type="file"
                accept=".excalidrawlib,.json,application/json"
                onChange={handleImportLibraryFile}
                style={{ display: "none" }}
              />
              {userLibraryItems.length > 0 && (
                <span
                  style={{
                    fontSize: 10, fontWeight: 600, padding: "3px 10px", borderRadius: 8,
                    background: "rgba(255,255,255,0.03)", border: "1.5px solid rgba(255,255,255,0.1)",
                    color: "rgba(255,255,255,0.6)", display: "flex", alignItems: "center", gap: 4,
                  }}
                  title={`${userLibraryItems.length} custom library items saved for this diagram`}
                >
                  LIB {userLibraryItems.length} items
                <button
                  onClick={() => {
                    if (selectedDiagram) {
                      localStorage.removeItem(getLibraryKey(selectedDiagram));
                      setUserLibraryItems([]);
                      showToast("Library cleared", "success");
                    }
                  }}
                  style={{
                    marginLeft: 2, padding: "0 3px", borderRadius: 4,
                    background: "transparent", border: "none", color: "#f87171",
                    cursor: "pointer", fontSize: 10, lineHeight: 1,
                  }}
                  title="Clear custom library"
                >✕</button>
              </span>
            )}

            <button
              onClick={() => setShowMetadataPanel(!showMetadataPanel)}
              style={{
                fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 8,
                background: showMetadataPanel ? "white" : "rgba(255,255,255,0.05)",
                border: "1.5px solid rgba(255,255,255,0.1)",
                color: showMetadataPanel ? "black" : "white", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6,
                transition: "all 0.2s",
              }}
            >
              {showMetadataPanel ? "CLOSE METADATA" : "METADATA"}
            </button>
          </div>
          </div>
        )}

        {/* Canvas or empty state */}
        {!selectedDiagram ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-[var(--ide-text-secondary)]">
            <div style={{ fontSize: 10, fontWeight: "black", opacity: 0.2, textTransform: "uppercase", letterSpacing: "0.1em" }}>Empty Editor</div>
            <p style={{ fontSize: 14, fontWeight: 600 }}>Select or create a diagram to begin</p>
            <button
              onClick={() => setShowCreateModal(true)}
              style={{
                fontSize: 13, fontWeight: 600, padding: "8px 20px", borderRadius: 10,
                background: "white", color: "black", border: "none", cursor: "pointer",
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

                        // Ensure all global and user library items are loaded into the Excalidraw instance
                        const allLibs = [...loadGlobalLibraryItems(), ...userLibraryItems];
                        if (allLibs.length > 0 && apiRef?.updateLibrary) {
                          apiRef.updateLibrary({
                            libraryItems: allLibs,
                            merge: true,
                            prompt: false,
                          });
                        }

                        // Only load diagram content the first time the API is set for this
                        // diagram. Subsequent calls happen when libraryItems/mode changes —
                        // we must NOT reload or it clears the user's drawings.
                        if (!apiReadyRef.current && selectedDiagramRef.current) {
                          apiReadyRef.current = true;
                          setTimeout(() => doSelectDiagram(selectedDiagramRef.current!, apiRef), 100);
                        }
                      }}
                      onChange={onChange}
                      onPointerUpdate={onPointerUpdate}
                      onLibraryChange={onLibraryChange}
                      theme={theme}
                      // @ts-ignore
                      libraryItems={mergedLibrary}
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
                          viewBackgroundColor: "transparent",
                        },
                      }}
                    />
                  </div>
                </Suspense>
              </ErrorBoundary>
            </div>

            {/* Metadata Sidebar */}
            {showMetadataPanel && (
              <MetadataSidebar elementId={selectedElementId} excalidrawAPI={excalidrawAPI} onClose={() => setShowMetadataPanel(false)} />
            )}

          </div>
        )}
      </div>



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
