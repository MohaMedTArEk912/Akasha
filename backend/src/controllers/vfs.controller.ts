import { Request, Response } from 'express';
import VFSFileModel from '../models/VFSFile';
import VFSBlockModel from '../models/VFSBlock';
import VFSVersionModel from '../models/VFSVersion';
import { FileRegistry, SafetyGuard, AutoOrganizer, BlockOwnership } from '../vfs';
import { FileType, ProtectionLevel } from '../vfs/types';
import mongoose from 'mongoose';

/**
 * VFS Controller - Handles all virtual file system operations
 * Note: @ts-ignore comments used for Mongoose 9 typing issues
 */

// ============================================================================
// FILE OPERATIONS
// ============================================================================

/**
 * Get all files for a project (tree structure)
 */
export const getProjectFiles = async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;
        const includeArchived = req.query.includeArchived === 'true';

        const query: Record<string, unknown> = { projectId };
        if (!includeArchived) {
            query.isArchived = false;
        }

        // @ts-ignore - Mongoose typing
        const files = await VFSFileModel.find(query).sort({ path: 1 }).lean();

        // @ts-ignore - Derive tree structure
        const tree = AutoOrganizer.deriveTree(files as any);

        // @ts-ignore
        const stats = AutoOrganizer.getOrganizationStats(files as any);

        res.json({
            success: true,
            data: { files, tree, stats }
        });
    } catch (error) {
        console.error('Error fetching project files:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch project files'
        });
    }
};

/**
 * Get single file by ID
 */
export const getFile = async (req: Request, res: Response) => {
    try {
        const { fileId } = req.params;

        // @ts-ignore
        const file = await VFSFileModel.findById(fileId).lean();
        if (!file) {
            return res.status(404).json({
                success: false,
                error: 'File not found'
            });
        }

        // @ts-ignore - Get file capabilities
        const capabilities = SafetyGuard.getFileCapabilities(file as any);

        res.json({
            success: true,
            data: { file, capabilities }
        });
    } catch (error) {
        console.error('Error fetching file:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch file'
        });
    }
};

/**
 * Create new file
 */
export const createFile = async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;
        const { name, type, schema } = req.body;

        if (!name || !type) {
            return res.status(400).json({
                success: false,
                error: 'Name and type are required'
            });
        }

        // Validate file type
        if (!Object.values(FileType).includes(type)) {
            return res.status(400).json({
                success: false,
                error: `Invalid file type: ${type}`
            });
        }

        // Create file with auto-organization
        const fileData = FileRegistry.createFile(projectId as string, name, type, schema || {});

        const file = await VFSFileModel.create({
            ...fileData,
            projectId
        });

        res.status(201).json({
            success: true,
            data: { file }
        });
    } catch (error: any) {
        console.error('Error creating file:', error);

        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                error: 'A file with this path already exists'
            });
        }

        res.status(500).json({
            success: false,
            error: 'Failed to create file'
        });
    }
};

/**
 * Update file
 */
export const updateFile = async (req: Request, res: Response) => {
    try {
        const { fileId } = req.params;
        const updates = req.body;

        // @ts-ignore
        const file = await VFSFileModel.findById(fileId);
        if (!file) {
            return res.status(404).json({
                success: false,
                error: 'File not found'
            });
        }

        // Check permissions
        if (updates.name && file.protection === ProtectionLevel.PROTECTED) {
            return res.status(403).json({
                success: false,
                error: 'Cannot rename protected files'
            });
        }

        // Apply updates
        if (updates.name) {
            file.name = updates.name;
            file.path = FileRegistry.generatePath(file.type as FileType, updates.name);
        }
        if (updates.schema !== undefined) {
            file.dataSchema = updates.schema;
        }

        await file.save();

        res.json({
            success: true,
            data: { file }
        });
    } catch (error) {
        console.error('Error updating file:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update file'
        });
    }
};

/**
 * Move file to new path (validated)
 */
