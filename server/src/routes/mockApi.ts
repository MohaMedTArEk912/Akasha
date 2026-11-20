import { Router, type Request, type Response } from 'express';
import {
    queryMockRecords,
    getMockRecord,
    createMockRecord,
    updateMockRecord,
    deleteMockRecord,
    resetAndSeedMockData,
    listMockResources,
    getMockRequestLogs,
    recordMockLog,
} from '../services/mockApiService.js';

function paramStr(val: string | string[] | undefined): string {
    return Array.isArray(val) ? (val[0] || '') : (val || '');
}

/**
 * Dynamic Stateful Mock REST Router mounted at `/api/mock`
 * Handles `/api/mock/:projectId/:resource` and `/api/mock/:projectId/:resource/:recordId`
 * Also tolerates `/api/mock/:projectId/api/v1/:resource` automatically!
 */
export const mockRuntimeRouter = Router();

mockRuntimeRouter.get('/:projectId/_meta/resources', async (req: Request, res: Response) => {
    try {
        const projectId = paramStr(req.params.projectId);
        const resources = await listMockResources(projectId);
        const logs = getMockRequestLogs(projectId);
        return res.json({ success: true, resources, logs });
    } catch (err: any) {
        return res.status(500).json({ error: err?.message || 'Failed to inspect mock resources' });
    }
});

mockRuntimeRouter.post('/:projectId/_meta/seed', async (req: Request, res: Response) => {
    try {
        const projectId = paramStr(req.params.projectId);
        const result = await resetAndSeedMockData(projectId);
        recordMockLog(projectId, {
            method: 'POST',
            path: '/_meta/seed',
            status: 200,
            durationMs: 5,
            summary: `Seeded ${result.seededCount} realistic mock records`,
        });
        return res.json(result);
    } catch (err: any) {
        return res.status(500).json({ error: err?.message || 'Failed to seed mock data' });
    }
});

// Wildcard resource handler supporting both `/:projectId/:resource` and `/:projectId/api/v1/:resource/:id`
mockRuntimeRouter.all('/:projectId/*splat', async (req: Request, res: Response) => {
    const start = Date.now();
    const projectId = paramStr(req.params.projectId);
    const splatRaw = (req.params as any).splat;
    const segments: string[] = (Array.isArray(splatRaw) ? splatRaw : String(splatRaw || '').split('/'))
        .map((s: string) => s.trim())
        .filter(Boolean);

    // Strip optional leading api/v1 prefix so blueprint paths like /api/v1/products map seamlessly
    let cleaned = [...segments];
    if (cleaned[0] === 'api') cleaned = cleaned.slice(1);
    if (cleaned[0] && /^v\d+$/.test(cleaned[0])) cleaned = cleaned.slice(1);

    const resource = cleaned[0];
    const recordId = cleaned[1];

    if (!projectId || !resource) {
        return res.status(400).json({ error: 'projectId and resource path are required' });
    }

    const method = req.method.toUpperCase();
    const displayPath = `/${resource}${recordId ? `/${recordId}` : ''}`;

    try {
        if (method === 'GET' && !recordId) {
            const items = await queryMockRecords(projectId, resource, req.query as Record<string, unknown>);
            recordMockLog(projectId, {
                method,
                path: displayPath,
                status: 200,
                durationMs: Date.now() - start,
                summary: `Returned ${items.length} ${resource} record(s)`,
            });
            return res.json({ data: items, total: items.length, resource });
        }

        if (method === 'GET' && recordId) {
            const item = await getMockRecord(projectId, resource, recordId);
            if (!item) {
                recordMockLog(projectId, { method, path: displayPath, status: 404, durationMs: Date.now() - start, summary: 'Record not found' });
                return res.status(404).json({ error: `Record ${recordId} not found in ${resource}` });
            }
            recordMockLog(projectId, { method, path: displayPath, status: 200, durationMs: Date.now() - start, summary: `Fetched ${recordId}` });
            return res.json({ data: item });
        }

        if (method === 'POST') {
            const result = await createMockRecord(projectId, resource, req.body || {});
            recordMockLog(projectId, {
                method,
                path: displayPath,
                status: result.status,
                durationMs: Date.now() - start,
                summary: result.error ? `Validation failed: ${(result.details || []).join('; ')}` : `Created ${(result.record as any)?.id}`,
            });
            if (result.error) {
                return res.status(result.status).json({ error: result.error, details: result.details });
            }
            return res.status(result.status).json({ data: result.record });
        }

        if ((method === 'PUT' || method === 'PATCH') && recordId) {
            const updated = await updateMockRecord(projectId, resource, recordId, req.body || {});
            if (!updated) {
                recordMockLog(projectId, { method, path: displayPath, status: 404, durationMs: Date.now() - start, summary: 'Record not found' });
                return res.status(404).json({ error: `Record ${recordId} not found in ${resource}` });
            }
            recordMockLog(projectId, { method, path: displayPath, status: 200, durationMs: Date.now() - start, summary: `Updated ${recordId}` });
            return res.json({ data: updated });
        }

        if (method === 'DELETE' && recordId) {
            const deleted = await deleteMockRecord(projectId, resource, recordId);
            if (!deleted) {
                recordMockLog(projectId, { method, path: displayPath, status: 404, durationMs: Date.now() - start, summary: 'Record not found' });
                return res.status(404).json({ error: `Record ${recordId} not found in ${resource}` });
            }
            recordMockLog(projectId, { method, path: displayPath, status: 200, durationMs: Date.now() - start, summary: `Deleted ${recordId}` });
            return res.json({ success: true, deletedId: recordId });
        }

        return res.status(405).json({ error: `Method ${method} not supported on ${displayPath}` });
    } catch (err: any) {
        recordMockLog(projectId, { method, path: displayPath, status: 500, durationMs: Date.now() - start, summary: err?.message || 'Error' });
        return res.status(500).json({ error: err?.message || 'Mock API error' });
    }
});

export default mockRuntimeRouter;
