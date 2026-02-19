
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// POST /api/blocks/sync - Bulk update blocks for a page
router.post('/sync', async (req, res) => {
    try {
        const { page_id, blocks } = req.body;

        if (!page_id || !Array.isArray(blocks)) {
            res.status(400).json({ error: 'Invalid payload' });
            return;
        }

        // We need to know the project_id.
        // Option 1: Client sends it (I added it to hook)
        // Option 2: Look it up from page_id

        const page = await prisma.page.findUnique({
            where: { id: page_id },
            select: { projectId: true }
        });

        if (!page) {
            res.status(404).json({ error: 'Page not found' });
            return;
        }

        const projectId = page.projectId;

        // Transaction: Delete existing blocks for this page (or upsert?)
        // Craft.js sync usually replaces the entire state for the page.
        // Rust implementation:
        // 1. Mark all existing blocks on page as "orphaned" or delete them?
        // 2. Insert/Update new blocks.

        // Simpler approach for migration:
        // Delete all blocks for this page, then insert new ones.
        // Provide transaction.

        await prisma.$transaction(async (tx) => {
            // Delete all blocks for this page
            await tx.block.deleteMany({
                where: { pageId: page_id }
            });

            // Insert new blocks
            // We need to map the incoming JSON to Prisma model
            // Incoming `blocks` matches BlockSchema (flat)

            /*
             BlockSchema: 
             { id, block_type, name, parent_id, properties, styles, ... }
             
             Prisma Block:
             { id, projectId, pageId, parentId, blockType, name, content, children, order }
            */

            // Prepare data
            const operations = blocks.map((b: any, index: number) => {
                // Map JSON fields
                return tx.block.create({
                    data: {
                        id: b.id,
                        projectId: projectId,
                        pageId: page_id, // ensure this matches schema relation
                        parentId: b.parent_id || null,
                        blockType: b.block_type,
                        name: b.name,

                        // JSON fields
                        properties: JSON.stringify(b.properties || {}),
                        styles: JSON.stringify(b.styles || {}),
                        responsiveStyles: JSON.stringify(b.responsive_styles || {}),
                        classes: JSON.stringify(b.classes || []),
                        events: JSON.stringify(b.event_handlers || []),
                        bindings: JSON.stringify(b.bindings || {}),

                        children: JSON.stringify(b.children || []),
                        order: index // or b.order
                    }
                });
            });

            await Promise.all(operations);
        });

        res.json({ success: true });
    } catch (error) {
        console.error("Sync error:", error);
        res.status(500).json({ error: 'Failed to sync blocks' });
    }
});

export default router;