export const moveFile = async (req: Request, res: Response) => {
    try {
        const { fileId } = req.params;
        const { path } = req.body as { path?: string };

        if (!path || typeof path !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Target path is required'
            });
        }

        // @ts-ignore
        const file = await VFSFileModel.findById(fileId);
        if (!file) {
            return res.status(404).json({
                success: false,
                error: 'File not found'
            });
        }

        // Load project files/blocks for guard + snapshot
        // @ts-ignore
        const allFiles = await VFSFileModel.find({ projectId: file.projectId }).lean();
        // @ts-ignore
        const allBlocks = await VFSBlockModel.find({ projectId: file.projectId }).lean();

        // @ts-ignore
        const guard = await SafetyGuard.guardOperation(
            file.toObject() as any,
            'move',
            file.projectId.toString(),
            allFiles as any,
            allBlocks as any
        );

        if (!guard.allowed) {
            return res.status(403).json({
                success: false,
                error: guard.reason || 'Move not allowed'
            });
        }

        const normalizedPath = path.startsWith('/') ? path : `/${path}`;
        const extension = FileRegistry.getExtension(file.type as FileType);

        if (!normalizedPath.endsWith(`.${extension}`)) {
            return res.status(400).json({
                success: false,
                error: `Invalid path extension. Expected .${extension}`
            });
        }

        if (!AutoOrganizer.isValidPathForType(normalizedPath, file.type as FileType)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid path for file type',
                hint: `Suggested path: ${AutoOrganizer.suggestPath(file.toObject() as any)}`
            });
        }

        // Check for existing file conflict
        // @ts-ignore
        const conflict = await VFSFileModel.findOne({
            projectId: file.projectId,
            path: normalizedPath,
            _id: { $ne: file._id },
            isArchived: false
        });

        if (conflict) {
            return res.status(409).json({
                success: false,
                error: 'A file with this path already exists'
            });
        }

        const parsed = FileRegistry.parsePath(normalizedPath);
        file.path = normalizedPath;
        file.name = parsed.name;

        await file.save();

        res.json({
            success: true,
            data: { file }
        });
    } catch (error) {
        console.error('Error moving file:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to move file'
        });
    }
};

/**
 * Delete file (only for free_code files)
 */
export const deleteFile = async (req: Request, res: Response) => {
    try {
        const { fileId } = req.params;

        // @ts-ignore
        const file = await VFSFileModel.findById(fileId);
        if (!file) {
            return res.status(404).json({
                success: false,
                error: 'File not found'
            });
        }

        // Check if delete is allowed
        // @ts-ignore
        const validation = FileRegistry.validateOperation(file.toObject() as any, 'delete');
        if (!validation.success) {
            return res.status(403).json({
                success: false,
                error: validation.error,
                hint: 'Use archive instead of delete for this file type'
            });
        }

        // Delete file and its blocks
        // @ts-ignore
        await VFSBlockModel.deleteMany({ fileId });
        await file.deleteOne();

        res.json({
            success: true,
            message: 'File deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting file:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete file'
        });
    }
};

/**
 * Archive file (safe delete for protected files)
 */
export const archiveFile = async (req: Request, res: Response) => {
    try {
        const { fileId } = req.params;

        // @ts-ignore
        const file = await VFSFileModel.findById(fileId);
        if (!file) {
            return res.status(404).json({
                success: false,
                error: 'File not found'
            });
        }

        // Get all files and blocks for snapshot
        // @ts-ignore
        const allFiles = await VFSFileModel.find({ projectId: file.projectId }).lean();
        // @ts-ignore
        const allBlocks = await VFSBlockModel.find({ projectId: file.projectId }).lean();

        // Create snapshot before archive
        await SafetyGuard.createRiskyOperationSnapshot(
            file.projectId.toString(),
            allFiles as any,
            allBlocks as any,
            'archive'
        );

        // Archive the file
        file.isArchived = true;
        file.archivedAt = new Date();
        await file.save();

        res.json({
            success: true,
            message: 'File archived successfully',
            data: { file }
        });
    } catch (error) {
        console.error('Error archiving file:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to archive file'
        });
    }
};

/**
 * Restore archived file
 */
