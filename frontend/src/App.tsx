/**
 * Grapes IDE - Main Application
 * 
 * Desktop-First Visual Full-Stack IDE
 */

import { Component, onMount, Switch, Match } from "solid-js";
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

const App: Component = () => {
  // Try to load any existing project on mount
  onMount(async () => {
    try {
      await loadProject();
    } catch (err) {
      console.log("No project loaded on startup:", err);
    }
  });

  // Render the appropriate canvas based on active tab
  const renderCanvas = () => {
    return (
      <Switch fallback={<Canvas />}>
        <Match when={projectState.activeTab === "canvas"}>
          <Canvas />
        </Match>
        <Match when={projectState.activeTab === "logic"}>
          <LogicCanvas />
        </Match>
        <Match when={projectState.activeTab === "api"}>
          <ApiList />
        </Match>
        <Match when={projectState.activeTab === "erd"}>
          <ERDCanvas />
        </Match>
      </Switch>
    );
  };

  return (
    <IDELayout
      toolbar={<Toolbar />}
      fileTree={<FileTree />}
      canvas={renderCanvas()}
      inspector={<Inspector />}
    />
  );
};

export default App;
