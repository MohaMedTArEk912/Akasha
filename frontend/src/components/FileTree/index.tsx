import React, { useState, useCallback, useMemo } from 'react';
import {
    Folder,
    FolderOpen,
    File,
    FileCode,
    Layout,
    Box,
    Workflow,
    Database,
    Settings,
    Palette,
    Lock,
    ChevronRight,
    ChevronDown,
    MoreVertical,
    Trash2,
    Edit2,
    Copy,
    Archive,
    RotateCcw,
    ExternalLink
} from 'lucide-react';
import { DragProvider, DraggableFile, DropZone } from './DragMove';
// Remove CSS import
// import './FileTree.css';

// ============================================================================
// TYPES
// ============================================================================

export interface VFSFile {
    _id: string;
    id?: string;
    name: string;
    path: string;
    type: string;
    protection: 'protected' | 'semi_editable' | 'free_code';
    isArchived: boolean;
    schema?: Record<string, unknown>;
}

export interface FolderNode {
    name: string;
    path: string;
    children: FolderNode[];
    files: VFSFile[];
}

export interface FileTreeProps {
    tree: FolderNode;
    selectedPath?: string;
    onFileSelect: (file: VFSFile) => void;
    onFileAction: (file: VFSFile, action: FileAction) => void;
    currentFileId?: string;
    onFileMove?: (file: VFSFile, newPath: string) => Promise<void>;
}

export type FileAction =
    | 'open'
    | 'rename'
    | 'duplicate'
    | 'delete'
    | 'archive'
    | 'restore'
    | 'export';

// ============================================================================
// FILE ICON MAPPING
// ============================================================================

const FILE_ICONS: Record<string, React.ElementType> = {
    page: Layout,
    component: Box,
    comp: Box,
    flow: Workflow,
    store: Database,
    config: Settings,
    tokens: Palette,
    css: FileCode,
    js: FileCode,
    inject: FileCode,
};

const PROTECTION_STYLES: Record<string, { className: string; label: string }> = {
    protected: { className: 'text-amber-500', label: 'Managed by editor' },
    semi_editable: { className: 'text-blue-500', label: 'Form-editable only' },
    free_code: { className: 'text-green-500', label: 'Freely editable' },
};

export const FileTree: React.FC<FileTreeProps> = ({
    tree,
    selectedPath,
    onFileSelect,
    onFileAction,
    currentFileId,
    onFileMove,
}) => {
    return (
        <DragProvider onMove={onFileMove}>
            <div className="h-full overflow-auto text-[13px] text-slate-400 select-none" role="tree" aria-label="Project files">
                <FolderItem
                    folder={tree}
                    level={0}
                    selectedPath={selectedPath}
                    onFileSelect={onFileSelect}
                    onFileAction={onFileAction}
                    currentFileId={currentFileId}
                    onFileMove={onFileMove}
                />
            </div>
        </DragProvider>
    );
};

// ============================================================================
// FOLDER COMPONENT
// ============================================================================

interface FolderItemProps {
    folder: FolderNode;
    level: number;
    selectedPath?: string;
    onFileSelect: (file: VFSFile) => void;
    onFileAction: (file: VFSFile, action: FileAction) => void;
    currentFileId?: string;
    onFileMove?: (file: VFSFile, newPath: string) => Promise<void>;
}

