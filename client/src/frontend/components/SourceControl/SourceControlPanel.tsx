/**
 * Source Control Panel — VS Code-style Git integration sidebar
 * 
 * Shows: commit input, changed files count, commit history with per-file diffs
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useApi, GitCommitInfo, GitStatus } from "../../hooks/useTauri";
import { openDiffView } from "../../stores/projectStore";


function timeAgo(ts: number): string {
    const seconds = Math.floor(Date.now() / 1000 - ts);
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

/* ─── Parse diff text into per-file entries ───────────────────────────── */
interface DiffFile {
    filename: string;
    status: "M" | "A" | "D" | "R";   // Modified, Added, Deleted, Renamed
    lines: string[];
}

function parseDiffToFiles(raw: string): DiffFile[] {
    if (!raw) return [];
    const files: DiffFile[] = [];
    // Split by "diff --git" headers
    const chunks = raw.split(/^diff --git /m).filter(Boolean);

    for (const chunk of chunks) {
        const lines = chunk.split("\n");
        // first line looks like: a/path/to/file b/path/to/file
        const headerMatch = lines[0]?.match(/a\/(.+?)\s+b\/(.+)/);
        const filename = headerMatch ? headerMatch[2] : lines[0]?.trim() || "unknown";

        // Determine status from diff meta-lines
        let status: DiffFile["status"] = "M";
        const chunkText = chunk.substring(0, 500); // only scan start
        if (chunkText.includes("new file mode")) status = "A";
        else if (chunkText.includes("deleted file mode")) status = "D";
        else if (chunkText.includes("rename from")) status = "R";

        // Collect only the actual change lines (starting after @@)
        const diffLines: string[] = [];
        let inHunk = false;
        for (const line of lines) {
            if (line.startsWith("@@")) {
                inHunk = true;
                diffLines.push(line);
                continue;
            }
            if (inHunk) {
                diffLines.push(line);
            }
        }

        files.push({ filename, status, lines: diffLines });
    }

    // If no "diff --git" headers found, show the raw text as a single entry
    if (files.length === 0 && raw.trim()) {
        files.push({ filename: "changes", status: "M", lines: raw.split("\n") });
    }

    return files;
}

/* ─── Status badge colors ─────────────────────────────────────────────── */
const statusColors: Record<string, { bg: string; text: string; label: string }> = {
    M: { bg: "bg-amber-500/20", text: "text-amber-400", label: "M" },
    A: { bg: "bg-green-500/20", text: "text-green-400", label: "A" },
    D: { bg: "bg-red-500/20", text: "text-red-400", label: "D" },
    R: { bg: "bg-blue-500/20", text: "text-blue-400", label: "R" },
};

/* ─── File icon helper ────────────────────────────────────────────────── */
function getFileIcon(filename: string) {
    const ext = filename.split(".").pop()?.toLowerCase();
    const iconMap: Record<string, string> = {
        ts: "text-blue-400", tsx: "text-blue-400", js: "text-yellow-400", jsx: "text-yellow-400",
        rs: "text-orange-400", css: "text-purple-400", html: "text-red-400", json: "text-green-400",
        toml: "text-gray-400", md: "text-gray-300",
    };
    return iconMap[ext || ""] || "text-[var(--ide-text-secondary)]";
}

