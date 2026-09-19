import type { Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { simpleGit } from 'simple-git';
import fs from 'fs-extra';
import * as path from 'node:path';

async function getGit(projectId: string) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
        throw new Error('Project not found');
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
            console.error('Failed to auto-save rootPath in getGit:', dbErr);
        }
    }

    if (!fs.existsSync(rootPath)) {
        await fs.ensureDir(rootPath);
    }
    return simpleGit(rootPath);
}

export async function getStatus(req: Request, res: Response) {
    try {
        const { projectId } = req.params;
        const git = await getGit(projectId as string);
        const status = await git.status();
        res.json(status);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
}

export async function getHistory(req: Request, res: Response) {
    try {
        const { projectId } = req.params;
        const limit = req.query.limit ? Number(req.query.limit) : 20;
        const git = await getGit(projectId as string);
        const log = await git.log({ maxCount: limit });
        res.json(log.all);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
}

export async function commitChanges(req: Request, res: Response) {
    try {
        const { projectId } = req.params;
        const { message, files } = req.body;
        const git = await getGit(projectId as string);

        await git.add(files || '.');
        const commit = await git.commit(message);
        res.json(commit);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
}

export async function getDiff(req: Request, res: Response) {
    try {
        const { projectId } = req.params;
        const { commitId } = req.query;
        const git = await getGit(projectId as string);

        const diff = await git.diff(commitId ? [String(commitId)] : []);
        res.send(diff);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
}
