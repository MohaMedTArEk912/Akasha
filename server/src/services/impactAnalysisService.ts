/**
 * Change Impact Ripple Engine
 *
 * When any team member edits a Data Model, API Endpoint, or Feature Slice,
 * traverses Akasha's Living Blueprint Graph to report every affected API,
 * Feature Slice, UI Screen, and Kanban Task—and offers 1-click sync actions.
 */

import prisma from '../lib/prisma.js';
import { safeJsonParse } from '../utils/safeJsonParse.js';
import { randomUUID } from 'node:crypto';

export interface ChangeImpactReport {
    projectId: string;
    source: {
        type: 'model' | 'api' | 'slice';
        id: string;
        name: string;
        changeSummary: string;
    };
    affectedApis: Array<{ id: string; method: string; path: string; name: string; reason: string }>;
    affectedSlices: Array<{ id: string; title: string; status: string; lane: string; reason: string }>;
    affectedPages: Array<{ id: string; name: string; path: string; reason: string }>;
    affectedTasks: Array<{ id: string; title: string; status: string; assignedTo: string; reason: string }>;
    severity: 'low' | 'medium' | 'high';
    suggestedActions: Array<{
        id: string;
        label: string;
        actionType: 'flag_slices' | 'create_sync_tasks' | 'reseed_mock';
    }>;
    analyzedAt: string;
}

