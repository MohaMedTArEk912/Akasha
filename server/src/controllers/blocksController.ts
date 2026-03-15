import type { Request, Response } from 'express';
import prisma from '../lib/prisma.js';

export async function syncBlocks(req: Request, res: Response) {
    try {
        const { page_id, blocks } = req.body;

        if (!page_id || !Array.isArray(blocks)) {
            res.status(400).json({ error: 'Invalid payload' });
            return;
        }

        const page = await prisma.page.findUnique({
            where: { id: page_id },
            select: { projectId: true, idRoot: true }
        });

        if (!page) {
            res.status(404).json({ error: 'Page not found' });
            return;
        }

        const projectId = page.projectId;

        // removed $transaction to support MongoDB standalone
        await prisma.block.deleteMany({ where: { pageId: page.idRoot } });

        const operations = blocks.map((b: any, index: number) => {
            return prisma.block.create({
                data: {
                    id: b.id,
                    projectId: projectId as string,
                    pageId: page.idRoot,
                    parentId: b.parent_id || null,
                    blockType: b.block_type,
                    name: b.name,
                    properties: JSON.stringify(b.properties || {}),
                    styles: JSON.stringify(b.styles || {}),
                    responsiveStyles: JSON.stringify(b.responsive_styles || {}),
                    classes: JSON.stringify(b.classes || []),
                    events: JSON.stringify(b.event_handlers || []),
                    bindings: JSON.stringify(b.bindings || {}),
                    children: JSON.stringify(b.children || []),
                    order: index
                }
            });
        });

        await Promise.all(operations);

        res.json({ success: true });
    } catch (error) {
        console.error("Sync error:", error);
        res.status(500).json({ error: 'Failed to sync blocks' });
    }
}
