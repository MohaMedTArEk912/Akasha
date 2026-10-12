import React from 'react';
import { Terminal } from 'lucide-react';
import type { SquadMember } from '../../../types/agentSquad';

interface SquadMemberCardProps {
    member: SquadMember;
}

export const SquadMemberCard: React.FC<SquadMemberCardProps> = ({ member }) => {
    const isThinking = member.status === 'thinking';
    const isExecuting = member.status === 'executing';
    const isDone = member.status === 'completed';
    const isError = member.status === 'error';

    return (
        <div
            className={`relative p-5 rounded-2xl border transition-all duration-300 shadow-xl ${
                isExecuting
                    ? 'bg-[#10182b] border-cyan-400/60 shadow-[0_0_30px_rgba(6,182,212,0.25)] scale-[1.02]'
                    : isThinking
                    ? 'bg-[#0f1424] border-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.2)]'
                    : isDone
                    ? 'bg-[#0c121f] border-emerald-500/40'
                    : isError
                    ? 'bg-rose-950/40 border-rose-500/50 shadow-[0_0_20px_rgba(244,63,94,0.2)]'
                    : 'bg-[#0d121f] border-white/10 hover:border-white/20'
            }`}
        >
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-r ${member.avatarGradient} flex items-center justify-center font-black text-xs text-white shadow-md`}>
                        {member.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                        <h4 className="text-xs font-bold text-slate-100">{member.name}</h4>
                        <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-400">
                            {member.role.replace('_', ' ')}
                        </span>
                    </div>
                </div>

                {/* Status Badge */}
                <span
                    className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-full border ${
                        isExecuting
                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 animate-pulse'
                            : isThinking
                            ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 animate-pulse'
                            : isDone
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : isError
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                            : 'bg-white/5 text-slate-400 border-white/10'
                    }`}
                >
                    {member.status}
                </span>
            </div>

            <p className="text-[11.5px] text-slate-400 leading-relaxed mb-3 min-h-[44px]">
                {member.description}
            </p>

            {member.activeTool && (
                <div className="mt-2 p-2 rounded-lg bg-black/60 border border-white/10 text-[11px] font-mono flex items-center gap-1.5 text-cyan-300">
                    <Terminal className="w-3 h-3 text-cyan-400 flex-shrink-0" />
                    <span className="truncate">{member.activeTool}</span>
                </div>
            )}

            {member.filesModified.length > 0 && (
                <div className="mt-2 text-[10px] text-emerald-400 font-mono">
                    📁 Touched {member.filesModified.length} files
                </div>
            )}
        </div>
    );
};
