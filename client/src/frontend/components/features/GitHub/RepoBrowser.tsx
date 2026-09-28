/**
 * RepoBrowser — File browser + commit history for a selected GitHub repo
 *
 * Two-panel layout:
 * - Left sidebar: file tree, branch selector
 * - Right panel: file content viewer or commit timeline
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useApi } from "../../../hooks/useApi";
import type { GitHubRepo } from "./RepoSelector";
import { Sparkles } from "lucide-react";
import ReadmeStudioModal from "./ReadmeStudioModal";

interface FileItem {
    name: string;
    path: string;
    type: "file" | "dir";
    size: number;
    sha: string;
    download_url: string | null;
}

interface CommitItem {
    sha: string;
    commit: {
        message: string;
        author: { name: string; date: string };
    };
    author: { login: string; avatar_url: string } | null;
}

interface BranchItem {
    name: string;
    protected: boolean;
}

interface RepoBrowserProps {
    repo: GitHubRepo;
    connectedRepos: GitHubRepo[];
    onRepoSwitch: (repo: GitHubRepo) => void;
    onSettings: () => void;
}

/* ── File icon helper ───────────────────────────────── */
function getFileColor(name: string): string {
    const ext = name.split(".").pop()?.toLowerCase();
    const map: Record<string, string> = {
        ts: "text-blue-400", tsx: "text-blue-400",
        js: "text-yellow-400", jsx: "text-yellow-400",
        py: "text-green-400", rb: "text-red-400",
        rs: "text-orange-400", go: "text-cyan-400",
        html: "text-red-300", css: "text-purple-400",
        json: "text-green-300", md: "text-white/50",
        yaml: "text-pink-300", yml: "text-pink-300",
        toml: "text-gray-400", lock: "text-gray-500",
    };
    return map[ext || ""] || "text-white/40";
}

function timeAgo(dateStr: string): string {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    return `${months}mo ago`;
}

