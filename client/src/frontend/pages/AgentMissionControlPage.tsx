import { useState, useEffect, useRef } from "react";
import { useProjectStore } from "../hooks/useProjectStore";
import { useToast } from "../context/ToastContext";
import {
  fetchProjectBlueprint,
  syncBlueprintToWorkspace,
  updateSquadConfig,
  dispatchSquadMission,
  fetchMissionStatus,
  subscribeMissionStream,
} from "../services/agentSquadService";
import { fetchSlicesWorkspace, type FeatureSliceItem } from "../services/akashaV2Service";
import type {
  SquadMember,
  ExecutionMode,
  DispatchStrategy,
  TelemetryLog,
  CompiledProjectBlueprint,
  ActiveSquadMission,
} from "../types/agentSquad";
import { FileCode, Eye, Radio, Cpu, Send, Copy, Layers } from "lucide-react";
import {
  TokenOptimizationBanner,
  BlueprintDrawer,
  SquadMemberList,
  MissionDispatcher,
  TelemetryTerminal,
  McpConfigModal,
  type ProjectTaskItem,
} from "../components/features/MissionControl";

export default function AgentMissionControlPage() {
  const { project } = useProjectStore();
  const toast = useToast();

  const [executionMode, setExecutionMode] = useState<ExecutionMode>("parallel");
  const [dispatchStrategy, setDispatchStrategy] = useState<DispatchStrategy>("generate");
  const [members, setMembers] = useState<SquadMember[]>([]);
  const [mission, setMission] = useState<ActiveSquadMission | null>(null);
  const [blueprint, setBlueprint] = useState<CompiledProjectBlueprint | null>(null);
  const [slices, setSlices] = useState<FeatureSliceItem[]>([]);
  const [selectedSliceId, setSelectedSliceId] = useState<string>("");
  const [logs, setLogs] = useState<TelemetryLog[]>([]);
  const [sseConnected, setSseConnected] = useState(false);

  const [customPrompt, setCustomPrompt] = useState("");
  const [isDispatching, setIsDispatching] = useState(false);
  const [isSyncingBlueprint, setIsSyncingBlueprint] = useState(false);
  const [showBlueprintDrawer, setShowBlueprintDrawer] = useState(false);
  const [showTaskPicker, setShowTaskPicker] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [showMcpModal, setShowMcpModal] = useState(false);

  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!project?.id) return;
    const projectId = project.id;

    Promise.all([
      fetchProjectBlueprint(projectId).catch(() => null),
      fetchMissionStatus(projectId).catch(() => null),
      fetchSlicesWorkspace(projectId).catch(() => null),
    ]).then(([bpData, statusData, sliceWs]) => {
      if (bpData) setBlueprint(bpData);
      if (sliceWs?.slices) setSlices(sliceWs.slices);
      if (statusData) {
        setExecutionMode(statusData.config.executionMode);
        if (statusData.config.dispatchStrategy) setDispatchStrategy(statusData.config.dispatchStrategy);
        setMembers(statusData.config.members);
        setMission(statusData.mission);
        setLogs(statusData.mission.logs || []);
      }
    });

    const unsubscribe = subscribeMissionStream(projectId, {
      onSnapshot: (snap) => {
        setSseConnected(true);
        if (snap.config?.members) setMembers(snap.config.members);
        if (snap.mission) {
          setMission(snap.mission);
          if (Array.isArray(snap.mission.logs)) setLogs(snap.mission.logs);
        }
      },
      onTelemetry: (entry) => {
        setSseConnected(true);
        setLogs((prev) => {
          if (prev.some((l) => l.id === entry.id)) return prev;
          return [entry, ...prev].slice(0, 150);
        });
      },
      onMission: (partial) => {
        setMission((prev) => (prev ? { ...prev, ...partial } : (partial as ActiveSquadMission)));
      },
      onError: () => setSseConnected(false),
    });

    return () => unsubscribe();
  }, [project?.id]);

  const handleStrategySwitch = async (next: DispatchStrategy) => {
    if (!project?.id) return;
    setDispatchStrategy(next);
    try {
      await updateSquadConfig(project.id, { dispatchStrategy: next });
      toast.success(
        next === "generate"
          ? "Switched to Full-Stack Generation"
          : "Switched to MCP IDE Handoff"
      );
    } catch {
      toast.error("Failed to update strategy");
    }
  };

  const handleDispatch = async (overridePrompt?: string) => {
    if (!project?.id) return;
    const promptToRun = overridePrompt || customPrompt;
    if (!promptToRun.trim()) {
      toast.warning("Enter an instruction or pick a preset first.");
      return;
    }

    setIsDispatching(true);
    try {
      const result = await dispatchSquadMission({
        projectId: project.id,
        prompt: promptToRun.trim(),
        executionMode,
        dispatchStrategy,
        sliceId: selectedSliceId || undefined,
        taskIds: selectedTaskIds,
      });
      setMission(result);
      setLogs(result.logs || []);
      setCustomPrompt("");
      setSelectedTaskIds([]);
      toast.success(
        dispatchStrategy === "handoff"
          ? "Feature Build Pack ready for your IDE agent"
          : "Full-stack generation started"
      );
    } catch (err: any) {
      toast.error(`Dispatch failed: ${err.message}`);
    } finally {
      setIsDispatching(false);
    }
  };

  const handleSyncBlueprint = async () => {
    if (!project?.id) return;
    setIsSyncingBlueprint(true);
    try {
      const res = await syncBlueprintToWorkspace(project.id);
      toast.success(`Synced blueprint to ${res.filePath}`);
    } catch (err: any) {
      toast.error(`Sync failed: ${err.message}`);
    } finally {
      setIsSyncingBlueprint(false);
    }
  };

  let projectTasks: ProjectTaskItem[] = [];
  if (project?.settings) {
    try {
      const s = typeof project.settings === "string" ? JSON.parse(project.settings) : project.settings;
      projectTasks = s.teamTasks || s.tasks || [];
    } catch {
      projectTasks = [];
    }
  }

  const toggleTaskSelection = (id: string) => {
    setSelectedTaskIds((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  };

  const progressPct = mission?.progress || 0;
  const isRunning = mission?.status === "running";

  return (
    <div className="h-full w-full overflow-y-auto bg-[var(--ide-bg)] text-[var(--ide-text)]">
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6 pb-20">
        {/* Control Strip */}
        <div className="studio-surface p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                  sseConnected
                    ? "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30"
                    : "bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${sseConnected ? "bg-emerald-500" : "bg-amber-500"}`} />
                {sseConnected ? "Live stream connected" : "Connecting stream..."}
              </span>
              <span className="text-xs text-[var(--ide-text-secondary)]">
                Status: <strong className="text-[var(--ide-text)]">{mission?.status || "idle"}</strong>
              </span>
            </div>
            {mission?.outputPath && (
              <p className="text-xs font-mono text-[var(--ide-text-muted)]">
                Output: {mission.outputPath}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Strategy Switcher */}
            <div className="flex items-center bg-[var(--ide-accent-subtle)] p-0.5 rounded-lg border border-[var(--ide-border)]">
              <button
                type="button"
                onClick={() => handleStrategySwitch("generate")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                  dispatchStrategy === "generate"
                    ? "bg-[var(--ide-bg-elevated)] text-[#1B5BFF] dark:text-[#7AA3FF] shadow-xs"
                    : "text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)]"
                }`}
              >
                <Cpu className="w-3.5 h-3.5" />
                Generate code
              </button>
              <button
                type="button"
                onClick={() => handleStrategySwitch("handoff")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                  dispatchStrategy === "handoff"
                    ? "bg-[var(--ide-bg-elevated)] text-emerald-700 dark:text-emerald-300 shadow-xs"
                    : "text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)]"
                }`}
              >
                <Send className="w-3.5 h-3.5" />
                IDE handoff (MCP)
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowMcpModal(true)}
              className="btn-ghost h-8 px-3 text-xs"
            >
              <Radio className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              Connect MCP
            </button>

            <button
              type="button"
              onClick={handleSyncBlueprint}
              disabled={isSyncingBlueprint}
              className="btn-ghost h-8 px-3 text-xs"
            >
              <FileCode className="w-3.5 h-3.5 text-[#1B5BFF] dark:text-[#7AA3FF]" />
              {isSyncingBlueprint ? "Syncing..." : "Sync blueprint"}
            </button>

            <button
              type="button"
              onClick={() => setShowBlueprintDrawer(!showBlueprintDrawer)}
              className="btn-ghost h-8 px-3 text-xs"
            >
              <Eye className="w-3.5 h-3.5" />
              {showBlueprintDrawer ? "Hide blueprint" : "Inspect blueprint"}
            </button>
          </div>
        </div>

        {blueprint && <TokenOptimizationBanner blueprint={blueprint} />}
        {blueprint && <BlueprintDrawer blueprint={blueprint} isOpen={showBlueprintDrawer} />}

        {/* Feature Slice Scope Picker */}
        {slices.length > 0 && (
          <div className="studio-surface p-3.5 flex flex-wrap items-center gap-2.5 text-xs">
            <span className="font-semibold text-[var(--ide-text)] inline-flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#1B5BFF] dark:text-[#7AA3FF]" />
              Target slice
            </span>
            <select
              value={selectedSliceId}
              onChange={(e) => setSelectedSliceId(e.target.value)}
              className="input-modern h-8 text-xs"
            >
              <option value="">Entire project blueprint</option>
              {slices.map((s) => (
                <option key={s.id} value={s.id}>
                  [{s.lane.toUpperCase()}] {s.title} ({s.status})
                </option>
              ))}
            </select>
            {mission?.status === "awaiting_agent" && mission.buildPackMarkdown && (
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(mission.buildPackMarkdown || "");
                  toast.success("Copied queued Feature Build Pack");
                }}
                className="ml-auto btn-primary h-8 px-3 text-xs"
              >
                <Copy className="w-3.5 h-3.5" />
                Copy queued build pack
              </button>
            )}
          </div>
        )}

        <SquadMemberList members={members} executionMode={executionMode} />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5">
            <MissionDispatcher
              customPrompt={customPrompt}
              onPromptChange={setCustomPrompt}
              executionMode={executionMode}
              projectTasks={projectTasks}
              selectedTaskIds={selectedTaskIds}
              onToggleTask={toggleTaskSelection}
              showTaskPicker={showTaskPicker}
              onToggleTaskPicker={() => setShowTaskPicker(!showTaskPicker)}
              onDispatch={handleDispatch}
              isDispatching={isDispatching}
              isRunning={isRunning}
            />
          </div>

          <div className="lg:col-span-7">
            <TelemetryTerminal
              logs={logs}
              progress={progressPct}
              logContainerRef={logContainerRef}
            />
          </div>
        </div>

        <McpConfigModal
          isOpen={showMcpModal}
          onClose={() => setShowMcpModal(false)}
          onCopySuccess={(msg) => toast.success(msg)}
        />
      </div>
    </div>
  );
}
