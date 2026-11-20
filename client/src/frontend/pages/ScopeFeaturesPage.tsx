/**
 * Scope & Features — Vertical Feature Slices, Team Voting & Decisions (View 2 of 6)
 */

import React, { useEffect, useState, useCallback, useMemo, lazy, Suspense } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useProjectStore } from "../hooks/useProjectStore";
import { useSettings } from "../context/SettingsContext";
import { setActivePage } from "../stores/projectStore";
import { useToast } from "../context/ToastContext";
import { PageShell } from "../components/layout/PageShell";
import {
  fetchSlicesWorkspace,
  createSlice,
  updateSlice,
  deleteSlice,
  voteSlice,
  fetchSliceBuildPack,
  postProjectComment,
  postProjectDecision,
  type FeatureSliceItem,
  type ProjectCommentItem,
  type ProjectDecisionItem,
} from "../services/akashaV2Service";
import {
  Plus,
  ThumbsUp,
  MessageSquare,
  FileCode2,
  CheckSquare,
  ShieldAlert,
  BookOpen,
  Copy,
  Trash2,
  X,
  Search,
  Layers,
  FileText,
} from "lucide-react";

const IdeaPage = lazy(() => import("./IdeaPage"));

const LANE_META: Record<string, { label: string; short: string; cls: string }> = {
  mvp: {
    label: "MVP (Ship first)",
    short: "MVP",
    cls: "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30",
  },
  v1_1: {
    label: "Next release",
    short: "V1.1",
    cls: "bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30",
  },
  later: {
    label: "Later",
    short: "Later",
    cls: "bg-[var(--ide-accent-subtle)] text-[var(--ide-text-secondary)] border-[var(--ide-border)]",
  },
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  proposed: { label: "Proposed", cls: "bg-[var(--ide-accent-subtle)] text-[var(--ide-text-secondary)]" },
  aligned: { label: "Aligned", cls: "bg-[#1B5BFF]/10 text-[#1B5BFF] dark:text-[#7AA3FF]" },
  prototyped: { label: "Prototyped", cls: "bg-violet-50 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300" },
  in_build: { label: "In build", cls: "bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  needs_sync: {
    label: "Needs sync",
    cls: "bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/35",
  },
  shipped: { label: "Shipped", cls: "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
};

const ScopeFeaturesPage: React.FC = () => {
  const { project } = useProjectStore();
  const { memberName } = useSettings();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<"slices" | "spec" | "decisions">("slices");
  const [laneFilter, setLaneFilter] = useState<"all" | "mvp" | "v1_1" | "later">("all");
  const [sliceSearch, setSliceSearch] = useState("");
  const [slices, setSlices] = useState<FeatureSliceItem[]>([]);
  const [comments, setComments] = useState<ProjectCommentItem[]>([]);
  const [decisions, setDecisions] = useState<ProjectDecisionItem[]>([]);
  const [selectedSliceId, setSelectedSliceId] = useState<string | null>(null);

  // New Slice modal state
  const [showNewSlice, setShowNewSlice] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSummary, setNewSummary] = useState("");
  const [newLane, setNewLane] = useState<"mvp" | "v1_1" | "later">("mvp");
  const [newOwner, setNewOwner] = useState("Fullstack Engineer");
  const [newCriteriaText, setNewCriteriaText] = useState("");
  const [newEdgeText, setNewEdgeText] = useState("");

  // Comment & Decision inputs
  const [commentBody, setCommentBody] = useState("");
  const [decTitle, setDecTitle] = useState("");
  const [decContext, setDecContext] = useState("");
  const [decChoice, setDecChoice] = useState("");

  // Build Pack modal
  const [buildPack, setBuildPack] = useState<{ title: string; markdown: string; tokens: number } | null>(null);

  const voterName = memberName?.trim() || "Founder";

  const loadData = useCallback(async () => {
    if (!project?.id) return;
    try {
      const ws = await fetchSlicesWorkspace(project.id);
      setSlices(ws.slices || []);
      setComments(ws.comments || []);
      setDecisions(ws.decisions || []);
      if (!selectedSliceId && ws.slices && ws.slices.length > 0) {
        setSelectedSliceId(ws.slices[0]!.id);
      }
    } catch (err) {
      console.error("Failed to load slices:", err);
    }
  }, [project?.id, selectedSliceId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const visibleSlices = useMemo(() => {
    const q = sliceSearch.trim().toLowerCase();
    return slices.filter((s) => {
      if (laneFilter !== "all" && s.lane !== laneFilter) return false;
      if (!q) return true;
      return s.title.toLowerCase().includes(q) || s.summary.toLowerCase().includes(q);
    });
  }, [slices, laneFilter, sliceSearch]);

  if (!project) return null;

  const selectedSlice = slices.find((s) => s.id === selectedSliceId) || visibleSlices[0] || null;
  const sliceComments = selectedSlice
    ? comments.filter((c) => c.targetType === "slice" && c.targetId === selectedSlice.id)
    : [];

  const handleCreateSlice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    try {
      const created = await createSlice({
        projectId: project.id,
        title: newTitle.trim(),
        summary: newSummary.trim(),
        lane: newLane,
        owner: newOwner.trim() || "Team",
        acceptanceCriteria: newCriteriaText.split("\n").map((s) => s.trim()).filter(Boolean),
        edgeCases: newEdgeText.split("\n").map((s) => s.trim()).filter(Boolean),
      });
      setShowNewSlice(false);
      setNewTitle("");
      setNewSummary("");
      setNewCriteriaText("");
      setNewEdgeText("");
      setSelectedSliceId(created.id);
      toast.showToast(`Created "${created.title}"`, "success");
      await loadData();
    } catch (err: any) {
      toast.showToast(`Could not create slice: ${err?.message || err}`, "error");
    }
  };

  const handleToggleCriterion = async (slice: FeatureSliceItem, critId: string) => {
    const next = slice.acceptanceCriteria.map((c) => (c.id === critId ? { ...c, done: !c.done } : c));
    await updateSlice(slice.id, { acceptanceCriteria: next });
    await loadData();
  };

  const handleToggleEdgeCase = async (slice: FeatureSliceItem, edgeId: string) => {
    const next = slice.edgeCases.map((e) => (e.id === edgeId ? { ...e, covered: !e.covered } : e));
    await updateSlice(slice.id, { edgeCases: next });
    await loadData();
  };

  const handleLaneChange = async (slice: FeatureSliceItem, lane: "mvp" | "v1_1" | "later") => {
    await updateSlice(slice.id, { lane });
    await loadData();
  };

  const handleStatusChange = async (slice: FeatureSliceItem, status: FeatureSliceItem["status"]) => {
    await updateSlice(slice.id, { status });
    await loadData();
  };

  const handleVote = async (sliceId: string, vote: "mvp" | "next" | "cut") => {
    await voteSlice(sliceId, voterName, vote);
    toast.showToast(`Recorded ${voterName}'s vote`, "success");
    await loadData();
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlice || !commentBody.trim()) return;
    await postProjectComment({
      projectId: project.id,
      targetType: "slice",
      targetId: selectedSlice.id,
      author: voterName,
      body: commentBody.trim(),
    });
    setCommentBody("");
    await loadData();
  };

  const handleOpenBuildPack = async (slice: FeatureSliceItem) => {
    try {
      const pack = await fetchSliceBuildPack(project.id, slice.id);
      setBuildPack({
        title: slice.title,
        markdown: pack.markdownPrompt,
        tokens: pack.estimatedTokens,
      });
    } catch (err: any) {
      toast.showToast(`Could not compile build pack: ${err?.message || err}`, "error");
    }
  };

  const handleAddDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!decTitle.trim() || !decChoice.trim()) return;
    await postProjectDecision({
      projectId: project.id,
      title: decTitle.trim(),
      context: decContext.trim(),
      decision: decChoice.trim(),
      author: voterName,
      linkedSliceId: selectedSlice?.id,
    });
    setDecTitle("");
    setDecContext("");
    setDecChoice("");
    toast.showToast("Decision saved", "success");
    await loadData();
  };

  return (
    <PageShell
      title="Features & scope"
      subtitle="Bundle user stories, acceptance checklists, edge cases, and linked data contracts into vertical slices."
      tabs={[
        { id: "slices", label: "Feature slices", badge: slices.length, icon: <Layers className="w-3.5 h-3.5" /> },
        { id: "decisions", label: "Team decisions", badge: decisions.length, icon: <BookOpen className="w-3.5 h-3.5" /> },
        { id: "spec", label: "Product spec", icon: <FileText className="w-3.5 h-3.5" /> },
      ]}
      activeTab={activeTab}
      onTabChange={(t) => setActiveTab(t as any)}
      fullBleed={activeTab === "spec"}
      actions={
        activeTab === "slices" ? (
          <button
            type="button"
            onClick={() => setShowNewSlice(true)}
            className="btn-primary h-9 px-4 text-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            New feature slice
          </button>
        ) : undefined
      }
    >
      {activeTab === "spec" && (
        <Suspense fallback={<div className="p-8 text-sm text-[var(--ide-text-muted)]">Loading product spec...</div>}>
          <IdeaPage />
        </Suspense>
      )}

      {activeTab === "decisions" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form onSubmit={handleAddDecision} className="lg:col-span-4 studio-surface p-5 space-y-3">
            <h2 className="text-sm font-bold text-[var(--ide-text)]">Record a team decision</h2>
            <p className="text-xs text-[var(--ide-text-secondary)]">
              Decisions are shared automatically with teammates and AI agents via MCP.
            </p>
            <input
              value={decTitle}
              onChange={(e) => setDecTitle(e.target.value)}
              placeholder="e.g. Support guest checkout before accounts"
              required
              className="input-modern w-full h-9 text-xs"
            />
            <textarea
              value={decContext}
              onChange={(e) => setDecContext(e.target.value)}
              placeholder="Context or trade-offs considered (optional)"
              rows={2}
              className="w-full p-3 rounded-lg text-xs bg-[var(--ide-bg)] border border-[var(--ide-border)] text-[var(--ide-text)] focus:outline-none focus:border-[#1B5BFF] resize-none"
            />
            <textarea
              value={decChoice}
              onChange={(e) => setDecChoice(e.target.value)}
              placeholder="What did the team decide?"
              required
              rows={3}
              className="w-full p-3 rounded-lg text-xs bg-[var(--ide-bg)] border border-[var(--ide-border)] text-[var(--ide-text)] focus:outline-none focus:border-[#1B5BFF] resize-none"
            />
            <button type="submit" className="btn-primary w-full h-9 text-xs">
              Save decision
            </button>
          </form>

          <div className="lg:col-span-8 space-y-3">
            {decisions.length === 0 ? (
              <div className="p-10 rounded-2xl border border-dashed border-[var(--ide-border-strong)] text-center text-sm text-[var(--ide-text-secondary)]">
                No decisions logged yet. Capture key product choices here so nobody has to re-litigate them later.
              </div>
            ) : (
              decisions.map((d) => (
                <div key={d.id} className="studio-surface p-5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-[var(--ide-text)]">{d.title}</h3>
                    <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                      Agreed by {d.author}
                    </span>
                  </div>
                  {d.context && (
                    <p className="text-xs text-[var(--ide-text-secondary)] leading-relaxed">{d.context}</p>
                  )}
                  <p className="text-sm text-[var(--ide-text)] bg-[var(--ide-bg)] p-3 rounded-xl border border-[var(--ide-border)]">
                    {d.decision}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === "slices" && (
        <div className="space-y-4">
          {/* Filter + Search Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              {(["all", "mvp", "v1_1", "later"] as const).map((lane) => {
                const count = lane === "all" ? slices.length : slices.filter((s) => s.lane === lane).length;
                const active = laneFilter === lane;
                return (
                  <button
                    key={lane}
                    type="button"
                    onClick={() => setLaneFilter(lane)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                      active
                        ? "bg-[#1B5BFF] text-white border-[#1B5BFF]"
                        : "bg-[var(--ide-bg-elevated)] border-[var(--ide-border)] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)]"
                    }`}
                  >
                    {lane === "all" ? "All slices" : LANE_META[lane]!.label} ({count})
                  </button>
                );
              })}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-[var(--ide-text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={sliceSearch}
                onChange={(e) => setSliceSearch(e.target.value)}
                placeholder="Search slices..."
                className="input-modern h-9 w-full pl-8 pr-3 text-xs"
              />
            </div>
          </div>

          {visibleSlices.length === 0 ? (
            <div className="p-12 rounded-2xl border border-dashed border-[var(--ide-border-strong)] text-center space-y-2 bg-[var(--ide-bg-elevated)]">
              <p className="text-sm font-semibold text-[var(--ide-text)]">No matching feature slices</p>
              <p className="text-xs text-[var(--ide-text-secondary)]">
                Create a slice manually or apply a starter blueprint from Overview.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left: Slice List */}
              <div className="lg:col-span-5 studio-surface divide-y divide-[var(--ide-border)] overflow-hidden">
                {visibleSlices.map((slice) => {
                  const active = selectedSlice?.id === slice.id;
                  const mvpVotes = slice.votes.filter((v) => v.vote === "mvp").length;
                  const totalAc = slice.acceptanceCriteria.length;
                  const doneAc = slice.acceptanceCriteria.filter((c) => c.done).length;
                  const pct = totalAc > 0 ? Math.round((doneAc / totalAc) * 100) : 0;

                  return (
                    <button
                      key={slice.id}
                      type="button"
                      onClick={() => setSelectedSliceId(slice.id)}
                      className={`w-full text-left p-4 transition-colors cursor-pointer space-y-2.5 ${
                        active
                          ? "bg-[#1B5BFF]/[0.06] dark:bg-[#5B8CFF]/12 border-l-[3px] border-l-[#1B5BFF]"
                          : "hover:bg-[var(--ide-accent-subtle)]/65 border-l-[3px] border-l-transparent"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${
                            LANE_META[slice.lane]?.cls || ""
                          }`}
                        >
                          {LANE_META[slice.lane]?.short || slice.lane}
                        </span>
                        <span
                          className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${
                            STATUS_META[slice.status]?.cls || ""
                          }`}
                        >
                          {STATUS_META[slice.status]?.label || slice.status}
                        </span>
                      </div>

                      <div>
                        <h3 className="text-sm font-bold text-[var(--ide-text)]">{slice.title}</h3>
                        <p className="text-xs text-[var(--ide-text-secondary)] mt-0.5 line-clamp-2 leading-relaxed">
                          {slice.summary}
                        </p>
                      </div>

                      <div className="flex items-center justify-between gap-3 text-xs text-[var(--ide-text-muted)]">
                        <span>
                          {slice.linkedModels.length} models, {slice.linkedApis.length} APIs
                        </span>
                        <span className="font-medium">
                          {doneAc}/{totalAc} checks ({pct}%)
                        </span>
                        <span>{mvpVotes} MVP votes</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Right: Selected Slice Detail */}
              {selectedSlice && (
                <div className="lg:col-span-7 studio-surface p-6 space-y-5">
                  <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-[var(--ide-border)]">
                    <div className="min-w-0">
                      <h2 className="text-lg font-bold text-[var(--ide-text)] tracking-tight">
                        {selectedSlice.title}
                      </h2>
                      <p className="text-sm text-[var(--ide-text-secondary)] mt-1 leading-relaxed">
                        {selectedSlice.summary}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenBuildPack(selectedSlice)}
                        className="btn-primary h-8 px-3 text-xs"
                      >
                        <FileCode2 className="w-3.5 h-3.5" />
                        MCP build pack
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await deleteSlice(selectedSlice.id);
                          setSelectedSliceId(null);
                          toast.showToast("Slice deleted", "info");
                          await loadData();
                        }}
                        className="p-2 rounded-lg text-[var(--ide-text-muted)] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 cursor-pointer"
                        title="Delete slice"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Lane, Status & Team Voting */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-[var(--ide-text-secondary)] block">
                        Priority lane
                      </label>
                      <select
                        value={selectedSlice.lane}
                        onChange={(e) => handleLaneChange(selectedSlice, e.target.value as any)}
                        className="input-modern w-full h-9 text-xs"
                      >
                        <option value="mvp">MVP (Ship first)</option>
                        <option value="v1_1">Next release</option>
                        <option value="later">Later</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-[var(--ide-text-secondary)] block">
                        Status
                      </label>
                      <select
                        value={selectedSlice.status}
                        onChange={(e) => handleStatusChange(selectedSlice, e.target.value as any)}
                        className="input-modern w-full h-9 text-xs"
                      >
                        <option value="proposed">Proposed</option>
                        <option value="aligned">Aligned</option>
                        <option value="prototyped">Prototyped</option>
                        <option value="in_build">In build</option>
                        <option value="needs_sync">Needs sync</option>
                        <option value="shipped">Shipped</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-[var(--ide-text-secondary)] block">
                        Vote as {voterName}
                      </label>
                      <div className="flex gap-1">
                        {(["mvp", "next", "cut"] as const).map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => handleVote(selectedSlice.id, v)}
                            className="flex-1 h-9 rounded-lg text-xs font-semibold bg-[var(--ide-bg)] hover:bg-[#1B5BFF]/10 hover:text-[#1B5BFF] border border-[var(--ide-border)] cursor-pointer inline-flex items-center justify-center gap-1 transition-colors"
                          >
                            <ThumbsUp className="w-3 h-3" />
                            <span>{v === "mvp" ? "MVP" : v === "next" ? "Next" : "Cut"}</span>
                            <span className="opacity-70">
                              ({selectedSlice.votes.filter((x) => x.vote === v).length})
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Linked Architecture Graph */}
                  <div className="p-3.5 rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)] space-y-2 text-xs">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-[var(--ide-text-secondary)] w-16">Models</span>
                      {selectedSlice.linkedModels.length > 0 ? (
                        selectedSlice.linkedModels.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setActivePage("blueprint")}
                            className="px-2 py-0.5 rounded-md bg-[#1B5BFF]/10 text-[#1B5BFF] dark:text-[#7AA3FF] font-mono text-[11px] cursor-pointer"
                          >
                            {m.name} ({m.fieldCount})
                          </button>
                        ))
                      ) : (
                        <span className="text-[var(--ide-text-muted)]">None linked</span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-[var(--ide-text-secondary)] w-16">APIs</span>
                      {selectedSlice.linkedApis.length > 0 ? (
                        selectedSlice.linkedApis.map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => setActivePage("blueprint")}
                            className="px-2 py-0.5 rounded-md bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300 font-mono text-[11px] cursor-pointer"
                          >
                            {a.method} {a.path}
                          </button>
                        ))
                      ) : (
                        <span className="text-[var(--ide-text-muted)]">None linked</span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-[var(--ide-text-secondary)] w-16">Screens</span>
                      {selectedSlice.linkedPages.length > 0 ? (
                        selectedSlice.linkedPages.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setActivePage("studio")}
                            className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-mono text-[11px] cursor-pointer"
                          >
                            {p.name} ({p.path})
                          </button>
                        ))
                      ) : (
                        <span className="text-[var(--ide-text-muted)]">None linked</span>
                      )}
                    </div>
                  </div>

                  {/* Acceptance Criteria + Edge Cases */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="text-xs font-bold flex items-center gap-1.5 text-[var(--ide-text)]">
                        <CheckSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        Acceptance criteria
                      </div>
                      <div className="space-y-1.5">
                        {selectedSlice.acceptanceCriteria.map((c) => (
                          <label
                            key={c.id}
                            className="flex items-start gap-2.5 text-xs p-2.5 rounded-lg bg-[var(--ide-bg)] border border-[var(--ide-border)] cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={c.done}
                              onChange={() => handleToggleCriterion(selectedSlice, c.id)}
                              className="mt-0.5 accent-[#1B5BFF]"
                            />
                            <span
                              className={
                                c.done
                                  ? "line-through text-[var(--ide-text-muted)]"
                                  : "text-[var(--ide-text)]"
                              }
                            >
                              {c.text}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-xs font-bold flex items-center gap-1.5 text-[var(--ide-text)]">
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                        Domain edge cases
                      </div>
                      <div className="space-y-1.5">
                        {selectedSlice.edgeCases.map((e) => (
                          <label
                            key={e.id}
                            className="flex items-start gap-2.5 text-xs p-2.5 rounded-lg bg-amber-50/60 dark:bg-amber-500/10 border border-amber-200/80 dark:border-amber-500/25 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={e.covered}
                              onChange={() => handleToggleEdgeCase(selectedSlice, e.id)}
                              className="mt-0.5 accent-amber-500"
                            />
                            <span
                              className={
                                e.covered
                                  ? "line-through text-[var(--ide-text-muted)]"
                                  : "text-[var(--ide-text)]"
                              }
                            >
                              {e.text}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Team Discussion */}
                  <div className="space-y-2.5 pt-4 border-t border-[var(--ide-border)]">
                    <div className="text-xs font-bold flex items-center gap-1.5 text-[var(--ide-text)]">
                      <MessageSquare className="w-3.5 h-3.5 text-[#1B5BFF] dark:text-[#7AA3FF]" />
                      Discussion ({sliceComments.length})
                    </div>
                    {sliceComments.length > 0 && (
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {sliceComments.map((c) => (
                          <div
                            key={c.id}
                            className="p-2.5 rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)] text-xs"
                          >
                            <span className="font-semibold text-[#1B5BFF] dark:text-[#7AA3FF]">{c.author}: </span>
                            <span className="text-[var(--ide-text)]">{c.body}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <form onSubmit={handlePostComment} className="flex gap-2">
                      <input
                        value={commentBody}
                        onChange={(e) => setCommentBody(e.target.value)}
                        placeholder={`Add a note as ${voterName}...`}
                        className="input-modern flex-1 h-9 text-xs"
                      />
                      <button type="submit" className="btn-primary h-9 px-4 text-xs">
                        Post
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* New Slice Modal */}
      <AnimatePresence>
        {showNewSlice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNewSlice(false)}
              className="fixed inset-0 bg-slate-900/35 dark:bg-black/65 backdrop-blur-[2px]"
            />
            <motion.form
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              onSubmit={handleCreateSlice}
              className="relative z-10 w-full max-w-lg rounded-2xl bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] p-6 space-y-3.5 shadow-[var(--ide-shadow-premium)]"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-[var(--ide-text)]">New feature slice</h3>
                <button
                  type="button"
                  onClick={() => setShowNewSlice(false)}
                  className="p-1 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                required
                placeholder="Feature title (e.g. Discount coupons & promo codes)"
                className="input-modern w-full h-10 text-sm"
              />
              <textarea
                value={newSummary}
                onChange={(e) => setNewSummary(e.target.value)}
                rows={2}
                placeholder="What user outcome does this slice deliver?"
                className="w-full p-3 rounded-lg text-xs bg-[var(--ide-bg)] border border-[var(--ide-border)] text-[var(--ide-text)] focus:outline-none focus:border-[#1B5BFF] resize-none"
              />
              <div className="grid grid-cols-2 gap-2.5">
                <select
                  value={newLane}
                  onChange={(e) => setNewLane(e.target.value as any)}
                  className="input-modern h-9 text-xs"
                >
                  <option value="mvp">MVP (Ship first)</option>
                  <option value="v1_1">Next release</option>
                  <option value="later">Later</option>
                </select>
                <input
                  value={newOwner}
                  onChange={(e) => setNewOwner(e.target.value)}
                  placeholder="Owner or role"
                  className="input-modern h-9 text-xs"
                />
              </div>
              <textarea
                value={newCriteriaText}
                onChange={(e) => setNewCriteriaText(e.target.value)}
                rows={3}
                placeholder="Acceptance criteria (one per line)"
                className="w-full p-3 rounded-lg text-xs bg-[var(--ide-bg)] border border-[var(--ide-border)] text-[var(--ide-text)] focus:outline-none focus:border-[#1B5BFF]"
              />
              <textarea
                value={newEdgeText}
                onChange={(e) => setNewEdgeText(e.target.value)}
                rows={2}
                placeholder="Edge cases to handle (one per line)"
                className="w-full p-3 rounded-lg text-xs bg-[var(--ide-bg)] border border-[var(--ide-border)] text-[var(--ide-text)] focus:outline-none focus:border-[#1B5BFF]"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowNewSlice(false)} className="btn-ghost h-9 px-4 text-xs">
                  Cancel
                </button>
                <button type="submit" className="btn-primary h-9 px-4 text-xs">
                  Create slice
                </button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

      {/* MCP Feature Build Pack Modal */}
      <AnimatePresence>
        {buildPack && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setBuildPack(null)}
              className="fixed inset-0 bg-slate-900/35 dark:bg-black/65 backdrop-blur-[2px]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className="relative z-10 w-full max-w-2xl rounded-2xl bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] p-6 space-y-4 shadow-[var(--ide-shadow-premium)]"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-[var(--ide-text)]">{buildPack.title}</h3>
                  <p className="text-xs text-[var(--ide-text-secondary)]">
                    Scoped MCP build pack (~{buildPack.tokens} tokens)
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(buildPack.markdown);
                      toast.showToast("Build pack copied", "success");
                    }}
                    className="btn-primary h-8 px-3 text-xs"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copy pack
                  </button>
                  <button
                    type="button"
                    onClick={() => setBuildPack(null)}
                    className="p-1.5 rounded-lg text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <pre className="max-h-[420px] overflow-y-auto p-4 rounded-xl bg-[#0F172A] text-slate-100 text-xs font-mono whitespace-pre-wrap">
                {buildPack.markdown}
              </pre>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </PageShell>
  );
};

export default ScopeFeaturesPage;
