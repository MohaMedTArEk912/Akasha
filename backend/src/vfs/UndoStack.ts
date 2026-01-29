import { VFSFile, VFSBlock } from './types';

/**
 * Undo/Redo action types
 */
export type ActionType =
    | 'file_create'
    | 'file_update'
    | 'file_archive'
    | 'file_restore'
    | 'block_create'
    | 'block_update'
    | 'block_delete'
    | 'block_move'
    | 'block_reorder'
    | 'style_change'
    | 'batch';

/**
 * Single action in the undo stack
 */
export interface UndoAction {
    id: string;
    type: ActionType;
    timestamp: Date;
    description: string;
    fileId: string;

    // Before state (for undo)
    before: {
        file?: VFSFile;
        block?: VFSBlock;
        blocks?: VFSBlock[];
    };

    // After state (for redo)
    after: {
        file?: VFSFile;
        block?: VFSBlock;
        blocks?: VFSBlock[];
    };
}

/**
 * UndoStack - Manages undo/redo operations tied to file edits
 * 
 * @description Each file has its own undo stack. This ensures that
 * undo operations are scoped to the file being edited.
 */
export class UndoStack {
    private stacks: Map<string, UndoAction[]> = new Map();
    private redoStacks: Map<string, UndoAction[]> = new Map();
    private maxSize: number;

    constructor(maxSize = 50) {
        this.maxSize = maxSize;
    }

    /**
     * Generate unique ID for action
     */
    private generateId(): string {
        return `undo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get or create stack for file
     */
    private getStack(fileId: string): UndoAction[] {
        if (!this.stacks.has(fileId)) {
            this.stacks.set(fileId, []);
        }
        return this.stacks.get(fileId)!;
    }

    /**
     * Get or create redo stack for file
     */
    private getRedoStack(fileId: string): UndoAction[] {
        if (!this.redoStacks.has(fileId)) {
            this.redoStacks.set(fileId, []);
        }
        return this.redoStacks.get(fileId)!;
    }

    /**
     * Push action to undo stack
     */
    push(action: Omit<UndoAction, 'id' | 'timestamp'>): UndoAction {
        const stack = this.getStack(action.fileId);

        const fullAction: UndoAction = {
            ...action,
            id: this.generateId(),
            timestamp: new Date()
        };

        stack.push(fullAction);

        // Enforce max size
        while (stack.length > this.maxSize) {
            stack.shift();
        }

        // Clear redo stack on new action
        this.redoStacks.set(action.fileId, []);

        return fullAction;
    }

    /**
     * Pop action for undo (moves to redo stack)
     */
    popUndo(fileId: string): UndoAction | null {
        const stack = this.getStack(fileId);
        const action = stack.pop();

        if (action) {
            const redoStack = this.getRedoStack(fileId);
            redoStack.push(action);
        }

        return action || null;
    }

    /**
     * Pop action for redo (moves back to undo stack)
     */
    popRedo(fileId: string): UndoAction | null {
        const redoStack = this.getRedoStack(fileId);
        const action = redoStack.pop();

        if (action) {
            const stack = this.getStack(fileId);
            stack.push(action);
        }

        return action || null;
    }

    /**
     * Peek at the last action without removing
     */
    peek(fileId: string): UndoAction | null {
        const stack = this.getStack(fileId);
        return stack.length > 0 ? stack[stack.length - 1] : null;
    }

    /**
     * Check if undo is available
     */
    canUndo(fileId: string): boolean {
        const stack = this.getStack(fileId);
        return stack.length > 0;
    }

    /**
     * Check if redo is available
     */
    canRedo(fileId: string): boolean {
        const redoStack = this.getRedoStack(fileId);
        return redoStack.length > 0;
    }

    /**
     * Get undo history for file
     */
    getHistory(fileId: string, limit = 10): UndoAction[] {
        const stack = this.getStack(fileId);
        return stack.slice(-limit).reverse();
    }

    /**
     * Clear undo stack for file
     */
    clear(fileId: string): void {
        this.stacks.delete(fileId);
        this.redoStacks.delete(fileId);
    }

    /**
     * Clear all stacks
     */
    clearAll(): void {
        this.stacks.clear();
        this.redoStacks.clear();
    }

    /**
     * Record file update action
     */
    recordFileUpdate(
        fileId: string,
        before: VFSFile,
        after: VFSFile,
        description: string
    ): UndoAction {
        return this.push({
            type: 'file_update',
            description,
            fileId,
            before: { file: before },
            after: { file: after }
        });
    }

    /**
     * Record block create action
     */
    recordBlockCreate(
        fileId: string,
        block: VFSBlock
    ): UndoAction {
        return this.push({
            type: 'block_create',
            description: `Created ${block.type} block`,
            fileId,
            before: {},
            after: { block }
        });
    }

    /**
     * Record block update action
     */
    recordBlockUpdate(
        fileId: string,
        before: VFSBlock,
        after: VFSBlock
    ): UndoAction {
        return this.push({
            type: 'block_update',
            description: `Updated ${after.type} block`,
            fileId,
            before: { block: before },
            after: { block: after }
        });
    }

    /**
     * Record block delete action
     */
    recordBlockDelete(
        fileId: string,
        block: VFSBlock
    ): UndoAction {
        return this.push({
            type: 'block_delete',
            description: `Deleted ${block.type} block`,
            fileId,
            before: { block },
            after: {}
        });
    }

    /**
     * Record style change action
     */
    recordStyleChange(
        fileId: string,
        blockBefore: VFSBlock,
        blockAfter: VFSBlock
    ): UndoAction {
        return this.push({
            type: 'style_change',
            description: 'Style changed',
            fileId,
            before: { block: blockBefore },
            after: { block: blockAfter }
        });
    }

    /**
     * Record batch operation (multiple changes)
     */
    recordBatch(
        fileId: string,
        blocksBefore: VFSBlock[],
        blocksAfter: VFSBlock[],
        description: string
    ): UndoAction {
        return this.push({
            type: 'batch',
            description,
            fileId,
            before: { blocks: blocksBefore },
            after: { blocks: blocksAfter }
        });
    }

    /**
     * Get all file IDs with undo history
     */
    getActiveFiles(): string[] {
        return Array.from(this.stacks.keys()).filter(
            fileId => this.stacks.get(fileId)!.length > 0
        );
    }

    /**
     * Get stats for file
     */
    getStats(fileId: string): { undoCount: number; redoCount: number } {
        return {
            undoCount: this.getStack(fileId).length,
            redoCount: this.getRedoStack(fileId).length
        };
    }
}

// Singleton instance for the application
export const undoStack = new UndoStack();

export default UndoStack;
