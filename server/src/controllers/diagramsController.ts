import type { Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import * as fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import * as path from 'node:path';

async function getProjectRoot(projectId: string) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new Error('Project not found');

    if (project.rootPath) return project.rootPath;

    const fallbackRoot = path.join(process.cwd(), 'projects', projectId);
    await fs.mkdir(fallbackRoot, { recursive: true });

    try {
        await prisma.project.update({
            where: { id: projectId },
            data: { rootPath: fallbackRoot }
        });
    } catch (dbErr) {
        console.error('Failed to auto-save rootPath in getProjectRoot:', dbErr);
    }

    return fallbackRoot;
}

export async function listDiagrams(req: Request, res: Response) {
    try {
        const { projectId } = req.query;

        if (!projectId || typeof projectId !== 'string') {
            res.status(400).json({ error: 'Project ID required' });
            return;
        }

        // 1. Fetch from DB
        const dbDiagrams = await prisma.diagram.findMany({
            where: { projectId }
        });

        // 2. Fallback to disk migration if DB is empty
        let root: string;
        try {
            root = await getProjectRoot(projectId);
        } catch {
            res.json(dbDiagrams.map(d => ({
                name: d.name,
                path: `db://${d.id}`,
                last_modified: new Date(d.updatedAt || d.createdAt).getTime()
            })));
            return;
        }

        const diagramsDir = path.join(root, 'diagrams');

        if (dbDiagrams.length === 0 && existsSync(diagramsDir)) {
            const files = await fs.readdir(diagramsDir);
            const migrated = await Promise.all(
                files
                    .filter(f => f.endsWith('.excalidraw'))
                    .map(async (f) => {
                        const filePath = path.join(diagramsDir, f);
                        const content = await fs.readFile(filePath, 'utf-8');
                        const stat = await fs.stat(filePath);

                        // Save to DB
                        const created = await prisma.diagram.create({
                            data: {
                                projectId,
                                name: f,
                                content,
                                createdAt: stat.birthtime,
                                updatedAt: stat.mtime
                            }
                        });

                        return {
                            name: f,
                            path: `db://${created.id}`,
                            last_modified: stat.mtimeMs
                        };
                    })
            );
            res.json(migrated);
            return;
        }

        // Return DB records
        res.json(dbDiagrams.map(d => ({
            name: d.name,
            path: `db://${d.id}`,
            last_modified: new Date(d.updatedAt || d.createdAt).getTime()
        })));
    } catch (error) {
        console.error('Error listing diagrams:', error);
        res.status(500).json({ error: 'Failed to list diagrams' });
    }
}

export async function createDiagram(req: Request, res: Response) {
    try {
        const { projectId, name, content } = req.body;

        if (!projectId || typeof projectId !== 'string') {
            res.status(400).json({ error: 'Project ID required' });
            return;
        }

        const fileName = (name as string).endsWith('.excalidraw')
            ? name
            : `${name}.excalidraw`;

        const defaultContent = JSON.stringify({
            type: "excalidraw",
            version: 2,
            source: "akasha",
            elements: [],
            appState: {},
            files: {}
        });

        const finalContent = content || defaultContent;

        // 1. Save/Update in DB
        const existing = await prisma.diagram.findFirst({
            where: { projectId, name: fileName }
        });

        let savedId = '';
        if (existing) {
            const updated = await prisma.diagram.update({
                where: { id: existing.id },
                data: { content: finalContent, updatedAt: new Date() }
            });
            savedId = updated.id;
        } else {
            const created = await prisma.diagram.create({
                data: {
                    projectId,
                    name: fileName,
                    content: finalContent
                }
            });
            savedId = created.id;
        }

        // 2. Synchronize to disk
        try {
            const root = await getProjectRoot(projectId);
            const diagramsDir = path.join(root, 'diagrams');
            await fs.mkdir(diagramsDir, { recursive: true });
            const filePath = path.join(diagramsDir, fileName);
            await fs.writeFile(filePath, finalContent);
        } catch (err) {
            console.error('Failed to sync diagram to disk:', err);
        }

        res.json({ success: true, path: `db://${savedId}` });
    } catch (error) {
        console.error('Error in createDiagram:', error);
        res.status(500).json({ error: 'Failed' });
    }
}

export async function getDiagram(req: Request, res: Response) {
    try {
        const { projectId } = req.query;
        const { name } = req.params;

        if (!projectId || typeof projectId !== 'string') {
            res.status(400).json({ error: 'Project ID required' });
            return;
        }

        const fileName = (name as string).endsWith('.excalidraw') ? name : `${name}.excalidraw`;

        // 1. Try DB first
        let diagram = await prisma.diagram.findFirst({
            where: { projectId, name: fileName }
        });

        // 2. Try disk if not found in DB
        if (!diagram) {
            try {
                const root = await getProjectRoot(projectId);
                const filePath = path.join(root, 'diagrams', fileName as string);
                if (existsSync(filePath)) {
                    const diskContent = await fs.readFile(filePath, 'utf-8');
                    diagram = await prisma.diagram.create({
                        data: {
                            projectId,
                            name: fileName,
                            content: diskContent
                        }
                    });
                }
            } catch (err) {
                console.error('Failed to migrate single diagram from disk:', err);
            }
        }

        if (!diagram) {
            res.status(404).json({ error: 'Diagram not found' });
            return;
        }

        res.send(diagram.content);
    } catch (error) {
        console.error('Error reading diagram:', error);
        res.status(500).json({ error: 'Failed to read diagram' });
    }
}

export async function deleteDiagram(req: Request, res: Response) {
    try {
        const { projectId } = req.query;
        const { name } = req.params;

        if (!projectId || typeof projectId !== 'string') {
            res.status(400).json({ error: 'Project ID required' });
            return;
        }

        const fileName = (name as string).endsWith('.excalidraw') ? name : `${name}.excalidraw`;

        // 1. Delete from DB
        const existing = await prisma.diagram.findFirst({
            where: { projectId, name: fileName }
        });

        if (existing) {
            await prisma.diagram.delete({
                where: { id: existing.id }
            });
        }

        // 2. Delete from disk
        try {
            const root = await getProjectRoot(projectId);
            const filePath = path.join(root, 'diagrams', fileName as string);
            if (existsSync(filePath)) {
                await fs.rm(filePath, { recursive: true, force: true });
            }
        } catch (err) {
            console.error('Failed to delete diagram file from disk:', err);
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting diagram:', error);
        res.status(500).json({ error: 'Failed to delete diagram' });
    }
}