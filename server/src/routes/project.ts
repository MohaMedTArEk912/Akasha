
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const router = Router();
const prisma = new PrismaClient();

// GET /api/project - List all projects
router.get('/', async (req, res) => {
    try {
        const projects = await prisma.project.findMany({
            orderBy: { updatedAt: 'desc' }
        });
        res.json(projects);
    } catch (error) {
        console.error('Error listing projects:', error);
        res.status(500).json({ error: 'Failed to list projects' });
    }
});

// GET /api/project/:id - Get specific project
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const project = await prisma.project.findUnique({
            where: { id },
            include: {
                pages: true,
                blocks: {
                    where: { pageId: null } // Only load root blocks or all? 
                    // Rust backend loads *everything* for the project usually.
                    // For now, let's load key relations.
                    // If project is huge, strictly loading needed parts is better.
                    // But Akasha expects full project schema often.
                }
            }
        });

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        res.json(project);
    } catch (error) {
        console.error('Error getting project:', error);
        res.status(500).json({ error: 'Failed to get project' });
    }
});

// POST /api/project - Create new project
router.post('/', async (req, res) => {
    try {
        const { name, description } = req.body;
        const project = await prisma.project.create({
            data: {
                name,
                description,
                settings: JSON.stringify({
                    theme: { primary_color: '#3b82f6' }
                })
            }
        });

        // Create default page (Home)
        await prisma.page.create({
            data: {
                id: randomUUID(), // Public ID
                projectId: project.id,
                name: 'Home',
                path: '/',
                isDynamic: false
            }
        });

        res.json(project);
    } catch (error) {
        console.error('Error creating project:', error);
        res.status(500).json({ error: 'Failed to create project' });
    }
});

// PUT /api/project/:id - Update project
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, settings } = req.body;

        const project = await prisma.project.update({
            where: { id },
            data: {
                name,
                description,
                ...(settings && { settings: JSON.stringify(settings) })
            }
        });
        res.json(project);
    } catch (error) {
        console.error('Error updating project:', error);
        res.status(500).json({ error: 'Failed to update project' });
    }
});

// DELETE /api/project/:id - Delete project
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.project.delete({
            where: { id }
        });
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting project:', error);
        res.status(500).json({ error: 'Failed to delete project' });
    }
});

export default router;
