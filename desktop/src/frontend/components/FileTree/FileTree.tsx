import React, { useState, useEffect, useCallback } from "react";
import { useProjectStore } from "../../hooks/useProjectStore";
import { useApi, FileEntry } from "../../hooks/useTauri";
import { refreshCurrentProject, selectFile, setEditMode, setActiveTab } from "../../stores/projectStore";
import PromptModal from "../UI/PromptModal";
import ConfirmModal from "../Modals/ConfirmModal";
import { useToast } from "../../context/ToastContext";

interface FileTreeItemProps {
    entry: FileEntry;
    depth: number;
    onRefresh: () => Promise<void>;
    onFileSelect: (path: string) => void;
    selectedPath: string | null;
    refreshVersion: number;
}

const FileTreeItem: React.FC<FileTreeItemProps> = ({
    entry,
    depth,
    onRefresh,
    onFileSelect,
    selectedPath,
    refreshVersion,
}) => {
    const [expanded, setExpanded] = useState(false);
    const [children, setChildren] = useState<FileEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
    const [createModalType, setCreateModalType] = useState<"file" | "folder" | null>(null);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isRenaming, setIsRenaming] = useState(false);
    const [newName, setNewName] = useState(entry.name);

    const api = useApi();
    const toast = useToast();
    const isSelected = selectedPath === entry.path;

    const loadChildren = useCallback(async () => {
        if (!entry.is_directory) return;

        setLoading(true);
        try {
            const result = await api.listDirectory(entry.path);
            setChildren(result.entries);
        } catch (err) {
            console.error("Failed to load directory:", err);
            setChildren([]);
        } finally {
            setLoading(false);
        }
    }, [entry.is_directory, entry.path, api]);

    // Load children when expanded for the first time.
    useEffect(() => {
        if (entry.is_directory && expanded && children.length === 0) {
            loadChildren();
        }
    }, [expanded, entry.is_directory, children.length, loadChildren]);

    // Reload expanded directories whenever the root refreshes.
    useEffect(() => {
        if (entry.is_directory && expanded) {
            loadChildren();
        }
    }, [refreshVersion, entry.is_directory, expanded, loadChildren]);

    const handleClick = () => {
        if (entry.is_directory) {
            setExpanded(!expanded);
            if (!expanded && children.length === 0) {
                void loadChildren();
            }
        } else {
            onFileSelect(entry.path);
        }
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY });
    };

    const closeContextMenu = () => setContextMenu(null);

    const getParentPath = () => (entry.is_directory ? entry.path : entry.path.split("/").slice(0, -1).join("/"));

    const handleNewFile = () => {
        closeContextMenu();
        setCreateModalType("file");
    };

    const handleNewFolder = () => {
        closeContextMenu();
        setCreateModalType("folder");
    };

    const handleCreateEntry = async (values: Record<string, string>) => {
        const name = values.name?.trim();
        if (!name || !createModalType) return;

        const parentPath = getParentPath();
        const newPath = parentPath ? `${parentPath}/${name}` : name;

        try {
            if (createModalType === "file") {
                await api.createFile(newPath, "");
                toast.success(`File "${name}" created`);
            } else {
                await api.createFolder(newPath);
                toast.success(`Folder "${name}" created`);
            }
            await onRefresh();
        } catch (err) {
            const resource = createModalType === "file" ? "file" : "folder";
            toast.error(`Failed to create ${resource}: ${err}`);
        }
    };

    const handleRename = () => {
        closeContextMenu();
        setIsRenaming(true);
        setNewName(entry.name);
    };

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

    const handleDelete = () => {
        closeContextMenu();
        setDeleteConfirmOpen(true);
    };

    const confirmDelete = async () => {
        setIsDeleting(true);
        try {
            await api.deleteFile(entry.path);
            toast.success(`${entry.is_directory ? "Folder" : "File"} "${entry.name}" deleted`);
            setDeleteConfirmOpen(false);
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
                className={`flex items-center gap-1.5 py-1 px-2 cursor-pointer transition-colors group relative ${isSelected ? "bg-indigo-500/10 text-indigo-400" : "text-[var(--ide-text-secondary)] hover:bg-[var(--ide-bg-hover)]"
                    }`}
                style={{ paddingLeft: `${depth * 12 + 8}px` }}
                onClick={handleClick}
                onContextMenu={handleContextMenu}
            >
                {entry.is_directory ? (
                    <svg
                        className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-90" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                    </svg>
                ) : (
                    <div className="w-3.5" />
                )}

                {/* Icon */}
                <svg className={`w-4 h-4 ${isSelected ? "text-indigo-400" : "text-[var(--ide-text-muted)]"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {entry.is_directory ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    )}
                </svg>

                {/* Name */}
                {isRenaming ? (
                    <input
                        autoFocus
                        className="flex-1 bg-indigo-500/10 border-none outline-none text-[12px] h-5 px-1 py-0"
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
                    <span className="text-[12px] truncate">{entry.name}</span>
                )}
            </div>

            {/* Nested scope */}
            {entry.is_directory && expanded && (
                <div className="flex flex-col">
                    {loading && children.length === 0 ? (
                        <div className="py-1 text-[11px] text-[var(--ide-text-muted)] italic" style={{ paddingLeft: `${(depth + 1) * 12 + 24}px` }}>
                            Loading...
                        </div>
                    ) : (
                        children.map((child) => (
                            <FileTreeItem
                                key={child.path}
                                entry={child}
                                depth={depth + 1}
                                onRefresh={onRefresh}
                                onFileSelect={onFileSelect}
                                selectedPath={selectedPath}
                                refreshVersion={refreshVersion}
                            />
                        ))
                    )}
                </div>
            )}

            {/* Context Menu */}
            {contextMenu && (
                <>
                    <div className="fixed inset-0 z-40" onClick={closeContextMenu} />
                    <div
                        className="fixed z-50 bg-[var(--ide-panel)] border border-[var(--ide-border)] rounded shadow-xl py-1 min-w-[160px]"
                        style={{ top: contextMenu.y, left: contextMenu.x }}
                    >
                        <button
                            onClick={handleNewFile}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-[var(--ide-text)] hover:bg-[var(--ide-bg-hover)] transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            New File
                        </button>
                        <button
                            onClick={handleNewFolder}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-[var(--ide-text)] hover:bg-[var(--ide-bg-hover)] transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                            </svg>
                            New Folder
                        </button>
                        <div className="h-px bg-[var(--ide-border)] my-1" />
                        <button
                            onClick={handleRename}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-[var(--ide-text)] hover:bg-[var(--ide-bg-hover)] transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Rename
                        </button>
                        <button
                            onClick={handleDelete}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-red-500 hover:bg-red-500/10 transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete
                        </button>
                    </div>
                </>
            )}

            <PromptModal
                isOpen={createModalType !== null}
                title={createModalType === "file" ? "Create New File" : "Create New Folder"}
                confirmText={createModalType === "file" ? "Create File" : "Create Folder"}
                fields={[
                    {
                        name: "name",
                        label: createModalType === "file" ? "File Name" : "Folder Name",
                        placeholder: createModalType === "file" ? "new-file.tsx" : "new-folder",
                        required: true,
                    },
                ]}
                onClose={() => setCreateModalType(null)}
                onSubmit={handleCreateEntry}
            />

            <ConfirmModal
                isOpen={deleteConfirmOpen}
                title={entry.is_directory ? "Delete Folder" : "Delete File"}
                message={entry.is_directory
                    ? `Delete "${entry.name}" and all nested files? This action cannot be undone.`
                    : `Delete "${entry.name}"? This action cannot be undone.`}
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

    const api = useApi();

    const loadRootDirectory = useCallback(async () => {
        if (!project?.root_path) return;

        setLoading(true);
        setError(null);
        try {
            const result = await api.listDirectory();
            setEntries(result.entries);
            setRefreshVersion((prev) => prev + 1);
        } catch (err) {
            console.error("Failed to load file tree:", err);
            setError(String(err));
        } finally {
            setLoading(false);
        }
    }, [project?.root_path, api]);

    useEffect(() => {
        loadRootDirectory();
    }, [loadRootDirectory]);

    const handleFileSelect = (path: string) => {
        selectFile(path);
        setEditMode("code");
        setActiveTab("canvas");
    };

    if (!project) {
        return (
            <div className="px-4 py-8 text-center">
                <div className="w-10 h-10 mx-auto mb-3 rounded-lg bg-[var(--ide-panel)] flex items-center justify-center text-[var(--ide-text-muted)]">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
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
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                </div>
                <p className="text-[12px] font-medium text-[var(--ide-text)]">Set Project Folder</p>
                <p className="mt-1 text-[11px] text-[var(--ide-text-muted)]">
                    Choose where project files are stored
                </p>
                <button
                    onClick={handlePickFolder}
                    className="mt-3 px-4 py-1.5 text-[11px] font-medium bg-[var(--ide-text)] text-[var(--ide-bg)] rounded-md hover:opacity-90 transition-opacity"
                >
                    Choose Folder
                </button>
            </div>
        );
    }

    if (loading && entries.length === 0) {
        return (
            <div className="px-4 py-8 text-center">
                <div className="w-6 h-6 mx-auto mb-3 border-2 border-t-transparent border-[var(--ide-text-muted)] rounded-full animate-spin" />
                <p className="text-[11px] text-[var(--ide-text-muted)]">Loading files...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="px-4 py-8 text-center">
                <p className="text-[11px] text-red-500">Error: {error}</p>
                <button
                    onClick={loadRootDirectory}
                    className="mt-2 text-[11px] text-[var(--ide-text)] underline"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="py-1 flex flex-col h-full">
            {/* Header with refresh */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--ide-border)]">
                <span className="text-[11px] font-medium text-[var(--ide-text-muted)] uppercase tracking-wide">
                    Explorer
                </span>
                <button
                    onClick={loadRootDirectory}
                    className="p-1 rounded hover:bg-[var(--ide-text)]/10 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-colors"
                    title="Refresh"
                >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                </button>
            </div>

            {/* File Tree */}
            <div className="flex-1 overflow-y-auto">
                {entries.length === 0 ? (
                    <div className="px-4 py-6 text-center">
                        <p className="text-[11px] text-[var(--ide-text-muted)]">Empty directory</p>
                    </div>
                ) : (
                    entries.map((entry) => (
                        <FileTreeItem
                            key={entry.path}
                            entry={entry}
                            depth={0}
                            onRefresh={loadRootDirectory}
                            onFileSelect={handleFileSelect}
                            selectedPath={selectedFilePath}
                            refreshVersion={refreshVersion}
                        />
                    ))
                )}
            </div>
        </div>
    );
};

export default FileTree;
