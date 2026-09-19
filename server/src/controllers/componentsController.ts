import type { Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { randomUUID } from 'crypto';
import { safeJsonParse } from '../utils/safeJsonParse.js';

export async function listComponents(req: Request, res: Response) {
    try {
        const { projectId } = req.query;
        if (!projectId || typeof projectId !== 'string') {
            res.status(400).json({ error: 'Project ID required' });
            return;
        }

        const components = await prisma.block.findMany({
            where: { projectId, blockType: 'component' }
        });

        const response = components.map(b => ({
            ...b,
            properties: safeJsonParse(b.properties, {}),
            styles: safeJsonParse(b.styles, {}),
            responsive_styles: safeJsonParse(b.responsiveStyles, {}),
            classes: safeJsonParse(b.classes, []),
            bindings: safeJsonParse(b.bindings, {}),
            event_handlers: safeJsonParse(b.events, []),
            children: safeJsonParse(b.children, [])
        }));

        res.json(response);
    } catch (error) {
        console.error('Error listing components', error);
        res.status(500).json({ error: 'Failed to list components' });
    }
}

export async function createComponent(req: Request, res: Response) {
    try {
        const { name, description } = req.body;
        res.json({ id: randomUUID(), name });
    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
}
