/**
 * Standalone Shareable Prototype Preview Page (`/preview/:projectId?token=...`)
 * Bright, distraction-free review frame for founders, teammates, and clients.
 */

import React, { useEffect, useState, useCallback } from "react";
import { motion } from "motion/react";
import {
  fetchPrototypeManifest,
  resetMockSeed,
  postPreviewPin,
  type PrototypeManifest,
} from "../services/akashaV2Service";
import { Monitor, Tablet, Smartphone, MapPin, RotateCcw, ArrowLeft } from "lucide-react";
import { useDocumentMeta } from "../hooks/useDocumentMeta";

interface ShareablePreviewPageProps {
  projectId: string;
  token?: string;
}

const ShareablePreviewPage: React.FC<ShareablePreviewPageProps> = ({ projectId, token }) => {
  const [manifest, setManifest] = useState<PrototypeManifest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activePath, setActivePath] = useState("");
  const [viewport, setViewport] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [pinMode, setPinMode] = useState(false);
  const [pendingPin, setPendingPin] = useState<{ x: number; y: number } | null>(null);
  const [author, setAuthor] = useState("Reviewer");
  const [comment, setComment] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    try {
      const m = await fetchPrototypeManifest(projectId, token);
      setManifest(m);
      setError(null);
      if (!activePath && m.pages.length > 0) {
        setActivePath(m.pages[0]!.path);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || "Preview unavailable");
    }
  }, [projectId, token, activePath]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const handler = (ev: MessageEvent) => {
      if (ev.data?.type === "akasha-navigate" && typeof ev.data.path === "string") {
        setActivePath(ev.data.path);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const currentPage = manifest?.pages.find((p) => p.path === activePath) || manifest?.pages[0] || null;
  const width = viewport === "mobile" ? "390px" : viewport === "tablet" ? "768px" : "100%";

  useDocumentMeta({
    title: manifest?.projectName
      ? `${currentPage ? `${currentPage.name} · ` : ""}${manifest.projectName} — Live Prototype | Akasha`
      : "Live Prototype — Akasha",
    description:
      manifest?.projectDescription ||
      "Interactive live prototype built with Akasha Product Studio.",
    robots: token ? "noindex, nofollow" : "index, follow",
  });

  if (error) {
    return (
      <div className="h-screen w-screen bg-[var(--ide-bg)] text-[var(--ide-text)] flex flex-col items-center justify-center p-6 text-center gap-4">
        <h1 className="text-xl font-bold">Preview unavailable</h1>
        <p className="text-sm text-[var(--ide-text-secondary)] max-w-md">{error}</p>
        <a href="/" className="btn-primary px-4">
          Return to Akasha Studio
        </a>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-[var(--ide-bg)] text-[var(--ide-text)] overflow-hidden">
      <header className="h-14 px-4 sm:px-6 border-b border-[var(--ide-border)] bg-[var(--ide-bg-elevated)] flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <a
            href="/"
            className="p-2 rounded-lg border border-[var(--ide-border)] bg-[var(--ide-bg)] hover:bg-[var(--ide-accent-subtle)] text-[var(--ide-text-secondary)]"
            title="Back to Studio"
          >
            <ArrowLeft className="w-4 h-4" />
          </a>
          <div className="min-w-0">
            <div className="text-sm font-bold truncate text-[var(--ide-text)]">
              {manifest?.projectName || "Live preview"}
            </div>
            <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              Interactive prototype
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          {(manifest?.pages || []).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setActivePath(p.path)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                currentPage?.id === p.id
                  ? "bg-[#1B5BFF] text-white"
                  : "bg-[var(--ide-accent-subtle)] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)]"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden sm:flex items-center bg-[var(--ide-accent-subtle)] border border-[var(--ide-border)] p-0.5 rounded-lg">
            {(
              [
                ["desktop", Monitor],
                ["tablet", Tablet],
                ["mobile", Smartphone],
              ] as const
            ).map(([vp, Icon]) => (
              <button
                key={vp}
                type="button"
                onClick={() => setViewport(vp)}
                className={`p-1.5 rounded-md cursor-pointer ${
                  viewport === vp
                    ? "bg-[var(--ide-bg-elevated)] text-[#1B5BFF] shadow-xs"
                    : "text-[var(--ide-text-muted)]"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setPinMode(!pinMode)}
            className={`h-8 px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer border ${
              pinMode
                ? "bg-amber-500 text-white border-amber-500"
                : "bg-[var(--ide-bg-elevated)] border-[var(--ide-border)] text-[var(--ide-text)]"
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            {pinMode ? "Click screen" : "Pin feedback"}
          </button>

          <button
            type="button"
            onClick={async () => {
              await resetMockSeed(projectId);
              setRefreshKey((k) => k + 1);
            }}
            className="btn-ghost h-8 w-8 p-0"
            title="Reset demo data"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-4 sm:p-6 flex justify-center relative bg-[var(--ide-canvas-bg)]">
        <motion.div
          layout
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          className="relative h-full rounded-2xl overflow-hidden border border-[var(--ide-border-strong)] bg-white shadow-[var(--ide-shadow)]"
          style={{ width }}
        >
          {currentPage && (
            <iframe
              key={`${currentPage.id}-${refreshKey}`}
              title={currentPage.name}
              srcDoc={currentPage.html}
              className="w-full h-full border-0"
            />
          )}
          {pinMode && (
            <div
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setPendingPin({
                  x: Math.round(((e.clientX - rect.left) / rect.width) * 100),
                  y: Math.round(((e.clientY - rect.top) / rect.height) * 100),
                });
              }}
              className="absolute inset-0 bg-amber-500/10 cursor-crosshair z-20"
            />
          )}
        </motion.div>

        {pendingPin && currentPage && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!comment.trim()) return;
              await postPreviewPin(projectId, {
                pageId: currentPage.id,
                pagePath: currentPage.path,
                author,
                body: comment.trim(),
                x: pendingPin.x,
                y: pendingPin.y,
                token,
              });
              setPendingPin(null);
              setComment("");
              setPinMode(false);
              await load();
            }}
            className="fixed bottom-6 right-6 z-40 w-80 p-4 rounded-2xl bg-[var(--ide-bg-elevated)] border border-amber-300 dark:border-amber-500/50 shadow-[var(--ide-shadow-premium)] space-y-2.5"
          >
            <div className="text-xs font-bold text-amber-700 dark:text-amber-300">
              Leave feedback on {currentPage.name}
            </div>
            <input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Your name"
              className="input-modern h-8 w-full text-xs"
            />
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              required
              rows={2}
              placeholder="What should the team adjust?"
              className="w-full p-2.5 rounded-lg text-xs bg-[var(--ide-bg)] border border-[var(--ide-border)] text-[var(--ide-text)] resize-none"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs cursor-pointer"
              >
                Send feedback
              </button>
              <button
                type="button"
                onClick={() => setPendingPin(null)}
                className="px-3 py-1.5 rounded-lg text-xs text-[var(--ide-text-secondary)] cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ShareablePreviewPage;
