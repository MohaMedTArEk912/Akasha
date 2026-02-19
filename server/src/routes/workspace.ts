
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
                ...p,
                blocks: [], // Don't load blocks for summary list
                pages: [],  // Don't load full pages
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
