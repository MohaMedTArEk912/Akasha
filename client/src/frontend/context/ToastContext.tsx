import React, { createContext, useContext, useState, ReactNode } from "react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

interface ToastContextProps {
    showToast: (message: string, type: ToastType) => void;
    success: (message: string) => void;
    error: (message: string) => void;
    info: (message: string) => void;
    warning: (message: string) => void;
}

const ToastContext = createContext<ToastContextProps | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const removeToast = (id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    };

    const showToast = (message: string, type: ToastType) => {
        const id = Math.random().toString(36).substr(2, 9);
        const toast = { id, message, type };
        setToasts((prev) => [...prev, toast]);
        setTimeout(() => removeToast(id), 4000);
    };

    const success = (message: string) => showToast(message, "success");
    const error = (message: string) => showToast(message, "error");
    const info = (message: string) => showToast(message, "info");
    const warning = (message: string) => showToast(message, "warning");

    const getBadge = (type: ToastType) => {
        switch (type) {
            case "success":
                return (
                    <span className="px-1.5 py-0.5 rounded font-mono text-[10px] font-bold tracking-wider bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                        OK
                    </span>
                );
            case "error":
                return (
                    <span className="px-1.5 py-0.5 rounded font-mono text-[10px] font-bold tracking-wider bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                        ERR
                    </span>
                );
            case "warning":
                return (
                    <span className="px-1.5 py-0.5 rounded font-mono text-[10px] font-bold tracking-wider bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                        WARN
                    </span>
                );
            default:
                return (
                    <span className="px-1.5 py-0.5 rounded font-mono text-[10px] font-bold tracking-wider bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                        INFO
                    </span>
                );
        }
    };

    return (
        <ToastContext.Provider value={{ showToast, success, error, info, warning }}>
            {children}
            <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        className="animate-slide-up pointer-events-auto min-w-[280px] max-w-sm bg-white/80 dark:bg-black/75 backdrop-blur-2xl border border-black/10 dark:border-white/10 shadow-2xl rounded-xl p-3 flex items-center gap-3 transition-all"
                    >
                        {getBadge(toast.type)}
                        <p className="text-xs font-mono font-medium text-neutral-900 dark:text-white flex-1">{toast.message}</p>
                        <button
                            className="font-mono text-xs text-neutral-400 hover:text-neutral-900 dark:hover:text-white px-1 transition-colors"
                            onClick={() => removeToast(toast.id)}
                            title="Close"
                        >
                            ✕
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error("useToast must be used within a ToastProvider");
    }
    return context;
};
