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

const App: React.FC = () => {
  const { project, isDashboardActive, activePage } = useProjectStore();
  useKeyboardShortcuts();

  // Initialize workspace and try to load any existing project on mount
  useEffect(() => {
    const initialize = async () => {
      try {
        await initWorkspace();
      } catch (err) {
        console.error("Initialization failed:", err);
      }
    };
    initialize();
  }, []);

  // Main navigation logic
  if (isDashboardActive || !project) {
    return (
      <ErrorBoundary>
        <SettingsProvider>
          <ThemeProvider>
            <ToastProvider>
              <DashboardLanding />
            </ToastProvider>
          </ThemeProvider>
        </SettingsProvider>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <SettingsProvider>
        <ThemeProvider>
          <ToastProvider>
            <DragDropProvider>
              <IDELayout />
              {activePage !== "idea" && <FloatingBot />}
            </DragDropProvider>
          </ToastProvider>
        </ThemeProvider>
      </SettingsProvider>
    </ErrorBoundary>
  );
};

export default App;
