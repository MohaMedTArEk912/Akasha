
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { GeneratorService } from '../services/generator.js';
import { SyncService } from '../services/sync.js';
import path from 'path';

const router = Router();
const prisma = new PrismaClient();
const generatorService = new GeneratorService();

// GET /api/codegen/sync - Trigger manual sync for a project
router.post('/sync', async (req, res) => {
    try {
        const { projectId } = req.body;
        if (!projectId) {
            res.status(400).json({ error: 'Project ID required' });
            return;
        }

        const project = await prisma.project.findUnique({ where: { id: projectId } });
        if (!project || !project.rootPath) {
            res.status(404).json({ error: 'Project not found or no root path' });
            return;
        }

        const syncService = new SyncService(project.rootPath);

        // Sync all pages
        const pages = await prisma.page.findMany({ where: { projectId } });
        for (const page of pages) {
            await syncService.syncPageToDisk(page.id, projectId);
        }

        res.json({ success: true, message: 'Project synced to disk' });
    } catch (error) {
        console.error('Sync error:', error);
        res.status(500).json({ error: 'Failed to sync project' });
    }
});

// POST /api/codegen/export - Export project to a specific path (or default)
router.post('/export', async (req, res) => {
    try {
        const { projectId, exportPath } = req.body;
        // If no exportPath, valid only if project has rootPath? or a temp dir?
        // For now, require valid path or use project root

        const project = await prisma.project.findUnique({ where: { id: projectId } });
        if (!project) throw new Error("Project not found");

        const targetDir = exportPath || project.rootPath;
        if (!targetDir) throw new Error("No target directory specified");

        const result = await generatorService.generateFrontend(projectId, targetDir);
        res.json(result);
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ error: 'Failed to export project' });
    }
});

export default router;
