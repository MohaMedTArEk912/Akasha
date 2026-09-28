/**
 * ReadmeStudioModal Component
 * Interactive studio for generating, editing, previewing, and committing
 * the best comprehensive GitHub README directly to the user's repository.
 */

import React, { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
    Sparkles,
    Copy,
    Check,
    Download,
    GitCommit,
    Eye,
    Code as CodeIcon,
    X,
    ExternalLink,
    FileText,
    RefreshCw,
} from "lucide-react";
import { useProjectStore } from "../../../hooks/useProjectStore";
import { useApi } from "../../../hooks/useApi";
import { useToast } from "../../../context/ToastContext";
import type { GitHubRepo } from "./RepoSelector";
import {
    generateBestReadme,
    type ReadmePreset,
    type ReadmeTone,
} from "../../../utils/readmeGenerator";

interface ReadmeStudioModalProps {
    isOpen: boolean;
    onClose: () => void;
    repo: GitHubRepo;
    activeBranch?: string;
    onCommitted?: () => void;
}

export const ReadmeStudioModal: React.FC<ReadmeStudioModalProps> = ({
    isOpen,
    onClose,
    repo,
    activeBranch = "main",
    onCommitted,
}) => {
    const { project } = useProjectStore();
    const api = useApi();
    const toast = useToast();

    const [preset, setPreset] = useState<ReadmePreset>("showcase");
    const [tone, setTone] = useState<ReadmeTone>("modern");
    const [activeTab, setActiveTab] = useState<"preview" | "editor">("preview");
    const [readmeContent, setReadmeContent] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [isCommitting, setIsCommitting] = useState(false);
    const [copied, setCopied] = useState(false);
    const [commitMessage, setCommitMessage] = useState("docs: add comprehensive project README [Akasha AI]");
    const [commitSuccessUrl, setCommitSuccessUrl] = useState<string | null>(null);

    // Initial synthesis on open or preset change
    useEffect(() => {
        if (isOpen) {
            handleRegenerate(preset, tone);
            setCommitSuccessUrl(null);
        }
    }, [isOpen, repo.full_name, activeBranch]);

    const handleRegenerate = (p: ReadmePreset = preset, t: ReadmeTone = tone) => {
        setIsGenerating(true);
        try {
            const generated = generateBestReadme({
                project,
                repo,
                branch: activeBranch,
                preset: p,
                tone: t,
            });
            setReadmeContent(generated);
        } finally {
            setTimeout(() => setIsGenerating(false), 250);
        }
    };

    const handlePresetChange = (newPreset: ReadmePreset) => {
        setPreset(newPreset);
        handleRegenerate(newPreset, tone);
    };

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(readmeContent);
            setCopied(true);
            toast.showToast("README Markdown copied to clipboard!", "success");
            setTimeout(() => setCopied(false), 2000);
        } catch {
            toast.showToast("Failed to copy to clipboard", "error");
        }
    };

    const handleDownload = () => {
        const blob = new Blob([readmeContent], { type: "text/markdown;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "README.md";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.showToast("README.md file downloaded!", "success");
    };

    const handleCommitToGitHub = async () => {
        if (!repo?.owner?.login || !repo?.name) {
            toast.showToast("No active repository selected", "error");
            return;
        }

        setIsCommitting(true);
        try {
            const res = await api.githubCommitFile(repo.owner.login, repo.name, {
                path: "README.md",
                content: readmeContent,
                message: commitMessage || "docs: add comprehensive project README [Akasha AI]",
                branch: activeBranch,
            });

            if (res.success) {
                const targetUrl = `https://github.com/${repo.owner.login}/${repo.name}/blob/${activeBranch}/README.md`;
                setCommitSuccessUrl(targetUrl);
                toast.showToast("🎉 README.md successfully committed and pushed to GitHub!", "success");
                if (onCommitted) {
                    onCommitted();
                }
            } else {
                toast.showToast(res.error || "Failed to commit to GitHub", "error");
            }
        } catch (err: any) {
            toast.showToast(`Commit failed: ${err.message || "Network error"}`, "error");
        } finally {
            setIsCommitting(false);
        }
    };

    if (!isOpen) return null;

    const wordCount = readmeContent.trim().split(/\s+/).filter(Boolean).length;
    const lineCount = readmeContent.split("\n").length;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in select-none">
            <div className="relative w-full max-w-5xl h-[90vh] flex flex-col rounded-2xl bg-[#090d16]/95 dark:bg-[#07090e]/95 border border-cyan-500/30 shadow-[0_20px_70px_rgba(0,0,0,0.8)] overflow-hidden">
                {/* Background Specular Highlights */}
                <div className="absolute top-0 right-0 left-0 h-32 bg-gradient-to-b from-cyan-500/10 via-blue-500/5 to-transparent pointer-events-none" />
                <div className="absolute top-0 right-0 bottom-0 w-[1px] bg-gradient-to-b from-cyan-400/40 via-blue-500/20 to-transparent pointer-events-none" />

                {/* ── Header ── */}
                <div className="h-16 px-6 flex items-center justify-between border-b border-white/[0.08] relative z-10 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-400/40 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.3)]">
                            <Sparkles className="w-5 h-5 text-cyan-300" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-sm font-bold text-white tracking-tight">
                                    AI README Studio
                                </h2>
                                <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 uppercase">
                                    PRODUCTION GRADE
                                </span>
                            </div>
                            <div className="text-[11px] text-neutral-400 font-mono flex items-center gap-1.5 mt-0.5">
                                <span>Target:</span>
                                <span className="text-cyan-300 font-bold">{repo.owner.login}/{repo.name}</span>
                                <span>•</span>
                                <span className="text-neutral-300">branch: {activeBranch}</span>
                            </div>
                        </div>
                    </div>

                    {/* View Controls & Close */}
                    <div className="flex items-center gap-2.5">
                        {/* Tab Toggle */}
                        <div className="flex items-center p-0.5 rounded-lg bg-black/40 border border-white/10 font-mono text-xs">
                            <button
                                type="button"
                                onClick={() => setActiveTab("preview")}
                                className={`px-3 py-1 rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                                    activeTab === "preview"
                                        ? "bg-cyan-500/20 text-cyan-200 border border-cyan-400/30 font-bold shadow-xs"
                                        : "text-neutral-400 hover:text-white"
                                }`}
                            >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Preview</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab("editor")}
                                className={`px-3 py-1 rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                                    activeTab === "editor"
                                        ? "bg-cyan-500/20 text-cyan-200 border border-cyan-400/30 font-bold shadow-xs"
                                        : "text-neutral-400 hover:text-white"
                                }`}
                            >
                                <CodeIcon className="w-3.5 h-3.5" />
                                <span>Edit Markdown</span>
                            </button>
                        </div>

                        {/* Close button */}
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* ── Toolbar: Presets & Controls ── */}
                <div className="px-6 py-2.5 bg-black/30 border-b border-white/[0.06] flex flex-wrap items-center justify-between gap-3 relative z-10 shrink-0">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold tracking-wider text-neutral-400 uppercase">
                            Preset:
                        </span>
                        {(["showcase", "minimal", "enterprise"] as const).map((p) => (
                            <button
                                key={p}
                                type="button"
                                onClick={() => handlePresetChange(p)}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold tracking-wide uppercase transition-all cursor-pointer ${
                                    preset === p
                                        ? "bg-cyan-500/25 border border-cyan-400/50 text-cyan-200 shadow-[0_0_12px_rgba(6,182,212,0.25)]"
                                        : "bg-white/[0.03] border border-white/[0.08] text-neutral-400 hover:text-white hover:bg-white/[0.06]"
                                }`}
                            >
                                {p === "showcase" ? "Full Showcase" : p === "minimal" ? "Minimalist Dev" : "Enterprise Spec"}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-mono font-bold tracking-wider text-neutral-400 uppercase">
                                Tone:
                            </span>
                            {(["modern", "technical", "startup"] as const).map((t) => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => {
                                        setTone(t);
                                        handleRegenerate(preset, t);
                                    }}
                                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase transition-all cursor-pointer ${
                                        tone === t
                                            ? "bg-cyan-500/20 text-cyan-200 border border-cyan-400/40"
                                            : "text-neutral-500 hover:text-neutral-300"
                                    }`}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>

                        <button
                            type="button"
                            onClick={() => handleRegenerate(preset, tone)}
                            disabled={isGenerating}
                            className="px-3 py-1 rounded-lg bg-black/40 hover:bg-white/[0.08] border border-white/10 text-neutral-300 hover:text-white text-[10px] font-mono font-bold uppercase transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                            <RefreshCw className={`w-3 h-3 ${isGenerating ? "animate-spin text-cyan-400" : ""}`} />
                            <span>{isGenerating ? "Synthesizing..." : "Regenerate"}</span>
                        </button>
                    </div>
                </div>

                {/* ── Main Content Area: Preview or Code Editor ── */}
                <div className="flex-1 overflow-hidden relative">
                    {activeTab === "preview" ? (
                        <div className="h-full w-full overflow-y-auto p-6 sm:p-10 custom-scrollbar select-text bg-[#070a12]/60">
                            <div className="max-w-4xl mx-auto prose prose-invert prose-cyan prose-pre:bg-[#0c101d] prose-pre:border prose-pre:border-white/10 prose-headings:font-bold prose-a:text-cyan-400 prose-table:border prose-table:border-white/10 prose-th:bg-white/[0.04] prose-th:px-3 prose-th:py-2 prose-td:px-3 prose-td:py-2 prose-td:border-t prose-td:border-white/[0.08]">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {readmeContent}
                                </ReactMarkdown>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full w-full flex flex-col p-4 bg-[#05070d]">
                            <div className="flex items-center justify-between text-[10px] font-mono text-neutral-400 pb-2 border-b border-white/[0.06] mb-2">
                                <span>Markdown Source Editor • {lineCount} lines</span>
                                <span>Raw Markdown</span>
                            </div>
                            <textarea
                                value={readmeContent}
                                onChange={(e) => setReadmeContent(e.target.value)}
                                spellCheck={false}
                                className="flex-1 w-full p-4 rounded-xl bg-[#090d16] border border-white/10 font-mono text-xs text-neutral-200 focus:outline-none focus:border-cyan-500/50 resize-none leading-relaxed custom-scrollbar select-text"
                            />
                        </div>
                    )}
                </div>

                {/* ── Commit Success Banner ── */}
                {commitSuccessUrl && (
                    <div className="px-6 py-2.5 bg-emerald-500/15 border-t border-emerald-500/30 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
                            <Check className="w-4 h-4 text-emerald-400" />
                            <span>README.md is live on GitHub!</span>
                        </div>
                        <a
                            href={commitSuccessUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 text-xs font-bold font-mono transition-all flex items-center gap-1.5"
                        >
                            <span>View on GitHub</span>
                            <ExternalLink className="w-3 h-3" />
                        </a>
                    </div>
                )}

                {/* ── Footer Action Bar ── */}
                <div className="h-16 px-6 bg-black/40 border-t border-white/[0.08] flex items-center justify-between gap-4 relative z-10 shrink-0">
                    {/* Stats */}
                    <div className="hidden sm:flex items-center gap-4 text-xs font-mono text-neutral-400">
                        <span className="flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-cyan-400" />
                            <span>~{wordCount.toLocaleString()} words</span>
                        </span>
                        <span>•</span>
                        <span className="text-neutral-500">Mermaid topology & tables ready</span>
                    </div>

                    {/* Commit Message & Actions */}
                    <div className="flex items-center gap-2.5 ml-auto">
                        <div className="hidden lg:flex items-center">
                            <input
                                type="text"
                                value={commitMessage}
                                onChange={(e) => setCommitMessage(e.target.value)}
                                placeholder="Commit message..."
                                className="h-9 px-3 w-60 rounded-xl bg-black/40 border border-white/10 text-xs font-mono text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:border-cyan-500/50"
                            />
                        </div>

                        <button
                            type="button"
                            onClick={handleCopy}
                            className="h-9 px-3.5 rounded-xl border border-white/10 hover:border-white/20 bg-white/[0.03] hover:bg-white/[0.07] text-neutral-200 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-neutral-400" />}
                            <span>{copied ? "Copied!" : "Copy"}</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleDownload}
                            className="h-9 px-3.5 rounded-xl border border-white/10 hover:border-white/20 bg-white/[0.03] hover:bg-white/[0.07] text-neutral-200 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                            <Download className="w-3.5 h-3.5 text-neutral-400" />
                            <span>Download .md</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleCommitToGitHub}
                            disabled={isCommitting || !readmeContent}
                            className="h-9 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-black font-bold text-xs shadow-[0_0_20px_rgba(16,185,129,0.35)] transition-all flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                        >
                            <GitCommit className={`w-4 h-4 ${isCommitting ? "animate-spin" : ""}`} />
                            <span>{isCommitting ? "Pushing to GitHub..." : `Commit to ${activeBranch}`}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReadmeStudioModal;
