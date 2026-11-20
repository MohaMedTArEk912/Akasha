import type { Request, Response } from 'express';
import {
    listPlaybookSummaries,
    getPlaybook,
    bootstrapProjectFromPlaybook,
    type ArchetypeId,
} from '../services/archetypePlaybooks.js';
import { getLLMProvider } from '../lib/llmProvider.js';
import prisma from '../lib/prisma.js';
import { ObjectId } from 'mongodb';
import path from 'node:path';

const VALID_ARCHETYPES: ArchetypeId[] = [
    'ecommerce',
    'internal_tool',
    'booking_service',
    'saas_app',
    'marketplace',
    'marketing_site',
];

export async function listPlaybooks(_req: Request, res: Response) {
    res.json({
        success: true,
        playbooks: listPlaybookSummaries(),
    });
}

export async function getPlaybookDetail(req: Request, res: Response) {
    const rawId = Array.isArray(req.params.archetype) ? req.params.archetype[0] : req.params.archetype;
    if (!rawId) {
        return res.status(400).json({ error: 'archetype is required' });
    }
    const playbook = getPlaybook(rawId);
    return res.json({ success: true, playbook });
}

export async function bootstrapPlaybook(req: Request, res: Response) {
    try {
        const { projectId, archetype, productName, pitch, selectedSliceKeys } = req.body || {};
        const arch = String(archetype || 'ecommerce').toLowerCase() as ArchetypeId;
        if (!VALID_ARCHETYPES.includes(arch)) {
            return res.status(400).json({ error: `Invalid archetype "${archetype}". Allowed: ${VALID_ARCHETYPES.join(', ')}` });
        }

        let targetProjectId = typeof projectId === 'string' && projectId.trim() ? projectId.trim() : '';

        // Allow 1-step project creation + playbook bootstrap from the Dashboard Launchpad
        if (!targetProjectId) {
            const newId = new ObjectId().toHexString();
            const playbook = getPlaybook(arch);
            const created = await prisma.project.create({
                data: {
                    id: newId,
                    userId: (req as any).user?.id || 'standalone-dev',
                    name: (productName || playbook.name).trim(),
                    description: (pitch || playbook.tagline).trim(),
                    status: 'active',
                    rootPath: path.join(process.cwd(), 'projects', newId),
                    settings: JSON.stringify({ archetype: arch }),
                },
            });
            targetProjectId = created.id;
        }

        const result = await bootstrapProjectFromPlaybook({
            projectId: targetProjectId,
            archetype: arch,
            productName,
            pitch,
            selectedSliceKeys: Array.isArray(selectedSliceKeys) ? selectedSliceKeys : undefined,
        });

        return res.json(result);
    } catch (err: any) {
        console.error('[bootstrapPlaybook error]:', err);
        return res.status(500).json({ error: err?.message || 'Failed to bootstrap playbook' });
    }
}

export async function getAiProviderStatus(_req: Request, res: Response) {
    const health = getLLMProvider().getHealth();
    return res.json({ success: true, health });
}
