/**
 * ProjectDashboard — In-project landing page
 *
 * Rich, animated dashboard with colorful background, floating orbs,
 * greeting, quick actions, feature cards, and project stats.
 */

import React, { useState, useEffect } from "react";
import { useProjectStore } from "../../hooks/useProjectStore";
import { setActivePage, closeProject } from "../../stores/projectStore";
import type { FeaturePage } from "../../stores/projectStore";

/* ─── Helpers ─── */
function getGreeting(): string {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
}

/* ─── Feature Card Definitions ─── */
interface FeatureCard {
    id: FeaturePage;
    label: string;
    description: string;
    icon: string;
    gradient: string;
    iconColor: string;
    glowColor: string;
}

const FEATURES: FeatureCard[] = [
    {
        id: "ui", label: "UI Design",
        description: "Visual drag-and-drop interface builder with live preview",
        icon: "M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z",
        gradient: "from-indigo-600/25 via-purple-600/15 to-blue-600/5",
        iconColor: "text-indigo-400", glowColor: "rgba(99,102,241,0.15)",
    },
    {
        id: "usecases", label: "Use Cases",
        description: "Logic flows and business process workflows",
        icon: "M13 10V3L4 14h7v7l9-11h-7z",
        gradient: "from-amber-600/25 via-orange-600/15 to-yellow-600/5",
        iconColor: "text-amber-400", glowColor: "rgba(245,158,11,0.15)",
    },
    {
        id: "apis", label: "APIs",
        description: "RESTful endpoints, request/response schemas",
        icon: "M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9",
        gradient: "from-emerald-600/25 via-green-600/15 to-teal-600/5",
        iconColor: "text-emerald-400", glowColor: "rgba(16,185,129,0.15)",
    },
    {
        id: "database", label: "Database",
        description: "Entity-Relationship diagrams and data models",
        icon: "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4",
        gradient: "from-cyan-600/25 via-blue-600/15 to-sky-600/5",
        iconColor: "text-cyan-400", glowColor: "rgba(6,182,212,0.15)",
    },
    {
        id: "diagrams", label: "Diagrams",
        description: "Architecture diagrams and system design",
        icon: "M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2",
        gradient: "from-rose-600/25 via-pink-600/15 to-fuchsia-600/5",
        iconColor: "text-rose-400", glowColor: "rgba(244,63,94,0.15)",
    },
    {
        id: "code", label: "Source Code & Git",
        description: "File explorer, code editor, diff viewer, and version control",
        icon: "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4",
        gradient: "from-violet-600/25 via-purple-600/15 to-indigo-600/5",
        iconColor: "text-violet-400", glowColor: "rgba(139,92,246,0.15)",
    },
];

/* ─── Quick Actions ─── */
const QUICK_ACTIONS = [
    { label: "New Page", icon: "M12 4v16m8-8H4", page: "ui" as FeaturePage, color: "text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 border-indigo-500/20" },
    { label: "Write Code", icon: "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4", page: "code" as FeaturePage, color: "text-violet-400 bg-violet-500/10 hover:bg-violet-500/20 border-violet-500/20" },
    { label: "New API", icon: "M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3", page: "apis" as FeaturePage, color: "text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/20" },
    { label: "Add Diagram", icon: "M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6z", page: "diagrams" as FeaturePage, color: "text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/20" },
];

/* ═══════════════════ Component ═══════════════════ */

