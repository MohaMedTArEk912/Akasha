import React, { useState, useEffect } from "react";
import { useProjectStore } from "../hooks/useProjectStore";
import { useSettings } from "../context/SettingsContext";
import { useTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";
import { renameProject, resetProject, deleteProject, closeProject } from "../stores/projectStore";
import ConfirmModal from "../components/Modals/ConfirmModal";
import { httpApi } from "../hooks/useHttpApi";

interface ProviderConfig {
    id: string;
    name: string;
    description: string;
    icon: React.ReactNode;
    defaultUrl: string;
    defaultModel: string;
    placeholderKey: string;
    models: { value: string; label: string }[];
}

const PROVIDERS: ProviderConfig[] = [
    {
        id: "openrouter",
        name: "OpenRouter",
        description: "Standard model aggregator",
        defaultUrl: "https://openrouter.ai/api/v1",
        defaultModel: "google/gemma-3-4b-it:free",
        placeholderKey: "sk-or-v1-...",
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
        ),
        models: [
            { value: "google/gemma-3-4b-it:free", label: "Gemma 3 4B (Free)" },
            { value: "meta-llama/llama-3.3-70b-instruct:free", label: "LLaMA 3.3 70B (Free)" },
            { value: "deepseek/deepseek-chat", label: "DeepSeek V3" },
            { value: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet" },
            { value: "openai/gpt-4o-mini", label: "GPT-4o Mini" },
        ]
    },
    {
        id: "openai",
        name: "OpenAI",
        description: "Official OpenAI LLMs",
        defaultUrl: "https://api.openai.com/v1",
        defaultModel: "gpt-4o-mini",
        placeholderKey: "sk-proj-...",
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.813 15.904L9 21l4.907-2.907L18 21l-.813-5.096M9.813 15.904a7.5 7.5 0 117.374 0M9.813 15.904l3.187-3.187m4.187 3.187l-3.187-3.187m0 0L14 3m0 9.717V3" />
            </svg>
        ),
        models: [
            { value: "gpt-4o-mini", label: "GPT-4o Mini" },
            { value: "gpt-4o", label: "GPT-4o" },
            { value: "o3-mini", label: "o3-mini (Reasoning)" },
        ]
    },
    {
        id: "gemini",
        name: "Google Gemini",
        description: "Google AI Studio keys",
        defaultUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
        defaultModel: "gemini-2.5-flash",
        placeholderKey: "AIzaSy...",
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
        ),
        models: [
            { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
            { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
        ]
    },
    {
        id: "custom",
        name: "Custom API",
        description: "Ollama, LM Studio, etc.",
        defaultUrl: "http://localhost:11434/v1",
        defaultModel: "",
        placeholderKey: "Optional API Key...",
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
        ),
        models: []
    }
];

