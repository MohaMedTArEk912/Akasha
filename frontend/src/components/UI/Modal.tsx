/**
 * Modal Component
 * 
 * Reusable modal dialog component.
 */

import { Component, JSX, Show, createEffect, onCleanup } from "solid-js";
import { Portal } from "solid-js/web";

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: JSX.Element;
    size?: "sm" | "md" | "lg" | "xl";
    showCloseButton?: boolean;
}

const Modal: Component<ModalProps> = (props) => {
    const sizeClasses = {
        sm: "max-w-sm",
        md: "max-w-md",
        lg: "max-w-lg",
        xl: "max-w-xl",
    };

    // Handle escape key
    createEffect(() => {
        if (props.isOpen) {
            const handleKeyDown = (e: KeyboardEvent) => {
                if (e.key === "Escape") {
                    props.onClose();
                }
            };
            document.addEventListener("keydown", handleKeyDown);
            onCleanup(() => document.removeEventListener("keydown", handleKeyDown));
        }
    });

    // Prevent body scroll when modal is open
    createEffect(() => {
        if (props.isOpen) {
            document.body.style.overflow = "hidden";
            onCleanup(() => {
                document.body.style.overflow = "";
            });
        }
    });

    return (
        <Show when={props.isOpen}>
            <Portal>
                {/* Backdrop */}
                <div
                    class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-fade-in"
                    onClick={props.onClose}
                />

                {/* Modal Container */}
                <div class="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
                    <div
                        class={`w-full ${sizeClasses[props.size || "md"]} bg-ide-panel rounded-xl shadow-2xl border border-ide-border pointer-events-auto animate-scale-in`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div class="flex items-center justify-between px-5 py-4 border-b border-ide-border">
                            <h2 class="text-lg font-semibold text-ide-text">{props.title}</h2>
                            <Show when={props.showCloseButton !== false}>
                                <button
                                    class="p-1.5 rounded-lg text-ide-text-muted hover:text-ide-text hover:bg-ide-bg transition-colors"
                                    onClick={props.onClose}
                                    aria-label="Close modal"
                                >
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </Show>
                        </div>

                        {/* Content */}
                        <div class="p-5">{props.children}</div>
                    </div>
                </div>
            </Portal>
        </Show>
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

export const ConfirmModal: Component<ConfirmModalProps> = (props) => {
    const variantClasses = {
        danger: "bg-ide-error hover:bg-red-600",
        warning: "bg-yellow-500 hover:bg-yellow-600",
        info: "bg-ide-accent hover:bg-indigo-600",
    };

    return (
        <Modal isOpen={props.isOpen} onClose={props.onClose} title={props.title} size="sm">
            <div class="text-ide-text-muted mb-6">{props.message}</div>
            <div class="flex justify-end gap-2">
                <button
                    class="btn-ghost"
                    onClick={props.onClose}
                >
                    {props.cancelText || "Cancel"}
                </button>
                <button
                    class={`px-4 py-2 rounded-lg text-white font-medium transition-colors ${variantClasses[props.variant || "info"]}`}
                    onClick={() => {
                        props.onConfirm();
                        props.onClose();
                    }}
                >
                    {props.confirmText || "Confirm"}
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

export const Toast: Component<ToastProps> = (props) => {
    const typeStyles = {
        success: "bg-ide-success text-white",
        error: "bg-ide-error text-white",
        warning: "bg-yellow-500 text-black",
        info: "bg-ide-accent text-white",
    };

    const typeIcons = {
        success: "M5 13l4 4L19 7",
        error: "M6 18L18 6M6 6l12 12",
        warning: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
        info: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    };

    // Auto-dismiss after 4 seconds
    createEffect(() => {
        const timer = setTimeout(props.onDismiss, 4000);
        onCleanup(() => clearTimeout(timer));
    });

    return (
        <Portal>
            <div class="fixed bottom-4 right-4 z-50 animate-slide-in-right">
                <div class={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl ${typeStyles[props.type]}`}>
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={typeIcons[props.type]} />
                    </svg>
                    <span class="font-medium">{props.message}</span>
                    <button
                        class="ml-2 p-1 hover:bg-white/20 rounded transition-colors"
                        onClick={props.onDismiss}
                        aria-label="Dismiss"
                    >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>
        </Portal>
    );
};

export default Modal;
