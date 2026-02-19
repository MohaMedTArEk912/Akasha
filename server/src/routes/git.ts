
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { simpleGit } from 'simple-git';
import fs from 'fs-extra';
import path from 'path';

const router = Router();
const prisma = new PrismaClient();

// Helper to get git instance for a project
async function getGit(projectId: string) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project || !project.rootPath) {
        throw new Error('Project not tracked in git');
    }
    // Ensure path exists
    if (!fs.existsSync(project.rootPath)) {
        throw new Error('Project path does not exist');
    }
    return simpleGit(project.rootPath);
}

// GET /api/git/status
router.get('/:projectId/status', async (req, res) => {
    try {
        const { projectId } = req.params;
        const git = await getGit(projectId);
        const status = await git.status();
        res.json(status);
    } catch (error: any) {
        // console.error('Git status error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/git/history
router.get('/:projectId/history', async (req, res) => {
    try {
        const { projectId } = req.params;
        const limit = req.query.limit ? Number(req.query.limit) : 20;
        const git = await getGit(projectId);
        const log = await git.log({ maxCount: limit });
        res.json(log.all);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/git/commit
router.post('/:projectId/commit', async (req, res) => {
    try {
        const { projectId } = req.params;
        const { message, files } = req.body; // files array or '.'
        const git = await getGit(projectId);

        await git.add(files || '.');
        const commit = await git.commit(message);
        res.json(commit);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/git/diff
router.get('/:projectId/diff', async (req, res) => {
    try {
        const { projectId } = req.params;
        const { commitId } = req.query; // optional, defaults to working tree
        const git = await getGit(projectId);

        const diff = await git.diff(commitId ? [String(commitId)] : []);
        res.send(diff); // Return raw diff string
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
