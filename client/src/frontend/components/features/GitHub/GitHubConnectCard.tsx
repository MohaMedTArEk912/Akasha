/**
 * GitHubConnectCard — Hero section for unauthenticated state
 *
 * Supports both:
 * 1. OAuth popup ("SIGN IN WITH GITHUB")
 * 2. Personal Access Token (PAT) direct input ("CONNECT WITH TOKEN")
 *
 * All state & tokens persist in localStorage.
 */

import React, { useState } from "react";

interface GitHubConnectCardProps {
    onConnect: () => void;
    onPatConnect?: (token: string) => void;
    loading?: boolean;
}

const GitHubConnectCard: React.FC<GitHubConnectCardProps> = ({ onConnect, onPatConnect, loading }) => {
    const [authMode, setAuthMode] = useState<"oauth" | "pat">("oauth");
    const [patToken, setPatToken] = useState("");
    const [submittingPat, setSubmittingPat] = useState(false);

    const handlePatSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!patToken.trim() || !onPatConnect) return;
        setSubmittingPat(true);
        try {
            await onPatConnect(patToken.trim());
        } finally {
            setSubmittingPat(false);
        }
    };

    return (
        <div className="h-full w-full flex items-center justify-center p-8">
            <div className="max-w-lg w-full text-center animate-fade-in bg-white/70 dark:bg-black/30 backdrop-blur-2xl border border-black/[0.08] dark:border-white/10 rounded-3xl p-8 sm:p-10 shadow-2xl">
                {/* GitHub Badge */}
                <div className="mx-auto inline-flex items-center justify-center mb-6">
                    <span className="font-mono text-xs font-black tracking-[0.2em] px-4 py-2 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 shadow-md uppercase">
                        GITHUB INTEGRATION
                    </span>
                </div>

                <h2 className="text-3xl font-black text-neutral-950 dark:text-white mb-3 tracking-tight">
                    Connect to GitHub
                </h2>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed max-w-md mx-auto mb-6 font-mono">
                    Link your GitHub account to create new repositories, browse existing projects, and manage your code — all synced with Akasha.
                </p>

                {/* Auth Mode Toggle */}
                <div className="inline-flex p-1 rounded-xl bg-neutral-100 dark:bg-white/[0.05] border border-black/[0.06] dark:border-white/[0.08] mb-8">
                    <button
                        type="button"
                        onClick={() => setAuthMode("oauth")}
                        className={`px-4 py-1.5 rounded-lg text-[11px] font-mono font-bold tracking-wider uppercase transition-all ${
                            authMode === "oauth"
                                ? "bg-white dark:bg-neutral-800 text-neutral-950 dark:text-white shadow-sm"
                                : "text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                        }`}
                    >
                        OAuth Popup
                    </button>
                    <button
                        type="button"
                        onClick={() => setAuthMode("pat")}
                        className={`px-4 py-1.5 rounded-lg text-[11px] font-mono font-bold tracking-wider uppercase transition-all ${
                            authMode === "pat"
                                ? "bg-white dark:bg-neutral-800 text-neutral-950 dark:text-white shadow-sm"
                                : "text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                        }`}
                    >
                        Personal Access Token
                    </button>
                </div>

                {/* Feature bullets */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
                    {[
                        { badge: "REPO", label: "Create Repos", desc: "New repos instantly" },
                        { badge: "TREE", label: "Browse Files", desc: "Full file tree" },
                        { badge: "HIST", label: "Commit History", desc: "Track all changes" },
                    ].map(({ badge, label, desc }) => (
                        <div key={label} className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-neutral-100/50 dark:bg-white/[0.02] p-4 text-left">
                            <div className="inline-block px-2 py-0.5 rounded font-mono text-[9px] font-bold tracking-wider bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 mb-2">
                                {badge}
                            </div>
                            <div className="text-[11px] font-bold text-neutral-900 dark:text-white uppercase tracking-wider">{label}</div>
                            <div className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-1 font-mono">{desc}</div>
                        </div>
                    ))}
                </div>

                {authMode === "oauth" ? (
                    <div>
                        {/* OAuth Connect button */}
                        <button
                            onClick={onConnect}
                            disabled={loading}
                            className="h-12 px-10 rounded-xl bg-neutral-950 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100 font-bold text-xs tracking-wider
                                active:scale-[0.97] transition-all shadow-lg
                                disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-3 mx-auto font-mono uppercase"
                        >
                            {loading ? "CONNECTING..." : "SIGN IN WITH GITHUB"}
                        </button>
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-5 font-mono">
                            We request repo and user read permissions. Session is saved to localStorage.
                        </p>
                    </div>
                ) : (
                    <form onSubmit={handlePatSubmit} className="space-y-4 text-left">
                        <div>
                            <label className="block text-[11px] font-mono font-bold tracking-wider text-neutral-700 dark:text-neutral-300 uppercase mb-2">
                                GitHub Personal Access Token (Classic or Fine-Grained)
                            </label>
                            <input
                                type="password"
                                value={patToken}
                                onChange={(e) => setPatToken(e.target.value)}
                                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx or github_pat_..."
                                className="w-full h-11 px-4 rounded-xl bg-neutral-100/80 dark:bg-black/40 border border-black/10 dark:border-white/10 text-neutral-950 dark:text-white font-mono text-xs focus:outline-none focus:border-blue-500 transition-all placeholder:text-neutral-400"
                            />
                            <div className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-1.5 font-mono">
                                Required scopes: <span className="text-neutral-700 dark:text-neutral-200 font-bold">repo</span> and <span className="text-neutral-700 dark:text-neutral-200 font-bold">read:user</span>.
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={submittingPat || !patToken.trim()}
                            className="w-full h-11 rounded-xl bg-neutral-950 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100 font-bold text-xs tracking-wider
                                active:scale-[0.98] transition-all shadow-md
                                disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center font-mono uppercase"
                        >
                            {submittingPat ? "VERIFYING & CONNECTING..." : "CONNECT WITH TOKEN"}
                        </button>
                        <p className="text-[10px] text-neutral-500 dark:text-neutral-400 text-center font-mono">
                            Token is encrypted and saved securely in your browser's localStorage.
                        </p>
                    </form>
                )}
            </div>
        </div>
    );
};

export default GitHubConnectCard;
