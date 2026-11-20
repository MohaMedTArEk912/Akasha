import { client } from '../hooks/useHttpApi';

export type ArchetypeId =
    | 'ecommerce'
    | 'internal_tool'
    | 'booking_service'
    | 'saas_app'
    | 'marketplace'
    | 'marketing_site';

export interface PlaybookSummary {
    id: ArchetypeId;
    name: string;
    tagline: string;
    category: string;
    accentColor: string;
    recommendedRoles: string[];
    stats: {
        models: number;
        apis: number;
        pages: number;
        slices: number;
        edgeCases: number;
    };
}

export interface ProviderHealth {
    mode: 'live' | 'offline';
    provider: 'gemini' | 'openrouter' | 'openai' | 'ollama' | 'offline';
    model: string;
    baseUrl?: string;
    configured: boolean;
    reason?: string;
}

export interface FeatureSliceItem {
    id: string;
    projectId: string;
    key?: string;
    title: string;
    summary: string;
    lane: 'mvp' | 'v1_1' | 'later';
    status: 'proposed' | 'aligned' | 'prototyped' | 'in_build' | 'needs_sync' | 'shipped';
    owner: string;
    dataModelIds: string[];
    apiIds: string[];
    pageIds: string[];
    taskIds: string[];
    linkedModels: Array<{ id: string; name: string; fieldCount: number }>;
    linkedApis: Array<{ id: string; method: string; path: string; name: string }>;
    linkedPages: Array<{ id: string; name: string; path: string }>;
    acceptanceCriteria: Array<{ id: string; text: string; done: boolean }>;
    edgeCases: Array<{ id: string; text: string; covered: boolean }>;
    votes: Array<{ member: string; vote: 'mvp' | 'next' | 'cut'; updatedAt?: string }>;
    commentsCount: number;
}

export interface ProjectCommentItem {
    id: string;
    projectId: string;
    targetType: string;
    targetId: string;
    author: string;
    body: string;
    resolved: boolean;
    pin?: { x: number; y: number; pagePath?: string } | null;
    createdAt?: string;
}

export interface ProjectDecisionItem {
    id: string;
    projectId: string;
    title: string;
    context: string;
    decision: string;
    author: string;
    status: string;
    linkedSliceId?: string | null;
    createdAt?: string;
}

export interface ReleaseReadinessReport {
    projectId: string;
    score: number;
    stage: 'Ideation' | 'Prototyping' | 'In Build' | 'Ready to Ship';
    checks: Array<{
        id: string;
        label: string;
        category: string;
        status: 'pass' | 'warn' | 'fail';
        weight: number;
        earned: number;
        detail: string;
        actionTab: 'scope' | 'studio' | 'blueprint' | 'build';
    }>;
    counts: {
        slices: number;
        mvpSlices: number;
        models: number;
        apis: number;
        pages: number;
        mockRecords: number;
        decisions: number;
        unresolvedComments: number;
        tasksDone: number;
        tasksTotal: number;
    };
}

export interface ChangeImpactReport {
    projectId: string;
    source: { type: 'model' | 'api' | 'slice'; id: string; name: string; changeSummary: string };
    affectedApis: Array<{ id: string; method: string; path: string; name: string; reason: string }>;
    affectedSlices: Array<{ id: string; title: string; status: string; lane: string; reason: string }>;
    affectedPages: Array<{ id: string; name: string; path: string; reason: string }>;
    affectedTasks: Array<{ id: string; title: string; status: string; assignedTo: string; reason: string }>;
    severity: 'low' | 'medium' | 'high';
    suggestedActions: Array<{ id: string; label: string; actionType: string }>;
    analyzedAt: string;
}

export interface PrototypeManifest {
    projectId: string;
    projectName: string;
    projectDescription: string;
    archetype?: string;
    accentColor: string;
    mockApiBase: string;
    shareEnabled: boolean;
    shareToken?: string;
    pages: Array<{
        id: string;
        name: string;
        path: string;
        pageType: string;
        primaryEntity?: string;
        description: string;
        html: string;
    }>;
    comments: ProjectCommentItem[];
}

export interface DriftReport {
    id: string;
    projectId: string;
    source: string;
    healthScore: number;
    matchedEntities: string[];
    missingInCode: string[];
    undocumentedInBlueprint: string[];
    fieldMismatches: Array<{ entityName: string; missingInCode: string[]; extraInCode: string[] }>;
    matchedApis: string[];
    missingApisInCode: string[];
    undocumentedApisInBlueprint: string[];
    scannedFileCount: number;
    scannedBytes: number;
    createdAt: string;
}

// ── Playbooks & AI Provider ─────────────────────────────────────
export async function fetchPlaybooks(): Promise<PlaybookSummary[]> {
    const res = await client.get('/playbooks');
    return res.data.playbooks || [];
}

export async function bootstrapPlaybook(params: {
    projectId?: string;
    archetype: ArchetypeId;
    productName?: string;
    pitch?: string;
}) {
    const res = await client.post('/playbooks/bootstrap', params);
    return res.data;
}

export async function fetchProviderStatus(): Promise<ProviderHealth> {
    const res = await client.get('/ai/provider-status');
    return res.data.health;
}