interface SettingsPageProps {
    onBack?: () => void;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ onBack }) => {
    const { theme, toggleTheme } = useTheme();
    const { project } = useProjectStore();
    const { apiKey, model, apiBaseUrl, provider, noAi, setApiKey, setModel, setApiBaseUrl, setProvider, setNoAi } = useSettings();
    const toast = useToast();

    // Active Settings Tab
    const [activeTab, setActiveTab] = useState<"ai" | "project">("ai");

    // Local states for AI Setup
    const [localApiKey, setLocalApiKey] = useState(apiKey);
    const [localModel, setLocalModel] = useState(model);
    const [localApiBaseUrl, setLocalApiBaseUrl] = useState(apiBaseUrl);
    const [localProvider, setLocalProvider] = useState(provider);
    const [localNoAi, setLocalNoAi] = useState(noAi);
    const [showApiKey, setShowApiKey] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [isCustomModel, setIsCustomModel] = useState(false);
    const [isTestingConnection, setIsTestingConnection] = useState(false);

    const handleTestConnection = async () => {
        setIsTestingConnection(true);
        try {
            const res = await httpApi.testConnection({
                apiKey: localApiKey.trim(),
                model: localModel.trim(),
                apiBaseUrl: localApiBaseUrl.trim()
            });
            if (res && res.success) {
                toast.showToast(`Connection successful! Model response: "${res.response}"`, "success");
            } else {
                toast.showToast(`Connection failed: ${res?.error || 'Unknown error'}`, "error");
            }
        } catch (err: any) {
            toast.showToast(`Connection failed: ${err?.response?.data?.error || err.message}`, "error");
        } finally {
            setIsTestingConnection(false);
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
        setLocalApiKey(apiKey);
        setLocalModel(model);
        setLocalApiBaseUrl(apiBaseUrl);
        setLocalProvider(provider);
        setLocalNoAi(noAi);
        
        if (project) {
            setProjectName(project.name);
        }

        const currentProv = PROVIDERS.find(p => p.id === provider);
        if (currentProv && currentProv.id !== 'custom') {
            const matched = currentProv.models.some(m => m.value === model);
            setIsCustomModel(!matched);
        } else {
            setIsCustomModel(provider === 'custom');
        }
    }, [apiKey, model, apiBaseUrl, provider, noAi, project]);

    const handleSelectProvider = (provId: string) => {
        setLocalProvider(provId);
        const config = PROVIDERS.find(p => p.id === provId);
        if (config) {
            setLocalApiBaseUrl(config.defaultUrl);
            setLocalModel(config.defaultModel);
            setIsCustomModel(provId === 'custom');
        }
    };

    const handleSaveAISettings = () => {
        setApiKey(localApiKey.trim());
        setModel(localModel.trim());
        setApiBaseUrl(localApiBaseUrl.trim());
        setProvider(localProvider);
        setNoAi(localNoAi);
        toast.showToast("AI configuration saved successfully", "success");
    };

    const handleSaveProjectName = async () => {
        if (!projectName.trim()) {
            toast.showToast("Project name cannot be empty", "error");
            return;
        }

        setIsSavingProject(true);
        try {
            if (projectName !== project?.name) {
                await renameProject(projectName.trim());
                toast.showToast("Project renamed successfully", "success");
            } else {
                toast.showToast("No changes to save", "info");
            }
        } catch (err) {
            toast.showToast(`Failed to save: ${err}`, "error");
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
            toast.showToast(`Failed to reset project: ${err}`, "error");
        } finally {
            setIsDestructiveAction(false);
        }
    };

    const handleDeleteConfirm = async () => {
        if (!project) return;
        setIsDestructiveAction(true);
        try {
            await deleteProject(project.id, deleteFromDisk);
            toast.showToast(deleteFromDisk
                ? "Project and files deleted successfully"
                : "Project deleted from database (files kept on disk)", "success");
            closeProject();
            setConfirmModal({ isOpen: false, type: null });
            setDeleteFromDisk(false);
        } catch (err) {
            toast.showToast(`Failed to delete project: ${err}`, "error");
        } finally {
            setIsDestructiveAction(false);
        }
    };

    const activeProvData = PROVIDERS.find(p => p.id === localProvider) || PROVIDERS[0];

    return (
        <div className="h-full w-full overflow-auto relative page-enter p-8 select-none" style={{ background: "var(--ide-bg)", color: "var(--ide-text)" }}>
            {/* Visual Background Glow */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute w-[500px] h-[500px] rounded-full opacity-[0.03] blur-[120px] bg-indigo-500 top-[-10%] right-[10%]" />
                <div className="absolute w-[400px] h-[400px] rounded-full opacity-[0.02] blur-[100px] bg-cyan-500 bottom-[10%] left-[5%]" />
            </div>

            <div className="relative z-10 max-w-5xl mx-auto space-y-8">
                
                {/* Header Title Section */}
                <div className="flex justify-between items-end border-b border-white/5 pb-6">
                    <div className="flex items-center gap-4">
                        {onBack && (
                            <button
                                onClick={onBack}
                                className="h-10 px-4 flex items-center justify-center rounded-xl text-white/60 hover:text-white transition-all border border-white/5 hover:border-white/20 hover:bg-white/5 text-xs font-bold gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                                Back
                            </button>
                        )}
                        <div>
                            <h1 className="text-2xl font-black text-white tracking-tight uppercase">Settings</h1>
                            <p className="text-xs text-white/40 mt-1">Configure workspace integrations, system theme, and project data.</p>
                        </div>
                    </div>

                    {/* Tab Navigation */}
                    {project && (
                        <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] p-1 backdrop-blur-sm">
                            <button
                                onClick={() => setActiveTab("ai")}
                                className={`h-8 px-4 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                                    activeTab === "ai"
                                        ? "bg-white text-black shadow-lg"
                                        : "text-white/50 hover:text-white hover:bg-white/10"
                                }`}
                            >
                                AI & Theme
                            </button>
                            <button
                                onClick={() => setActiveTab("project")}
                                className={`h-8 px-4 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                                    activeTab === "project"
                                        ? "bg-white text-black shadow-lg"
                                        : "text-white/50 hover:text-white hover:bg-white/10"
                                }`}
                            >
                                Project Settings
                            </button>
                        </div>
                    )}
                </div>

                {/* Tab content 1: AI Integration & Theme */}
                {activeTab === "ai" && (
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-8 animate-fade-in">
                        
                        {/* Left Column: Theme & Server Info */}
                        <div className="md:col-span-4 space-y-6">
                            
                            {/* Theme Toggle Card */}
                            <div className="bg-[#111116]/65 backdrop-blur-md border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-all duration-300 flex flex-col justify-between h-[160px]">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-center shrink-0">
                                        {theme === "dark" ? (
                                            <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                                            </svg>
                                        ) : (
                                            <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                                            </svg>
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="text-xs font-bold text-white uppercase tracking-widest">Interface Theme</h3>
                                        <p className="text-[10px] text-white/40 italic mt-0.5">
                                            Currently: {theme === "dark" ? "Onyx Black" : "Pure Light"}
                                        </p>
                                    </div>
                                </div>
                                
                                <div className="flex justify-between items-center bg-[#07070a]/50 p-2.5 rounded-xl border border-white/5">
                                    <span className="text-[10px] font-bold text-white/50 tracking-wider">DARK MODE</span>
                                    <button
                                        onClick={toggleTheme}
                                        className={`relative w-11 h-6 rounded-full transition-all duration-300 p-0.5 flex items-center ${
                                            theme === "light" ? "bg-indigo-500" : "bg-white/10"
                                        }`}
                                        aria-label="Toggle theme"
                                    >
                                        <span
                                            className={`block w-5 h-5 rounded-full bg-white transition-transform duration-300 shadow-md ${
                                                theme === "light" ? "translate-x-5" : "translate-x-0"
                                            }`}
                                        />
                                    </button>
                                </div>
                            </div>

                            {/* System Status Details */}
                            <div className="bg-[#111116]/65 backdrop-blur-md border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-all duration-300 space-y-4">
                                <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest">SYSTEM STATUS</h3>
                                <div className="space-y-3.5">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-white/40 text-[10px]">Backend Server</span>
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                            <span className="font-semibold text-white/90 text-[10px]">Online</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-white/40 text-[10px]">Active Project</span>
                                        <span className="font-bold text-[10px] text-white/70 tracking-wide uppercase truncate max-w-[140px]">
                                            {project?.name || "None"}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-white/40 text-[10px]">AI Integration</span>
                                        <span className={`text-[10px] font-semibold ${apiKey ? "text-cyan-400" : "text-amber-500"}`}>
                                            {apiKey ? "Provisioned" : "API Key Needed"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Column: AI Config Inputs */}
                        <div className="md:col-span-8 space-y-6 bg-[#111116]/30 border border-white/5 rounded-2xl p-6">
                            
                            <div>
                                <h2 className="text-sm font-black text-white tracking-widest uppercase mb-1">AI Credentials</h2>
                                <p className="text-[10px] text-white/40">Select a provider and enter your key to unlock the integrated AI tools.</p>
                            </div>

                            {/* Select Provider Grid */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Select AI Provider</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {PROVIDERS.map((prov) => {
                                        const isSelected = localProvider === prov.id;
                                        return (
                                            <button
                                                key={prov.id}
                                                onClick={() => handleSelectProvider(prov.id)}
                                                className={`relative flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all duration-300 ${
                                                    isSelected 
                                                        ? "bg-[#181822]/80 border-indigo-500/70 shadow-[0_0_15px_rgba(99,102,241,0.1)]" 
                                                        : "bg-[#111116]/80 border-white/5 hover:border-white/10 hover:bg-[#13131a]"
                                                }`}
                                            >
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                                                    isSelected ? "bg-indigo-500/10 text-indigo-400" : "bg-white/[0.02] text-white/40 border border-white/5"
                                                }`}>
                                                    {prov.icon}
                                                </div>
                                                <div className="truncate pr-4">
                                                    <h4 className="text-[11px] font-bold text-white tracking-wide">{prov.name}</h4>
                                                    <p className="text-[9px] text-white/35 mt-0.5 truncate">{prov.description}</p>
                                                </div>
                                                {isSelected && (
                                                    <div className="absolute top-2.5 right-2.5 w-3.5 h-3.5 rounded-full bg-indigo-500 flex items-center justify-center">
                                                        <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* API Key */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <label className="text-[10px] font-bold text-white/50 uppercase tracking-widest">API Key</label>
                                    {localProvider === 'openrouter' && (
                                        <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-[9px] text-indigo-400 hover:text-indigo-300">
                                            Get OpenRouter key →
                                        </a>
                                    )}
                                </div>
                                <div className="relative">
                                    <input
                                        type={showApiKey ? "text" : "password"}
                                        value={localApiKey}
                                        onChange={(e) => setLocalApiKey(e.target.value)}
                                        placeholder={activeProvData.placeholderKey}
                                        className="w-full bg-[#0a0a0f] border border-white/5 rounded-xl pl-4 pr-11 py-3 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 font-mono"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowApiKey(!showApiKey)}
                                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 p-1"
                                    >
                                        {showApiKey ? (
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                            </svg>
                                        ) : (
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Model selection */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Active LLM Model</label>
                                {localProvider !== 'custom' ? (
                                    <div className="space-y-2">
                                        <select
                                            value={isCustomModel ? "custom" : localModel}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (val === "custom") {
                                                    setIsCustomModel(true);
                                                    setLocalModel("");
                                                } else {
                                                    setIsCustomModel(false);
                                                    setLocalModel(val);
                                                }
                                            }}
                                            className="w-full bg-[#0a0a0f] border border-white/5 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-indigo-500/50"
                                        >
                                            {activeProvData.models.map((m) => (
                                                <option key={m.value} value={m.value}>{m.label} ({m.value})</option>
                                            ))}
                                            <option value="custom" className="font-bold text-indigo-400">Custom Model ID...</option>
                                        </select>
                                        {isCustomModel && (
                                            <input
                                                type="text"
                                                value={localModel}
                                                onChange={(e) => setLocalModel(e.target.value)}
                                                placeholder="Enter custom model ID..."
                                                className="w-full bg-[#0a0a0f] border border-white/5 rounded-xl px-4 py-3 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-500/50 font-mono"
                                            />
                                        )}
                                    </div>
                                ) : (
                                    <input
                                        type="text"
                                        value={localModel}
                                        onChange={(e) => setLocalModel(e.target.value)}
                                        placeholder="Enter model name..."
                                        className="w-full bg-[#0a0a0f] border border-white/5 rounded-xl px-4 py-3 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-500/50 font-mono"
                                    />
                                )}
                            </div>

                            {/* Advanced Accordion */}
                            <div className="border border-white/5 rounded-xl bg-[#111116]/30 overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => setShowAdvanced(!showAdvanced)}
                                    className="w-full px-4 py-3 flex items-center justify-between text-[10px] font-bold text-white/50 uppercase tracking-widest hover:bg-white/[0.02]"
                                >
                                    <span className="flex items-center gap-2">
                                        <svg className={`w-4 h-4 text-white/40 transition-transform ${showAdvanced ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                        </svg>
                                        Advanced Server Endpoint
                                    </span>
                                    <span className="text-[9px] font-normal lowercase tracking-normal text-white/30 truncate max-w-[250px]">
                                        {localApiBaseUrl}
                                    </span>
                                </button>
                                <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
                                    showAdvanced ? "max-h-[160px] border-t border-white/5 p-4 opacity-100" : "max-h-0 opacity-0"
                                }`}>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] font-bold text-white/45 uppercase tracking-widest">API Base URL</span>
                                            <span className="text-[9px] text-white/30">Customize URL for custom servers or proxying</span>
                                        </div>
                                        <input
                                            type="text"
                                            value={localApiBaseUrl}
                                            onChange={(e) => setLocalApiBaseUrl(e.target.value)}
                                            placeholder="https://api.example.com/v1"
                                            className="w-full bg-[#0a0a0f] border border-white/5 rounded-xl px-4 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-indigo-500/50"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Run Without AI Mode Toggle */}
                            <div className="flex items-center justify-between p-4 rounded-xl border border-amber-500/10 bg-amber-500/[0.01]">
                                <div>
                                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Run Without AI (Offline Mode)</h4>
                                    <p className="text-[9px] text-white/45 mt-0.5">Disable all AI features, prompts, and workshops. Ideal for local or offline dev.</p>
                                </div>
                                <button
                                    onClick={() => setLocalNoAi(!localNoAi)}
                                    className={`relative w-11 h-6 rounded-full transition-all duration-300 p-0.5 flex items-center ${
                                        localNoAi ? "bg-amber-500" : "bg-white/10"
                                    }`}
                                    aria-label="Toggle Offline Mode"
                                >
                                    <span
                                        className={`block w-5 h-5 rounded-full bg-white transition-transform duration-300 shadow-md ${
                                            localNoAi ? "translate-x-5" : "translate-x-0"
                                        }`}
                                    />
                                </button>
                            </div>

                            {/* Save Actions */}
                            <div className="pt-4 flex justify-end gap-3 border-t border-white/5">
                                <button
                                    onClick={handleTestConnection}
                                    disabled={isTestingConnection || localNoAi}
                                    className="px-6 py-2.5 rounded-xl border border-white/10 hover:border-white/20 hover:bg-white/5 text-white font-bold text-[11px] uppercase tracking-widest transition-all disabled:opacity-30 font-bold"
                                >
                                    {isTestingConnection ? "Testing..." : "Test Connection"}
                                </button>
                                <button
                                    onClick={handleSaveAISettings}
                                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-black text-[11px] uppercase tracking-widest hover:from-indigo-600 hover:to-purple-700 transition-all shadow-[0_0_15px_rgba(99,102,241,0.2)]"
                                >
                                    Save AI Configuration
                                </button>
                            </div>
                        </div>

                    </div>
                )}

                {/* Tab content 2: Project Administration */}
                {activeTab === "project" && (
                    <div className="space-y-8 animate-fade-in">
                        
                        {/* Project Rename Section */}
                        <div className="bg-[#111116]/30 border border-white/5 rounded-2xl p-6 space-y-6">
                            <div>
                                <h2 className="text-sm font-black text-white tracking-widest uppercase mb-1">Project Preferences</h2>
                                <p className="text-[10px] text-white/40">Rename the project schema representation.</p>
                            </div>

                            <div className="space-y-2 max-w-lg">
                                <label className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Project Name</label>
                                <input
                                    type="text"
                                    value={projectName}
                                    onChange={(e) => setProjectName(e.target.value)}
                                    placeholder="Enter project name..."
                                    className="w-full bg-[#0a0a0f] border border-white/5 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-indigo-500/50 transition-all font-semibold"
                                />
                            </div>

                            <div className="pt-4 flex justify-end border-t border-white/5">
                                <button
                                    onClick={handleSaveProjectName}
                                    disabled={isSavingProject}
                                    className="px-6 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 border border-indigo-400/30 text-white font-black text-[11px] uppercase tracking-widest transition-all disabled:opacity-50 flex items-center gap-2"
                                >
                                    {isSavingProject ? "Saving..." : "Save Project Settings"}
                                </button>
                            </div>
                        </div>

                        {/* Danger Zone Section */}
                        <div className="bg-red-500/[0.02] border border-red-500/10 rounded-2xl p-6 space-y-6">
                            <div className="flex items-center gap-2">
                                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <div>
                                    <h2 className="text-sm font-black text-white tracking-widest uppercase mb-1">Danger Zone</h2>
                                    <p className="text-[10px] text-red-500/50">These actions are destructive and cannot be undone.</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-red-500/10">
                                
                                {/* Reset card */}
                                <div className="border border-white/5 rounded-xl p-4 flex flex-col justify-between gap-4 bg-[#0a0a0f]/50">
                                    <div>
                                        <h4 className="text-[11px] font-bold text-white/90">Reset Project Content</h4>
                                        <p className="text-[9px] text-white/35 mt-1 leading-relaxed">
                                            Resets all database entries (pages, blocks, logic flows) back to the original starter template.
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setConfirmModal({ isOpen: true, type: "reset" })}
                                        disabled={isDestructiveAction}
                                        className="w-full py-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 transition-colors text-amber-500 text-[10px] font-bold uppercase tracking-wider disabled:opacity-50"
                                    >
                                        Reset Project
                                    </button>
                                </div>

                                {/* Delete card */}
                                <div className="border border-white/5 rounded-xl p-4 flex flex-col justify-between gap-4 bg-[#0a0a0f]/50">
                                    <div>
                                        <h4 className="text-[11px] font-bold text-white/90">Delete Project</h4>
                                        <p className="text-[9px] text-white/35 mt-1 leading-relaxed">
                                            Removes this project registration. You can choose to optionally delete files on disk or keep them.
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setConfirmModal({ isOpen: true, type: "delete" })}
                                        disabled={isDestructiveAction}
                                        className="w-full py-2.5 rounded-lg border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 transition-colors text-red-500 text-[10px] font-bold uppercase tracking-wider disabled:opacity-50"
                                    >
                                        Delete Project
                                    </button>
                                </div>

                            </div>
                        </div>

                    </div>
                )}

            </div>

            {/* Confirmation Dialogs */}
            <ConfirmModal
                isOpen={confirmModal.isOpen && confirmModal.type === "reset"}
                title="Reset Project Content"
                message="This will permanently delete ALL content (pages, blocks, logic) in this project. The project folder will be reset to a fresh starter template. This cannot be undone."
                confirmText="Reset Everything"
                variant="warning"
                onConfirm={handleResetConfirm}
                onCancel={() => setConfirmModal({ isOpen: false, type: null })}
                isLoading={isDestructiveAction}
            />

            <ConfirmModal
                isOpen={confirmModal.isOpen && confirmModal.type === "delete"}
                title={`Delete "${project?.name}"?`}
                message="This will permanently remove the project from the database and close the editor."
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
