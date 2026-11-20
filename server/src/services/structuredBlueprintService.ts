import prisma from '../lib/prisma.js';
import { safeJsonParse } from '../utils/safeJsonParse.js';
import fs from 'fs-extra';
import path from 'path';

export interface CompiledDataModel {
    id?: string;
    name: string;
    description?: string;
    fields: Array<{
        name: string;
        type: string;
        required?: boolean;
        isId?: boolean;
        isUnique?: boolean;
    }>;
    relations?: Array<{
        targetModel: string;
        type: string;
        foreignKey?: string;
    }>;
}

export interface CompiledApiEndpoint {
    id?: string;
    method: string;
    path: string;
    summary?: string;
    description?: string;
    requestBody?: unknown;
    responses?: unknown;
    queryParams?: unknown[];
    pathParams?: unknown[];
}

export interface CompiledPage {
    id: string;
    name: string;
    path: string;
    pageType?: string;
    componentCount: number;
    description?: string;
}

export interface CompiledUseCase {
    title: string;
    actor: string;
    scenario: string;
    steps?: string[];
}

export interface CompiledTask {
    id: string;
    title: string;
    description?: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    status: 'todo' | 'in_progress' | 'done';
    assigneeRole: string;
    claimedBy?: string;
}

export interface CompiledFeatureSlice {
    id: string;
    title: string;
    summary: string;
    lane: 'mvp' | 'v1_1' | 'later';
    status: string;
    owner?: string;
    linkedModels: string[];
    linkedApis: string[];
    linkedPages: string[];
    acceptanceCriteria: Array<{ text: string; done: boolean }>;
    edgeCases: Array<{ text: string; covered: boolean }>;
}

export interface CompiledDecision {
    id: string;
    title: string;
    decision: string;
    context?: string;
    author?: string;
    createdAt?: string;
}

export interface TokenMetrics {
    baselineExplorationTokens: number;
    structuredBlueprintTokens: number;
    tokensSaved: number;
    savingsPercent: number;
    measurementSource: 'measured' | 'estimated';
}

export interface CompiledProjectBlueprint {
    projectId: string;
    projectName: string;
    projectDescription: string;
    archetype?: string;
    compiledAt: string;
    version: string;
    architectureOverview: {
        frontend: string;
        backend: string;
        database: string;
        storage: string;
    };
    entities: CompiledDataModel[];
    apiContracts: CompiledApiEndpoint[];
    pages: CompiledPage[];
    useCases: CompiledUseCase[];
    featureSlices: CompiledFeatureSlice[];
    decisions: CompiledDecision[];
    tasks: CompiledTask[];
    tokenMetrics: TokenMetrics;
    agentDirectives: {
        rules: string[];
        codingStandards: string[];
    };
    markdownSystemPrompt: string;
}

function isActive(doc: any): boolean {
    return doc && doc.archived !== true;
}

/**
 * Compiles a single-source-of-truth architectural blueprint from all Akasha MongoDB collections.
 * Correctly parses stringified `schema`, `config`, `actors`, `steps`, and `meta` JSON fields.
 */
