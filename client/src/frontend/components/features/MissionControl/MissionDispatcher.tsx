import React from 'react';
import { Sparkles, ListTodo, Zap } from 'lucide-react';
import type { ExecutionMode } from '../../../types/agentSquad';

export interface ProjectTaskItem {
    id: string;
    title: string;
    priority?: string;
    status?: string;
}

interface MissionDispatcherProps {
    customPrompt: string;
    onPromptChange: (value: string) => void;
    executionMode: ExecutionMode;
    projectTasks: ProjectTaskItem[];
    selectedTaskIds: string[];
    onToggleTask: (id: string) => void;
    showTaskPicker: boolean;
    onToggleTaskPicker: () => void;
    onDispatch: (overridePrompt?: string) => void;
    isDispatching: boolean;
    isRunning: boolean;
}

const MISSION_PRESETS = [
    {
        label: '🚀 Full App Synthesis',
        prompt: 'Synthesize full-stack application architecture according to Akasha structured blueprint.'
    },
    {
        label: '🧩 React UI Components',
        prompt: 'Generate responsive React UI components and state stores for pending views.'
    },
    {
        label: '🔌 Express REST Routes',
        prompt: 'Implement Express REST routes and MongoDB Prisma controllers for data models.'
    },
    {
        label: '🛡 Self-Healing QA',
        prompt: 'Run TypeScript compiler verification and self-heal any syntax diagnostics.'
    }
];

export const MissionDispatcher: React.FC<MissionDispatcherProps> = ({
    customPrompt,
    onPromptChange,
    executionMode,
    projectTasks,
    selectedTaskIds,
    onToggleTask,
    showTaskPicker,
    onToggleTaskPicker,
    onDispatch,
    isDispatching,
    isRunning
}) => {
    return (
        <div className="bg-[#0d121f] p-6 rounded-2xl border border-white/10 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-sm font-bold text-slate-200">
                        Mission Dispatcher
                    </h3>
                </div>
                <span className="text-[10px] font-mono font-bold tracking-wider text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20 uppercase">
                    {executionMode} SQUAD
                </span>
            </div>

            {/* Text Prompt */}
            <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-400">
                    Mission Instructions:
                </label>
                <textarea
                    value={customPrompt}
                    onChange={(e) => onPromptChange(e.target.value)}
                    placeholder="Instruct the Antigravity squad to build a feature, refactor code, generate endpoints, or execute diagnostic self-healing..."
                    className="w-full h-28 bg-[#05070e] border border-white/15 focus:border-cyan-400 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 font-sans resize-none transition-all"
                />
            </div>

            {/* Kanban Task Assignment */}
            {projectTasks.length > 0 && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-300 flex items-center gap-1.5 font-medium">
                            <ListTodo className="w-3.5 h-3.5 text-indigo-400" />
                            Assign Project Tasks ({selectedTaskIds.length} selected):
                        </span>
                        <button
                            type="button"
                            onClick={onToggleTaskPicker}
                            className="text-cyan-400 hover:text-cyan-300 font-semibold text-[11px] cursor-pointer"
                        >
                            {showTaskPicker ? 'Hide Tasks' : 'Browse Tasks'}
                        </button>
                    </div>

                    {showTaskPicker && (
                        <div className="max-h-36 overflow-y-auto space-y-1.5 p-2.5 bg-[#05070e] rounded-xl border border-white/10 pr-1 custom-scrollbar">
                            {projectTasks.map((t) => (
                                <label
                                    key={t.id}
                                    className="flex items-center gap-2 text-xs p-1.5 rounded-lg hover:bg-white/5 cursor-pointer"
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedTaskIds.includes(t.id)}
                                        onChange={() => onToggleTask(t.id)}
                                        className="rounded border-white/20 text-cyan-500 focus:ring-0"
                                    />
                                    <span className={`truncate text-xs ${t.status === 'done' ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                                        <span className="font-mono text-[10px] text-cyan-400 mr-1">
                                            [{t.priority?.toUpperCase() || 'MED'}]
                                        </span>
                                        {t.title}
                                    </span>
                                </label>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Quick Presets */}
            <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Quick Mission Presets:
                </span>
                <div className="grid grid-cols-2 gap-2">
                    {MISSION_PRESETS.map((preset, idx) => (
                        <button
                            key={idx}
                            type="button"
                            onClick={() => onDispatch(preset.prompt)}
                            disabled={isDispatching || isRunning}
                            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-left text-[11px] font-medium text-slate-200 transition-all hover:scale-[1.01] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {preset.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Dispatch Button */}
            <button
                type="button"
                onClick={() => onDispatch()}
                disabled={isDispatching || isRunning}
                className={`w-full py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-xl cursor-pointer ${
                    isRunning
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5'
                        : 'bg-gradient-to-r from-indigo-500 via-cyan-500 to-emerald-500 text-white hover:brightness-110 shadow-cyan-500/25 active:scale-[0.99]'
                }`}
            >
                <Zap className="w-4 h-4 fill-white" />
                {isDispatching || isRunning ? 'Squad Mission in Progress...' : 'Dispatch Mission to Antigravity'}
            </button>
        </div>
    );
};
