/**
 * IdeaPage — View and edit the project idea/description
 * Apple Liquid Glass aesthetic, high-contrast light mode, 100% typography, ZERO icons.
 */

import React, { useState, useEffect, useMemo } from "react";
import useApi from "../hooks/useApi";
import { useProjectStore } from "../hooks/useProjectStore";
import { useSettings } from "../context/SettingsContext";
import { generateStructuredIdea, updateProjectSettings, refreshCurrentProject } from "../stores/projectStore";
import { useToast } from "../context/ToastContext";
import IdeaWorkshop from "./IdeaWorkshop";
import { LiquidCard, LiquidPill } from "../components/ui/LiquidGlass";
import SpecificationAsideDrawer, { SpecificationSectionKey } from "../components/features/Idea/SpecificationAsideDrawer";

function getGeneratePlanErrorMessage(err: unknown): string {
    if (err instanceof Error) {
        const message = err.message;
        if (message.includes("400")) {
            return "Please add a project idea before generating a plan.";
        }
        if (message.includes("500")) {
            return "The AI could not produce a usable plan right now. Please try again.";
        }
        return message;
    }

    return "Failed to generate plan. Please try again.";
}

const IdeaPage: React.FC = () => {
    const api = useApi();
    const { project } = useProjectStore();
    const { apiKey, model, apiBaseUrl } = useSettings();
    const { error: showToastError } = useToast();
    const [idea, setIdea] = useState("");
    const [activeTab, setActiveTab] = useState<"workspace" | "document">("workspace");
    const [generatingPlan, setGeneratingPlan] = useState(false);
    const [selectedSection, setSelectedSection] = useState<SpecificationSectionKey | null>(null);

    const settings = useMemo(() => {
        if (!project?.settings) return {};
        if (typeof project.settings === "string") {
            try {
                return JSON.parse(project.settings);
            } catch {
                return {};
            }
        }
        return project.settings as Record<string, any>;
    }, [project?.settings]);

    const ideaDetails = settings.ideaDetails;

    // Refresh project from backend on mount so ideaDetails is always up to date
    useEffect(() => {
        if (project?.id) {
            void refreshCurrentProject(project.id);
        }
    }, [project?.id]);

    const handleSaveSection = async (sectionKey: SpecificationSectionKey, updatedData: any) => {
        if (!project) return;
        const currentDetails = ideaDetails || {};
        const updatedDetails: any = { ...currentDetails };

        switch (sectionKey) {
            case "metadata":
                updatedDetails.ideaMetadata = {
                    ...(currentDetails.ideaMetadata || {}),
                    ...updatedData,
                };
                break;
            case "problem":
                updatedDetails.problem = {
                    ...(currentDetails.problem || {}),
                    ...updatedData,
                };
                break;
            case "solution":
                updatedDetails.solution = {
                    ...(currentDetails.solution || {}),
                    ...updatedData,
                };
                break;
            case "features":
                updatedDetails.product = {
                    ...(currentDetails.product || {}),
                    coreFeatures: updatedData.coreFeatures || [],
                };
                break;
            case "targetMarket":
                updatedDetails.targetMarket = {
                    ...(currentDetails.targetMarket || {}),
                    ...updatedData,
                };
                break;
            case "technical":
                updatedDetails.technicalArchitecture = {
                    ...(currentDetails.technicalArchitecture || {}),
                    frontend: updatedData.frontend,
                    backend: updatedData.backend,
                    database: updatedData.database,
                };
                updatedDetails.mvpPlan = {
                    ...(currentDetails.mvpPlan || {}),
                    mvpGoal: updatedData.mvpGoal,
                };
                break;
        }

        const newSettings = {
            ...settings,
            ideaDetails: updatedDetails,
        };

        await updateProjectSettings(newSettings);
    };

    useEffect(() => {
        if (ideaDetails) {
            setActiveTab("document");
        } else {
            setActiveTab("workspace");
        }
    }, [ideaDetails]);

    const handleGeneratePlan = async () => {
        setGeneratingPlan(true);
        try {
            await generateStructuredIdea(undefined, apiKey, model, apiBaseUrl);
        } catch (err) {
            console.error("Failed to generate structured plan:", err);
            showToastError(getGeneratePlanErrorMessage(err));
        } finally {
            setGeneratingPlan(false);
        }
    };

    useEffect(() => {
        if (project) {
            const resolvedIdea = (
                project.description ||
                ideaDetails?.ideaMetadata?.summary ||
                ideaDetails?.solution?.productDescription ||
                ideaDetails?.ideaMetadata?.tagline ||
                ""
            ).trim();
            if (resolvedIdea) {
                setIdea(resolvedIdea);
            }
        }
    }, [project?.description, ideaDetails]);

    const handleWorkshopRefined = async (refinedIdea: string) => {
        if (!project) return;
        setIdea(refinedIdea);
        setActiveTab("document");
        try {
            await api.updateProjectDescription(refinedIdea, project.id);
            setGeneratingPlan(true);
            await generateStructuredIdea(refinedIdea, apiKey, model, apiBaseUrl);
            setGeneratingPlan(false);
        } catch (err) {
            console.error("Failed to save refined idea or generate plan:", err);
            showToastError(getGeneratePlanErrorMessage(err));
            setGeneratingPlan(false);
        }
    };

    if (!project) return null;

    return (
        <div className="h-full w-full relative flex flex-col overflow-hidden select-none">
            {/* ── Top Header ── */}
            <div className="flex-shrink-0 px-6 sm:px-10 pt-6 sm:pt-8 pb-4 border-b border-black/[0.08] dark:border-white/10 relative z-10 bg-transparent">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">
                            PROJECT SPECIFICATION
                        </span>
                        <h1 className="text-xl font-bold tracking-tight text-neutral-950 dark:text-white mt-0.5">
                            {project.name}
                        </h1>
                    </div>

                    {/* Tab Switcher (Liquid Pills) */}
                    {project.status !== "initializing" && project.status !== "initiated" && (
                        <div className="flex items-center gap-2">
                            <LiquidPill
                                variant={activeTab === "document" ? "active" : "secondary"}
                                size="sm"
                                onClick={() => setActiveTab("document")}
                            >
                                Structured Document
                            </LiquidPill>
                            <LiquidPill
                                variant={activeTab === "workspace" ? "active" : "secondary"}
                                size="sm"
                                onClick={() => setActiveTab("workspace")}
                            >
                                AI Workshop
                            </LiquidPill>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Main Layout Body ── */}
            <div className="flex-1 flex overflow-hidden relative z-10">
                {/* ── Workspace Tab ── */}
                {activeTab === "workspace" && (
                    <div className="flex-1 h-full overflow-y-auto p-6 sm:p-10">
                        <div className="max-w-6xl mx-auto min-h-[500px]">
                            <IdeaWorkshop
                                projectName={project.name}
                                projectId={project.id}
                                initialIdea={idea}
                                fullScreen
                                onRefined={handleWorkshopRefined}
                                onCancel={() => setActiveTab("document")}
                            />
                        </div>
                    </div>
                )}

                {/* ── Document Tab (Split Flow: Cards on Left, Docked Aside Drawer on Right) ── */}
                {activeTab === "document" && (
                    <>
                        {/* Left Side: Cards Container (Smoothly shifts left and reflows into 2 columns when Aside opens) */}
                        <div className={`flex-1 h-full overflow-y-auto p-6 sm:p-10 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                            selectedSection ? "pr-4 sm:pr-6" : ""
                        }`}>
                            <div className={`transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                                selectedSection ? "max-w-full" : "max-w-6xl mx-auto"
                            } space-y-6`}>
                                {/* Section Bar */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div>
                                        <h2 className="text-base font-bold text-neutral-950 dark:text-white">
                                            Structured Specification
                                        </h2>
                                        <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5">
                                            Extracted metadata, domain problem scope, technical solution, and MVP breakdown.
                                        </p>
                                    </div>
                                    <LiquidPill
                                        variant="primary"
                                        size="sm"
                                        onClick={handleGeneratePlan}
                                        disabled={generatingPlan || !idea}
                                    >
                                        {generatingPlan ? "Generating..." : ideaDetails ? "Refresh Plan" : "Generate Plan"}
                                    </LiquidPill>
                                </div>

                                {!ideaDetails && !generatingPlan ? (
                                    <LiquidCard variant="glass" className="p-12 text-center">
                                        <span className="text-xs font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400 block mb-1">
                                            No Structured Plan Generated
                                        </span>
                                        <p className="text-xs text-neutral-600 dark:text-neutral-400 max-w-sm mx-auto mb-4">
                                            Extract actionable structure from your unstructured project description.
                                        </p>
                                        <LiquidPill
                                            variant="primary"
                                            size="sm"
                                            onClick={handleGeneratePlan}
                                            disabled={!idea}
                                        >
                                            Generate Plan Now
                                        </LiquidPill>
                                    </LiquidCard>
                                ) : generatingPlan ? (
                                    <LiquidCard variant="glass" className="p-12 text-center">
                                        <span className="text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400 block mb-1">
                                            Analyzing Architecture...
                                        </span>
                                        <p className="text-xs text-neutral-600 dark:text-neutral-400 max-w-sm mx-auto">
                                            Extracting modules, user flows, and technical stack from project context.
                                        </p>
                                    </LiquidCard>
                                ) : (
                                    <div className={`grid gap-5 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                                        selectedSection
                                            ? "grid-cols-1 xl:grid-cols-2"
                                            : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
                                    }`}>

                                        {/* Metadata Card */}
                                        <LiquidCard
                                            variant="glass"
                                            onClick={() => setSelectedSection(selectedSection === "metadata" ? null : "metadata")}
                                            className={`idea-section-card p-5 space-y-3 cursor-pointer transition-all duration-300 hover:border-blue-500/50 hover:shadow-[0_8px_30px_rgba(59,130,246,0.12)] active:scale-[0.99] group relative ${
                                                selectedSection === "metadata" ? "ring-2 ring-blue-500/80 border-blue-500/60 shadow-[0_0_25px_rgba(59,130,246,0.25)] bg-blue-500/[0.04]" : ""
                                            }`}
                                        >
                                            <div className="flex items-center justify-between pb-2 border-b border-black/[0.06] dark:border-white/10">
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">
                                                    Idea Metadata
                                                </span>
                                                <span className={`font-mono text-[9px] font-bold tracking-widest px-2 py-0.5 rounded-full transition-all ${
                                                    selectedSection === "metadata"
                                                        ? "bg-blue-600 text-white shadow-xs"
                                                        : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 group-hover:bg-blue-500 group-hover:text-white"
                                                }`}>
                                                    {selectedSection === "metadata" ? "ACTIVE" : "EDIT"}
                                                </span>
                                            </div>
                                            <div className="space-y-2 text-xs">
                                                <div>
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 block">Name</span>
                                                    <span className="font-semibold text-neutral-900 dark:text-neutral-100">{ideaDetails?.ideaMetadata?.ideaName || "N/A"}</span>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 block">Tagline</span>
                                                    <span className="text-neutral-700 dark:text-neutral-300">{ideaDetails?.ideaMetadata?.tagline || "N/A"}</span>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 block">Summary</span>
                                                    <span className="text-neutral-600 dark:text-neutral-300 leading-relaxed block">{ideaDetails?.ideaMetadata?.summary || "N/A"}</span>
                                                </div>
                                            </div>
                                        </LiquidCard>

                                        {/* Problem Card */}
                                        <LiquidCard
                                            variant="glass"
                                            onClick={() => setSelectedSection(selectedSection === "problem" ? null : "problem")}
                                            className={`idea-section-card p-5 space-y-3 cursor-pointer transition-all duration-300 hover:border-amber-500/50 hover:shadow-[0_8px_30px_rgba(245,158,11,0.12)] active:scale-[0.99] group relative ${
                                                selectedSection === "problem" ? "ring-2 ring-amber-500/80 border-amber-500/60 shadow-[0_0_25px_rgba(245,158,11,0.25)] bg-amber-500/[0.04]" : ""
                                            }`}
                                        >
                                            <div className="flex items-center justify-between pb-2 border-b border-black/[0.06] dark:border-white/10">
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">
                                                    Problem Statement
                                                </span>
                                                <span className={`font-mono text-[9px] font-bold tracking-widest px-2 py-0.5 rounded-full transition-all ${
                                                    selectedSection === "problem"
                                                        ? "bg-amber-600 text-white shadow-xs"
                                                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 group-hover:bg-amber-500 group-hover:text-white"
                                                }`}>
                                                    {selectedSection === "problem" ? "ACTIVE" : "EDIT"}
                                                </span>
                                            </div>
                                            <div className="space-y-2 text-xs">
                                                <div>
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 block">Statement</span>
                                                    <span className="text-neutral-700 dark:text-neutral-300 leading-relaxed block">{ideaDetails?.problem?.problemStatement || "N/A"}</span>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 block">Urgency</span>
                                                    <span className="font-semibold text-amber-700 dark:text-amber-300">{ideaDetails?.problem?.urgencyLevel || "N/A"}</span>
                                                </div>
                                                {ideaDetails?.problem?.painPoints && (
                                                    <div>
                                                        <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 block mb-1">Pain Points</span>
                                                        <ul className="space-y-1 text-neutral-600 dark:text-neutral-300">
                                                            {ideaDetails.problem.painPoints.map((p: string, i: number) => (
                                                                <li key={i} className="flex items-start gap-1.5">
                                                                    <span className="text-neutral-400 mt-0.5">•</span>
                                                                    <span>{p}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>
                                        </LiquidCard>

                                        {/* Solution Card */}
                                        <LiquidCard
                                            variant="glass"
                                            onClick={() => setSelectedSection(selectedSection === "solution" ? null : "solution")}
                                            className={`idea-section-card p-5 space-y-3 cursor-pointer transition-all duration-300 hover:border-emerald-500/50 hover:shadow-[0_8px_30px_rgba(16,185,129,0.12)] active:scale-[0.99] group relative ${
                                                selectedSection === "solution" ? "ring-2 ring-emerald-500/80 border-emerald-500/60 shadow-[0_0_25px_rgba(16,185,129,0.25)] bg-emerald-500/[0.04]" : ""
                                            }`}
                                        >
                                            <div className="flex items-center justify-between pb-2 border-b border-black/[0.06] dark:border-white/10">
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                                                    The Solution
                                                </span>
                                                <span className={`font-mono text-[9px] font-bold tracking-widest px-2 py-0.5 rounded-full transition-all ${
                                                    selectedSection === "solution"
                                                        ? "bg-emerald-600 text-white shadow-xs"
                                                        : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 group-hover:bg-emerald-500 group-hover:text-white"
                                                }`}>
                                                    {selectedSection === "solution" ? "ACTIVE" : "EDIT"}
                                                </span>
                                            </div>
                                            <div className="space-y-2 text-xs">
                                                <div>
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 block">Core Innovation</span>
                                                    <span className="text-neutral-700 dark:text-neutral-300 leading-relaxed block">{ideaDetails?.solution?.coreInnovation || "N/A"}</span>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 block">Value Proposition</span>
                                                    <span className="text-neutral-700 dark:text-neutral-300 leading-relaxed block">{ideaDetails?.solution?.valueProposition || "N/A"}</span>
                                                </div>
                                            </div>
                                        </LiquidCard>

                                        {/* Product Features Card */}
                                        <LiquidCard
                                            variant="glass"
                                            onClick={() => setSelectedSection(selectedSection === "features" ? null : "features")}
                                            className={`idea-section-card p-5 space-y-3 cursor-pointer transition-all duration-300 hover:border-blue-500/50 hover:shadow-[0_8px_30px_rgba(59,130,246,0.12)] active:scale-[0.99] group relative ${
                                                selectedSection === "features" ? "ring-2 ring-blue-500/80 border-blue-500/60 shadow-[0_0_25px_rgba(59,130,246,0.25)] bg-blue-500/[0.04]" : ""
                                            }`}
                                        >
                                            <div className="flex items-center justify-between pb-2 border-b border-black/[0.06] dark:border-white/10">
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">
                                                    Core Features
                                                </span>
                                                <span className={`font-mono text-[9px] font-bold tracking-widest px-2 py-0.5 rounded-full transition-all ${
                                                    selectedSection === "features"
                                                        ? "bg-blue-600 text-white shadow-xs"
                                                        : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 group-hover:bg-blue-500 group-hover:text-white"
                                                }`}>
                                                    {selectedSection === "features" ? "ACTIVE" : "EDIT"}
                                                </span>
                                            </div>
                                            <div className="space-y-2 text-xs">
                                                {ideaDetails?.product?.coreFeatures && (
                                                    <ul className="space-y-1.5 text-neutral-700 dark:text-neutral-300">
                                                        {ideaDetails.product.coreFeatures.map((f: string, i: number) => (
                                                            <li key={i} className="flex items-start gap-1.5">
                                                                <span className="text-blue-500 font-bold mt-0.5">•</span>
                                                                <span>{f}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </div>
                                        </LiquidCard>

                                        {/* Target Market Card */}
                                        <LiquidCard
                                            variant="glass"
                                            onClick={() => setSelectedSection(selectedSection === "targetMarket" ? null : "targetMarket")}
                                            className={`idea-section-card p-5 space-y-3 cursor-pointer transition-all duration-300 hover:border-purple-500/50 hover:shadow-[0_8px_30px_rgba(168,85,247,0.12)] active:scale-[0.99] group relative ${
                                                selectedSection === "targetMarket" ? "ring-2 ring-purple-500/80 border-purple-500/60 shadow-[0_0_25px_rgba(168,85,247,0.25)] bg-purple-500/[0.04]" : ""
                                            }`}
                                        >
                                            <div className="flex items-center justify-between pb-2 border-b border-black/[0.06] dark:border-white/10">
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-purple-600 dark:text-purple-400">
                                                    Target Audience
                                                </span>
                                                <span className={`font-mono text-[9px] font-bold tracking-widest px-2 py-0.5 rounded-full transition-all ${
                                                    selectedSection === "targetMarket"
                                                        ? "bg-purple-600 text-white shadow-xs"
                                                        : "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 group-hover:bg-purple-500 group-hover:text-white"
                                                }`}>
                                                    {selectedSection === "targetMarket" ? "ACTIVE" : "EDIT"}
                                                </span>
                                            </div>
                                            <div className="space-y-2 text-xs">
                                                <div>
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 block">Primary Users</span>
                                                    <span className="font-semibold text-neutral-900 dark:text-neutral-100">{ideaDetails?.targetMarket?.primaryUsers?.join(", ") || "N/A"}</span>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 block">Geographic Focus</span>
                                                    <span className="text-neutral-700 dark:text-neutral-300">{ideaDetails?.targetMarket?.geographicFocus || "Global"}</span>
                                                </div>
                                            </div>
                                        </LiquidCard>

                                        {/* Technical & MVP */}
                                        <LiquidCard
                                            variant="glass"
                                            onClick={() => setSelectedSection(selectedSection === "technical" ? null : "technical")}
                                            className={`idea-section-card p-5 space-y-3 cursor-pointer transition-all duration-300 hover:border-indigo-500/50 hover:shadow-[0_8px_30px_rgba(99,102,241,0.12)] active:scale-[0.99] group relative ${
                                                selectedSection === "technical" ? "ring-2 ring-indigo-500/80 border-indigo-500/60 shadow-[0_0_25px_rgba(99,102,241,0.25)] bg-indigo-500/[0.04]" : ""
                                            }`}
                                        >
                                            <div className="flex items-center justify-between pb-2 border-b border-black/[0.06] dark:border-white/10">
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                                                    Technical Stack & MVP
                                                </span>
                                                <span className={`font-mono text-[9px] font-bold tracking-widest px-2 py-0.5 rounded-full transition-all ${
                                                    selectedSection === "technical"
                                                        ? "bg-indigo-600 text-white shadow-xs"
                                                        : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 group-hover:bg-indigo-500 group-hover:text-white"
                                                }`}>
                                                    {selectedSection === "technical" ? "ACTIVE" : "EDIT"}
                                                </span>
                                            </div>
                                            <div className="space-y-2 text-xs">
                                                <div>
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 block">Tech Stack</span>
                                                    <span className="text-neutral-800 dark:text-neutral-200">
                                                        {ideaDetails?.technicalArchitecture?.frontend || "Frontend"} / {ideaDetails?.technicalArchitecture?.backend || "Backend"} / {ideaDetails?.technicalArchitecture?.database || "DB"}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 block">MVP Goal</span>
                                                    <span className="text-neutral-700 dark:text-neutral-300">{ideaDetails?.mvpPlan?.mvpGoal || "N/A"}</span>
                                                </div>
                                            </div>
                                        </LiquidCard>

                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Side: Docked Specification Aside Drawer (Expands with smooth cubic-bezier animation) */}
                        <aside className={`h-full flex-shrink-0 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden flex flex-col z-20 border-l border-black/[0.08] dark:border-white/10 ${
                            selectedSection
                                ? "w-[480px] xl:w-[540px] opacity-100 translate-x-0"
                                : "w-0 opacity-0 translate-x-12 pointer-events-none"
                        }`}>
                            <SpecificationAsideDrawer
                                docked={true}
                                isOpen={!!selectedSection}
                                sectionKey={selectedSection}
                                ideaDetails={ideaDetails}
                                onClose={() => setSelectedSection(null)}
                                onSaveSection={handleSaveSection}
                            />
                        </aside>
                    </>
                )}
            </div>
        </div>
    );
};

export default IdeaPage;
