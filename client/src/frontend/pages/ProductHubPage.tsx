/**
 * Product Hub — Small-Team Overview & Launch Readiness (View 1 of 6)
 */

import React, { useEffect, useState, useCallback } from "react";
import { motion } from "motion/react";
import { useProjectStore } from "../hooks/useProjectStore";
import { setActivePage, refreshCurrentProject } from "../stores/projectStore";
import { useToast } from "../context/ToastContext";
import { PageShell } from "../components/layout/PageShell";
import {
  fetchReleaseReadiness,
  fetchPlaybooks,
  bootstrapPlaybook,
  fetchLatestDrift,
  runDriftCheck,
  exportFullStackProject,
  type ReleaseReadinessReport,
  type PlaybookSummary,
  type DriftReport,
  type ArchetypeId,
} from "../services/akashaV2Service";
import {
  CheckCircle2,
  AlertTriangle,
  Circle,
  ExternalLink,
  Copy,
  Rocket,
  Layers,
  Database,
  GitBranch,
  RefreshCw,
  ArrowUpRight,
  ChevronRight,
} from "lucide-react";

const ProductHubPage: React.FC = () => {
  const { project } = useProjectStore();
  const toast = useToast();

  const [readiness, setReadiness] = useState<ReleaseReadinessReport | null>(null);
  const [playbooks, setPlaybooks] = useState<PlaybookSummary[]>([]);
  const [drift, setDrift] = useState<DriftReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [bootstrapping, setBootstrapping] = useState<string | null>(null);
  const [checkingDrift, setCheckingDrift] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadHub = useCallback(async () => {
    if (!project?.id) return;
    setLoading(true);
    try {
      const [r, pbs, dr] = await Promise.all([
        fetchReleaseReadiness(project.id).catch(() => null),
        fetchPlaybooks().catch(() => []),
        fetchLatestDrift(project.id).catch(() => null),
      ]);
      setReadiness(r);
      setPlaybooks(pbs);
      setDrift(dr);
    } finally {
      setLoading(false);
    }
  }, [project?.id]);

  useEffect(() => {
    void loadHub();
  }, [loadHub]);

  if (!project) return null;

  const settings: Record<string, any> =
    typeof project.settings === "string"
      ? (() => {
          try {
            return JSON.parse(project.settings);
          } catch {
            return {};
          }
        })()
      : project.settings || {};

  const shareUrl = `${window.location.origin}/preview/${project.id}${
    settings.shareToken ? `?token=${settings.shareToken}` : ""
  }`;

  const handleApplyPlaybook = async (archId: ArchetypeId) => {
    setBootstrapping(archId);
    try {
      const res = await bootstrapPlaybook({
        projectId: project.id,
        archetype: archId,
        productName: project.name,
        pitch: project.description,
      });
      toast.showToast(
        `Seeded ${res.stats.slicesCount} slices, ${res.stats.modelsCount} models, and ${res.stats.seededRecordsCount} live mock rows`,
        "success"
      );
      await refreshCurrentProject(project.id);
      await loadHub();
    } catch (err: any) {
      toast.showToast(`Bootstrap failed: ${err?.message || err}`, "error");
    } finally {
      setBootstrapping(null);
    }
  };

  const handleCopyShareLink = () => {
    navigator.clipboard.writeText(shareUrl);
    toast.showToast("Prototype link copied", "success");
  };

  const handleRunDrift = async () => {
    setCheckingDrift(true);
    try {
      const report = await runDriftCheck(project.id);
      setDrift(report);
      toast.showToast(`Drift check finished (${report.healthScore}% aligned)`, "success");
    } catch (err: any) {
      toast.showToast(`Drift check failed: ${err?.message || err}`, "error");
    } finally {
      setCheckingDrift(false);
    }
  };

  const handleExportFullStack = async () => {
    setExporting(true);
    try {
      const res = await exportFullStackProject(project.id);
      toast.showToast(`Exported ${res.fileCount || 0} full-stack files`, "success");
      setActivePage("build");
    } catch (err: any) {
      toast.showToast(`Export failed: ${err?.message || err}`, "error");
    } finally {
      setExporting(false);
    }
  };

  const score = readiness?.score ?? 0;

  return (
    <PageShell
      title={project.name}
      subtitle={
        project.description ||
        "Track launch readiness, align on MVP slices, preview live screens, and ship full-stack code."
      }
      actions={
        <>
          <button
            type="button"
            onClick={handleCopyShareLink}
            className="btn-ghost h-9 px-3.5 text-xs"
          >
            <Copy className="w-3.5 h-3.5" />
            Copy share link
          </button>
          <button
            type="button"
            onClick={() => window.open(shareUrl, "_blank", "noopener")}
            className="btn-ghost h-9 px-3.5 text-xs"
          >
            <ExternalLink className="w-3.5 h-3.5 text-[#1B5BFF] dark:text-[#7AA3FF]" />
            Open prototype
          </button>
          <button
            type="button"
            onClick={handleExportFullStack}
            disabled={exporting}
            className="btn-primary h-9 px-4 text-xs"
          >
            <Rocket className="w-3.5 h-3.5" />
            {exporting ? "Exporting..." : "Export code"}
          </button>
        </>
      }
    >
      {/* Empty Project Starter Picker */}
      {!loading && readiness && readiness.counts.slices === 0 && (
        <section className="rounded-2xl border border-[#1B5BFF]/25 bg-[#1B5BFF]/[0.04] dark:bg-[#5B8CFF]/10 p-6 space-y-4">
          <div>
            <h2 className="text-base font-bold text-[var(--ide-text)]">
              Seed this workspace from a starter blueprint
            </h2>
            <p className="text-sm text-[var(--ide-text-secondary)] mt-0.5">
              Populate feature slices, data models, REST endpoints, and live mock records in one click—no API key required.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {playbooks.map((pb) => (
              <button
                key={pb.id}
                type="button"
                disabled={Boolean(bootstrapping)}
                onClick={() => handleApplyPlaybook(pb.id)}
                className="text-left p-4 rounded-xl bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] hover:border-[#1B5BFF] transition-colors cursor-pointer group disabled:opacity-50"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-bold text-[var(--ide-text)] group-hover:text-[#1B5BFF] dark:group-hover:text-[#7AA3FF]">
                    {pb.name}
                  </span>
                  <span className="text-xs font-semibold text-[#1B5BFF] dark:text-[#7AA3FF]">
                    {bootstrapping === pb.id ? "Seeding..." : "Apply"}
                  </span>
                </div>
                <p className="text-xs text-[var(--ide-text-secondary)] line-clamp-2">
                  {pb.tagline}
                </p>
                <div className="mt-3 pt-2.5 border-t border-[var(--ide-border)] flex items-center gap-3 text-xs text-[var(--ide-text-muted)]">
                  <span>{pb.stats.slices} slices</span>
                  <span>{pb.stats.models} models</span>
                  <span>{pb.stats.apis} APIs</span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Unified Architectural Summary Bar */}
      <section className="studio-surface overflow-hidden grid grid-cols-2 lg:grid-cols-5 divide-y lg:divide-y-0 lg:divide-x divide-[var(--ide-border)]">
        <SummaryMetric
          label="Launch readiness"
          value={`${score}%`}
          detail={readiness?.stage || "Ideation"}
          tone="accent"
          onClick={() => setActivePage("scope")}
        />
        <SummaryMetric
          label="MVP slices"
          value={`${readiness?.counts.mvpSlices ?? 0}`}
          detail={`${readiness?.counts.slices ?? 0} total slices`}
          onClick={() => setActivePage("scope")}
        />
        <SummaryMetric
          label="Models & APIs"
          value={`${readiness?.counts.models ?? 0} / ${readiness?.counts.apis ?? 0}`}
          detail="Shared contracts"
          onClick={() => setActivePage("blueprint")}
        />
        <SummaryMetric
          label="Live prototype"
          value={`${readiness?.counts.pages ?? 0} views`}
          detail={`${readiness?.counts.mockRecords ?? 0} seeded records`}
          onClick={() => setActivePage("studio")}
        />
        <SummaryMetric
          label="Code alignment"
          value={drift ? `${drift.healthScore}%` : "Not scanned"}
          detail={drift ? `${drift.missingInCode.length} planned only` : "Run drift check"}
          tone={drift && drift.healthScore < 70 ? "warn" : "ok"}
          onClick={() => setActivePage("build")}
        />
      </section>

      {/* Main 7/5 Asymmetric Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: 6-Pillar Launch Readiness Checklist */}
        <section className="lg:col-span-7 studio-surface overflow-hidden">
          <div className="p-5 border-b border-[var(--ide-border)] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-[var(--ide-text)]">
                  Launch readiness checklist
                </h2>
                <p className="text-xs text-[var(--ide-text-secondary)] mt-0.5">
                  Click any milestone to jump straight into the workspace view that completes it.
                </p>
              </div>
              <span className="text-lg font-extrabold text-[#1B5BFF] dark:text-[#7AA3FF]">
                {score}%
              </span>
            </div>

            <div className="w-full h-2 rounded-full bg-[var(--ide-accent-subtle)] overflow-hidden">
              <motion.div
                initial={false}
                animate={{ width: `${Math.max(4, score)}%` }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                className={`h-full rounded-full ${
                  score >= 75 ? "bg-emerald-500" : "bg-[#1B5BFF]"
                }`}
              />
            </div>
          </div>

          <div className="divide-y divide-[var(--ide-border)]">
            {(readiness?.checks || []).map((check) => (
              <button
                key={check.id}
                type="button"
                onClick={() => setActivePage(check.actionTab)}
                className="w-full text-left px-5 py-3.5 hover:bg-[var(--ide-accent-subtle)]/65 flex items-start justify-between gap-3 transition-colors cursor-pointer group"
              >
                <div className="flex items-start gap-3 min-w-0">
                  {check.status === "pass" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                  ) : check.status === "warn" ? (
                    <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-[var(--ide-text-muted)] mt-0.5 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[var(--ide-text)]">
                      {check.label}
                    </div>
                    <div className="text-xs text-[var(--ide-text-secondary)] mt-0.5">
                      {check.detail}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 pt-0.5">
                  <span className="text-xs font-mono font-medium text-[var(--ide-text-muted)]">
                    {check.earned}/{check.weight}
                  </span>
                  <ChevronRight className="w-4 h-4 text-[var(--ide-text-muted)] group-hover:text-[var(--ide-text)] transition-colors" />
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Right: Quick Workspaces + Drift Radar */}
        <section className="lg:col-span-5 space-y-5">
          <div className="studio-surface overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--ide-border)]">
              <h2 className="text-base font-bold text-[var(--ide-text)]">
                Jump into a workspace
              </h2>
            </div>
            <div className="divide-y divide-[var(--ide-border)]">
              <QuickDoor
                icon={<Layers className="w-4 h-4 text-[#1B5BFF] dark:text-[#7AA3FF]" />}
                title="Features & scope"
                desc="Prioritize MVP slices, collect votes, and track edge cases."
                onClick={() => setActivePage("scope")}
              />
              <QuickDoor
                icon={<ExternalLink className="w-4 h-4 text-violet-600 dark:text-violet-400" />}
                title="Live prototype"
                desc="Click through working screens and leave pinned review notes."
                onClick={() => setActivePage("studio")}
              />
              <QuickDoor
                icon={<Database className="w-4 h-4 text-sky-600 dark:text-sky-400" />}
                title="Data & APIs"
                desc="Design models, test live mock endpoints, and check change impact."
                onClick={() => setActivePage("blueprint")}
              />
              <QuickDoor
                icon={<GitBranch className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
                title="Build & ship"
                desc="Hand off MCP build packs, watch live logs, and export full-stack code."
                onClick={() => setActivePage("build")}
              />
            </div>
          </div>

          <div className="studio-surface p-5 space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-[var(--ide-text)]">
                Blueprint vs. code alignment
              </h3>
              <button
                type="button"
                onClick={handleRunDrift}
                disabled={checkingDrift}
                className="text-xs font-semibold text-[#1B5BFF] dark:text-[#7AA3FF] hover:underline inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${checkingDrift ? "animate-spin" : ""}`} />
                {checkingDrift ? "Scanning..." : "Scan code"}
              </button>
            </div>

            {drift ? (
              <div className="grid grid-cols-3 gap-2.5 text-center">
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
                  <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                    {drift.matchedEntities.length}
                  </div>
                  <div className="text-xs text-[var(--ide-text-secondary)]">Matched</div>
                </div>
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
                  <div className="text-lg font-bold text-amber-700 dark:text-amber-300">
                    {drift.missingInCode.length}
                  </div>
                  <div className="text-xs text-[var(--ide-text-secondary)]">Planned</div>
                </div>
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20">
                  <div className="text-lg font-bold text-rose-700 dark:text-rose-300">
                    {drift.fieldMismatches.length}
                  </div>
                  <div className="text-xs text-[var(--ide-text-secondary)]">Mismatches</div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[var(--ide-text-secondary)] leading-relaxed">
                Export code or connect a repo, then run a scan to spot models or endpoints that drifted from your blueprint.
              </p>
            )}
          </div>
        </section>
      </div>
    </PageShell>
  );
};

const SummaryMetric: React.FC<{
  label: string;
  value: string;
  detail: string;
  tone?: "accent" | "ok" | "warn";
  onClick: () => void;
}> = ({ label, value, detail, tone, onClick }) => {
  const valueColor =
    tone === "accent"
      ? "text-[#1B5BFF] dark:text-[#7AA3FF]"
      : tone === "warn"
      ? "text-amber-600 dark:text-amber-400"
      : tone === "ok"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-[var(--ide-text)]";

  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left p-4 hover:bg-[var(--ide-accent-subtle)]/65 transition-colors cursor-pointer"
    >
      <div className="text-xs font-medium text-[var(--ide-text-muted)]">{label}</div>
      <div className={`text-xl font-extrabold tracking-tight mt-1 ${valueColor}`}>{value}</div>
      <div className="text-xs text-[var(--ide-text-secondary)] mt-0.5 truncate">{detail}</div>
    </button>
  );
};

const QuickDoor: React.FC<{
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
}> = ({ icon, title, desc, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full text-left px-5 py-3.5 hover:bg-[var(--ide-accent-subtle)]/65 flex items-start justify-between gap-3 transition-colors cursor-pointer group"
  >
    <div className="flex items-start gap-3 min-w-0">
      <div className="w-8 h-8 rounded-lg bg-[var(--ide-bg)] border border-[var(--ide-border)] flex items-center justify-center shrink-0 mt-0.5">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-[var(--ide-text)]">{title}</div>
        <div className="text-xs text-[var(--ide-text-secondary)] mt-0.5 leading-relaxed">{desc}</div>
      </div>
    </div>
    <ArrowUpRight className="w-4 h-4 text-[var(--ide-text-muted)] group-hover:text-[#1B5BFF] dark:group-hover:text-[#7AA3FF] shrink-0 mt-1 transition-colors" />
  </button>
);

export default ProductHubPage;
