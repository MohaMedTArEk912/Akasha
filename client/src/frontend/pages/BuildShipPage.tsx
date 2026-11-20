/**
 * Build & Ship — Agent Control Plane, Team Board, Drift Radar & Full-Stack Export (View 5 of 6)
 */

import React, { useEffect, useState, useCallback, useMemo, lazy, Suspense } from "react";
import { useProjectStore } from "../hooks/useProjectStore";
import { useToast } from "../context/ToastContext";
import { PageShell } from "../components/layout/PageShell";
import {
  runDriftCheck,
  fetchLatestDrift,
  fetchGeneratedBundle,
  exportFullStackProject,
  type DriftReport,
} from "../services/akashaV2Service";
import {
  RefreshCw,
  Download,
  Copy,
  FolderCode,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Radio,
  Columns3,
  Search,
} from "lucide-react";

const AgentMissionControlPage = lazy(() => import("./AgentMissionControlPage"));
const TeamSpacePage = lazy(() => import("./TeamSpacePage"));
const SourceCodePage = lazy(() => import("./SourceCodePage"));

const BuildShipPage: React.FC = () => {
  const { project } = useProjectStore();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<"mission" | "board" | "drift" | "export">("mission");

  const [drift, setDrift] = useState<DriftReport | null>(null);
  const [workspaceDir, setWorkspaceDir] = useState("");
  const [scanningDrift, setScanningDrift] = useState(false);

  const [bundleFiles, setBundleFiles] = useState<Array<{ path: string; content: string; mimeType: string }>>([]);
  const [selectedFilePath, setSelectedFilePath] = useState("");
  const [fileSearch, setFileSearch] = useState("");
  const [loadingBundle, setLoadingBundle] = useState(false);
  const [exportingDisk, setExportingDisk] = useState(false);

  const loadDrift = useCallback(async () => {
    if (!project?.id) return;
    const latest = await fetchLatestDrift(project.id).catch(() => null);
    setDrift(latest);
  }, [project?.id]);

  const loadBundle = useCallback(async () => {
    if (!project?.id) return;
    setLoadingBundle(true);
    try {
      const res = await fetchGeneratedBundle(project.id);
      setBundleFiles(res.files || []);
      if (res.files?.length && !selectedFilePath) {
        setSelectedFilePath(res.files[0]!.path);
      }
    } catch (err: any) {
      toast.showToast(`Could not load full-stack bundle: ${err?.message || err}`, "error");
    } finally {
      setLoadingBundle(false);
    }
  }, [project?.id, selectedFilePath, toast]);

  useEffect(() => {
    if (activeTab === "drift") void loadDrift();
    if (activeTab === "export") void loadBundle();
  }, [activeTab, loadDrift, loadBundle]);

  const filteredFiles = useMemo(() => {
    const q = fileSearch.trim().toLowerCase();
    if (!q) return bundleFiles;
    return bundleFiles.filter((f) => f.path.toLowerCase().includes(q));
  }, [bundleFiles, fileSearch]);

  if (!project) return null;

  const activeFile = bundleFiles.find((f) => f.path === selectedFilePath) || filteredFiles[0] || null;

  const handleRunDrift = async () => {
    setScanningDrift(true);
    try {
      const report = await runDriftCheck(project.id, workspaceDir.trim() || undefined);
      setDrift(report);
      toast.showToast(`Drift scan finished (${report.healthScore}% aligned)`, "success");
    } catch (err: any) {
      toast.showToast(`Drift scan error: ${err?.message || err}`, "error");
    } finally {
      setScanningDrift(false);
    }
  };

  const handleExportToDisk = async () => {
    setExportingDisk(true);
    try {
      const res = await exportFullStackProject(project.id);
      toast.showToast(`Exported ${res.fileCount} files to ${res.path}`, "success");
      await loadBundle();
    } catch (err: any) {
      toast.showToast(`Export failed: ${err?.message || err}`, "error");
    } finally {
      setExportingDisk(false);
    }
  };

  const handleDownloadJsonManifest = () => {
    const blob = new Blob([JSON.stringify({ project: project.name, files: bundleFiles }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-fullstack-bundle.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PageShell
      title="Build & ship"
      subtitle="Hand off scoped MCP packs to coding agents, track team tasks, detect code drift, and export your full-stack codebase."
      tabs={[
        { id: "mission", label: "Mission control", icon: <Radio className="w-3.5 h-3.5" /> },
        { id: "board", label: "Team board", icon: <Columns3 className="w-3.5 h-3.5" /> },
        {
          id: "drift",
          label: "Drift radar",
          badge: drift ? `${drift.healthScore}%` : undefined,
          icon: <ShieldCheck className="w-3.5 h-3.5" />,
        },
        {
          id: "export",
          label: "Code export",
          badge: bundleFiles.length || undefined,
          icon: <FolderCode className="w-3.5 h-3.5" />,
        },
      ]}
      activeTab={activeTab}
      onTabChange={(t) => setActiveTab(t as any)}
      fullBleed={activeTab === "mission" || activeTab === "board"}
    >
      {activeTab === "mission" && (
        <Suspense fallback={<div className="p-8 text-sm text-[var(--ide-text-muted)]">Loading mission control...</div>}>
          <AgentMissionControlPage />
        </Suspense>
      )}

      {activeTab === "board" && (
        <Suspense fallback={<div className="p-8 text-sm text-[var(--ide-text-muted)]">Loading team board...</div>}>
          <TeamSpacePage />
        </Suspense>
      )}

      {activeTab === "drift" && (
        <div className="space-y-6">
          <div className="studio-surface p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-[var(--ide-text)] flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Blueprint vs. source code alignment
                </h2>
                <p className="text-xs text-[var(--ide-text-secondary)] mt-0.5">
                  Scans Prisma, Mongoose, Drizzle, SQL, Express, and Next.js routes against your Akasha models and APIs.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={workspaceDir}
                  onChange={(e) => setWorkspaceDir(e.target.value)}
                  placeholder="Optional local folder path (defaults to exported project)"
                  className="input-modern h-9 w-72 text-xs"
                />
                <button
                  type="button"
                  onClick={handleRunDrift}
                  disabled={scanningDrift}
                  className="btn-primary h-9 px-4 text-xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${scanningDrift ? "animate-spin" : ""}`} />
                  {scanningDrift ? "Scanning..." : "Run drift scan"}
                </button>
              </div>
            </div>

            {drift && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/25">
                  <div className="font-medium text-emerald-700 dark:text-emerald-300">Alignment score</div>
                  <div className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-300 mt-1">
                    {drift.healthScore}%
                  </div>
                  <div className="text-[11px] text-[var(--ide-text-secondary)]">
                    {drift.scannedFileCount} source files scanned
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)] space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Matched ({drift.matchedEntities.length} models, {drift.matchedApis.length} APIs)
                  </div>
                  <div className="font-mono text-[11px] text-[var(--ide-text-secondary)] truncate">
                    {drift.matchedEntities.join(", ") || "None"}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="w-3.5 h-3.5" /> Planned only ({drift.missingInCode.length} models)
                  </div>
                  <div className="font-mono text-[11px] text-[var(--ide-text-secondary)] truncate">
                    {drift.missingInCode.join(", ") || "All implemented"}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/25 space-y-1">
                  <div className="font-bold text-rose-700 dark:text-rose-300">
                    Field mismatches ({drift.fieldMismatches.length})
                  </div>
                  <div className="font-mono text-[11px] text-[var(--ide-text-secondary)] truncate">
                    {drift.fieldMismatches
                      .map((f) => `${f.entityName} (-${f.missingInCode.length}/+${f.extraInCode.length})`)
                      .join(", ") || "No field drift"}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="studio-surface overflow-hidden h-[560px]">
            <Suspense fallback={<div className="p-8 text-sm text-[var(--ide-text-muted)]">Loading repository browser...</div>}>
              <SourceCodePage />
            </Suspense>
          </div>
        </div>
      )}

      {activeTab === "export" && (
        <div className="space-y-4">
          <div className="studio-surface p-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-[var(--ide-text)] flex items-center gap-2">
                <FolderCode className="w-4 h-4 text-[#1B5BFF] dark:text-[#7AA3FF]" />
                Runnable full-stack codebase ({bundleFiles.length} files)
              </h2>
              <p className="text-xs text-[var(--ide-text-secondary)] mt-0.5">
                Typed Express 5 routes, MongoDB collections, seed script from your mock API, React + Tailwind screens, and Docker Compose.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportToDisk}
                disabled={exportingDisk}
                className="h-9 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                {exportingDisk ? "Writing files..." : "Write to workspace disk"}
              </button>
              <button
                type="button"
                onClick={handleDownloadJsonManifest}
                disabled={bundleFiles.length === 0}
                className="btn-primary h-9 px-4 text-xs"
              >
                <Download className="w-3.5 h-3.5" />
                Download bundle
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[540px]">
            <div className="lg:col-span-4 studio-surface p-3 flex flex-col gap-2 overflow-hidden">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[var(--ide-text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  value={fileSearch}
                  onChange={(e) => setFileSearch(e.target.value)}
                  placeholder="Filter files..."
                  className="input-modern h-8 w-full pl-8 pr-2 text-xs"
                />
              </div>
              <div className="flex-1 overflow-y-auto space-y-0.5">
                {loadingBundle ? (
                  <div className="p-4 text-xs text-[var(--ide-text-muted)]">Generating files...</div>
                ) : (
                  filteredFiles.map((f) => (
                    <button
                      key={f.path}
                      type="button"
                      onClick={() => setSelectedFilePath(f.path)}
                      className={`w-full text-left px-3 py-2 rounded-lg font-mono text-[11px] truncate cursor-pointer transition-colors ${
                        activeFile?.path === f.path
                          ? "bg-[#1B5BFF] text-white font-semibold"
                          : "text-[var(--ide-text-secondary)] hover:bg-[var(--ide-accent-subtle)] hover:text-[var(--ide-text)]"
                      }`}
                    >
                      {f.path}
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="lg:col-span-8 rounded-2xl bg-[#0F172A] border border-[var(--ide-border)] flex flex-col overflow-hidden">
              <div className="px-4 py-2.5 border-b border-white/10 flex items-center justify-between text-xs font-mono text-slate-200">
                <span className="truncate">{activeFile?.path || "Select a file"}</span>
                {activeFile && (
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(activeFile.content);
                      toast.showToast(`Copied ${activeFile.path}`, "success");
                    }}
                    className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-sky-200 inline-flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <Copy className="w-3 h-3" /> Copy
                  </button>
                )}
              </div>
              <pre className="flex-1 overflow-auto p-4 font-mono text-xs text-slate-100 leading-relaxed">
                {activeFile?.content || "// Select a file on the left to inspect generated source code"}
              </pre>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
};

export default BuildShipPage;
