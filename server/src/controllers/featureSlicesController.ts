import type { Request, Response } from 'express';
import {
    listProjectWorkspaceSlices,
    createFeatureSlice,
    updateFeatureSlice,
    deleteFeatureSlice,
    voteOnFeatureSlice,
    addProjectComment,
    resolveProjectComment,
    addProjectDecision,
} from '../services/featureSliceService.js';
import { analyzeChangeImpact, applyImpactSyncActions } from '../services/impactAnalysisService.js';
import { computeReleaseReadiness } from '../services/releaseReadinessService.js';
import { compileFeatureBuildPack } from '../services/structuredBlueprintService.js';

function paramStr(val: string | string[] | undefined): string {
    return Array.isArray(val) ? (val[0] || '') : (val || '');
}

export async function getSlicesWorkspace(req: Request, res: Response) {
    try {
        const projectId = paramStr(req.params.projectId);
        if (!projectId) return res.status(400).json({ error: 'projectId is required' });
        const [workspace, readiness] = await Promise.all([
            listProjectWorkspaceSlices(projectId),
            computeReleaseReadiness(projectId).catch(() => null),
        ]);
        return res.json({ success: true, ...workspace, readiness });
    } catch (err: any) {
        console.error('[getSlicesWorkspace error]:', err);
        return res.status(500).json({ error: err?.message || 'Failed to load feature slices' });
    }
}

export async function createSlice(req: Request, res: Response) {
    try {
        const { projectId, title } = req.body || {};
        if (!projectId || !title) {
            return res.status(400).json({ error: 'projectId and title are required' });
        }
        const slice = await createFeatureSlice(req.body);
        return res.status(201).json({ success: true, slice });
    } catch (err: any) {
        return res.status(500).json({ error: err?.message || 'Failed to create slice' });
    }
}

export async function updateSlice(req: Request, res: Response) {
    try {
        const sliceId = paramStr(req.params.sliceId);
        if (!sliceId) return res.status(400).json({ error: 'sliceId is required' });
        const slice = await updateFeatureSlice(sliceId, req.body || {});
        return res.json({ success: true, slice });
    } catch (err: any) {
        return res.status(500).json({ error: err?.message || 'Failed to update slice' });
    }
}

export async function removeSlice(req: Request, res: Response) {
    try {
        const sliceId = paramStr(req.params.sliceId);
        if (!sliceId) return res.status(400).json({ error: 'sliceId is required' });
        await deleteFeatureSlice(sliceId);
        return res.json({ success: true });
    } catch (err: any) {
        return res.status(500).json({ error: err?.message || 'Failed to delete slice' });
    }
}

export async function voteSlice(req: Request, res: Response) {
    try {
        const sliceId = paramStr(req.params.sliceId);
        const { member, vote } = req.body || {};
        if (!sliceId || !['mvp', 'next', 'cut'].includes(vote)) {
            return res.status(400).json({ error: 'sliceId and valid vote (mvp|next|cut) are required' });
        }
        const slice = await voteOnFeatureSlice(sliceId, member || 'Teammate', vote);
        return res.json({ success: true, slice });
    } catch (err: any) {
        return res.status(500).json({ error: err?.message || 'Failed to record vote' });
    }
}

export async function getSliceBuildPack(req: Request, res: Response) {
    try {
        const projectId = paramStr(req.params.projectId);
        const sliceId = paramStr(req.params.sliceId);
        if (!projectId || !sliceId) {
            return res.status(400).json({ error: 'projectId and sliceId are required' });
        }
        const pack = await compileFeatureBuildPack(projectId, sliceId);
        return res.json({ success: true, buildPack: pack });
    } catch (err: any) {
        return res.status(500).json({ error: err?.message || 'Failed to compile build pack' });
    }
}

export async function postComment(req: Request, res: Response) {
    try {
        const { projectId, targetType, targetId, author, body, pin } = req.body || {};
        if (!projectId || !targetId || !body) {
            return res.status(400).json({ error: 'projectId, targetId, and body are required' });
        }
        const comment = await addProjectComment({
            projectId,
            targetType: targetType || 'slice',
            targetId,
            author: author || 'Teammate',
            body,
            pin: pin || null,
        });
        return res.status(201).json({ success: true, comment });
    } catch (err: any) {
        return res.status(500).json({ error: err?.message || 'Failed to save comment' });
    }
}

export async function toggleCommentResolved(req: Request, res: Response) {
    try {
        const commentId = paramStr(req.params.commentId);
        const { resolved } = req.body || {};
        const comment = await resolveProjectComment(commentId, Boolean(resolved));
        return res.json({ success: true, comment });
    } catch (err: any) {
        return res.status(500).json({ error: err?.message || 'Failed to update comment' });
    }
}

export async function postDecision(req: Request, res: Response) {
    try {
        const { projectId, title, context, decision, author, linkedSliceId } = req.body || {};
        if (!projectId || !title || !decision) {
            return res.status(400).json({ error: 'projectId, title, and decision are required' });
        }
        const created = await addProjectDecision({ projectId, title, context, decision, author, linkedSliceId });
        return res.status(201).json({ success: true, decision: created });
    } catch (err: any) {
        return res.status(500).json({ error: err?.message || 'Failed to create decision' });
    }
}

export async function analyzeImpact(req: Request, res: Response) {
    try {
        const { projectId, sourceType, sourceId, changeSummary } = req.body || {};
        if (!projectId || !sourceType || !sourceId) {
            return res.status(400).json({ error: 'projectId, sourceType, and sourceId are required' });
        }
        const report = await analyzeChangeImpact({ projectId, sourceType, sourceId, changeSummary });
        return res.json({ success: true, report });
    } catch (err: any) {
        return res.status(500).json({ error: err?.message || 'Impact analysis failed' });
    }
}

export async function applyImpact(req: Request, res: Response) {
    try {
        const { projectId, report, flagSlices, createSyncTask } = req.body || {};
        if (!projectId || !report) {
            return res.status(400).json({ error: 'projectId and report are required' });
        }
        const result = await applyImpactSyncActions({ projectId, report, flagSlices, createSyncTask });
        return res.json(result);
    } catch (err: any) {
        return res.status(500).json({ error: err?.message || 'Failed to apply impact sync actions' });
    }
}

export async function getReadiness(req: Request, res: Response) {
    try {
        const projectId = paramStr(req.params.projectId);
        if (!projectId) return res.status(400).json({ error: 'projectId is required' });
        const readiness = await computeReleaseReadiness(projectId);
        return res.json({ success: true, readiness });
    } catch (err: any) {
        return res.status(500).json({ error: err?.message || 'Failed to compute release readiness' });
    }
}
