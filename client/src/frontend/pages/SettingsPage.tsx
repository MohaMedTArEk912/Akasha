import React, { useState, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useProjectStore } from "../hooks/useProjectStore";
import { useSettings } from "../context/SettingsContext";
import { useTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";
import {
  renameProject,
  resetProject,
  deleteProject,
  closeProject,
  setActivePage,
} from "../stores/projectStore";
import { PageShell } from "../components/layout/PageShell";
import ConfirmModal from "../components/Modals/ConfirmModal";
import {
  Sun,
  Moon,
  Sparkles,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  Sliders,
  FolderCog,
  User,
  KeyRound,
  AlertTriangle,
  Wifi,
  WifiOff,
  ArrowLeft,
} from "lucide-react";

interface SettingsPageProps {
  onBack?: () => void;
}

interface ProviderOption {
  id: string;
  name: string;
  summary: string;
  requiresKey: boolean;
  defaultBaseUrl: string;
  defaultModel: string;
  keyPlaceholder: string;
  models: Array<{ id: string; label: string }>;
}

const PROVIDERS: ProviderOption[] = [
  {
    id: "offline",
    name: "Offline blueprints",
    summary: "No API key needed. Uses built-in playbooks and compilers.",
    requiresKey: false,
    defaultBaseUrl: "",
    defaultModel: "deterministic-playbook",
    keyPlaceholder: "",
    models: [{ id: "deterministic-playbook", label: "Built-in deterministic engine" }],
  },
  {
    id: "gemini",
    name: "Google Gemini",
    summary: "Fast synthesis for ideas, schemas, and full-stack generation.",
    requiresKey: true,
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    defaultModel: "gemini-2.5-flash",
    keyPlaceholder: "AIzaSy...",
    models: [
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash (Recommended)" },
      { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
      { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
    ],
  },
  {
    id: "openai",
    name: "OpenAI",
    summary: "GPT models for structured specs and code scaffolding.",
    requiresKey: true,
    defaultBaseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    keyPlaceholder: "sk-...",
    models: [
      { id: "gpt-4o-mini", label: "GPT-4o Mini (Fast)" },
      { id: "gpt-4o", label: "GPT-4o" },
      { id: "o3-mini", label: "o3-mini" },
    ],
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    summary: "Access Claude, Gemini, Llama, and free community models.",
    requiresKey: true,
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "openrouter/free",
    keyPlaceholder: "sk-or-v1-...",
    models: [
      { id: "openrouter/free", label: "OpenRouter Free Auto" },
      { id: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet" },
      { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    ],
  },
  {
    id: "ollama",
    name: "Local Ollama",
    summary: "Run open models privately on your own machine (no key).",
    requiresKey: false,
    defaultBaseUrl: "http://localhost:11434/v1",
    defaultModel: "llama3.1",
    keyPlaceholder: "",
    models: [
      { id: "llama3.1", label: "Llama 3.1" },
      { id: "qwen2.5-coder", label: "Qwen 2.5 Coder" },
      { id: "mistral", label: "Mistral" },
    ],
  },
];

const SettingsPage: React.FC<SettingsPageProps> = ({ onBack }) => {
  const { project } = useProjectStore();
  const { theme, setTheme } = useTheme();
  const {
    apiKey,
    model,
    apiBaseUrl,
    provider,
    memberName,
    compactMode,
    setApiKey,
    setModel,
    setApiBaseUrl,
    setProvider,
    setMemberName,
    setCompactMode,
  } = useSettings();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<"general" | "ai" | "workspace">("general");

  // AI settings local state
  const [selectedProvider, setSelectedProvider] = useState(provider || "offline");
  const [inputApiKey, setInputApiKey] = useState(apiKey || "");
  const [inputModel, setInputModel] = useState(model || "gemini-2.5-flash");
  const [inputBaseUrl, setInputBaseUrl] = useState(apiBaseUrl || "");
  const [showApiKey, setShowApiKey] = useState(false);
  const [showAdvancedEndpoint, setShowAdvancedEndpoint] = useState(false);
  const [isTestingAi, setIsTestingAi] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<{
    status: "idle" | "success" | "error";
    message: string;
  }>({ status: "idle", message: "" });

  // Profile & project state
  const [nameDraft, setNameDraft] = useState(memberName || "Founder");
  const [projectName, setProjectName] = useState(project?.name || "");
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [isDestructiveAction, setIsDestructiveAction] = useState(false);
  const [deleteFromDisk, setDeleteFromDisk] = useState(false);
  const [clearDiskOnReset, setClearDiskOnReset] = useState(true);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: "reset" | "delete" | null;
  }>({ isOpen: false, type: null });

  useEffect(() => {
    setInputApiKey(apiKey || "");
    if (model) setInputModel(model);
    if (apiBaseUrl) setInputBaseUrl(apiBaseUrl);
    if (provider) setSelectedProvider(provider);
  }, [apiKey, model, apiBaseUrl, provider]);

  useEffect(() => {
    setNameDraft(memberName || "Founder");
  }, [memberName]);

  useEffect(() => {
    if (project) setProjectName(project.name);
  }, [project]);

  const activeProviderMeta =
    PROVIDERS.find((p) => p.id === selectedProvider) || PROVIDERS[0]!;

  const handleProviderSelect = (p: ProviderOption) => {
    setSelectedProvider(p.id);
    setInputBaseUrl(p.defaultBaseUrl);
    setInputModel(p.defaultModel);
    if (!p.requiresKey) {
      setInputApiKey("");
    }
    setAiTestResult({ status: "idle", message: "" });
  };

  const handleSaveAiSettings = () => {
    setProvider(selectedProvider);
    setApiKey(activeProviderMeta.requiresKey ? inputApiKey.trim() : "");
    setModel(inputModel.trim() || activeProviderMeta.defaultModel);
    setApiBaseUrl(inputBaseUrl.trim() || activeProviderMeta.defaultBaseUrl);
    toast.showToast("AI settings saved", "success");
  };

  const handleTestAndSaveAi = async () => {
    if (activeProviderMeta.requiresKey && !inputApiKey.trim()) {
      setAiTestResult({
        status: "error",
        message: "Enter an API key first, or choose Offline blueprints.",
      });
      return;
    }

    handleSaveAiSettings();

    if (selectedProvider === "offline") {
      setAiTestResult({
        status: "success",
        message: "Offline blueprints active. All playbooks, mock APIs, and exports work without a key.",
      });
      return;
    }

    setIsTestingAi(true);
    setAiTestResult({ status: "idle", message: "Checking connection..." });
    try {
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
        setAiTestResult({
          status: "success",
          message: `Connected to ${activeProviderMeta.name} (${inputModel.trim()}).`,
        });
        toast.showToast("Connection verified", "success");
      } else {
        const errorData = await res.json().catch(() => ({}));
        const msg = errorData.error || `Server responded with ${res.status}`;
        setAiTestResult({ status: "error", message: msg });
        toast.showToast("Connection failed", "error");
      }
    } catch (err: any) {
      setAiTestResult({
        status: "error",
        message: err?.message || "Could not reach the AI endpoint.",
      });
      toast.showToast("Connection failed", "error");
    } finally {
      setIsTestingAi(false);
    }
  };

  const handleSaveProfile = () => {
    setMemberName(nameDraft.trim() || "Founder");
    toast.showToast("Profile updated", "success");
  };

  const handleSaveProjectName = async () => {
    if (!projectName.trim()) {
      toast.showToast("Project name cannot be empty", "error");
      return;
    }
    setIsSavingProject(true);
    try {
      if (projectName.trim() !== project?.name) {
        await renameProject(projectName.trim());
        toast.showToast("Project renamed", "success");
      }
    } catch (err) {
      toast.showToast(`Could not rename project: ${err}`, "error");
    } finally {
      setIsSavingProject(false);
    }
  };

  const handleResetConfirm = async () => {
    setIsDestructiveAction(true);
    try {
      await resetProject(clearDiskOnReset);
      toast.showToast("Project reset", "success");
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

  const tabs = [
    { id: "general", label: "Appearance & profile", icon: <Sliders className="w-3.5 h-3.5" /> },
    { id: "ai", label: "AI assistant", icon: <Sparkles className="w-3.5 h-3.5" /> },
    { id: "workspace", label: "Project & shortcuts", icon: <FolderCog className="w-3.5 h-3.5" /> },
  ];

  return (
    <PageShell
      title="Settings"
      subtitle="Personalize your workspace appearance, teammate identity, and optional AI provider."
      showAiStatus={false}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(id) => setActiveTab(id as any)}
      actions={
        onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="btn-ghost h-9 px-3.5 text-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setActivePage("hub")}
            className="btn-ghost h-9 px-3.5 text-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to overview
          </button>
        )
      }
    >
      {/* TAB 1: APPEARANCE & PROFILE */}
      {activeTab === "general" && (
        <div className="max-w-3xl space-y-6">
          {/* Theme Selection */}
          <section className="studio-surface p-6 space-y-4">
            <div>
              <h2 className="text-base font-bold text-[var(--ide-text)]">Appearance</h2>
              <p className="text-sm text-[var(--ide-text-secondary)] mt-0.5">
                Choose the studio palette that feels easiest on your eyes.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <button
                type="button"
                onClick={() => setTheme("light")}
                className={`text-left p-4 rounded-xl border transition-all cursor-pointer ${
                  theme === "light"
                    ? "border-[#1B5BFF] bg-[#1B5BFF]/[0.05] ring-2 ring-[#1B5BFF]/15"
                    : "border-[var(--ide-border)] bg-[var(--ide-bg)] hover:border-[var(--ide-border-strong)]"
                }`}
              >
                <div className="h-14 rounded-lg bg-[#E7EAEF] border border-[#C9D1DD] p-2.5 flex flex-col justify-between mb-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#164EE0]" />
                    <span className="h-1.5 w-14 rounded-full bg-[#9AA7BA]" />
                  </div>
                  <div className="flex gap-2">
                    <span className="h-4 flex-1 rounded bg-[#F7F8FA] border border-[#C9D1DD]" />
                    <span className="h-4 w-10 rounded bg-[#164EE0]/20" />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--ide-text)]">
                    <Sun className="w-4 h-4 text-amber-600" />
                    Daylight Paper
                  </span>
                  {theme === "light" && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#164EE0]">
                      <Check className="w-3.5 h-3.5" /> Active
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--ide-text-muted)] mt-1">
                  Low-glare stone paper with textured canvas and crisp ink.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setTheme("dark")}
                className={`text-left p-4 rounded-xl border transition-all cursor-pointer ${
                  theme === "dark"
                    ? "border-[#5B8CFF] bg-[#5B8CFF]/10 ring-2 ring-[#5B8CFF]/20"
                    : "border-[var(--ide-border)] bg-[var(--ide-bg)] hover:border-[var(--ide-border-strong)]"
                }`}
              >
                <div className="h-14 rounded-lg bg-[#0E1117] border border-[#262E3D] p-2.5 flex flex-col justify-between mb-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#5B8CFF]" />
                    <span className="h-1.5 w-14 rounded-full bg-[#374155]" />
                  </div>
                  <div className="flex gap-2">
                    <span className="h-4 flex-1 rounded bg-[#161B22] border border-[#262E3D]" />
                    <span className="h-4 w-10 rounded bg-[#5B8CFF]/25" />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--ide-text)]">
                    <Moon className="w-4 h-4 text-[#5B8CFF]" />
                    Slate Night
                  </span>
                  {theme === "dark" && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#5B8CFF]">
                      <Check className="w-3.5 h-3.5" /> Active
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--ide-text-muted)] mt-1">
                  Low-glare charcoal panels for late-night sessions.
                </p>
              </button>
            </div>

            <div className="pt-2 border-t border-[var(--ide-border)] flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-[var(--ide-text)]">Compact layout</div>
                <div className="text-xs text-[var(--ide-text-muted)]">
                  Tighten list spacing when working on smaller laptop displays.
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={compactMode}
                onClick={() => setCompactMode(!compactMode)}
                className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer shrink-0 ${
                  compactMode ? "bg-[#1B5BFF]" : "bg-[var(--ide-border-strong)]"
                }`}
              >
                <span
                  className={`block w-4.5 h-4.5 w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform ${
                    compactMode ? "translate-x-[22px]" : "translate-x-[3px]"
                  }`}
                />
              </button>
            </div>
          </section>

          {/* Teammate Identity */}
          <section className="studio-surface p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#1B5BFF]/10 text-[#1B5BFF] dark:text-[#7AA3FF] flex items-center justify-center shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[var(--ide-text)]">Your team name</h2>
                <p className="text-sm text-[var(--ide-text-secondary)] mt-0.5">
                  Shown automatically when you vote on MVP slices, log decisions, or drop prototype pins.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 max-w-md">
              <input
                type="text"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                placeholder="e.g. Sarah, Product Lead"
                className="input-modern flex-1"
              />
              <button
                type="button"
                onClick={handleSaveProfile}
                className="btn-primary px-5"
              >
                Save name
              </button>
            </div>
          </section>
        </div>
      )}

      {/* TAB 2: AI ASSISTANT */}
      {activeTab === "ai" && (
        <div className="max-w-3xl space-y-6">
          <section className="studio-surface p-6 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-[var(--ide-text)]">Choose your AI engine</h2>
                <p className="text-sm text-[var(--ide-text-secondary)] mt-0.5">
                  Akasha works fully offline by default. Connect a key anytime for live AI generation.
                </p>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                  selectedProvider === "offline"
                    ? "bg-[var(--ide-accent-subtle)] text-[var(--ide-text-secondary)] border-[var(--ide-border)]"
                    : selectedProvider === "ollama" || inputApiKey.trim()
                    ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30"
                    : "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30"
                }`}
              >
                {selectedProvider === "offline" ? (
                  <>
                    <WifiOff className="w-3.5 h-3.5" /> Offline ready
                  </>
                ) : selectedProvider === "ollama" || inputApiKey.trim() ? (
                  <>
                    <Wifi className="w-3.5 h-3.5" /> Ready to connect
                  </>
                ) : (
                  <>Key needed</>
                )}
              </span>
            </div>

            {/* Clean Provider Selector Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {PROVIDERS.map((p) => {
                const active = selectedProvider === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleProviderSelect(p)}
                    className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                      active
                        ? "border-[#1B5BFF] bg-[#1B5BFF]/[0.06] dark:bg-[#5B8CFF]/15"
                        : "border-[var(--ide-border)] bg-[var(--ide-bg)] hover:border-[var(--ide-border-strong)]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-[var(--ide-text)]">{p.name}</span>
                      {active && <Check className="w-4 h-4 text-[#1B5BFF] dark:text-[#7AA3FF] shrink-0" />}
                    </div>
                    <p className="text-xs text-[var(--ide-text-muted)] mt-1 leading-relaxed">
                      {p.summary}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Simplified Credential Inputs (only shown when relevant) */}
            {selectedProvider !== "offline" && (
              <div className="pt-4 border-t border-[var(--ide-border)] space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {activeProviderMeta.requiresKey && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-[var(--ide-text)] flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5">
                          <KeyRound className="w-3.5 h-3.5 text-[var(--ide-text-muted)]" />
                          API key
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="text-xs font-medium text-[#1B5BFF] dark:text-[#7AA3FF] inline-flex items-center gap-1 cursor-pointer"
                        >
                          {showApiKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          {showApiKey ? "Hide" : "Show"}
                        </button>
                      </label>
                      <input
                        type={showApiKey ? "text" : "password"}
                        value={inputApiKey}
                        onChange={(e) => setInputApiKey(e.target.value)}
                        placeholder={activeProviderMeta.keyPlaceholder}
                        className="input-modern w-full font-mono text-xs"
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[var(--ide-text)] block">
                      Model
                    </label>
                    <select
                      value={
                        activeProviderMeta.models.some((m) => m.id === inputModel)
                          ? inputModel
                          : "__custom__"
                      }
                      onChange={(e) => {
                        if (e.target.value !== "__custom__") {
                          setInputModel(e.target.value);
                        }
                      }}
                      className="input-modern w-full"
                    >
                      {activeProviderMeta.models.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label}
                        </option>
                      ))}
                      <option value="__custom__">Custom model ID...</option>
                    </select>
                  </div>
                </div>

                {/* Collapsible Advanced Options */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowAdvancedEndpoint((v) => !v)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] cursor-pointer"
                  >
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform ${
                        showAdvancedEndpoint ? "rotate-180" : ""
                      }`}
                    />
                    Advanced model ID & endpoint URL
                  </button>

                  <AnimatePresence initial={false}>
                    {showAdvancedEndpoint && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.18 }}
                        className="overflow-hidden"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-[var(--ide-text-secondary)] block">
                              Custom model ID
                            </label>
                            <input
                              type="text"
                              value={inputModel}
                              onChange={(e) => setInputModel(e.target.value)}
                              className="input-modern w-full font-mono text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-[var(--ide-text-secondary)] block">
                              API base URL
                            </label>
                            <input
                              type="text"
                              value={inputBaseUrl}
                              onChange={(e) => setInputBaseUrl(e.target.value)}
                              placeholder="https://..."
                              className="input-modern w-full font-mono text-xs"
                            />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* Live Feedback Banner */}
            {aiTestResult.message && (
              <div
                className={`p-3 rounded-xl text-xs font-medium border ${
                  aiTestResult.status === "success"
                    ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30"
                    : aiTestResult.status === "error"
                    ? "bg-rose-50 dark:bg-rose-500/10 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-500/30"
                    : "bg-[var(--ide-accent-subtle)] text-[var(--ide-text-secondary)] border-[var(--ide-border)]"
                }`}
              >
                {aiTestResult.message}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleTestAndSaveAi}
                disabled={isTestingAi}
                className="btn-primary px-5"
              >
                {isTestingAi
                  ? "Checking connection..."
                  : selectedProvider === "offline"
                  ? "Use offline mode"
                  : "Test & save connection"}
              </button>
              {selectedProvider !== "offline" && (
                <button
                  type="button"
                  onClick={handleSaveAiSettings}
                  className="btn-ghost px-4"
                >
                  Save without testing
                </button>
              )}
            </div>
          </section>
        </div>
      )}

      {/* TAB 3: PROJECT & SHORTCUTS */}
      {activeTab === "workspace" && (
        <div className="max-w-3xl space-y-6">
          {project && (
            <section className="studio-surface p-6 space-y-4">
              <div>
                <h2 className="text-base font-bold text-[var(--ide-text)]">Project details</h2>
                <p className="text-sm text-[var(--ide-text-secondary)] mt-0.5">
                  Rename the active workspace across your dashboard, prototype, and exports.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2.5 max-w-md">
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Project name"
                  className="input-modern flex-1"
                />
                <button
                  type="button"
                  onClick={handleSaveProjectName}
                  disabled={isSavingProject}
                  className="btn-primary px-5"
                >
                  {isSavingProject ? "Saving..." : "Rename project"}
                </button>
              </div>
            </section>
          )}

          {/* Keyboard Shortcuts */}
          <section className="studio-surface p-6 space-y-4">
            <div>
              <h2 className="text-base font-bold text-[var(--ide-text)]">Keyboard shortcuts</h2>
              <p className="text-sm text-[var(--ide-text-secondary)] mt-0.5">
                Move around Akasha without lifting your hands from the keyboard.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {[
                ["⌘ K", "Open quick jump command palette"],
                ["⌘ B", "Collapse or expand sidebar"],
                ["⌘ ,", "Open settings"],
                ["Ctrl Shift A", "Open Copilot assistant"],
                ["Esc", "Close active modal or drawer"],
              ].map(([key, desc]) => (
                <div
                  key={key}
                  className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)] text-sm"
                >
                  <span className="text-[var(--ide-text-secondary)]">{desc}</span>
                  <kbd className="px-2 py-0.5 rounded-md text-xs font-mono font-medium bg-[var(--ide-bg-elevated)] text-[var(--ide-text)] border border-[var(--ide-border)]">
                    {key}
                  </kbd>
                </div>
              ))}
            </div>
          </section>

          {/* Quiet Danger Zone */}
          {project && (
            <section className="rounded-2xl bg-[var(--ide-bg-elevated)] border border-rose-200 dark:border-rose-500/25 p-6 space-y-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-base font-bold text-rose-700 dark:text-rose-400">
                    Reset or delete project
                  </h2>
                  <p className="text-sm text-[var(--ide-text-secondary)] mt-0.5">
                    These actions permanently remove pages, slices, and database models from {project.name}.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={() => setConfirmModal({ isOpen: true, type: "reset" })}
                  disabled={isDestructiveAction}
                  className="h-9 px-4 rounded-lg text-xs font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 border border-rose-200 dark:border-rose-500/30 transition-colors cursor-pointer"
                >
                  Reset workspace content
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmModal({ isOpen: true, type: "delete" })}
                  disabled={isDestructiveAction}
                  className="h-9 px-4 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 transition-colors cursor-pointer"
                >
                  Delete project permanently
                </button>
              </div>
            </section>
          )}
        </div>
      )}

      {/* Confirmation Modals */}
      <ConfirmModal
        isOpen={confirmModal.isOpen && confirmModal.type === "reset"}
        title="Reset workspace content"
        message="This permanently removes all feature slices, pages, data models, and APIs in this project."
        confirmText="Reset workspace"
        variant="warning"
        onConfirm={handleResetConfirm}
        onCancel={() => setConfirmModal({ isOpen: false, type: null })}
        isLoading={isDestructiveAction}
      />

      <ConfirmModal
        isOpen={confirmModal.isOpen && confirmModal.type === "delete"}
        title={`Delete "${project?.name}"?`}
        message="This permanently removes this project from Akasha."
        confirmText="Delete project"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => {
          setConfirmModal({ isOpen: false, type: null });
          setDeleteFromDisk(false);
        }}
        isLoading={isDestructiveAction}
        checkboxConfig={{
          label: "Also remove exported folder from disk",
          checked: deleteFromDisk,
          onChange: setDeleteFromDisk,
        }}
      />
    </PageShell>
  );
};

export default SettingsPage;
