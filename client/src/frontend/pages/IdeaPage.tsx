/**
 * IdeaPage — View and edit the project idea/description
 */

import React, { useState, useEffect } from "react";
import { useProjectStore } from "../hooks/useProjectStore";
import { generateStructuredIdea } from "../stores/projectStore";
import { useToast } from "../context/ToastContext";
import axios from "axios";
import IdeaWorkshop from "./IdeaWorkshop";

const API_BASE = "http://localhost:3001/api";

const IdeaPage: React.FC = () => {
    const { project } = useProjectStore();
    const { error: showToastError } = useToast();
    const [idea, setIdea] = useState("");
    const [activeTab, setActiveTab] = useState<"workspace" | "document">("workspace");
    const [generatingPlan, setGeneratingPlan] = useState(false);

    useEffect(() => {
        if (project && activeTab === "workspace") {
            // Set initial tab based on whether idea details exist
            if (project.settings?.ideaDetails) {
                setActiveTab("document");
            }
        }
    }, [project, activeTab]);

    const handleGeneratePlan = async () => {
        setGeneratingPlan(true);
        try {
            await generateStructuredIdea();
        } catch (err) {
            console.error("Failed to generate structured plan:", err);
            showToastError("Failed to generate plan. The AI returned invalid data. Please try again.");
        } finally {
            setGeneratingPlan(false);
        }
    };

    useEffect(() => {
        if (project) {
            setIdea(project.description || "");
        }
    }, [project]);



    const handleWorkshopRefined = async (refinedIdea: string) => {
        if (!project) return;
        setIdea(refinedIdea);
        setActiveTab("document");
        try {
            await axios.put(`${API_BASE}/project/${project.id}/idea`, { idea: refinedIdea });
            
            // Generate the structured plan immediately since they hit finalize
            setGeneratingPlan(true);
            await generateStructuredIdea(refinedIdea);
            setGeneratingPlan(false);
        } catch (err) {
            console.error("Failed to save refined idea or generate plan:", err);
            showToastError("Failed to generate plan. The AI returned invalid JSON. Please try again.");
            setGeneratingPlan(false);
        }
    };

    if (!project) return null;

    return (
        <div className="h-full w-full overflow-auto relative page-enter" style={{ background: "#0a0a0f" }}>
            {/* Animated Background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div
                    className="absolute w-[500px] h-[500px] rounded-full opacity-25 blur-[120px]"
                    style={{
                        background: "radial-gradient(circle, #f59e0b 0%, transparent 70%)",
                        top: "-10%",
                        right: "10%",
                        animation: "float1 20s ease-in-out infinite",
                    }}
                />
                <div
                    className="absolute w-[400px] h-[400px] rounded-full opacity-20 blur-[100px]"
                    style={{
                        background: "radial-gradient(circle, #6366f1 0%, transparent 70%)",
                        bottom: "10%",
                        left: "5%",
                        animation: "float2 25s ease-in-out infinite",
                    }}
                />
                <div
                    className="absolute inset-0 opacity-[0.03]"
                    style={{
                        backgroundImage: `linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)`,
                        backgroundSize: "60px 60px",
                    }}
                />
            </div>

            <div className={`relative z-10 w-full min-h-full px-6 py-6 flex flex-col`}>
                {/* Header */}
                <div className="mb-6 flex-shrink-0" style={{ animation: "fadeSlideUp 0.5s ease-out both" }}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/20 flex items-center justify-center">
                                <span className="text-2xl">💡</span>
                            </div>
                            <div>
                                <h1 className="text-2xl font-extrabold text-white tracking-tight">Project Idea</h1>
                                <p className="text-xs text-white/30 uppercase tracking-[0.2em] mt-0.5">{project.name}</p>
                            </div>
                        </div>

                        {/* Idea / Workshop tabs */}
                        <div className="flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-1">
                            <button
                                onClick={() => setActiveTab("document")}
                                className={`h-9 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${activeTab === "document"
                                    ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/20"
                                    : "text-white/50 hover:text-white hover:bg-white/10"
                                    }`}
                            >
                                Idea Document
                            </button>
                            <button
                                onClick={() => setActiveTab("workspace")}
                                className={`h-9 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${activeTab === "workspace"
                                    ? "bg-gradient-to-r from-indigo-500 to-cyan-500 text-white shadow-lg shadow-indigo-500/20"
                                    : "text-white/50 hover:text-white hover:bg-white/10"
                                    }`}
                            >
                                AI Workspace
                            </button>
                        </div>
                    </div>
                </div>

                {activeTab === "workspace" && (
                    <div className="flex-1 min-h-0" style={{ animation: "fadeSlideUp 0.5s ease-out 0.2s both" }}>
                        <IdeaWorkshop
                            projectName={project.name}
                            projectId={project.id}
                            initialIdea={idea}
                            fullScreen
                            onRefined={handleWorkshopRefined}
                            onCancel={() => setActiveTab("document")}
                        />
                    </div>
                )}

                {activeTab === "document" && (
                    <div className="flex-1 min-h-0 bg-white/[0.02] border border-white/[0.05] rounded-3xl p-6 overflow-y-auto custom-scrollbar" style={{ animation: "fadeSlideUp 0.5s ease-out 0.2s both" }}>
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h2 className="text-xl font-bold text-white">Structured Plan</h2>
                                <p className="text-sm text-white/50 mt-1">AI-extracted metadata, problem scope, solution, and roadmap.</p>
                            </div>
                            <button
                                onClick={handleGeneratePlan}
                                disabled={generatingPlan || !idea}
                                className="px-5 py-2.5 text-xs font-bold rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:opacity-90 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center gap-2"
                            >
                                {generatingPlan ? "Generating..." : project.settings?.ideaDetails ? "Refresh Plan from Idea" : "Generate Plan from Idea"}
                            </button>
                        </div>
                        
                        {!project.settings?.ideaDetails && !generatingPlan ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center">
                                <span className="text-4xl mb-4 opacity-30">🧩</span>
                                <h3 className="text-lg font-bold text-white/50 mb-2">No Structured Plan Yet</h3>
                                <p className="text-sm text-white/30 max-w-md">Click "Generate Plan from Idea" to let AI parse your unstructured project idea into a neat, actionable JSON breakdown.</p>
                            </div>
                        ) : generatingPlan ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center animate-pulse">
                                <span className="text-4xl mb-4 opacity-50">🤖</span>
                                <h3 className="text-lg font-bold text-white/70 mb-2">Extracting Details...</h3>
                                <p className="text-sm text-white/40">Our AI is analyzing your project description and breaking it down into structured modules.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
                                {/* Metadata Card */}
                                <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex flex-col gap-3">
                                    <h3 className="text-sm font-black text-emerald-400 uppercase tracking-widest border-b border-white/[0.05] pb-2">Idea Metadata</h3>
                                    <div className="text-xs text-white/70"><strong>Name:</strong> {project.settings.ideaDetails?.ideaMetadata?.ideaName || "N/A"}</div>
                                    <div className="text-xs text-white/70"><strong>Tagline:</strong> {project.settings.ideaDetails?.ideaMetadata?.tagline || "N/A"}</div>
                                    <div className="text-xs text-white/70"><strong>Summary:</strong> {project.settings.ideaDetails?.ideaMetadata?.summary || "N/A"}</div>
                                    <div className="text-xs text-white/70"><strong>Category:</strong> <span className="px-2 py-0.5 rounded-md bg-white/10 text-white/90">{project.settings.ideaDetails?.ideaMetadata?.category || "N/A"}</span></div>
                                </div>
                                
                                {/* Problem Card */}
                                <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex flex-col gap-3">
                                    <h3 className="text-sm font-black text-rose-400 uppercase tracking-widest border-b border-white/[0.05] pb-2">The Problem</h3>
                                    <div className="text-xs text-white/70"><strong>Statement:</strong> {project.settings.ideaDetails?.problem?.problemStatement || "N/A"}</div>
                                    <div className="text-xs text-white/70"><strong>Urgency:</strong> <span className="text-rose-300 font-bold">{project.settings.ideaDetails?.problem?.urgencyLevel || "N/A"}</span></div>
                                    <div>
                                        <div className="text-[10px] uppercase text-white/40 font-bold mb-1">Pain Points</div>
                                        <ul className="list-disc pl-4 text-xs text-white/60 space-y-1">
                                            {project.settings.ideaDetails?.problem?.painPoints?.map((p: string, i: number) => <li key={i}>{p}</li>) || <li>N/A</li>}
                                        </ul>
                                    </div>
                                </div>

                                {/* Solution Card */}
                                <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex flex-col gap-3">
                                    <h3 className="text-sm font-black text-cyan-400 uppercase tracking-widest border-b border-white/[0.05] pb-2">The Solution</h3>
                                    <div className="text-xs text-white/70"><strong>Innovation:</strong> {project.settings.ideaDetails?.solution?.coreInnovation || "N/A"}</div>
                                    <div className="text-xs text-white/70"><strong>Value Prop:</strong> {project.settings.ideaDetails?.solution?.valueProposition || "N/A"}</div>
                                    <div>
                                        <div className="text-[10px] uppercase text-white/40 font-bold mb-1">Key Benefits</div>
                                        <ul className="list-disc pl-4 text-xs text-white/60 space-y-1">
                                            {project.settings.ideaDetails?.solution?.keyBenefits?.map((b: string, i: number) => <li key={i}>{b}</li>) || <li>N/A</li>}
                                        </ul>
                                    </div>
                                </div>

                                {/* Product Features Card */}
                                <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex flex-col gap-3">
                                    <h3 className="text-sm font-black text-blue-400 uppercase tracking-widest border-b border-white/[0.05] pb-2">Core Product</h3>
                                    <div>
                                        <div className="text-[10px] uppercase text-white/40 font-bold mb-1">Core Features</div>
                                        <ul className="list-disc pl-4 text-xs text-white/60 space-y-1">
                                            {project.settings.ideaDetails?.product?.coreFeatures?.map((f: string, i: number) => <li key={i}>{f}</li>) || <li>N/A</li>}
                                        </ul>
                                    </div>
                                    <div>
                                        <div className="text-[10px] uppercase text-white/40 font-bold mb-1">Advanced Features</div>
                                        <ul className="list-disc pl-4 text-xs text-white/60 space-y-1">
                                            {project.settings.ideaDetails?.product?.advancedFeatures?.map((f: string, i: number) => <li key={i}>{f}</li>) || <li>-</li>}
                                        </ul>
                                    </div>
                                </div>

                                {/* Target Market Card */}
                                <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex flex-col gap-3 md:col-span-2 lg:col-span-1">
                                    <h3 className="text-sm font-black text-fuchsia-400 uppercase tracking-widest border-b border-white/[0.05] pb-2">Target Market</h3>
                                    <div className="text-xs text-white/70"><strong>Primary Users:</strong> {project.settings.ideaDetails?.targetMarket?.primaryUsers?.join(", ") || "N/A"}</div>
                                    <div className="text-xs text-white/70"><strong>Focus:</strong> {project.settings.ideaDetails?.targetMarket?.geographicFocus || "Global"}</div>
                                    <div className="text-xs text-white/40 italic">Note: Consider filling in TAM/SAM/SOM if required.</div>
                                </div>
                                
                                {/* Additional Architecture/Roadmap Summary */}
                                <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex flex-col gap-3 md:col-span-2 lg:col-span-1">
                                    <h3 className="text-sm font-black text-amber-400 uppercase tracking-widest border-b border-white/[0.05] pb-2">Technical & MVP</h3>
                                    <div className="text-xs text-white/70"><strong>Tech Stack:</strong> {project.settings.ideaDetails?.technicalArchitecture?.frontend || "Frontend"}, {project.settings.ideaDetails?.technicalArchitecture?.backend || "Backend"}, {project.settings.ideaDetails?.technicalArchitecture?.database || "DB"}</div>
                                    <div className="text-xs text-white/70"><strong>MVP Goal:</strong> {project.settings.ideaDetails?.mvpPlan?.mvpGoal || "N/A"}</div>
                                    <div className="text-xs text-white/70"><strong>Est. Time:</strong> {project.settings.ideaDetails?.mvpPlan?.developmentTimeEstimate || "N/A"}</div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <style>{`
                @keyframes float1 { 0%, 100% { transform: translate(0,0) scale(1); } 33% { transform: translate(80px,40px) scale(1.1); } 66% { transform: translate(-40px,60px) scale(.95); } }
                @keyframes float2 { 0%, 100% { transform: translate(0,0) scale(1); } 33% { transform: translate(-60px,-30px) scale(1.05); } 66% { transform: translate(30px,-50px) scale(.9); } }
                @keyframes fadeSlideUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
            `}</style>
        </div>
    );
};

export default IdeaPage;
