
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /api/logic-flows - List logic flows for a project
// Requires ?projectId=... query param since LogicFlows are project-specific
router.get('/', async (req, res) => {
    try {
        const { projectId } = req.query;
        if (!projectId || typeof projectId !== 'string') {
            res.status(400).json({ error: 'Project ID required' });
            return;
        }

        const flows = await prisma.logicFlow.findMany({
            where: { projectId, archived: false },
            orderBy: { name: 'asc' }
        });

        // Parse JSON fields
        const hydrated = flows.map(f => ({
            ...f,
            trigger: JSON.parse(f.trigger),
            nodes: JSON.parse(f.nodes),
            edges: JSON.parse(f.edges)
        }));

        res.json(hydrated);
    } catch (error) {
        console.error('Error listing logic flows:', error);
        res.status(500).json({ error: 'Failed to list logic flows' });
    }
});

// POST /api/logic-flows - Create a new logic flow
router.post('/', async (req, res) => {
    try {
        const { projectId, name, context } = req.body;

        // Initial empty state
        const trigger = { type: 'manual' }; // Default
        const nodes: any[] = [];
        const edges: any[] = [];

        const flow = await prisma.logicFlow.create({
            data: {
                projectId,
                name,
                trigger: JSON.stringify(trigger),
                nodes: JSON.stringify(nodes),
                edges: JSON.stringify(edges)
            }
        });

        res.json({
            ...flow,
            trigger,
            nodes,
            edges
        });
    } catch (error) {
        console.error('Error creating logic flow:', error);
        res.status(500).json({ error: 'Failed to create logic flow' });
    }
});

// PUT /api/logic-flows/:id - Update a logic flow
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, trigger, nodes, edges, description } = req.body;

        const updates: any = {};
        if (name) updates.name = name;
        if (trigger) updates.trigger = JSON.stringify(trigger);
        if (nodes) updates.nodes = JSON.stringify(nodes);
        if (edges) updates.edges = JSON.stringify(edges);

        const flow = await prisma.logicFlow.update({
            where: { id },
            data: updates
        });

        res.json({
            ...flow,
            trigger: JSON.parse(flow.trigger),
            nodes: JSON.parse(flow.nodes),
            edges: JSON.parse(flow.edges)
        });
    } catch (error) {
        console.error('Error updating logic flow:', error);
        res.status(500).json({ error: 'Failed to update logic flow' });
    }
});

// DELETE /api/logic-flows/:id - Archive/Delete a logic flow
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.logicFlow.update({
            where: { id },
            data: { archived: true }
        });
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting logic flow:', error);
        res.status(500).json({ error: 'Failed to delete logic flow' });
    }
});

export default router;
