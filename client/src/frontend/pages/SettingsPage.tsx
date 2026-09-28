import React, { useState, useEffect } from "react";
import { useProjectStore } from "../hooks/useProjectStore";
import { useSettings } from "../context/SettingsContext";
import { useToast } from "../context/ToastContext";
import { renameProject, resetProject, deleteProject, closeProject, setActivePage } from "../stores/projectStore";
import ConfirmModal from "../components/Modals/ConfirmModal";

interface SettingsPageProps {
  onBack?: () => void;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ onBack }) => {
  const { project } = useProjectStore();
  const { apiKey, model, apiBaseUrl, provider, setApiKey, setModel, setApiBaseUrl, setProvider } = useSettings();
  const toast = useToast();

  // Local states for AI Configuration
  const [inputApiKey, setInputApiKey] = useState(apiKey || "");
  const [inputModel, setInputModel] = useState(model || "gemini-2.0-flash");
  const [inputBaseUrl, setInputBaseUrl] = useState(apiBaseUrl || "https://generativelanguage.googleapis.com/v1beta");
  const [selectedProvider, setSelectedProvider] = useState(provider || "gemini");
  const [showApiKey, setShowApiKey] = useState(false);
  const [isTestingAi, setIsTestingAi] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<{ status: "idle" | "success" | "error"; message: string }>({
    status: "idle",
    message: "",
  });

  useEffect(() => {
    if (apiKey) setInputApiKey(apiKey);
    if (model) setInputModel(model);
    if (apiBaseUrl) setInputBaseUrl(apiBaseUrl);
    if (provider) setSelectedProvider(provider);
  }, [apiKey, model, apiBaseUrl, provider]);

  const handleProviderSelect = (p: string) => {
    setSelectedProvider(p);
    if (p === "gemini") {
      setInputBaseUrl("https://generativelanguage.googleapis.com/v1beta");
      setInputModel("gemini-3.6-flash");
    } else if (p === "openrouter") {
      setInputBaseUrl("https://openrouter.ai/api/v1");
      setInputModel("openrouter/free");
    } else if (p === "openai") {
      setInputBaseUrl("https://api.openai.com/v1");
      setInputModel("gpt-4o-mini");
    }
  };

  const handleSaveAiSettings = () => {
    setApiKey(inputApiKey.trim());
    setModel(inputModel.trim());
    setApiBaseUrl(inputBaseUrl.trim());
    setProvider(selectedProvider);
    toast.showToast("AI configuration saved", "success");
  };

  const handleTestAiConnection = async () => {
    if (!inputApiKey.trim()) {
      setAiTestResult({ status: "error", message: "API key is empty. Please enter a valid key." });
      toast.showToast("Please enter an API key", "error");
      return;
    }

    setIsTestingAi(true);
    setAiTestResult({ status: "idle", message: "Testing connection..." });

    try {
      setApiKey(inputApiKey.trim());
      setModel(inputModel.trim());
      setApiBaseUrl(inputBaseUrl.trim());
      setProvider(selectedProvider);

      const res = await fetch("/api/akasha/ai/test-connection", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-ai-api-key": inputApiKey.trim(),
          "x-ai-model": inputModel.trim(),
          "x-ai-api-base-url": inputBaseUrl.trim(),
        },
        body: JSON.stringify({
          apiKey: inputApiKey.trim(),
          model: inputModel.trim(),
          apiBaseUrl: inputBaseUrl.trim(),
        }),
      });

      if (res.ok) {
        setAiTestResult({ status: "success", message: "Connected successfully (200 OK)" });
        toast.showToast("AI Connection Verified", "success");
      } else {
        const errorData = await res.json().catch(() => ({}));
        const msg = errorData.error || `HTTP ${res.status}: ${res.statusText}`;
        setAiTestResult({ status: "error", message: msg });
        toast.showToast(`Connection failed: ${msg}`, "error");
      }
    } catch (err: any) {
      setAiTestResult({ status: "error", message: err?.message || "Failed to reach AI endpoint" });
      toast.showToast("Connection failed", "error");
    } finally {
      setIsTestingAi(false);
    }
  };

  // Local states for Project Administration
  const [projectName, setProjectName] = useState(project?.name || "");
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [isDestructiveAction, setIsDestructiveAction] = useState(false);
  const [deleteFromDisk, setDeleteFromDisk] = useState(false);
  const [clearDiskOnReset, setClearDiskOnReset] = useState(true);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: "reset" | "delete" | null;
  }>({ isOpen: false, type: null });

  // Sync state on load
  useEffect(() => {
    if (project) {
      setProjectName(project.name);
    }
  }, [project]);

  const handleSaveProjectName = async () => {
    if (!projectName.trim()) {
      toast.showToast("Project name cannot be empty", "error");
      return;
    }

    setIsSavingProject(true);
    try {
      if (projectName !== project?.name) {
        await renameProject(projectName.trim());
        toast.showToast("Project renamed", "success");
      } else {
        toast.showToast("No changes to save", "info");
      }
    } catch (err) {
      toast.showToast(`Failed: ${err}`, "error");
    } finally {
      setIsSavingProject(false);
    }
  };

  const handleResetConfirm = async () => {
    setIsDestructiveAction(true);
    try {
      await resetProject(clearDiskOnReset);
      toast.showToast("Project reset to initial state", "success");
      setConfirmModal({ isOpen: false, type: null });
      setClearDiskOnReset(true);
    } catch (err) {
      toast.showToast(`Reset failed: ${err}`, "error");
    } finally {
      setIsDestructiveAction(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!project) return;
    setIsDestructiveAction(true);
    try {
      await deleteProject(project.id, deleteFromDisk);
      toast.showToast("Project deleted", "success");
      closeProject();
      setConfirmModal({ isOpen: false, type: null });
      setDeleteFromDisk(false);
    } catch (err) {
      toast.showToast(`Delete failed: ${err}`, "error");
    } finally {
      setIsDestructiveAction(false);
    }
  };

  const handleOpenBotConfig = () => {
    window.dispatchEvent(
      new CustomEvent("akasha:open-chat", {
        detail: { openSettings: true },
      })
    );
  };

  const inputCls =
    "w-full h-8 px-3 rounded-lg bg-white/90 dark:bg-[#0c0d16]/80 border border-black/[0.08] dark:border-white/12 text-xs font-mono text-neutral-950 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/40 transition-all";

  return (
    <div className="h-full w-full overflow-auto relative p-4 sm:p-6 select-none flex flex-col justify-between">
      <div className="relative z-10 max-w-3xl w-full mx-auto space-y-4">
        {/* Compact Header */}
        <div className="flex items-center justify-between pb-3 border-b border-black/[0.06] dark:border-white/8">
          <div>
            <h1 className="text-base font-bold tracking-tight text-neutral-950 dark:text-white">
              Settings
            </h1>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
              Project administration and workspace preferences
            </p>
          </div>
          <button
            type="button"
            onClick={onBack || (() => setActivePage("dashboard"))}
            className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-neutral-600 dark:text-neutral-300 bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] dark:hover:bg-white/[0.1] border border-black/[0.06] dark:border-white/10 transition-all cursor-pointer"
          >
            Back
          </button>
        </div>

        {/* ── AI Model & Credentials Section (Icon-Free, Same-Line Inputs) ── */}
        <div className="p-5 rounded-2xl bg-white/80 dark:bg-[#0c0d16]/75 border border-black/[0.06] dark:border-white/10 backdrop-blur-md shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-black/[0.05] dark:border-white/8">
            <div className="flex items-center gap-2.5">
              <span className="text-[11px] font-bold text-neutral-800 dark:text-neutral-100 uppercase tracking-wider">
                AI Model & Credentials
              </span>
              <span className={`text-[8.5px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                inputApiKey
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
              }`}>
                {inputApiKey ? "Configured" : "Missing Key"}
              </span>
            </div>
            <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-mono">
              powers copilot & ideation
            </span>
          </div>

          {/* Provider Selection */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
              Provider
            </label>
            <div className="grid grid-cols-4 gap-1.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.03] p-1 border border-black/[0.05] dark:border-white/6">
              {[
                { id: "gemini", label: "Gemini" },
                { id: "openrouter", label: "OpenRouter" },
                { id: "openai", label: "OpenAI" },
                { id: "custom", label: "Custom" },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleProviderSelect(p.id)}
                  className={`py-1.5 rounded-lg text-[10px] font-semibold text-center transition-all cursor-pointer ${
                    selectedProvider === p.id
                      ? "bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/35 shadow-xs font-bold"
                      : "bg-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white border border-transparent"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* API Key & Model — On the Exact Same Line */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            {/* API Key Column */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between h-4">
                <label className="text-[10px] font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                  API Key
                </label>
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="text-[9px] font-bold uppercase text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
                >
                  {showApiKey ? "HIDE" : "SHOW"}
                </button>
              </div>
              <input
                type={showApiKey ? "text" : "password"}
                value={inputApiKey}
                onChange={(e) => setInputApiKey(e.target.value)}
                placeholder={
                  selectedProvider === "gemini"
                    ? "AIzaSy..."
                    : selectedProvider === "openrouter"
                    ? "sk-or-v1-..."
                    : "sk-..."
                }
                className="w-full h-9 px-3 rounded-xl bg-white/90 dark:bg-[#07090f] border border-black/[0.08] dark:border-white/12 text-xs font-mono text-neutral-950 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-600 focus:outline-none focus:border-cyan-500/60 transition-all"
              />
            </div>

            {/* Model Column */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between h-4">
                <label className="text-[10px] font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                  Model
                </label>
                <div className="flex items-center gap-1">
                  {[
                    { label: "Gemini 3.6", model: "gemini-3.6-flash" },
                    { label: "Gemini 2.5", model: "gemini-2.5-flash" },
                    { label: "GPT-4o Mini", model: "gpt-4o-mini" },
                    { label: "Free", model: "openrouter/free" },
                  ].map((item) => (
                    <button
                      key={item.model}
                      type="button"
                      onClick={() => setInputModel(item.model)}
                      className={`px-1.5 py-0.2 rounded text-[7.5px] font-semibold transition-colors cursor-pointer ${
                        inputModel === item.model
                          ? "bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/35 font-bold"
                          : "bg-black/[0.03] dark:bg-white/[0.04] text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white border border-transparent"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
              <input
                type="text"
                value={inputModel}
                onChange={(e) => setInputModel(e.target.value)}
                placeholder="e.g. gemini-2.0-flash"
                className="w-full h-9 px-3 rounded-xl bg-white/90 dark:bg-[#07090f] border border-black/[0.08] dark:border-white/12 text-xs font-mono text-neutral-950 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-600 focus:outline-none focus:border-cyan-500/60 transition-all"
              />
            </div>
          </div>

          {/* API Base URL */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
              API Base URL
            </label>
            <input
              type="text"
              value={inputBaseUrl}
              onChange={(e) => setInputBaseUrl(e.target.value)}
              placeholder="https://..."
              className="w-full h-9 px-3 rounded-xl bg-white/90 dark:bg-[#07090f] border border-black/[0.08] dark:border-white/12 text-xs font-mono text-neutral-950 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-600 focus:outline-none focus:border-cyan-500/60 transition-all"
            />
          </div>

          {/* Test Status feedback */}
          {aiTestResult.status !== "idle" && (
            <div
              className={`p-2.5 rounded-xl text-[11px] font-medium border ${
                aiTestResult.status === "success"
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25"
                  : "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/25"
              }`}
            >
              {aiTestResult.message}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={handleSaveAiSettings}
              className="px-4 py-2 rounded-xl text-[11px] font-bold text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:brightness-110 active:scale-[0.97] transition-all cursor-pointer shadow-sm"
            >
              Save AI Configuration
            </button>
            <button
              type="button"
              onClick={handleTestAiConnection}
              disabled={isTestingAi}
              className="px-4 py-2 rounded-xl text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] dark:hover:bg-white/[0.1] border border-black/[0.06] dark:border-white/10 disabled:opacity-40 transition-all cursor-pointer"
            >
              {isTestingAi ? "Testing..." : "Test Connection"}
            </button>
          </div>
        </div>

        {/* 2-Column Grid: Project & Danger Zone */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Project Preferences */}
          {project && (
            <div className="p-4 rounded-xl bg-white/80 dark:bg-[#0c0d16]/70 border border-black/[0.06] dark:border-white/10 backdrop-blur-md space-y-3">
              <div className="pb-2 border-b border-black/[0.05] dark:border-white/8">
                <span className="text-[11px] font-bold text-neutral-800 dark:text-neutral-100 uppercase tracking-wider">
                  Project Preferences
                </span>
                <p className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Update active workspace identity
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                  Project Name
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="Project name..."
                    className={`flex-1 ${inputCls}`}
                  />
                  <button
                    type="button"
                    onClick={handleSaveProjectName}
                    disabled={isSavingProject}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:brightness-110 active:scale-[0.97] disabled:opacity-40 transition-all cursor-pointer shadow-sm flex-shrink-0"
                  >
                    {isSavingProject ? "..." : "Save"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Danger Zone */}
          {project && (
            <div className="p-4 rounded-xl bg-white/80 dark:bg-[#0c0d16]/70 border border-rose-500/20 dark:border-rose-500/15 backdrop-blur-md space-y-3">
              <div className="pb-2 border-b border-rose-500/10 dark:border-rose-500/10">
                <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
                  Danger Zone
                </span>
                <p className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Irreversible destructive operations
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmModal({ isOpen: true, type: "reset" })}
                  disabled={isDestructiveAction}
                  className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/8 hover:bg-rose-500/15 border border-rose-500/20 disabled:opacity-40 transition-all cursor-pointer text-center"
                >
                  Reset Project
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmModal({ isOpen: true, type: "delete" })}
                  disabled={isDestructiveAction}
                  className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/8 hover:bg-rose-500/15 border border-rose-500/20 disabled:opacity-40 transition-all cursor-pointer text-center"
                >
                  Delete Project
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Keyboard Shortcuts */}
        <div className="p-4 rounded-xl bg-white/80 dark:bg-[#0c0d16]/70 border border-black/[0.06] dark:border-white/10 backdrop-blur-md space-y-2">
          <span className="text-[11px] font-bold text-neutral-800 dark:text-neutral-100 uppercase tracking-wider">
            Shortcuts
          </span>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[10px] pt-1">
            {[
              ["⌘ K", "Command Search"],
              ["⌘ I", "Import Project"],
              ["⌘ ,", "Open Settings"],
              ["Esc", "Close Modal"],
            ].map(([key, desc]) => (
              <div key={key} className="flex items-center justify-between p-2 rounded-lg bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/6">
                <span className="text-neutral-500 dark:text-neutral-400">{desc}</span>
                <kbd className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-black/[0.04] dark:bg-white/[0.06] text-neutral-600 dark:text-neutral-300 border border-black/[0.06] dark:border-white/10">
                  {key}
                </kbd>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Bar — System Status & AI Copilot Integration */}
      <div className="relative z-10 max-w-3xl w-full mx-auto mt-6 pt-3 border-t border-black/[0.06] dark:border-white/8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-xl bg-white/80 dark:bg-[#0c0d16]/70 border border-black/[0.06] dark:border-white/10 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
            <div className="flex items-center gap-3 text-[10px] font-mono">
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">Backend: ONLINE</span>
              <span className="text-neutral-500 dark:text-neutral-400">
                Project: <strong className="text-neutral-800 dark:text-white">{project?.name || "—"}</strong>
              </span>
              <span className={`font-bold ${apiKey ? "text-cyan-600 dark:text-cyan-400" : "text-amber-600 dark:text-amber-400"}`}>
                AI: {apiKey ? (model?.split("/").pop() || "Active") : "No Key"}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleOpenBotConfig}
            className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-cyan-700 dark:text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/25 transition-all cursor-pointer whitespace-nowrap active:scale-[0.97]"
          >
            Configure in Copilot Bot
          </button>
        </div>
      </div>

      {/* Confirmation Dialogs */}
      <ConfirmModal
        isOpen={confirmModal.isOpen && confirmModal.type === "reset"}
        title="Reset Project Content"
        message="This will permanently delete all content (pages, blocks, data models, logic) in this project and reset it to a clean slate. Cannot be undone."
        confirmText="Reset Everything"
        variant="warning"
        onConfirm={handleResetConfirm}
        onCancel={() => setConfirmModal({ isOpen: false, type: null })}
        isLoading={isDestructiveAction}
      />

      <ConfirmModal
        isOpen={confirmModal.isOpen && confirmModal.type === "delete"}
        title={`Delete "${project?.name}"?`}
        message="This will permanently delete this project from the database."
        confirmText="Delete Project"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => {
          setConfirmModal({ isOpen: false, type: null });
          setDeleteFromDisk(false);
        }}
        isLoading={isDestructiveAction}
        checkboxConfig={{
          label: "Also delete project folder from disk",
          checked: deleteFromDisk,
          onChange: setDeleteFromDisk,
        }}
      />
    </div>
  );
};

export default SettingsPage;
