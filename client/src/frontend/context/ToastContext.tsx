import React, { createContext, useContext, useState, ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from "lucide-react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextProps {
  showToast: (message: string, type: ToastType) => void;
  show: (options: { message: string; type?: ToastType } | string) => void;
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
    const id = Math.random().toString(36).slice(2, 10);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => removeToast(id), 3800);
  };

  const success = (message: string) => showToast(message, "success");
  const error = (message: string) => showToast(message, "error");
  const info = (message: string) => showToast(message, "info");
  const warning = (message: string) => showToast(message, "warning");

  const show = (options: { message: string; type?: ToastType } | string) => {
    if (typeof options === "string") {
      showToast(options, "info");
    } else {
      showToast(options.message, options.type || "info");
    }
  };

  const renderIcon = (type: ToastType) => {
    switch (type) {
      case "success":
        return <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />;
      case "error":
        return <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />;
      case "warning":
        return <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />;
      default:
        return <Info className="w-4 h-4 text-[#1B5BFF] dark:text-[#7AA3FF] shrink-0" />;
    }
  };

  return (
    <ToastContext.Provider value={{ showToast, show, success, error, info, warning }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence initial={false}>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-auto min-w-[260px] max-w-sm bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] shadow-[var(--ide-shadow)] rounded-xl px-3.5 py-2.5 flex items-center gap-2.5"
            >
              {renderIcon(toast.type)}
              <p className="text-[13px] font-medium text-[var(--ide-text)] flex-1 leading-snug">
                {toast.message}
              </p>
              <button
                type="button"
                className="p-1 rounded-md text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-accent-subtle)] transition-colors cursor-pointer"
                onClick={() => removeToast(toast.id)}
                aria-label="Dismiss notification"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
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
