import type { Request, Response } from 'express';
import path from 'node:path';
import prisma from '../lib/prisma.js';
import { GeneratorService } from '../services/generator.js';
import { SyncService } from '../services/sync.js';

const generatorService = new GeneratorService();

export async function syncProject(req: Request, res: Response) {
    try {
        const { projectId } = req.body;
        if (!projectId) { res.status(400).json({ error: 'Project ID required' }); return; }

        const project = await prisma.project.findUnique({ where: { id: projectId } });
        if (!project) {
            res.status(404).json({ error: 'Project not found' });
            return;
        }

        let rootPath = project.rootPath;
        if (!rootPath) {
            rootPath = path.join(process.cwd(), 'projects', projectId);
            try {
                await prisma.project.update({
                    where: { id: projectId },
                    data: { rootPath }
                });
            } catch (dbErr) {
                console.error('Failed to auto-save rootPath during syncProject:', dbErr);
            }
        }

        const syncService = new SyncService(rootPath);
        const pages = await prisma.page.findMany({ where: { projectId: projectId as string } });
        for (const page of pages) {
            await syncService.syncPageToDisk(page.id, projectId);
        }

        res.json({ success: true, message: 'Project synced to disk' });
    } catch (error) {
        console.error('Sync error:', error);
        res.status(500).json({ error: 'Failed to sync project' });
    }
}

export async function exportProject(req: Request, res: Response) {
    try {
        const { projectId, exportPath } = req.body;
        const project = await prisma.project.findUnique({ where: { id: projectId } });
        if (!project) throw new Error("Project not found");

        let targetDir = exportPath || project.rootPath;
        if (!targetDir) {
            targetDir = path.join(process.cwd(), 'projects', projectId);
            try {
                await prisma.project.update({
                    where: { id: projectId },
                    data: { rootPath: targetDir }
                });
            } catch (dbErr) {
                console.error('Failed to auto-save rootPath during exportProject:', dbErr);
            }
        }

        const result = await generatorService.generateFrontend(projectId, targetDir);
        res.json(result);
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ error: 'Failed to export project' });
    }
}
