/**
 * IdeaPage — View and edit the project idea/description
 */

import React, { useState, useEffect, useMemo } from "react";
import { useProjectStore } from "../hooks/useProjectStore";
import axios from "axios";
import IdeaWorkshop from "./IdeaWorkshop";

const API_BASE = "http://localhost:3001/api";

const IDEA_TAB_BLOCKS = [
    {
        id: "problem",
        label: "Problem",
        content:
            "## Problem\n- What pain point exists?\n- Who is affected?\n- Why current solutions are insufficient?",
    },
    {
        id: "users",
        label: "Users",
        content:
            "## Target Users\n- Primary users:\n- Secondary users:\n- Context and constraints:",
    },
    {
        id: "value",
        label: "Value",
        content:
            "## Value Proposition\n- Core value:\n- Differentiation:\n- Expected outcomes:",
    },
    {
        id: "mvp",
        label: "MVP Scope",
        content:
            "## MVP Scope\n- Must-have features:\n- Nice-to-have features:\n- Out of scope:",
    },
    {
        id: "constraints",
        label: "Constraints",
        content:
            "## Constraints\n- Timeline:\n- Budget/team:\n- Technical/security limits:",
    },
];

const IDEA_QUALITY_CHECKS = [
    { id: "problem", label: "Problem defined", regex: /(problem|pain|issue|challenge)/i },
    { id: "users", label: "Users identified", regex: /(user|audience|customer|persona)/i },
    { id: "value", label: "Value proposition", regex: /(value|benefit|outcome|advantage)/i },
    { id: "scope", label: "Scope included", regex: /(feature|scope|mvp|must-have)/i },
    { id: "constraints", label: "Constraints noted", regex: /(constraint|budget|timeline|risk|limitation)/i },
];

