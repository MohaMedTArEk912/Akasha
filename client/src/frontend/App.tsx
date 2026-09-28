/**
 * Akasha — Main Application - React version
 * 
 * Web-Based Visual Full-Stack IDE
 */

import React, { useEffect } from "react";
import "./index.css";

// Components
import IDELayout from "./components/layout/IDELayout";
import DashboardLanding from "./pages/DashboardLanding";
import ErrorBoundary from './components/ui/ErrorBoundary';
import FloatingBot from "./components/features/Bot/FloatingBot";

// Stores
import { initWorkspace } from "./stores/projectStore";
// Hooks
import { useProjectStore } from "./hooks/useProjectStore";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
// Context
import { ToastProvider } from "./context/ToastContext";
import { ThemeProvider } from "./context/ThemeContext";
import { DragDropProvider } from "./context/DragDropContext";
import { SettingsProvider } from "./context/SettingsContext";
import { BackgroundLoadingProvider } from "./context/BackgroundLoadingContext";

import { handleAddLibraryFromUrlIfPresent } from "./utils/excalidrawLibrarySync";

const AppContent: React.FC = () => {
  const { project, isDashboardActive } = useProjectStore();
  useKeyboardShortcuts();

  // Initialize workspace, restore project, and handle library imports
  useEffect(() => {
    const initialize = async () => {
      try {
        await initWorkspace();
        // Check if page loaded with #addLibrary=<url>
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
  }, []);

  // Main navigation logic
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
      <SettingsProvider>
        <ThemeProvider>
          <ToastProvider>
            <BackgroundLoadingProvider>
              <AppContent />
            </BackgroundLoadingProvider>
          </ToastProvider>
        </ThemeProvider>
      </SettingsProvider>
    </ErrorBoundary>
  );
};

export default App;
