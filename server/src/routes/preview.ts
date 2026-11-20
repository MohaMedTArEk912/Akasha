import { Router, type Request, type Response } from 'express';
import { compileProjectPrototype } from '../services/prototypeCompiler.js';
import { addProjectComment } from '../services/featureSliceService.js';
import prisma from '../lib/prisma.js';
import { safeJsonParse } from '../utils/safeJsonParse.js';
import { randomUUID } from 'node:crypto';

const router = Router();

function paramStr(val: string | string[] | undefined): string {
    return Array.isArray(val) ? (val[0] || '') : (val || '');
}

router.get('/:projectId/manifest', async (req: Request, res: Response) => {
    try {
        const projectId = paramStr(req.params.projectId);
        const token = typeof req.query.token === 'string' ? req.query.token : '';
        const manifest = await compileProjectPrototype(projectId);

        // If external share token is supplied and sharing is disabled or mismatched, enforce token check
        if (token) {
            if (!manifest.shareEnabled) {
                return res.status(403).json({ error: 'Shareable preview is disabled for this project' });
            }
            if (manifest.shareToken && token !== manifest.shareToken) {
                return res.status(403).json({ error: 'Invalid preview share token' });
            }
        }

        return res.json({ success: true, manifest });
    } catch (err: any) {
        return res.status(500).json({ error: err?.message || 'Failed to compile prototype manifest' });
    }
});

router.post('/:projectId/pin-comment', async (req: Request, res: Response) => {
    try {
        const projectId = paramStr(req.params.projectId);
        const { pageId, pagePath, author, body, x, y, token } = req.body || {};
        if (!pageId || !body) {
            return res.status(400).json({ error: 'pageId and body are required' });
        }

        const project = await prisma.project.findUnique({ where: { id: projectId } });
        if (!project) return res.status(404).json({ error: 'Project not found' });
        const settings = safeJsonParse<Record<string, any>>(project.settings, {});
        if (token && settings.shareToken && token !== settings.shareToken) {
            return res.status(403).json({ error: 'Invalid share token' });
        }

        const comment = await addProjectComment({
            projectId,
            targetType: 'preview_pin',
            targetId: String(pageId),
            author: author || 'Reviewer',
            body: String(body),
            pin: { x: Number(x ?? 50), y: Number(y ?? 50), pagePath: pagePath || '/' },
        });
        return res.status(201).json({ success: true, comment });
    } catch (err: any) {
        return res.status(500).json({ error: err?.message || 'Failed to save pinned feedback' });
    }
});

router.post('/:projectId/toggle-share', async (req: Request, res: Response) => {
    try {
        const projectId = paramStr(req.params.projectId);
        const { enabled, rotateToken } = req.body || {};
        const project = await prisma.project.findUnique({ where: { id: projectId } });
        if (!project) return res.status(404).json({ error: 'Project not found' });

        const settings = safeJsonParse<Record<string, any>>(project.settings, {});
        const shareEnabled = typeof enabled === 'boolean' ? enabled : settings.shareEnabled !== false;
        const shareToken = rotateToken || !settings.shareToken
            ? randomUUID().replace(/-/g, '').slice(0, 16)
            : settings.shareToken;

        settings.shareEnabled = shareEnabled;
        settings.shareToken = shareToken;

        await prisma.project.update({
            where: { id: projectId },
            data: { settings: JSON.stringify(settings) },
        });

        return res.json({ success: true, shareEnabled, shareToken });
    } catch (err: any) {
        return res.status(500).json({ error: err?.message || 'Failed to update share settings' });
    }
});

export default router;
