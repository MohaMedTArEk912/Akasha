/**
 * Modal Component - React version
 * 
 * Reusable modal dialog component.
 */

import React, { useEffect } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    size?: "sm" | "md" | "lg" | "xl";
    width?: string;
    showCloseButton?: boolean;
    className?: string;
}

const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    children,
    size = "md",
    width,
    showCloseButton = true,
    className = ""
}) => {
    const sizeClasses = {
        sm: "max-w-sm",
        md: "max-w-md",
        lg: "max-w-lg",
        xl: "max-w-xl",
    };

    // Handle escape key
    useEffect(() => {
        if (isOpen) {
            const handleKeyDown = (e: KeyboardEvent) => {
                if (e.key === "Escape") {
                    onClose();
                }
            };
            document.addEventListener("keydown", handleKeyDown);
            return () => document.removeEventListener("keydown", handleKeyDown);
        }
    }, [isOpen, onClose]);

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
            return () => {
                document.body.style.overflow = "";
            };
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return createPortal(
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm animate-fade-in"
                onClick={onClose}
            />

            {/* Modal Container */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
                <div
                    className={`w-full ${sizeClasses[size]} rounded-2xl border pointer-events-auto animate-slide-up overflow-hidden bg-white/95 dark:bg-[#0c0d16]/95 shadow-[0_25px_70px_-15px_rgba(0,0,0,0.5)] border-black/[0.08] dark:border-white/12 backdrop-blur-2xl ${className}`}
                    style={width ? { maxWidth: width } : undefined}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header: Only render if title is provided */}
                    {title && (
                        <div className="relative z-20 flex items-center justify-between px-5 pt-5 pb-3">
                            <h2 className="text-sm font-bold text-neutral-950 dark:text-white tracking-tight">
                                {title}
                            </h2>
                            {showCloseButton && (
                                <button
                                    className="text-[11px] font-mono px-2 py-1 rounded-lg text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-all z-20 cursor-pointer"
                                    onClick={onClose}
                                    aria-label="Close modal"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    )}

                    {/* Content */}
                    <div className="px-5 pb-5">{children}</div>
                </div>
            </div>
        </>,
        document.body
    );
};

// ConfirmModal - Specialized confirmation dialog
interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: "danger" | "warning" | "info";
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = "Confirm",
    cancelText = "Cancel",
    variant = "info"
}) => {
    const variantClasses = {
        danger: "bg-red-500 hover:bg-red-600 text-white",
        warning: "bg-yellow-500 hover:bg-yellow-600 text-black font-bold",
        info: "bg-indigo-500 hover:bg-indigo-600 text-white",
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
            <div className="text-[var(--ide-text-secondary)] mb-6">{message}</div>
            <div className="flex justify-end gap-2">
                <button
                    className="px-4 py-2 rounded-lg border border-[var(--ide-border)] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-bg-elevated)] transition-colors font-mono text-xs uppercase"
                    onClick={onClose}
                >
                    {cancelText}
                </button>
                <button
                    className={`px-4 py-2 rounded-lg font-mono text-xs font-bold uppercase transition-colors ${variantClasses[variant]}`}
                    onClick={() => {
                        onConfirm();
                        onClose();
                    }}
                >
                    {confirmText}
                </button>
            </div>
        </Modal>
    );
};

// Toast Component - For notifications
interface ToastProps {
    message: string;
    type: "success" | "error" | "warning" | "info";
    onDismiss: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, type, onDismiss }) => {
    const typeStyles = {
        success: "bg-emerald-500 text-white",
        error: "bg-red-500 text-white",
        warning: "bg-yellow-500 text-black font-bold",
        info: "bg-indigo-500 text-white",
    };

    const typeBadges = {
        success: "OK",
        error: "ERR",
        warning: "WARN",
        info: "INFO",
    };

    // Auto-dismiss after 4 seconds
    useEffect(() => {
        const timer = setTimeout(onDismiss, 4000);
        return () => clearTimeout(timer);
    }, [onDismiss]);

    return createPortal(
        <div className="fixed bottom-4 right-4 z-50 animate-slide-in-right">
            <div className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl ${typeStyles[type]}`}>
                <span className="font-mono text-xs font-bold tracking-wider px-1.5 py-0.5 rounded bg-black/20 text-current">
                    {typeBadges[type]}
                </span>
                <span className="font-medium text-xs font-mono">{message}</span>
                <button
                    className="ml-2 font-mono text-xs p-1 hover:bg-black/15 rounded transition-colors"
                    onClick={onDismiss}
                    aria-label="Dismiss"
                >
                    ✕
                </button>
            </div>
        </div>,
        document.body
    );
};

export default Modal;
