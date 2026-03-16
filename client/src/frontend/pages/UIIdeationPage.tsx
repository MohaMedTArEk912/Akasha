import React, { useEffect, useState } from "react";
import { setBuilderActive } from "../stores/projectStore";
import BuilderWorkspace from "../components/features/VisualBuilder/workspace/BuilderWorkspace";
import ArchitectForm from "../components/features/UIIdeation/ArchitectForm";
import PagesList from "../components/features/UIIdeation/PagesList";
import AIDesignCopilotPanel from "../components/features/VisualBuilder/AIDesignCopilotPanel";

import { useProjectStore } from "../hooks/useProjectStore";

type UiDesignTab = "workspace" | "document" | "pages" | "builder";

const UIIdeationPage: React.FC = () => {
    const { project } = useProjectStore();
    const [activeTab, setActiveTab] = useState<UiDesignTab>("workspace");

    useEffect(() => {
        setBuilderActive(activeTab === "builder");
    }, [activeTab]);

    if (!project) return null;

    if (activeTab === "builder") {
        return (
            <div className="h-full w-full overflow-hidden bg-[var(--ide-bg)] animate-in fade-in duration-300">
                <BuilderWorkspace onBack={() => setActiveTab("pages")} />
            </div>
        );
    }

    return (
        <div className="h-full w-full overflow-auto relative page-enter" style={{ background: "#080d12" }}>
            {/* Animated Background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div
                    className="absolute w-[500px] h-[500px] rounded-full opacity-25 blur-[120px]"
                    style={{
                        background: "radial-gradient(circle, #10b981 0%, transparent 70%)",
                        top: "-10%",
                        right: "10%",
                        animation: "float1 20s ease-in-out infinite",
                    }}
                />
                <div
                    className="absolute w-[400px] h-[400px] rounded-full opacity-20 blur-[100px]"
                    style={{
                        background: "radial-gradient(circle, #f59e0b 0%, transparent 70%)",
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
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-amber-500/20 border border-emerald-500/20 flex items-center justify-center">
                                <span className="text-2xl">✨</span>
                            </div>
                            <div>
                                <h1 className="text-2xl font-extrabold text-white tracking-tight">UI Architect</h1>
                                <p className="text-xs text-white/30 uppercase tracking-[0.2em] mt-0.5">{project.name}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-1">
                            <button
                                onClick={() => setActiveTab("document")}
                                className={`h-9 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                                    activeTab === "document"
                                        ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/20"
                                        : "text-white/50 hover:text-white hover:bg-white/10"
                                }`}
                            >
                                Design System
                            </button>
                            <button
                                onClick={() => setActiveTab("workspace")}
                                className={`h-9 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                                    activeTab === "workspace"
                                        ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/20"
                                        : "text-white/50 hover:text-white hover:bg-white/10"
                                }`}
                            >
                                AI Workspace
                            </button>
                            <button
                                onClick={() => setActiveTab("pages")}
                                className={`h-9 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                                    activeTab === "pages"
                                        ? "bg-gradient-to-r from-lime-500 to-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                                        : "text-white/50 hover:text-white hover:bg-white/10"
                                }`}
                            >
                                Pages
                            </button>
                        </div>

                        <button
                            onClick={() => setActiveTab("builder")}
                            className="h-9 px-4 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-xs font-bold hover:from-emerald-400 hover:to-teal-500 transition-colors shadow-lg shadow-emerald-500/20 border border-white/10"
                        >
                            Open Visual Builder
                        </button>
                    </div>
                </div>



                {activeTab === "workspace" && (
                    <div className="flex-1 min-h-0 bg-white/[0.02] border border-white/[0.05] rounded-3xl overflow-hidden" style={{ animation: "fadeSlideUp 0.5s ease-out 0.2s both" }}>
                        <AIDesignCopilotPanel onOpenInspector={() => setActiveTab("builder")} />
                    </div>
                )}

                {activeTab === "document" && (
                    <div className="flex-1 min-h-0 bg-white/[0.02] border border-white/[0.05] rounded-3xl overflow-hidden" style={{ animation: "fadeSlideUp 0.5s ease-out 0.2s both" }}>
                        <ArchitectForm onOpenBuilder={() => setActiveTab("builder")} />
                    </div>
                )}

                {activeTab === "pages" && (
                    <div className="flex-1 min-h-0 bg-white/[0.02] border border-white/[0.05] rounded-3xl overflow-hidden" style={{ animation: "fadeSlideUp 0.5s ease-out 0.2s both" }}>
                        <PagesList onOpenBuilder={() => setActiveTab("builder")} />
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

export default UIIdeationPage;
