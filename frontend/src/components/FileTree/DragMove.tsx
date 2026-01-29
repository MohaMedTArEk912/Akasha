import React, { useState, useCallback, useRef } from 'react';
import { VFSFile, FolderNode } from './index';
// import './DragMove.css';

// ============================================================================
// TYPES
// ============================================================================

export interface DragItem {
    file: VFSFile;
    sourcePath: string;
}

export interface DropTarget {
    path: string;
    isFolder: boolean;
}

export interface DragMoveResult {
    allowed: boolean;
    newPath: string;
    reason?: string;
}

export interface DragMoveProps {
    onDragStart?: (item: DragItem) => void;
    onDragEnd?: (item: DragItem, target: DropTarget | null) => void;
    onDrop?: (item: DragItem, target: DropTarget) => Promise<DragMoveResult>;
    validateDrop?: (item: DragItem, target: DropTarget) => DragMoveResult;
}

// ============================================================================
// SAFETY RULES FOR DRAG-TO-MOVE
// ============================================================================

/**
 * Protection level to folder mapping
 * Protected files can only be moved within their designated folders
 */
const PROTECTED_FOLDERS: Record<string, string[]> = {
    page: ['/pages'],
    component: ['/components'],
    comp: ['/components'],
    flow: ['/logic'],
    store: ['/data'],
    config: ['/config'],
    tokens: ['/styles'],
};

/**
 * Check if a move is allowed based on safety rules
 */
export function validateMove(file: VFSFile, targetPath: string): DragMoveResult {
    // Rule 1: Archived files cannot be moved
    if (file.isArchived) {
        return {
            allowed: false,
            newPath: file.path,
            reason: 'Cannot move archived files. Restore first.'
        };
    }

    // Rule 2: Protected files can only be in designated folders
    if (file.protection === 'protected') {
        const allowedFolders = PROTECTED_FOLDERS[file.type] || [];
        const targetFolder = '/' + targetPath.split('/').slice(0, 2).join('/').replace(/^\/+/, '');

        const isAllowedFolder = allowedFolders.some(folder =>
            targetPath.startsWith(folder) || targetFolder.startsWith(folder)
        );

        if (!isAllowedFolder && allowedFolders.length > 0) {
            return {
                allowed: false,
                newPath: file.path,
                reason: `${file.type} files must stay in ${allowedFolders.join(' or ')}`
            };
        }
    }

    // Rule 3: Validate path format
    if (!targetPath.startsWith('/') || targetPath.includes('..')) {
        return {
            allowed: false,
            newPath: file.path,
            reason: 'Invalid target path'
        };
    }

    // Rule 4: Can't move to same location
    if (file.path === targetPath) {
        return {
            allowed: false,
            newPath: file.path,
            reason: 'File is already in this location'
        };
    }

    // Move is allowed
    const fileName = file.name;
    const currentExt = file.path.includes('.')
        ? file.path.substring(file.path.lastIndexOf('.') + 1)
        : '';
    const withExt = currentExt ? `${fileName}.${currentExt}` : fileName;
    const newPath = targetPath.endsWith('/')
        ? `${targetPath}${withExt}`
        : `${targetPath}/${withExt}`;

    return {
        allowed: true,
        newPath
    };
}

// ============================================================================
// DRAG CONTEXT
// ============================================================================

interface DragContextValue {
    dragItem: DragItem | null;
    dropTarget: DropTarget | null;
    isDragging: boolean;
    setDragItem: (item: DragItem | null) => void;
    setDropTarget: (target: DropTarget | null) => void;
    validateDrop: (item: DragItem, target: DropTarget) => DragMoveResult;
}

export const DragContext = React.createContext<DragContextValue>({
    dragItem: null,
    dropTarget: null,
    isDragging: false,
    setDragItem: () => { },
    setDropTarget: () => { },
    validateDrop: () => ({ allowed: false, newPath: '' })
});

// ============================================================================
// DRAG PROVIDER
// ============================================================================

interface DragProviderProps {
    children: React.ReactNode;
    onMove?: (file: VFSFile, newPath: string) => Promise<void>;
}

