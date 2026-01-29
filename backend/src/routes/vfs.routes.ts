import { Router } from 'express';
import * as vfsController from '../controllers/vfs.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

// All VFS routes require authentication
router.use(protect);

// ============================================================================
// FILE ROUTES
// ============================================================================

// Get all files for project (with tree structure)
router.get('/project/:projectId/files', vfsController.getProjectFiles);

// Get single file
router.get('/file/:fileId', vfsController.getFile);

// Create file
router.post('/project/:projectId/file', vfsController.createFile);

// Update file
router.put('/file/:fileId', vfsController.updateFile);

// Move file
router.put('/file/:fileId/move', vfsController.moveFile);

// Delete file (only for free_code files)
router.delete('/file/:fileId', vfsController.deleteFile);

// Archive file (safe delete)
router.post('/file/:fileId/archive', vfsController.archiveFile);

// Restore archived file
router.post('/file/:fileId/restore', vfsController.restoreFile);

// ============================================================================
// BLOCK ROUTES
// ============================================================================

// Get blocks for file (with tree structure)
router.get('/file/:fileId/blocks', vfsController.getFileBlocks);

// Create block in file
router.post('/file/:fileId/block', vfsController.createBlock);

// Update block
router.put('/block/:blockId', vfsController.updateBlock);

// Delete block
router.delete('/block/:blockId', vfsController.deleteBlock);

// Reorder blocks in file
router.put('/file/:fileId/blocks/reorder', vfsController.reorderBlocks);

// ============================================================================
// VERSION ROUTES
// ============================================================================

// Get versions for project
router.get('/project/:projectId/versions', vfsController.getVersions);

// Create named version
router.post('/project/:projectId/version', vfsController.createVersion);

// Restore version
router.post('/version/:versionId/restore', vfsController.restoreVersion);

export default router;
