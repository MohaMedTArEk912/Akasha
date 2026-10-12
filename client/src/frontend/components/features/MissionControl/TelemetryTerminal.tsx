import React from 'react';
import { Terminal, Activity } from 'lucide-react';
import type { TelemetryLog } from '../../../types/agentSquad';

interface TelemetryTerminalProps {
    logs: TelemetryLog[];
    progress: number;
    logContainerRef: React.RefObject<HTMLDivElement>;
}

export const TelemetryTerminal: React.FC<TelemetryTerminalProps> = ({
    logs,
    progress,
    logContainerRef
}) => {
    return (
        <div className="bg-[#090d18] rounded-2xl border border-white/10 p-5 flex flex-col h-[560px] shadow-2xl">
            {/* Terminal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                        Live Action Stream & Reasoning Console
                    </span>
                </div>

                <div className="flex items-center gap-3">
                    <span className="text-[11px] font-mono text-slate-400">
                        Progress: <strong className="text-cyan-400">{progress}%</strong>
                    </span>
                    <div className="w-24 h-2 bg-slate-950 rounded-full overflow-hidden border border-white/10">
                        <div
                            className="h-full bg-gradient-to-r from-indigo-500 via-cyan-400 to-emerald-400 transition-all duration-500"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Terminal Log Output */}
            <div
                ref={logContainerRef}
                className="flex-1 overflow-y-auto space-y-3 py-3 pr-2 font-mono text-xs custom-scrollbar"
            >
                {logs.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-3 text-center px-4">
                        <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400">
                            <Activity className="w-6 h-6 animate-pulse" />
                        </div>
                        <div>
                            <p className="text-slate-300 font-semibold text-xs">Squad Telemetry Stream Idle</p>
                            <p className="text-slate-500 text-[11px] mt-1 max-w-sm">
                                Dispatch a mission from the left panel or trigger external agents via MCP to view live reasoning thoughts and file actions.
                            </p>
                        </div>
                    </div>
                ) : (
                    logs.map((log) => {
                        const isSuccess = log.type === 'success';
                        const isError = log.type === 'error';
                        const isBuild = log.type === 'build_check';

                        return (
                            <div
                                key={log.id}
                                className={`p-3.5 rounded-xl border transition-all ${
                                    isError
                                        ? 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                                        : isSuccess
                                        ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                                        : isBuild
                                        ? 'bg-indigo-950/30 border-indigo-500/40 text-indigo-200'
                                        : 'bg-black/60 border-white/10 text-slate-300'
                                }`}
                            >
                                <div className="flex items-center justify-between text-[11px] mb-1.5 opacity-90">
                                    <div className="flex items-center gap-2">
                                        <span className="text-cyan-400 font-bold">[{log.agentName}]</span>
                                        <span className="text-slate-400">{log.stepName}</span>
                                    </div>
                                    <span className="text-slate-500 text-[10px]">{log.timestamp}</span>
                                </div>

                                <div className="text-[12px] font-sans text-slate-200 leading-relaxed">
                                    {log.thought}
                                </div>

                                {log.activeTool && (
                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                        <span className="px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-[10px] font-mono">
                                            🔧 Tool: {log.activeTool}
                                        </span>
                                        {log.toolArgsSnippet && (
                                            <span className="text-[10px] text-slate-400 font-mono truncate max-w-xs">
                                                {log.toolArgsSnippet}
                                            </span>
                                        )}
                                    </div>
                                )}

                                {log.fileCreatedOrModified && (
                                    <div className="mt-1.5 text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                                        📄 File: {log.fileCreatedOrModified}
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
