import { VFSBlock, VFSFile } from './types';

/**
 * BlockOwnership - Ensures blocks always belong to a file
 * 
 * @description CRITICAL: No orphan blocks allowed in the system.
 * Every block must have an owner file. This service manages
 * the relationship between blocks and their owning files.
 */
export class BlockOwnership {
    /**
     * Validate block has owner file
     * @param block - The block to validate
     * @param files - All files in the project
     * @returns true if owner file exists
     */
    static validateOwnership(block: VFSBlock, files: VFSFile[]): boolean {
        const ownerFile = files.find(f => f.id === block.fileId);
        if (!ownerFile) {
            console.error(`CRITICAL: Orphan block detected: ${block.id} (fileId: ${block.fileId})`);
            return false;
        }
        return true;
    }

    /**
     * Validate all blocks have owner files
     * @param blocks - All blocks to validate
     * @param files - All files in the project
     * @returns Object with valid and orphan blocks
     */
    static validateAllOwnership(
        blocks: VFSBlock[],
        files: VFSFile[]
    ): { valid: VFSBlock[]; orphans: VFSBlock[] } {
        const fileIds = new Set(files.map(f => f.id));
        const valid: VFSBlock[] = [];
        const orphans: VFSBlock[] = [];

        for (const block of blocks) {
            if (fileIds.has(block.fileId)) {
                valid.push(block);
            } else {
                orphans.push(block);
                console.error(`CRITICAL: Orphan block: ${block.id} (fileId: ${block.fileId})`);
            }
        }

        return { valid, orphans };
    }

    /**
     * Get owner file for block
     * @param block - The block
     * @param files - All files in the project
     * @returns The owner file or null if not found
     */
    static getOwnerFile(block: VFSBlock, files: VFSFile[]): VFSFile | null {
        return files.find(f => f.id === block.fileId) || null;
    }

    /**
     * Get all blocks for a file
     * @param fileId - The file ID
     * @param blocks - All blocks in the project
     * @returns Blocks belonging to the file, sorted by order
     */
    static getFileBlocks(fileId: string, blocks: VFSBlock[]): VFSBlock[] {
        return blocks
            .filter(b => b.fileId === fileId)
            .sort((a, b) => a.order - b.order);
    }

    /**
     * Get root blocks for a file (no parent)
     * @param fileId - The file ID
     * @param blocks - All blocks in the project
     * @returns Root-level blocks belonging to the file
     */
    static getRootBlocks(fileId: string, blocks: VFSBlock[]): VFSBlock[] {
        return blocks
            .filter(b => b.fileId === fileId && !b.parentBlockId)
            .sort((a, b) => a.order - b.order);
    }

    /**
     * Get child blocks for a parent block
     * @param parentBlockId - The parent block ID
     * @param blocks - All blocks
     * @returns Child blocks, sorted by order
     */
    static getChildBlocks(parentBlockId: string, blocks: VFSBlock[]): VFSBlock[] {
        return blocks
            .filter(b => b.parentBlockId === parentBlockId)
            .sort((a, b) => a.order - b.order);
    }

    /**
     * Build block tree for a file
     * @param fileId - The file ID
     * @param blocks - All blocks
     * @returns Nested tree structure
     */
    static buildBlockTree(fileId: string, blocks: VFSBlock[]): BlockTreeNode[] {
        const fileBlocks = this.getFileBlocks(fileId, blocks);
        const blockMap = new Map(fileBlocks.map(b => [b.id, b]));

        const buildChildren = (parentId?: string): BlockTreeNode[] => {
            return fileBlocks
                .filter(b => b.parentBlockId === parentId)
                .sort((a, b) => a.order - b.order)
                .map(block => ({
                    block,
                    children: buildChildren(block.id)
                }));
        };

        return buildChildren(undefined);
    }

    /**
     * Transfer blocks when converting section → component
     * @param blocks - All blocks
     * @param fromFileId - Source file ID
     * @param toFileId - Target file ID
     * @returns Updated blocks array
     */
    static transferBlocks(
        blocks: VFSBlock[],
        fromFileId: string,
        toFileId: string
    ): VFSBlock[] {
        return blocks.map(block => {
            if (block.fileId === fromFileId) {
                return { ...block, fileId: toFileId };
            }
            return block;
        });
    }

    /**
     * Transfer specific blocks to new file
     * @param blocks - All blocks
     * @param blockIds - IDs of blocks to transfer
     * @param toFileId - Target file ID
     * @returns Updated blocks array
     */
    static transferSpecificBlocks(
        blocks: VFSBlock[],
        blockIds: string[],
        toFileId: string
    ): VFSBlock[] {
        const idsToTransfer = new Set(blockIds);
        return blocks.map(block => {
            if (idsToTransfer.has(block.id)) {
                return { ...block, fileId: toFileId };
            }
            return block;
        });
    }

    /**
     * Count blocks per file
     * @param blocks - All blocks
     * @returns Map of fileId to block count
     */
    static countBlocksPerFile(blocks: VFSBlock[]): Map<string, number> {
        const counts = new Map<string, number>();
        for (const block of blocks) {
            counts.set(block.fileId, (counts.get(block.fileId) || 0) + 1);
        }
        return counts;
    }

    /**
     * Reorder blocks within a file
     * @param blocks - All blocks
     * @param fileId - The file ID
     * @param newOrder - Array of block IDs in new order
     * @returns Updated blocks array
     */
    static reorderBlocks(
        blocks: VFSBlock[],
        fileId: string,
        newOrder: string[]
    ): VFSBlock[] {
        const orderMap = new Map(newOrder.map((id, index) => [id, index]));

        return blocks.map(block => {
            if (block.fileId === fileId && orderMap.has(block.id)) {
                return { ...block, order: orderMap.get(block.id)! };
            }
            return block;
        });
    }
}

/**
 * Block tree node for hierarchical representation
 */
export interface BlockTreeNode {
    block: VFSBlock;
    children: BlockTreeNode[];
}
