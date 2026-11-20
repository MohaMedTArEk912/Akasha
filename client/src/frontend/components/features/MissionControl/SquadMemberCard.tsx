import React from "react";
import { Terminal } from "lucide-react";
import type { SquadMember } from "../../../types/agentSquad";

interface SquadMemberCardProps {
  member: SquadMember;
}

export const SquadMemberCard: React.FC<SquadMemberCardProps> = ({ member }) => {
  const isThinking = member.status === "thinking";
  const isExecuting = member.status === "executing";
  const isDone = member.status === "completed";
  const isError = member.status === "error";

  return (
    <div
      className={`p-4 rounded-2xl border transition-colors ${
        isExecuting
          ? "bg-[#1B5BFF]/[0.05] dark:bg-[#5B8CFF]/15 border-[#1B5BFF]/50"
          : isThinking
          ? "bg-[var(--ide-bg-elevated)] border-indigo-400/50"
          : isDone
          ? "bg-[var(--ide-bg-elevated)] border-emerald-300 dark:border-emerald-500/35"
          : isError
          ? "bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-500/45"
          : "bg-[var(--ide-bg-elevated)] border-[var(--ide-border)]"
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-8 h-8 rounded-lg bg-gradient-to-r ${member.avatarGradient} flex items-center justify-center font-bold text-xs text-white shrink-0`}
          >
            {member.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-[var(--ide-text)] truncate">{member.name}</h4>
            <span className="text-[11px] text-[var(--ide-text-muted)] capitalize">
              {member.role.replace("_", " ")}
            </span>
          </div>
        </div>

        <span
          className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border capitalize shrink-0 ${
            isExecuting
              ? "bg-[#1B5BFF]/10 text-[#1B5BFF] dark:text-[#7AA3FF] border-[#1B5BFF]/30"
              : isThinking
              ? "bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/30"
              : isDone
              ? "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30"
              : isError
              ? "bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30"
              : "bg-[var(--ide-accent-subtle)] text-[var(--ide-text-muted)] border-[var(--ide-border)]"
          }`}
        >
          {member.status}
        </span>
      </div>

      <p className="text-xs text-[var(--ide-text-secondary)] leading-relaxed min-h-[38px]">
        {member.description}
      </p>

      {member.activeTool && (
        <div className="mt-2.5 p-2 rounded-lg bg-[var(--ide-bg)] border border-[var(--ide-border)] text-[11px] font-mono flex items-center gap-1.5 text-[#1B5BFF] dark:text-[#7AA3FF]">
          <Terminal className="w-3 h-3 shrink-0" />
          <span className="truncate">{member.activeTool}</span>
        </div>
      )}

      {member.filesModified.length > 0 && (
        <div className="mt-2 text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
          Updated {member.filesModified.length} file(s)
        </div>
      )}
    </div>
  );
};
