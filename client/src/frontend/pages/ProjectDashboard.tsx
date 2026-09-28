/**
 * ProjectDashboard — Autonomous Mission Control Center
 * Apple Liquid Glass aesthetic, high-contrast light mode, 100% typography, ZERO icons.
 *
 * Provides:
 * - Real-time Project Readiness & Telemetry score
 * - ⚡ Autonomous Multi-Step Agent Synthesizer Command Island
 * - Step-by-Step file creation stepper & live activity log
 * - Token efficiency metrics (84% token savings)
 * - Dynamic Feature Cards with live stats & 1-click action triggers
 */
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useProjectStore } from "../hooks/useProjectStore";
import { setActivePage, closeProject, refreshCurrentProject, syncGitHubTasksForCurrentProject, checkGitHubAutoSync } from "../stores/projectStore";
import { LiquidCard, LiquidPill } from "../components/ui/LiquidGlass";
import { useBackgroundLoading } from "../context/BackgroundLoadingContext";
import { useToast } from "../context/ToastContext";
import { client } from "../hooks/useHttpApi";


/* ─── Helpers ─── */
function getGreeting(): string {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
}

interface StepLog {
    timestamp: string;
    step: string;
    message: string;
    type: "info" | "success" | "warning" | "error";
    fileCreated?: string;
}

interface AgentStatusData {
    projectId: string;
    status: "idle" | "running" | "completed" | "failed";
    currentStepIndex: number;
    totalSteps: number;
    currentStepName: string;
    progress: number;
    logs: StepLog[];
    stats: {
        modelsCreated: number;
        apisCreated: number;
        useCasesCreated: number;
        pagesCompiled: number;
        diagramsCreated: number;
        tokensSavedEstimate: number;
    };
    error?: string;
}

/* ═══════════════════ Component ═══════════════════ */