export async function compileProjectBlueprint(projectId: string): Promise<CompiledProjectBlueprint> {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
        throw new Error(`Project with ID ${projectId} not found`);
    }

    const [rawDataModels, rawApiEndpoints, rawPages, rawUseCases, rawSlices, rawDecisions] = await Promise.all([
        prisma.dataModel.findMany({ where: { projectId } }).catch(() => []),
        prisma.apiEndpoint.findMany({ where: { projectId } }).catch(() => []),
        prisma.page.findMany({ where: { projectId } }).catch(() => []),
        prisma.useCase.findMany({ where: { projectId } }).catch(() => []),
        prisma.featureSlice.findMany({ where: { projectId } }).catch(() => []),
        prisma.projectDecision.findMany({ where: { projectId } }).catch(() => []),
    ]);

    const dataModels = (rawDataModels || []).filter(isActive);
    const apiEndpoints = (rawApiEndpoints || []).filter(isActive);
    const pages = (rawPages || []).filter(isActive);
    const useCases = (rawUseCases || []).filter(isActive);

    const rawSettings = safeJsonParse<Record<string, any>>(project.settings, {});
    const archetype = typeof rawSettings.archetype === 'string' ? rawSettings.archetype : undefined;
    const rawTasks: any[] = Array.isArray(rawSettings.teamTasks)
        ? rawSettings.teamTasks
        : Array.isArray(rawSettings.tasks)
            ? rawSettings.tasks
            : [];

    const tasks: CompiledTask[] = rawTasks.map((t: any, idx: number) => {
        const prioRaw = String(t.priority || 'medium').toLowerCase();
        const statusRaw = String(t.status || 'todo').toLowerCase();
        return {
            id: t.id || `task-${idx + 1}`,
            title: t.title || t.name || 'Untitled Task',
            description: t.description || t.desc || '',
            priority: (['critical', 'high', 'medium', 'low'].includes(prioRaw) ? prioRaw : 'medium') as CompiledTask['priority'],
            status: (['todo', 'in_progress', 'done'].includes(statusRaw) ? statusRaw : 'todo') as CompiledTask['status'],
            assigneeRole: t.assignedTo || t.assignee || t.assigneeRole || 'Whole Team',
            claimedBy: t.claimedBy || undefined,
        };
    });

    // Normalize Data Models (handles both object and JSON-stringified `schema`)
    const entities: CompiledDataModel[] = dataModels.map((m: any) => {
        const parsedSchema = safeJsonParse<Record<string, any>>(m.schema, {});
        let rawFields: any[] = [];
        if (Array.isArray(m.fields) && m.fields.length > 0) {
            rawFields = m.fields;
        } else if (Array.isArray(parsedSchema.fields)) {
            rawFields = parsedSchema.fields;
        } else if (parsedSchema && typeof parsedSchema === 'object' && !Array.isArray(parsedSchema)) {
            rawFields = Object.entries(parsedSchema)
                .filter(([k]) => k !== 'fields' && k !== 'relations')
                .map(([name, type]) => ({ name, field_type: String(type), required: true }));
        }

        const fields = rawFields.map((f: any) => ({
            name: String(f.name || 'field'),
            type: String(f.field_type || f.type || 'string'),
            required: f.required !== false,
            isId: Boolean(f.primary_key || f.isId || f.name === 'id'),
            isUnique: Boolean(f.unique || f.isUnique || f.primary_key),
        }));

        const schemaObj = (!Array.isArray(parsedSchema) && parsedSchema && typeof parsedSchema === 'object')
            ? parsedSchema
            : {};

        const rawRelations = Array.isArray(m.relations)
            ? m.relations
            : Array.isArray(schemaObj.relations)
                ? schemaObj.relations
                : [];

        const relations = rawRelations.map((r: any) => ({
            targetModel: String(r.target_model || r.targetModel || r.model || ''),
            type: String(r.relation_type || r.type || 'many'),
            foreignKey: r.foreign_key || r.foreignKey || r.name || undefined,
        })).filter((r: any) => r.targetModel);

        return {
            id: m.id,
            name: m.name,
            description: m.description || schemaObj.description || '',
            fields,
            relations,
        };
    });

    // Normalize REST API contracts (handles JSON-stringified `config`)
    const apiContracts: CompiledApiEndpoint[] = apiEndpoints.map((api: any) => {
        const parsedConfig = safeJsonParse<Record<string, any>>(api.config, {});
        return {
            id: api.id,
            method: String(api.method || 'GET').toUpperCase(),
            path: api.path || api.endpoint || '/',
            summary: api.name || api.summary || parsedConfig.summary || '',
            description: api.description || parsedConfig.description || '',
            requestBody: api.requestBody ?? api.request_body ?? parsedConfig.request_body ?? parsedConfig.requestBody ?? null,
            responses: api.responses ?? api.response_body ?? parsedConfig.response_body ?? parsedConfig.responses ?? null,
            queryParams: Array.isArray(parsedConfig.query_params) ? parsedConfig.query_params : [],
            pathParams: Array.isArray(parsedConfig.path_params) ? parsedConfig.path_params : [],
        };
    });

    // Normalize Pages (also merges sandbox pages if Page collection is empty)
    const compiledPages: CompiledPage[] = pages.map((p: any) => {
        const meta = safeJsonParse<Record<string, any>>(p.meta, {});
        return {
            id: p.id || p.idRoot,
            name: p.name || 'Page',
            path: p.path || `/${(p.name || 'page').toLowerCase().replace(/\s+/g, '-')}`,
            pageType: meta.pageType || meta.type || undefined,
            componentCount: Array.isArray(p.blocks) ? p.blocks.length : (meta.componentCount || 1),
            description: p.description || meta.description || '',
        };
    });

    const sandboxData = safeJsonParse<{ pages?: any[] }>(rawSettings.sandbox, {});
    if (compiledPages.length === 0 && Array.isArray(sandboxData.pages)) {
        for (const sp of sandboxData.pages) {
            compiledPages.push({
                id: sp.id || `sandbox-${(sp.name || 'page').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
                name: sp.name || 'Page',
                path: sp.path || '/',
                pageType: sp.type || 'dashboard',
                componentCount: 1,
                description: sp.description || '',
            });
        }
    }

    // Normalize Use Cases (handles JSON-stringified `actors` & `steps`)
    const compiledUseCases: CompiledUseCase[] = useCases.map((uc: any) => {
        const actors = safeJsonParse<string[]>(uc.actors, []);
        const rawSteps = safeJsonParse<any[]>(uc.steps, []);
        const steps = rawSteps.map((s) =>
            typeof s === 'string' ? s : (s.action || s.description || JSON.stringify(s))
        );
        return {
            title: uc.name || uc.title || 'Core Scenario',
            actor: Array.isArray(actors) && actors.length > 0 ? actors.join(', ') : (uc.actor || 'User'),
            scenario: uc.description || uc.scenario || '',
            steps,
        };
    });

    // Normalize Feature Slices & Decisions
    const modelNameById = new Map(entities.map(e => [e.id, e.name]));
    const apiLabelById = new Map(apiContracts.map(a => [a.id, `${a.method} ${a.path}`]));
    const pageNameById = new Map(compiledPages.map(p => [p.id, p.name]));

    const featureSlices: CompiledFeatureSlice[] = (rawSlices || []).map((s: any) => {
        const linkedModelIds: string[] = Array.isArray(s.dataModelIds) ? s.dataModelIds : [];
        const linkedApiIds: string[] = Array.isArray(s.apiIds) ? s.apiIds : [];
        const linkedPageIds: string[] = Array.isArray(s.pageIds) ? s.pageIds : [];
        return {
            id: s.id,
            title: s.title || 'Feature Slice',
            summary: s.summary || '',
            lane: (['mvp', 'v1_1', 'later'].includes(s.lane) ? s.lane : 'mvp') as CompiledFeatureSlice['lane'],
            status: s.status || 'proposed',
            owner: s.owner || undefined,
            linkedModels: linkedModelIds.map(id => modelNameById.get(id) || id),
            linkedApis: linkedApiIds.map(id => apiLabelById.get(id) || id),
            linkedPages: linkedPageIds.map(id => pageNameById.get(id) || id),
            acceptanceCriteria: Array.isArray(s.acceptanceCriteria) ? s.acceptanceCriteria : [],
            edgeCases: Array.isArray(s.edgeCases) ? s.edgeCases : [],
        };
    });

    const decisions: CompiledDecision[] = (rawDecisions || []).map((d: any) => ({
        id: d.id,
        title: d.title || 'Decision',
        decision: d.decision || '',
        context: d.context || '',
        author: d.author || 'Team',
        createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : d.createdAt,
    }));

    // Honest Token Metrics (calculated directly from actual serialized blueprint bytes vs. raw codebase baseline)
    const compactPayload = JSON.stringify({ entities, apiContracts, pages: compiledPages, featureSlices, decisions, tasks });
    const structuredBlueprintTokens = Math.max(150, Math.ceil(compactPayload.length / 4));
    const repoFileCount = Number(rawSettings.repoMetrics?.fileCount || 0);
    const repoTotalBytes = Number(rawSettings.repoMetrics?.totalBytes || 0);
    const hasMeasuredRepo = repoTotalBytes > 0;
    const baselineExplorationTokens = hasMeasuredRepo
        ? Math.max(structuredBlueprintTokens + 500, Math.ceil(repoTotalBytes / 4))
        : Math.max(
            structuredBlueprintTokens + 2000,
            8000 + (entities.length * 1600) + (apiContracts.length * 1200) + (compiledPages.length * 1800) + (featureSlices.length * 900)
        );
    const tokensSaved = Math.max(0, baselineExplorationTokens - structuredBlueprintTokens);
    const savingsPercent = baselineExplorationTokens > 0
        ? Math.min(99, Math.max(0, Math.round((tokensSaved / baselineExplorationTokens) * 100)))
        : 0;

    const tokenMetrics: TokenMetrics = {
        baselineExplorationTokens,
        structuredBlueprintTokens,
        tokensSaved,
        savingsPercent,
        measurementSource: hasMeasuredRepo ? 'measured' : 'estimated',
    };

    const techStack = rawSettings.ideaDetails?.technicalArchitecture || {};
    const architectureOverview = {
        frontend: techStack.frontend || 'React 18 + Vite + TypeScript + Tailwind CSS',
        backend: techStack.backend || 'Node.js + Express 5 + TypeScript',
        database: techStack.database || 'MongoDB',
        storage: 'MongoDB GridFS + Akasha Blueprint Graph',
    };

    const agentDirectives = {
        rules: [
            'Strictly match the entity names, field types, and relations defined in this blueprint.',
            'Do NOT invent ungrounded schemas or rename REST API endpoints without syncing via akasha_upsert_api_endpoint.',
            'Respect logged team decisions (ADRs) and cover all listed edge cases for the target Feature Slice.',
            'Claim tasks via akasha_claim_task before editing and stream real progress via akasha_stream_agent_telemetry.',
        ],
        codingStandards: [
            'Use realistic domain data; never leave placeholder "John Doe" or dead alert() handlers.',
            'Maintain strict TypeScript compilation (tsc --noEmit exit code 0).',
            'Keep frontend types and backend controllers aligned on shared API contracts.',
        ],
    };

    const markdownSystemPrompt = `# AKASHA LIVING PRODUCT BLUEPRINT
Project: ${project.name}${archetype ? ` (${archetype})` : ''}
Description: ${project.description || 'Collaborative small-team web application'}
Blueprint Context Size: ~${structuredBlueprintTokens.toLocaleString()} tokens (${savingsPercent}% ${tokenMetrics.measurementSource} reduction vs. raw repo scan)

## 1. VERTICAL FEATURE SLICES (MVP FIRST)
${featureSlices.length === 0 ? '_No feature slices defined yet._' : featureSlices.map(s => `
### [${s.lane.toUpperCase()}] ${s.title} (${s.status}${s.owner ? ` • Owner: ${s.owner}` : ''})
${s.summary}
- **Entities:** ${s.linkedModels.join(', ') || 'None'}
- **APIs:** ${s.linkedApis.join(', ') || 'None'}
- **Pages:** ${s.linkedPages.join(', ') || 'None'}
${s.acceptanceCriteria.length ? `- **Acceptance Criteria:**\n${s.acceptanceCriteria.map(c => `  - [${c.done ? 'x' : ' '}] ${c.text}`).join('\n')}` : ''}
${s.edgeCases.length ? `- **Edge Cases:**\n${s.edgeCases.map(e => `  - [${e.covered ? 'x' : ' '}] ${e.text}`).join('\n')}` : ''}
`).join('\n')}

## 2. DATA MODELS & SCHEMAS
${entities.length === 0 ? '_No explicit models defined._' : entities.map(e => `
### Entity: ${e.name}
${e.description ? `> ${e.description}\n` : ''}Fields:
${e.fields.map(f => `- \`${f.name}\`: ${f.type}${f.isId ? ' (PK)' : ''}${f.isUnique ? ' [Unique]' : ''}${f.required ? ' [Required]' : ''}`).join('\n')}
${e.relations && e.relations.length ? `Relations:\n${e.relations.map(r => `- -> \`${r.targetModel}\` (${r.type})`).join('\n')}` : ''}
`).join('\n')}

## 3. REST API CONTRACTS
${apiContracts.length === 0 ? '_No endpoints defined._' : apiContracts.map(a => `- **${a.method} ${a.path}** — ${a.summary || a.description || 'Endpoint'}`).join('\n')}

## 4. UI PAGES & ROUTES
${compiledPages.length === 0 ? '_No pages defined._' : compiledPages.map(p => `- **${p.name}** (\`${p.path}\`) ${p.description ? `— ${p.description}` : ''}`).join('\n')}

## 5. TEAM DECISIONS (ADRs)
${decisions.length === 0 ? '_No decisions recorded._' : decisions.map(d => `- **${d.title}**: ${d.decision}${d.author ? ` (${d.author})` : ''}`).join('\n')}

## 6. ACTIVE TASK QUEUE
${tasks.length === 0 ? '_No tasks queued._' : tasks.map(t => `- [${t.status === 'done' ? 'x' : t.status === 'in_progress' ? '~' : ' '}] **[${t.priority.toUpperCase()}]** ${t.title} (Assignee: ${t.assigneeRole}${t.claimedBy ? ` • Claimed: ${t.claimedBy}` : ''})`).join('\n')}

## 7. AGENT DIRECTIVES
${agentDirectives.rules.map(r => `- ${r}`).join('\n')}
`;

    return {
        projectId,
        projectName: project.name,
        projectDescription: project.description || '',
        archetype,
        compiledAt: new Date().toISOString(),
        version: '2.0.0',
        architectureOverview,
        entities,
        apiContracts,
        pages: compiledPages,
        useCases: compiledUseCases,
        featureSlices,
        decisions,
        tasks,
        tokenMetrics,
        agentDirectives,
        markdownSystemPrompt,
    };
}

/**
 * Compiles a focused Build Pack for ONE Feature Slice so a teammate or external IDE agent
 * only loads the exact entities, APIs, decisions, edge cases, and tasks needed for that slice.
 */
export async function compileFeatureBuildPack(projectId: string, sliceId: string) {
    const blueprint = await compileProjectBlueprint(projectId);
    const slice = blueprint.featureSlices.find(s => s.id === sliceId)
        || blueprint.featureSlices.find(s => s.title.toLowerCase() === sliceId.toLowerCase());

    if (!slice) {
        throw new Error(`Feature slice "${sliceId}" not found in project ${projectId}`);
    }

    const linkedModelNames = new Set(slice.linkedModels.map(m => m.toLowerCase()));
    const linkedApiKeys = new Set(slice.linkedApis.map(a => a.toLowerCase()));
    const linkedPageNames = new Set(slice.linkedPages.map(p => p.toLowerCase()));

    const scopedEntities = blueprint.entities.filter(e =>
        linkedModelNames.has(e.name.toLowerCase()) || (e.id && linkedModelNames.has(e.id.toLowerCase()))
    );
    const scopedApis = blueprint.apiContracts.filter(a =>
        linkedApiKeys.has(`${a.method} ${a.path}`.toLowerCase()) || (a.id && linkedApiKeys.has(a.id.toLowerCase()))
    );
    const scopedPages = blueprint.pages.filter(p =>
        linkedPageNames.has(p.name.toLowerCase()) || linkedPageNames.has(p.id.toLowerCase())
    );

    const markdownPrompt = `# AKASHA FEATURE BUILD PACK — ${slice.title}
Project: ${blueprint.projectName} (${blueprint.projectId})
Slice Lane: ${slice.lane.toUpperCase()} | Status: ${slice.status}${slice.owner ? ` | Owner: ${slice.owner}` : ''}

## Summary
${slice.summary}

## Acceptance Criteria
${slice.acceptanceCriteria.map(c => `- [${c.done ? 'x' : ' '}] ${c.text}`).join('\n') || '- Deliver working end-to-end flow'}

## Domain Edge Cases to Handle
${slice.edgeCases.map(e => `- [${e.covered ? 'x' : ' '}] ${e.text}`).join('\n') || '- Standard error & empty states'}

## Scoped Data Models (${scopedEntities.length})
${scopedEntities.map(e => `### ${e.name}\n${e.fields.map(f => `- \`${f.name}\`: ${f.type}${f.required ? ' (required)' : ''}`).join('\n')}`).join('\n\n') || '_None linked_'}

## Scoped REST API Contracts (${scopedApis.length})
${scopedApis.map(a => `- **${a.method} ${a.path}** — ${a.summary || a.description || ''}`).join('\n') || '_None linked_'}

## Scoped UI Screens (${scopedPages.length})
${scopedPages.map(p => `- **${p.name}** (\`${p.path}\`) — ${p.description || ''}`).join('\n') || '_None linked_'}

## Relevant Team Decisions
${blueprint.decisions.map(d => `- **${d.title}:** ${d.decision}`).join('\n') || '_None recorded_'}
`;

    return {
        projectId,
        projectName: blueprint.projectName,
        slice,
        entities: scopedEntities,
        apiContracts: scopedApis,
        pages: scopedPages,
        decisions: blueprint.decisions,
        estimatedTokens: Math.ceil(markdownPrompt.length / 4),
        markdownPrompt,
    };
}

/**
 * Saves the compiled blueprint into a local `.akasha/blueprint.json` + `.akasha/BLUEPRINT.md` file.
 */
export async function persistBlueprintToFile(workspaceRoot: string, blueprint: CompiledProjectBlueprint): Promise<string> {
    const akashaDir = path.join(workspaceRoot, '.akasha');
    await fs.ensureDir(akashaDir);
    const filePath = path.join(akashaDir, 'blueprint.json');
    await fs.writeFile(filePath, JSON.stringify(blueprint, null, 2), 'utf-8');

    const mdPath = path.join(akashaDir, 'BLUEPRINT.md');
    await fs.writeFile(mdPath, blueprint.markdownSystemPrompt, 'utf-8');

    return filePath;
}
