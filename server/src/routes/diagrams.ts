
import { Router } from 'express';
import fs from 'fs-extra';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Helper to get project root
async function getProjectRoot(projectId: string) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new Error('Project not found');
    if (project.rootPath) return project.rootPath;
    // Fallback: create a directory under server/projects/<projectId>
    const fallbackRoot = path.join(process.cwd(), 'projects', projectId);
    await fs.ensureDir(fallbackRoot);
    return fallbackRoot;
}

// GET /api/diagrams - List diagrams
router.get('/', async (req, res) => {
    try {
        const { projectId } = req.query;
        if (!projectId || typeof projectId !== 'string') {
            res.status(400).json({ error: 'Project ID required' });
            return;
        }

        let root: string;
        try {
            root = await getProjectRoot(projectId);
        } catch {
            // Project doesn't exist — return empty list
            res.json([]);
            return;
        }
        const diagramsDir = path.join(root, 'diagrams');

        if (!fs.existsSync(diagramsDir)) {
            res.json([]);
            return;
        }

        const files = await fs.readdir(diagramsDir);
        const diagrams = files
            .filter(f => f.endsWith('.drawio') || f.endsWith('.xml'))
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
});

// POST /api/diagrams - Create
router.post('/', async (req, res) => {
    try {
        const { projectId, name, content } = req.body;
        const root = await getProjectRoot(projectId);
        const diagramsDir = path.join(root, 'diagrams');
        await fs.ensureDir(diagramsDir);

        const fileName = name.endsWith('.drawio') ? name : `${name}.drawio`;
        const filePath = path.join(diagramsDir, fileName);

        await fs.writeFile(filePath, content || '<mxfile host="Electron" />');
        res.json({ success: true, path: filePath });
    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
});

// GET /api/diagrams/:name - Read content
router.get('/:name', async (req, res) => {
    try {
        const { projectId } = req.query;
        const { name } = req.params;
        if (!projectId || typeof projectId !== 'string') throw new Error('Project ID required');

        const root = await getProjectRoot(projectId);
        let filePath = path.join(root, 'diagrams', name);

        // Try with .drawio extension if exact name not found
        if (!fs.existsSync(filePath) && !name.endsWith('.drawio')) {
            filePath = path.join(root, 'diagrams', `${name}.drawio`);
        }

        if (!fs.existsSync(filePath)) {
            res.status(404).json({ error: 'File not found' });
            return;
        }

        const content = await fs.readFile(filePath, 'utf-8');
        res.send(content);
    } catch (error) {
        console.error('Error reading diagram:', error);
        res.status(500).json({ error: 'Failed to read diagram' });
    }
});

// DELETE /api/diagrams/:name - Delete a diagram
router.delete('/:name', async (req, res) => {
    try {
        const { projectId } = req.query;
        const { name } = req.params;
        if (!projectId || typeof projectId !== 'string') {
            res.status(400).json({ error: 'Project ID required' });
            return;
        }

        const root = await getProjectRoot(projectId);
        let filePath = path.join(root, 'diagrams', name);

        // Try with .drawio extension if exact name not found
        if (!fs.existsSync(filePath) && !name.endsWith('.drawio')) {
            filePath = path.join(root, 'diagrams', `${name}.drawio`);
        }

        if (!fs.existsSync(filePath)) {
            res.status(404).json({ error: 'File not found' });
            return;
        }

        await fs.remove(filePath);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting diagram:', error);
        res.status(500).json({ error: 'Failed to delete diagram' });
    }
});

export default router;
