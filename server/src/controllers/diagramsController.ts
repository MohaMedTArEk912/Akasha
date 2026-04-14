import type { Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import * as fs from 'fs-extra';
import * as path from 'path';

async function getProjectRoot(projectId: string) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new Error('Project not found');
    if (project.rootPath) return project.rootPath;
    const fallbackRoot = path.join(process.cwd(), 'projects', projectId);
    await fs.ensureDir(fallbackRoot);
    return fallbackRoot;
}

export async function listDiagrams(req: Request, res: Response) {
    try {
        const { projectId } = req.query;
        if (!projectId || typeof projectId !== 'string') {
            res.status(400).json({ error: 'Project ID required' });
            return;
        }

        let root: string;
        try { root = await getProjectRoot(projectId); } catch { res.json([]); return; }
        const diagramsDir = path.join(root, 'diagrams');

        if (!fs.existsSync(diagramsDir)) { res.json([]); return; }

            const files = await fs.readdir(diagramsDir);
            const diagrams = files
                .filter(f => f.endsWith('.drawio') || f.endsWith('.xml') || f.endsWith('.excalidraw'))
                .map(f => ({
                name: f,
                path: path.join(diagramsDir, f),
                last_modified: fs.statSync(path.join(diagramsDir, f)).mtimeMs
            }));

        res.json(diagrams);
    } catch (error) {
        console.error('Error listing diagrams:', error);
        res.status(500).json({ error: 'Failed to list diagrams' });
    }
}

export async function createDiagram(req: Request, res: Response) {
    try {
        const { projectId, name, content } = req.body;
        const root = await getProjectRoot(projectId);
        const diagramsDir = path.join(root, 'diagrams');
        await fs.ensureDir(diagramsDir);

        const fileName = (name as string).endsWith('.drawio') ? name : `${name}.drawio`;
        const filePath = path.join(diagramsDir, fileName);

        await fs.writeFile(filePath, content || '<mxfile host="Electron" />');
        res.json({ success: true, path: filePath });
    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
}

export async function getDiagram(req: Request, res: Response) {
    try {
        const { projectId } = req.query;
        const { name } = req.params;
        if (!projectId || typeof projectId !== 'string') throw new Error('Project ID required');

        const root = await getProjectRoot(projectId);
        let filePath = path.join(root, 'diagrams', name as string);

        if (!fs.existsSync(filePath) && !(name as string).endsWith('.drawio')) {
            filePath = path.join(root, 'diagrams', `${name}.drawio`);
        }

        if (!fs.existsSync(filePath)) { res.status(404).json({ error: 'File not found' }); return; }

        const content = await fs.readFile(filePath, 'utf-8');
        res.send(content);
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

        const root = await getProjectRoot(projectId);
        let filePath = path.join(root, 'diagrams', name as string);

        if (!fs.existsSync(filePath) && !(name as string).endsWith('.drawio')) {
            filePath = path.join(root, 'diagrams', `${name}.drawio`);
        }

        if (!fs.existsSync(filePath)) { res.status(404).json({ error: 'File not found' }); return; }

        await fs.remove(filePath);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting diagram:', error);
        res.status(500).json({ error: 'Failed to delete diagram' });
    }
}