const IdeaPage: React.FC = () => {
    const { project } = useProjectStore();
    const [idea, setIdea] = useState("");
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [activeTab, setActiveTab] = useState<"idea" | "workshop">("idea");

    useEffect(() => {
        if (project) {
            setIdea(project.description || "");
        }
    }, [project]);

    const ideaWordCount = useMemo(() => idea.trim().split(/\s+/).filter(Boolean).length, [idea]);

    const headingMatches = useMemo(() => {
        const matches = Array.from(idea.matchAll(/^##\s+(.+)$/gm));
        return matches.map((match) => match[1]?.trim()).filter(Boolean) as string[];
    }, [idea]);

    const qualityChecks = useMemo(
        () => IDEA_QUALITY_CHECKS.map((check) => ({ ...check, done: check.regex.test(idea) })),
        [idea]
    );

    const ideaHealthScore = useMemo(() => {
        const checkRatio = qualityChecks.length > 0
            ? qualityChecks.filter((check) => check.done).length / qualityChecks.length
            : 0;
        const lengthBonus = ideaWordCount >= 160 ? 0.2 : ideaWordCount >= 80 ? 0.1 : 0;
        return Math.min(100, Math.round((checkRatio + lengthBonus) * 100));
    }, [ideaWordCount, qualityChecks]);

    const extractedHighlights = useMemo(() => {
        const lines = idea
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.startsWith("-") || line.startsWith("*"))
            .map((line) => line.replace(/^[-*]\s*/, "").trim())
            .filter(Boolean);
        return lines.slice(0, 6);
    }, [idea]);

    const handleInsertBlock = (content: string) => {
        setIdea((prev) => {
            const trimmed = prev.trimEnd();
            if (!trimmed) return content;
            return `${trimmed}\n\n${content}`;
        });
        setIsEditing(true);
    };

    const handleSave = async () => {
        if (!project) return;
        setSaving(true);
        try {
            await axios.put(`${API_BASE}/project/${project.id}/idea`, { idea });
            setSaved(true);
            setIsEditing(false);
            setTimeout(() => setSaved(false), 2000);
        } catch (err) {
            console.error("Failed to save idea:", err);
        } finally {
            setSaving(false);
        }
    };

    const handleWorkshopRefined = async (refinedIdea: string) => {
        if (!project) return;
        setIdea(refinedIdea);
        setActiveTab("idea");
        setSaving(true);
        try {
            await axios.put(`${API_BASE}/project/${project.id}/idea`, { idea: refinedIdea });
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (err) {
            console.error("Failed to save refined idea:", err);
        } finally {
            setSaving(false);
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
                                onClick={() => setActiveTab("idea")}
                                className={`h-9 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${activeTab === "idea"
                                    ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/20"
                                    : "text-white/50 hover:text-white hover:bg-white/10"
                                    }`}
                            >
                                Idea
                            </button>
                            <button
                                onClick={() => setActiveTab("workshop")}
                                className={`h-9 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${activeTab === "workshop"
                                    ? "bg-gradient-to-r from-indigo-500 to-cyan-500 text-white shadow-lg shadow-indigo-500/20"
                                    : "text-white/50 hover:text-white hover:bg-white/10"
                                    }`}
                            >
                                AI Workshop
                            </button>
                        </div>
                    </div>
                </div>

                {activeTab === "idea" && (
                    <div
                        className="flex-1 min-h-0 grid gap-4 animate-fade-in xl:grid-cols-[320px,1fr]"
                        style={{ animation: "fadeSlideUp 0.5s ease-out 0.2s both" }}
                    >
                        {/* LEFT COLUMN: Metrics & Info */}
                        <div className="space-y-4">
                            {/* Idea Readiness Score */}
                            <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/8 p-4">
                                <div className="text-[10px] font-black uppercase tracking-widest text-indigo-300">Idea Readiness</div>
                                <div className="mt-2 flex items-end justify-between">
                                    <div className="text-3xl font-black text-white">{ideaHealthScore}%</div>
                                    <div className="text-[11px] text-white/45">{ideaWordCount} words</div>
                                </div>
                                <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-indigo-500 via-cyan-500 to-emerald-500 transition-all duration-300"
                                        style={{ width: `${ideaHealthScore}%` }}
                                    />
                                </div>
                            </div>

                            {/* Quality Checklist */}
                            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                <div className="text-[10px] font-black uppercase tracking-widest text-white/60">Quality Checklist</div>
                                <ul className="mt-3 space-y-2">
                                    {qualityChecks.map((check) => (
                                        <li key={check.id} className="flex items-center gap-2 text-xs">
                                            <span
                                                className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-black ${
                                                    check.done
                                                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                                                        : "bg-white/8 text-white/45 border border-white/15"
                                                }`}
                                            >
                                                {check.done ? "✓" : "•"}
                                            </span>
                                            <span className={check.done ? "text-white/85" : "text-white/45"}>{check.label}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Detected Sections & Highlights */}
                            {!isEditing && idea && (
                                <>
                                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                        <div className="text-[10px] uppercase tracking-widest text-white/60 font-black mb-3">Detected Sections ({headingMatches.length})</div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {headingMatches.length > 0 ? headingMatches.map((heading) => (
                                                <span key={heading} className="px-2 py-1 rounded-lg text-[10px] bg-indigo-500/15 border border-indigo-500/25 text-indigo-200">
                                                    {heading}
                                                </span>
                                            )) : (
                                                <span className="text-[11px] text-white/45">No sections detected.</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                        <div className="text-[10px] uppercase tracking-widest text-white/60 font-black mb-3">Highlights</div>
                                        <ul className="space-y-1.5 text-xs text-white/70">
                                            {extractedHighlights.length > 0 ? extractedHighlights.map((highlight, index) => (
                                                <li key={`highlight-${index}`} className="flex items-start gap-2">
                                                    <span className="text-white/30">•</span> {highlight}
                                                </li>
                                            )) : (
                                                <li className="flex items-start gap-2 text-white/45">
                                                    <span className="text-white/30">•</span> Add bullet points to highlight keys here.
                                                </li>
                                            )}
                                        </ul>
                                    </div>
                                </>
                            )}

                            {/* AI Context Info */}
                            <div className="flex flex-col gap-3 p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl">
                                <div className="flex text-lg mt-0.5">🤖</div>
                                <div>
                                    <p className="text-[11px] font-medium text-indigo-200/50 leading-relaxed">
                                        Your project idea context is fed directly into the floating AI bot. The better you describe it, the smarter your AI will be.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT COLUMN: Idea Editor/Viewer */}
                        <div className="min-h-0 flex flex-col gap-4">
                            {/* Templates Block (If editing or empty) */}
                            {(isEditing || !idea) && (
                                <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                                    <div className="flex items-center justify-between mb-2 px-1">
                                        <span className="text-[10px] font-black text-cyan-300 uppercase tracking-widest">Quick Building Blocks</span>
                                        <button
                                            onClick={() => setActiveTab("workshop")}
                                            className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
                                        >
                                            Open AI Workshop →
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {IDEA_TAB_BLOCKS.map((block) => (
                                            <button
                                                key={block.id}
                                                onClick={() => handleInsertBlock(block.content)}
                                                className="h-8 px-3 rounded-lg text-[11px] font-bold bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-all"
                                            >
                                                + {block.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Central Card */}
                            <div className="flex-1 min-h-0 relative bg-white/[0.04] border border-white/[0.08] rounded-3xl overflow-hidden flex flex-col">
                                {/* Top gradient accent */}
                                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 z-10" />

                                <div className="p-6 md:p-8 flex flex-col h-full mt-1">
                                    {/* Controls */}
                                    <div className="flex items-center justify-between mb-4 flex-shrink-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">
                                                {isEditing ? "Editing Idea" : "Idea Document"}
                                            </span>
                                            {saved && (
                                                <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest animate-fade-in shadow-emerald-400/20 shadow-sm px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                                                    ✓ Saved
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {isEditing ? (
                                                <>
                                                    <button
                                                        onClick={() => {
                                                            setIsEditing(false);
                                                            setIdea(project.description || "");
                                                        }}
                                                        className="px-4 py-2 text-xs font-bold rounded-xl bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition-all"
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        onClick={handleSave}
                                                        disabled={saving}
                                                        className="px-6 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:opacity-90 transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50"
                                                    >
                                                        {saving ? "Saving..." : "Save"}
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    {idea && (
                                                        <>
                                                            <button
                                                                onClick={() => {
                                                                    const blob = new Blob([`# ${project.name} Idea\n\n${idea}`], { type: "text/markdown" });
                                                                    const url = URL.createObjectURL(blob);
                                                                    const a = document.createElement("a");
                                                                    a.href = url;
                                                                    a.download = `${project.name.replace(/\s+/g, "_").toLowerCase()}_idea.md`;
                                                                    document.body.appendChild(a);
                                                                    a.click();
                                                                    document.body.removeChild(a);
                                                                    URL.revokeObjectURL(url);
                                                                }}
                                                                className="px-3 py-2 text-xs font-bold rounded-xl bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all flex items-center gap-2"
                                                                title="Download as Markdown"
                                                            >
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                                </svg>
                                                                Download
                                                            </button>
                                                            <button
                                                                onClick={() => setActiveTab("workshop")}
                                                                className="px-4 py-2 text-xs font-bold rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/20 hover:border-indigo-500/40 transition-all flex items-center gap-2"
                                                            >
                                                                <span className="text-sm">✨</span>
                                                                Improve
                                                            </button>
                                                        </>
                                                    )}
                                                    <button
                                                        onClick={() => setIsEditing(true)}
                                                        className="px-4 py-2 text-xs font-bold rounded-xl bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all flex items-center gap-2"
                                                    >
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                        </svg>
                                                        Edit
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Content Scroll Area */}
                                    <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-2 -mr-2">
                                        {isEditing ? (
                                            <textarea
                                                value={idea}
                                                onChange={(e) => setIdea(e.target.value)}
                                                autoFocus
                                                placeholder="Describe your project idea in detail... What problem does it solve? Who is it for? What are the key features and goals?"
                                                className="w-full h-full min-h-[400px] bg-black/20 border border-white/5 rounded-2xl p-6 text-white/90 text-[15px] leading-[1.8] focus:outline-none focus:border-amber-500/40 focus:ring-2 focus:ring-amber-500/10 transition-all placeholder:text-white/20 resize-none font-medium custom-scrollbar"
                                            />
                                        ) : idea ? (
                                            <div className="text-white/80 text-[15px] leading-[1.8] whitespace-pre-wrap font-medium p-2">
                                                {idea}
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center py-20 text-center h-full">
                                                <span className="text-5xl mb-4 opacity-30">💡</span>
                                                <h3 className="text-lg font-bold text-white/40 mb-2">No idea yet</h3>
                                                <p className="text-sm text-white/20 max-w-sm mb-6">
                                                    Click "Edit" to describe your project. The more detail you provide, the better AI workshop insights you'll get.
                                                </p>
                                                <button
                                                    onClick={() => setIsEditing(true)}
                                                    className="px-6 py-3 text-xs font-bold rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:opacity-90 transition-all shadow-lg shadow-amber-500/20"
                                                >
                                                    Start Writing
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === "workshop" && (
                    <div className="flex-1 min-h-0" style={{ animation: "fadeSlideUp 0.5s ease-out 0.2s both" }}>
                        <IdeaWorkshop
                            projectName={project.name}
                            projectId={project.id}
                            initialIdea={idea}
                            fullScreen
                            onRefined={handleWorkshopRefined}
                            onCancel={() => setActiveTab("idea")}
                        />
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