// ── Feature Slices, Comments, Decisions & Readiness ─────────────
export async function fetchSlicesWorkspace(projectId: string): Promise<{
    slices: FeatureSliceItem[];
    comments: ProjectCommentItem[];
    decisions: ProjectDecisionItem[];
    readiness: ReleaseReadinessReport | null;
}> {
    const res = await client.get(`/slices/${projectId}`);
    return res.data;
}

export async function createSlice(payload: {
    projectId: string;
    title: string;
    summary?: string;
    lane?: 'mvp' | 'v1_1' | 'later';
    owner?: string;
    acceptanceCriteria?: string[];
    edgeCases?: string[];
}) {
    const res = await client.post('/slices', payload);
    return res.data.slice;
}

export async function updateSlice(sliceId: string, updates: Record<string, unknown>) {
    const res = await client.put(`/slices/${sliceId}`, updates);
    return res.data.slice;
}

export async function deleteSlice(sliceId: string) {
    const res = await client.delete(`/slices/${sliceId}`);
    return res.data;
}

export async function voteSlice(sliceId: string, member: string, vote: 'mvp' | 'next' | 'cut') {
    const res = await client.post(`/slices/${sliceId}/vote`, { member, vote });
    return res.data.slice;
}

export async function fetchSliceBuildPack(projectId: string, sliceId: string) {
    const res = await client.get(`/slices/${projectId}/build-pack/${sliceId}`);
    return res.data.buildPack;
}

export async function postProjectComment(payload: {
    projectId: string;
    targetType: 'slice' | 'page' | 'model' | 'api' | 'preview_pin' | 'general';
    targetId: string;
    author: string;
    body: string;
    pin?: { x: number; y: number; pagePath?: string } | null;
}) {
    const res = await client.post('/slices/comments', payload);
    return res.data.comment;
}

export async function resolveProjectComment(commentId: string, resolved: boolean) {
    const res = await client.patch(`/slices/comments/${commentId}`, { resolved });
    return res.data.comment;
}

export async function postProjectDecision(payload: {
    projectId: string;
    title: string;
    context?: string;
    decision: string;
    author?: string;
    linkedSliceId?: string;
}) {
    const res = await client.post('/slices/decisions', payload);
    return res.data.decision;
}

export async function fetchReleaseReadiness(projectId: string): Promise<ReleaseReadinessReport> {
    const res = await client.get(`/slices/readiness/${projectId}`);
    return res.data.readiness;
}

// ── Change Impact Ripple ────────────────────────────────────────
export async function analyzeChangeImpact(params: {
    projectId: string;
    sourceType: 'model' | 'api' | 'slice';
    sourceId: string;
    changeSummary?: string;
}): Promise<ChangeImpactReport> {
    const res = await client.post('/slices/impact/analyze', params);
    return res.data.report;
}

export async function applyImpactSync(params: {
    projectId: string;
    report: ChangeImpactReport;
    flagSlices?: boolean;
    createSyncTask?: boolean;
}) {
    const res = await client.post('/slices/impact/apply', params);
    return res.data;
}

// ── Live Stateful Mock API & Prototype Preview ──────────────────
export async function fetchMockMeta(projectId: string) {
    const res = await fetch(`/api/mock/${encodeURIComponent(projectId)}/_meta/resources`);
    return res.json();
}

export async function resetMockSeed(projectId: string) {
    const res = await fetch(`/api/mock/${encodeURIComponent(projectId)}/_meta/seed`, { method: 'POST' });
    return res.json();
}

export async function fetchPrototypeManifest(projectId: string, token?: string): Promise<PrototypeManifest> {
    const q = token ? `?token=${encodeURIComponent(token)}` : '';
    const res = await client.get(`/preview/${projectId}/manifest${q}`);
    return res.data.manifest;
}

export async function postPreviewPin(projectId: string, payload: {
    pageId: string;
    pagePath: string;
    author: string;
    body: string;
    x: number;
    y: number;
    token?: string;
}) {
    const res = await client.post(`/preview/${projectId}/pin-comment`, payload);
    return res.data.comment;
}

export async function togglePreviewShare(projectId: string, enabled?: boolean, rotateToken?: boolean) {
    const res = await client.post(`/preview/${projectId}/toggle-share`, { enabled, rotateToken });
    return res.data;
}

// ── Drift Radar & Full-Stack Codegen Bundle ─────────────────────
export async function runDriftCheck(projectId: string, workspaceDir?: string): Promise<DriftReport> {
    const res = await client.post(`/agent-squad/drift/${projectId}`, { workspaceDir });
    return res.data.report;
}

export async function fetchLatestDrift(projectId: string): Promise<DriftReport | null> {
    const res = await client.get(`/agent-squad/drift/${projectId}`);
    return res.data.report || null;
}

export async function fetchGeneratedBundle(projectId: string): Promise<{
    projectName: string;
    files: Array<{ path: string; content: string; mimeType: string }>;
}> {
    const res = await client.get(`/codegen/bundle/${projectId}`);
    return res.data;
}

export async function exportFullStackProject(projectId: string) {
    const res = await client.post('/codegen/export', { projectId });
    return res.data;
}