const FolderItem: React.FC<FolderItemProps> = ({
    folder,
    level,
    selectedPath,
    onFileSelect,
    onFileAction,
    currentFileId,
    onFileMove,
}) => {
    const [isOpen, setIsOpen] = useState(level < 2);

    const hasChildren = folder.children.length > 0 || folder.files.length > 0;
    const paddingLeft = level * 12;

    const handleToggle = useCallback(() => {
        setIsOpen(prev => !prev);
    }, []);

    // Don't render root folder header
    if (level === 0) {
        return (
            <DropZone
                path={folder.path}
                onDrop={(file, newPath) => onFileMove?.(file, newPath)}
            >
                <div className="w-full">
                    {folder.children.map((child) => (
                        <FolderItem
                            key={child.path}
                            folder={child}
                            level={level + 1}
                            selectedPath={selectedPath}
                            onFileSelect={onFileSelect}
                            onFileAction={onFileAction}
                            currentFileId={currentFileId}
                            onFileMove={onFileMove}
                        />
                    ))}
                    {folder.files.map((file) => (
                        <FileItem
                            key={file._id || file.path}
                            file={file}
                            level={level + 1}
                            isSelected={file.path === selectedPath}
                            isCurrent={file._id === currentFileId}
                            onSelect={onFileSelect}
                            onAction={onFileAction}
                        />
                    ))}
                </div>
            </DropZone>
        );
    }

    return (
        <div className="w-full" role="treeitem" aria-expanded={isOpen}>
            <button
                className="flex items-center gap-1 w-full px-2 py-1 bg-transparent border-none text-inherit cursor-pointer text-left rounded hover:bg-white/5 focus:outline-none focus:bg-white/10 transition-colors duration-150"
                style={{ paddingLeft: `${paddingLeft}px` }}
                onClick={handleToggle}
                aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${folder.name} folder`}
            >
                <span className="flex items-center justify-center shrink-0 text-slate-500">
                    {hasChildren ? (
                        isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />
                    ) : (
                        <span style={{ width: 14 }} />
                    )}
                </span>
                <span className="flex items-center justify-center shrink-0 text-amber-400">
                    {isOpen ? (
                        <FolderOpen size={16} />
                    ) : (
                        <Folder size={16} />
                    )}
                </span>
                <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap font-medium text-slate-300">
                    {folder.name}
                </span>
            </button>

            {isOpen && (
                <DropZone
                    path={folder.path}
                    onDrop={(file, newPath) => onFileMove?.(file, newPath)}
                >
                    <div className="w-full" role="group">
                        {folder.children.map((child) => (
                            <FolderItem
                                key={child.path}
                                folder={child}
                                level={level + 1}
                                selectedPath={selectedPath}
                                onFileSelect={onFileSelect}
                                onFileAction={onFileAction}
                                currentFileId={currentFileId}
                                onFileMove={onFileMove}
                            />
                        ))}
                        {folder.files.map((file) => (
                            <FileItem
                                key={file._id || file.path}
                                file={file}
                                level={level + 1}
                                isSelected={file.path === selectedPath}
                                isCurrent={file._id === currentFileId}
                                onSelect={onFileSelect}
                                onAction={onFileAction}
                            />
                        ))}
                    </div>
                </DropZone>
            )}
        </div>
    );
};

// ============================================================================
// FILE COMPONENT
// ============================================================================

interface FileItemProps {
    file: VFSFile;
    level: number;
    isSelected: boolean;
    isCurrent: boolean;
    onSelect: (file: VFSFile) => void;
    onAction: (file: VFSFile, action: FileAction) => void;
}

const FileItem: React.FC<FileItemProps> = ({
    file,
    level,
    isSelected,
    isCurrent,
    onSelect,
    onAction,
}) => {
    const [showMenu, setShowMenu] = useState(false);

    const Icon = FILE_ICONS[file.type] || File;
    // Updated colors to match existing theme variables but with direct Tailwind classes usually prefereable or inline styles if dynamic
    // Logic: we keep inline style for color to support dynamic prop-based coloring from the logic above
    const protectionStyle = PROTECTION_STYLES[file.protection] || PROTECTION_STYLES.free_code;

    // Convert css vars to approximate tailwind colors for fallback/reference: 
    // warning->amber-500, info->blue-500, success->green-500

    const isProtected = file.protection === 'protected';
    const canDelete = file.protection === 'free_code';
    const canRename = file.protection !== 'protected';

    const paddingLeft = (level + 1) * 12;

    const handleClick = useCallback(() => {
        onSelect(file);
    }, [file, onSelect]);

    const handleContextMenu = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setShowMenu(true);
    }, []);

    const handleMenuClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setShowMenu(prev => !prev);
    }, []);

    const handleAction = useCallback((action: FileAction) => {
        onAction(file, action);
        setShowMenu(false);
    }, [file, onAction]);

    const closeMenu = useCallback(() => {
        setShowMenu(false);
    }, []);

    // Memoize menu items based on file permissions
    const menuItems = useMemo(() => {
        const items: Array<{
            icon: React.ElementType;
            label: string;
            action: FileAction;
            danger?: boolean;
            disabled?: boolean;
        }> = [
                { icon: ExternalLink, label: 'Open in Editor', action: 'open' },
                { icon: Copy, label: 'Duplicate', action: 'duplicate' },
            ];

        if (canRename) {
            items.push({ icon: Edit2, label: 'Rename', action: 'rename' });
        }

        items.push({ icon: ExternalLink, label: 'Export', action: 'export' });

        if (file.isArchived) {
            items.push({ icon: RotateCcw, label: 'Restore', action: 'restore' });
        } else if (canDelete) {
            items.push({ icon: Trash2, label: 'Delete', action: 'delete', danger: true });
        } else {
            items.push({ icon: Archive, label: 'Archive', action: 'archive' });
        }

        return items;
    }, [canRename, canDelete, file.isArchived]);

    return (
        <DraggableFile file={file}>
            <div
                className={`
                    flex items-center gap-1 px-2 py-1 cursor-pointer rounded transition-colors relative group outline-none
                    hover:bg-white/5 focus:bg-white/10
                    ${isSelected ? 'bg-indigo-500/20 hover:bg-indigo-500/25' : ''}
                    ${isCurrent ? 'bg-indigo-500/15 border-l-2 border-indigo-500' : ''}
                    ${file.isArchived ? 'opacity-50' : ''}
                `}
                style={{ paddingLeft: `${paddingLeft}px` }}
                onClick={handleClick}
                onContextMenu={handleContextMenu}
                role="treeitem"
                aria-selected={isSelected}
                tabIndex={0}
            >
                <span
                    className={`flex items-center justify-center shrink-0 ${protectionStyle.className}`}
                    title={protectionStyle.label}
                >
                    <Icon size={16} />
                </span>

                <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap" title={file.name}>
                    {file.name}
                </span>

                {isCurrent && (
                    <span className="text-indigo-500 text-lg leading-none px-1 rounded font-bold" title="Currently editing">
                        •
                    </span>
                )}

                {isProtected && (
                    <span
                        className="flex items-center justify-center shrink-0 text-slate-500 opacity-60"
                        title="Managed by editor"
                        aria-label="This file is managed by the editor"
                    >
                        <Lock size={12} />
                    </span>
                )}

                <button
                    className="flex items-center justify-center p-0.5 bg-transparent border-none text-slate-500 cursor-pointer rounded opacity-0 group-hover:opacity-100 transition-all hover:bg-white/10 hover:text-white"
                    onClick={handleMenuClick}
                    aria-label="File actions"
                    aria-haspopup="menu"
                    aria-expanded={showMenu}
                >
                    <MoreVertical size={14} />
                </button>

                {/* Context Menu */}
                {showMenu && (
                    <>
                        <div
                            className="fixed inset-0 z-[100]"
                            onClick={closeMenu}
                            aria-hidden="true"
                        />
                        <div
                            className="absolute right-0 top-full min-w-[160px] bg-[#21262d] border border-[#30363d] rounded-md shadow-xl z-[101] py-1 animate-in fade-in slide-in-from-top-1"
                            role="menu"
                            aria-label="File actions"
                        >
                            {menuItems.map((item) => (
                                <button
                                    key={item.action}
                                    className={`
                                        flex items-center gap-2 w-full px-3 py-2 bg-transparent border-none cursor-pointer text-left text-[13px] transition-colors
                                        ${item.disabled
                                            ? 'opacity-50 cursor-not-allowed'
                                            : item.danger
                                                ? 'text-red-400 hover:bg-red-500/10'
                                                : 'text-slate-300 hover:bg-white/5'
                                        }
                                    `}
                                    onClick={() => !item.disabled && handleAction(item.action)}
                                    role="menuitem"
                                    disabled={item.disabled}
                                >
                                    <item.icon size={14} />
                                    <span>{item.label}</span>
                                </button>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </DraggableFile>
    );
};

export default FileTree;
