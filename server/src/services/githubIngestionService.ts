/**
 * GitHub Repository Ingestion & Autonomous Project Synthesizer
 * 
 * Ingests an existing GitHub repository:
 * 1. Fetches recursive Git tree and reads key source code files.
 * 2. Uses AI to synthesize:
 *    - Domain, Idea, Value Proposition, Target Audience, Tech Stack
 *    - Data Models (Prisma / SQL / Mongoose schema extraction)
 *    - REST API Endpoints (Routes, parameters, payloads)
 *    - UI Pages & Interactive HTML Prototypes
 *    - Business Workflows & Use Cases
 *    - System Architecture & ERD Mermaid Diagrams
 *    - Step-by-Step Future Roadmap
 *    - Code Flaw / Bug Audit with Copy-Ready External AI Agent Prompts
 * 3. Persists full project into MongoDB.
 */

import prisma from '../lib/prisma.js';
import { getLLMProvider } from '../lib/llmProvider.js';
import { safeJsonParse } from '../utils/safeJsonParse.js';
import { generateTailoredPageHtml } from './agentSynthesizer.js';
import { ObjectId } from 'mongodb';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

export interface IngestOptions {
    apiKey?: string;
    model?: string;
    apiBaseUrl?: string;
}

interface GitTreeItem {
    path: string;
    mode: string;
    type: 'blob' | 'tree';
    sha: string;
    size?: number;
    url: string;
}

interface RepoFileContent {
    path: string;
    content: string;
    size: number;
}

/**
 * Fetch GitHub API with optional auth token
 */