export const restoreFile = async (req: Request, res: Response) => {
    try {
        const { fileId } = req.params;

        // @ts-ignore
        const file = await VFSFileModel.findById(fileId);
        if (!file) {
            return res.status(404).json({
                success: false,
                error: 'File not found'
            });
        }

        if (!file.isArchived) {
            return res.status(400).json({
                success: false,
                error: 'File is not archived'
            });
        }

        file.isArchived = false;
        file.archivedAt = undefined;
        await file.save();

        res.json({
            success: true,
            message: 'File restored successfully',
            data: { file }
        });
    } catch (error) {
        console.error('Error restoring file:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to restore file'
        });
    }
};

// ============================================================================
// BLOCK OPERATIONS
// ============================================================================

/**
 * Get blocks for a file
 */
export const getFileBlocks = async (req: Request, res: Response) => {
    try {
        const { fileId } = req.params;

        // @ts-ignore
        const blocks = await VFSBlockModel.find({ fileId }).sort({ order: 1 }).lean();

        // @ts-ignore - Build tree structure
        const tree = BlockOwnership.buildBlockTree(fileId, blocks as any);

        res.json({
            success: true,
            data: { blocks, tree }
        });
    } catch (error) {
        console.error('Error fetching file blocks:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch blocks'
        });
    }
};

/**
 * Create block
 */
export const createBlock = async (req: Request, res: Response) => {
    try {
        const { fileId } = req.params;
        const { type, props, styles, parentBlockId } = req.body;

        if (!type) {
            return res.status(400).json({
                success: false,
                error: 'Block type is required'
            });
        }

        // Validate styles are Tailwind-only
        if (styles) {
            const validation = SafetyGuard.validateTailwindStyles(styles);
            if (!validation.valid) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid styles - must use Tailwind classes only',
                    details: validation.errors
                });
            }
        }

        // Get file to extract projectId
        // @ts-ignore
        const file = await VFSFileModel.findById(fileId);
        if (!file) {
            return res.status(404).json({
                success: false,
                error: 'Owner file not found'
            });
        }

        // Get max order for positioning
        // @ts-ignore
        const lastBlock = await VFSBlockModel.findOne({ fileId, parentBlockId })
            .sort({ order: -1 });
        const order = lastBlock ? lastBlock.order + 1 : 0;

        const block = await VFSBlockModel.create({
            fileId,
            projectId: file.projectId,
            type,
            props: props || {},
            styles: styles || { base: [] },
            order,
            parentBlockId
        });

        res.status(201).json({
            success: true,
            data: { block }
        });
    } catch (error: any) {
        console.error('Error creating block:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to create block'
        });
    }
};

/**
 * Update block
 */
export const updateBlock = async (req: Request, res: Response) => {
    try {
        const { blockId } = req.params;
        const updates = req.body;

        // @ts-ignore
        const block = await VFSBlockModel.findById(blockId);
        if (!block) {
            return res.status(404).json({
                success: false,
                error: 'Block not found'
            });
        }

        // Check constraints
        if (block.constraints && !block.constraints.canEdit) {
            return res.status(403).json({
                success: false,
                error: 'This block cannot be edited'
            });
        }

        // Validate styles
        if (updates.styles) {
            const validation = SafetyGuard.validateTailwindStyles(updates.styles);
            if (!validation.valid) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid styles - must use Tailwind classes only',
                    details: validation.errors
                });
            }
        }

        // Check locked props
        if (updates.props && block.constraints?.lockedProps?.length > 0) {
            for (const lockedProp of block.constraints.lockedProps) {
                if (lockedProp in updates.props) {
                    return res.status(403).json({
                        success: false,
                        error: `Property '${lockedProp}' is locked and cannot be modified`
                    });
                }
            }
        }

        // Apply updates
        if (updates.props) block.props = { ...block.props, ...updates.props };
        if (updates.styles) block.styles = updates.styles;
        if (updates.events) block.events = updates.events;
        if (updates.order !== undefined) block.order = updates.order;
        if (updates.parentBlockId !== undefined) block.parentBlockId = updates.parentBlockId;

        await block.save();

        res.json({
            success: true,
            data: { block }
        });
    } catch (error) {
        console.error('Error updating block:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update block'
        });
    }
};

/**
 * Delete block
 */
