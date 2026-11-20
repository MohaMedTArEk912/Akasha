/**
 * Feature Slice Service — Vertical Capabilities, Scope Voting, Inline Comments & Team Decisions (ADRs)
 */

import prisma from '../lib/prisma.js';
import { safeJsonParse } from '../utils/safeJsonParse.js';
import { randomUUID } from 'node:crypto';

export type SliceLane = 'mvp' | 'v1_1' | 'later';
export type SliceStatus = 'proposed' | 'aligned' | 'prototyped' | 'in_build' | 'needs_sync' | 'shipped';

export interface SliceVote {
    member: string;
    vote: 'mvp' | 'next' | 'cut';
    updatedAt?: string;
}

export interface SliceCriterion {
    id: string;
    text: string;
    done: boolean;
}

export interface SliceEdgeCase {
    id: string;
    text: string;
    covered: boolean;
}

export interface HydratedFeatureSlice {
    id: string;
    projectId: string;
    key?: string;
    title: string;
    summary: string;
    lane: SliceLane;
    status: SliceStatus;
    owner: string;
    dataModelIds: string[];
    apiIds: string[];
    pageIds: string[];
    taskIds: string[];
    linkedModels: Array<{ id: string; name: string; fieldCount: number }>;
    linkedApis: Array<{ id: string; method: string; path: string; name: string }>;
    linkedPages: Array<{ id: string; name: string; path: string }>;
    acceptanceCriteria: SliceCriterion[];
    edgeCases: SliceEdgeCase[];
    votes: SliceVote[];
    commentsCount: number;
    createdAt?: string;
    updatedAt?: string;
}

export async function listProjectWorkspaceSlices(projectId: string) {
    const [slices, models, apis, pages, comments, decisions] = await Promise.all([
        prisma.featureSlice.findMany({ where: { projectId }, orderBy: { createdAt: 'asc' } }).catch(() => []),
        prisma.dataModel.findMany({ where: { projectId } }).catch(() => []),
        prisma.apiEndpoint.findMany({ where: { projectId } }).catch(() => []),
        prisma.page.findMany({ where: { projectId } }).catch(() => []),
        prisma.projectComment.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' } }).catch(() => []),
        prisma.projectDecision.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' } }).catch(() => []),
    ]);

    const activeModels = (models || []).filter((m: any) => m.archived !== true);
    const activeApis = (apis || []).filter((a: any) => a.archived !== true);
    const activePages = (pages || []).filter((p: any) => p.archived !== true);

    const modelById = new Map<string, { id: string; name: string; fieldCount: number }>();
    for (const m of activeModels) {
        const schema = safeJsonParse<{ fields?: any[] }>(m.schema, {});
        const fieldCount = Array.isArray(schema.fields) ? schema.fields.length : 0;
        modelById.set(m.id, { id: m.id, name: m.name, fieldCount });
    }

    const apiById = new Map<string, { id: string; method: string; path: string; name: string }>();
    for (const a of activeApis) {
        apiById.set(a.id, { id: a.id, method: a.method, path: a.path, name: a.name || `${a.method} ${a.path}` });
    }

    const pageById = new Map<string, { id: string; name: string; path: string }>();
    for (const p of activePages) {
        const pid = p.id || p.idRoot;
        pageById.set(pid, { id: pid, name: p.name, path: p.path });
    }

    const commentsByTarget = new Map<string, number>();
    for (const c of comments || []) {
        const key = `${c.targetType}:${c.targetId}`;
        commentsByTarget.set(key, (commentsByTarget.get(key) || 0) + 1);
    }

    const hydrated: HydratedFeatureSlice[] = (slices || []).map((s: any) => {
        const dataModelIds: string[] = Array.isArray(s.dataModelIds) ? s.dataModelIds : [];
        const apiIds: string[] = Array.isArray(s.apiIds) ? s.apiIds : [];
        const pageIds: string[] = Array.isArray(s.pageIds) ? s.pageIds : [];
        const taskIds: string[] = Array.isArray(s.taskIds) ? s.taskIds : [];

        return {
            id: s.id,
            projectId: s.projectId,
            key: s.key,
            title: s.title || 'Untitled Feature',
            summary: s.summary || '',
            lane: (['mvp', 'v1_1', 'later'].includes(s.lane) ? s.lane : 'mvp') as SliceLane,
            status: (['proposed', 'aligned', 'prototyped', 'in_build', 'needs_sync', 'shipped'].includes(s.status)
                ? s.status
                : 'proposed') as SliceStatus,
            owner: s.owner || 'Unassigned',
            dataModelIds,
            apiIds,
            pageIds,
            taskIds,
            linkedModels: dataModelIds.map(id => modelById.get(id)).filter(Boolean) as any[],
            linkedApis: apiIds.map(id => apiById.get(id)).filter(Boolean) as any[],
            linkedPages: pageIds.map(id => pageById.get(id)).filter(Boolean) as any[],
            acceptanceCriteria: Array.isArray(s.acceptanceCriteria) ? s.acceptanceCriteria : [],
            edgeCases: Array.isArray(s.edgeCases) ? s.edgeCases : [],
            votes: Array.isArray(s.votes) ? s.votes : [],
            commentsCount: commentsByTarget.get(`slice:${s.id}`) || 0,
            createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
            updatedAt: s.updatedAt instanceof Date ? s.updatedAt.toISOString() : s.updatedAt,
        };
    });

    return {
        slices: hydrated,
        comments: (comments || []).map((c: any) => ({
            id: c.id,
            projectId: c.projectId,
            targetType: c.targetType,
            targetId: c.targetId,
            author: c.author || 'Teammate',
            body: c.body,
            resolved: Boolean(c.resolved),
            pin: c.pin || null,
            createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
        })),
        decisions: (decisions || []).map((d: any) => ({
            id: d.id,
            projectId: d.projectId,
            title: d.title,
            context: d.context || '',
            decision: d.decision,
            author: d.author || 'Team',
            status: d.status || 'accepted',
            linkedSliceId: d.linkedSliceId || null,
            createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : d.createdAt,
        })),
    };
}

