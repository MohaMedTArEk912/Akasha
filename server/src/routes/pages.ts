
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /api/pages/:id/content - Get page content (blocks)
// Corresponds to ipc_get_page_content
router.get('/:id/content', async (req, res) => {
    try {
        const { id } = req.params;

        // Fetch all blocks for this page
        const blocks = await prisma.block.findMany({
            where: { pageId: id },
            orderBy: { order: 'asc' } // or whatever order
        });

        // We need to return them in a format Craft.js expects? 
        // Or generic "content" string?
        // ipc_get_page_content returns { content: string }
        // The content is usually a JSON string of the Craft.js serialized nodes.

        // If we store blocks individually in DB, we need to reconstruct the JSON.
        // OR, the frontend might expect the "content" field of the Page entry? 
        // But we are storing blocks in Block table.

        // Let's assume for now we reconstruct the Craft.js JSON structure.
        // Each block in DB has `content` field which is JSON.
        // We might need to merge them.

        // However, if the frontend just expects the raw blocks array to be processed:
        // ipc_get_page_content signature: -> { content: string }

        // Parse blocks to Craft.js format
        const serializedBlocks = blocks.map(b => ({
            id: b.id,
            block_type: b.blockType,
            name: b.name,
            parent_id: b.parentId,

            // Parse JSON fields back to objects
            properties: JSON.parse(b.properties),
            styles: JSON.parse(b.styles),
            responsive_styles: JSON.parse(b.responsiveStyles),
            classes: JSON.parse(b.classes),
            event_handlers: JSON.parse(b.events),
            bindings: JSON.parse(b.bindings),

            children: JSON.parse(b.children),
            order: b.order

            // Missing: component_id, slot? Add to schema if needed or store in properties?
            // For now assuming they are part of properties or standard fields if used.
        }));

        res.json({ content: JSON.stringify(serializedBlocks) });

    } catch (error) {
        console.error('Error getting page content:', error);
        res.status(500).json({ error: 'Failed to get page content' });
    }
});

// GET /api/pages - List pages (optional, usually fetched via Project)
router.get('/', async (req, res) => {
    // ...
    res.json([]);
});

// POST /api/pages - Create page
router.post('/', async (req, res) => {
    try {
        const { name, path, projectId } = req.body;
        // ... implementation
        res.json({ id: 'new-id', name, path });
    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
});

export default router;
