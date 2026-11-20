import React from "react";
import { Zap } from "lucide-react";
import type { CompiledProjectBlueprint } from "../../../types/agentSquad";

interface TokenOptimizationBannerProps {
  blueprint: CompiledProjectBlueprint;
}

export const TokenOptimizationBanner: React.FC<TokenOptimizationBannerProps> = ({ blueprint }) => {
  return (
    <div className="studio-surface p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#1B5BFF]/10 text-[#1B5BFF] dark:text-[#7AA3FF] flex items-center justify-center shrink-0">
          <Zap className="w-4 h-4" />
        </div>
        <div>
          <div className="text-sm font-bold text-[var(--ide-text)]">
            Structured blueprint context active
          </div>
          <div className="text-xs text-[var(--ide-text-secondary)] mt-0.5">
            {blueprint.entities.length} models, {blueprint.apiContracts.length} APIs, and {blueprint.pages.length} screens compiled for coding agents.
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
        <div className="bg-[var(--ide-bg)] px-3 py-1.5 rounded-lg border border-[var(--ide-border)] text-[var(--ide-text-secondary)]">
          Full scan:{" "}
          <span className="line-through text-rose-600 dark:text-rose-400">
            ~{blueprint.tokenMetrics.baselineExplorationTokens.toLocaleString()}
          </span>
        </div>
        <div className="bg-[var(--ide-bg)] px-3 py-1.5 rounded-lg border border-[var(--ide-border)] text-[var(--ide-text)]">
          Blueprint:{" "}
          <strong className="text-[#1B5BFF] dark:text-[#7AA3FF]">
            ~{blueprint.tokenMetrics.structuredBlueprintTokens.toLocaleString()} tokens
          </strong>
        </div>
        <div className="px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-semibold">
          {blueprint.tokenMetrics.savingsPercent}% saved
        </div>
      </div>
    </div>
  );
};
