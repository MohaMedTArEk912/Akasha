import React from "react";
import { useBackgroundLoading } from "../../../context/BackgroundLoadingContext";

export interface CodeRuntimeConsoleProps {
  className?: string;
  defaultExpanded?: boolean;
}

/**
 * CodeRuntimeConsole — Lightweight pure-CSS background task bar.
 * Replaces the legacy Three.js 3D clock/silicon wafer background console.
 */
export const CodeRuntimeConsole: React.FC<CodeRuntimeConsoleProps> = ({
  className = "",
}) => {
  const { activeTasks, isLoading } = useBackgroundLoading();
  const currentTask = activeTasks[activeTasks.length - 1];

  if (!isLoading && activeTasks.length === 0) {
    return null;
  }

  return (
    <div
      className={`w-full rounded-xl px-4 py-2.5 bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] flex items-center justify-between gap-3 text-xs ${className}`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="w-2 h-2 rounded-full bg-[var(--ide-accent)] animate-pulse shrink-0" />
        <span className="font-semibold text-[var(--ide-text)] truncate">
          {currentTask?.title || "Working"}
        </span>
        {currentTask?.step && (
          <span className="text-[var(--ide-text-muted)] truncate">
            {currentTask.step}
          </span>
        )}
      </div>
      {typeof currentTask?.progress === "number" && (
        <span className="font-mono text-[11px] font-medium text-[var(--ide-accent)] shrink-0">
          {currentTask.progress}%
        </span>
      )}
    </div>
  );
};

export default CodeRuntimeConsole;