export async function analyzeChangeImpact(params: {
    projectId: string;
    sourceType: 'model' | 'api' | 'slice';
    sourceId: string;
    changeSummary?: string;
}): Promise<ChangeImpactReport> {
    const { projectId, sourceType, sourceId } = params;

    const [project, rawModels, rawApis, rawPages, rawSlices] = await Promise.all([
        prisma.project.findUnique({ where: { id: projectId } }),
        prisma.dataModel.findMany({ where: { projectId } }).catch(() => []),
        prisma.apiEndpoint.findMany({ where: { projectId } }).catch(() => []),
        prisma.page.findMany({ where: { projectId } }).catch(() => []),
        prisma.featureSlice.findMany({ where: { projectId } }).catch(() => []),
    ]);

    if (!project) throw new Error(`Project ${projectId} not found`);

    const models = (rawModels || []).filter((m: any) => m.archived !== true);
    const apis = (rawApis || []).filter((a: any) => a.archived !== true);
    const pages = (rawPages || []).filter((p: any) => p.archived !== true);
    const slices = rawSlices || [];

    const settings = safeJsonParse<Record<string, any>>(project.settings, {});
    const tasks: any[] = Array.isArray(settings.teamTasks) ? settings.teamTasks : [];

    let sourceName = sourceId;
    const affectedApis: ChangeImpactReport['affectedApis'] = [];
    const affectedSlices: ChangeImpactReport['affectedSlices'] = [];
    const affectedPages: ChangeImpactReport['affectedPages'] = [];
    const affectedTasks: ChangeImpactReport['affectedTasks'] = [];

    const seenApis = new Set<string>();
    const seenSlices = new Set<string>();
    const seenPages = new Set<string>();
    const seenTasks = new Set<string>();

    const addApi = (a: any, reason: string) => {
        if (!seenApis.has(a.id)) {
            seenApis.add(a.id);
            affectedApis.push({ id: a.id, method: a.method, path: a.path, name: a.name || a.path, reason });
        }
    };
    const addSlice = (s: any, reason: string) => {
        if (!seenSlices.has(s.id)) {
            seenSlices.add(s.id);
            affectedSlices.push({ id: s.id, title: s.title, status: s.status, lane: s.lane, reason });
        }
    };
    const addPage = (p: any, reason: string) => {
        const pid = p.id || p.idRoot;
        if (!seenPages.has(pid)) {
            seenPages.add(pid);
            affectedPages.push({ id: pid, name: p.name, path: p.path, reason });
        }
    };
    const addTask = (t: any, reason: string) => {
        if (!seenTasks.has(t.id)) {
            seenTasks.add(t.id);
            affectedTasks.push({
                id: t.id,
                title: t.title,
                status: t.status || 'todo',
                assignedTo: t.assignedTo || 'Team',
                reason,
            });
        }
    };

    if (sourceType === 'model') {
        const model = models.find((m: any) => m.id === sourceId || m.name.toLowerCase() === sourceId.toLowerCase());
        if (!model) throw new Error(`Model ${sourceId} not found`);
        sourceName = model.name;
        const nameLower = model.name.toLowerCase();
        const schema = safeJsonParse<Record<string, any>>(model.schema, {});
        const resourceSlug = String(schema.resource || `${nameLower}s`).toLowerCase();

        // 1. Find APIs referencing this model by config.entity, model_ref, or URL path
        for (const api of apis) {
            const cfg = safeJsonParse<Record<string, any>>(api.config, {});
            const entityRef = String(cfg.entity || cfg.request_body?.model_ref || cfg.response_body?.model_ref || '').toLowerCase();
            const pathLower = String(api.path || '').toLowerCase();
            if (entityRef === nameLower || pathLower.includes(resourceSlug) || pathLower.includes(nameLower)) {
                addApi(api, `Endpoint operates on ${model.name} payload/resource`);
            }
        }

        // 2. Find Feature Slices referencing this model or any affected API
        for (const slice of slices) {
            const dmIds: string[] = Array.isArray(slice.dataModelIds) ? slice.dataModelIds : [];
            const apiIds: string[] = Array.isArray(slice.apiIds) ? slice.apiIds : [];
            if (dmIds.includes(model.id) || apiIds.some(id => seenApis.has(id))) {
                addSlice(slice, `Slice depends on ${model.name} schema or its REST endpoints`);
            }
        }

        // 3. Find Pages linked via affected slices or meta.primaryEntity
        for (const page of pages) {
            const pid = page.id || page.idRoot;
            const meta = safeJsonParse<Record<string, any>>(page.meta, {});
            const primaryEntity = String(meta.primaryEntity || '').toLowerCase();
            const linkedInSlice = slices.some((s: any) => seenSlices.has(s.id) && Array.isArray(s.pageIds) && s.pageIds.includes(pid));
            if (primaryEntity === nameLower || linkedInSlice || String(page.name || '').toLowerCase().includes(nameLower)) {
                addPage(page, `Screen renders or mutates ${model.name} data`);
            }
        }

        // 4. Find Tasks linked via affected slices or title/description mention
        for (const task of tasks) {
            const text = `${task.title || ''} ${task.description || ''}`.toLowerCase();
            if ((task.sliceId && seenSlices.has(task.sliceId)) || text.includes(nameLower)) {
                addTask(task, `Task implements ${model.name} or an affected Feature Slice`);
            }
        }
    } else if (sourceType === 'api') {
        const api = apis.find((a: any) => a.id === sourceId);
        if (!api) throw new Error(`API ${sourceId} not found`);
        sourceName = `${api.method} ${api.path}`;

        for (const slice of slices) {
            const apiIds: string[] = Array.isArray(slice.apiIds) ? slice.apiIds : [];
            if (apiIds.includes(api.id)) {
                addSlice(slice, `Slice consumes ${sourceName}`);
                for (const pid of (slice.pageIds || [])) {
                    const page = pages.find((p: any) => (p.id || p.idRoot) === pid);
                    if (page) addPage(page, `Page calls ${sourceName}`);
                }
            }
        }

        for (const task of tasks) {
            const text = `${task.title || ''} ${task.description || ''}`.toLowerCase();
            if ((task.sliceId && seenSlices.has(task.sliceId)) || text.includes(String(api.path).toLowerCase())) {
                addTask(task, `Task depends on ${sourceName}`);
            }
        }
    } else if (sourceType === 'slice') {
        const slice = slices.find((s: any) => s.id === sourceId);
        if (!slice) throw new Error(`Feature slice ${sourceId} not found`);
        sourceName = slice.title;

        for (const aid of (slice.apiIds || [])) {
            const api = apis.find((a: any) => a.id === aid);
            if (api) addApi(api, `Linked to slice "${slice.title}"`);
        }
        for (const pid of (slice.pageIds || [])) {
            const page = pages.find((p: any) => (p.id || p.idRoot) === pid);
            if (page) addPage(page, `Screen belongs to slice "${slice.title}"`);
        }
        for (const task of tasks) {
            if (task.sliceId === slice.id || (Array.isArray(slice.taskIds) && slice.taskIds.includes(task.id))) {
                addTask(task, `Task tracks slice "${slice.title}"`);
            }
        }
    }

    const totalImpacted = affectedApis.length + affectedSlices.length + affectedPages.length + affectedTasks.length;
    const severity: ChangeImpactReport['severity'] =
        totalImpacted >= 6 ? 'high' : totalImpacted >= 3 ? 'medium' : 'low';

    const suggestedActions: ChangeImpactReport['suggestedActions'] = [];
    if (affectedSlices.length > 0) {
        suggestedActions.push({
            id: 'act-flag-slices',
            label: `Flag ${affectedSlices.length} affected slice(s) as Needs Sync`,
            actionType: 'flag_slices',
        });
    }
    if (totalImpacted > 0) {
        suggestedActions.push({
            id: 'act-create-tasks',
            label: `Create team sync task for "${sourceName}" change`,
            actionType: 'create_sync_tasks',
        });
    }
    if (sourceType === 'model') {
        suggestedActions.push({
            id: 'act-reseed-mock',
            label: 'Refresh Mock API validation for updated schema',
            actionType: 'reseed_mock',
        });
    }

    return {
        projectId,
        source: {
            type: sourceType,
            id: sourceId,
            name: sourceName,
            changeSummary: params.changeSummary || `Updated ${sourceType} "${sourceName}"`,
        },
        affectedApis,
        affectedSlices,
        affectedPages,
        affectedTasks,
        severity,
        suggestedActions,
        analyzedAt: new Date().toISOString(),
    };
}