/* ─── Main Component ─────────────────────────────────────────────────── */
const SourceControlPanel: React.FC = () => {
    const api = useApi();
    const apiRef = useRef(api);
    apiRef.current = api;


    const [status, setStatus] = useState<GitStatus | null>(null);
    const [commits, setCommits] = useState<GitCommitInfo[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [commitMsg, setCommitMsg] = useState("");
    const [loading, setLoading] = useState(false);
    const [committing, setCommitting] = useState(false);
    const [expandedCommit, setExpandedCommit] = useState<string | null>(null);

    const [diffFiles, setDiffFiles] = useState<DiffFile[]>([]);
    const [diffLoading, setDiffLoading] = useState(false);
    const [restoring, setRestoring] = useState<string | null>(null);
    const [initializing, setInitializing] = useState(false);
    const [initError, setInitError] = useState<string | null>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    /* ─── Data fetching ───────────────────────────────────────────── */
    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const [s, h] = await Promise.all([
                apiRef.current.gitStatus(),
                apiRef.current.gitHistory(100),
            ]);
            setStatus(s);
            setCommits(h);
        } catch {
            // no repo or not synced yet
            setStatus(null);
            setCommits([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    /* ─── Actions ─────────────────────────────────────────────────── */
    const handleCommit = async () => {
        if (!commitMsg.trim()) return;
        setCommitting(true);
        try {
            await api.gitCommit(commitMsg.trim());
            setCommitMsg("");
            await refresh();
        } catch (e) {
            console.error("Commit failed:", e);
        } finally {
            setCommitting(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            handleCommit();
        }
    };

    const handleToggleDiff = async (commitId: string) => {
        if (expandedCommit === commitId) {
            setExpandedCommit(null);

            setDiffFiles([]);
            return;
        }
        setExpandedCommit(commitId);
        setDiffLoading(true);
        try {
            const diff = await api.gitDiff(commitId);

            setDiffFiles(parseDiffToFiles(diff));
        } catch {
            setDiffFiles([]);
        } finally {
            setDiffLoading(false);
        }
    };

    const handleRestore = async (commitId: string) => {
        setRestoring(commitId);
        try {
            await api.gitRestore(commitId);
            await refresh();
        } catch (e) {
            console.error("Restore failed:", e);
        } finally {
            setRestoring(null);
        }
    };

    /* ─── Empty state: no repo ────────────────────────────────────── */
    if (!loading && (!status || !status.is_repo)) {
        return (
            <div className="flex flex-col items-center justify-center h-full px-6 py-8 text-center">
                <div className="w-12 h-12 rounded-full bg-[var(--ide-bg-elevated)] flex items-center justify-center mb-4">
                    <svg className="w-6 h-6 text-[var(--ide-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                </div>
                <p className="text-xs text-[var(--ide-text-secondary)] leading-relaxed">
                    No Git repository found.<br />
                    Set a <span className="text-[var(--ide-text)] font-medium">sync root</span> to enable version control.
                </p>
                <button
                    onClick={async () => {
                        setInitializing(true);
                        setInitError(null);
                        try {
                            await api.initGitRepo();
                            await refresh();
                        } catch (e) {
                            setInitError(String(e));
                        } finally {
                            setInitializing(false);
                        }
                    }}
                    disabled={initializing}
                    className="mt-4 px-4 py-2 text-xs font-semibold rounded-md bg-[var(--ide-primary)] text-white hover:bg-[var(--ide-primary-hover)] transition-colors disabled:opacity-40"
                >
                    {initializing ? "Creating..." : "Create Repo"}
                </button>
                {initError && (
                    <p className="mt-2 text-[10px] text-red-400">{initError}</p>
                )}
            </div>
        );
    }

    const handleDiscard = async (path: string) => {
        if (!confirm(`Discard changes to ${path}? This cannot be undone.`)) return;
        try {
            await apiRef.current.gitDiscard(path);
            await refresh();
        } catch (err) {
            console.error("Failed to discard changes:", err);
            alert("Failed to discard changes: " + String(err));
        }
    };

    const filteredCommits = commits.filter(c =>
        c.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.id.includes(searchQuery) ||
        c.author.toLowerCase().includes(searchQuery.toLowerCase())
    );

    /* ─── Main UI ─────────────────────────────────────────────────── */
    return (
        <div className="flex flex-col h-full">

            {/* ── Commit input section ───────────────────────────── */}
            <div className="flex-shrink-0 border-b border-[var(--ide-border)]">
                <div className="p-3">
                    <div className="relative">
                        <textarea
                            ref={inputRef}
                            value={commitMsg}
                            onChange={e => setCommitMsg(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Message (Ctrl+Enter to commit)"
                            className="w-full bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] rounded-md px-3 py-2 text-xs text-[var(--ide-text)] placeholder:text-[var(--ide-text-secondary)] resize-none focus:outline-none focus:border-[var(--ide-primary)] transition-colors"
                            rows={2}
                            spellCheck={false}
                        />
                    </div>
                    <button
                        onClick={handleCommit}
                        disabled={!commitMsg.trim() || committing}
                        className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all
                            bg-[var(--ide-primary)] hover:bg-[var(--ide-primary-hover)] text-white
                            disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[var(--ide-primary)]"
                    >
                        {committing ? (
                            <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                        )}
                        {committing ? "Committing..." : "Commit"}
                    </button>
                </div>
            </div>

            {/* ── Changes section ─────────────────────────────────── */}
            {status && status.changed_files.length > 0 && (
                <div className="flex-shrink-0 border-b border-[var(--ide-border)] max-h-[30vh] overflow-y-auto">
                    <div className="px-3 py-2 flex items-center justify-between sticky top-0 bg-[var(--ide-bg-panel)] z-10 border-b border-[var(--ide-border)]/50">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-[var(--ide-text-secondary)] uppercase tracking-wider">Changes</span>
                            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--ide-primary)] text-[10px] font-bold text-white">
                                {status.changed_files.length}
                            </span>
                        </div>
                    </div>
                    <div>
                        {status.changed_files.map((file) => {
                            const sc = statusColors[file.status] || statusColors["?"];
                            const basename = file.path.split(/[/\\]/).pop() || file.path;
                            return (
                                <div key={file.path} className="group flex items-center justify-between px-3 py-1.5 hover:bg-[var(--ide-bg-hover)] transition-colors">
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                        <span className={`text-[10px] font-mono font-bold w-3.5 text-center ${sc.text}`}>{sc.label}</span>
                                        <span className={`text-[11px] truncate ${sc.text}`}>{basename}</span>
                                        <span className="text-[9px] text-[var(--ide-text-muted)] truncate flex-shrink-0 opacity-60">
                                            {file.path.substring(0, file.path.length - basename.length)}
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => handleDiscard(file.path)}
                                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 hover:text-red-400 text-[var(--ide-text-secondary)] rounded transition-all"
                                        title="Discard changes"
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Commit history ──────────────────────────────────── */}
            <div className="flex-1 min-h-0 flex flex-col">
                <div className="px-3 py-2 flex flex-col gap-2 flex-shrink-0 border-b border-[var(--ide-border)]">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-[var(--ide-text-secondary)] uppercase tracking-wider">History</span>
                            {status && (
                                <span className="text-[10px] text-[var(--ide-text-secondary)]">
                                    {status.total_commits} commit{status.total_commits !== 1 ? "s" : ""}
                                </span>
                            )}
                        </div>
                        <button
                            onClick={refresh}
                            disabled={loading}
                            className="p-1 rounded hover:bg-[var(--ide-bg-hover)] transition-colors text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] disabled:opacity-40"
                            title="Refresh"
                        >
                            <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                        </button>
                    </div>
                    {/* Search Input */}
                    <div className="relative">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Filter commits..."
                            className="w-full bg-[var(--ide-input-bg)] border border-[var(--ide-border)] rounded px-2 py-1 text-[11px] focus:outline-none focus:border-[var(--ide-primary)] placeholder-[var(--ide-text-muted)]"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery("")}
                                className="absolute right-1 top-1/2 -translate-y-1/2 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"
                            >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {loading && commits.length === 0 ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="w-5 h-5 border-2 border-[var(--ide-primary)]/30 border-t-[var(--ide-primary)] rounded-full animate-spin" />
                        </div>
                    ) : filteredCommits.length === 0 ? (
                        <div className="flex items-center justify-center py-8">
                            <p className="text-xs text-[var(--ide-text-secondary)]">No commits found</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-[var(--ide-border)]/50">
                            {filteredCommits.map((c, i) => (
                                <div key={c.id} className="group">
                                    {/* Commit row */}
                                    <button
                                        className={`w-full text-left px-3 py-2 flex items-start gap-2.5 transition-colors hover:bg-[var(--ide-bg-hover)] ${expandedCommit === c.id ? "bg-[var(--ide-bg-hover)]" : ""}`}
                                        onClick={() => handleToggleDiff(c.id)}
                                    >
                                        {/* Timeline dot + line */}
                                        <div className="flex flex-col items-center flex-shrink-0 pt-0.5">
                                            <div className={`w-2.5 h-2.5 rounded-full border-2 ${i === 0
                                                ? "border-[var(--ide-primary)] bg-[var(--ide-primary)]"
                                                : "border-[var(--ide-text-secondary)] bg-transparent"
                                                }`} />
                                            {i < commits.length - 1 && (
                                                <div className="w-px flex-1 min-h-[16px] bg-[var(--ide-border)] mt-1" />
                                            )}
                                        </div>

                                        {/* Commit info */}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs text-[var(--ide-text)] truncate leading-snug">
                                                {c.summary || c.message}
                                            </p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-[10px] font-mono text-[var(--ide-primary)]">
                                                    {c.id.slice(0, 7)}
                                                </span>
                                                <span className="text-[10px] text-[var(--ide-text-secondary)]">
                                                    {timeAgo(c.timestamp)}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Restore button (on hover) */}
                                        <button
                                            className="opacity-0 group-hover:opacity-100 flex-shrink-0 p-1 rounded hover:bg-[var(--ide-primary)]/20 transition-all text-[var(--ide-text-secondary)] hover:text-[var(--ide-primary)]"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleRestore(c.id);
                                            }}
                                            title="Restore to this commit"
                                        >
                                            {restoring === c.id ? (
                                                <div className="w-3.5 h-3.5 border-2 border-[var(--ide-primary)]/30 border-t-[var(--ide-primary)] rounded-full animate-spin" />
                                            ) : (
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                                </svg>
                                            )}
                                        </button>
                                    </button>

                                    {/* Expanded diff — per-file list */}
                                    {expandedCommit === c.id && (
                                        <div className="ml-[26px] mr-3 mb-2">
                                            {diffLoading ? (
                                                <div className="bg-[var(--ide-bg-elevated)] rounded border border-[var(--ide-border)] p-3 flex items-center justify-center">
                                                    <div className="w-4 h-4 border-2 border-[var(--ide-primary)]/30 border-t-[var(--ide-primary)] rounded-full animate-spin" />
                                                </div>
                                            ) : diffFiles.length === 0 ? (
                                                <div className="bg-[var(--ide-bg-elevated)] rounded border border-[var(--ide-border)] px-3 py-2">
                                                    <span className="text-[10px] italic text-[var(--ide-text-secondary)]">No changes in this commit</span>
                                                </div>
                                            ) : (
                                                <div className="rounded border border-[var(--ide-border)] overflow-hidden">
                                                    {/* File count header */}
                                                    <div className="bg-[var(--ide-bg-elevated)] px-2.5 py-1.5 border-b border-[var(--ide-border)] flex items-center gap-2">
                                                        <span className="text-[10px] text-[var(--ide-text-secondary)]">
                                                            {diffFiles.length} file{diffFiles.length !== 1 ? "s" : ""} changed
                                                        </span>
                                                    </div>

                                                    {/* File list */}
                                                    {diffFiles.map((file, fi) => {
                                                        const sc = statusColors[file.status];
                                                        const basename = file.filename.split("/").pop() || file.filename;
                                                        const dir = file.filename.includes("/")
                                                            ? file.filename.substring(0, file.filename.lastIndexOf("/"))
                                                            : "";

                                                        return (
                                                            <div key={fi}>
                                                                {/* File row — click to open in DiffViewer */}
                                                                <button
                                                                    className={`w-full text-left px-2.5 py-1.5 flex items-center gap-2 text-[11px] transition-colors hover:bg-[var(--ide-bg-hover)] bg-[var(--ide-chrome)] ${fi < diffFiles.length - 1 ? "border-b border-[var(--ide-border)]/50" : ""}`}
                                                                    onClick={() => {
                                                                        // Parse lines into typed diff entries for the DiffViewer
                                                                        const parsedLines = file.lines.map(line => {
                                                                            let type: "add" | "del" | "context" | "hunk" = "context";
                                                                            if (line.startsWith("@@")) type = "hunk";
                                                                            else if (line.startsWith("+") && !line.startsWith("+++")) type = "add";
                                                                            else if (line.startsWith("-") && !line.startsWith("---")) type = "del";
                                                                            return { text: line, type };
                                                                        });
                                                                        openDiffView({
                                                                            filename: file.filename,
                                                                            lines: parsedLines,
                                                                            commitId: c.id,
                                                                            commitMessage: c.summary || c.message,
                                                                        });
                                                                    }}
                                                                >
                                                                    {/* File icon */}
                                                                    <svg className={`w-3.5 h-3.5 flex-shrink-0 ${getFileIcon(file.filename)}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                                    </svg>

                                                                    {/* Filename + path */}
                                                                    <span className="flex-1 min-w-0 truncate">
                                                                        <span className="text-[var(--ide-text)]">{basename}</span>
                                                                        {dir && (
                                                                            <span className="text-[var(--ide-text-secondary)] ml-1.5 text-[10px]">{dir}</span>
                                                                        )}
                                                                    </span>

                                                                    {/* Status badge */}
                                                                    <span className={`flex-shrink-0 inline-flex items-center justify-center w-4 h-4 rounded text-[9px] font-bold ${sc.bg} ${sc.text}`}>
                                                                        {sc.label}
                                                                    </span>
                                                                </button>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SourceControlPanel;
