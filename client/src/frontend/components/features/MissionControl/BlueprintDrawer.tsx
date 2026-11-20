import React from "react";
import { FileCode, Database, Cable, Palette } from "lucide-react";
import type { CompiledProjectBlueprint } from "../../../types/agentSquad";

interface BlueprintDrawerProps {
  blueprint: CompiledProjectBlueprint;
  isOpen: boolean;
}

export const BlueprintDrawer: React.FC<BlueprintDrawerProps> = ({ blueprint, isOpen }) => {
  if (!isOpen) return null;

  return (
    <div className="studio-surface p-5 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between pb-3 border-b border-[var(--ide-border)]">
        <div className="flex items-center gap-2">
          <FileCode className="w-4 h-4 text-[#1B5BFF] dark:text-[#7AA3FF]" />
          <h3 className="text-sm font-bold text-[var(--ide-text)]">Compiled project blueprint</h3>
        </div>
        <span className="text-xs text-[var(--ide-text-muted)]">Live workspace snapshot</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="bg-[var(--ide-bg)] p-3.5 rounded-xl border border-[var(--ide-border)] space-y-2">
          <div className="font-bold text-[#1B5BFF] dark:text-[#7AA3FF] flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5" />
            Models ({blueprint.entities.length})
          </div>
          <div className="max-h-36 overflow-y-auto space-y-1 font-mono text-[11px]">
            {blueprint.entities.length === 0 ? (
              <div className="text-[var(--ide-text-muted)]">No data models yet</div>
            ) : (
              blueprint.entities.map((e, idx) => (
                <div
                  key={idx}
                  className="p-1.5 rounded-lg bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] flex items-center justify-between"
                >
                  <strong className="text-[var(--ide-text)]">{e.name}</strong>
                  <span className="text-[var(--ide-text-muted)]">{e.fields.length} fields</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-[var(--ide-bg)] p-3.5 rounded-xl border border-[var(--ide-border)] space-y-2">
          <div className="font-bold text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
            <Cable className="w-3.5 h-3.5" />
            APIs ({blueprint.apiContracts.length})
          </div>
          <div className="max-h-36 overflow-y-auto space-y-1 font-mono text-[11px]">
            {blueprint.apiContracts.length === 0 ? (
              <div className="text-[var(--ide-text-muted)]">No endpoints yet</div>
            ) : (
              blueprint.apiContracts.map((a, idx) => (
                <div
                  key={idx}
                  className="p-1.5 rounded-lg bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] flex items-center gap-2"
                >
                  <span className="text-[#1B5BFF] dark:text-[#7AA3FF] font-bold uppercase">{a.method}</span>
                  <span className="truncate text-[var(--ide-text)]">{a.path}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-[var(--ide-bg)] p-3.5 rounded-xl border border-[var(--ide-border)] space-y-2">
          <div className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5" />
            Screens ({blueprint.pages.length})
          </div>
          <div className="max-h-36 overflow-y-auto space-y-1 font-mono text-[11px]">
            {blueprint.pages.length === 0 ? (
              <div className="text-[var(--ide-text-muted)]">No screens yet</div>
            ) : (
              blueprint.pages.map((p, idx) => (
                <div
                  key={idx}
                  className="p-1.5 rounded-lg bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] flex items-center justify-between"
                >
                  <strong className="text-[var(--ide-text)]">{p.name}</strong>
                  <span className="text-[var(--ide-text-muted)] text-[10px]">{p.path}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
