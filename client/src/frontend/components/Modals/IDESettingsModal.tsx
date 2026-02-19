import React from "react";
import { useTheme } from "../../context/ThemeContext";
import Modal from "../UI/Modal";

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
        <Modal isOpen={isOpen} onClose={onClose} title="Settings" size="md">
            <div className="space-y-10 py-4">
                {/* Appearance Section */}
                <div className="animate-fade-in">
                    <div className="flex items-center justify-between mb-8 px-1">
                        <label className="text-[10px] font-black text-[var(--ide-text-secondary)] uppercase tracking-[0.2em]">
                            System Appearance
                        </label>
                    </div>

                    {/* Theme Toggle */}
                    <div className="group bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] rounded-3xl p-6 transition-all duration-500 hover:border-[var(--ide-border-strong)]">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-5">
                                <div className="w-14 h-14 rounded-2xl bg-[var(--ide-bg-panel)] border border-[var(--ide-border)] flex items-center justify-center shadow-2xl group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                                    {theme === "dark" ? (
                                        <svg className="w-6 h-6 text-[var(--ide-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                                        </svg>
                                    ) : (
                                        <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                                        </svg>
                                    )}
                                </div>
                                <div className="space-y-0.5">
                                    <p className="text-[11px] font-black text-[var(--ide-text)] uppercase tracking-widest">Interface Theme</p>
                                    <p className="text-[10px] text-[var(--ide-text-muted)] font-black uppercase tracking-tighter italic">
                                        Currently: {theme === "dark" ? "Onyx Black" : "Pure Light"}
                                    </p>
                                </div>
                            </div>

                            {/* Toggle Switch */}
                            <button
                                onClick={toggleTheme}
                                className={`relative w-14 h-7 rounded-full transition-all duration-500 flex-shrink-0 p-1 ${theme === "light"
                                    ? "bg-indigo-500 shadow-[0_0_20px_-5px_rgba(99,102,241,0.5)]"
                                    : "bg-[var(--ide-border-strong)]"
                                    }`}
                                aria-label="Toggle theme"
                            >
                                <span
                                    className={`block w-5 h-5 rounded-full bg-white shadow-xl transition-transform duration-500 ${theme === "light" ? "translate-x-7" : "translate-x-0"
                                        }`}
                                />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Info */}
                <div className="pt-4 border-t border-[var(--ide-border)] text-center animate-fade-in" style={{ animationDelay: '100ms' }}>
                    <p className="text-[10px] text-[var(--ide-text-muted)] font-black uppercase tracking-[0.3em]">
                        Precision Engineering • v0.1.0
                    </p>
                </div>

                <div className="flex gap-3 pt-4">
                    <button
                        onClick={onClose}
                        className="flex-1 h-14 rounded-[1.5rem] bg-[var(--ide-text)] text-[var(--ide-bg)] font-black text-[11px] uppercase tracking-widest hover:opacity-90 active:scale-[0.98] transition-all"
                    >
                        Save Configurations
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default IDESettingsModal;