export const deleteBlock = async (req: Request, res: Response) => {
    try {
        const { blockId } = req.params;

        // @ts-ignore
        const block = await VFSBlockModel.findById(blockId);
        if (!block) {
            return res.status(404).json({
                success: false,
                error: 'Block not found'
            });
        }

        // Check constraints
        if (block.constraints && !block.constraints.canDelete) {
            return res.status(403).json({
                success: false,
                error: 'This block cannot be deleted'
            });
        }

        // Delete children first
        // @ts-ignore
        await VFSBlockModel.deleteMany({ parentBlockId: blockId });
        await block.deleteOne();

        res.json({
            success: true,
            message: 'Block deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting block:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete block'
        });
    }
};

/**
 * Reorder blocks within file
 */
export const reorderBlocks = async (req: Request, res: Response) => {
    try {
        const { fileId } = req.params;
        const { order } = req.body;

        if (!Array.isArray(order)) {
            return res.status(400).json({
                success: false,
                error: 'Order must be an array of block IDs'
            });
        }

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            for (let i = 0; i < order.length; i++) {
                await VFSBlockModel.findByIdAndUpdate(
                    order[i],
                    { order: i },
                    { session }
                );
            }
            await session.commitTransaction();
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }

        res.json({
            success: true,
            message: 'Blocks reordered successfully'
        });
    } catch (error) {
        console.error('Error reordering blocks:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to reorder blocks'
        });
    }
};

// ============================================================================
// VERSION OPERATIONS
// ============================================================================

/**
 * Get versions for project
 */
export const getVersions = async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;
        const limit = parseInt(req.query.limit as string) || 20;

        // @ts-ignore
        const versions = await VFSVersionModel.find({ projectId })
            .sort({ createdAt: -1 })
            .limit(limit)
            .select('-snapshot')
            .lean();

        res.json({
            success: true,
            data: { versions }
        });
    } catch (error) {
        console.error('Error fetching versions:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch versions'
        });
    }
};

/**
 * Create manual version (named snapshot)
 */
export const createVersion = async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;
        const { label } = req.body;

        // @ts-ignore
        const files = await VFSFileModel.find({ projectId }).lean();
        // @ts-ignore
        const blocks = await VFSBlockModel.find({ projectId }).lean();

        const version = await VFSVersionModel.create({
            projectId,
            label: label || `Version ${new Date().toISOString()}`,
            snapshot: {
                files: files as any[],
                blocks: blocks as any[]
            },
            trigger: 'manual'
        });

        res.status(201).json({
            success: true,
            data: {
                version: {
                    _id: version._id,
                    label: version.label,
                    trigger: version.trigger,
                    createdAt: version.createdAt
                }
            }
        });
    } catch (error) {
        console.error('Error creating version:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create version'
        });
    }
};

/**
 * Restore version
 */
export const restoreVersion = async (req: Request, res: Response) => {
    try {
        const { versionId } = req.params;

        // @ts-ignore
        const version = await VFSVersionModel.findById(versionId);
        if (!version) {
            return res.status(404).json({
                success: false,
                error: 'Version not found'
            });
        }

        const projectId = version.projectId;

        // Create backup snapshot before restore
        // @ts-ignore
        const currentFiles = await VFSFileModel.find({ projectId }).lean();
        // @ts-ignore
        const currentBlocks = await VFSBlockModel.find({ projectId }).lean();

        await SafetyGuard.createRiskyOperationSnapshot(
            projectId.toString(),
            currentFiles as any,
            currentBlocks as any,
            'restore_version'
        );

        // Clear current state
        // @ts-ignore
        await VFSFileModel.deleteMany({ projectId });
        // @ts-ignore
        await VFSBlockModel.deleteMany({ projectId });

        // Restore from snapshot
        if (version.snapshot.files.length > 0) {
            await VFSFileModel.insertMany(version.snapshot.files);
        }
        if (version.snapshot.blocks.length > 0) {
            await VFSBlockModel.insertMany(version.snapshot.blocks);
        }

        res.json({
            success: true,
            message: 'Version restored successfully'
        });
    } catch (error) {
        console.error('Error restoring version:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to restore version'
        });
    }
};
