
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /api/workspace - Get workspace status and projects
router.get('/', async (req, res) => {
    try {
        const projects = await prisma.project.findMany({
            orderBy: { updatedAt: 'desc' },
            include: {
                // Include minimal details if needed
                pages: { take: 1 } // Just to check if pages exist
            }
        });

        res.json({
            workspace_path: 'Cloud Workspace', // Placeholder
            projects: projects.map(p => ({
                id: p.id,
                name: p.name,
                description: p.description || '',
                created_at: p.createdAt.toISOString(),
                updated_at: p.updatedAt.toISOString(),
                root_path: p.rootPath || '',
                version: '1.0.0',
                settings: JSON.parse(p.settings || '{}'),
                blocks: [],
                pages: [],
                apis: [],
                logic_flows: [],
                data_models: [],
                variables: [],
                components: []
            }))
        });
    } catch (error) {
        console.error('Error getting workspace:', error);
        res.status(500).json({ error: 'Failed to get workspace' });
    }
});

export default router;
