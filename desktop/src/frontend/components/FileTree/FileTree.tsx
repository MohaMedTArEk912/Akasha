import React, { useState, useEffect, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { useProjectStore } from "../../hooks/useProjectStore";
import { useApi, FileEntry, GitStatus } from "../../hooks/useTauri";
import { refreshCurrentProject, selectFile, setActivePage } from "../../stores/projectStore";
import ConfirmModal from "../Modals/ConfirmModal";
import { useToast } from "../../context/ToastContext";

// ===== File Type Icon Mapping =====
const getFileIcon = (name: string, isDirectory: boolean): string => {
    if (isDirectory) return "📁";

    const ext = name.split(".").pop()?.toLowerCase() || "";

    const iconMap: { [key: string]: string } = {
        // Images
        png: "🖼️",
        jpg: "🖼️",
        jpeg: "🖼️",
        gif: "🖼️",
        svg: "🖼️",
        webp: "🖼️",

        // Code
        ts: "🔷",
        tsx: "⚛️",
        js: "💛",
        jsx: "⚛️",
        rs: "🦀",
        py: "🐍",
        go: "🔵",
        java: "☕",
        cpp: "⚙️",
        cs: "🟦",
        rb: "💎",
        php: "🐘",
        swift: "🍎",
        kt: "🧡",
        scala: "📕",

        // Markup & Style
        html: "🌐",
        css: "🎨",
        scss: "🎨",
        less: "🎨",
        postcss: "🎨",
        xml: "📄",
        json: "📋",
        yaml: "📝",
        yml: "📝",
        toml: "⚙️",

        // Data
        sql: "🗄️",
        db: "🗄️",
        sqlite: "🗄️",
        csv: "📊",
        excel: "📊",
        xls: "📊",
        xlsx: "📊",

        // Config
        env: "⚙️",
        config: "⚙️",
        conf: "⚙️",
        lock: "🔒",

        // Docs
        md: "📝",
        markdown: "📝",
        txt: "📄",
        doc: "📄",
        docx: "📄",
        pdf: "📕",

        // Archives
        zip: "📦",
        rar: "📦",
        tar: "📦",
        gz: "📦",
        "7z": "📦",

        // Video
        mp4: "🎬",
        mov: "🎬",
        avi: "🎬",
        mkv: "🎬",
        webm: "🎬",

        // Audio
        mp3: "🎵",
        wav: "🎵",
        flac: "🎵",
        aac: "🎵",
        ogg: "🎵",

        // Build & Package
        dockerfile: "🐳",
        makefile: "⚙️",
        gradle: "🔨",
        maven: "🔨",
        cargo: "🦀",
        npm: "📦",
        yarn: "📦",
        pnpm: "📦",
    };

    return iconMap[ext] || "📄";
};

const formatFileSize = (bytes?: number): string => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
};

interface FileTreeItemProps {
    entry: FileEntry;
    depth: number;
    onRefresh: () => Promise<void>;
    onFileSelect: (path: string) => void;
    selectedPath: string | null;
    refreshVersion: number;
    searchFilter?: string;
    gitStatus: GitStatus | null;
    projectRoot: string | null;
}

