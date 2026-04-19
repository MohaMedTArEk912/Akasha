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
            <div className="h-12 px-4 flex items-center gap-3 border-b border-white/[0.06] flex-shrink-0 bg-white/[0.01]">
                {/* Repo info */}
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    <svg className="w-4 h-4 text-white/30 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                    </svg>
                    <span className="text-xs text-white/40">{repo.owner.login}</span>
                    <span className="text-white/20">/</span>
                    <div className="relative min-w-0">
                        <button
                            onClick={() => setRepoDropOpen(!repoDropOpen)}
                            className={`text-sm font-bold truncate flex items-center gap-1.5 transition-colors ${connectedRepos.length > 1 ? "text-white hover:text-emerald-300" : "text-white"}`}
                            title={connectedRepos.length > 1 ? "Switch repository" : repo.full_name}
                        >
                            <span className="truncate max-w-[220px]">{repo.name}</span>
                            {connectedRepos.length > 1 && (
                                <svg className="w-3 h-3 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                </svg>
                            )}
                        </button>

                        {repoDropOpen && connectedRepos.length > 1 && (
                            <div className="absolute left-0 top-8 w-72 bg-[#181820] border border-white/[0.1] rounded-xl shadow-2xl z-50 py-1 max-h-64 overflow-y-auto">
                                {connectedRepos.map(r => (
                                    <button
                                        key={r.full_name}
                                        onClick={() => {
                                            setRepoDropOpen(false);
                                            if (r.full_name !== repo.full_name) {
                                                onRepoSwitch(r);
                                            }
                                        }}
                                        className={`w-full text-left px-3 py-2 hover:bg-white/[0.06] transition-colors ${
                                            r.full_name === repo.full_name ? "text-emerald-400" : "text-white/70"
                                        }`}
                                    >
                                        <div className="text-[11px] font-semibold truncate">{r.name}</div>
                                        <div className="text-[10px] text-white/35 truncate">{r.full_name}</div>
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
                    className="h-7 px-3 rounded-lg border border-white/[0.08] bg-white/[0.03] text-[11px] font-semibold text-white/60 hover:text-white hover:border-white/20 transition-all flex items-center gap-1.5 ml-2"
                >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh
                </button>

                {/* Branch selector */}
                <div className="relative">
                    <button
                        onClick={() => setBranchDropOpen(!branchDropOpen)}
                        className="h-7 px-3 rounded-lg border border-white/[0.08] bg-white/[0.03] text-[11px] font-semibold text-white/60 hover:text-white hover:border-white/20 transition-all flex items-center gap-2"
                    >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                        </svg>
                        {activeBranch}
                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>

                    {branchDropOpen && (
                        <div className="absolute right-0 top-9 w-48 bg-[#181820] border border-white/[0.1] rounded-xl shadow-2xl z-50 py-1 max-h-60 overflow-y-auto">
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
                                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-white/[0.06] transition-colors flex items-center gap-2 ${
                                        b.name === activeBranch ? "text-emerald-400 font-bold" : "text-white/60"
                                    }`}
                                >
                                    {b.name === activeBranch && (
                                        <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                        </svg>
                                    )}
                                    {b.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Tabs */}
                <div className="flex items-center rounded-lg border border-white/[0.06] overflow-hidden ml-2">
                    {(["files", "commits"] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`h-7 px-3 text-[10px] font-bold uppercase tracking-wider transition-all ${
                                activeTab === tab
                                    ? "bg-white/[0.08] text-white"
                                    : "text-white/30 hover:text-white/60"
                            }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Settings / Disconnect */}
                <div className="w-[1px] h-4 bg-white/[0.06] ml-2" />
                <button
                    onClick={onSettings}
                    title="Repository Settings"
                    className="w-7 h-7 ml-1 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
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
                                                className="w-full text-left px-3 py-1.5 flex items-center gap-2.5 text-[11px] text-white/40 hover:bg-white/[0.04] transition-colors border-b border-white/[0.03]"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                                                </svg>
                                                ..
                                            </button>
                                        )}
                                        {files.map(file => (
                                            <button
                                                key={file.sha}
                                                onClick={() => file.type === "dir" ? navigateToDir(file.path) : openFile(file)}
                                                className={`w-full text-left px-3 py-1.5 flex items-center gap-2.5 text-[11px] hover:bg-white/[0.04] transition-colors border-b border-white/[0.02] ${
                                                    selectedFile?.sha === file.sha ? "bg-white/[0.06]" : ""
                                                }`}
                                            >
                                                {file.type === "dir" ? (
                                                    <svg className="w-3.5 h-3.5 text-blue-400/60 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                                    </svg>
                                                ) : (
                                                    <svg className={`w-3.5 h-3.5 flex-shrink-0 ${getFileColor(file.name)}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                    </svg>
                                                )}
                                                <span className={`truncate ${file.type === "dir" ? "text-white/70 font-medium" : "text-white/55"}`}>
                                                    {file.name}
                                                </span>
                                                {file.type === "file" && file.size > 0 && (
                                                    <span className="ml-auto text-[9px] text-white/20 flex-shrink-0">
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
                                <div className="h-9 px-4 flex items-center justify-between border-b border-white/[0.04] flex-shrink-0 bg-white/[0.01]">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <svg className={`w-3.5 h-3.5 flex-shrink-0 ${getFileColor(selectedFile.name)}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        <span className="text-[11px] font-semibold text-white/70 truncate">{selectedFile.name}</span>
                                        <span className="text-[9px] text-white/20 font-mono">{selectedFile.path}</span>
                                    </div>
                                    <button
                                        onClick={() => { setSelectedFile(null); setFileContent(null); }}
                                        className="w-6 h-6 rounded-md flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10 transition-colors"
                                    >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
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
        </div>
    );
};

export default RepoBrowser;
