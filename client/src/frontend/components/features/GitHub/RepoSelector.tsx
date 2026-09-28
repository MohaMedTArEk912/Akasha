/**
 * RepoSelector — Grid of GitHub repos with search + filter
 */

import React, { useState, useMemo } from "react";

interface GitHubRepo {
    id: number;
    name: string;
    full_name: string;
    description: string | null;
    private: boolean;
    html_url: string;
    language: string | null;
    stargazers_count: number;
    forks_count: number;
    updated_at: string;
    owner: { login: string; avatar_url: string };
    default_branch: string;
}

interface RepoSelectorProps {
    repos: GitHubRepo[];
    loading: boolean;
    linkedRepoFullName?: string;
    onView: (repo: GitHubRepo) => void;
    onLink: (repo: GitHubRepo) => void;
    onCreateNew: () => void;
    onLoadMore?: () => void;
    hasMore?: boolean;
}

const langColors: Record<string, string> = {
    TypeScript: "#3178c6",
    JavaScript: "#f1e05a",
    Python: "#3572A5",
    Rust: "#dea584",
    Go: "#00ADD8",
    Java: "#b07219",
    "C#": "#178600",
    C: "#555555",
    "C++": "#f34b7d",
    Ruby: "#701516",
    PHP: "#4F5D95",
    Swift: "#F05138",
    Kotlin: "#A97BFF",
    HTML: "#e34c26",
    CSS: "#563d7c",
    Shell: "#89e051",
    Dart: "#00B4AB",
    Vue: "#41b883",
};

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

const RepoSelector: React.FC<RepoSelectorProps> = ({ repos, loading, linkedRepoFullName, onView, onLink, onCreateNew, onLoadMore, hasMore }) => {
    const [search, setSearch] = useState("");

    const filtered = useMemo(
        () => repos.filter(r =>
            r.name.toLowerCase().includes(search.toLowerCase()) ||
            (r.description || "").toLowerCase().includes(search.toLowerCase())
        ),
        [repos, search]
    );

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-6 py-5 border-b border-black/[0.08] dark:border-white/[0.08] flex items-center justify-between gap-4 flex-shrink-0">
                <div>
                    <h2 className="text-lg font-black text-neutral-950 dark:text-white tracking-tight">Your Repositories</h2>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-mono mt-0.5">{repos.length} repos found</p>
                </div>

                <div className="flex items-center gap-3">
                    {/* Search */}
                    <div>
                        <input
                            type="text"
                            placeholder="Search repos..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="h-9 w-56 px-3 rounded-xl bg-neutral-100/80 dark:bg-white/[0.04] border border-black/10 dark:border-white/10 text-xs font-mono text-neutral-950 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-white/25 focus:outline-none focus:border-indigo-500 transition-colors"
                        />
                    </div>

                    {/* Create New */}
                    <button
                        onClick={onCreateNew}
                        className="h-9 px-4 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold font-mono uppercase tracking-wider hover:bg-emerald-500/25 transition-all flex items-center gap-2"
                    >
                        + NEW REPO
                    </button>
                </div>
            </div>

            {/* Repo grid */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                {loading && repos.length === 0 ? (
                    <div className="flex items-center justify-center h-40">
                        <span className="font-mono text-xs text-neutral-500 dark:text-neutral-400 tracking-widest uppercase">LOADING...</span>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-16">
                        <p className="text-sm text-neutral-500 dark:text-neutral-400 font-mono">
                            {search ? "No repositories match your search." : "No repositories found."}
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                            {filtered.map(repo => (
                                <div
                                    key={repo.id}
                                    className="group text-left flex flex-col h-full rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-neutral-100/50 dark:bg-white/[0.02] p-5 hover:border-black/10 dark:hover:border-white/[0.15] hover:bg-neutral-100 dark:hover:bg-white/[0.04] transition-all duration-200 relative overflow-hidden"
                                >
                                    <div className="relative z-10">
                                        {/* Repo name + visibility */}
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-sm font-bold text-neutral-950 dark:text-white truncate">{repo.name}</span>
                                            <span className={`text-[9px] font-bold font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-md border ${
                                                repo.private
                                                    ? "text-amber-600 dark:text-amber-400/80 bg-amber-500/10 border-amber-500/20"
                                                    : "text-neutral-500 dark:text-white/40 bg-neutral-200/60 dark:bg-white/[0.03] border-neutral-300 dark:border-white/[0.06]"
                                            }`}>
                                                {repo.private ? "Private" : "Public"}
                                            </span>
                                            {linkedRepoFullName === repo.full_name && (
                                                <span className="ml-auto text-[9px] font-bold font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-md border text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border-indigo-500/20">
                                                    Linked
                                                </span>
                                            )}
                                        </div>

                                        {/* Description */}
                                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed line-clamp-2 min-h-[2.5em] mb-4 font-mono">
                                            {repo.description || "No description"}
                                        </p>

                                        {/* Bottom Action Row */}
                                        <div className="mt-auto pt-4 border-t border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between">
                                            <div className="flex items-center gap-3 text-[10px] text-neutral-500 dark:text-neutral-400 font-mono">
                                                {repo.language && (
                                                    <span className="flex items-center gap-1.5">
                                                        <span
                                                            className="w-2 h-2 rounded-full"
                                                            style={{ backgroundColor: langColors[repo.language] || "#888" }}
                                                        />
                                                        {repo.language}
                                                    </span>
                                                )}
                                                <span>{timeAgo(repo.updated_at)}</span>
                                            </div>
                                            
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => onView(repo)}
                                                    className="px-3 py-1.5 rounded-lg bg-neutral-200/60 dark:bg-white/[0.04] border border-black/10 dark:border-white/[0.08] text-[10px] font-mono font-bold uppercase text-neutral-700 dark:text-white/70 hover:bg-neutral-300 dark:hover:bg-white/[0.1] hover:text-neutral-950 dark:hover:text-white transition-all"
                                                >
                                                    VIEW
                                                </button>

                                                {linkedRepoFullName !== repo.full_name && (
                                                    <button
                                                        onClick={() => onLink(repo)}
                                                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-[10px] font-mono font-bold uppercase text-white transition-all shadow-sm"
                                                    >
                                                        LINK TO PROJECT
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {hasMore && onLoadMore && (
                            <div className="mt-6 flex justify-center">
                                <button
                                    onClick={onLoadMore}
                                    disabled={loading}
                                    className="h-9 px-6 rounded-xl border border-black/10 dark:border-white/[0.08] text-[11px] font-mono font-bold uppercase text-neutral-600 dark:text-white/50 hover:text-neutral-950 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-white/[0.04] transition-all disabled:opacity-40"
                                >
                                    {loading ? "LOADING..." : "LOAD MORE"}
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default RepoSelector;
export type { GitHubRepo };
