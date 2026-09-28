import React from "react";
import Modal from "../ui/Modal";

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

    const variantConfig = {
        danger: {
            accentColor: "text-rose-500",
            confirmBtn: "bg-rose-600 hover:bg-rose-500 text-white",
            ring: "focus:ring-rose-500/40",
            tagLabel: "DESTRUCTIVE",
            tagCls: "bg-rose-500/10 text-rose-500 border-rose-500/20",
        },
        warning: {
            accentColor: "text-amber-500",
            confirmBtn: "bg-amber-500 hover:bg-amber-400 text-black font-bold",
            ring: "focus:ring-amber-500/40",
            tagLabel: "WARNING",
            tagCls: "bg-amber-500/10 text-amber-500 border-amber-500/20",
        },
        default: {
            accentColor: "text-cyan-500",
            confirmBtn: "bg-gradient-to-r from-blue-600 to-cyan-500 hover:brightness-110 text-white",
            ring: "focus:ring-cyan-500/40",
            tagLabel: "CONFIRM",
            tagCls: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
        },
    };

    const config = variantConfig[variant];

    return (
        <Modal isOpen={isOpen} onClose={onCancel} title={title} size="sm" width="400px">
            <div className="p-5 space-y-4">
                {/* Tag + Title */}
                <div className="space-y-2">
                    <span className={`inline-block text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${config.tagCls}`}>
                        {config.tagLabel}
                    </span>
                    <h3 className="text-base font-bold text-neutral-950 dark:text-white tracking-tight">
                        {title}
                    </h3>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                        {message}
                    </p>
                </div>

                {/* Optional checkbox */}
                {checkboxConfig && (
                    <label className="flex items-center gap-2.5 cursor-pointer group">
                        <input
                            type="checkbox"
                            checked={checkboxConfig.checked}
                            onChange={(e) => checkboxConfig.onChange(e.target.checked)}
                            className="w-4 h-4 rounded border-2 border-neutral-300 dark:border-white/20 bg-transparent checked:bg-rose-500 checked:border-rose-500 focus:ring-1 focus:ring-rose-500/30 transition-all cursor-pointer"
                        />
                        <span className="text-[11px] text-neutral-600 dark:text-neutral-400 group-hover:text-neutral-800 dark:group-hover:text-white transition-colors">
                            {checkboxConfig.label}
                        </span>
                    </label>
                )}

                {/* Action buttons */}
                <div className="flex gap-2.5 pt-1">
                    <button
                        onClick={onCancel}
                        disabled={isLoading}
                        className="flex-1 px-4 py-2 rounded-lg text-[11px] font-semibold text-neutral-600 dark:text-neutral-300 bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] dark:hover:bg-white/[0.1] border border-black/[0.06] dark:border-white/10 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isLoading}
                        className={`flex-1 px-4 py-2 rounded-lg text-[11px] font-bold ${config.confirmBtn} transition-all active:scale-[0.98] focus:outline-none focus:ring-1 ${config.ring} disabled:opacity-50 disabled:cursor-wait cursor-pointer shadow-sm`}
                    >
                        {isLoading ? "Processing..." : confirmText}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default ConfirmModal;