export const DragProvider: React.FC<DragProviderProps> = ({ children, onMove }) => {
    const [dragItem, setDragItem] = useState<DragItem | null>(null);
    const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

    const handleValidateDrop = useCallback((item: DragItem, target: DropTarget): DragMoveResult => {
        return validateMove(item.file, target.path);
    }, []);

    const contextValue: DragContextValue = {
        dragItem,
        dropTarget,
        isDragging: dragItem !== null,
        setDragItem,
        setDropTarget,
        validateDrop: handleValidateDrop
    };

    return (
        <DragContext.Provider value={contextValue}>
            {children}
        </DragContext.Provider>
    );
};

// Remove CSS import
// import './DragMove.css'; 

// ... (Types and Context remain unchanged, skipping to DraggableFile)

// ============================================================================
// DRAGGABLE FILE
// ============================================================================

interface DraggableFileProps {
    file: VFSFile;
    children: React.ReactNode;
    disabled?: boolean;
}

export const DraggableFile: React.FC<DraggableFileProps> = ({ file, children, disabled }) => {
    const { setDragItem, isDragging } = React.useContext(DragContext);
    const elementRef = useRef<HTMLDivElement>(null);

    const handleDragStart = useCallback((e: React.DragEvent) => {
        if (disabled || file.protection === 'protected') {
            e.preventDefault();
            return;
        }

        e.dataTransfer.setData('application/json', JSON.stringify(file));
        e.dataTransfer.effectAllowed = 'move';

        setDragItem({
            file,
            sourcePath: file.path
        });
    }, [file, disabled, setDragItem]);

    const handleDragEnd = useCallback(() => {
        setDragItem(null);
    }, [setDragItem]);

    const canDrag = !disabled && file.protection !== 'protected';

    return (
        <div
            ref={elementRef}
            draggable={canDrag}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            className={`
                transition-all duration-150
                ${canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-not-allowed opacity-70'}
                ${isDragging ? 'opacity-50' : ''}
            `}
        >
            <div className="flex items-center">
                {children}
                {!canDrag && <span className="ml-1 text-[10px]">🔒</span>}
            </div>
        </div>
    );
};

// ============================================================================
// DROP ZONE (Folder)
// ============================================================================

interface DropZoneProps {
    path: string;
    children: React.ReactNode;
    onDrop?: (file: VFSFile, newPath: string) => void;
}

export const DropZone: React.FC<DropZoneProps> = ({ path, children, onDrop }) => {
    const { dragItem, setDropTarget, validateDrop } = React.useContext(DragContext);
    const [isOver, setIsOver] = useState(false);
    const [isValid, setIsValid] = useState(false);
    const [message, setMessage] = useState<string>('');

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (!dragItem) return;

        const target: DropTarget = { path, isFolder: true };
        const result = validateDrop(dragItem, target);

        setIsOver(true);
        setIsValid(result.allowed);
        setMessage(result.allowed ? '✓ Drop here' : (result.reason || '✕ Cannot drop here'));
        setDropTarget(target);

        e.dataTransfer.dropEffect = result.allowed ? 'move' : 'none';
    }, [dragItem, path, validateDrop, setDropTarget]);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsOver(false);
        setDropTarget(null);
    }, [setDropTarget]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        setIsOver(false);
        setDropTarget(null);

        if (!dragItem) return;

        const target: DropTarget = { path, isFolder: true };
        const result = validateDrop(dragItem, target);

        if (result.allowed && onDrop) {
            onDrop(dragItem.file, result.newPath);
        }
    }, [dragItem, path, validateDrop, setDropTarget, onDrop]);

    return (
        <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative transition-colors duration-150 ${isOver
                    ? isValid
                        ? 'bg-green-500/15 ring-2 ring-inset ring-green-500/50'
                        : 'bg-red-500/10 ring-2 ring-inset ring-red-500/40'
                    : ''
                }`}
        >
            {children}

            {/* Drop Indicator Overlay */}
            {isOver && (
                <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
                    <div className={`px-3 py-1 rounded text-xs font-medium text-white shadow-sm ${isValid ? 'bg-green-500/90' : 'bg-red-500/90'
                        }`}>
                        {message}
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================================================
// EXPORTS
// ============================================================================

export default {
    DragProvider,
    DraggableFile,
    DropZone,
    DragContext,
    validateMove
};
