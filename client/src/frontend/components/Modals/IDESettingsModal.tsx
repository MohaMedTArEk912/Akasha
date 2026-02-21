import React from "react";
import { useTheme } from "../../context/ThemeContext";
import Modal from "../Shared/Modal";

interface IDESettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

/**
 * IDE Settings Modal - Configure IDE-wide settings.
 */
const IDESettingsModal: React.FC<IDESettingsModalProps> = ({ isOpen, onClose }) => {
    const { theme, toggleTheme } = useTheme();

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="SETTINGS" size="md" className="bg-[#0a0a0f] border-white/5 shadow-2xl">
            <div className="relative pt-2 pb-8 px-8 overflow-hidden">
                {/* Background Glow */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[150%] h-[150%] bg-indigo-500/5 blur-3xl pointer-events-none rounded-full" />

                <div className="relative z-10 space-y-8">
                    {/* Appearance Section */}
                    <div className="animate-fade-in space-y-4">
                        <label className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] px-1">
                            System Appearance
                        </label>

                        {/* Theme Toggle */}
                        <div className="group bg-[#111116] border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-all duration-300">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-center group-hover:bg-white/[0.05] transition-all duration-300">
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
                                    <div className="space-y-1">
                                        <p className="text-xs font-bold text-white uppercase tracking-widest">Interface Theme</p>
                                        <p className="text-[10px] text-white/40 italic">
                                            Currently: {theme === "dark" ? "Onyx Black" : "Pure Light"}
                                        </p>
                                    </div>
                                </div>

                                {/* Toggle Switch */}
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
                    </div>

                    {/* Info */}
                    <div className="pt-6 border-t border-white/5 text-center animate-fade-in" style={{ animationDelay: '100ms' }}>
                        <p className="text-[9px] text-white/30 font-bold uppercase tracking-[0.3em]">
                            Precision Engineering • v0.1.0
                        </p>
                    </div>

                    <div className="flex pt-2">
                        <button
                            onClick={onClose}
                            className="w-full py-3.5 rounded-xl bg-white text-black font-black text-[11px] uppercase tracking-widest hover:bg-white/90 active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                        >
                            Save Configurations
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default IDESettingsModal;
