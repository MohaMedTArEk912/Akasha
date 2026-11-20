import React from "react";
import { Sparkles, ListTodo, Zap } from "lucide-react";
import type { ExecutionMode } from "../../../types/agentSquad";

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
    label: "Full-stack app scaffold",
    prompt: "Synthesize full-stack application architecture according to Akasha structured blueprint.",
  },
  {
    label: "React screens & forms",
    prompt: "Generate responsive React UI components and state stores for pending views.",
  },
  {
    label: "Express REST routes",
    prompt: "Implement Express REST routes and MongoDB controllers for data models.",
  },
  {
    label: "Verify types & build",
    prompt: "Run TypeScript compiler verification and self-heal any syntax diagnostics.",
  },
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
  isRunning,
}) => {
  return (
    <div className="studio-surface p-5 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-[var(--ide-border)]">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#1B5BFF] dark:text-[#7AA3FF]" />
          <h3 className="text-sm font-bold text-[var(--ide-text)]">Run a build mission</h3>
        </div>
        <span className="text-xs font-medium text-[var(--ide-text-muted)] capitalize">
          {executionMode}
        </span>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-[var(--ide-text-secondary)] block">
          Instructions
        </label>
        <textarea
          value={customPrompt}
          onChange={(e) => onPromptChange(e.target.value)}
          placeholder="Describe what to generate, refactor, or hand off to your IDE agent..."
          className="w-full h-28 bg-[var(--ide-bg)] border border-[var(--ide-border)] focus:border-[#1B5BFF] rounded-xl p-3 text-xs text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)] focus:outline-none resize-none"
        />
      </div>

      {projectTasks.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--ide-text)] flex items-center gap-1.5 font-medium">
              <ListTodo className="w-3.5 h-3.5 text-[#1B5BFF] dark:text-[#7AA3FF]" />
              Attach board tasks ({selectedTaskIds.length} selected)
            </span>
            <button
              type="button"
              onClick={onToggleTaskPicker}
              className="text-[#1B5BFF] dark:text-[#7AA3FF] font-semibold cursor-pointer"
            >
              {showTaskPicker ? "Hide" : "Browse"}
            </button>
          </div>

          {showTaskPicker && (
            <div className="max-h-36 overflow-y-auto space-y-1 p-2.5 bg-[var(--ide-bg)] rounded-xl border border-[var(--ide-border)]">
              {projectTasks.map((t) => (
                <label
                  key={t.id}
                  className="flex items-center gap-2 text-xs p-1.5 rounded-lg hover:bg-[var(--ide-accent-subtle)] cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedTaskIds.includes(t.id)}
                    onChange={() => onToggleTask(t.id)}
                    className="accent-[#1B5BFF]"
                  />
                  <span
                    className={`truncate text-xs ${
                      t.status === "done"
                        ? "line-through text-[var(--ide-text-muted)]"
                        : "text-[var(--ide-text)]"
                    }`}
                  >
                    {t.title}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="space-y-1.5">
        <span className="text-xs font-semibold text-[var(--ide-text-secondary)] block">
          Quick presets
        </span>
        <div className="grid grid-cols-2 gap-2">
          {MISSION_PRESETS.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onDispatch(preset.prompt)}
              disabled={isDispatching || isRunning}
              className="p-2.5 rounded-xl bg-[var(--ide-bg)] hover:bg-[var(--ide-accent-subtle)] border border-[var(--ide-border)] text-left text-xs font-medium text-[var(--ide-text)] transition-colors cursor-pointer disabled:opacity-50"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => onDispatch()}
        disabled={isDispatching || isRunning}
        className="btn-primary w-full h-10 text-xs"
      >
        <Zap className="w-3.5 h-3.5" />
        {isDispatching || isRunning ? "Mission running..." : "Start mission"}
      </button>
    </div>
  );
};