const RepoBrowser: React.FC<RepoBrowserProps> = ({ repo, connectedRepos, onRepoSwitch, onSettings }) => {
    const api = useApi();
    const apiRef = useRef(api);
    apiRef.current = api;

    const [activeTab, setActiveTab] = useState<"files" | "commits">("files");
    const [currentPath, setCurrentPath] = useState("");
    const [files, setFiles] = useState<FileItem[]>([]);
    const [commits, setCommits] = useState<CommitItem[]>([]);
    const [branches, setBranches] = useState<BranchItem[]>([]);
    const [activeBranch, setActiveBranch] = useState(repo.default_branch);
    const [filesLoading, setFilesLoading] = useState(true);
    const [commitsLoading, setCommitsLoading] = useState(false);
    const [branchDropOpen, setBranchDropOpen] = useState(false);
    const [repoDropOpen, setRepoDropOpen] = useState(false);

    // Selected file content
    const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
    const [fileContent, setFileContent] = useState<string | null>(null);
    const [fileLoading, setFileLoading] = useState(false);

    // AI README Studio modal
    const [readmeModalOpen, setReadmeModalOpen] = useState(false);

    /* ── Load file tree ─────────────────────────────── */
    const loadFiles = useCallback(async (path: string = "", branch: string = activeBranch) => {
        setFilesLoading(true);
        try {
            const data = await apiRef.current.githubRepoContents(repo.owner.login, repo.name, path, branch);
            const items = (Array.isArray(data) ? data : [data]) as FileItem[];
            // Sort: dirs first, then files alphabetically
            items.sort((a, b) => {
                if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
                return a.name.localeCompare(b.name);
            });
            setFiles(items);
        } catch {
            setFiles([]);
        } finally {
            setFilesLoading(false);
        }
    }, [repo, activeBranch]);

    /* ── Load commits ───────────────────────────────── */
    const loadCommits = useCallback(async (branch: string = activeBranch) => {
        setCommitsLoading(true);
        try {
            const data = await apiRef.current.githubRepoCommits(repo.owner.login, repo.name, branch);
            setCommits(data);
        } catch {
            setCommits([]);
        } finally {
            setCommitsLoading(false);
        }
    }, [repo, activeBranch]);

    /* ── Load branches ──────────────────────────────── */
    useEffect(() => {
        (async () => {
            try {
                const data = await apiRef.current.githubRepoBranches(repo.owner.login, repo.name);
                setBranches(data);
            } catch {
                setBranches([]);
            }
        })();
    }, [repo]);

    /* ── Initial load ───────────────────────────────── */
    useEffect(() => {
        loadFiles("", activeBranch);
        loadCommits(activeBranch);
    }, [activeBranch, loadFiles, loadCommits]);

    useEffect(() => {
        setActiveBranch(repo.default_branch || "main");
        setCurrentPath("");
        setSelectedFile(null);
        setFileContent(null);
        setActiveTab("files");
        setBranchDropOpen(false);
        setRepoDropOpen(false);
    }, [repo]);

    /* ── Auto-refresh (Silent polling) ──────────────── */
    useEffect(() => {
        const interval = setInterval(() => {
            // Silently poll commits
            apiRef.current.githubRepoCommits(repo.owner.login, repo.name, activeBranch)
                .then(newCommits => {
                    setCommits(prev => {
                        // Simple check to avoid unnecessary state updates if latest commit matches
                        if (prev.length > 0 && newCommits.length > 0 && prev[0].sha === newCommits[0].sha) {
                            return prev;
                        }
                        return newCommits;
                    });
                }).catch(() => {});

            // Silently poll file tree
            apiRef.current.githubRepoContents(repo.owner.login, repo.name, currentPath, activeBranch)
                .then(data => {
                    const items = (Array.isArray(data) ? data : [data]) as FileItem[];
                    items.sort((a, b) => {
                        if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
                        return a.name.localeCompare(b.name);
                    });
                    setFiles(items);
                }).catch(() => {});
                
            // Silently refresh branches
            apiRef.current.githubRepoBranches(repo.owner.login, repo.name)
                .then(newBranches => setBranches(newBranches))
                .catch(() => {});
                
        }, 12000); // Poll every 12 seconds
        
        return () => clearInterval(interval);
    }, [repo, activeBranch, currentPath]);

    /* ── Navigate into directory ────────────────────── */
    const navigateToDir = (path: string) => {
        setCurrentPath(path);
        setSelectedFile(null);
        setFileContent(null);
        loadFiles(path);
    };

    const navigateUp = () => {
        const parts = currentPath.split("/").filter(Boolean);
        parts.pop();
        const newPath = parts.join("/");
        navigateToDir(newPath);
    };

    /* ── Open file ──────────────────────────────────── */
    const openFile = async (file: FileItem) => {
        setSelectedFile(file);
        setFileLoading(true);
        try {
            if (file.download_url) {
                const res = await fetch(file.download_url);
                const text = await res.text();
                setFileContent(text);
            } else {
                setFileContent("(Binary or large file — cannot preview)");
            }
        } catch {
            setFileContent("(Failed to load file content)");
        } finally {
            setFileLoading(false);
        }
    };

    /* ── Breadcrumb ─────────────────────────────────── */
    const pathParts = currentPath.split("/").filter(Boolean);

    return (
        <div className="h-full w-full flex flex-col overflow-hidden">
            {/* Top bar */}
            <div className="h-12 px-4 flex items-center gap-3 border-b border-black/[0.08] dark:border-white/[0.06] flex-shrink-0 bg-neutral-100/50 dark:bg-white/[0.01]">
                {/* Repo info */}
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 uppercase">
                        GH
                    </span>
                    <span className="text-xs text-neutral-500 dark:text-white/40 font-mono">{repo.owner.login}</span>
                    <span className="text-neutral-400 dark:text-white/20">/</span>
                    <div className="relative min-w-0">
                        <button
                            onClick={() => setRepoDropOpen(!repoDropOpen)}
                            className={`text-sm font-bold truncate flex items-center gap-1.5 transition-colors ${connectedRepos.length > 1 ? "text-neutral-950 dark:text-white hover:text-emerald-500" : "text-neutral-950 dark:text-white"}`}
                            title={connectedRepos.length > 1 ? "Switch repository" : repo.full_name}
                        >
                            <span className="truncate max-w-[220px]">{repo.name}</span>
                            {connectedRepos.length > 1 && (
                                <span className="text-[9px] font-mono text-neutral-400">▼</span>
                            )}
                        </button>

                        {repoDropOpen && connectedRepos.length > 1 && (
                            <div className="absolute left-0 top-8 w-72 bg-white dark:bg-[#181820] border border-black/10 dark:border-white/[0.1] rounded-xl shadow-2xl z-50 py-1 max-h-64 overflow-y-auto">
                                {connectedRepos.map(r => (
                                    <button
                                        key={r.full_name}
                                        onClick={() => {
                                            setRepoDropOpen(false);
                                            if (r.full_name !== repo.full_name) {
                                                onRepoSwitch(r);
                                            }
                                        }}
                                        className={`w-full text-left px-3 py-2 hover:bg-black/5 dark:hover:bg-white/[0.06] transition-colors ${
                                            r.full_name === repo.full_name ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-neutral-700 dark:text-white/70"
                                        }`}
                                    >
                                        <div className="text-[11px] font-semibold truncate font-mono">{r.name}</div>
                                        <div className="text-[10px] text-neutral-400 dark:text-white/35 truncate font-mono">{r.full_name}</div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Refresh button */}
                <button
                    onClick={() => {
                        loadFiles(currentPath, activeBranch);
                        loadCommits(activeBranch);
                        // Also refresh branches just in case
                        apiRef.current.githubRepoBranches(repo.owner.login, repo.name).then(setBranches).catch(() => setBranches([]));
                    }}
                    title="Refresh Repo"
                    className="h-7 px-2.5 rounded-lg border border-black/10 dark:border-white/[0.08] bg-neutral-200/60 dark:bg-white/[0.03] text-[10px] font-bold font-mono uppercase text-neutral-700 dark:text-white/60 hover:text-neutral-950 dark:hover:text-white hover:bg-neutral-300 dark:hover:bg-white/[0.08] transition-all ml-2"
                >
                    REFRESH
                </button>

                {/* Branch selector */}
                <div className="relative">
                    <button
                        onClick={() => setBranchDropOpen(!branchDropOpen)}
                        className="h-7 px-2.5 rounded-lg border border-black/10 dark:border-white/[0.08] bg-neutral-200/60 dark:bg-white/[0.03] text-[10px] font-bold font-mono uppercase text-neutral-700 dark:text-white/60 hover:text-neutral-950 dark:hover:text-white transition-all flex items-center gap-1.5"
                    >
                        <span>BRANCH: {activeBranch}</span>
                        <span className="text-[8px]">▼</span>
                    </button>

                    {branchDropOpen && (
                        <div className="absolute right-0 top-9 w-48 bg-white dark:bg-[#181820] border border-black/10 dark:border-white/[0.1] rounded-xl shadow-2xl z-50 py-1 max-h-60 overflow-y-auto">
                            {branches.map(b => (
                                <button
                                    key={b.name}
                                    onClick={() => {
                                        setActiveBranch(b.name);
                                        setCurrentPath("");
                                        setSelectedFile(null);
                                        setFileContent(null);
                                        setBranchDropOpen(false);
                                    }}
                                    className={`w-full text-left px-3 py-1.5 text-xs font-mono hover:bg-black/5 dark:hover:bg-white/[0.06] transition-colors flex items-center gap-2 ${
                                        b.name === activeBranch ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-neutral-600 dark:text-white/60"
                                    }`}
                                >
                                    {b.name === activeBranch && (
                                        <span className="text-emerald-600 dark:text-emerald-400">✓</span>
                                    )}
                                    {b.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Tabs */}
                <div className="flex items-center rounded-lg border border-black/10 dark:border-white/[0.06] overflow-hidden ml-2 font-mono">
                    {(["files", "commits"] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`h-7 px-3 text-[10px] font-bold uppercase tracking-wider transition-all ${
                                activeTab === tab
                                    ? "bg-neutral-950 text-white dark:bg-white/[0.15] dark:text-white"
                                    : "text-neutral-500 dark:text-white/30 hover:text-neutral-950 dark:hover:text-white/60"
                            }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* AI README Studio Button */}
                <button
                    onClick={() => setReadmeModalOpen(true)}
                    title="Generate, preview, and commit the best GitHub README with AI"
                    className="h-7 px-3 rounded-lg border border-emerald-500/40 bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-cyan-500/15 hover:from-emerald-500/25 hover:to-cyan-500/25 text-emerald-300 hover:text-white text-[10px] font-bold font-mono uppercase transition-all flex items-center gap-1.5 shadow-[0_0_12px_rgba(16,185,129,0.2)] ml-2 cursor-pointer active:scale-95"
                >
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                    <span>AI README</span>
                </button>

                {/* Settings / Disconnect */}
                <div className="w-[1px] h-4 bg-black/10 dark:bg-white/[0.06] ml-2" />
                <button
                    onClick={onSettings}
                    title="Repository Settings"
                    className="h-7 px-2.5 ml-1 rounded-lg border border-black/10 dark:border-white/[0.08] bg-neutral-200/60 dark:bg-white/[0.03] text-[10px] font-bold font-mono uppercase text-neutral-700 dark:text-white/40 hover:text-neutral-950 dark:hover:text-white transition-colors"
                >
                    CONFIG
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 flex overflow-hidden">
                {activeTab === "files" ? (
                    <>
                        {/* File list */}
                        <div className={`${selectedFile ? "w-72" : "flex-1"} border-r border-white/[0.04] flex flex-col overflow-hidden transition-all`}>
                            {/* Breadcrumb */}
                            <div className="h-8 px-3 flex items-center gap-1 border-b border-white/[0.04] flex-shrink-0 overflow-x-auto">
                                <button onClick={() => navigateToDir("")} className="text-[10px] text-white/40 hover:text-white transition-colors font-mono">
                                    {repo.name}
                                </button>
                                {pathParts.map((part, i) => (
                                    <React.Fragment key={i}>
                                        <span className="text-white/15 text-[10px]">/</span>
                                        <button
                                            onClick={() => navigateToDir(pathParts.slice(0, i + 1).join("/"))}
                                            className="text-[10px] text-white/40 hover:text-white transition-colors font-mono"
                                        >
                                            {part}
                                        </button>
                                    </React.Fragment>
                                ))}
                            </div>

                            {/* File list */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                {/* No README banner prompt if in root directory */}
                                {!filesLoading && currentPath === "" && !files.some(f => f.name.toLowerCase() === "readme.md") && (
                                    <div className="m-2.5 p-3 rounded-xl bg-gradient-to-r from-emerald-500/10 via-cyan-500/5 to-transparent border border-emerald-500/30 flex flex-col gap-2 shadow-xs">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="text-base">📄</span>
                                                <span className="text-[11px] font-bold text-emerald-300">No README.md found</span>
                                            </div>
                                            <button
                                                onClick={() => setReadmeModalOpen(true)}
                                                className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-400/40 text-[9px] font-bold font-mono uppercase transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                                            >
                                                <Sparkles className="w-3 h-3 text-emerald-300" />
                                                <span>Create Best README</span>
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-neutral-400 leading-relaxed">
                                            Synthesize a comprehensive, production-ready README with live architecture diagrams, schema models, and REST endpoints.
                                        </p>
                                    </div>
                                )}

                                {filesLoading ? (
                                    <div className="flex items-center justify-center h-32">
                                        <div className="w-5 h-5 border-2 border-white/10 border-t-white/60 rounded-full animate-spin" />
                                    </div>
                                ) : (
                                    <>
                                        {/* Up directory */}
                                        {currentPath && (
                                            <button
                                                onClick={navigateUp}
                                                className="w-full text-left px-3 py-1.5 flex items-center gap-2 text-[11px] font-mono text-neutral-500 dark:text-white/40 hover:bg-black/5 dark:hover:bg-white/[0.04] transition-colors border-b border-black/[0.04] dark:border-white/[0.03]"
                                            >
                                                <span className="font-bold">.. [UP]</span>
                                            </button>
                                        )}
                                        {files.map(file => (
                                            <button
                                                key={file.sha}
                                                onClick={() => file.type === "dir" ? navigateToDir(file.path) : openFile(file)}
                                                className={`w-full text-left px-3 py-1.5 flex items-center gap-2 text-[11px] font-mono hover:bg-black/5 dark:hover:bg-white/[0.04] transition-colors border-b border-black/[0.03] dark:border-white/[0.02] ${
                                                    selectedFile?.sha === file.sha ? "bg-black/5 dark:bg-white/[0.06]" : ""
                                                }`}
                                            >
                                                {file.type === "dir" ? (
                                                    <span className="font-mono text-[9px] font-bold text-blue-600 dark:text-blue-400 px-1 py-0.2 rounded bg-blue-500/10">
                                                        DIR
                                                    </span>
                                                ) : (
                                                    <span className={`font-mono text-[9px] font-bold ${getFileColor(file.name)} px-1 py-0.2 rounded bg-neutral-200/60 dark:bg-white/[0.06]`}>
                                                        FILE
                                                    </span>
                                                )}
                                                <span className={`truncate ${file.type === "dir" ? "text-neutral-900 dark:text-white/80 font-bold" : "text-neutral-700 dark:text-white/60"}`}>
                                                    {file.name}
                                                </span>
                                                {file.type === "file" && file.size > 0 && (
                                                    <span className="ml-auto text-[9px] text-neutral-400 dark:text-white/20 flex-shrink-0">
                                                        {file.size > 1024 ? `${(file.size / 1024).toFixed(1)}kb` : `${file.size}b`}
                                                    </span>
                                                )}
                                            </button>
                                        ))}
                                    </>
                                )}
                            </div>
                        </div>

                        {/* File content viewer */}
                        {selectedFile && (
                            <div className="flex-1 flex flex-col overflow-hidden animate-fade-in">
                                {/* File header */}
                                <div className="h-9 px-4 flex items-center justify-between border-b border-black/[0.06] dark:border-white/[0.04] flex-shrink-0 bg-neutral-100/50 dark:bg-white/[0.01]">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className={`font-mono text-[9px] font-bold ${getFileColor(selectedFile.name)} px-1 py-0.2 rounded bg-neutral-200/60 dark:bg-white/[0.06]`}>
                                            FILE
                                        </span>
                                        <span className="text-[11px] font-semibold text-neutral-900 dark:text-white/80 truncate font-mono">{selectedFile.name}</span>
                                        <span className="text-[9px] text-neutral-400 dark:text-white/25 font-mono">{selectedFile.path}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {selectedFile.name.toLowerCase() === "readme.md" && (
                                            <button
                                                onClick={() => setReadmeModalOpen(true)}
                                                className="px-2.5 py-0.5 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-400/30 text-[10px] font-mono font-bold flex items-center gap-1 transition-all cursor-pointer"
                                                title="Upgrade with AI README Studio"
                                            >
                                                <Sparkles className="w-3 h-3 text-emerald-400" />
                                                <span>Upgrade with AI</span>
                                            </button>
                                        )}
                                        <button
                                            onClick={() => { setSelectedFile(null); setFileContent(null); }}
                                            className="font-mono text-xs px-2 py-0.5 rounded text-neutral-400 hover:text-neutral-950 dark:hover:text-white transition-colors"
                                            title="Close"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="flex-1 overflow-auto custom-scrollbar bg-black/30">
                                    {fileLoading ? (
                                        <div className="flex items-center justify-center h-32">
                                            <div className="w-5 h-5 border-2 border-white/10 border-t-white/60 rounded-full animate-spin" />
                                        </div>
                                    ) : (
                                        <pre className="p-4 text-[11px] leading-relaxed font-mono text-white/70 whitespace-pre-wrap break-words">
                                            {fileContent}
                                        </pre>
                                    )}
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    /* Commits timeline */
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                        {commitsLoading ? (
                            <div className="flex items-center justify-center h-32">
                                <div className="w-5 h-5 border-2 border-white/10 border-t-white/60 rounded-full animate-spin" />
                            </div>
                        ) : commits.length === 0 ? (
                            <div className="text-center py-16 text-sm text-white/40">No commits found</div>
                        ) : (
                            <div className="max-w-3xl mx-auto space-y-1">
                                {commits.map((c, i) => (
                                    <div key={c.sha} className="flex gap-3 group">
                                        {/* Timeline */}
                                        <div className="flex flex-col items-center flex-shrink-0 pt-1">
                                            <div className={`w-2.5 h-2.5 rounded-full border-2 ${
                                                i === 0
                                                    ? "border-emerald-400 bg-emerald-400"
                                                    : "border-white/20 bg-transparent"
                                            }`} />
                                            {i < commits.length - 1 && (
                                                <div className="w-px flex-1 bg-white/[0.06] mt-1" />
                                            )}
                                        </div>

                                        {/* Commit info */}
                                        <div className="pb-4 min-w-0 flex-1">
                                            <p className="text-xs text-white/80 leading-snug font-medium">
                                                {c.commit.message.split("\n")[0]}
                                            </p>
                                            <div className="flex items-center gap-2 mt-1.5">
                                                {c.author && (
                                                    <img
                                                        src={c.author.avatar_url}
                                                        alt={c.author.login}
                                                        className="w-4 h-4 rounded-full"
                                                    />
                                                )}
                                                <span className="text-[10px] text-white/40">
                                                    {c.author?.login || c.commit.author.name}
                                                </span>
                                                <span className="text-[10px] font-mono text-indigo-400/60">
                                                    {c.sha.slice(0, 7)}
                                                </span>
                                                <span className="text-[10px] text-white/25">
                                                    {timeAgo(c.commit.author.date)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* AI README Studio Modal */}
            <ReadmeStudioModal
                isOpen={readmeModalOpen}
                onClose={() => setReadmeModalOpen(false)}
                repo={repo}
                activeBranch={activeBranch}
                onCommitted={() => {
                    loadFiles(currentPath, activeBranch);
                    loadCommits(activeBranch);
                }}
            />
        </div>
    );
};

export default RepoBrowser;
