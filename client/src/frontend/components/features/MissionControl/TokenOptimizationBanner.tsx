import React from 'react';
import { Zap } from 'lucide-react';
import type { CompiledProjectBlueprint } from '../../../types/agentSquad';

interface TokenOptimizationBannerProps {
    blueprint: CompiledProjectBlueprint;
}

export const TokenOptimizationBanner: React.FC<TokenOptimizationBannerProps> = ({ blueprint }) => {
    return (
        <div className="bg-[#0c101d] p-4 rounded-2xl border border-cyan-500/25 flex flex-col md:flex-row md:items-center justify-between gap-4 backdrop-blur-xl shadow-xl">
            <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-300">
                    <Zap className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                        Structure-First Token Optimization Engine
                    </div>
                    <div className="text-sm font-semibold text-slate-200 mt-0.5">
                        Injected {blueprint.entities.length} Models, {blueprint.apiContracts.length} REST APIs, and {blueprint.pages.length} Pages directly into Antigravity context.
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-3 text-xs font-mono">
                <div className="bg-black/50 px-3 py-1.5 rounded-lg border border-white/10">
                    <span className="text-slate-400">Baseline Exploration:</span>{' '}
                    <span className="text-rose-400 font-bold line-through">
                        ~{blueprint.tokenMetrics.baselineExplorationTokens.toLocaleString()}
                    </span>
                </div>
                <div className="bg-black/50 px-3 py-1.5 rounded-lg border border-cyan-500/30">
                    <span className="text-slate-400">Blueprint Context:</span>{' '}
                    <span className="text-emerald-400 font-bold">
                        ~{blueprint.tokenMetrics.structuredBlueprintTokens.toLocaleString()} tokens
                    </span>
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold">
                    {blueprint.tokenMetrics.savingsPercent}% Tokens Saved
                </div>
            </div>
        </div>
    );
};
