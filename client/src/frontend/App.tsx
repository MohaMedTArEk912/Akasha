/**
 * Akasha — Main Application
 * Small-Team Product Studio + Shareable Live Prototype Preview (`/preview/:projectId`)
 */

import React, { useEffect, lazy, Suspense } from "react";
import { MotionConfig } from "motion/react";
import "./index.css";

import IDELayout from "./components/layout/IDELayout";
import DashboardLanding from "./pages/DashboardLanding";
import ErrorBoundary from "./components/ui/ErrorBoundary";
import FloatingBot from "./components/features/Bot/FloatingBot";

import { initWorkspace } from "./stores/projectStore";
import { useProjectStore } from "./hooks/useProjectStore";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { ToastProvider } from "./context/ToastContext";
import { ThemeProvider } from "./context/ThemeContext";
import { DragDropProvider } from "./context/DragDropContext";
import { SettingsProvider } from "./context/SettingsContext";
import { BackgroundLoadingProvider } from "./context/BackgroundLoadingContext";
import { handleAddLibraryFromUrlIfPresent } from "./utils/excalidrawLibrarySync";

const ShareablePreviewPage = lazy(() => import("./pages/ShareablePreviewPage"));

function parsePreviewRoute(): { projectId: string; token?: string } | null {
  if (typeof window === "undefined") return null;
  const match = window.location.pathname.match(/^\/preview\/([^/]+)\/?$/);
  if (!match || !match[1]) return null;
  const params = new URLSearchParams(window.location.search);
  return {
    projectId: decodeURIComponent(match[1]),
    token: params.get("token") || undefined,
  };
}

const AppContent: React.FC = () => {
  const previewRoute = parsePreviewRoute();
  const { project, isDashboardActive } = useProjectStore();
  useKeyboardShortcuts();

  useEffect(() => {
    if (previewRoute) return;
    const initialize = async () => {
      try {
        await initWorkspace();
        await handleAddLibraryFromUrlIfPresent();
      } catch (err) {
        console.error("Initialization failed:", err);
      }
    };
    initialize();

    const handleHash = () => {
      void handleAddLibraryFromUrlIfPresent();
    };
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, [Boolean(previewRoute)]);

  // Standalone Shareable Prototype Preview Route (`/preview/:projectId?token=...`)
  if (previewRoute) {
    return (
      <Suspense
        fallback={
          <div className="h-screen w-screen bg-[#F7F8FA] dark:bg-[#0E1117] text-[#475467] dark:text-slate-300 flex items-center justify-center text-sm font-medium">
            Loading live prototype...
          </div>
        }
      >
        <ShareablePreviewPage projectId={previewRoute.projectId} token={previewRoute.token} />
      </Suspense>
    );
  }

  if (isDashboardActive || !project) {
    return <DashboardLanding />;
  }

  return (
    <DragDropProvider>
      <IDELayout />
      <FloatingBot />
    </DragDropProvider>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <MotionConfig reducedMotion="user">
        <SettingsProvider>
          <ThemeProvider>
            <ToastProvider>
              <BackgroundLoadingProvider>
                <AppContent />
              </BackgroundLoadingProvider>
            </ToastProvider>
          </ThemeProvider>
        </SettingsProvider>
      </MotionConfig>
    </ErrorBoundary>
  );
};

export default App;
