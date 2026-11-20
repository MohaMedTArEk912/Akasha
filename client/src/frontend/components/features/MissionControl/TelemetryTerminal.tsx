import React from "react";
import { Terminal, Activity } from "lucide-react";
import type { TelemetryLog } from "../../../types/agentSquad";

interface TelemetryTerminalProps {
  logs: TelemetryLog[];
  progress: number;
  logContainerRef: React.RefObject<HTMLDivElement>;
}

export const TelemetryTerminal: React.FC<TelemetryTerminalProps> = ({
  logs,
  progress,
  logContainerRef,
}) => {
  return (
    <div className="studio-surface p-5 flex flex-col h-[540px]">
      <div className="flex items-center justify-between pb-3 border-b border-[var(--ide-border)]">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span className="text-sm font-bold text-[var(--ide-text)]">Live activity stream</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-[var(--ide-text-secondary)]">{progress}%</span>
          <div className="w-24 h-2 bg-[var(--ide-accent-subtle)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#1B5BFF] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      <div
        ref={logContainerRef}
        className="flex-1 overflow-y-auto space-y-2.5 py-3 pr-1 text-xs"
      >
        {logs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-[var(--ide-text-muted)] space-y-2.5 text-center px-4">
            <div className="w-11 h-11 rounded-2xl bg-[var(--ide-accent-subtle)] border border-[var(--ide-border)] flex items-center justify-center">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[var(--ide-text)] font-semibold text-sm">Waiting for activity</p>
              <p className="text-[var(--ide-text-secondary)] text-xs mt-1 max-w-sm leading-relaxed">
                Start a build mission on the left or connect an IDE agent over MCP to watch live progress and file updates here.
              </p>
            </div>
          </div>
        ) : (
          logs.map((log) => {
            const isSuccess = log.type === "success";
            const isError = log.type === "error";
            const isBuild = log.type === "build_check";

            return (
              <div
                key={log.id}
                className={`p-3 rounded-xl border ${
                  isError
                    ? "bg-rose-50 dark:bg-rose-950/35 border-rose-200 dark:border-rose-500/35"
                    : isSuccess
                    ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-500/35"
                    : isBuild
                    ? "bg-[#1B5BFF]/[0.05] dark:bg-[#5B8CFF]/15 border-[#1B5BFF]/25"
                    : "bg-[var(--ide-bg)] border-[var(--ide-border)]"
                }`}
              >
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-[#1B5BFF] dark:text-[#7AA3FF]">
                      {log.agentName}
                    </span>
                    <span className="text-[var(--ide-text-muted)]">{log.stepName}</span>
                  </div>
                  <span className="font-mono text-[10px] text-[var(--ide-text-muted)]">
                    {log.timestamp}
                  </span>
                </div>

                <div className="text-xs text-[var(--ide-text)] leading-relaxed">{log.thought}</div>

                {log.activeTool && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-[#1B5BFF]/10 text-[#1B5BFF] dark:text-[#7AA3FF] text-[10px] font-mono font-medium">
                      {log.activeTool}
                    </span>
                    {log.toolArgsSnippet && (
                      <span className="text-[10px] text-[var(--ide-text-muted)] font-mono truncate max-w-xs">
                        {log.toolArgsSnippet}
                      </span>
                    )}
                  </div>
                )}

                {log.fileCreatedOrModified && (
                  <div className="mt-1.5 text-[11px] text-emerald-700 dark:text-emerald-400 font-mono">
                    {log.fileCreatedOrModified}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