export async function applyImpactSyncActions(params: {
    projectId: string;
    report: ChangeImpactReport;
    flagSlices?: boolean;
    createSyncTask?: boolean;
}) {
    const { projectId, report, flagSlices = true, createSyncTask = true } = params;
    let flaggedSlicesCount = 0;
    let createdTaskId: string | null = null;

    if (flagSlices && report.affectedSlices.length > 0) {
        for (const slice of report.affectedSlices) {
            await prisma.featureSlice.update({
                where: { id: slice.id },
                data: { status: 'needs_sync' },
            }).catch(() => null);
            flaggedSlicesCount += 1;
        }
    }

    if (createSyncTask) {
        const project = await prisma.project.findUnique({ where: { id: projectId } });
        if (project) {
            const settings = safeJsonParse<Record<string, any>>(project.settings, {});
            const existingTasks: any[] = Array.isArray(settings.teamTasks) ? settings.teamTasks : [];
            const taskId = `task-sync-${randomUUID().slice(0, 6)}`;
            const affectedList = [
                ...report.affectedApis.map(a => `API: ${a.method} ${a.path}`),
                ...report.affectedPages.map(p => `Page: ${p.name} (${p.path})`),
                ...report.affectedSlices.map(s => `Slice: ${s.title}`),
            ];

            existingTasks.unshift({
                id: taskId,
                title: `Sync downstream impact: ${report.source.name}`,
                description: `${report.source.changeSummary}\n\nAffected items:\n- ${affectedList.join('\n- ') || 'Verify contract alignment'}`,
                assignedTo: 'Fullstack Engineer',
                status: 'todo',
                priority: report.severity === 'high' ? 'critical' : 'high',
                labels: ['IMPACT-SYNC', report.source.type.toUpperCase()],
                createdAt: new Date().toISOString(),
            });

            settings.teamTasks = existingTasks;
            await prisma.project.update({
                where: { id: projectId },
                data: { settings: JSON.stringify(settings) },
            });
            createdTaskId = taskId;
        }
    }

    return {
        success: true,
        flaggedSlicesCount,
        createdTaskId,
    };
}