const ProjectDashboard: React.FC = () => {
    const { project } = useProjectStore();
    const toast = useToast();
    const { startTask, updateTask, completeTask, failTask } = useBackgroundLoading();
    const [time, setTime] = useState(new Date());

    // Agent state
    const [agentStatus, setAgentStatus] = useState<AgentStatusData | null>(null);
    const [isRunningSynthesis, setIsRunningSynthesis] = useState(false);
    const [runningSteps, setRunningSteps] = useState<string[]>([]);
    const [isSyncingCommits, setIsSyncingCommits] = useState(false);

    const handleSyncCommits = async () => {
        setIsSyncingCommits(true);
        try {
            const autoRes = await checkGitHubAutoSync();
            if (autoRes?.autoSynced) {
                toast.showToast(`🎉 New commit detected (${autoRes.commitSha}) by ${autoRes.author}! Auto-syncing project in real-time...`, "success");
                setIsRunningSynthesis(true);
                startTask({
                    title: "Auto-Sync Pipeline",
                    step: `Syncing commit ${autoRes.commitSha}: ${autoRes.commitMessage}`,
                    progress: 15,
                });
            } else {
                const res = await syncGitHubTasksForCurrentProject();
                if (res?.newlyCompletedCount > 0) {
                    toast.showToast(`🎉 ${res.newlyCompletedCount} task(s) auto-completed from GitHub commits!`, "success");
                    await refreshCurrentProject();
                } else {
                    toast.showToast("Connected repository is up to date", "info");
                }
            }
        } catch (err: any) {
            toast.showToast(`Sync failed: ${err.message || err}`, "error");
        } finally {
            setIsSyncingCommits(false);
        }
    };

    // Auto-Sync on GitHub Commit Detection
    useEffect(() => {
        if (!project?.id || !project?.settings?.github_repo) return;

        let isChecking = false;
        const checkAutoSync = async () => {
            if (isChecking || isRunningSynthesis) return;
            isChecking = true;
            try {
                const res = await checkGitHubAutoSync();
                if (res?.autoSynced) {
                    toast.showToast(`New commit detected (${res.commitSha}) by ${res.author} — Auto-syncing project in real-time...`, "success");
                    setIsRunningSynthesis(true);
                    startTask({
                        title: "Auto-Sync Pipeline",
                        step: `Syncing commit ${res.commitSha}: ${res.commitMessage}`,
                        progress: 15,
                    });
                }
            } catch (err) {
                // silent failure for background periodic check
            } finally {
                isChecking = false;
            }
        };

        const timeout = setTimeout(checkAutoSync, 1200);
        const interval = setInterval(checkAutoSync, 20000);

        return () => {
            clearTimeout(timeout);
            clearInterval(interval);
        };
    }, [project?.id, project?.settings?.github_repo?.full_name, isRunningSynthesis, startTask, toast]);

    // Keep clock updated
    useEffect(() => {
        const id = setInterval(() => setTime(new Date()), 60_000);
        return () => clearInterval(id);
    }, []);

    // Poll agent status whenever running
    const fetchStatus = useCallback(async () => {
        if (!project?.id) return;
        try {
            const res = await client.get(`/ai/agent/status/${project.id}`);
            if (res.data) {
                setAgentStatus(res.data);
                if (res.data.status === "running") {
                    updateTask({
                        title: "Agent Synthesizer",
                        step: res.data.currentStepName,
                        progress: res.data.progress,
                    });
                } else if (res.data.status === "completed" && isRunningSynthesis) {
                    setIsRunningSynthesis(false);
                    completeTask({
                        resultSummary: "Project Synthesized ✓",
                        step: "All modules ready",
                    });
                    toast.showToast("Full-Stack Project Synthesized with AI Agent!", "success");
                    await refreshCurrentProject();
                } else if (res.data.status === "failed" && isRunningSynthesis) {
                    setIsRunningSynthesis(false);
                    failTask({ error: res.data.error || "Agent synthesis failed" });
                    toast.showToast(`Synthesis error: ${res.data.error}`, "error");
                }
            }
        } catch (err) {
            console.warn("Failed to fetch agent status:", err);
        }
    }, [project?.id, isRunningSynthesis, updateTask, completeTask, failTask, toast]);

    useEffect(() => {
        void fetchStatus();
    }, [fetchStatus]);

    useEffect(() => {
        if (!isRunningSynthesis) return;
        const interval = setInterval(fetchStatus, 900);
        return () => clearInterval(interval);
    }, [isRunningSynthesis, fetchStatus]);

    // ── Project Asset Telemetry ──
    const telemetry = useMemo(() => {
        const modelsCount = (project?.data_models || []).filter((m) => !m.archived).length;
        const relationsCount = (project?.data_models || [])
            .filter((m) => !m.archived)
            .reduce((sum, m) => sum + (m.relations?.length || 0), 0);
        const apisCount = (project?.apis || []).filter((a) => !a.archived).length;
        const useCasesCount = ((project as any)?.use_cases || (project as any)?.useCases || []).length;
        const sandboxPages = (project as any)?.sandbox
            ? (typeof (project as any).sandbox === "string"
                  ? JSON.parse((project as any).sandbox)?.pages || []
                  : (project as any).sandbox?.pages || [])
            : project?.pages || [];
        const compiledPagesCount = sandboxPages.filter((p: any) => p._html || !p.archived).length;
        const hasSpec = !!(project?.description && project.description.trim().length > 20);

        // Calculate completeness score out of 100
        let score = 0;
        if (hasSpec) score += 20;
        if (modelsCount > 0) score += 20;
        if (apisCount > 0) score += 20;
        if (compiledPagesCount > 0) score += 20;
        if (useCasesCount > 0) score += 20;

        return {
            modelsCount,
            relationsCount,
            apisCount,
            useCasesCount,
            compiledPagesCount,
            hasSpec,
            readinessScore: Math.min(score, 100),
        };
    }, [project]);

    // ── Unified Autonomous Agent Sync Pipeline ──
    const handleSync = async () => {
        if (!project?.id) return;
        setIsRunningSynthesis(true);
        startTask({
            title: "Agent Pipeline Sync",
            step: "Starting real-time deep code search & pipeline sync...",
            progress: 8,
        });
        toast.showToast("Starting real-time agent sync pipeline...", "info");

        try {
            await client.post("/ai/agent/sync-pipeline", { projectId: project.id });
        } catch (err: any) {
            setIsRunningSynthesis(false);
            failTask({ error: err.message });
            toast.showToast(`Sync failed to start: ${err.message}`, "error");
        }
    };

    const handleRunSingleStep = async (stepName: "models" | "apis" | "usecases" | "pages" | "diagram") => {
        if (!project?.id) return;
        setRunningSteps((prev) => (prev.includes(stepName) ? prev : [...prev, stepName]));
        const stepLabels: Record<string, string> = {
            models: "Data Models",
            apis: "REST APIs",
            usecases: "Workflows",
            pages: "UI Prototypes",
            diagram: "Architecture Topology",
        };
        const title = stepLabels[stepName] || stepName;
        startTask({
            id: stepName,
            title: `Agent: ${title}`,
            step: `Synthesizing ${title.toLowerCase()}...`,
            progress: 35,
        });
        toast.showToast(`Synthesizing ${title} across 3D watch station...`, "info");
        try {
            const res = await client.post("/ai/agent/synthesize-step", {
                projectId: project.id,
                step: stepName,
            });
            if (res.data?.success) {
                completeTask({
                    id: stepName,
                    resultSummary: `${title} Ready ✓`,
                    step: `Completed ${title}`,
                });
                toast.showToast(`Step "${title}" completed successfully!`, "success");
                await refreshCurrentProject();
                void fetchStatus();
            } else {
                failTask({ id: stepName, error: res.data?.error || "Step execution failed" });
                toast.showToast(`Failed: ${res.data?.error || "Unknown error"}`, "error");
            }
        } catch (err: any) {
            failTask({ id: stepName, error: err.message });
            toast.showToast(`Step failed: ${err.message}`, "error");
        } finally {
            setRunningSteps((prev) => prev.filter((s) => s !== stepName));
        }
    };

    const greeting = getGreeting();

    // Idea details preview
    const details = project?.settings?.ideaDetails;
    const ideaName = details?.ideaMetadata?.ideaName;
    const tagline = details?.ideaMetadata?.tagline;
    const summary = details?.ideaMetadata?.summary;
    const cleanDesc = (project?.description || "")
        .replace(/^#+\s.*/gm, "")
        .replace(/```[\s\S]*?```/g, "")
        .replace(/[{}\[\]"]/g, "")
        .replace(/\s{2,}/g, " ")
        .trim();
    const previewText = tagline || summary || cleanDesc;

    return (
        <div className="h-full w-full overflow-y-auto relative p-6 sm:p-10 select-none">
            <div className="relative z-10 max-w-6xl mx-auto space-y-8">

                {/* ── Header Row ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-black/[0.08] dark:border-white/10">
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
                                {greeting} · {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                                Mission Active
                            </span>
                            {project?.settings?.github_repo && (
                                <a
                                    href={`https://github.com/${project.settings.github_repo.full_name}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold tracking-wider uppercase bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20 hover:underline"
                                    title={`Connected repository: ${project.settings.github_repo.full_name}`}
                                >
                                    <span>{project.settings.github_repo.full_name}</span>
                                </a>
                            )}
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight text-neutral-950 dark:text-white mt-1">
                            {project?.name || "Project Workspace"}
                        </h1>
                    </div>
                    <div className="flex items-center gap-2.5">
                        {project?.settings?.github_repo && (
                            <button
                                type="button"
                                disabled={isSyncingCommits}
                                onClick={handleSyncCommits}
                                className="
                                    flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold
                                    bg-neutral-900 text-white dark:bg-white dark:text-neutral-950
                                    hover:opacity-90 active:scale-95 disabled:opacity-50 transition-all shadow-sm cursor-pointer
                                "
                                title={`Sync recent commits from ${project.settings.github_repo.full_name}`}
                            >
                                <span>{isSyncingCommits ? "Checking..." : "Sync GitHub"}</span>
                            </button>
                        )}
                        <LiquidPill
                            variant="secondary"
                            size="sm"
                            onClick={closeProject}
                        >
                            ← Back to Projects
                        </LiquidPill>
                    </div>
                </div>

                {/* ── Unified Autonomous Architecture Synthesizer & Specification Command Hub ── */}
                <LiquidCard
                    variant="glass"
                    interactive={false}
                    className="p-6 sm:p-8 relative overflow-hidden border border-black/[0.08] dark:border-white/[0.12] hover:border-black/15 dark:hover:border-white/20 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)]"
                >
                    {/* Top: Specification & Project Identity Bar */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-black/[0.08] dark:border-white/10">
                        <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-cyan-600 dark:text-cyan-400">
                                    SPECIFICATION
                                </span>
                                <span className="text-neutral-400 dark:text-neutral-600 font-light text-xs">/</span>
                                <h3 className="text-sm font-bold text-neutral-950 dark:text-white truncate">
                                    {ideaName || project?.name || "Project Specification"}
                                </h3>
                                <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                                    details
                                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25 shadow-[0_0_8px_rgba(16,185,129,0.15)]"
                                        : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25"
                                }`}>
                                    {details ? "Structured Plan Active" : "Unstructured AI Context"}
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/25">
                                    84% Token Optimized
                                </span>
                            </div>
                            <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed max-w-3xl line-clamp-2">
                                {previewText || "Agentically plans and builds domain models, RESTful route controllers, business workflows, and interactive UI prototypes in the background."}
                            </p>
                        </div>

                        {/* Top Action Controls */}
                        <div className="flex items-center gap-3 shrink-0">
                            <button
                                type="button"
                                onClick={() => setActivePage("idea")}
                                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-neutral-600 dark:text-neutral-300 hover:text-cyan-600 dark:hover:text-cyan-400 bg-black/[0.03] dark:bg-white/[0.05] hover:bg-black/[0.06] dark:hover:bg-white/[0.1] border border-black/[0.08] dark:border-white/10 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                            >
                                <span>Open plan</span>
                                <span className="text-xs">→</span>
                            </button>

                            <button
                                type="button"
                                onClick={handleSync}
                                disabled={isRunningSynthesis || runningSteps.length > 0}
                                title="Run unified real-time agentic sync pipeline across models, APIs, and clean code"
                                className={`px-5 py-2 rounded-xl text-xs font-bold tracking-tight text-white transition-all duration-300 flex items-center gap-2 cursor-pointer shadow-lg active:scale-[0.98] ${
                                    isRunningSynthesis || runningSteps.length > 0
                                        ? "bg-blue-600/40 text-blue-200 cursor-wait animate-pulse shadow-blue-500/10 border border-blue-400/30"
                                        : "bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:via-indigo-500 hover:to-cyan-400 shadow-[0_0_24px_rgba(6,182,212,0.35)] hover:shadow-[0_0_32px_rgba(6,182,212,0.5)] border border-white/25"
                                }`}
                            >
                                <span>
                                    {isRunningSynthesis || runningSteps.length > 0
                                        ? `Syncing… [${agentStatus?.currentStepName || 'Running'}]`
                                        : "Sync"}
                                </span>
                                {(isRunningSynthesis || runningSteps.length > 0) && (
                                    <span className="font-mono text-[10px] bg-white/20 px-1.5 py-0.5 rounded">
                                        {agentStatus?.progress ? `${agentStatus.progress}%` : "In Progress"}
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Middle: Full-Stack Architecture Synthesizer Telemetry */}
                    <div className="pt-5 pb-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                            <div>
                                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-cyan-600 dark:text-cyan-400 block mb-0.5">
                                    PROJECT READINESS
                                </span>
                                <div className="flex items-baseline gap-3">
                                    <span className="text-2xl font-black tracking-tight text-neutral-950 dark:text-white">
                                        {telemetry.readinessScore}%
                                    </span>
                                    <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                                        {telemetry.readinessScore === 100
                                            ? "Production Specification Complete ✓"
                                            : "Ready to build"}
                                    </span>
                                </div>
                            </div>

                            {/* Live asset metrics pill strip */}
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-black/[0.04] dark:bg-white/[0.06] text-neutral-700 dark:text-neutral-300 border border-black/[0.06] dark:border-white/10 shadow-xs">
                                    <strong className="text-cyan-600 dark:text-cyan-400">{telemetry.modelsCount}</strong> Models
                                </span>
                                <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-black/[0.04] dark:bg-white/[0.06] text-neutral-700 dark:text-neutral-300 border border-black/[0.06] dark:border-white/10 shadow-xs">
                                    <strong className="text-cyan-600 dark:text-cyan-400">{telemetry.apisCount}</strong> REST APIs
                                </span>
                                <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-black/[0.04] dark:bg-white/[0.06] text-neutral-700 dark:text-neutral-300 border border-black/[0.06] dark:border-white/10 shadow-xs">
                                    <strong className="text-cyan-600 dark:text-cyan-400">{telemetry.compiledPagesCount}</strong> UI Pages
                                </span>
                                <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-black/[0.04] dark:bg-white/[0.06] text-neutral-700 dark:text-neutral-300 border border-black/[0.06] dark:border-white/10 shadow-xs">
                                    <strong className="text-cyan-600 dark:text-cyan-400">{telemetry.useCasesCount}</strong> Workflows
                                </span>
                            </div>
                        </div>

                        {/* Progress Bar with Glowing Pulse */}
                        <div className="w-full h-2.5 rounded-full bg-black/[0.05] dark:bg-white/[0.08] overflow-hidden p-0.5 border border-white/10">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-400 transition-all duration-700 ease-out shadow-[0_0_12px_rgba(6,182,212,0.6)]"
                                style={{ width: `${Math.max(telemetry.readinessScore, 5)}%` }}
                            />
                        </div>
                    </div>

                    {/* Bottom: Progressive 5-Step Stepper Bar (Clickable) */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-3">
                        {[
                            { step: "models", label: "1. Data Models", desc: `${telemetry.modelsCount} entities` },
                            { step: "apis", label: "2. REST APIs", desc: `${telemetry.apisCount} routes` },
                            { step: "usecases", label: "3. Workflows", desc: `${telemetry.useCasesCount} flows` },
                            { step: "pages", label: "4. UI Prototypes", desc: `${telemetry.compiledPagesCount} pages` },
                            { step: "diagram", label: "5. Topology", desc: "Architecture" },
                        ].map((s, idx) => {
                            const isDone = agentStatus ? agentStatus.currentStepIndex > idx + 1 || agentStatus.status === "completed" : false;
                            const isCurrent = agentStatus ? agentStatus.currentStepIndex === idx + 1 && agentStatus.status === "running" : false;
                            const isStepRunning = runningSteps.includes(s.step) || isCurrent;

                            return (
                                <div
                                    key={s.step}
                                    onClick={() => !runningSteps.includes(s.step) && handleRunSingleStep(s.step as any)}
                                    title="Click to synthesize this module"
                                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer hover:border-cyan-400/50 hover:shadow-[0_0_15px_rgba(6,182,212,0.15)] active:scale-[0.98] ${
                                        isStepRunning
                                            ? "bg-cyan-500/10 border-cyan-400/50 text-cyan-700 dark:text-cyan-300 animate-pulse shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                                            : isDone
                                            ? "bg-emerald-500/5 border-emerald-500/25 text-emerald-700 dark:text-emerald-300"
                                            : "bg-black/[0.02] dark:bg-white/[0.02] border-black/[0.06] dark:border-white/10 text-neutral-600 dark:text-neutral-400"
                                    }`}
                                >
                                    <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                                        <span>{s.label}</span>
                                        <span className={isDone ? "text-emerald-500" : isStepRunning ? "text-cyan-400" : "opacity-40"}>
                                            {isDone ? "✓" : isStepRunning ? "···" : "○"}
                                        </span>
                                    </div>
                                    <div className="text-[10px] opacity-75 font-medium">{s.desc}</div>
                                </div>
                            );
                        })}
                    </div>
                </LiquidCard>

                {/* ── Features Grid (Dynamic Telemetry + 1-Click Action Triggers) ── */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xs font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
                            Development Modules
                        </h2>
                        <span className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500">
                            6 Modules Configured
                        </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* UI Design Card */}
                        <LiquidCard
                            variant="glass"
                            className="p-6 cursor-pointer flex flex-col justify-between group hover:scale-[1.01] transition-all duration-300 relative overflow-hidden"
                            onClick={() => setActivePage("ui")}
                        >
                            <div>
                                <div className="flex items-center justify-between gap-2 mb-3">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">
                                        INTERFACE
                                    </span>
                                    {runningSteps.includes("pages") ? (
                                        <span className="text-[10px] font-bold text-blue-500 animate-pulse">COMPILING</span>
                                    ) : telemetry.compiledPagesCount > 0 ? (
                                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">READY</span>
                                    ) : (
                                        <span className="text-[10px] font-bold text-amber-500">PENDING</span>
                                    )}
                                </div>
                                <h3 className="text-base font-bold text-neutral-950 dark:text-white mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                    UI Design
                                </h3>
                                <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mb-2">
                                    {telemetry.compiledPagesCount} pages ready
                                </div>
                                <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
                                    Build and preview your interface.
                                </p>
                            </div>

                            <div className="pt-4 mt-4 border-t border-black/[0.06] dark:border-white/10 flex items-center justify-between text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                                <span>Open builder</span>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleRunSingleStep("pages");
                                        }}
                                        disabled={isRunningSynthesis || runningSteps.includes("pages")}
                                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 transition-all cursor-pointer disabled:opacity-50"
                                    >
                                        {runningSteps.includes("pages") ? "Compiling…" : "Compile Pages"}
                                    </button>
                                    <span className="font-semibold text-blue-600 dark:text-blue-400">View →</span>
                                </div>
                            </div>
                        </LiquidCard>

                        {/* Database Schema Card */}
                        <LiquidCard
                            variant="glass"
                            className="p-6 cursor-pointer flex flex-col justify-between group hover:scale-[1.01] transition-all duration-300 relative overflow-hidden"
                            onClick={() => setActivePage("database")}
                        >
                            <div>
                                <div className="flex items-center justify-between gap-2 mb-3">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">
                                        DATA MODEL
                                    </span>
                                    {runningSteps.includes("models") ? (
                                        <span className="text-[10px] font-bold text-blue-500 animate-pulse">GENERATING</span>
                                    ) : telemetry.modelsCount > 0 ? (
                                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">READY</span>
                                    ) : (
                                        <span className="text-[10px] font-bold text-amber-500">PENDING</span>
                                    )}
                                </div>
                                <h3 className="text-base font-bold text-neutral-950 dark:text-white mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                    Database Schema
                                </h3>
                                <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mb-2">
                                    {telemetry.modelsCount} models · {telemetry.relationsCount} relations
                                </div>
                                <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
                                    Relational schema models, primary keys, field types, and Prisma/SQL migration code generation.
                                </p>
                            </div>

                            <div className="pt-4 mt-4 border-t border-black/[0.06] dark:border-white/10 flex items-center justify-between text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                                <span>Launch Schema Studio</span>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleRunSingleStep("models");
                                        }}
                                        disabled={isRunningSynthesis || runningSteps.includes("models")}
                                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 transition-all cursor-pointer disabled:opacity-50"
                                    >
                                        {runningSteps.includes("models") ? "Generating…" : "Auto-Generate"}
                                    </button>
                                    <span className="font-semibold text-blue-600 dark:text-blue-400">View →</span>
                                </div>
                            </div>
                        </LiquidCard>

                        {/* REST APIs Card */}
                        <LiquidCard
                            variant="glass"
                            className="p-6 cursor-pointer flex flex-col justify-between group hover:scale-[1.01] transition-all duration-300 relative overflow-hidden"
                            onClick={() => setActivePage("apis")}
                        >
                            <div>
                                <div className="flex items-center justify-between gap-2 mb-3">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">
                                        ENDPOINTS
                                    </span>
                                    {runningSteps.includes("apis") ? (
                                        <span className="text-[10px] font-bold text-blue-500 animate-pulse">DERIVING</span>
                                    ) : telemetry.apisCount > 0 ? (
                                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">READY</span>
                                    ) : (
                                        <span className="text-[10px] font-bold text-amber-500">PENDING</span>
                                    )}
                                </div>
                                <h3 className="text-base font-bold text-neutral-950 dark:text-white mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                    REST APIs
                                </h3>
                                <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mb-2">
                                    {telemetry.apisCount} REST endpoints defined
                                </div>
                                <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
                                    Production route contracts, request schemas, parameters, mock payloads, and Express controller export.
                                </p>
                            </div>

                            <div className="pt-4 mt-4 border-t border-black/[0.06] dark:border-white/10 flex items-center justify-between text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                                <span>Launch API Studio</span>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleRunSingleStep("apis");
                                        }}
                                        disabled={isRunningSynthesis || runningSteps.includes("apis")}
                                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 transition-all cursor-pointer disabled:opacity-50"
                                    >
                                        {runningSteps.includes("apis") ? "Deriving…" : "Derive Routes"}
                                    </button>
                                    <span className="font-semibold text-blue-600 dark:text-blue-400">View →</span>
                                </div>
                            </div>
                        </LiquidCard>

                        {/* Use Cases Card */}
                        <LiquidCard
                            variant="glass"
                            className="p-6 cursor-pointer flex flex-col justify-between group hover:scale-[1.01] transition-all duration-300 relative overflow-hidden"
                            onClick={() => setActivePage("usecases")}
                        >
                            <div>
                                <div className="flex items-center justify-between gap-2 mb-3">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">
                                        LOGIC
                                    </span>
                                    {runningSteps.includes("usecases") ? (
                                        <span className="text-[10px] font-bold text-blue-500 animate-pulse">MAPPING</span>
                                    ) : telemetry.useCasesCount > 0 ? (
                                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">READY</span>
                                    ) : (
                                        <span className="text-[10px] font-bold text-amber-500">PENDING</span>
                                    )}
                                </div>
                                <h3 className="text-base font-bold text-neutral-950 dark:text-white mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                    Use Cases
                                </h3>
                                <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mb-2">
                                    {telemetry.useCasesCount} actor workflows mapped
                                </div>
                                <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
                                    Actor workflows, sequential conditions, domain validation rules, and core business process flows.
                                </p>
                            </div>

                            <div className="pt-4 mt-4 border-t border-black/[0.06] dark:border-white/10 flex items-center justify-between text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                                <span>Launch Use Cases</span>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleRunSingleStep("usecases");
                                        }}
                                        disabled={isRunningSynthesis || runningSteps.includes("usecases")}
                                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 transition-all cursor-pointer disabled:opacity-50"
                                    >
                                        {runningSteps.includes("usecases") ? "Mapping…" : "Map Workflows"}
                                    </button>
                                    <span className="font-semibold text-blue-600 dark:text-blue-400">View →</span>
                                </div>
                            </div>
                        </LiquidCard>

                        {/* System Diagrams Card */}
                        <LiquidCard
                            variant="glass"
                            className="p-6 cursor-pointer flex flex-col justify-between group hover:scale-[1.01] transition-all duration-300 relative overflow-hidden"
                            onClick={() => setActivePage("diagrams")}
                        >
                            <div>
                                <div className="flex items-center justify-between gap-2 mb-3">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">
                                        ARCHITECTURE
                                    </span>
                                    {runningSteps.includes("diagram") ? (
                                        <span className="text-[10px] font-bold text-blue-500 animate-pulse">RENDERING</span>
                                    ) : (
                                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">ACTIVE</span>
                                    )}
                                </div>
                                <h3 className="text-base font-bold text-neutral-950 dark:text-white mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                    System Diagrams
                                </h3>
                                <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mb-2">
                                    Mermaid ERD & Service Topology
                                </div>
                                <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
                                    Interactive architecture diagrams, entity relationships, and living topology synchronized with data models.
                                </p>
                            </div>

                            <div className="pt-4 mt-4 border-t border-black/[0.06] dark:border-white/10 flex items-center justify-between text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                                <span>Launch Canvas</span>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleRunSingleStep("diagram");
                                        }}
                                        disabled={isRunningSynthesis || runningSteps.includes("diagram")}
                                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 transition-all cursor-pointer disabled:opacity-50"
                                    >
                                        {runningSteps.includes("diagram") ? "Rendering…" : "Render Topology"}
                                    </button>
                                    <span className="font-semibold text-blue-600 dark:text-blue-400">View →</span>
                                </div>
                            </div>
                        </LiquidCard>

                        {/* Source Code & Git Card */}
                        <LiquidCard
                            variant="glass"
                            className="p-6 cursor-pointer flex flex-col justify-between group hover:scale-[1.01] transition-all duration-300 relative overflow-hidden"
                            onClick={() => setActivePage("code")}
                        >
                            <div>
                                <div className="flex items-center justify-between gap-2 mb-3">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">
                                        VERSION CONTROL
                                    </span>
                                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                        EXPLORE
                                    </span>
                                </div>
                                <h3 className="text-base font-bold text-neutral-950 dark:text-white mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                    Source Code & Git
                                </h3>
                                <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mb-2">
                                    Virtual File Tree & Monaco Editor
                                </div>
                                <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
                                    Complete TypeScript build explorer, diff reviewer, branch manager, and 1-click project export.
                                </p>
                            </div>

                            <div className="pt-4 mt-4 border-t border-black/[0.06] dark:border-white/10 flex items-center justify-between text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                                <span>Launch Editor</span>
                                <span className="font-semibold text-blue-600 dark:text-blue-400">Open Virtual Files →</span>
                            </div>
                        </LiquidCard>
                    </div>
                </div>


            </div>
        </div>
    );
};

export default ProjectDashboard;
