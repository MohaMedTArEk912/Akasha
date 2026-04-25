import React, { useState, useEffect } from "react";
import { useTheme } from "../../context/ThemeContext";
import { useSettings } from "../../context/SettingsContext";
import Modal from "../ui/Modal";

interface IDESettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

/**
 * IDE Settings Modal - Configure IDE-wide settings.
 */
const IDESettingsModal: React.FC<IDESettingsModalProps> = ({ isOpen, onClose }) => {
    const { theme, toggleTheme } = useTheme();
    const { apiKey, model, apiBaseUrl, setApiKey, setModel, setApiBaseUrl } = useSettings();
    const [localApiKey, setLocalApiKey] = useState(apiKey);
    const [localModel, setLocalModel] = useState(model);
    const [localApiBaseUrl, setLocalApiBaseUrl] = useState(apiBaseUrl);

    useEffect(() => {
        setLocalApiKey(apiKey);
        setLocalModel(model);
        setLocalApiBaseUrl(apiBaseUrl);
    }, [isOpen, apiKey, model, apiBaseUrl]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="SETTINGS" size="xl" className="bg-[#0a0a0f] border-white/5 shadow-2xl">
            <div className="relative pt-2 pb-8 px-8 overflow-hidden">
                {/* Background Glow */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[150%] h-[150%] bg-indigo-500/5 blur-3xl pointer-events-none rounded-full" />

                <div className="relative z-10 space-y-8">
                    {/* Settings Grid */}
                    <div className="grid grid-cols-2 gap-4 animate-fade-in">
                        {/* Theme Toggle */}
                        <div className="group bg-[#111116] border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-all duration-300 flex flex-col h-full">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-12 h-12 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-center group-hover:bg-white/[0.05] transition-all duration-300 shrink-0">
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
                                <div className="space-y-1 flex-1">
                                    <p className="text-xs font-bold text-white uppercase tracking-widest">Interface Theme</p>
                                    <p className="text-[10px] text-white/40 italic">
                                        Currently: {theme === "dark" ? "Onyx Black" : "Pure Light"}
                                    </p>
                                </div>
                            </div>
                            <div className="mt-auto flex justify-end">
                                <button
                                    onClick={toggleTheme}
                                    className={`relative w-12 h-6 rounded-full transition-all duration-300 flex-shrink-0 p-1 ${theme === "light"
                                        ? "bg-indigo-500/80"
                                        : "bg-white/10"
                                        }`}
                                    aria-label="Toggle theme"
                                >
                                    <span
                                        className={`block w-4 h-4 rounded-full bg-white transition-transform duration-300 ${theme === "light" ? "translate-x-6" : "translate-x-0"
                                            }`}
                                    />
                                </button>
                            </div>
                        </div>

                        {/* Model Input */}
                        <div className="group bg-[#111116] border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-all duration-300 flex flex-col h-full">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-12 h-12 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-center group-hover:bg-white/[0.05] transition-all duration-300 shrink-0">
                                    <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <div className="space-y-1 flex-1">
                                    <label className="text-xs font-bold text-white uppercase tracking-widest">Model</label>
                                    <p className="text-[9px] text-white/30">
                                        Default LLM model to use
                                    </p>
                                </div>
                            </div>
                            <div className="mt-auto">
                                <input
                                    type="text"
                                    value={localModel}
                                    onChange={(e) => setLocalModel(e.target.value)}
                                    placeholder="google/gemma-3-4b-it:free"
                                    className="w-full bg-[#0a0a0f] border border-white/5 rounded-lg px-4 py-2.5 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-400/50 focus:ring-1 focus:ring-indigo-400/20 transition-all"
                                />
                            </div>
                        </div>

                        {/* API Base URL Input */}
                        <div className="group bg-[#111116] border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-all duration-300 flex flex-col h-full" style={{ animationDelay: '50ms' }}>
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-12 h-12 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-center group-hover:bg-white/[0.05] transition-all duration-300 shrink-0">
                                    <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 7h16M4 12h16M4 17h16" />
                                    </svg>
                                </div>
                                <div className="space-y-1 flex-1">
                                    <label className="text-xs font-bold text-white uppercase tracking-widest">API Base URL</label>
                                    <p className="text-[9px] text-white/30">
                                        OpenAI-compatible endpoint
                                    </p>
                                </div>
                            </div>
                            <div className="mt-auto">
                                <input
                                    type="text"
                                    value={localApiBaseUrl}
                                    onChange={(e) => setLocalApiBaseUrl(e.target.value)}
                                    placeholder="https://openrouter.ai/api/v1"
                                    className="w-full bg-[#0a0a0f] border border-white/5 rounded-lg px-4 py-2.5 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-400/50 focus:ring-1 focus:ring-emerald-400/20 transition-all"
                                />
                            </div>
                        </div>

                        {/* API Key Input */}
                        <div className="group bg-[#111116] border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-all duration-300 flex flex-col h-full" style={{ animationDelay: '50ms' }}>
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-12 h-12 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-center group-hover:bg-white/[0.05] transition-all duration-300 shrink-0">
                                    <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.08 5.93m3.743-2.65a4 4 0 00-5.023-5.023m6.361-1.25a6 6 0 010 8.485M9 7a6 6 0 000 12m3-7a4 4 0 11-8 0 4 4 0 018 0z" />
                                    </svg>
                                </div>
                                <div className="space-y-1 flex-1">
                                    <label className="text-xs font-bold text-white uppercase tracking-widest">API Key</label>
                                    <p className="text-[9px] text-white/30">
                                        Provider API authentication
                                    </p>
                                </div>
                            </div>
                            <div className="mt-auto">
                                <input
                                    type="password"
                                    value={localApiKey}
                                    onChange={(e) => setLocalApiKey(e.target.value)}
                                    placeholder="your_openrouter_api_key_here"
                                    className="w-full bg-[#0a0a0f] border border-white/5 rounded-lg px-4 py-2.5 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/20 transition-all"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Info */}
                    <div className="pt-6 border-t border-white/5 text-center animate-fade-in" style={{ animationDelay: '100ms' }}>
                        <p className="text-[9px] text-white/30 font-bold uppercase tracking-[0.3em]">
                            Precision Engineering • v0.1.0
                        </p>
                    </div>

                    <div className="flex pt-2 gap-3">
                        <button
                            onClick={() => {
                                setApiKey(localApiKey);
                                setModel(localModel);
                                setApiBaseUrl(localApiBaseUrl);
                                onClose();
                            }}
                            className="flex-1 py-3.5 rounded-xl bg-white text-black font-black text-[11px] uppercase tracking-widest hover:bg-white/90 active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                        >
                            Save Configurations
                        </button>
                        <button
                            onClick={onClose}
                            className="flex-1 py-3.5 rounded-xl border border-white/10 text-white font-black text-[11px] uppercase tracking-widest hover:border-white/20 hover:bg-white/5 active:scale-[0.98] transition-all"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default IDESettingsModal;