const FileTreeItem: React.FC<FileTreeItemProps> = ({
    entry,
    depth,
    onRefresh,
    onFileSelect,
    selectedPath,
    refreshVersion,
    searchFilter = "",
    gitStatus,
    projectRoot,
}) => {
    const [expanded, setExpanded] = useState(false);
    const [children, setChildren] = useState<FileEntry[]>([]);
    const [filteredChildren, setFilteredChildren] = useState<FileEntry[]>([]);
    const [loading, setLoading] = useState(false);

    // Git status check
    const getGitStatus = () => {
        if (!gitStatus || !projectRoot) return null;

        let relativePath = entry.path.replace(projectRoot, "");
        if (relativePath.startsWith("\\") || relativePath.startsWith("/")) {
            relativePath = relativePath.substring(1);
        }
        relativePath = relativePath.replace(/\\/g, "/");

        return gitStatus.changed_files.find(f => f.path.replace(/\\/g, "/") === relativePath);
    };

    const gitFile = getGitStatus();
    const gitColor = gitFile?.status === "M" ? "text-amber-400" :
        gitFile?.status === "A" ? "text-green-400" :
            gitFile?.status === "D" ? "text-red-400" : "";


    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isRenaming, setIsRenaming] = useState(false);
    const [newName, setNewName] = useState(entry.name);
    const [dragOver, setDragOver] = useState(false);

    const api = useApi();
    const toast = useToast();
    const isSelected = selectedPath === entry.path;

    // Filter children based on search filter
    useEffect(() => {
        if (!searchFilter.trim()) {
            setFilteredChildren(children);
        } else {
            const filter = searchFilter.toLowerCase();
            const filtered = children.filter((child) =>
                child.name.toLowerCase().includes(filter)
            );
            setFilteredChildren(filtered);
            // Auto-expand when filtering
            if (filtered.length > 0) {
                setExpanded(true);
            }
        }
    }, [children, searchFilter]);

    const loadChildren = useCallback(async () => {
        if (!entry.is_directory) return;

        if (children.length === 0) {
            setLoading(true);
        }
        try {
            const result = await api.listDirectory(entry.path);
            setChildren(result.entries);
        } catch (err) {
            console.error("Failed to load directory:", err);
            setChildren([]);
        } finally {
            setLoading(false);
        }
    }, [entry.is_directory, entry.path, api, children.length]);

    // Load children when expanded for the first time
    useEffect(() => {
        if (entry.is_directory && expanded && children.length === 0) {
            loadChildren();
        }
    }, [expanded, entry.is_directory, children.length, loadChildren]);

    // Re-fetch children when refreshVersion changes (e.g. after delete/rename)
    useEffect(() => {
        if (entry.is_directory && expanded && refreshVersion > 0) {
            loadChildren();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refreshVersion]);


    const submitRename = async () => {
        if (!newName.trim() || newName === entry.name) {
            setIsRenaming(false);
            return;
        }

        try {
            const parentPath = entry.path.split("/").slice(0, -1).join("/");
            const newPath = parentPath ? `${parentPath}/${newName}` : newName;
            await api.renameFile(entry.path, newPath);
            setIsRenaming(false);
            toast.success(`Renamed to "${newName}"`);
            await onRefresh();
        } catch (err) {
            toast.error(`Failed to rename: ${err}`);
            setIsRenaming(false);
        }
    };

    const confirmDelete = async () => {
        setIsDeleting(true);
        try {
            await api.deleteFile(entry.path);
            toast.success(`${entry.is_directory ? "Folder" : "File"} "${entry.name}" deleted`);
            setDeleteConfirmOpen(false);
            // Clear selection if the deleted file was selected
            if (selectedPath === entry.path) {
                selectFile(null);
            }
            await onRefresh();
        } catch (err) {
            toast.error(`Failed to delete: ${err}`);
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="select-none">
            <div
                className={`flex items-center gap-2 py-1.5 px-2 cursor-pointer transition-colors group relative ${isSelected
                    ? "bg-indigo-500/20 text-indigo-300 border-l-2 border-indigo-500"
                    : dragOver
                        ? "bg-indigo-500/10"
                        : "text-[var(--ide-text-secondary)] hover:bg-[var(--ide-bg-hover)]"
                    }`}
                style={{ paddingLeft: `${depth * 12 + 8}px` }}
                onClick={(e) => {
                    e.stopPropagation();
                    if (entry.is_directory) {
                        setExpanded(!expanded);
                        if (!expanded && children.length === 0) {
                            loadChildren();
                        }
                    } else {
                        onFileSelect(entry.path);
                    }
                }}
                onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setContextMenu({ x: e.clientX, y: e.clientY });
                }}
                onDragOver={(e) => {
                    if (entry.is_directory) {
                        e.preventDefault();
                        e.stopPropagation();
                        setDragOver(true);
                    }
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                    if (entry.is_directory) {
                        e.preventDefault();
                        e.stopPropagation();
                        setDragOver(false);
                        // TODO: Implement drag-drop file move
                    }
                }}
            >
                {/* Expand/Collapse Arrow */}
                {entry.is_directory && (
                    <svg
                        className={`w-4 h-4 flex-shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                    </svg>
                )}
                {!entry.is_directory && <div className="w-4" />}

                {/* File Icon */}
                <span className="text-base flex-shrink-0">
                    {getFileIcon(entry.name, entry.is_directory)}
                </span>

                {/* Name - with edit mode */}
                {isRenaming ? (
                    <input
                        autoFocus
                        className="flex-1 bg-indigo-500/20 border border-indigo-500 outline-none text-[12px] h-5 px-1 py-0"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onBlur={submitRename}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") submitRename();
                            if (e.key === "Escape") setIsRenaming(false);
                        }}
                        onClick={(e) => e.stopPropagation()}
                    />
                ) : (
                    <span className={`text-[12px] truncate font-medium ${gitColor || ""}`}>{entry.name}</span>
                )}

                {gitFile && (
                    <span className={`ml-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--ide-bg-input)] ${gitColor}`}>
                        {gitFile.status}
                    </span>
                )}

                {/* File size (for files) */}
                {!entry.is_directory && entry.size !== undefined && (
                    <span className="text-[11px] text-[var(--ide-text-muted)] whitespace-nowrap ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                        {formatFileSize(entry.size)}
                    </span>
                )}
            </div>

            {/* Nested scope - show filtered children */}
            {entry.is_directory && expanded && (
                <div className="flex flex-col">
                    {loading && filteredChildren.length === 0 ? (
                        <div
                            className="py-1 text-[11px] text-[var(--ide-text-muted)] italic"
                            style={{ paddingLeft: `${(depth + 1) * 12 + 24}px` }}
                        >
                            Loading...
                        </div>
                    ) : filteredChildren.length === 0 ? (
                        <div
                            className="py-1 text-[11px] text-[var(--ide-text-muted)] italic"
                            style={{ paddingLeft: `${(depth + 1) * 12 + 24}px` }}
                        >
                            {searchFilter ? "No matches" : "Empty"}
                        </div>
                    ) : (
                        filteredChildren.map((child) => (
                            <FileTreeItem
                                key={child.path}
                                entry={child}
                                depth={depth + 1}
                                onRefresh={onRefresh}
                                onFileSelect={onFileSelect}
                                selectedPath={selectedPath}
                                refreshVersion={refreshVersion}
                                searchFilter={searchFilter}
                                gitStatus={gitStatus}
                                projectRoot={projectRoot}
                            />
                        ))
                    )}
                </div>
            )}

            {/* Context Menu */}
            {contextMenu && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
                    <div
                        className="fixed z-50 bg-[var(--ide-panel)] border border-[var(--ide-border)] rounded shadow-lg py-1 min-w-[180px]"
                        style={{ top: contextMenu.y, left: contextMenu.x }}
                    >
                        <button
                            onClick={() => {
                                setContextMenu(null);
                                setIsRenaming(true);
                                setNewName(entry.name);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-[var(--ide-text)] hover:bg-[var(--ide-bg-hover)] transition-colors"
                        >
                            <span>✏️</span> Rename
                        </button>
                        <button
                            onClick={() => {
                                setContextMenu(null);
                                setDeleteConfirmOpen(true);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                            <span>🗑️</span> Delete
                        </button>
                        {!entry.is_directory && (
                            <>
                                <div className="h-px bg-[var(--ide-border)] my-1" />
                                <button
                                    onClick={() => {
                                        setContextMenu(null);
                                        // Copy path to clipboard
                                        navigator.clipboard.writeText(entry.path);
                                        toast.success("Path copied!");
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-[var(--ide-text)] hover:bg-[var(--ide-bg-hover)] transition-colors"
                                >
                                    <span>📋</span> Copy Path
                                </button>
                            </>
                        )}
                    </div>
                </>
            )}

            <ConfirmModal
                isOpen={deleteConfirmOpen}
                title={entry.is_directory ? "Delete Folder" : "Delete File"}
                message={
                    entry.is_directory
                        ? `Delete "${entry.name}" and all nested files? This action cannot be undone.`
                        : `Delete "${entry.name}"? This action cannot be undone.`
                }
                confirmText="Delete"
                cancelText="Cancel"
                variant="danger"
                isLoading={isDeleting}
                onConfirm={confirmDelete}
                onCancel={() => {
                    if (!isDeleting) {
                        setDeleteConfirmOpen(false);
                    }
                }}
            />
        </div>
    );
};

const FileTree: React.FC = () => {
    const { project, selectedFilePath } = useProjectStore();
    const [entries, setEntries] = useState<FileEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [refreshVersion, setRefreshVersion] = useState(0);
    const [searchFilter, setSearchFilter] = useState("");
    const [showHiddenFiles, setShowHiddenFiles] = useState(false);
    const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);

    const api = useApi();

    const fetchGitStatus = useCallback(async () => {
        if (!project?.root_path) return;
        try {
            const status = await api.gitStatus();
            setGitStatus(status);
        } catch {
            setGitStatus(null);
        }
    }, [api, project?.root_path]);

    const loadRootDirectory = useCallback(async () => {
        if (!project?.root_path) return;

        setLoading(true);
        setError(null);
        try {
            const result = await api.listDirectory();
            // Filter hidden files if needed
            const filtered = showHiddenFiles ? result.entries : result.entries.filter((e) => !e.name.startsWith("."));
            setEntries(filtered);
            setRefreshVersion((prev) => prev + 1);
            fetchGitStatus();
        } catch (err) {
            console.error("Failed to load file tree:", err);
            setError(String(err));
        } finally {
            setLoading(false);
        }
    }, [project?.root_path, api, showHiddenFiles, fetchGitStatus]);

    // Listen for real-time file system changes from Rust
    useEffect(() => {
        let unlisten: (() => void) | undefined;

        const setupListener = async () => {
            try {
                // @ts-ignore - Tauri v2 types might vary depending on setup
                unlisten = await listen("vfs://change", (event) => {
                    console.log("File system changed:", event.payload);
                    loadRootDirectory();
                });
            } catch (err) {
                console.error("Failed to setup file watcher listener:", err);
            }
        };

        setupListener();
        return () => {
            if (unlisten) {
                // If it's a promise (v1) or sync (v2 handle)
                if (typeof unlisten === "function") unlisten();
            }
        };
    }, [loadRootDirectory]);

    useEffect(() => {
        loadRootDirectory();
    }, [loadRootDirectory]); // loadRootDirectory itself changes when project/showHiddenFiles change

    useEffect(() => {
        fetchGitStatus();
    }, [refreshVersion, fetchGitStatus]);

    const handleFileSelect = (path: string) => {
        selectFile(path);
        // If we're not already on the code page, navigate there
        setActivePage("code");
    };

    if (!project) {
        return (
            <div className="px-4 py-8 text-center">
                <div className="w-10 h-10 mx-auto mb-3 rounded-lg bg-[var(--ide-panel)] flex items-center justify-center text-[var(--ide-text-muted)]">
                    📁
                </div>
                <p className="text-[12px] font-medium text-[var(--ide-text-muted)]">No Project</p>
                <p className="mt-1 text-[11px] text-[var(--ide-text-muted)] opacity-60">
                    Open a project to browse files
                </p>
            </div>
        );
    }

    if (!project.root_path) {
        const handlePickFolder = async () => {
            try {
                const folder = await api.pickFolder();
                if (folder) {
                    await api.setProjectRoot(folder);
                    await refreshCurrentProject();
                }
            } catch (err) {
                console.error("Failed to set folder:", err);
            }
        };

        return (
            <div className="px-4 py-6 text-center">
                <div className="w-10 h-10 mx-auto mb-3 rounded-lg bg-[var(--ide-panel)] flex items-center justify-center text-[var(--ide-text-muted)]">
                    📁
                </div>
                <p className="text-[12px] font-medium text-[var(--ide-text)]">Set Project Folder</p>
                <p className="mt-1 text-[11px] text-[var(--ide-text-muted)]">
                    Choose where project files are stored
                </p>
                <button
                    onClick={handlePickFolder}
                    className="mt-3 px-4 py-1.5 text-[11px] font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors"
                >
                    Choose Folder
                </button>
            </div>
        );
    }

    if (loading && entries.length === 0) {
        return (
            <div className="px-4 py-8 text-center">
                <div className="w-6 h-6 mx-auto mb-3 border-2 border-t-transparent border-indigo-500 rounded-full animate-spin" />
                <p className="text-[11px] text-[var(--ide-text-muted)]">Loading files...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="px-4 py-8 text-center">
                <p className="text-[11px] text-red-400">Error: {error}</p>
                <button
                    onClick={loadRootDirectory}
                    className="mt-2 text-[11px] text-indigo-400 hover:text-indigo-300 underline"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full w-full bg-[var(--ide-chrome)]">
            {/* Header with refresh and settings - Compact */}
            <div className="flex-shrink-0 border-b border-[var(--ide-border)]">
                {/* Top row - Buttons only */}
                <div className="flex items-center justify-end px-2 py-1 gap-0.5">
                    <button
                        onClick={() => setShowHiddenFiles(!showHiddenFiles)}
                        className={`p-1.5 rounded transition-colors ${showHiddenFiles
                            ? "text-indigo-400 bg-indigo-500/20"
                            : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-text)]/10"
                            }`}
                        title="Toggle hidden files"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                    </button>
                    <button
                        onClick={loadRootDirectory}
                        className="p-1.5 rounded hover:bg-[var(--ide-text)]/10 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-colors"
                        title="Refresh"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </button>
                </div>

                {/* Breadcrumb path - show root path (Compact) */}
                {project?.root_path && (
                    <div className="px-3 py-1 text-[9px] text-[var(--ide-text-muted)] bg-[var(--ide-panel)] border-t border-[var(--ide-border)] font-mono truncate leading-tight">
                        📁 {project.root_path.split(/[\\/]/).pop() || project.root_path}
                    </div>
                )}
            </div>

            {/* Search bar */}
            <div className="flex-shrink-0 px-2 py-1.5 border-b border-[var(--ide-border)] bg-[var(--ide-chrome)]">
                <div className="relative">
                    <svg className="absolute left-2 top-1.5 w-3.5 h-3.5 text-[var(--ide-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                        type="text"
                        placeholder="Search..."
                        value={searchFilter}
                        onChange={(e) => setSearchFilter(e.target.value)}
                        className="w-full pl-7 pr-2 py-1 text-[11px] bg-[var(--ide-panel)] border border-[var(--ide-border)] rounded text-[var(--ide-text)] placeholder-[var(--ide-text-muted)] outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    />
                </div>
            </div>

            {/* File Tree - Takes all remaining space */}
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
                {entries.length === 0 ? (
                    <div className="px-4 py-8 text-center flex flex-col items-center justify-center h-full">
                        <div className="text-4xl mb-2">📂</div>
                        <p className="text-[11px] text-[var(--ide-text-muted)]">Empty directory</p>
                    </div>
                ) : (
                    <div className="w-full">
                        {entries.map((entry) => (
                            <FileTreeItem
                                key={entry.path}
                                entry={entry}
                                depth={0}
                                onRefresh={loadRootDirectory}
                                onFileSelect={handleFileSelect}
                                selectedPath={selectedFilePath}
                                refreshVersion={refreshVersion}
                                searchFilter={searchFilter}
                                gitStatus={gitStatus}
                                projectRoot={project?.root_path || null}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Footer with statistics - Compact but informative */}
            <div className="flex-shrink-0 px-3 py-1.5 border-t border-[var(--ide-border)] text-[9px] text-[var(--ide-text-muted)] bg-[var(--ide-panel)] space-y-0.5">
                <div className="flex items-center justify-between">
                    <span className="font-medium">
                        {entries.length} item{entries.length !== 1 ? "s" : ""} • {entries.filter((e) => e.is_directory).length} folder{entries.filter((e) => e.is_directory).length !== 1 ? "s" : ""}
                    </span>
                </div>
                <div className="flex items-center justify-between">
                    <span>Size:</span>
                    <span className="font-mono">
                        {formatFileSize(entries.filter((e) => !e.is_directory).reduce((sum, e) => sum + (e.size || 0), 0))}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default FileTree;
