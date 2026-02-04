/**
 * Grapes IDE - Main Application
 * 
 * Desktop-First Visual Full-Stack IDE
 */

import React, { useEffect } from "react";
import "./index.css";

// Components
import IDELayout from "./components/Layout/IDELayout";
import Toolbar from "./components/Toolbar/Toolbar";
import FileTree from "./components/FileTree/FileTree";
import Canvas from "./components/Canvas/Canvas";
import LogicCanvas from "./components/Canvas/LogicCanvas";
import ERDCanvas from "./components/Canvas/ERDCanvas";
import ApiList from "./components/Canvas/ApiList";
import Inspector from "./components/Inspector/Inspector";

// Stores
import { loadProject, projectState } from "./stores/projectStore";
// Context
import { ToastProvider } from "./context/ToastContext";

const App: React.FC = () => {
  // Try to load any existing project on mount
  useEffect(() => {
    const loadInitialProject = async () => {
      try {
        await loadProject();
      } catch (err) {
        console.log("No project loaded on startup:", err);
      }
    };
    loadInitialProject();
  }, []);

  // Render the appropriate canvas based on active tab
  const renderCanvas = () => {
    switch (projectState.activeTab) {
      case "logic":
        return <LogicCanvas />;
      case "api":
        return <ApiList />;
      case "erd":
        return <ERDCanvas />;
      case "canvas":
      default:
        return <Canvas />;
    }
  };

  return (
    <ToastProvider>
      <IDELayout
        toolbar={<Toolbar />}
        fileTree={<FileTree />}
        canvas={renderCanvas()}
        inspector={<Inspector />}
      />
    </ToastProvider>
  );
};

export default App;
