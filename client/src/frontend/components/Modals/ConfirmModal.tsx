import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: "danger" | "warning" | "default";
    onConfirm: () => void;
    onCancel: () => void;
    isLoading?: boolean;
    /** Optional checkbox configuration */
    checkboxConfig?: {
        label: string;
        checked: boolean;
        onChange: (checked: boolean) => void;
    };
}


/**
 * A premium confirmation modal component with rich visual design.
 * Uses React Portals to ensure it renders outside any containing elements.
 */
const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    title,
    message,
    confirmText = "Confirm",
    cancelText = "Cancel",
    variant = "default",
    onConfirm,
    onCancel,
    isLoading = false,
    checkboxConfig,
}) => {

    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    if (!isOpen || !mounted) return null;

    const variantConfig = {
        danger: {
            gradient: "from-red-600/20 via-red-500/10 to-transparent",
            borderGlow: "shadow-[0_0_60px_-15px_rgba(239,68,68,0.5)]",
            iconBg: "bg-gradient-to-br from-red-500/30 to-red-600/20",
            iconColor: "text-red-400",
            confirmBtn: "bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 shadow-lg shadow-red-500/30",
            ring: "focus:ring-red-500/50",
            icon: (
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
            ),
        },
        warning: {
            gradient: "from-amber-500/20 via-yellow-500/10 to-transparent",
            borderGlow: "shadow-[0_0_60px_-15px_rgba(245,158,11,0.5)]",
            iconBg: "bg-gradient-to-br from-amber-500/30 to-yellow-600/20",
            iconColor: "text-amber-400",
            confirmBtn: "bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black shadow-lg shadow-amber-500/30",
            ring: "focus:ring-amber-500/50",
            icon: (
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
            ),
        },
        default: {
            gradient: "from-indigo-500/20 via-violet-500/10 to-transparent",
            borderGlow: "shadow-[0_0_60px_-15px_rgba(99,102,241,0.5)]",
            iconBg: "bg-gradient-to-br from-indigo-500/30 to-violet-600/20",
            iconColor: "text-indigo-400",
            confirmBtn: "bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 shadow-lg shadow-indigo-500/30",
            ring: "focus:ring-indigo-500/50",
            icon: (
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            ),
        },
    };

    const config = variantConfig[variant];

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto"
            style={{ animation: "fadeIn 0.2s ease-out" }}
        >
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/80 backdrop-blur-md"
                onClick={onCancel}
            />

            {/* Modal Container */}
            <div
                className={`relative w-full max-w-md overflow-hidden rounded-3xl border border-[var(--ide-border-strong)] bg-[var(--ide-bg-panel)] ${config.borderGlow}`}
                style={{ animation: "scaleIn 0.25s ease-out" }}
            >
                {/* Gradient Accent */}
                <div className={`absolute inset-0 bg-gradient-to-b ${config.gradient} pointer-events-none`} />

                {/* Decorative Orbs */}
                <div className="absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-[var(--ide-text)]/8 to-transparent rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-gradient-to-tr from-[var(--ide-text)]/8 to-transparent rounded-full blur-2xl pointer-events-none" />

                {/* Content */}
                <div className="relative p-8">
                    {/* Icon */}
                    <div className="flex justify-center mb-6">
                        <div className={`w-20 h-20 rounded-2xl ${config.iconBg} ${config.iconColor} flex items-center justify-center border border-[var(--ide-border)] backdrop-blur-sm`}>
                            {config.icon}
                        </div>
                    </div>

                    {/* Text */}
                    <div className="text-center mb-6">
                        <h3 className="text-2xl font-bold text-[var(--ide-text)] mb-3 tracking-tight">{title}</h3>
                        <p className="text-base text-[var(--ide-text-secondary)] leading-relaxed max-w-sm mx-auto">{message}</p>
                    </div>

                    {/* Optional Checkbox */}
                    {checkboxConfig && (
                        <label className="flex items-center justify-center gap-3 mb-6 cursor-pointer group">
                            <input
                                type="checkbox"
                                checked={checkboxConfig.checked}
                                onChange={(e) => checkboxConfig.onChange(e.target.checked)}
                                className="w-5 h-5 rounded-md border-2 border-[var(--ide-border-strong)] bg-[var(--ide-bg-elevated)] checked:bg-red-500 checked:border-red-500 focus:ring-2 focus:ring-red-500/30 transition-all cursor-pointer"
                            />
                            <span className="text-sm text-[var(--ide-text-secondary)] group-hover:text-[var(--ide-text)] transition-colors">
                                {checkboxConfig.label}
                            </span>
                        </label>
                    )}

                    {/* Actions */}

                    <div className="flex gap-4">
                        <button
                            onClick={onCancel}
                            disabled={isLoading}
                            className="flex-1 px-6 py-3.5 rounded-xl text-sm font-bold text-[var(--ide-text-secondary)] bg-[var(--ide-bg-elevated)] hover:bg-[var(--ide-bg-sidebar)] border border-[var(--ide-border)] hover:border-[var(--ide-border-strong)] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {cancelText}
                        </button>
                        <button
                            onClick={onConfirm}
                            disabled={isLoading}
                            className={`flex-1 px-6 py-3.5 rounded-xl text-sm font-bold text-white ${config.confirmBtn} transition-all duration-200 focus:outline-none focus:ring-2 ${config.ring} disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
                        >
                            {isLoading ? (
                                <>
                                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Processing...
                                </>
                            ) : (
                                confirmText
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Keyframes for animations */}
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes scaleIn {
                    from {
                        opacity: 0;
                        transform: scale(0.95) translateY(10px);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1) translateY(0);
                    }
                }
            `}</style>
        </div>,
        document.body
    );
};

export default ConfirmModal;
