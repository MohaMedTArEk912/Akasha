
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const router = Router();
const prisma = new PrismaClient();

// Transform Prisma project to client-expected snake_case format
function toProjectSchema(p: any, pages: any[] = [], blocks: any[] = []) {
    return {
        id: p.id,
        name: p.name,
        description: p.description || '',
        created_at: (p.createdAt instanceof Date ? p.createdAt : new Date(p.createdAt)).toISOString(),
        updated_at: (p.updatedAt instanceof Date ? p.updatedAt : new Date(p.updatedAt)).toISOString(),
        root_path: p.rootPath || '',
        version: '1.0.0',
        settings: typeof p.settings === 'string' ? JSON.parse(p.settings || '{}') : (p.settings || {}),
        blocks: blocks.map((b: any) => ({
            id: b.id,
            block_type: b.blockType,
            name: b.name,
            properties: typeof b.properties === 'string' ? JSON.parse(b.properties || '{}') : (b.properties || {}),
            styles: typeof b.styles === 'string' ? JSON.parse(b.styles || '{}') : (b.styles || {}),
            responsive_styles: typeof b.responsiveStyles === 'string' ? JSON.parse(b.responsiveStyles || '{}') : (b.responsiveStyles || {}),
            classes: typeof b.classes === 'string' ? JSON.parse(b.classes || '[]') : (b.classes || []),
            events: typeof b.events === 'string' ? JSON.parse(b.events || '{}') : (b.events || {}),
            bindings: typeof b.bindings === 'string' ? JSON.parse(b.bindings || '{}') : (b.bindings || {}),
            children: typeof b.children === 'string' ? JSON.parse(b.children || '[]') : (b.children || []),
            parent_id: b.parentId || null,
            page_id: b.pageId || null,
            order: b.order || 0,
            archived: b.archived || false,
        })),
        pages: (pages || []).map((pg: any) => ({
            id: pg.id,
            name: pg.name,
            path: pg.path,
            is_dynamic: pg.isDynamic || false,
            meta: typeof pg.meta === 'string' ? JSON.parse(pg.meta || '{}') : (pg.meta || {}),
            archived: pg.archived || false,
        })),
        apis: [],
        logic_flows: [],
        data_models: [],
        variables: [],
        components: [],
    };
}

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
                blocks: true
            }
        });

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        res.json(toProjectSchema(project, project.pages, project.blocks));
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
        const homePage = await prisma.page.create({
            data: {
                id: randomUUID(), // Public ID
                projectId: project.id,
                name: 'Home',
                path: '/',
                isDynamic: false
            }
        });

        res.json(toProjectSchema(project, [homePage], []));
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
            },
            include: { pages: true, blocks: true }
        });
        res.json(toProjectSchema(project, project.pages, project.blocks));
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