async function githubFetch(url: string, token?: string): Promise<any> {
    const fullUrl = url.startsWith('http') ? url : `https://api.github.com${url}`;
    const headers: Record<string, string> = {
        'User-Agent': 'Akasha-Platform-Ingest',
        'Accept': 'application/vnd.github.v3+json',
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(fullUrl, { headers });
    if (!res.ok) {
        let errMsg = `GitHub API error ${res.status}: ${res.statusText}`;
        try {
            const errData = await res.json();
            if (errData.message) errMsg = errData.message;
        } catch {
            // ignore
        }
        throw new Error(errMsg);
    }
    return res.json();
}

/**
 * Fetch raw file content from GitHub
 */
async function fetchRawFile(owner: string, repo: string, branch: string, filePath: string, token?: string): Promise<string> {
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
    const headers: Record<string, string> = {
        'User-Agent': 'Akasha-Platform-Ingest',
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(rawUrl, { headers });
    if (!res.ok) {
        // Fallback to API content
        try {
            const apiRes = await githubFetch(`/repos/${owner}/${repo}/contents/${filePath}?ref=${encodeURIComponent(branch)}`, token);
            if (apiRes.content && apiRes.encoding === 'base64') {
                return Buffer.from(apiRes.content, 'base64').toString('utf-8');
            }
        } catch {
            // failed
        }
        return '';
    }
    return res.text();
}

/**
 * Filter and prioritize key repository files for analysis
 */
function prioritizeFiles(tree: GitTreeItem[]): string[] {
    const blobs = tree.filter(item => item.type === 'blob');
    const selected = new Set<string>();

    // 1. Critical Manifests & Package Files
    const manifests = [
        'package.json', 'pnpm-workspace.yaml', 'requirements.txt', 'go.mod', 
        'Cargo.toml', 'composer.json', 'pom.xml', 'docker-compose.yml', 'Dockerfile'
    ];
    for (const b of blobs) {
        const lower = b.path.toLowerCase();
        if (manifests.some(m => lower === m || lower.endsWith(`/${m}`))) {
            selected.add(b.path);
        }
    }

    // 2. Documentation
    for (const b of blobs) {
        const lower = b.path.toLowerCase();
        if (lower === 'readme.md' || lower === 'readme' || lower === 'architecture.md' || lower === 'contributing.md') {
            selected.add(b.path);
        }
    }

    // 3. Database / Schemas
    for (const b of blobs) {
        const lower = b.path.toLowerCase();
        if (
            lower.includes('schema.prisma') ||
            lower.includes('prisma/schema') ||
            lower.includes('/models/') ||
            lower.includes('/entities/') ||
            lower.includes('/schema/') ||
            (lower.endsWith('.sql') && (lower.includes('migration') || lower.includes('schema') || lower.includes('init')))
        ) {
            selected.add(b.path);
        }
    }

    // 4. Routes / Controllers / APIs
    for (const b of blobs) {
        const lower = b.path.toLowerCase();
        if (
            lower.includes('/routes/') ||
            lower.includes('/controllers/') ||
            lower.includes('/api/') ||
            lower.includes('/endpoints/') ||
            lower.includes('/handlers/') ||
            lower.endsWith('server.ts') ||
            lower.endsWith('server.js') ||
            lower.endsWith('app.ts') ||
            lower.endsWith('app.js') ||
            lower.endsWith('main.py')
        ) {
            selected.add(b.path);
        }
    }

    // 5. Frontend Pages / Views
    for (const b of blobs) {
        const lower = b.path.toLowerCase();
        if (
            (lower.includes('/pages/') || lower.includes('/views/') || lower.includes('/screens/') || lower.includes('/app/')) &&
            (lower.endsWith('.tsx') || lower.endsWith('.jsx') || lower.endsWith('.vue') || lower.endsWith('.svelte') || lower.endsWith('.html'))
        ) {
            selected.add(b.path);
        }
    }

    // Return capped list of most relevant files (limit to 18 to avoid excessive API requests)
    return Array.from(selected).slice(0, 18);
}

/**
 * Self-healing JSON extractor and parser
 */
function safeParseOrRepairJson<T = any>(raw: string, fallback: T): T {
    if (!raw || typeof raw !== 'string') return fallback;
    let text = raw.trim();
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    try {
        return JSON.parse(text);
    } catch {}

    const firstBrace = text.indexOf('{');
    if (firstBrace === -1) return fallback;

    let candidate = text.slice(firstBrace);
    const lastClose = candidate.lastIndexOf('}');
    if (lastClose !== -1) {
        try {
            return JSON.parse(candidate.slice(0, lastClose + 1));
        } catch {}
    }

    return fallback;
}

export async function ingestGitHubRepository(
    owner: string,
    repo: string,
    branch?: string,
    token?: string,
    userId: string = 'standalone-dev',
    orgId?: string,
    options?: IngestOptions
) {
    console.log(`[GitHub Ingest] Beginning ingestion of ${owner}/${repo}...`);

    // 1. Verify repo and resolve default branch
    const repoInfo = await githubFetch(`/repos/${owner}/${repo}`, token);
    const targetBranch = branch || repoInfo.default_branch || 'main';
    const isPrivate = repoInfo.private || false;

    // 2. Fetch recursive git tree
    const treeRes = await githubFetch(`/repos/${owner}/${repo}/git/trees/${encodeURIComponent(targetBranch)}?recursive=1`, token);
    const tree: GitTreeItem[] = treeRes.tree || [];

    console.log(`[GitHub Ingest] Found ${tree.length} items in git tree for ${owner}/${repo} (${targetBranch})`);

    // 3. Select and fetch key files
    const prioritizedPaths = prioritizeFiles(tree);
    const fetchedFiles: RepoFileContent[] = [];

    await Promise.all(
        prioritizedPaths.map(async (filePath) => {
            try {
                const content = await fetchRawFile(owner, repo, targetBranch, filePath, token);
                if (content && content.trim()) {
                    // Truncate individual file if larger than 8000 chars to conserve context
                    const truncated = content.length > 8000 ? content.slice(0, 8000) + '\n// ... [truncated]' : content;
                    fetchedFiles.push({
                        path: filePath,
                        content: truncated,
                        size: content.length
                    });
                }
            } catch (err: any) {
                console.warn(`[GitHub Ingest] Failed to fetch file ${filePath}:`, err.message);
            }
        })
    );

    console.log(`[GitHub Ingest] Fetched ${fetchedFiles.length} key source code files for deep AI analysis.`);

    // 4. Build AI Ingestion Prompt
    const treeSummary = tree
        .slice(0, 100)
        .map(t => `${t.type === 'tree' ? '📁' : '📄'} ${t.path}`)
        .join('\n');

    const fileContentSummaries = fetchedFiles
        .map(f => `--- FILE: ${f.path} ---\n${f.content}\n--- END FILE ---`)
        .join('\n\n');

    const prompt = `You are an elite principal software architect and autonomous code analyst agent.
Analyze the following GitHub repository code and extract an all-encompassing, production-grade project blueprint.

REPOSITORY:
Name: ${owner}/${repo}
Branch: ${targetBranch}
Description: ${repoInfo.description || 'No description provided'}
Language: ${repoInfo.language || 'Unknown'}

REPOSITORY FILE TREE (Sample):
${treeSummary}

SOURCE CODE OF KEY FILES:
${fileContentSummaries}

TASK:
Produce a complete JSON object adhering strictly to the JSON Schema below. No surrounding explanation, no markdown backticks, only pure JSON.

JSON SCHEMA:
{
  "project": {
    "name": "Clean Project Title",
    "description": "Rich 2-3 sentence overview of what the application does, its architecture, and value proposition.",
    "techStack": {
      "frontend": "e.g. React 19, TypeScript, Tailwind CSS",
      "backend": "e.g. Node.js, Express, TypeScript",
      "database": "e.g. MongoDB, Prisma ORM",
      "keyLibraries": ["list", "of", "detected", "libraries"]
    },
    "ideaDetails": {
      "tagline": "Punchy one-liner slogan",
      "problemStatement": "Detailed explanation of the problems this codebase addresses",
      "coreValueProposition": "The central benefits delivered to end users",
      "targetAudience": ["Target audience persona 1", "Target persona 2"],
      "keyFeatures": ["Feature 1 with details", "Feature 2 with details", "Feature 3 with details"]
    }
  },
  "dataModels": [
    {
      "name": "PascalCaseModel",
      "description": "Model purpose based on code",
      "fields": [
        { "name": "id", "field_type": "string", "required": true, "unique": true, "primary_key": true, "description": "Primary key" },
        { "name": "field_name", "field_type": "string|integer|boolean|datetime|json", "required": true, "unique": false, "primary_key": false, "description": "Description" }
      ],
      "relations": [
        { "name": "relatedModel", "target_model": "OtherModel", "relation_type": "one_to_many|many_to_one" }
      ]
    }
  ],
  "apiEndpoints": [
    {
      "method": "GET|POST|PUT|DELETE|PATCH",
      "path": "/api/v1/resource",
      "name": "Endpoint Title",
      "description": "Endpoint behavior inferred from actual route/controller code",
      "request_body": { "type": "object", "properties": { "field": { "type": "string" } } },
      "response_body": { "type": "object|array", "properties": {} },
      "query_params": [{ "name": "param", "type": "string" }],
      "path_params": [{ "name": "id", "type": "string" }]
    }
  ],
  "pages": [
    {
      "name": "Page Name",
      "path": "/route-path",
      "type": "dashboard|list|detail|settings|auth",
      "description": "What this page does and what features it presents"
    }
  ],
  "useCases": [
    {
      "name": "Workflow Name",
      "actor": "End User or Admin",
      "description": "Goal of this business scenario",
      "steps": [
        { "order": 1, "action": "Step 1" },
        { "order": 2, "action": "Step 2" },
        { "order": 3, "action": "Step 3" }
      ]
    }
  ],
  "diagram": {
    "name": "System Architecture & ERD Topology",
    "mermaid": "erDiagram\\n    Entity1 ||--o{ Entity2 : relates"
  },
  "roadmap": [
    {
      "title": "Phase 1: Architectural Hardening & Performance",
      "description": "Next immediate architectural milestone to scale this codebase",
      "priority": "high",
      "assignedTo": "Engineering Team"
    },
    {
      "title": "Phase 2: Feature Expansion & Integrations",
      "description": "Strategic feature expansion based on product trajectory",
      "priority": "medium",
      "assignedTo": "Product Team"
    }
  ],
  "issuesAndImprovements": [
    {
      "title": "Specific Code Fix or Missing Edge Case",
      "description": "Clear explanation of the bug, security vulnerability, missing error handler, or edge case discovered in the code.",
      "priority": "critical|high|medium|low",
      "category": "bug|security|feature|refactor|optimization",
      "affectedFiles": ["exact/path/to/file.ts"],
      "agentPrompt": "### 🤖 Autonomous Agent Task: [Title]\\n**Repository**: [Repo]\\n**Target Files**: \`[File]\`\\n\\n**Problem**:\\n[Explanation]\\n\\n**Required Fix**:\\n1. [Step 1]\\n2. [Step 2]\\n\\n**Verification & Commit**:\\n- Verify fix with tests.\\n- Commit with message: \`fix: [Title] (Task: #task-id)\`"
    }
  ]
}

Ensure all extracted entities, routes, and issues are based on the ACTUAL source files provided. Detect 3 to 6 real potential code improvements or edge case fixes to create actionable AI agent prompts.`;

    let synthesizedData: any = null;

    try {
        const llm = getLLMProvider();
        const responseText = await llm.chat({
            model: options?.model,
            apiKey: options?.apiKey,
            apiBaseUrl: options?.apiBaseUrl,
            temperature: 0.2,
            max_tokens: 4000,
            messages: [{ role: 'user', content: prompt }]
        });

        synthesizedData = safeParseOrRepairJson(responseText, null);
    } catch (llmErr: any) {
        console.warn('[GitHub Ingest] LLM synthesis failed or timed out:', llmErr.message);
    }

    // Heuristic fallback if LLM synthesis returned empty
    if (!synthesizedData || !synthesizedData.project) {
        console.log('[GitHub Ingest] Applying intelligent heuristic synthesis fallback...');
        synthesizedData = buildHeuristicIngestPlan(owner, repo, repoInfo, fetchedFiles, tree);
    }

    // 5. Create Project Record in Database
    const projectIdStr = new ObjectId().toHexString();

    const teamTasks = buildInitialTeamTasks(synthesizedData, `${owner}/${repo}`);

    const projectData = {
        id: projectIdStr,
        userId,
        orgId: orgId || null,
        name: synthesizedData.project?.name || repo,
        description: synthesizedData.project?.description || repoInfo.description || `Ingested from GitHub: ${owner}/${repo}`,
        status: 'active',
        checkpoint: 3,
        rootPath: path.join(process.cwd(), 'projects', projectIdStr),
        settings: JSON.stringify({
            theme: { primary_color: '#3b82f6' },
            github_repo: {
                owner,
                name: repo,
                full_name: `${owner}/${repo}`,
                default_branch: targetBranch,
                is_private: isPrivate,
            },
            ideaDetails: synthesizedData.project?.ideaDetails || {},
            techStack: synthesizedData.project?.techStack || {},
            teamTasks: teamTasks,
        }),
        pipelineData: JSON.stringify({
            ingestedFrom: `${owner}/${repo}`,
            branch: targetBranch,
            ingestedAt: new Date().toISOString()
        })
    };

    const project = await prisma.project.create({ data: projectData });

    // 6. Populate Data Models
    const createdModels: any[] = [];
    if (Array.isArray(synthesizedData.dataModels)) {
        for (const dm of synthesizedData.dataModels) {
            try {
                const schema = {
                    fields: dm.fields || [],
                    relations: dm.relations || []
                };
                const created = await prisma.dataModel.create({
                    data: {
                        projectId: project.id,
                        name: dm.name,
                        schema: JSON.stringify(schema)
                    }
                });
                createdModels.push(created);
            } catch (err) {
                console.warn(`[GitHub Ingest] Failed to save dataModel ${dm.name}:`, err);
            }
        }
    }

    // 7. Populate API Endpoints
    const createdApis: any[] = [];
    if (Array.isArray(synthesizedData.apiEndpoints)) {
        for (const ep of synthesizedData.apiEndpoints) {
            try {
                const config = {
                    description: ep.description || `${ep.name} endpoint`,
                    request_body: ep.request_body || null,
                    response_body: ep.response_body || { type: 'object' },
                    query_params: ep.query_params || [],
                    path_params: ep.path_params || []
                };
                const created = await prisma.apiEndpoint.create({
                    data: {
                        projectId: project.id,
                        method: ep.method || 'GET',
                        path: ep.path || '/api/v1/resource',
                        name: ep.name || `${ep.method} ${ep.path}`,
                        config: JSON.stringify(config)
                    }
                });
                createdApis.push(created);
            } catch (err) {
                console.warn(`[GitHub Ingest] Failed to save apiEndpoint ${ep.name}:`, err);
            }
        }
    }

    // 8. Populate UI Pages & Interactive Prototypes
    const createdPages: any[] = [];
    const sandboxPages: any[] = [];
    const rawPages = Array.isArray(synthesizedData.pages) && synthesizedData.pages.length > 0 
        ? synthesizedData.pages 
        : [
            { name: 'Dashboard', path: '/', type: 'dashboard', description: 'Central operational control console' },
            { name: 'Explorer', path: '/explore', type: 'list', description: 'Data browsing and search directory' }
        ];

    for (const p of rawPages) {
        try {
            const pageId = randomUUID();
            const pageHtml = generateTailoredPageHtml(
                p.name, 
                p.type || 'dashboard', 
                p.description || '', 
                'Primary: #3b82f6, Font: Inter', 
                project.name
            );

            const page = await prisma.page.create({
                data: {
                    id: pageId,
                    projectId: project.id,
                    name: p.name,
                    path: p.path || `/${p.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
                    isDynamic: Boolean(p.path?.includes(':')),
                    meta: JSON.stringify({ type: p.type, description: p.description })
                }
            });

            sandboxPages.push({
                name: p.name,
                path: p.path,
                type: p.type || 'dashboard',
                description: p.description,
                _html: pageHtml,
                _accepted: true
            });

            createdPages.push(page);
        } catch (err) {
            console.warn(`[GitHub Ingest] Failed to save page ${p.name}:`, err);
        }
    }

    // Save sandbox pages to project
    await prisma.project.update({
        where: { id: project.id },
        data: {
            sandbox: {
                theme: { primaryColor: '#3b82f6', font: 'Inter', radius: 12 },
                idea: project.description,
                pages: sandboxPages
            }
        }
    });

    // 9. Populate Use Cases
    if (Array.isArray(synthesizedData.useCases)) {
        for (const uc of synthesizedData.useCases) {
            try {
                await prisma.useCase.create({
                    data: {
                        projectId: project.id,
                        name: uc.name,
                        description: uc.description || `Workflow for ${uc.actor || 'User'}`,
                        actors: JSON.stringify([uc.actor || 'User']),
                        preconditions: 'System initialized and authorized',
                        postconditions: 'State successfully updated',
                        steps: JSON.stringify(uc.steps || []),
                        priority: 'high',
                        status: 'approved',
                        category: 'Core Logic'
                    }
                });
            } catch (err) {
                console.warn(`[GitHub Ingest] Failed to save useCase ${uc.name}:`, err);
            }
        }
    }

    // 10. Populate Diagram
    try {
        let mermaid = synthesizedData.diagram?.mermaid;
        if (!mermaid || !mermaid.includes('erDiagram')) {
            const erdLines = ['erDiagram'];
            for (const m of createdModels) {
                const schema = safeJsonParse<any>(m.schema, { fields: [] });
                erdLines.push(`    ${m.name} {`);
                for (const f of schema.fields || []) {
                    erdLines.push(`        ${f.field_type} ${f.name}`);
                }
                erdLines.push('    }');
            }
            mermaid = erdLines.join('\n');
        }

        await prisma.diagram.create({
            data: {
                projectId: project.id,
                name: synthesizedData.diagram?.name || 'System Architecture & ERD',
                type: 'mermaid',
                content: mermaid
            }
        });
    } catch (err) {
        console.warn('[GitHub Ingest] Failed to save diagram:', err);
    }

    console.log(`[GitHub Ingest] Successfully ingested ${owner}/${repo} as Project ID: ${project.id}`);

    // Return the full project with synthesized statistics
    const finalProject = await prisma.project.findUnique({ where: { id: project.id } });
    return {
        project: finalProject,
        stats: {
            modelsCount: createdModels.length,
            apisCount: createdApis.length,
            pagesCount: createdPages.length,
            tasksCount: teamTasks.length,
            filesAnalyzed: fetchedFiles.length,
            treeItemsCount: tree.length
        }
    };
}

/**
 * Builds initial team tasks: combining future roadmap and detected issue/flaw audit tasks with agent prompts
 */
function buildInitialTeamTasks(data: any, repoSlug: string): any[] {
    const tasks: any[] = [];
    const now = new Date().toISOString();

    // 1. Detected Code Flaws / Bug Improvements (with External AI Agent Prompts)
    const issues = Array.isArray(data.issuesAndImprovements) ? data.issuesAndImprovements : [];
    issues.forEach((issue: any, index: number) => {
        const taskId = `task-fix-${index + 1}-${randomUUID().slice(0, 6)}`;
        const affectedFiles = Array.isArray(issue.affectedFiles) ? issue.affectedFiles : [];
        const filesFormatted = affectedFiles.map((f: string) => `\`${f}\``).join(', ') || 'Repository codebase';

        const agentPrompt = issue.agentPrompt || `### 🤖 Autonomous Agent Task: ${issue.title}
**Repository**: \`${repoSlug}\`
**Target Files**: ${filesFormatted}
**Priority**: ${issue.priority?.toUpperCase() || 'HIGH'}

#### 🎯 Problem Statement:
${issue.description || 'Resolve code quality or functional gap identified in repository.'}

#### 📋 Required Implementation Steps:
1. Open and review ${filesFormatted}.
2. Implement the required fix ensuring complete backward compatibility and robust error handling.
3. Validate changes with unit or integration tests.

#### 🚀 Verification & Commit Convention:
Commit your changes with the following message format:
\`${issue.category === 'bug' ? 'fix' : 'feat'}: ${issue.title} (#${taskId})\``;

        tasks.push({
            id: taskId,
            title: issue.title || `Resolve Code Issue #${index + 1}`,
            description: issue.description || 'Identified code gap or architectural flaw.',
            assignedTo: 'External AI Agent',
            status: 'todo',
            priority: issue.priority || 'high',
            category: issue.category || 'bug',
            affectedFiles: affectedFiles,
            agentPrompt: agentPrompt,
            labels: [issue.category || 'bug', 'ai-agent-ready'],
            storyPoints: issue.priority === 'critical' ? 5 : issue.priority === 'high' ? 3 : 2,
            createdAt: now
        });
    });

    // 2. Future Roadmap Phased Milestones
    const roadmap = Array.isArray(data.roadmap) ? data.roadmap : [];
    roadmap.forEach((phase: any, index: number) => {
        const taskId = `task-plan-${index + 1}-${randomUUID().slice(0, 6)}`;
        tasks.push({
            id: taskId,
            title: phase.title || `Phase ${index + 1}: Expansion`,
            description: phase.description || 'Strategic development milestone.',
            assignedTo: phase.assignedTo || 'Engineering Team',
            status: 'todo',
            priority: phase.priority || 'medium',
            category: 'roadmap',
            labels: ['roadmap', 'milestone'],
            storyPoints: 5,
            createdAt: now
        });
    });

    return tasks;
}

/**
 * Fallback heuristic plan if LLM is unavailable
 */
function buildHeuristicIngestPlan(owner: string, repo: string, repoInfo: any, files: RepoFileContent[], tree: GitTreeItem[]): any {
    const title = repo.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    
    // Check package.json for dependencies
    const pkgFile = files.find(f => f.path.endsWith('package.json'));
    let deps: string[] = [];
    if (pkgFile) {
        try {
            const parsed = JSON.parse(pkgFile.content);
            deps = Object.keys({ ...parsed.dependencies, ...parsed.devDependencies }).slice(0, 10);
        } catch {}
    }

    return {
        project: {
            name: title,
            description: repoInfo.description || `${title} is a modular application built with modern architecture. Ingested from ${owner}/${repo}.`,
            techStack: {
                frontend: deps.some(d => d.includes('react')) ? 'React' : deps.some(d => d.includes('vue')) ? 'Vue' : 'Modern Web',
                backend: deps.some(d => d.includes('express')) ? 'Express / Node.js' : 'Node.js',
                database: 'Prisma / SQL',
                keyLibraries: deps
            },
            ideaDetails: {
                tagline: `Next-generation ${title} solution`,
                problemStatement: `Streamlines workflows and provides automated services for ${title} stakeholders.`,
                coreValueProposition: `Unified developer experience, robust architecture, and rapid deployment.`,
                targetAudience: ['Developers', 'Product Owners', 'Enterprise Teams'],
                keyFeatures: ['Automated Workflow Management', 'Integrated REST APIs', 'Extensible Component Architecture']
            }
        },
        dataModels: [
            {
                name: 'User',
                description: 'Core platform user authentication and identity record',
                fields: [
                    { name: 'id', field_type: 'string', required: true, unique: true, primary_key: true, description: 'Unique identifier' },
                    { name: 'email', field_type: 'string', required: true, unique: true, primary_key: false, description: 'User email' },
                    { name: 'name', field_type: 'string', required: false, unique: false, primary_key: false, description: 'Display name' },
                    { name: 'role', field_type: 'string', required: true, unique: false, primary_key: false, description: 'Role permission' }
                ],
                relations: []
            },
            {
                name: 'ItemRecord',
                description: 'Primary entity managed by the application',
                fields: [
                    { name: 'id', field_type: 'string', required: true, unique: true, primary_key: true, description: 'Unique identifier' },
                    { name: 'title', field_type: 'string', required: true, unique: false, primary_key: false, description: 'Record title' },
                    { name: 'status', field_type: 'string', required: true, unique: false, primary_key: false, description: 'Lifecycle status' },
                    { name: 'metadata', field_type: 'json', required: false, unique: false, primary_key: false, description: 'Extensible attributes' }
                ],
                relations: []
            }
        ],
        apiEndpoints: [
            {
                method: 'GET',
                path: '/api/v1/health',
                name: 'Health Check',
                description: 'Service telemetry and uptime verification',
                request_body: null,
                response_body: { type: 'object', properties: { status: { type: 'string' } } },
                query_params: [],
                path_params: []
            },
            {
                method: 'GET',
                path: '/api/v1/records',
                name: 'List Records',
                description: 'Retrieve paginated records',
                request_body: null,
                response_body: { type: 'array' },
                query_params: [{ name: 'page', type: 'integer' }, { name: 'limit', type: 'integer' }],
                path_params: []
            },
            {
                method: 'POST',
                path: '/api/v1/records',
                name: 'Create Record',
                description: 'Persist a new entity record',
                request_body: { type: 'object', properties: { title: { type: 'string' } } },
                response_body: { type: 'object' },
                query_params: [],
                path_params: []
            }
        ],
        pages: [
            { name: 'Dashboard', path: '/', type: 'dashboard', description: 'Central executive metrics and recent activity' },
            { name: 'Records', path: '/records', type: 'list', description: 'Catalog of managed domain entities' },
            { name: 'Settings', path: '/settings', type: 'settings', description: 'Application configuration and environment variables' }
        ],
        useCases: [
            {
                name: 'Manage Domain Entities',
                actor: 'Developer',
                description: 'Create, update, and inspect live project data',
                steps: [
                    { order: 1, action: 'Access management dashboard' },
                    { order: 2, action: 'Submit entity modification request' },
                    { order: 3, action: 'System validates parameters and commits to database' }
                ]
            }
        ],
        roadmap: [
            {
                title: 'Phase 1: Architecture Hardening & Test Coverage',
                description: 'Implement end-to-end integration tests and establish CI/CD quality gates.',
                priority: 'high',
                assignedTo: 'DevOps & QA'
            },
            {
                title: 'Phase 2: Real-time Telemetry & Performance Optimization',
                description: 'Implement distributed tracing and caching layer.',
                priority: 'medium',
                assignedTo: 'Core Platform Team'
            }
        ],
        issuesAndImprovements: [
            {
                title: 'Add Input Validation & Schema Sanitization on API Inputs',
                description: 'API endpoints lack centralized schema validation (e.g. Zod or Joi), exposing routes to malformed inputs.',
                priority: 'high',
                category: 'security',
                affectedFiles: files.filter(f => f.path.includes('route') || f.path.includes('server')).map(f => f.path).slice(0, 2),
                agentPrompt: `### 🤖 Autonomous Agent Task: Add Input Validation & Schema Sanitization
**Repository**: \`${owner}/${repo}\`
**Priority**: HIGH
**Problem**:
API endpoints accept raw request bodies without comprehensive schema validation.

**Required Fix**:
1. Introduce request body validation schema (e.g. using Zod).
2. Return a standardized 400 Bad Request error payload with field-level issues if validation fails.
3. Add a test suite covering invalid inputs.

**Commit**: \`fix: add input validation schema and sanitization\``
            },
            {
                title: 'Implement Global Error Boundary & Centralized Exception Handler',
                description: 'Missing top-level async error boundary can cause unhandled promise rejections.',
                priority: 'medium',
                category: 'bug',
                affectedFiles: files.slice(0, 2).map(f => f.path),
                agentPrompt: `### 🤖 Autonomous Agent Task: Implement Global Error Boundary
**Repository**: \`${owner}/${repo}\`
**Priority**: MEDIUM
**Problem**:
Async handlers lack unified error capture middleware.

**Required Fix**:
1. Implement a centralized error-handling middleware.
2. Ensure consistent error logging and sanitized JSON response codes.

**Commit**: \`fix: add global error boundary and exception handler\``
            }
        ]
    };
}
