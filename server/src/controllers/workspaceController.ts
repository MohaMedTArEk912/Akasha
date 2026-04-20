import type { Request, Response } from 'express';
import prisma from '../lib/prisma.js';

export async function getWorkspace(req: Request, res: Response) {
    try {
        const projects = await prisma.project.findMany({
            orderBy: { updatedAt: 'desc' },
            include: { pages: { take: 1 } }
        });

        res.json({
            workspace_path: 'Cloud Workspace',
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
                components: []
            }))
        });
    } catch (error) {
        console.error('Error getting workspace:', error);
        res.status(500).json({ error: 'Failed to get workspace' });
    }
}
