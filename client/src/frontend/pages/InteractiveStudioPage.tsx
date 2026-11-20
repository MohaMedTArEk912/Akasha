/**
 * Interactive Studio — Live Connected Multi-Page Prototype + Feedback Pins (View 3 of 6)
 */

import React, { useEffect, useState, useCallback, lazy, Suspense } from "react";
import { motion } from "motion/react";
import { useProjectStore } from "../hooks/useProjectStore";
import { useSettings } from "../context/SettingsContext";
import { useToast } from "../context/ToastContext";
import { PageShell } from "../components/layout/PageShell";
import {
  fetchPrototypeManifest,
  resetMockSeed,
  postPreviewPin,
  resolveProjectComment,
  togglePreviewShare,
  type PrototypeManifest,
} from "../services/akashaV2Service";
import {
  Monitor,
  Tablet,
  Smartphone,
  RefreshCw,
  ExternalLink,
  Copy,
  MapPin,
  CheckCircle2,
  RotateCcw,
  Play,
  Code2,
} from "lucide-react";

const UIIdeationPage = lazy(() => import("./UIIdeationPage"));

const InteractiveStudioPage: React.FC = () => {
  const { project } = useProjectStore();
  const { memberName } = useSettings();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<"prototype" | "sandbox">("prototype");
  const [manifest, setManifest] = useState<PrototypeManifest | null>(null);
  const [activePath, setActivePath] = useState<string>("");
  const [viewport, setViewport] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [pinMode, setPinMode] = useState(false);
  const [pendingPin, setPendingPin] = useState<{ x: number; y: number } | null>(null);
  const [pinAuthor, setPinAuthor] = useState(memberName || "Reviewer");
  const [pinBody, setPinBody] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (memberName) setPinAuthor(memberName);
  }, [memberName]);

  const loadManifest = useCallback(async () => {
    if (!project?.id) return;
    try {
      const m = await fetchPrototypeManifest(project.id);
      setManifest(m);
      if (!activePath && m.pages.length > 0) {
        setActivePath(m.pages[0]!.path);
      }
    } catch (err) {
      console.error("Failed to compile live prototype:", err);
    }
  }, [project?.id, activePath]);

  useEffect(() => {
    void loadManifest();
  }, [loadManifest]);

  useEffect(() => {
    const handler = (ev: MessageEvent) => {
      if (ev.data?.type === "akasha-navigate" && typeof ev.data.path === "string") {
        setActivePath(ev.data.path);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  if (!project) return null;

  const currentPage = manifest?.pages.find((p) => p.path === activePath) || manifest?.pages[0] || null;
  const pagePins = (manifest?.comments || []).filter((c) => currentPage && c.targetId === currentPage.id);
  const shareUrl = `${window.location.origin}/preview/${project.id}${
    manifest?.shareToken ? `?token=${manifest.shareToken}` : ""
  }`;

  const handleResetSeed = async () => {
    setResetting(true);
    try {
      const res = await resetMockSeed(project.id);
      setRefreshKey((k) => k + 1);
      toast.showToast(`Reset mock API with ${res.seededCount || 0} fresh records`, "success");
    } catch (err: any) {
      toast.showToast(`Reset failed: ${err?.message || err}`, "error");
    } finally {
      setResetting(false);
    }
  };

  const handleSubmitPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPage || !pendingPin || !pinBody.trim()) return;
    await postPreviewPin(project.id, {
      pageId: currentPage.id,
      pagePath: currentPage.path,
      author: pinAuthor.trim() || "Reviewer",
      body: pinBody.trim(),
      x: pendingPin.x,
      y: pendingPin.y,
    });
    setPendingPin(null);
    setPinBody("");
    setPinMode(false);
    toast.showToast("Feedback pin saved", "success");
    await loadManifest();
  };

  const viewportWidth = viewport === "mobile" ? "390px" : viewport === "tablet" ? "768px" : "100%";

  return (
    <PageShell
      title="Live prototype"
      subtitle="Test real user journeys wired to your project's stateful mock API and collect pinned stakeholder feedback."
      tabs={[
        {
          id: "prototype",
          label: "Connected app",
          badge: manifest?.pages.length ?? 0,
          icon: <Play className="w-3.5 h-3.5" />,
        },
        { id: "sandbox", label: "HTML sandbox", icon: <Code2 className="w-3.5 h-3.5" /> },
      ]}
      activeTab={activeTab}
      onTabChange={(t) => setActiveTab(t as any)}
      fullBleed
      actions={
        activeTab === "prototype" ? (
          <>
            <div className="flex items-center bg-[var(--ide-accent-subtle)] border border-[var(--ide-border)] p-0.5 rounded-lg">
              {(
                [
                  ["desktop", Monitor, "Desktop"],
                  ["tablet", Tablet, "Tablet"],
                  ["mobile", Smartphone, "Mobile"],
                ] as const
              ).map(([vp, Icon, label]) => (
                <button
                  key={vp}
                  type="button"
                  onClick={() => setViewport(vp)}
                  className={`p-1.5 rounded-md cursor-pointer transition-colors ${
                    viewport === vp
                      ? "bg-[var(--ide-bg-elevated)] text-[#1B5BFF] dark:text-[#7AA3FF] shadow-xs"
                      : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"
                  }`}
                  title={label}
                >
                  <Icon className="w-3.5 h-3.5" />
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setPinMode(!pinMode)}
              className={`h-8 px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer border transition-colors ${
                pinMode
                  ? "bg-amber-500 text-white border-amber-500"
                  : "bg-[var(--ide-bg-elevated)] border-[var(--ide-border)] text-[var(--ide-text)] hover:bg-[var(--ide-accent-subtle)]"
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              {pinMode ? "Click screen to pin" : `Pin feedback (${pagePins.length})`}
            </button>

            <button
              type="button"
              onClick={handleResetSeed}
              disabled={resetting}
              className="btn-ghost h-8 px-3 text-xs"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${resetting ? "animate-spin" : ""}`} />
              Reset data
            </button>

            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(shareUrl);
                toast.showToast("Shareable preview link copied", "success");
              }}
              className="btn-primary h-8 px-3 text-xs"
            >
              <Copy className="w-3.5 h-3.5" />
              Share link
            </button>

            <button
              type="button"
              onClick={() => window.open(shareUrl, "_blank", "noopener")}
              className="btn-ghost h-8 w-8 p-0"
              title="Open standalone preview"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </>
        ) : undefined
      }
    >
      {activeTab === "sandbox" ? (
        <Suspense fallback={<div className="p-8 text-sm text-[var(--ide-text-muted)]">Loading sandbox...</div>}>
          <UIIdeationPage />
        </Suspense>
      ) : (
        <div className="h-full w-full flex overflow-hidden">
          {/* Main Interactive Preview Column */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* Screen Switcher Bar */}
            <div className="px-4 py-2 border-b border-[var(--ide-border)] bg-[var(--ide-bg-elevated)] flex items-center justify-between gap-2 overflow-x-auto">
              <div className="flex items-center gap-1.5">
                {(manifest?.pages || []).map((p) => {
                  const isActive = currentPage?.id === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setActivePath(p.path)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                        isActive
                          ? "bg-[#1B5BFF] text-white"
                          : "bg-[var(--ide-accent-subtle)] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)]"
                      }`}
                    >
                      {p.name}{" "}
                      <span className="opacity-70 font-mono text-[10px] ml-1">{p.path}</span>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => setRefreshKey((k) => k + 1)}
                className="p-1.5 rounded-lg text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-accent-subtle)] cursor-pointer"
                title="Reload preview"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Bright Architectural Device Frame Stage */}
            <div className="flex-1 overflow-auto bg-[var(--ide-canvas-bg)] p-4 sm:p-6 flex justify-center">
              <motion.div
                layout
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                className="relative h-full bg-white dark:bg-[#0E1117] rounded-2xl overflow-hidden border border-[var(--ide-border-strong)] shadow-[var(--ide-shadow)]"
                style={{ width: viewportWidth, minHeight: "560px" }}
              >
                {currentPage ? (
                  <iframe
                    key={`${currentPage.id}-${refreshKey}`}
                    title={currentPage.name}
                    srcDoc={currentPage.html}
                    className="w-full h-full border-0"
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-sm text-[var(--ide-text-muted)]">
                    Compiling connected prototype...
                  </div>
                )}

                {/* Existing Pinned Feedback Markers */}
                {pagePins
                  .filter((c) => !c.resolved && c.pin)
                  .map((c, idx) => (
                    <div
                      key={c.id}
                      style={{ left: `${c.pin!.x}%`, top: `${c.pin!.y}%` }}
                      title={`${c.author}: ${c.body}`}
                      className="absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-amber-500 text-white font-bold text-xs flex items-center justify-center shadow-md border-2 border-white pointer-events-none z-20"
                    >
                      {idx + 1}
                    </div>
                  ))}

                {/* Click Capture Overlay in Pin Mode */}
                {pinMode && (
                  <div
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
                      const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
                      setPendingPin({ x, y });
                    }}
                    className="absolute inset-0 bg-amber-500/10 cursor-crosshair z-30 flex items-start justify-center pt-4"
                  >
                    <span className="px-3.5 py-1.5 rounded-full bg-amber-500 text-white font-semibold text-xs shadow-md">
                      Click anywhere on this screen to drop a feedback pin
                    </span>
                  </div>
                )}
              </motion.div>
            </div>
          </div>

          {/* Right Sidebar: Access & Feedback Pins */}
          <aside className="hidden lg:flex w-72 border-l border-[var(--ide-border)] bg-[var(--ide-bg-elevated)] p-4 flex-col gap-4 overflow-y-auto">
            <div className="space-y-2">
              <div className="text-xs font-bold text-[var(--ide-text)]">Shareable link</div>
              <div className="flex items-center justify-between text-xs p-3 rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)]">
                <span className="text-[var(--ide-text-secondary)]">
                  {manifest?.shareEnabled ? "Public link active" : "Link paused"}
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    await togglePreviewShare(project.id, !manifest?.shareEnabled);
                    await loadManifest();
                    toast.showToast("Updated preview access", "success");
                  }}
                  className="text-[#1B5BFF] dark:text-[#7AA3FF] font-semibold cursor-pointer"
                >
                  {manifest?.shareEnabled ? "Pause" : "Enable"}
                </button>
              </div>
            </div>

            {pendingPin && (
              <form
                onSubmit={handleSubmitPin}
                className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/35 space-y-2.5"
              >
                <div className="text-xs font-bold text-amber-800 dark:text-amber-300">
                  New pin at ({pendingPin.x}%, {pendingPin.y}%)
                </div>
                <input
                  value={pinAuthor}
                  onChange={(e) => setPinAuthor(e.target.value)}
                  placeholder="Your name"
                  className="input-modern h-8 w-full text-xs"
                />
                <textarea
                  value={pinBody}
                  onChange={(e) => setPinBody(e.target.value)}
                  placeholder="What should change on this screen?"
                  required
                  rows={2}
                  className="w-full p-2.5 rounded-lg text-xs bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] text-[var(--ide-text)] resize-none focus:outline-none focus:border-amber-500"
                />
                <div className="flex gap-1.5">
                  <button
                    type="submit"
                    className="flex-1 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs cursor-pointer"
                  >
                    Save pin
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingPin(null)}
                    className="px-2.5 py-1.5 rounded-lg text-xs text-[var(--ide-text-secondary)] cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-2.5 flex-1">
              <div className="text-xs font-bold text-[var(--ide-text)]">
                Screen feedback ({pagePins.length})
              </div>
              {pagePins.length === 0 ? (
                <p className="text-xs text-[var(--ide-text-secondary)] leading-relaxed">
                  No pins on {currentPage?.name || "this screen"} yet. Click Pin feedback or share the link with teammates.
                </p>
              ) : (
                pagePins.map((c, i) => (
                  <div
                    key={c.id}
                    className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                      c.resolved
                        ? "opacity-55 bg-[var(--ide-bg)] border-[var(--ide-border)]"
                        : "bg-[var(--ide-bg)] border-[var(--ide-border)]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[var(--ide-text)]">
                        #{i + 1} {c.author}
                      </span>
                      <button
                        type="button"
                        onClick={async () => {
                          await resolveProjectComment(c.id, !c.resolved);
                          await loadManifest();
                        }}
                        className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        {c.resolved ? "Reopen" : "Resolve"}
                      </button>
                    </div>
                    <p className="text-[var(--ide-text-secondary)] leading-relaxed">{c.body}</p>
                  </div>
                ))
              )}
            </div>
          </aside>
        </div>
      )}
    </PageShell>
  );
};

export default InteractiveStudioPage;