const ProjectDashboard: React.FC = () => {
    const { project } = useProjectStore();
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const id = setInterval(() => setTime(new Date()), 60_000);
        return () => clearInterval(id);
    }, []);

    const greeting = getGreeting();

    return (
        <div className="h-full w-full overflow-auto relative" style={{ background: "#0a0a0f" }}>

            {/* ── Animated Background ── */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute w-[600px] h-[600px] rounded-full opacity-30 blur-[120px]"
                    style={{ background: "radial-gradient(circle, #6366f1 0%, transparent 70%)", top: "-10%", left: "-5%", animation: "float1 20s ease-in-out infinite" }} />
                <div className="absolute w-[500px] h-[500px] rounded-full opacity-20 blur-[100px]"
                    style={{ background: "radial-gradient(circle, #ec4899 0%, transparent 70%)", top: "20%", right: "-5%", animation: "float2 25s ease-in-out infinite" }} />
                <div className="absolute w-[400px] h-[400px] rounded-full opacity-25 blur-[80px]"
                    style={{ background: "radial-gradient(circle, #06b6d4 0%, transparent 70%)", bottom: "-5%", left: "30%", animation: "float3 18s ease-in-out infinite" }} />
                <div className="absolute w-[350px] h-[350px] rounded-full opacity-15 blur-[90px]"
                    style={{ background: "radial-gradient(circle, #f59e0b 0%, transparent 70%)", bottom: "30%", right: "20%", animation: "float1 22s ease-in-out infinite reverse" }} />
                {/* Grid */}
                <div className="absolute inset-0 opacity-[0.03]"
                    style={{ backgroundImage: `linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)`, backgroundSize: "60px 60px" }} />
                {/* Floating particles */}
                {[...Array(12)].map((_, i) => (
                    <div key={i} className="absolute w-1 h-1 rounded-full bg-white/20"
                        style={{
                            left: `${10 + (i * 7.5) % 80}%`,
                            top: `${15 + (i * 11) % 70}%`,
                            animation: `particle ${8 + i * 2}s ease-in-out infinite ${i * 0.5}s`,
                        }}
                    />
                ))}
            </div>

            {/* ── Content ── */}
            <div className="relative z-10 max-w-6xl mx-auto px-8 py-8">

                {/* ── Header Row ── */}
                <div className="flex items-start justify-between mb-8" style={{ animation: "fadeSlideUp 0.5s ease-out both" }}>
                    <div>
                        <p className="text-xs text-white/30 uppercase tracking-[0.2em] mb-1 font-medium">{greeting}</p>
                        <h1 className="text-3xl font-extrabold text-white tracking-tight">
                            {project?.name || "Project"}
                        </h1>
                        <p className="text-sm text-white/30 mt-2 flex items-center gap-2">
                            <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                    </div>
                    <button
                        onClick={closeProject}
                        className="px-4 py-2 text-xs font-medium rounded-xl bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all duration-300"
                    >
                        ← Back to Projects
                    </button>
                </div>

                {/* ── Quick Actions ── */}
                <div className="mb-8" style={{ animation: "fadeSlideUp 0.5s ease-out 0.15s both" }}>
                    <h2 className="text-[10px] font-black text-white/25 uppercase tracking-[0.2em] mb-3">Quick Actions</h2>
                    <div className="flex gap-2 flex-wrap">
                        {QUICK_ACTIONS.map((action) => (
                            <button
                                key={action.label}
                                onClick={() => setActivePage(action.page)}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-semibold transition-all duration-300 hover:scale-105 ${action.color}`}
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={action.icon} />
                                </svg>
                                {action.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Feature Cards Grid ── */}
                <div className="mb-8">
                    <h2 className="text-[10px] font-black text-white/25 uppercase tracking-[0.2em] mb-3">Features</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {FEATURES.map((feature, i) => (
                            <button
                                key={feature.id}
                                onClick={() => setActivePage(feature.id)}
                                className={`group relative text-left p-6 rounded-2xl border border-white/[0.08] bg-gradient-to-br ${feature.gradient} backdrop-blur-xl overflow-hidden transition-all duration-500 hover:scale-[1.03] hover:border-white/20`}
                                style={{ animation: `fadeSlideUp 0.5s ease-out ${0.3 + i * 0.07}s both` }}
                            >
                                {/* Hover glow */}
                                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl"
                                    style={{ boxShadow: `inset 0 0 60px ${feature.glowColor}, 0 0 40px ${feature.glowColor}` }} />
                                {/* Shimmer */}
                                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
                                    <div className="absolute top-0 left-0 w-full h-[1px]"
                                        style={{ background: `linear-gradient(90deg, transparent, ${feature.glowColor}, transparent)`, animation: "shimmer 2s ease-in-out infinite" }} />
                                </div>
                                {/* Content */}
                                <div className="relative z-10">
                                    <div className={`w-12 h-12 rounded-xl bg-white/[0.06] border border-white/[0.06] flex items-center justify-center mb-4 transition-all duration-500 group-hover:scale-110 group-hover:bg-white/[0.12] ${feature.iconColor}`}>
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d={feature.icon} />
                                        </svg>
                                    </div>
                                    <h3 className="text-[13px] font-bold text-white mb-1.5">{feature.label}</h3>
                                    <p className="text-[11px] text-white/35 leading-relaxed group-hover:text-white/55 transition-colors duration-300">{feature.description}</p>
                                </div>
                                {/* Arrow */}
                                <div className="absolute top-5 right-5 opacity-0 group-hover:opacity-70 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
                                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                    </svg>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Project Stats ── */}
                {project && (
                    <div style={{ animation: "fadeSlideUp 0.5s ease-out 0.8s both" }}>
                        <h2 className="text-[10px] font-black text-white/25 uppercase tracking-[0.2em] mb-3">Project Overview</h2>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <StatCard label="Pages" value={project.pages?.filter(p => !p.archived).length ?? 0} icon="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" color="indigo" />
                            <StatCard label="APIs" value={project.apis?.filter(a => !a.archived).length ?? 0} icon="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3" color="emerald" />
                            <StatCard label="Logic Flows" value={project.logic_flows?.filter(f => !f.archived).length ?? 0} icon="M13 10V3L4 14h7v7l9-11h-7z" color="amber" />
                            <StatCard label="Models" value={project.data_models?.filter(m => !m.archived).length ?? 0} icon="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7" color="cyan" />
                        </div>
                    </div>
                )}
            </div>

            {/* ── Keyframe Animations ── */}
            <style>{`
                @keyframes float1 { 0%, 100% { transform: translate(0,0) scale(1); } 33% { transform: translate(80px,40px) scale(1.1); } 66% { transform: translate(-40px,60px) scale(.95); } }
                @keyframes float2 { 0%, 100% { transform: translate(0,0) scale(1); } 33% { transform: translate(-60px,-30px) scale(1.05); } 66% { transform: translate(30px,-50px) scale(.9); } }
                @keyframes float3 { 0%, 100% { transform: translate(0,0) scale(1); } 33% { transform: translate(50px,-40px) scale(1.15); } 66% { transform: translate(-70px,20px) scale(.95); } }
                @keyframes fadeSlideUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
                @keyframes shimmer { 0% { transform:translateX(-100%); } 100% { transform:translateX(100%); } }
                @keyframes particle { 0%, 100% { transform:translateY(0) scale(1); opacity:.2; } 50% { transform:translateY(-30px) scale(1.5); opacity:.5; } }
                @keyframes pulse-ring { 0% { transform:scale(.8); opacity:.5; } 50% { transform:scale(1.2); opacity:1; } 100% { transform:scale(.8); opacity:.5; } }
            `}</style>
        </div>
    );
};

/* ─── Stats Card with animated accent ─── */
const COLOR_MAP: Record<string, { bg: string; text: string; ring: string }> = {
    indigo: { bg: "bg-indigo-500/10", text: "text-indigo-400", ring: "ring-indigo-500/20" },
    emerald: { bg: "bg-emerald-500/10", text: "text-emerald-400", ring: "ring-emerald-500/20" },
    amber: { bg: "bg-amber-500/10", text: "text-amber-400", ring: "ring-amber-500/20" },
    cyan: { bg: "bg-cyan-500/10", text: "text-cyan-400", ring: "ring-cyan-500/20" },
};

const StatCard: React.FC<{ label: string; value: number; icon: string; color: string }> = ({ label, value, icon, color }) => {
    const c = COLOR_MAP[color] || COLOR_MAP.indigo;
    return (
        <div className={`relative bg-white/[0.04] rounded-xl border border-white/[0.06] p-4 flex items-center gap-3 hover:bg-white/[0.07] transition-all duration-300 hover:border-white/[0.12] group overflow-hidden`}>
            {/* Animated ring behind icon */}
            <div className="relative">
                <div className={`absolute inset-0 rounded-lg ${c.bg} ring-2 ${c.ring}`}
                    style={{ animation: "pulse-ring 3s ease-in-out infinite" }} />
                <div className={`relative w-9 h-9 rounded-lg ${c.bg} flex items-center justify-center`}>
                    <svg className={`w-4 h-4 ${c.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d={icon} />
                    </svg>
                </div>
            </div>
            <div>
                <div className="text-xl font-bold text-white tabular-nums">{value}</div>
                <div className="text-[9px] uppercase tracking-wider text-white/30">{label}</div>
            </div>
        </div>
    );
};

export default ProjectDashboard;
