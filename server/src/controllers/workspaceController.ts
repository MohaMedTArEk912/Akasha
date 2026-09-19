import type { Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { safeJsonParse } from '../utils/safeJsonParse.js';

export async function getWorkspace(req: Request, res: Response) {
    try {
        let projects;
        const user = (req as any).user;
        if (user?.id) {
            try {
                const orgMemberMod = '../../models/OrgMember.js'; const { default: OrgMember } = await import(orgMemberMod);
                const memberships = await OrgMember.find({ userId: user.id, status: 'accepted' });
                const myOrgIds = memberships.map((m: any) => m.orgId.toString());
                projects = await prisma.project.findMany({
                    where: {
                        OR: [
                            { userId: user.id },
                            { orgId: { in: myOrgIds } }
                        ]
                    },
                    orderBy: { updatedAt: 'desc' },
                    include: { pages: { take: 1 } }
                });
            } catch {
                projects = await prisma.project.findMany({
                    where: { userId: user.id },
                    orderBy: { updatedAt: 'desc' },
                    include: { pages: { take: 1 } }
                });
            }
        } else {
            // Standalone mode: list all projects in this workspace
            projects = await prisma.project.findMany({
                orderBy: { updatedAt: 'desc' },
                include: { pages: { take: 1 } }
            });
        }

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
                settings: safeJsonParse(p.settings, {}),
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