export async function createFeatureSlice(input: {
    projectId: string;
    title: string;
    summary?: string;
    lane?: SliceLane;
    status?: SliceStatus;
    owner?: string;
    dataModelIds?: string[];
    apiIds?: string[];
    pageIds?: string[];
    acceptanceCriteria?: Array<string | SliceCriterion>;
    edgeCases?: Array<string | SliceEdgeCase>;
}) {
    const id = `slice-${randomUUID().slice(0, 8)}`;
    const criteria: SliceCriterion[] = (input.acceptanceCriteria || []).map((item, idx) =>
        typeof item === 'string'
            ? { id: `ac-${idx + 1}`, text: item, done: false }
            : { id: item.id || `ac-${idx + 1}`, text: item.text, done: Boolean(item.done) }
    );
    const edgeCases: SliceEdgeCase[] = (input.edgeCases || []).map((item, idx) =>
        typeof item === 'string'
            ? { id: `ec-${idx + 1}`, text: item, covered: false }
            : { id: item.id || `ec-${idx + 1}`, text: item.text, covered: Boolean(item.covered) }
    );

    return prisma.featureSlice.create({
        data: {
            id,
            projectId: input.projectId,
            title: input.title.trim(),
            summary: (input.summary || '').trim(),
            lane: input.lane || 'mvp',
            status: input.status || 'proposed',
            owner: input.owner || 'Unassigned',
            dataModelIds: input.dataModelIds || [],
            apiIds: input.apiIds || [],
            pageIds: input.pageIds || [],
            taskIds: [],
            acceptanceCriteria: criteria,
            edgeCases,
            votes: [],
        },
    });
}

export async function updateFeatureSlice(sliceId: string, updates: Record<string, any>) {
    const existing = await prisma.featureSlice.findUnique({ where: { id: sliceId } });
    if (!existing) throw new Error(`Feature slice ${sliceId} not found`);

    const data: Record<string, any> = {};
    const allowed = [
        'title', 'summary', 'lane', 'status', 'owner',
        'dataModelIds', 'apiIds', 'pageIds', 'taskIds',
        'acceptanceCriteria', 'edgeCases', 'votes',
    ];
    for (const key of allowed) {
        if (updates[key] !== undefined) data[key] = updates[key];
    }

    return prisma.featureSlice.update({
        where: { id: sliceId },
        data,
    });
}

export async function deleteFeatureSlice(sliceId: string) {
    await prisma.featureSlice.delete({ where: { id: sliceId } });
    return { success: true };
}

export async function voteOnFeatureSlice(sliceId: string, member: string, vote: 'mvp' | 'next' | 'cut') {
    const slice = await prisma.featureSlice.findUnique({ where: { id: sliceId } });
    if (!slice) throw new Error(`Feature slice ${sliceId} not found`);

    const votes: SliceVote[] = Array.isArray(slice.votes) ? [...slice.votes] : [];
    const normalizedMember = member.trim() || 'Teammate';
    const existingIdx = votes.findIndex(v => v.member.toLowerCase() === normalizedMember.toLowerCase());
    const entry: SliceVote = { member: normalizedMember, vote, updatedAt: new Date().toISOString() };

    if (existingIdx >= 0) {
        votes[existingIdx] = entry;
    } else {
        votes.push(entry);
    }

    return prisma.featureSlice.update({
        where: { id: sliceId },
        data: { votes },
    });
}

export async function addProjectComment(input: {
    projectId: string;
    targetType: 'slice' | 'page' | 'model' | 'api' | 'preview_pin' | 'general';
    targetId: string;
    author: string;
    body: string;
    pin?: { x: number; y: number; pagePath?: string } | null;
}) {
    return prisma.projectComment.create({
        data: {
            id: `cmt-${randomUUID().slice(0, 8)}`,
            projectId: input.projectId,
            targetType: input.targetType,
            targetId: input.targetId,
            author: input.author.trim() || 'Teammate',
            body: input.body.trim(),
            resolved: false,
            pin: input.pin || null,
        },
    });
}

export async function resolveProjectComment(commentId: string, resolved: boolean) {
    return prisma.projectComment.update({
        where: { id: commentId },
        data: { resolved },
    });
}

export async function addProjectDecision(input: {
    projectId: string;
    title: string;
    context?: string;
    decision: string;
    author?: string;
    linkedSliceId?: string;
}) {
    return prisma.projectDecision.create({
        data: {
            id: `adr-${randomUUID().slice(0, 8)}`,
            projectId: input.projectId,
            title: input.title.trim(),
            context: (input.context || '').trim(),
            decision: input.decision.trim(),
            author: (input.author || 'Team').trim(),
            status: 'accepted',
            linkedSliceId: input.linkedSliceId || null,
        },
    });
}
