import React, { useEffect, useState } from "react";
import { setBuilderActive } from "../stores/projectStore";
import BuilderWorkspace from "../components/features/VisualBuilder/workspace/BuilderWorkspace";
import UXRootPlanner, { type UXRootPlannerTab } from "../components/features/VisualBuilder/UIIdeation/UXRootPlanner";

import { useProjectStore } from "../hooks/useProjectStore";

type UiDesignTab = UXRootPlannerTab | "builder";

const UIIdeationPage: React.FC = () => {
    const { project } = useProjectStore();
    const [activeTab, setActiveTab] = useState<UiDesignTab>("product");

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
        <div className="h-full w-full overflow-auto relative page-enter" style={{ background: "var(--ide-bg)", color: "var(--ide-text)" }}>
            {/* Animated Background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div
                    className="absolute w-[500px] h-[500px] rounded-full opacity-10 blur-[120px]"
                    style={{
                        background: "radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)",
                        top: "-10%",
                        right: "10%",
                        animation: "float1 20s ease-in-out infinite",
                    }}
                />
                <div
                    className="absolute w-[400px] h-[400px] rounded-full opacity-10 blur-[100px]"
                    style={{
                        background: "radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)",
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
                            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                                <span className="text-white/40 text-[10px] font-black tracking-widest">ARCH</span>
                            </div>
                            <div>
                                <h1 className="text-2xl font-extrabold text-white tracking-tight">UI Architect</h1>
                                <p className="text-xs text-white/30 uppercase tracking-[0.2em] mt-0.5">{project.name}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-1 backdrop-blur-sm">
                            <button
                                onClick={() => setActiveTab("product")}
                                className={`h-9 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                                    activeTab === "product"
                                        ? "bg-white/10 text-white shadow-lg shadow-white/5"
                                        : "text-white/40 hover:text-white hover:bg-white/5"
                                }`}
                            >
                                Product Definition
                            </button>
                            <button
                                onClick={() => setActiveTab("flows")}
                                className={`h-9 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                                    activeTab === "flows"
                                        ? "bg-white/10 text-white shadow-lg shadow-white/5"
                                        : "text-white/40 hover:text-white hover:bg-white/5"
                                }`}
                            >
                                User Flows
                            </button>
                            <button
                                onClick={() => setActiveTab("pages")}
                                className={`h-9 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                                    activeTab === "pages"
                                        ? "bg-white/10 text-white shadow-lg shadow-white/5"
                                        : "text-white/40 hover:text-white hover:bg-white/5"
                                }`}
                            >
                                Pages
                            </button>
                            <button
                                onClick={() => setActiveTab("specs")}
                                className={`h-9 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                                    activeTab === "specs"
                                        ? "bg-white/10 text-white shadow-lg shadow-white/5"
                                        : "text-white/40 hover:text-white hover:bg-white/5"
                                }`}
                            >
                                Page Specs
                            </button>
                            <button
                                onClick={() => setActiveTab("export")}
                                className={`h-9 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                                    activeTab === "export"
                                        ? "bg-white/10 text-white shadow-lg shadow-white/5"
                                        : "text-white/40 hover:text-white hover:bg-white/5"
                                }`}
                            >
                                Wireframe Export
                            </button>
                        </div>

                        <button
                            onClick={() => setActiveTab("builder")}
                            className="h-9 px-4 rounded-lg bg-white/10 text-white text-xs font-bold hover:bg-white/15 transition-all shadow-lg shadow-white/5 border border-white/10"
                        >
                            Open Visual Builder
                        </button>
                    </div>
                </div>
                <div className="flex-1 min-h-0 bg-white/[0.02] border border-white/[0.06] rounded-3xl overflow-hidden shadow-[var(--ide-shadow)]" style={{ animation: "fadeSlideUp 0.5s ease-out 0.2s both" }}>
                    <UXRootPlanner tab={activeTab} onTabChange={(t) => setActiveTab(t)} onOpenBuilder={() => setActiveTab("builder")} />
                </div>
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
