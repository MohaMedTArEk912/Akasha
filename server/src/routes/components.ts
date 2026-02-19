
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const router = Router();
const prisma = new PrismaClient();

// GET /api/components - List all components
router.get('/', async (req, res) => {
    try {
        const { projectId } = req.query;
        if (!projectId || typeof projectId !== 'string') {
            res.status(400).json({ error: 'Project ID required' });
            return;
        }

        // Fetch blocks that are 'component' type or have isComponent flag?
        // Checking Block schema: nothing specific.
        // Assuming blockType = 'component' or 'Symbol'.
        // For now, let's fetch blocks with blockType = 'component'

        const components = await prisma.block.findMany({
            where: {
                projectId,
                blockType: 'component' // Adjust if your schema uses different type
            }
        });

        // Map to BlockSchema
        const response = components.map(b => ({
            ...b,
            properties: JSON.parse(b.properties),
            styles: JSON.parse(b.styles),
            responsive_styles: JSON.parse(b.responsiveStyles),
            classes: JSON.parse(b.classes),
            bindings: JSON.parse(b.bindings),
            event_handlers: JSON.parse(b.events),
            children: JSON.parse(b.children)
        }));

        res.json(response);
    } catch (error) {
        console.error('Error listing components', error);
        res.status(500).json({ error: 'Failed to list components' });
    }
});

// POST /api/components - Create component
router.post('/', async (req, res) => {
    try {
        const { name, description } = req.body;
        // implementation
        res.json({ id: randomUUID(), name });
    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
});

export default router;
