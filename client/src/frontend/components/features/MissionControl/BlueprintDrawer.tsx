import React from 'react';
import { FileCode, Database, Cable, Palette } from 'lucide-react';
import type { CompiledProjectBlueprint } from '../../../types/agentSquad';

interface BlueprintDrawerProps {
    blueprint: CompiledProjectBlueprint;
    isOpen: boolean;
}

export const BlueprintDrawer: React.FC<BlueprintDrawerProps> = ({ blueprint, isOpen }) => {
    if (!isOpen) return null;

    return (
        <div className="bg-[#0b0f1a] rounded-2xl border border-white/10 p-5 space-y-4 shadow-2xl animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wide">
                        Active Project Structured Blueprint
                    </h3>
                </div>
                <span className="text-xs text-slate-400">Compiled from Akasha project state</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                {/* Data Models */}
                <div className="bg-slate-950/80 p-3.5 rounded-xl border border-white/5 space-y-2">
                    <div className="font-bold text-indigo-400 flex items-center gap-1.5">
                        <Database className="w-3.5 h-3.5" />
                        Data Models ({blueprint.entities.length})
                    </div>
                    <div className="max-h-36 overflow-y-auto space-y-1 pr-1 font-mono text-[11px] text-slate-300 custom-scrollbar">
                        {blueprint.entities.length === 0 ? (
                            <div className="text-slate-500 italic p-1">No data models defined</div>
                        ) : (
                            blueprint.entities.map((e, idx) => (
                                <div key={idx} className="p-1.5 rounded bg-white/5 flex items-center justify-between">
                                    <strong>{e.name}</strong>
                                    <span className="text-slate-500">{e.fields.length} fields</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* REST APIs */}
                <div className="bg-slate-950/80 p-3.5 rounded-xl border border-white/5 space-y-2">
                    <div className="font-bold text-cyan-400 flex items-center gap-1.5">
                        <Cable className="w-3.5 h-3.5" />
                        REST APIs ({blueprint.apiContracts.length})
                    </div>
                    <div className="max-h-36 overflow-y-auto space-y-1 pr-1 font-mono text-[11px] text-slate-300 custom-scrollbar">
                        {blueprint.apiContracts.length === 0 ? (
                            <div className="text-slate-500 italic p-1">No endpoints defined</div>
                        ) : (
                            blueprint.apiContracts.map((a, idx) => (
                                <div key={idx} className="p-1.5 rounded bg-white/5 flex items-center gap-2">
                                    <span className="text-cyan-400 font-bold uppercase">{a.method}</span>
                                    <span className="truncate">{a.path}</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* UI Pages */}
                <div className="bg-slate-950/80 p-3.5 rounded-xl border border-white/5 space-y-2">
                    <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                        <Palette className="w-3.5 h-3.5" />
                        UI Pages ({blueprint.pages.length})
                    </div>
                    <div className="max-h-36 overflow-y-auto space-y-1 pr-1 font-mono text-[11px] text-slate-300 custom-scrollbar">
                        {blueprint.pages.length === 0 ? (
                            <div className="text-slate-500 italic p-1">No pages defined</div>
                        ) : (
                            blueprint.pages.map((p, idx) => (
                                <div key={idx} className="p-1.5 rounded bg-white/5 flex items-center justify-between">
                                    <strong>{p.name}</strong>
                                    <span className="text-slate-500 font-mono text-[10px]">{p.path}</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
