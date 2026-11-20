/**
 * System Blueprint — Data Models, REST APIs, Live Mock Server & Change Impact (View 4 of 6)
 */

import React, { useEffect, useState, useCallback, lazy, Suspense } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useProjectStore } from "../hooks/useProjectStore";
import { refreshCurrentProject } from "../stores/projectStore";
import { useToast } from "../context/ToastContext";
import { PageShell } from "../components/layout/PageShell";
import {
  fetchMockMeta,
  resetMockSeed,
  analyzeChangeImpact,
  applyImpactSync,
  type ChangeImpactReport,
} from "../services/akashaV2Service";
import {
  Activity,
  Play,
  RotateCcw,
  AlertTriangle,
  Zap,
  X,
  CheckCircle2,
  Database,
  Globe,
  Server,
  GitFork,
} from "lucide-react";

const DatabasePage = lazy(() => import("./DatabasePage"));
const APIsPage = lazy(() => import("./APIsPage"));
const DiagramsPage = lazy(() => import("./DiagramsPage"));

const SystemBlueprintPage: React.FC = () => {
  const { project } = useProjectStore();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<"models" | "apis" | "mock" | "diagrams">("models");

  // Live Mock Explorer State
  const [mockResources, setMockResources] = useState<
    Array<{ resource: string; modelName: string; count: number; endpoint: string }>
  >([]);
  const [mockLogs, setMockLogs] = useState<
    Array<{ id: string; timestamp: string; method: string; path: string; status: number; durationMs: number; summary: string }>
  >([]);
  const [selectedResource, setSelectedResource] = useState("");
  const [mockMethod, setMockMethod] = useState<"GET" | "POST" | "PATCH" | "DELETE">("GET");
  const [mockRecordId, setMockRecordId] = useState("");
  const [mockBody, setMockBody] = useState('{\n  "title": "New sample item",\n  "status": "active"\n}');
  const [mockResponse, setMockResponse] = useState<string>("");
  const [sendingMock, setSendingMock] = useState(false);

  // Change Impact Ripple Drawer State
  const [showImpactDrawer, setShowImpactDrawer] = useState(false);
  const [impactModelId, setImpactModelId] = useState("");
  const [impactChangeSummary, setImpactChangeSummary] = useState("");
  const [impactReport, setImpactReport] = useState<ChangeImpactReport | null>(null);
  const [analyzingImpact, setAnalyzingImpact] = useState(false);

  const loadMockMeta = useCallback(async () => {
    if (!project?.id) return;
    try {
      const data = await fetchMockMeta(project.id);
      const list = data.resources || [];
      setMockResources(list);
      setMockLogs(data.logs || []);
      if (!selectedResource && list.length > 0) {
        setSelectedResource(list[0].resource);
      }
    } catch {
      // ignore
    }
  }, [project?.id, selectedResource]);

  useEffect(() => {
    if (activeTab === "mock") {
      void loadMockMeta();
    }
  }, [activeTab, loadMockMeta]);

  if (!project) return null;

  const activeModels = (project.data_models || []).filter((m) => !m.archived);
  const activeApis = (project.apis || []).filter((a) => !a.archived);

  const handleSendMock = async () => {
    if (!selectedResource) return;
    setSendingMock(true);
    try {
      const url = `/api/mock/${encodeURIComponent(project.id)}/${encodeURIComponent(selectedResource)}${
        mockRecordId.trim() ? `/${encodeURIComponent(mockRecordId.trim())}` : ""
      }`;
      const opts: RequestInit = { method: mockMethod, headers: { "Content-Type": "application/json" } };
      if (mockMethod === "POST" || mockMethod === "PATCH") {
        opts.body = mockBody;
      }
      const res = await fetch(url, opts);
      const json = await res.json().catch(() => ({}));
      setMockResponse(`HTTP ${res.status}\n\n${JSON.stringify(json, null, 2)}`);
      await loadMockMeta();
    } catch (err: any) {
      setMockResponse(`Error: ${err?.message || err}`);
    } finally {
      setSendingMock(false);
    }
  };

  const handleAnalyzeImpact = async () => {
    const targetId = impactModelId || activeModels[0]?.id;
    if (!targetId) {
      toast.showToast("Create a data model first to check change impact", "info");
      return;
    }
    setAnalyzingImpact(true);
    try {
      const report = await analyzeChangeImpact({
        projectId: project.id,
        sourceType: "model",
        sourceId: targetId,
        changeSummary: impactChangeSummary.trim() || "Schema field update",
      });
      setImpactReport(report);
    } catch (err: any) {
      toast.showToast(`Impact check failed: ${err?.message || err}`, "error");
    } finally {
      setAnalyzingImpact(false);
    }
  };

  const handleApplyImpact = async () => {
    if (!impactReport) return;
    try {
      const res = await applyImpactSync({
        projectId: project.id,
        report: impactReport,
        flagSlices: true,
        createSyncTask: true,
      });
      toast.showToast(`Flagged ${res.flaggedSlicesCount} slice(s) and created a sync task`, "success");
      await refreshCurrentProject(project.id);
    } catch (err: any) {
      toast.showToast(`Could not apply sync: ${err?.message || err}`, "error");
    }
  };

  return (
    <PageShell
      title="Data & APIs"
      subtitle="Design shared models and REST contracts, query your live mock server, and preview downstream change impact."
      tabs={[
        { id: "models", label: "Data models", badge: activeModels.length, icon: <Database className="w-3.5 h-3.5" /> },
        { id: "apis", label: "REST APIs", badge: activeApis.length, icon: <Globe className="w-3.5 h-3.5" /> },
        {
          id: "mock",
          label: "Live mock server",
          badge: mockResources.length || undefined,
          icon: <Server className="w-3.5 h-3.5" />,
        },
        { id: "diagrams", label: "Diagrams", icon: <GitFork className="w-3.5 h-3.5" /> },
      ]}
      activeTab={activeTab}
      onTabChange={(t) => setActiveTab(t as any)}
      fullBleed={activeTab !== "mock"}
      actions={
        <button
          type="button"
          onClick={() => {
            setShowImpactDrawer(true);
            if (!impactModelId && activeModels[0]?.id) setImpactModelId(activeModels[0].id);
          }}
          className="h-9 px-3.5 rounded-lg text-xs font-semibold bg-amber-50 dark:bg-amber-500/15 hover:bg-amber-100 dark:hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/35 inline-flex items-center gap-1.5 cursor-pointer transition-colors"
        >
          <Zap className="w-3.5 h-3.5" />
          Check change impact
        </button>
      }
    >
      {activeTab === "models" && (
        <Suspense fallback={<div className="p-8 text-sm text-[var(--ide-text-muted)]">Loading data models...</div>}>
          <DatabasePage />
        </Suspense>
      )}

      {activeTab === "apis" && (
        <Suspense fallback={<div className="p-8 text-sm text-[var(--ide-text-muted)]">Loading REST APIs...</div>}>
          <APIsPage />
        </Suspense>
      )}

      {activeTab === "diagrams" && (
        <Suspense fallback={<div className="p-8 text-sm text-[var(--ide-text-muted)]">Loading diagrams...</div>}>
          <DiagramsPage />
        </Suspense>
      )}

      {activeTab === "mock" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Endpoints & Traffic */}
          <div className="lg:col-span-4 space-y-5">
            <div className="studio-surface p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[var(--ide-text)]">Mock collections</h3>
                <button
                  type="button"
                  onClick={async () => {
                    const res = await resetMockSeed(project.id);
                    toast.showToast(`Reset seed with ${res.seededCount} records`, "success");
                    await loadMockMeta();
                  }}
                  className="text-xs font-semibold text-[#1B5BFF] dark:text-[#7AA3FF] inline-flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset seed
                </button>
              </div>
              <div className="space-y-1.5">
                {mockResources.map((r) => (
                  <button
                    key={r.resource}
                    type="button"
                    onClick={() => {
                      setSelectedResource(r.resource);
                      setMockRecordId("");
                    }}
                    className={`w-full text-left p-3 rounded-xl border text-xs flex items-center justify-between cursor-pointer transition-colors ${
                      selectedResource === r.resource
                        ? "bg-[#1B5BFF]/[0.07] border-[#1B5BFF] text-[#1B5BFF] dark:text-[#7AA3FF]"
                        : "bg-[var(--ide-bg)] border-[var(--ide-border)] text-[var(--ide-text)] hover:border-[var(--ide-border-strong)]"
                    }`}
                  >
                    <div>
                      <div className="font-bold">{r.modelName}</div>
                      <div className="font-mono text-[11px] opacity-75">/{r.resource}</div>
                    </div>
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                      {r.count} rows
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="studio-surface p-5 space-y-3">
              <div className="flex items-center gap-1.5 text-sm font-bold text-[var(--ide-text)]">
                <Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Live traffic ({mockLogs.length})
              </div>
              <div className="space-y-1.5 max-h-64 overflow-y-auto font-mono text-[11px]">
                {mockLogs.length === 0 ? (
                  <p className="font-sans text-xs text-[var(--ide-text-secondary)]">
                    Use the prototype or send a test request to see live requests here.
                  </p>
                ) : (
                  mockLogs.map((l) => (
                    <div
                      key={l.id}
                      className="p-2.5 rounded-lg bg-[var(--ide-bg)] border border-[var(--ide-border)]"
                    >
                      <div className="flex justify-between gap-2">
                        <span className="font-semibold text-[#1B5BFF] dark:text-[#7AA3FF] truncate">
                          {l.method} {l.path}
                        </span>
                        <span className={l.status < 300 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600"}>
                          {l.status} ({l.durationMs}ms)
                        </span>
                      </div>
                      <div className="text-[10px] text-[var(--ide-text-muted)] truncate mt-0.5">{l.summary}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right: Interactive Request Playground */}
          <div className="lg:col-span-8 studio-surface p-5 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={mockMethod}
                onChange={(e) => setMockMethod(e.target.value as any)}
                className="input-modern h-9 px-3 text-xs font-mono font-bold"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PATCH">PATCH</option>
                <option value="DELETE">DELETE</option>
              </select>
              <div className="flex-1 h-9 px-3 rounded-lg flex items-center text-xs font-mono bg-[var(--ide-bg)] border border-[var(--ide-border)] text-[var(--ide-text)] truncate">
                /api/mock/{project.id}/{selectedResource || "resource"}
                {mockRecordId ? `/${mockRecordId}` : ""}
              </div>
              <input
                value={mockRecordId}
                onChange={(e) => setMockRecordId(e.target.value)}
                placeholder=":id (optional)"
                className="input-modern h-9 w-32 text-xs font-mono"
              />
              <button
                type="button"
                onClick={handleSendMock}
                disabled={sendingMock || !selectedResource}
                className="btn-primary h-9 px-4 text-xs"
              >
                <Play className="w-3.5 h-3.5" />
                {sendingMock ? "Sending..." : "Send"}
              </button>
            </div>

            {(mockMethod === "POST" || mockMethod === "PATCH") && (
              <textarea
                value={mockBody}
                onChange={(e) => setMockBody(e.target.value)}
                rows={6}
                className="w-full p-3.5 rounded-xl font-mono text-xs bg-[#0F172A] text-sky-200 border border-[var(--ide-border)]"
              />
            )}

            <pre className="min-h-[320px] max-h-[460px] overflow-auto p-4 rounded-xl bg-[#0F172A] text-emerald-300 font-mono text-xs">
              {mockResponse || '// Click "Send" to query your stateful mock REST API'}
            </pre>
          </div>
        </div>
      )}

      {/* Animated Change Impact Ripple Slide-Over Drawer */}
      <AnimatePresence>
        {showImpactDrawer && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowImpactDrawer(false)}
              className="fixed inset-0 bg-slate-900/35 dark:bg-black/60 backdrop-blur-[2px]"
            />
            <motion.div
              initial={{ x: 420 }}
              animate={{ x: 0 }}
              exit={{ x: 420 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="relative z-10 w-full max-w-lg h-full bg-[var(--ide-bg-elevated)] border-l border-[var(--ide-border)] p-6 flex flex-col gap-5 overflow-y-auto shadow-[var(--ide-shadow-premium)]"
            >
              <div className="flex items-center justify-between pb-3 border-b border-[var(--ide-border)]">
                <div>
                  <h3 className="text-base font-bold text-[var(--ide-text)]">Predict change impact</h3>
                  <p className="text-xs text-[var(--ide-text-secondary)] mt-0.5">
                    See which APIs, feature slices, screens, and tasks are affected before modifying a model.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowImpactDrawer(false)}
                  className="p-1.5 rounded-lg text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[var(--ide-text)] block">
                    Data model to change
                  </label>
                  <select
                    value={impactModelId}
                    onChange={(e) => setImpactModelId(e.target.value)}
                    className="input-modern w-full h-9 text-xs"
                  >
                    {activeModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[var(--ide-text)] block">
                    Planned change
                  </label>
                  <input
                    value={impactChangeSummary}
                    onChange={(e) => setImpactChangeSummary(e.target.value)}
                    placeholder="e.g. Add discountCode field & guest checkout toggle"
                    className="input-modern w-full h-9 text-xs"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAnalyzeImpact}
                  disabled={analyzingImpact}
                  className="btn-primary w-full h-9 text-xs"
                >
                  {analyzingImpact ? "Tracing graph..." : "Analyze impact"}
                </button>
              </div>

              {impactReport && (
                <div className="space-y-4 pt-3 border-t border-[var(--ide-border)] text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-[var(--ide-text)] inline-flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      Severity: {impactReport.severity}
                    </span>
                    <button
                      type="button"
                      onClick={handleApplyImpact}
                      className="btn-primary h-8 px-3 text-xs"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Flag slices & create task
                    </button>
                  </div>

                  <ImpactList
                    title={`Affected APIs (${impactReport.affectedApis.length})`}
                    items={impactReport.affectedApis.map((a) => `${a.method} ${a.path} — ${a.reason}`)}
                  />
                  <ImpactList
                    title={`Affected feature slices (${impactReport.affectedSlices.length})`}
                    items={impactReport.affectedSlices.map((s) => `[${s.lane.toUpperCase()}] ${s.title} — ${s.reason}`)}
                  />
                  <ImpactList
                    title={`Affected screens (${impactReport.affectedPages.length})`}
                    items={impactReport.affectedPages.map((p) => `${p.name} (${p.path})`)}
                  />
                  <ImpactList
                    title={`Affected tasks (${impactReport.affectedTasks.length})`}
                    items={impactReport.affectedTasks.map((t) => `[${t.status}] ${t.title}`)}
                  />
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </PageShell>
  );
};

const ImpactList: React.FC<{ title: string; items: string[] }> = ({ title, items }) => (
  <div className="space-y-1.5">
    <div className="text-xs font-semibold text-[var(--ide-text-secondary)]">{title}</div>
    {items.length === 0 ? (
      <div className="text-[var(--ide-text-muted)]">None affected</div>
    ) : (
      items.map((item, i) => (
        <div
          key={i}
          className="p-2.5 rounded-lg bg-[var(--ide-bg)] border border-[var(--ide-border)] font-mono text-[11px] text-[var(--ide-text)]"
        >
          {item}
        </div>
      ))
    )}
  </div>
);

export default SystemBlueprintPage;
