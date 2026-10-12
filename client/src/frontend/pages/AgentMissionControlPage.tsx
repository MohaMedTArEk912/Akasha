import { useState, useEffect, useRef } from 'react';
import { useProjectStore } from '../hooks/useProjectStore';
import { useToast } from '../context/ToastContext';
import {
    fetchProjectBlueprint,
    syncBlueprintToWorkspace,
    updateSquadConfig,
    dispatchSquadMission,
    fetchMissionStatus
} from '../services/agentSquadService';
import type {
    SquadMember,
    ExecutionMode,
    TelemetryLog,
    CompiledProjectBlueprint,
    ActiveSquadMission
} from '../types/agentSquad';
import {
    GitFork,
    ArrowRight,
    FileCode,
    Eye,
    Radio
} from 'lucide-react';
import {
    TokenOptimizationBanner,
    BlueprintDrawer,
    SquadMemberList,
    MissionDispatcher,
    TelemetryTerminal,
    McpConfigModal,
    type ProjectTaskItem
} from '../components/features/MissionControl';

export default function AgentMissionControlPage() {
    const { project } = useProjectStore();
    const toast = useToast();

    // Mission and squad state
    const [executionMode, setExecutionMode] = useState<ExecutionMode>('parallel');
    const [members, setMembers] = useState<SquadMember[]>([]);
    const [mission, setMission] = useState<ActiveSquadMission | null>(null);
    const [blueprint, setBlueprint] = useState<CompiledProjectBlueprint | null>(null);
    const [logs, setLogs] = useState<TelemetryLog[]>([]);

    // Form and interaction states
    const [customPrompt, setCustomPrompt] = useState('');
    const [isDispatching, setIsDispatching] = useState(false);
    const [isSyncingBlueprint, setIsSyncingBlueprint] = useState(false);
    const [showBlueprintDrawer, setShowBlueprintDrawer] = useState(false);
    const [showTaskPicker, setShowTaskPicker] = useState(false);
    const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
    const [showMcpModal, setShowMcpModal] = useState(false);

    // Refs
    const pollingRef = useRef<number | null>(null);
    const logContainerRef = useRef<HTMLDivElement>(null);

    // Initial load
    useEffect(() => {
        if (!project?.id) return;

        loadSquadData(project.id);

        return () => {
            stopPolling();
        };
    }, [project?.id]);

    // Auto-scroll inside terminal log container ONLY (preserves outer page scroll)
    useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [logs.length]);

    const stopPolling = () => {
        if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
        }
    };

    const startPolling = (projectId: string) => {
        stopPolling();
        pollingRef.current = window.setInterval(async () => {
            try {
                const statusData = await fetchMissionStatus(projectId);
                if (statusData) {
                    setMembers(statusData.config.members);
                    setMission(statusData.mission);
                    setLogs(statusData.mission.logs || []);
                    if (statusData.mission?.status !== 'running') {
                        stopPolling();
                    }
                }
            } catch {
                // Ignore transient network errors during polling
            }
        }, 1500);
    };

    const loadSquadData = async (projectId: string) => {
        try {
            const [bpData, statusData] = await Promise.all([
                fetchProjectBlueprint(projectId).catch(() => null),
                fetchMissionStatus(projectId).catch(() => null)
            ]);

            if (bpData) setBlueprint(bpData);
            if (statusData) {
                setExecutionMode(statusData.config.executionMode);
                setMembers(statusData.config.members);
                setMission(statusData.mission);
                if (statusData.mission.logs) {
                    setLogs(statusData.mission.logs);
                }
                if (statusData.mission?.status === 'running') {
                    startPolling(projectId);
                }
            }
        } catch (err: any) {
            console.error('Error loading squad telemetry:', err);
        }
    };

    const handleModeSwitch = async (newMode: ExecutionMode) => {
        if (!project?.id) return;
        setExecutionMode(newMode);
        try {
            await updateSquadConfig(project.id, { executionMode: newMode });
            toast.success(`Switched to ${newMode === 'parallel' ? 'Parallel Squad' : 'Series Pipeline'} execution`);
        } catch {
            toast.error('Failed to update squad topology');
        }
    };

    const handleDispatch = async (overridePrompt?: string) => {
        if (!project?.id) return;
        const promptToRun = overridePrompt || customPrompt;
        if (!promptToRun.trim()) {
            toast.warning('Please enter a mission instruction or select a preset.');
            return;
        }

        setIsDispatching(true);
        try {
            const result = await dispatchSquadMission({
                projectId: project.id,
                prompt: promptToRun.trim(),
                executionMode,
                taskIds: selectedTaskIds
            });
            setMission(result);
            setLogs(result.logs || []);
            setCustomPrompt('');
            setSelectedTaskIds([]);
            startPolling(project.id);
            toast.success(`Antigravity squad dispatched in ${executionMode.toUpperCase()} mode!`);
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
            toast.success(`Blueprint synced to ${res.filePath} (${res.tokenMetrics.savingsPercent}% tokens saved)`);
        } catch (err: any) {
            toast.error(`Sync failed: ${err.message}`);
        } finally {
            setIsSyncingBlueprint(false);
        }
    };

    // Extract pending tasks from project settings
    let projectTasks: ProjectTaskItem[] = [];
    if (project?.settings) {
        try {
            const s = typeof project.settings === 'string' ? JSON.parse(project.settings) : project.settings;
            projectTasks = s.teamTasks || s.tasks || [];
        } catch {
            projectTasks = [];
        }
    }

    const toggleTaskSelection = (id: string) => {
        setSelectedTaskIds((prev) =>
            prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
        );
    };

    const progressPct = mission?.progress || 0;
    const isRunning = mission?.status === 'running';

    return (
        <div className="h-full w-full overflow-y-auto custom-scrollbar bg-[#080b14]/90 text-slate-100 select-none relative backdrop-blur-2xl">
            <div className="max-w-7xl mx-auto p-6 md:p-8 space-y-6 pb-24 relative z-10">

                {/* ━━ CONTROL ROOM TOP HEADER ━━ */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/10">
                    <div>
                        <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                                AKASHA MISSION CONTROL
                            </span>
                            <span className="text-white/20">•</span>
                            <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                                Autonomous Brain Active
                            </span>
                        </div>
                        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 via-cyan-300 to-emerald-400 bg-clip-text text-transparent">
                            Antigravity Agent Squad Cockpit
                        </h1>
                        <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                            Project: <strong className="text-slate-200">{project?.name || 'Active Project'}</strong>
                            <span className="text-white/20">|</span>
                            <span>Token Optimization: <strong className="text-emerald-400">Structure-First Injected</strong></span>
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {/* Topology Switcher */}
                        <div className="flex items-center bg-[#0d121f] p-1 rounded-xl border border-white/10 shadow-lg">
                            <button
                                onClick={() => handleModeSwitch('parallel')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                    executionMode === 'parallel'
                                        ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-md'
                                        : 'text-slate-400 hover:text-white'
                                }`}
                                title="Run Frontend and Backend simultaneously with QA Verification"
                            >
                                <GitFork className="w-3.5 h-3.5" />
                                Parallel Squad
                            </button>
                            <button
                                onClick={() => handleModeSwitch('series')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                    executionMode === 'series'
                                        ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-md'
                                        : 'text-slate-400 hover:text-white'
                                }`}
                                title="Run Architect -> Backend -> Frontend -> QA in a sequential pipeline"
                            >
                                <ArrowRight className="w-3.5 h-3.5" />
                                Series Pipeline
                            </button>
                        </div>

                        {/* Connect Agent via MCP Button */}
                        <button
                            onClick={() => setShowMcpModal(true)}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500/20 via-cyan-500/20 to-indigo-500/20 hover:from-emerald-500/30 hover:to-cyan-500/30 border border-emerald-500/40 text-emerald-300 transition-all hover:scale-[1.02] shadow-sm cursor-pointer"
                        >
                            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                            🔌 Connect Agent (MCP)
                        </button>

                        {/* Sync Blueprint Action */}
                        <button
                            onClick={handleSyncBlueprint}
                            disabled={isSyncingBlueprint}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 transition-all hover:scale-[1.02] cursor-pointer disabled:opacity-50"
                        >
                            <FileCode className="w-3.5 h-3.5 text-cyan-400" />
                            {isSyncingBlueprint ? 'Syncing...' : 'Sync Blueprint (.json)'}
                        </button>

                        {/* Inspect Blueprint Toggle */}
                        <button
                            onClick={() => setShowBlueprintDrawer(!showBlueprintDrawer)}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 transition-all cursor-pointer"
                        >
                            <Eye className="w-3.5 h-3.5 text-indigo-400" />
                            {showBlueprintDrawer ? 'Hide Blueprint' : 'Inspect Blueprint'}
                        </button>
                    </div>
                </div>

                {/* ━━ TOKEN OPTIMIZATION BANNER ━━ */}
                {blueprint && <TokenOptimizationBanner blueprint={blueprint} />}

                {/* ━━ BLUEPRINT DRAWER (COLLAPSIBLE) ━━ */}
                {blueprint && <BlueprintDrawer blueprint={blueprint} isOpen={showBlueprintDrawer} />}

                {/* ━━ VISUAL SQUAD FLOWCHART & MEMBERS ━━ */}
                <SquadMemberList members={members} executionMode={executionMode} />

                {/* ━━ MISSION DISPATCHER & TELEMETRY GRID ━━ */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Left Column: Mission Dispatcher (5 cols) */}
                    <div className="lg:col-span-5 space-y-4">
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

                    {/* Right Column: Live Action Stream & Reasoning Console (7 cols) */}
                    <div className="lg:col-span-7 space-y-4">
                        <TelemetryTerminal
                            logs={logs}
                            progress={progressPct}
                            logContainerRef={logContainerRef}
                        />
                    </div>
                </div>

                {/* ━━ CONNECT AGENT MCP MODAL ━━ */}
                <McpConfigModal
                    isOpen={showMcpModal}
                    onClose={() => setShowMcpModal(false)}
                    onCopySuccess={(msg) => toast.success(msg)}
                />
            </div>
        </div>
    );
}
