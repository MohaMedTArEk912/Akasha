import type { Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { getLLMProvider, aiConfigStorage } from '../lib/llmProvider.js';

interface StructuredChatResponse {
    answer_markdown: string;
    summary: string;
    highlights: string[];
    next_actions: string[];
    warnings: string[];
}

type FeaturePriority = 'critical' | 'high' | 'medium' | 'low';
type FeatureStatus = 'pending' | 'approved' | 'rejected';

interface IdeaUnderstanding {
    core_problem: string;
    intended_solution: string;
    target_users: string[];
    explicit_requirements: string[];
    inferred_requirements: string[];
    constraints: string[];
    assumptions: string[];
    context_notes: string[];
}

interface FeatureQueueItem {
    id: string;
    title: string;
    description: string;
    rationale: string;
    priority: FeaturePriority;
    rating: number;
    status: FeatureStatus;
    user_comment: string;
    integrated_summary: string;
    clarifying_questions?: string[];
}

const STRUCTURED_CHAT_SYSTEM_PROMPT = `You are Akasha AI.
Return ONLY valid JSON and nothing else.
Output schema (all keys are required):
{
  "answer_markdown": "string",
  "summary": "string",
  "highlights": ["string"],
  "next_actions": ["string"],
  "warnings": ["string"]
}
Rules:
- No markdown code fences.
- Keep summary concise (<= 30 words).
- Keep arrays concise (max 5 items each).
- answer_markdown should directly answer the user and can use markdown formatting.
`;

function normalizeStringArray(value: unknown, maxItems = 5): string[] {
    if (!Array.isArray(value)) return [];
    return value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, maxItems);
}

function extractJsonObject(raw: string): string {
    let text = raw.trim();
    
    const startObj = text.indexOf('{');
    const startArr = text.indexOf('[');
    
    let start = -1;
    let end = -1;
    
    if (startObj !== -1 && (startArr === -1 || startObj < startArr)) {
        start = startObj;
        end = text.lastIndexOf('}');
    } else if (startArr !== -1) {
        start = startArr;
        end = text.lastIndexOf(']');
    }
    
    if (start === -1 || end === -1 || end <= start) {
        throw new Error('No JSON object found in model output');
    }
    
    return text.slice(start, end + 1);
}

function parseAllJsonObjects(text: string): any[] {
    const objects: any[] = [];
    let braceCount = 0;
    let startIdx = -1;
    let inString = false;
    let escape = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];

        if (escape) {
            escape = false;
            continue;
        }

        if (char === '\\') {
            escape = true;
            continue;
        }

        if (char === '"') {
            inString = !inString;
            continue;
        }

        if (!inString) {
            if (char === '{') {
                if (braceCount === 0) {
                    startIdx = i;
                }
                braceCount++;
            } else if (char === '}') {
                braceCount--;
                if (braceCount === 0 && startIdx !== -1) {
                    const candidate = text.slice(startIdx, i + 1);
                    try {
                        const parsed = JSON.parse(candidate);
                        objects.push(parsed);
                    } catch (e) {
                        try {
                            const cleaned = candidate
                                .replace(/,\s*([}\]])/g, '$1')
                                .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?\s*:/g, '"$2":');
                            objects.push(JSON.parse(cleaned));
                        } catch (e2) {
                            // Ignore malformed sub-blocks
                        }
                    }
                    startIdx = -1;
                }
            }
        }
    }
    return objects;
}

/**
 * Attempts to repair and parse JSON from AI model output.
 * If standard JSON.parse fails, it:
 * 1. Performs basic regex cleanup (trailing commas)
 * 2. Parses and merges multiple JSON objects if the model split its output
 * 3. Uses a secondary LLM pass (temperature 0) to fix the syntax.
 */
async function safeParseJson(
    raw: string,
    options?: { model?: string; apiKey?: string; apiBaseUrl?: string }
): Promise<any> {
    let jsonText = '';
    try {
        jsonText = extractJsonObject(raw);
        // 1. Try direct parse
        try {
            return JSON.parse(jsonText);
        } catch (err) {
            // 2. Basic cleanup for common small mistakes (like trailing commas)
            const cleaned = jsonText
                .replace(/,\s*([}\]])/g, '$1') // Remove trailing commas
                .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?\s*:/g, '"$2":'); // Fix missing quotes on keys (basic)
            return JSON.parse(cleaned);
        }
    } catch (extractOrParseErr) {
        // 3. Fallback: Try parsing and merging multiple JSON objects if split output occurred
        try {
            const parsedObjects = parseAllJsonObjects(raw);
            if (parsedObjects.length > 0) {
                return parsedObjects.reduce((acc, obj) => ({ ...acc, ...obj }), {});
            }
        } catch (mergeErr) {
            console.warn('[AI] Local multi-object JSON parse and merge failed:', mergeErr);
        }

        // 4. Last resort: LLM Repair
        const llmProvider = getLLMProvider();
        try {
            const repaired = await llmProvider.chat({
                model: options?.model,
                temperature: 0,
                max_tokens: 3000,
                apiKey: options?.apiKey,
                apiBaseUrl: options?.apiBaseUrl,
                messages: [
                    {
                        role: 'system',
                        content: 'You repair malformed JSON. Return ONLY valid JSON with the same keys and values. Do not add markdown fences or commentary.'
                    },
                    {
                        role: 'user',
                        content: jsonText || raw
                    }
                ]
            });
            return JSON.parse(extractJsonObject(repaired));
        } catch (repairErr) {
            console.error('[AI] JSON Repair failed:', repairErr);
            throw new Error('AI output was malformed and repair failed.');
        }
    }
}

function buildSummaryFromAnswer(answer: string): string {
    const compact = answer.replace(/\s+/g, ' ').trim();
    if (!compact) return '';
    const firstSentence = compact.split(/[.!?]/)[0]?.trim() || compact;
    return firstSentence.slice(0, 160);
}

function slugifyValue(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function normalizeFeaturePriority(value: unknown): FeaturePriority {
    if (typeof value !== 'string') return 'medium';
    const normalized = value.trim().toLowerCase();
    if (normalized === 'critical' || normalized === 'high' || normalized === 'medium' || normalized === 'low') {
        return normalized;
    }
    return 'medium';
}

function normalizeFeatureStatus(value: unknown): FeatureStatus {
    if (typeof value !== 'string') return 'pending';
    const normalized = value.trim().toLowerCase();
    if (normalized === 'approved' || normalized === 'rejected' || normalized === 'pending') {
        return normalized;
    }
    return 'pending';
}

function normalizeIdeaUnderstanding(value: unknown): IdeaUnderstanding {
    const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
    return {
        core_problem: typeof source.core_problem === 'string' ? source.core_problem.trim() : '',
        intended_solution: typeof source.intended_solution === 'string' ? source.intended_solution.trim() : '',
        target_users: normalizeStringArray(source.target_users ?? source.targetUsers, 10),
        explicit_requirements: normalizeStringArray(source.explicit_requirements ?? source.explicitRequirements, 14),
        inferred_requirements: normalizeStringArray(source.inferred_requirements ?? source.inferredRequirements, 14),
        constraints: normalizeStringArray(source.constraints, 12),
        assumptions: normalizeStringArray(source.assumptions, 12),
        context_notes: normalizeStringArray(source.context_notes ?? source.contextNotes, 12),
    };
}

function normalizeFeatureQueue(value: unknown, fallbackItems: string[] = []): FeatureQueueItem[] {
    const parsedItems = Array.isArray(value)
        ? value
            .map((item, index): FeatureQueueItem | null => {
                const source = item && typeof item === 'object' ? (item as Record<string, unknown>) : null;
                if (!source) return null;
                const title = typeof source.title === 'string' ? source.title.trim() : '';
                if (!title) return null;
                return {
                    id: typeof source.id === 'string' && source.id.trim()
                        ? source.id.trim()
                        : `feature-${index + 1}-${slugifyValue(title) || 'item'}`,
                    title,
                    description: typeof source.description === 'string' ? source.description.trim() : '',
                    rationale: typeof source.rationale === 'string' ? source.rationale.trim() : '',
                    priority: normalizeFeaturePriority(source.priority),
                    rating: normalizeRating(source.rating, 3),
                    status: normalizeFeatureStatus(source.status),
                    user_comment: typeof source.user_comment === 'string'
                        ? source.user_comment.trim()
                        : typeof source.userComment === 'string'
                            ? source.userComment.trim()
                            : '',
                    integrated_summary: typeof source.integrated_summary === 'string'
                        ? source.integrated_summary.trim()
                        : typeof source.integratedSummary === 'string'
                            ? source.integratedSummary.trim()
                            : '',
                    clarifying_questions: Array.isArray(source.clarifying_questions)
                        ? normalizeStringArray(source.clarifying_questions, 4)
                        : Array.isArray(source.clarifyingQuestions)
                            ? normalizeStringArray(source.clarifyingQuestions, 4)
                            : [],
                } satisfies FeatureQueueItem;
            })
            .filter((item): item is FeatureQueueItem => !!item)
        : [];

    if (parsedItems.length > 0) {
        return parsedItems.slice(0, 10);
    }

    return fallbackItems
        .filter((item) => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 6)
        .map((title, index) => ({
            id: `feature-${index + 1}-${slugifyValue(title) || 'item'}`,
            title,
            description: '',
            rationale: '',
            priority: index < 2 ? 'high' : 'medium',
            rating: index === 0 ? 4 : 3,
            status: 'pending',
            user_comment: '',
            integrated_summary: '',
        }));
}

function normalizeStructuredChat(parsed: unknown, fallbackAnswer: string): StructuredChatResponse {
    const source = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};

    const answerFromSource =
        typeof source.answer_markdown === 'string' ? source.answer_markdown.trim() :
            typeof source.answer === 'string' ? source.answer.trim() :
                '';

    const answer_markdown = answerFromSource || fallbackAnswer.trim() || 'No answer generated.';
    const summary = typeof source.summary === 'string' && source.summary.trim()
        ? source.summary.trim().slice(0, 200)
        : buildSummaryFromAnswer(answer_markdown);

    return {
        answer_markdown,
        summary,
        highlights: normalizeStringArray(source.highlights),
        next_actions: normalizeStringArray(source.next_actions ?? source.nextSteps),
        warnings: normalizeStringArray(source.warnings ?? source.risks),
    };
}

function generateLocalFallbackResponse(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    errorMsg: string
): StructuredChatResponse {
    // Find system message to extract context
    const systemMsg = messages.find(m => m.role === 'system')?.content || '';
    const userMsg = messages[messages.length - 1]?.content || '';

    // Extract project name
    const nameMatch = systemMsg.match(/PROJECT NAME:\s*([^\n]+)/i);
    const projectName = nameMatch ? (nameMatch && nameMatch[1] ? nameMatch[1] : '').trim() : 'Active Project';

    const query = userMsg.toLowerCase();
    let answer = '';
    let highlights: string[] = [];
    let nextActions: string[] = [];

    const warningText = `Google Gemini API key in .env is invalid or restricted (AQ. format). Showing local simulated response.`;

    if (query.includes('database') || query.includes('schema') || query.includes('model') || query.includes('erd') || query.includes('table') || query.includes('sql')) {
        answer = `### 📊 Database Design Assistant (Local Fallback)
I analyzed your request for the database structure of **${projectName}**.

Here is a recommended database schema to support your requirements:

1. **User Profile & Authentication**:
   - \`User\`: id, email, passwordHash, username, displayName, avatarUrl, role, createdAt.
   - \`Session\`: id, userId, token, expiresAt, deviceDetails.

2. **Core Features**:
   - \`Project\`: id, name, description, ownerId, status, settings (JSON), createdAt.
   - \`BlockDefinition\`: id, type, label, categoryId, properties (JSON).

3. **Relations**:
   - A **User** has many **Projects** (One-to-Many).
   - An **Organization** has many **Members** and **Projects** (Many-to-Many).

To implement this, go to the **Database tab**, click **Add Data Model**, and define your fields. You can also generate the Prisma schema files and run migrations directly from the IDE.`;
        highlights = ['Data Models proposed', 'Prisma Schema ready'];
        nextActions = ['Create User Model', 'Create Project Model', 'Define Foreign Key Relationships'];
    } else if (query.includes('api') || query.includes('endpoint') || query.includes('route') || query.includes('http') || query.includes('controller')) {
        answer = `### 🔗 API Router Assistant (Local Fallback)
I analyzed your project's API design for **${projectName}**.

Here are the recommended API endpoints for your core modules:

- **Authentication**:
  - \`POST /api/auth/register\` — Register a new account.
  - \`POST /api/auth/login\` — Login and receive a JWT.

- **Projects & Storage**:
  - \`GET /api/projects\` — Retrieve all projects.
  - \`POST /api/projects\` — Create a new project.
  - \`GET /api/projects/:id/files\` — Retrieve files for a specific project.

- **Real-Time & Integration**:
  - \`GET /api/github/status\` — Check GitHub connection status.

You can configure and test these routes in the **API Endpoints** tab, and then export the Express route controllers automatically.`;
        highlights = ['RESTful API structure mapped', 'JWT Auth endpoints included'];
        nextActions = ['Create Auth endpoints', 'Define Projects CRUD routes', 'Test using the API Proxy'];
    } else if (query.includes('ui') || query.includes('page') || query.includes('layout') || query.includes('component') || query.includes('design') || query.includes('css')) {
        answer = `### 🎨 UI Builder Assistant (Local Fallback)
I analyzed your interface structure for **${projectName}**.

For a polished and modern aesthetic, I recommend structuring your layout as follows:

1. **Global Shell Layout**:
   - A left-aligned collapsible navigation sidebar (icons + labels, dark glassmorphism styling).
   - A top main header with breadcrumbs, project search bar, and user profile avatar.
   - A central workspace area with card-based grid layouts, responsive padding, and subtle box-shadows.

2. **Interactive Elements**:
   - Add hover states (\`transition: all 0.2s ease\`) on buttons.
   - Use curated modern typography (e.g. Google Fonts Inter or Outfit).

To build this layout, open the **UI Builder** tab, select a template or drag layout container blocks, and apply custom styling properties in the editor panel.`;
        highlights = ['Responsive design guidelines', 'Inter/Outfit typography recommendations'];
        nextActions = ['Open UI Builder', 'Add sidebar navigation block', 'Configure page theme styling'];
    } else if (query.includes('logic') || query.includes('flow') || query.includes('workflow') || query.includes('usecase')) {
        answer = `### ⚙️ Logic Flow & Use Cases (Local Fallback)
I mapped out the logic workflow for **${projectName}**.

Here is the recommended step-by-step logic execution for your project's core controller:

1. **Validation & Auth**: Validate request body using Zod/Joi schemas, check headers for a valid Bearer JWT.
2. **Database Execution**: Execute Prisma/Mongoose query to fetch or update records.
3. **External Integrations**: Call third-party APIs (e.g. GitHub/Google) or dispatch socket notifications if needed.
4. **Structured Response**: Return standard JSON payload or trigger global error handler in case of failure.

Map these paths out visually in the **Logic Flows** tab or document them as **Use Cases** to generate backend logic automatically.`;
        highlights = ['Workflow sequence defined', 'Validation & Error paths included'];
        nextActions = ['Create a Logic Flow', 'Add validation step block', 'Define error handling paths'];
    } else {
        answer = `### 🔮 Akasha AI Assistant (Local Fallback)
Hello! I am your Akasha development assistant. 

I am currently running in **Local Fallback Mode** because the Google Gemini API key configured in \`backend/.env\` is restricted or invalid. However, I can still help you build **${projectName}**!

Here is what you can do next:
- **Feasibility & Architecture**: Ask me about database design, REST APIs, UI design systems, or logic flows.
- **Visual Mapping**: Use the tabs on the left to plan your database models, draw system diagrams, configure API endpoints, and design UI pages.
- **Git Sync**: Sync your codebase directly to GitHub once you connect your account.

Describe what part of **${projectName}** you are working on, and I will guide you step-by-step.`;
        highlights = ['Local fallback active', 'IDE context fully loaded'];
        nextActions = ['Ask about Database design', 'Ask about REST API routes', 'Navigate to UI Builder'];
    }

    return {
        answer_markdown: answer,
        summary: `Local assistant fallback active for ${projectName}.`,
        highlights,
        next_actions: nextActions,
        warnings: [warningText]
    };
}

async function getStructuredChatResponse(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options?: { model?: string; temperature?: number; max_tokens?: number; apiKey?: string; apiBaseUrl?: string }
): Promise<StructuredChatResponse> {
    try {
        const llmProvider = getLLMProvider();
        const modelOutput = await llmProvider.chat({
            model: options?.model,
            temperature: options?.temperature ?? 0.3,
            max_tokens: options?.max_tokens,
            apiKey: options?.apiKey,
            apiBaseUrl: options?.apiBaseUrl,
            messages: [
                { role: 'system', content: STRUCTURED_CHAT_SYSTEM_PROMPT },
                ...messages
            ]
        });

        try {
            const jsonText = extractJsonObject(modelOutput);
            const parsed = JSON.parse(jsonText);
            return normalizeStructuredChat(parsed, modelOutput);
        } catch {
            return normalizeStructuredChat({}, modelOutput);
        }
    } catch (err: any) {
        console.warn('[LLM Provider] Chat failed, falling back to local response generator. Error:', err.message);
        return generateLocalFallbackResponse(messages, err.message);
    }
}


// --- Team Management ---

export async function register(req: Request, res: Response) {
    const { username, sessionId } = req.body;
    if (!username || !sessionId) return res.status(400).json({ error: 'Missing credentials' });
    res.json({ success: true, username });
}

export async function createTeam(req: Request, res: Response) {
    const { sessionId, teamName, username } = req.body;
    if (!sessionId || !teamName) return res.status(400).json({ error: 'Missing data' });
    try {
        const team = await prisma.team.create({
            data: { name: teamName, adminSessionId: sessionId, members: { create: { sessionId, username: username || 'Admin', role: 'admin' } } }
        });
        res.json({ success: true, team: team.name });
    } catch (err: any) {
        if (err.code === 'P2002') return res.status(400).json({ error: 'Team already exists' });
        res.status(500).json({ error: err.message });
    }
}

export async function requestJoin(req: Request, res: Response) {
    const { sessionId, teamName, username } = req.body;
    if (!sessionId || !teamName) return res.status(400).json({ error: 'Missing data' });
    try {
        const team = await prisma.team.findUnique({ where: { name: teamName } });
        if (!team) return res.status(404).json({ error: 'Team not found' });
        const existingMember = await prisma.teamMember.findUnique({ where: { teamId_sessionId: { teamId: team.id, sessionId } } });
        if (existingMember) return res.json({ success: true, status: existingMember.role });
        await prisma.joinRequest.upsert({
            where: { teamId_sessionId: { teamId: team.id, sessionId } },
            update: { status: 'pending', username: username || 'User' },
            create: { teamId: team.id, sessionId, username: username || 'User', status: 'pending' }
        });
        res.json({ success: true, status: 'pending' });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
}

export async function searchTeams(req: Request, res: Response) {
    const { query } = req.query;
    if (typeof query !== 'string') return res.status(400).json({ error: 'Invalid query' });
    try {
        const teams = await prisma.team.findMany({ where: { name: { contains: query } }, include: { members: true }, take: 10 });
        res.json(teams);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
}

export async function listTeams(req: Request, res: Response) {
    try {
        const teams = await prisma.team.findMany({ take: 20, include: { members: true }, orderBy: { createdAt: 'desc' } });
        res.json(teams);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
}

export async function getAdminData(req: Request, res: Response) {
    const { sessionId } = req.query;
    if (!sessionId || typeof sessionId !== 'string') return res.status(400).json({ error: 'Missing sessionId' });
    try {
        const team = await prisma.team.findFirst({ where: { adminSessionId: sessionId }, include: { members: true, joinRequests: { where: { status: 'pending' } } } });
        if (!team) return res.status(403).json({ error: 'Not an admin' });
        res.json({ pendingRequests: team.joinRequests, members: team.members.map((m: any) => ({ ...m, isAdmin: m.role === 'admin' })) });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
}

export async function resolveRequest(req: Request, res: Response) {
    const { adminSessionId, userSessionId, action } = req.body;
    if (!adminSessionId || !userSessionId || !action) return res.status(400).json({ error: 'Missing data' });
    try {
        const team = await prisma.team.findFirst({ where: { adminSessionId } });
        if (!team) return res.status(403).json({ error: 'Not authorized' });
        if (action === 'approve') {
            const request = await prisma.joinRequest.findUnique({ where: { teamId_sessionId: { teamId: team.id, sessionId: userSessionId } } });
            if (request) {
                await prisma.teamMember.create({ data: { teamId: team.id, sessionId: userSessionId, username: request.username, role: 'member' } });
                await prisma.joinRequest.delete({ where: { id: request.id } });
            }
        } else {
            await prisma.joinRequest.delete({ where: { teamId_sessionId: { teamId: team.id, sessionId: userSessionId } } });
        }
        res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
}

export async function getStatus(req: Request, res: Response) {
    const { sessionId } = req.query;
    if (!sessionId || typeof sessionId !== 'string') return res.status(400).json({ error: 'Missing sessionId' });
    try {
        const member = await prisma.teamMember.findFirst({ where: { sessionId }, include: { team: true } });
        if (member) return res.json({ team: member.team.name, status: member.role });
        const request = await prisma.joinRequest.findFirst({ where: { sessionId }, include: { team: true } });
        if (request) return res.json({ team: request.team.name, status: 'pending' });
        res.json({ team: null, status: null });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
}

export async function leaveTeam(req: Request, res: Response) {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' });
    try {
        await prisma.teamMember.deleteMany({ where: { sessionId } });
        await prisma.joinRequest.deleteMany({ where: { sessionId } });
        res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
}

// --- Chat ---

export async function teamChat(req: Request, res: Response) {
    const { message, sessionId } = req.body;
    if (!message || !sessionId) return res.status(400).json({ error: 'Missing data' });
    try {
        const member = await prisma.teamMember.findFirst({ where: { sessionId }, include: { team: true } });
        if (!member) return res.status(403).json({ error: 'Unauthorized' });
        const team = member.team;
        const dbHistory = await prisma.teamChat.findMany({ where: { teamId: team.id }, orderBy: { createdAt: 'asc' }, take: 20 });
        const chatHistory = dbHistory.map((h: any) => ({ role: h.role, content: h.role === 'user' ? `${h.username}: ${h.content}` : h.content }));
        chatHistory.push({ role: 'user', content: `${member.username}: ${message}` });

        console.log(`AI Chat for team ${team.name} by ${member.username}`);
        const store = aiConfigStorage.getStore();
        const apiKey = store?.apiKey || req.body.apiKey || undefined;
        const modelOverride = store?.model || req.body.model || undefined;

        const structured = await getStructuredChatResponse(chatHistory, {
            model: modelOverride || undefined,
            temperature: 0.3,
            apiKey: apiKey,
        });

        await prisma.teamChat.createMany({
            data: [
                { teamId: team.id, role: 'user', content: message, username: member.username },
                { teamId: team.id, role: 'assistant', content: structured.answer_markdown }
            ]
        });
        res.json({ reply: structured.answer_markdown, response: structured, teamName: team.name });
    } catch (err: any) {
        console.error('LLM Chat error:', err.message);
        res.status(500).json({ error: `AI Connection failed: ${err.message}` });
    }
}

export async function getChatHistory(req: Request, res: Response) {
    const { sessionId } = req.query;
    if (!sessionId || typeof sessionId !== 'string') return res.status(400).json({ error: 'Missing sessionId' });
    try {
        const member = await prisma.teamMember.findFirst({ where: { sessionId }, include: { team: true } });
        if (!member) return res.json([]);
        const history = await prisma.teamChat.findMany({ where: { teamId: member.teamId }, orderBy: { createdAt: 'asc' } });
        res.json(history);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
}

// --- Ideas ---

export async function getIdeas(req: Request, res: Response) {
    const { sessionId } = req.query;
    if (!sessionId || typeof sessionId !== 'string') return res.status(400).json({ error: 'Missing sessionId' });
    try {
        const member = await prisma.teamMember.findFirst({ where: { sessionId }, include: { team: true } });
        if (!member) return res.json([]);
        const ideas = await prisma.teamIdea.findMany({ where: { teamId: member.teamId }, orderBy: { createdAt: 'desc' } });
        res.json(ideas.map((i: any) => ({ ...i, idea: i.content, evaluation: i.evaluation ? JSON.parse(i.evaluation) : null })));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
}

export async function getBestIdea(req: Request, res: Response) {
    const { sessionId } = req.query;
    if (!sessionId || typeof sessionId !== 'string') return res.status(400).json({ error: 'Missing sessionId' });
    try {
        const member = await prisma.teamMember.findFirst({ where: { sessionId }, include: { team: true } });
        if (!member) return res.json(null);
        const ideas = await prisma.teamIdea.findMany({ where: { teamId: member.teamId } });
        if (ideas.length === 0) return res.json(null);
        const parsedIdeas = ideas.map((i: any) => ({ ...i, idea: i.content, evaluation: i.evaluation ? JSON.parse(i.evaluation) : null }));
        const best = parsedIdeas.reduce((prev: any, current: any) => {
            const prevScore = prev.evaluation ? prev.evaluation.overallScore : 0;
            const currScore = current.evaluation ? current.evaluation.overallScore : 0;
            return (currScore > prevScore) ? current : prev;
        });
        res.json(best);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
}

export async function submitIdea(req: Request, res: Response) {
    const { idea, sessionId } = req.body;
    if (!idea || !sessionId) return res.status(400).json({ error: 'Missing data' });
    try {
        const member = await prisma.teamMember.findFirst({ where: { sessionId }, include: { team: true } });
        if (!member) return res.status(403).json({ error: 'Unauthorized' });
        const newIdea = await prisma.teamIdea.create({ data: { teamId: member.teamId, username: member.username, content: idea, pipelineStatus: "pending" } });
        res.json({ ...newIdea, idea, evaluation: null });

        // Background AI Evaluation
        const storeForBg = aiConfigStorage.getStore();
        try {
            const { lightScoreIdea } = await import('../ai/ideaPipeline.js');
            const evaluation = await lightScoreIdea(idea, {
                apiKey: storeForBg?.apiKey,
                model: storeForBg?.model,
                apiBaseUrl: storeForBg?.apiBaseUrl,
            });
            await prisma.teamIdea.update({ 
                where: { id: newIdea.id }, 
                data: { 
                    evaluation: JSON.stringify(evaluation),
                    pipelineStatus: "none"
                } 
            });
        } catch (err: any) { console.error('Evaluation generated error:', err.message); }
    } catch (err: any) { res.status(500).json({ error: err.message }); }
}

export async function getTopIdeas(req: Request, res: Response) {
    const { sessionId, limit = '3' } = req.query;
    if (!sessionId || typeof sessionId !== 'string') return res.status(400).json({ error: 'Missing sessionId' });
    try {
        const member = await prisma.teamMember.findFirst({ where: { sessionId }, include: { team: true } });
        if (!member) return res.json([]);
        
        const ideas = await prisma.teamIdea.findMany({ where: { teamId: member.teamId } });
        const parsedIdeas = ideas.map((i: any) => ({ ...i, idea: i.content, evaluation: i.evaluation ? JSON.parse(i.evaluation) : null }));
        
        // Sort by final_score (fallback to overallScore, fallback to 0) descending
        parsedIdeas.sort((a, b) => {
            const scoreA = a.evaluation?.final_score ?? a.evaluation?.overallScore ?? 0;
            const scoreB = b.evaluation?.final_score ?? b.evaluation?.overallScore ?? 0;
            return scoreB - scoreA;
        });

        res.json(parsedIdeas.slice(0, parseInt(limit as string, 10)));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
}

export async function triggerPipeline(req: Request, res: Response) {
    const { ideaId, sessionId } = req.body;
    if (!ideaId || !sessionId) return res.status(400).json({ error: 'Missing data' });
    try {
        const member = await prisma.teamMember.findFirst({ where: { sessionId }, include: { team: true } });
        if (!member || member.role !== 'admin') return res.status(403).json({ error: 'Only admins can trigger pipeline' });
        
        const idea = await prisma.teamIdea.findUnique({ where: { id: ideaId, teamId: member.teamId } });
        if (!idea) return res.status(404).json({ error: 'Idea not found' });

        await prisma.teamIdea.update({ where: { id: ideaId }, data: { pipelineStatus: 'running' } });
        res.json({ success: true, message: 'Pipeline started in background' });

        // Background process
        const storeForBg = aiConfigStorage.getStore();
        try {
            const { runFullPipeline } = await import('../ai/ideaPipeline.js');
            const result = await runFullPipeline(idea.content, {
                apiKey: storeForBg?.apiKey,
                model: storeForBg?.model,
                apiBaseUrl: storeForBg?.apiBaseUrl,
            });
            
            await prisma.ideaPipeline.create({
                data: {
                    teamId: member.teamId,
                    ideaId: idea.id,
                    result: JSON.stringify(result)
                }
            });
            await prisma.teamIdea.update({ where: { id: ideaId }, data: { pipelineStatus: 'done' } });
        } catch (err: any) {
            console.error('Pipeline failed:', err.message);
            await prisma.teamIdea.update({ where: { id: ideaId }, data: { pipelineStatus: 'error' } });
        }

    } catch (err: any) { res.status(500).json({ error: err.message }); }
}

export async function getPipelineResult(req: Request, res: Response) {
    const { sessionId, ideaId } = req.query;
    if (!sessionId || typeof sessionId !== 'string') return res.status(400).json({ error: 'Missing sessionId' });
    try {
        const member = await prisma.teamMember.findFirst({ where: { sessionId } });
        if (!member) return res.status(403).json({ error: 'Unauthorized' });

        let whereClause: any = { teamId: member.teamId };
        if (ideaId && typeof ideaId === 'string') {
            whereClause.ideaId = ideaId;
        }

        const pipelines = await prisma.ideaPipeline.findMany({ 
            where: whereClause,
            orderBy: { createdAt: 'desc' },
            take: 1
        });

        if (pipelines.length === 0) return res.json(null);
        
        const p = pipelines[0];
        res.json({ ...p, result: JSON.parse(p.result) });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
}

const WORKSHOP_CHAT_SYSTEM_PROMPT = `You are an AI product manager assistant embedded in the Idea Workshop.

The user will send their project context (idea, analysis, feature decisions, working document) followed by their question or request.

Your job:
1. Answer the user conversationally with markdown formatting in answer_markdown.
2. When the user asks to ADD a new feature, output a feature_changes entry with _action: "add".
3. When the user asks to MODIFY or UPDATE an existing feature, output a feature_changes entry with _action: "update".
4. When the user asks to REMOVE or DELETE a feature, output a feature_changes entry with _action: "delete".
5. When the user asks to change project info (summary, target audience, value proposition, strengths, risks, milestones, architecture, etc.), output doc_changes with only the fields that changed.
6. If the user's request does not require changes, omit feature_changes and doc_changes.

For "add" actions, include all fields of the new feature.
For "update" actions, include the feature id and only the fields to change.
For "delete" actions, include only the feature id.

Respond with valid JSON. Always include answer_markdown, summary, highlights, next_actions, warnings.
Only include feature_changes and doc_changes when the user requests modifications.

Schema:
{
  "answer_markdown": "string - conversational answer with markdown",
  "summary": "string - brief summary (max 30 words)",
  "highlights": ["string"] - max 5 items,
  "next_actions": ["string"] - max 5 items,
  "warnings": ["string"] - max 5 items,
  "feature_changes": [
    {
      "_action": "add" | "update" | "delete",
      "id": "string - feature id (required for update/delete)",
      "title": "string",
      "description": "string",
      "rationale": "string",
      "priority": "critical" | "high" | "medium" | "low",
      "include": true | false,
      "rating": 1 | 2 | 3 | 4 | 5,
      "status": "pending" | "approved" | "rejected",
      "comment": "string",
      "integratedSummary": "string",
      "clarifying_questions": ["string"]
    }
  ],
  "doc_changes": {
    "summary": "string or null",
    "target_audience": ["string"] or null,
    "core_value_proposition": ["string"] or null,
    "problem_statement": ["string"] or null,
    "technical_architecture": ["string"] or null,
    "milestones": [{"milestone": "string", "scope": "string", "owner_role": "string", "eta": "string"}] or null,
    "success_metrics": ["string"] or null,
    "risks": [{"risk": "string", "impact": "string", "mitigation": "string"}] or null,
    "implementation_checklist": ["string"] or null,
    "user_flows": ["string"] or null,
    "data_api_requirements": ["string"] or null,
    "open_questions": ["string"] or null,
    "key_features": [{"feature": "string", "include": true|false, "rating": 1-5, "rationale": "string"}] or null,
    "strengths": ["string"] or null,
    "weaknesses": ["string"] or null
  }
}`;

async function getWorkshopChatResponse(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options?: { model?: string; temperature?: number; max_tokens?: number; apiKey?: string; apiBaseUrl?: string }
): Promise<any> {
    const llmProvider = getLLMProvider();
    const modelOutput = await llmProvider.chat({
        model: options?.model,
        temperature: options?.temperature ?? 0.3,
        max_tokens: options?.max_tokens,
        apiKey: options?.apiKey,
        apiBaseUrl: options?.apiBaseUrl,
        messages: [
            { role: 'system', content: WORKSHOP_CHAT_SYSTEM_PROMPT },
            ...messages
        ]
    });

    return safeParseJson(modelOutput, options);
}

// --- Simple Chat (from merged server.js) ---

export async function simpleChat(req: Request, res: Response) {
    const { message, apiKey, model, apiBaseUrl } = req.body;
    if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Invalid message' });
    }
    const store = aiConfigStorage.getStore();
    const activeApiKey = apiKey || store?.apiKey || undefined;
    const activeModel = model || store?.model || undefined;
    const activeApiBaseUrl = apiBaseUrl || store?.apiBaseUrl || undefined;
    try {
        const structured = await getStructuredChatResponse([
            { role: 'user', content: message }
        ], {
            model: activeModel || undefined,
            temperature: 0.3,
            apiKey: activeApiKey,
            apiBaseUrl: activeApiBaseUrl,
        });
        res.json({ reply: structured.answer_markdown, response: structured });
    } catch (err: any) {
        console.error('LLM error:', err.message);
        res.status(500).json({ error: 'Failed to get AI response' });
    }
}

export async function workshopChat(req: Request, res: Response) {
    const { message, apiKey, model, apiBaseUrl } = req.body;
    if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Invalid message' });
    }
    const store = aiConfigStorage.getStore();
    const activeApiKey = apiKey || store?.apiKey || undefined;
    const activeModel = model || store?.model || undefined;
    const activeApiBaseUrl = apiBaseUrl || store?.apiBaseUrl || undefined;
    try {
        const parsed = await getWorkshopChatResponse([
            { role: 'user', content: message }
        ], {
            model: activeModel || undefined,
            temperature: 0.3,
            apiKey: activeApiKey,
            apiBaseUrl: activeApiBaseUrl,
        });
        const answer_markdown = parsed.answer_markdown || '';
        const summary = parsed.summary || '';
        res.json({
            reply: answer_markdown,
            response: {
                answer_markdown,
                summary,
                highlights: Array.isArray(parsed.highlights) ? parsed.highlights.slice(0, 5) : [],
                next_actions: Array.isArray(parsed.next_actions) ? parsed.next_actions.slice(0, 5) : [],
                warnings: Array.isArray(parsed.warnings) ? parsed.warnings.slice(0, 5) : [],
                feature_changes: Array.isArray(parsed.feature_changes) ? parsed.feature_changes : undefined,
                doc_changes: parsed.doc_changes && typeof parsed.doc_changes === 'object' ? parsed.doc_changes : undefined,
            },
        });
    } catch (err: any) {
        console.error('LLM error:', err.message);
        res.status(500).json({ error: 'Failed to get AI response' });
    }
}

// --- Project-Context-Aware Chat ---

export async function projectChat(req: Request, res: Response) {
    const { message, projectId, history } = req.body;
    if (!message || !projectId) {
        return res.status(400).json({ error: 'Message and projectId are required' });
    }

    try {
        // Load project idea for context
        const project = await prisma.project.findUnique({ where: { id: projectId } });
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const projectIdea = project.description || 'No idea has been set for this project yet.';

        const systemPrompt = `You are an intelligent AI assistant embedded in a project management IDE called "Akasha". You are helping the user with their project.

PROJECT NAME: ${project.name}
PROJECT IDEA/DESCRIPTION:
${projectIdea}

Your role:
- Answer questions about the project idea, its feasibility, technical requirements, and implementation
- Help brainstorm features, architecture, and improvements
- Provide actionable advice based on the project context
- Be concise, helpful, and professional
- If the user asks about something unrelated to the project, still be helpful but try to relate it back to their project when relevant`;

        // Build messages array
        const messages: any[] = [
            { role: 'system', content: systemPrompt }
        ];

        // Add conversation history if provided
        if (Array.isArray(history)) {
            for (const msg of history.slice(-10)) {
                messages.push({
                    role: msg.role === 'user' ? 'user' : 'assistant',
                    content: msg.content
                });
            }
        }

        messages.push({ role: 'user', content: message });

        const store = aiConfigStorage.getStore();
        const apiKey = store?.apiKey || req.body.apiKey || undefined;
        const modelOverride = store?.model || req.body.model || undefined;
        const apiBaseUrl = store?.apiBaseUrl || req.body.apiBaseUrl || undefined;

        const structured = await getStructuredChatResponse(messages, {
            model: modelOverride || undefined,
            temperature: 0.4,
            apiKey: apiKey,
            apiBaseUrl: apiBaseUrl,
        });

        res.json({ reply: structured.answer_markdown, response: structured, projectName: project.name });
    } catch (err: any) {
        console.error('Project chat error:', err.message);
        res.status(500).json({ error: `AI Connection failed: ${err.message}` });
    }
}

// --- Diagram AI Chat ---

export async function diagramChat(req: Request, res: Response) {
    const { message, projectId, history, currentDiagramName, currentDiagramContent } = req.body;
    if (!message || !projectId) {
        return res.status(400).json({ error: 'Message and projectId are required' });
    }

    try {
        // Load project with all related context
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: {
                pages: { where: { archived: false } },
                dataModels: { where: { archived: false } },
                useCases: { where: { archived: false } },
                logicFlows: { where: { archived: false } },
                apis: { where: { archived: false } },
            },
        });

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Format pages
        const pagesText = project.pages.length > 0
            ? project.pages.map((p: any) => `- ${p.name} (path: ${p.path}${p.isDynamic ? ', dynamic' : ''})`).join('\n')
            : 'No pages defined yet.';

        // Format data models
        const dataModelsText = project.dataModels.length > 0
            ? project.dataModels.map((dm: any) => {
                let schemaDisplay = '';
                try {
                    const schema = JSON.parse(dm.schema);
                    if (schema.fields && Array.isArray(schema.fields)) {
                        schemaDisplay = '\n  Fields: ' + schema.fields.map((f: any) =>
                            `${f.name}: ${f.type}${f.required ? ' (required)' : ''}`
                        ).join(', ');
                    }
                } catch { schemaDisplay = ''; }
                return `- ${dm.name}${schemaDisplay}`;
            }).join('\n')
            : 'No data models defined yet.';

        // Format use cases
        const useCasesText = project.useCases.length > 0
            ? project.useCases.map((uc: any) => {
                let actors: string[] = [];
                let steps: string[] = [];
                try { actors = JSON.parse(uc.actors); } catch { }
                try {
                    const rawSteps = JSON.parse(uc.steps);
                    steps = rawSteps.map((s: any) => s.description || String(s));
                } catch { }
                return `- ${uc.name} [${uc.priority}]\n  Actors: ${actors.join(', ') || 'N/A'}\n  Steps: ${steps.slice(0, 4).join(' → ') || 'N/A'}`;
            }).join('\n')
            : 'No use cases defined yet.';

        // Format logic flows
        const logicFlowsText = project.logicFlows.length > 0
            ? project.logicFlows.map((lf: any) => `- ${lf.name}`).join('\n')
            : 'No logic flows defined yet.';

        // Format API endpoints
        const apisText = project.apis && project.apis.length > 0
            ? project.apis.map((api: any) => {
                let configDisplay = '';
                try {
                    const config = JSON.parse(api.config);
                    if (config.body) {
                        configDisplay = `\n  Body: ${JSON.stringify(config.body)}`;
                    }
                } catch {}
                return `- [${api.method.toUpperCase()}] ${api.path} (${api.name})${configDisplay}`;
            }).join('\n')
            : 'No API endpoints defined yet.';

        const projectDescription = project.description || 'No description provided.';
        const diagramContext = currentDiagramName
            ? `Current Diagram: ${currentDiagramName}\nContent: ${currentDiagramContent || 'Empty diagram.'}`
            : 'No diagram currently selected.';

        const systemPrompt = `You are an expert software architect and senior technical diagram assistant embedded inside a collaborative visual IDE called "Akasha Visual IDE".

You help software engineers create, analyze, improve, and explain technical diagrams using Mermaid syntax.
Always output valid Mermaid code wrapped in \`\`\`mermaid blocks.

════ PROJECT CONTEXT ════
Project Name: ${project.name}
Description / PRD:
${projectDescription}

════ PAGES ════
${pagesText}

════ DATA MODELS ════
${dataModelsText}

════ USE CASES ════
${useCasesText}

════ LOGIC FLOWS ════
${logicFlowsText}

════ API ENDPOINTS ════
${apisText}

════ CURRENT DIAGRAM ════
${diagramContext}

════ YOUR CAPABILITIES ════
MODE 1 — GENERATE: When asked to generate/create/draw a diagram, identify the type (ERD/Sequence/Flowchart/Architecture/UseCase/Class/Deployment/StateMachine) and output valid Mermaid code using REAL names from the project context above. Never use placeholder names.

MODE 2 — ANALYZE: When asked to analyze/review/check a diagram, review it against the project context and return numbered findings with [CRITICAL], [WARNING], or [SUGGESTION] labels. End with: DIAGRAM QUALITY SCORE: X/100.

MODE 3 — IMPROVE: When asked to improve/enhance/fix, list 3-5 concrete improvements using real project names with corrected Mermaid snippets.

MODE 4 — EXPLAIN: When asked to explain/describe, write a clear 3-paragraph plain-English explanation under 250 words.

MODE 5 — CHAT: For general questions, answer concisely grounded in the project context.

RULES:
- Always use real entity/actor/component names from the context above
- Keep Mermaid syntax valid and paste-ready
- After every diagram add: "Ready to paste into draw.io via Extras → Edit Diagram"
- Prioritize clarity and correctness over length`;

        const messages: any[] = [{ role: 'system', content: systemPrompt }];

        if (Array.isArray(history)) {
            for (const msg of history.slice(-8)) {
                messages.push({
                    role: msg.role === 'user' ? 'user' : 'assistant',
                    content: msg.content,
                });
            }
        }

        messages.push({ role: 'user', content: message });

        const store = aiConfigStorage.getStore();
        const apiKey = store?.apiKey || req.body.apiKey || undefined;
        const modelOverride = store?.model || req.body.model || undefined;
        const apiBaseUrl = store?.apiBaseUrl || req.body.apiBaseUrl || undefined;

        const structured = await getStructuredChatResponse(messages, {
            model: modelOverride || undefined,
            temperature: 0.4,
            apiKey,
            apiBaseUrl,
        });

        res.json({ reply: structured.answer_markdown, response: structured, projectName: project.name });
    } catch (err: any) {
        console.error('Diagram chat error:', err.message);
        res.status(500).json({ error: `AI Connection failed: ${err.message}` });
    }
}

// --- Idea Validation & Refinement ---

function buildSeedRefinedIdeaDoc(idea: string, understanding: IdeaUnderstanding, featureQueue: FeatureQueueItem[]): RefinedIdeaDocument {
    const primaryFeatures = featureQueue.slice(0, 6).map((feature) => ({
        feature: feature.title,
        include: feature.status !== 'rejected',
        rating: feature.rating,
        rationale: feature.rationale || feature.description || feature.integrated_summary,
    }));

    const firstUser = understanding.target_users[0] || 'Target user';
    const productLabel = featureQueue[0]?.title || 'Core workflow';

    return {
        title: 'Product Vision',
        summary: buildSummaryFromAnswer(idea),
        target_audience: understanding.target_users,
        core_value_proposition: understanding.inferred_requirements.slice(0, 4),
        problem_statement: understanding.core_problem
            ? [understanding.core_problem, ...understanding.explicit_requirements.slice(0, 3)]
            : understanding.explicit_requirements.slice(0, 4),
        decision_summary: [
            'Initial structured concept inferred from the raw project description.',
            ...understanding.context_notes.slice(0, 3),
        ],
        key_features: primaryFeatures,
        user_flows: primaryFeatures.slice(0, 3).map((feature, index) => `${firstUser} completes flow ${index + 1} through ${feature.feature}.`),
        technical_architecture: understanding.constraints.length > 0
            ? understanding.constraints.slice(0, 4).map((constraint) => `Design around constraint: ${constraint}.`)
            : ['Use a modular frontend, API layer, and persistent data store sized for the MVP.'],
        data_api_requirements: primaryFeatures.slice(0, 4).map((feature) => `Expose data/API support for ${feature.feature}.`),
        milestones: [
            { milestone: 'Discovery & scoping', scope: 'Confirm requirements, users, and success criteria.', owner_role: 'Product', eta: 'Week 1' },
            { milestone: `Build ${productLabel}`, scope: 'Deliver the primary end-to-end MVP experience.', owner_role: 'Engineering', eta: 'Weeks 2-4' },
            { milestone: 'Launch readiness', scope: 'QA, analytics, and go-live preparation.', owner_role: 'Product + Engineering', eta: 'Week 5' },
        ],
        success_metrics: [
            'Activation rate for primary users',
            'Time to first successful workflow completion',
            'Retention or repeat usage after initial onboarding',
        ],
        risks: [
            { risk: 'User needs are underspecified', impact: 'Medium', mitigation: 'Validate assumptions with targeted discovery interviews.' },
            { risk: 'MVP scope expands too quickly', impact: 'High', mitigation: 'Keep only critical features in the first release.' },
            { risk: 'Integration complexity delays delivery', impact: 'Medium', mitigation: 'Stage external dependencies behind clear interfaces.' },
        ],
        implementation_checklist: [
            'Validate target users and problem statements',
            'Prioritize and approve the feature queue',
            'Draft UX and API requirements for approved features',
            'Sequence milestones and engineering tasks',
        ],
        open_questions: understanding.assumptions.slice(0, 4),
    };
}

function compactIdeaText(idea: string): string {
    return idea.replace(/\s+/g, ' ').trim();
}

function splitIdeaFragments(idea: string, maxItems = 8): string[] {
    return compactIdeaText(idea)
        .split(/[\n.;]+|,\s+| and /i)
        .map((item) => item.trim())
        .filter((item) => item.length >= 4)
        .slice(0, maxItems);
}

function inferTargetUsersFromIdea(idea: string): string[] {
    const text = compactIdeaText(idea);
    const matches = [
        text.match(/\bfor\s+([a-z0-9 ,/&-]{3,80})/i)?.[1] || '',
        text.match(/\bhelps?\s+([a-z0-9 ,/&-]{3,80})/i)?.[1] || '',
        text.match(/\bused by\s+([a-z0-9 ,/&-]{3,80})/i)?.[1] || '',
    ]
        .map((item) => item.split(/\b(to|manage|track|with|that)\b/i)[0]?.trim() || '')
        .filter(Boolean);

    const normalized = matches
        .flatMap((item) => item.split(/,|\/| and /i))
        .map((item) => item.trim())
        .filter((item) => item.length >= 3 && item.length <= 40);

    return Array.from(new Set(normalized)).slice(0, 5);
}

function inferConstraintsFromIdea(idea: string): string[] {
    const text = compactIdeaText(idea).toLowerCase();
    const constraints: string[] = [];
    if (/(hipaa|gdpr|compliance|privacy|security)/i.test(text)) constraints.push('Compliance and data security requirements must be handled from day one.');
    if (/(budget|small team|solo|time|deadline|week|month|mvp)/i.test(text)) constraints.push('The first release should stay tightly scoped for MVP delivery.');
    if (/(role-based|permissions|access control)/i.test(text)) constraints.push('Authorization and role boundaries are core system constraints.');
    return constraints.slice(0, 4);
}

function buildFallbackIdeaAnalysis(idea: string) {
    const fragments = splitIdeaFragments(idea);
    const targetUsers = inferTargetUsersFromIdea(idea);
    const capabilitySeeds = fragments
        .map((item) => item.replace(/^(a|an|the)\s+/i, '').trim())
        .filter((item) => item.length >= 5 && item.length <= 60)
        .slice(0, 6);

    const understanding: IdeaUnderstanding = {
        core_problem: fragments[0] || 'The user described a problem that still needs sharper framing.',
        intended_solution: `A product that ${buildSummaryFromAnswer(idea).toLowerCase() || 'addresses the described workflow more effectively.'}`,
        target_users: targetUsers.length > 0 ? targetUsers : ['Primary operators of the workflow', 'Secondary stakeholders affected by delivery'],
        explicit_requirements: capabilitySeeds.slice(0, 4),
        inferred_requirements: [
            'A clear onboarding and first-use path',
            'Persistent data storage for the main workflow',
            'Reporting or visibility into key outcomes',
        ],
        constraints: inferConstraintsFromIdea(idea),
        assumptions: [
            'Users need a faster or less error-prone workflow than current alternatives.',
            'The MVP should prove value before adding advanced automations.',
        ],
        context_notes: [
            'This analysis was generated from the raw idea when structured AI output was unavailable.',
        ],
    };

    const majorCapabilities = capabilitySeeds.length > 0
        ? capabilitySeeds.slice(0, 5)
        : ['Core workflow management', 'Notifications and reminders', 'Permissions and role handling'];

    const featureQueue = normalizeFeatureQueue(
        majorCapabilities.map((title, index) => ({
            id: `feature-${index + 1}-${slugifyValue(title) || 'item'}`,
            title,
            description: `Enable the product to support ${title.toLowerCase()}.`,
            rationale: 'This capability appears central to the value proposition described by the user.',
            priority: index === 0 ? 'critical' : index < 3 ? 'high' : 'medium',
            rating: index === 0 ? 5 : index < 3 ? 4 : 3,
            status: 'pending',
            user_comment: '',
            integrated_summary: '',
        }))
    );

    return {
        score: Math.max(45, Math.min(82, 52 + majorCapabilities.length * 5)),
        summary: buildSummaryFromAnswer(idea) || 'The idea has promise but needs structured refinement.',
        strengths: [
            'Addresses a concrete workflow problem',
            'Can be scoped into an MVP',
            'Has obvious operational value if executed well',
        ],
        weaknesses: [
            'Key assumptions are still implicit',
            'Scope and success metrics need sharper definition',
            'Technical constraints may affect the first release',
        ],
        questions: [
            'Who is the primary day-one user?',
            'What must the MVP do better than current alternatives?',
            'Which workflow is most critical in the first release?',
        ],
        suggestions: majorCapabilities.slice(0, 4),
        understanding,
        major_capabilities: majorCapabilities,
        feature_queue: featureQueue,
        structured_concept: buildSeedRefinedIdeaDoc(idea, understanding, featureQueue),
    };
}

export async function analyzeIdea(req: Request, res: Response) {
    const { idea, apiKey, model, apiBaseUrl } = req.body;
    if (!idea || typeof idea !== 'string') {
        return res.status(400).json({ error: 'Valid idea string is required' });
    }
    const store = aiConfigStorage.getStore();
    const activeApiKey = apiKey || store?.apiKey || undefined;
    const activeModel = model || store?.model || undefined;
    const activeApiBaseUrl = apiBaseUrl || store?.apiBaseUrl || undefined;

    try {
        const systemPrompt = `You are an elite startup mentor, product manager, and technical architect.
Deeply understand the user's raw idea before generating anything. Extract the core problem, intended solution, target users, explicit requirements, constraints, and context. Infer the missing but logically necessary details to make the project concept complete.

Return ONLY valid JSON. No markdown, no code fences, no extra text.

JSON schema:
{
  "score": 0,
  "summary": "one sentence summary",
  "strengths": ["..."],
  "weaknesses": ["..."],
  "questions": ["..."],
  "suggestions": ["..."],
  "understanding": {
    "core_problem": "string",
    "intended_solution": "string",
    "target_users": ["string"],
    "explicit_requirements": ["string"],
    "inferred_requirements": ["string"],
    "constraints": ["string"],
    "assumptions": ["string"],
    "context_notes": ["string"]
  },
  "major_capabilities": ["string"],
  "feature_queue": [
    {
      "id": "feature-1",
      "title": "string",
      "description": "string",
      "rationale": "string",
      "priority": "critical|high|medium|low",
      "rating": 5,
      "status": "pending",
      "integrated_summary": "",
      "clarifying_questions": ["string"]
    }
  ],
  "structured_concept": {
    "title": "Product Vision",
    "summary": "string",
    "target_audience": ["string"],
    "core_value_proposition": ["string"],
    "problem_statement": ["string"],
    "decision_summary": ["string"],
    "key_features": [
      { "feature": "string", "include": true, "rating": 4, "rationale": "string" }
    ],
    "user_flows": ["string"],
    "technical_architecture": ["string"],
    "data_api_requirements": ["string"],
    "milestones": [
      { "milestone": "string", "scope": "string", "owner_role": "string", "eta": "string" }
    ],
    "success_metrics": ["string"],
    "risks": [
      { "risk": "string", "impact": "string", "mitigation": "string" }
    ],
    "implementation_checklist": ["string"],
    "open_questions": ["string"]
  }
}

Rules:
- Fill ALL relevant fields in structured_concept, including inferred fields when the user omits them.
- Identify the most critical capabilities and make them major features with priority critical/high and rating 4-5.
- feature_queue must contain 4 to 8 sequential feature suggestions ordered for user review.
- Generate exactly 3 highly specific and clarifying questions in clarifying_questions for each feature to guide the user in Step 3.
- Keep strengths/weaknesses/questions/suggestions concise: max 4 items each.
- Keep the concept practical, specific, and implementation-aware.`;

        const normalizeList = (value: unknown): string[] =>
            Array.isArray(value)
                ? value
                    .filter((item) => typeof item === 'string')
                    .map((item) => item.trim())
                    .filter(Boolean)
                    .slice(0, 4)
                : [];

        const fallbackAnalysis = buildFallbackIdeaAnalysis(idea);
        const llmProvider = getLLMProvider();

        const response = await llmProvider.chat({
            model: activeModel || undefined,
            temperature: 0.2,
            max_tokens: 2600,
            apiKey: activeApiKey,
            apiBaseUrl: activeApiBaseUrl,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: idea }
            ]
        });

        let parsed: any = null;
        try {
            parsed = await safeParseJson(response, {
                model: activeModel || undefined,
                apiKey: activeApiKey,
                apiBaseUrl: activeApiBaseUrl,
            });
        } catch (parseError: any) {
            console.warn('Idea analysis returned non-JSON output, using fallback seed:', parseError?.message || parseError);
            parsed = {};
        }
        const scoreNum = Number(parsed?.score);
        const safeScore = Number.isFinite(scoreNum)
            ? Math.max(0, Math.min(100, Math.round(scoreNum)))
            : fallbackAnalysis.score;

        const understanding = parsed?.understanding
            ? normalizeIdeaUnderstanding(parsed?.understanding)
            : fallbackAnalysis.understanding;
        const suggestions = normalizeList(parsed?.suggestions);
        const featureQueue = normalizeFeatureQueue(
            parsed?.feature_queue ?? parsed?.featureQueue,
            suggestions.length > 0 ? suggestions : fallbackAnalysis.suggestions
        );
        const structuredConcept = normalizeRefinedIdeaDoc(parsed?.structured_concept ?? parsed?.structuredConcept, response);
        const seededConcept = structuredConcept.summary || structuredConcept.key_features.length > 0
            ? structuredConcept
            : buildSeedRefinedIdeaDoc(idea, understanding, featureQueue.length > 0 ? featureQueue : fallbackAnalysis.feature_queue);

        return res.json({
            score: safeScore,
            summary: typeof parsed?.summary === 'string' && parsed.summary.trim() ? parsed.summary : fallbackAnalysis.summary,
            strengths: normalizeList(parsed?.strengths).length > 0 ? normalizeList(parsed?.strengths) : fallbackAnalysis.strengths,
            weaknesses: normalizeList(parsed?.weaknesses).length > 0 ? normalizeList(parsed?.weaknesses) : fallbackAnalysis.weaknesses,
            questions: normalizeList(parsed?.questions).length > 0 ? normalizeList(parsed?.questions) : fallbackAnalysis.questions,
            suggestions: suggestions.length > 0 ? suggestions : fallbackAnalysis.suggestions,
            understanding,
            major_capabilities: normalizeStringArray(parsed?.major_capabilities ?? parsed?.majorCapabilities, 8).length > 0
                ? normalizeStringArray(parsed?.major_capabilities ?? parsed?.majorCapabilities, 8)
                : fallbackAnalysis.major_capabilities,
            feature_queue: featureQueue.length > 0 ? featureQueue : fallbackAnalysis.feature_queue,
            structured_concept: seededConcept
        });
    } catch (err: any) {
        console.error('Idea analysis error:', err.message);
        return res.json(buildFallbackIdeaAnalysis(idea));
    }
}

interface RefinedFeatureItem {
    feature: string;
    include: boolean;
    rating: number;
    rationale: string;
}

interface RefinedMilestoneItem {
    milestone: string;
    scope: string;
    owner_role: string;
    eta: string;
}

interface RefinedRiskItem {
    risk: string;
    impact: string;
    mitigation: string;
}

interface RefinedIdeaDocument {
    title: string;
    summary: string;
    target_audience: string[];
    core_value_proposition: string[];
    problem_statement: string[];
    decision_summary: string[];
    key_features: RefinedFeatureItem[];
    user_flows: string[];
    technical_architecture: string[];
    data_api_requirements: string[];
    milestones: RefinedMilestoneItem[];
    success_metrics: string[];
    risks: RefinedRiskItem[];
    implementation_checklist: string[];
    open_questions: string[];
}

function toRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function normalizeBoolean(value: unknown, fallback = true): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (normalized === 'true' || normalized === 'yes' || normalized === '1') return true;
        if (normalized === 'false' || normalized === 'no' || normalized === '0') return false;
    }
    return fallback;
}

function normalizeRating(value: unknown, fallback = 3): number {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) return fallback;
    return Math.max(1, Math.min(5, Math.round(numberValue)));
}

function normalizeRefinedFeatures(value: unknown): RefinedFeatureItem[] {
    if (!Array.isArray(value)) return [];
    return value
        .map((item) => {
            const record = toRecord(item);
            if (!record) return null;
            const feature = typeof record.feature === 'string' ? record.feature.trim() : '';
            if (!feature) return null;
            return {
                feature,
                include: normalizeBoolean(record.include, true),
                rating: normalizeRating(record.rating, 3),
                rationale: typeof record.rationale === 'string' ? record.rationale.trim() : '',
            };
        })
        .filter((item): item is RefinedFeatureItem => !!item)
        .slice(0, 30);
}

function normalizeRefinedMilestones(value: unknown): RefinedMilestoneItem[] {
    if (!Array.isArray(value)) return [];
    return value
        .map((item) => {
            const record = toRecord(item);
            if (!record) return null;
            const milestone = typeof record.milestone === 'string' ? record.milestone.trim() : '';
            if (!milestone) return null;
            return {
                milestone,
                scope: typeof record.scope === 'string' ? record.scope.trim() : '',
                owner_role: typeof record.owner_role === 'string' ? record.owner_role.trim() : '',
                eta: typeof record.eta === 'string' ? record.eta.trim() : '',
            };
        })
        .filter((item): item is RefinedMilestoneItem => !!item)
        .slice(0, 20);
}

function normalizeRefinedRisks(value: unknown): RefinedRiskItem[] {
    if (!Array.isArray(value)) return [];
    return value
        .map((item) => {
            const record = toRecord(item);
            if (!record) return null;
            const risk = typeof record.risk === 'string' ? record.risk.trim() : '';
            if (!risk) return null;
            return {
                risk,
                impact: typeof record.impact === 'string' ? record.impact.trim() : '',
                mitigation: typeof record.mitigation === 'string' ? record.mitigation.trim() : '',
            };
        })
        .filter((item): item is RefinedRiskItem => !!item)
        .slice(0, 20);
}

function normalizeRefinedIdeaDoc(parsed: unknown, fallbackRaw: string): RefinedIdeaDocument {
    const source = toRecord(parsed) || {};

    const fallbackSummary = buildSummaryFromAnswer(fallbackRaw);
    const summary = typeof source.summary === 'string' && source.summary.trim()
        ? source.summary.trim().slice(0, 260)
        : fallbackSummary;

    return {
        title: typeof source.title === 'string' && source.title.trim() ? source.title.trim() : 'Product Vision',
        summary,
        target_audience: normalizeStringArray(source.target_audience ?? source.targetAudience, 12),
        core_value_proposition: normalizeStringArray(source.core_value_proposition ?? source.coreValueProposition, 12),
        problem_statement: normalizeStringArray(source.problem_statement ?? source.problemStatement, 12),
        decision_summary: normalizeStringArray(source.decision_summary ?? source.decisionSummary, 12),
        key_features: normalizeRefinedFeatures(source.key_features ?? source.keyFeatures),
        user_flows: normalizeStringArray(source.user_flows ?? source.userFlows, 20),
        technical_architecture: normalizeStringArray(source.technical_architecture ?? source.technicalArchitecture, 20),
        data_api_requirements: normalizeStringArray(source.data_api_requirements ?? source.dataApiRequirements, 20),
        milestones: normalizeRefinedMilestones(source.milestones),
        success_metrics: normalizeStringArray(source.success_metrics ?? source.successMetrics, 20),
        risks: normalizeRefinedRisks(source.risks),
        implementation_checklist: normalizeStringArray(source.implementation_checklist ?? source.implementationChecklist, 30),
        open_questions: normalizeStringArray(source.open_questions ?? source.openQuestions, 20),
    };
}

function escapeTableCell(input: string): string {
    return input.replace(/\|/g, '\\|').trim();
}

function listToMarkdown(items: string[]): string {
    if (items.length === 0) return '- N/A';
    return items.map((item) => `- ${item}`).join('\n');
}

function refinedDocToMarkdown(doc: RefinedIdeaDocument): string {
    const lines: string[] = [];

    lines.push(`# ${doc.title || 'Product Vision'}`);
    if (doc.summary) {
        lines.push(doc.summary);
    }

    lines.push('## Target Audience');
    lines.push(listToMarkdown(doc.target_audience));

    lines.push('## Core Value Proposition');
    lines.push(listToMarkdown(doc.core_value_proposition));

    lines.push('## Problem Statement');
    lines.push(listToMarkdown(doc.problem_statement));

    lines.push('## Decision Summary');
    lines.push(listToMarkdown(doc.decision_summary));

    lines.push('## Key Features');
    lines.push('| Feature | Include | Rating | Rationale |');
    lines.push('|---|---|---|---|');
    if (doc.key_features.length === 0) {
        lines.push('| N/A | Yes | 3 | Pending detail |');
    } else {
        for (const feature of doc.key_features) {
            lines.push(`| ${escapeTableCell(feature.feature)} | ${feature.include ? 'Yes' : 'No'} | ${feature.rating}/5 | ${escapeTableCell(feature.rationale || '-')} |`);
        }
    }

    lines.push('## User Flows');
    lines.push(listToMarkdown(doc.user_flows));

    lines.push('## Technical Architecture (High Level)');
    lines.push(listToMarkdown(doc.technical_architecture));

    lines.push('## Data & API Requirements');
    lines.push(listToMarkdown(doc.data_api_requirements));

    lines.push('## Milestones');
    lines.push('| Milestone | Scope | Owner/Role | ETA |');
    lines.push('|---|---|---|---|');
    if (doc.milestones.length === 0) {
        lines.push('| N/A | Define next step | Product Team | TBD |');
    } else {
        for (const milestone of doc.milestones) {
            lines.push(`| ${escapeTableCell(milestone.milestone)} | ${escapeTableCell(milestone.scope || '-')} | ${escapeTableCell(milestone.owner_role || '-')} | ${escapeTableCell(milestone.eta || 'TBD')} |`);
        }
    }

    lines.push('## Success Metrics');
    lines.push(listToMarkdown(doc.success_metrics));

    lines.push('## Risks & Mitigations');
    lines.push('| Risk | Impact | Mitigation |');
    lines.push('|---|---|---|');
    if (doc.risks.length === 0) {
        lines.push('| N/A | - | Define mitigation in discovery |');
    } else {
        for (const risk of doc.risks) {
            lines.push(`| ${escapeTableCell(risk.risk)} | ${escapeTableCell(risk.impact || '-')} | ${escapeTableCell(risk.mitigation || '-')} |`);
        }
    }

    lines.push('## Implementation Checklist');
    lines.push(listToMarkdown(doc.implementation_checklist));

    lines.push('## Open Questions');
    lines.push(listToMarkdown(doc.open_questions));

    return lines.join('\n\n');
}

export async function reviewIdeaFeature(req: Request, res: Response) {
    const { idea, feature, structuredConcept, action, feedback, approvedFeatures, rejectedFeatures, apiKey, model, apiBaseUrl } = req.body;
    const store = aiConfigStorage.getStore();
    const activeApiKey = apiKey || store?.apiKey || undefined;
    const activeModel = model || store?.model || undefined;
    const activeApiBaseUrl = apiBaseUrl || store?.apiBaseUrl || undefined;
    if (!idea || typeof idea !== 'string' || !idea.trim()) {
        return res.status(400).json({ error: 'Original idea is required' });
    }

    if (!feature || typeof feature !== 'object') {
        return res.status(400).json({ error: 'Feature payload is required' });
    }

    const normalizedAction = typeof action === 'string' ? action.trim().toLowerCase() : '';
    if (!['revise', 'approve', 'reject'].includes(normalizedAction)) {
        return res.status(400).json({ error: 'Action must be revise, approve, or reject' });
    }

    try {
        const safeIdea = idea.trim().slice(0, 12000);
        const safeFeature = normalizeFeatureQueue([feature])[0];
        if (!safeFeature) {
            return res.status(400).json({ error: 'Feature payload is invalid' });
        }

        const safeApproved = normalizeFeatureQueue(approvedFeatures).filter((item) => item.status === 'approved' || item.status === 'pending');
        const safeRejected = normalizeFeatureQueue(rejectedFeatures).map((item) => ({ ...item, status: 'rejected' as const }));
        const baseConcept = normalizeRefinedIdeaDoc(structuredConcept, JSON.stringify(structuredConcept ?? {}));
        const seededConcept = baseConcept.summary || baseConcept.key_features.length > 0
            ? baseConcept
            : buildSeedRefinedIdeaDoc(safeIdea, normalizeIdeaUnderstanding({}), safeApproved.length > 0 ? safeApproved : [safeFeature]);

        let systemPrompt = '';
        if (normalizedAction === 'revise') {
            systemPrompt = `You are an elite product manager. Rewrite the given feature description and rationale based on the user's feedback/answers to clarifying questions. Also, generate 3 new specific, targeted clarifying questions to help refine this feature further.
Return ONLY valid JSON and nothing else.

JSON schema:
{
  "feature": {
    "id": "feature-1",
    "title": "string",
    "description": "string",
    "rationale": "string",
    "priority": "critical|high|medium|low",
    "rating": 5,
    "status": "pending",
    "user_comment": "string",
    "integrated_summary": "string",
    "clarifying_questions": ["string"]
  }
}`;
        } else {
            systemPrompt = `You are an elite product manager running an interactive feature refinement queue.
You must deeply understand the original idea, the current structured concept, and the current feature before responding.
Return ONLY valid JSON and nothing else.

JSON schema:
{
  "feature": {
    "id": "feature-1",
    "title": "string",
    "description": "string",
    "rationale": "string",
    "priority": "critical|high|medium|low",
    "rating": 4,
    "status": "pending|approved|rejected",
    "user_comment": "string",
    "integrated_summary": "string",
    "clarifying_questions": ["string"]
  },
  "structured_concept": {
    "title": "Product Vision",
    "summary": "string",
    "target_audience": ["string"],
    "core_value_proposition": ["string"],
    "problem_statement": ["string"],
    "decision_summary": ["string"],
    "key_features": [
      { "feature": "string", "include": true, "rating": 4, "rationale": "string" }
    ],
    "user_flows": ["string"],
    "technical_architecture": ["string"],
    "data_api_requirements": ["string"],
    "milestones": [
      { "milestone": "string", "scope": "string", "owner_role": "string", "eta": "string" }
    ],
    "success_metrics": ["string"],
    "risks": [
      { "risk": "string", "impact": "string", "mitigation": "string" }
    ],
    "implementation_checklist": ["string"],
    "open_questions": ["string"]
  },
  "integration_note": "string"
}

Rules:
- If action is "revise", reinterpret the user feedback and rewrite the feature. Keep status "pending".
- If action is "approve", integrate the approved feature into the structured concept across all relevant sections. Status must be "approved".
- If action is "reject", mark the feature rejected and keep it out of the included key features. Update decision_summary or open_questions only if useful.
- Preserve the already approved features as part of the concept.
- Keep the concept complete, inferred where necessary, and practical for implementation.`;
        }

        const llmProvider = getLLMProvider();
        const modelOutput = await llmProvider.chat({
            model: activeModel || undefined,
            temperature: 0.2,
            max_tokens: 2400,
            apiKey: activeApiKey,
            apiBaseUrl: activeApiBaseUrl,
            messages: [
                { role: 'system', content: systemPrompt },
                {
                    role: 'user',
                    content: normalizedAction === 'revise'
                        ? JSON.stringify({
                            originalIdea: safeIdea,
                            action: normalizedAction,
                            feedback: typeof feedback === 'string' ? feedback.trim().slice(0, 1600) : '',
                            currentFeature: safeFeature,
                        })
                        : JSON.stringify({
                            originalIdea: safeIdea,
                            action: normalizedAction,
                            feedback: typeof feedback === 'string' ? feedback.trim().slice(0, 1600) : '',
                            currentFeature: safeFeature,
                            approvedFeatures: safeApproved,
                            rejectedFeatures: safeRejected,
                            structuredConcept: seededConcept,
                        }),
                },
            ],
        });

        const parsed = await safeParseJson(modelOutput, {
            model: activeModel || undefined,
            apiKey: activeApiKey,
            apiBaseUrl: activeApiBaseUrl,
        });
        const reviewedFeatureStatus = normalizedAction === 'approve'
            ? 'approved'
            : normalizedAction === 'reject'
                ? 'rejected'
                : 'pending';
        const reviewedFeature = {
            ...(normalizeFeatureQueue([parsed?.feature ?? { ...safeFeature, status: reviewedFeatureStatus }])[0]
                || { ...safeFeature, status: reviewedFeatureStatus }),
            status: reviewedFeatureStatus,
        };
        const reviewedConcept = normalizeRefinedIdeaDoc(parsed?.structured_concept ?? parsed?.structuredConcept ?? seededConcept, modelOutput);
        const integrationNote = typeof parsed?.integration_note === 'string'
            ? parsed.integration_note.trim()
            : typeof parsed?.integrationNote === 'string'
                ? parsed.integrationNote.trim()
                : '';

        res.json({
            feature: reviewedFeature,
            structured_concept: reviewedConcept,
            idea_markdown: refinedDocToMarkdown(reviewedConcept),
            integration_note: integrationNote,
        });
    } catch (err: any) {
        console.error('Feature review error:', err.message);
        res.status(500).json({ error: 'Failed to review idea feature. ' + err.message });
    }
}

export async function refineIdea(req: Request, res: Response) {
    const { idea, history, projectId, structuredConcept, featureQueue, understanding, apiKey, model, apiBaseUrl } = req.body;
    if (!idea || typeof idea !== 'string' || !idea.trim()) {
        return res.status(400).json({ error: 'Original idea is required' });
    }
    const store = aiConfigStorage.getStore();
    const activeApiKey = apiKey || store?.apiKey || undefined;
    const activeModel = model || store?.model || undefined;
    const activeApiBaseUrl = apiBaseUrl || store?.apiBaseUrl || undefined;

    try {
        const systemPrompt = `You are an elite product manager and technical architect.
Convert the raw idea and discussion into a strict JSON PRD object.
Return ONLY valid JSON, no markdown fences, no extra text.

Required JSON schema:
{
  "title": "Product Vision",
  "summary": "short summary",
  "target_audience": ["..."],
  "core_value_proposition": ["..."],
  "problem_statement": ["..."],
  "decision_summary": ["..."] ,
  "key_features": [
    { "feature": "...", "include": true, "rating": 4, "rationale": "..." }
  ],
  "user_flows": ["..."],
  "technical_architecture": ["..."],
  "data_api_requirements": ["..."],
  "milestones": [
    { "milestone": "...", "scope": "...", "owner_role": "...", "eta": "..." }
  ],
  "success_metrics": ["..."],
  "risks": [
    { "risk": "...", "impact": "...", "mitigation": "..." }
  ],
  "implementation_checklist": ["..."],
  "open_questions": ["..."]
}

Rules:
- Keep content practical and specific.
- Reflect decision matrix include/exclude, rating, and comments when provided.
- If a current structured concept is provided, treat it as the source of truth and polish it rather than replacing it with a weaker draft.
- Use concise bullet-style strings in arrays.
- Provide at least 3 key_features, 3 milestones, and 3 risks when possible.`;

        const safeIdea = idea.trim().slice(0, 12000);
        const safeHistory = Array.isArray(history)
            ? history
                .filter((msg) => msg && typeof msg.content === 'string' && (msg.role === 'user' || msg.role === 'assistant'))
                .slice(-14)
                .map((msg) => ({ role: msg.role, content: String(msg.content).slice(0, 1400) }))
            : [];

        const messages: any[] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Original Idea:\n${safeIdea}` }
        ];

        if (safeHistory.length > 0) {
            messages.push({
                role: 'user',
                content: `Discussion history for refinement (latest first relevance):\n${JSON.stringify(safeHistory)}`
            });
        }

        if (structuredConcept) {
            messages.push({
                role: 'user',
                content: `Current structured concept JSON:\n${JSON.stringify(structuredConcept).slice(0, 12000)}`
            });
        }

        if (Array.isArray(featureQueue) && featureQueue.length > 0) {
            messages.push({
                role: 'user',
                content: `Feature queue decisions:\n${JSON.stringify(featureQueue).slice(0, 12000)}`
            });
        }

        if (understanding) {
            messages.push({
                role: 'user',
                content: `Idea understanding:\n${JSON.stringify(understanding).slice(0, 8000)}`
            });
        }

        messages.push({ role: 'user', content: 'Generate the final PRD JSON now.' });

        const llmProvider = getLLMProvider();
        const modelOutput = await llmProvider.chat({
            model: activeModel || undefined,
            temperature: 0.3,
            max_tokens: 2200,
            apiKey: activeApiKey,
            apiBaseUrl: activeApiBaseUrl,
            messages
        });

        if (!modelOutput || modelOutput.trim().length === 0) {
            throw new Error('Empty refinement response from AI model');
        }

        let refinedDoc: RefinedIdeaDocument;
        try {
            const parsed = await safeParseJson(modelOutput, {
                model: activeModel || undefined,
                apiKey: activeApiKey,
                apiBaseUrl: activeApiBaseUrl,
            });
            refinedDoc = normalizeRefinedIdeaDoc(parsed, modelOutput);
        } catch {
            refinedDoc = normalizeRefinedIdeaDoc({}, modelOutput);
        }

        const refinedMarkdown = refinedDocToMarkdown(refinedDoc);

        if (projectId) {
            try {
                await prisma.project.update({
                    where: { id: projectId },
                    data: { description: refinedMarkdown }
                });
            } catch (err: any) {
                console.error('Project update after refinement failed:', err.message);
            }
        }

        res.json({ doc: refinedDoc, refinedIdea: refinedMarkdown });
    } catch (err: any) {
        console.error('Idea refinement error:', err.message);
        res.status(500).json({ error: 'Failed to refine idea. ' + err.message });
    }
}

// --- Database Schema Generation from Project Idea ---

interface GeneratedField {
    name: string;
    field_type: string;
    required: boolean;
    unique: boolean;
    primary_key: boolean;
}

interface GeneratedRelation {
    name: string;
    target_model: string;
    relation_type: string;
}

interface GeneratedModel {
    name: string;
    fields: GeneratedField[];
    relations: GeneratedRelation[];
}

function normalizeGeneratedModels(raw: unknown): GeneratedModel[] {
    if (!raw || typeof raw !== 'object') return [];

    let modelsArray: unknown[];
    if (Array.isArray(raw)) {
        modelsArray = raw;
    } else if (Array.isArray((raw as any).models)) {
        modelsArray = (raw as any).models;
    } else {
        return [];
    }

    return modelsArray
        .map((item: any) => {
            if (!item || typeof item !== 'object') return null;
            const name = typeof item.name === 'string' ? item.name.trim() : '';
            if (!name) return null;

            const fields: GeneratedField[] = Array.isArray(item.fields)
                ? item.fields
                    .map((f: any) => {
                        if (!f || typeof f !== 'object') return null;
                        const fieldName = typeof f.name === 'string' ? f.name.trim() : '';
                        if (!fieldName) return null;
                        return {
                            name: fieldName,
                            field_type: typeof f.field_type === 'string' ? f.field_type.trim() : 'string',
                            required: typeof f.required === 'boolean' ? f.required : true,
                            unique: typeof f.unique === 'boolean' ? f.unique : false,
                            primary_key: typeof f.primary_key === 'boolean' ? f.primary_key : false,
                        };
                    })
                    .filter(Boolean) as GeneratedField[]
                : [];

            // Ensure every model has an id primary key
            const hasId = fields.some(f => f.primary_key);
            if (!hasId) {
                fields.unshift({
                    name: 'id',
                    field_type: 'uuid',
                    required: true,
                    unique: true,
                    primary_key: true,
                });
            }

            const relations: GeneratedRelation[] = Array.isArray(item.relations)
                ? item.relations
                    .map((r: any) => {
                        if (!r || typeof r !== 'object') return null;
                        const rName = typeof r.name === 'string' ? r.name.trim() : '';
                        const target = typeof r.target_model === 'string' ? r.target_model.trim() : '';
                        if (!rName || !target) return null;
                        return {
                            name: rName,
                            target_model: target,
                            relation_type: typeof r.relation_type === 'string' ? r.relation_type.trim() : 'one-to-many',
                        };
                    })
                    .filter(Boolean) as GeneratedRelation[]
                : [];

            return { name, fields, relations };
        })
        .filter(Boolean) as GeneratedModel[];
}

export async function generateSchemaFromIdea(req: Request, res: Response) {
    const { projectId, mode = 'scratch', apiKey, model, apiBaseUrl } = req.body;
    if (!projectId || typeof projectId !== 'string') {
        return res.status(400).json({ error: 'projectId is required' });
    }
    const store = aiConfigStorage.getStore();
    const activeApiKey = apiKey || store?.apiKey || undefined;
    const activeModel = model || store?.model || undefined;
    const activeApiBaseUrl = apiBaseUrl || store?.apiBaseUrl || undefined;

    try {
        let parsedModels: GeneratedModel[] = [];
        // 1. Load the project and its description (idea)
        const project = await prisma.project.findUnique({ where: { id: projectId } });
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const ideaText = (project.description || '').trim();
        if (!ideaText) {
            return res.status(400).json({ error: 'No project idea/description found. Please add a project idea first.' });
        }

        // If scratch mode, delete existing models first
        if (mode === 'scratch') {
            await prisma.dataModel.deleteMany({ where: { projectId } });
        }

        // Load existing schema context if in fix mode
        let existingSchemaContext = "";
        if (mode === 'fix') {
            const existingModels = await prisma.dataModel.findMany({ where: { projectId } });
            if (existingModels.length > 0) {
                const contextModels = existingModels.map(m => {
                    let fields = [];
                    let relations = [];
                    try {
                        const schema = typeof m.schema === 'string' ? JSON.parse(m.schema) : m.schema;
                        fields = schema.fields || [];
                        relations = schema.relations || [];
                    } catch (e) {}
                    return {
                        name: m.name,
                        fields,
                        relations
                    };
                });
                existingSchemaContext = `\n\nCURRENT EXISTING SCHEMA:\n${JSON.stringify({ models: contextModels }, null, 2)}`;
            }
        }

        // 2. Send to LLM
        const systemPrompt = `You are an expert database architect and domain modeler.
Read the entire PROJECT IDEA document carefully. Identify the core domain, target users, specific workflows, and data requirements described in the document.

Your task: Generate a comprehensive, highly-tailored relational database schema that perfectly supports the specific features, problem domain, and use cases described in the PROJECT IDEA.

Return ONLY valid JSON matching this exact structure:
{
  "models": [
    {
      "name": "ModelName",
      "fields": [
        { "name": "id", "field_type": "uuid", "required": true, "unique": true, "primary_key": true },
        { "name": "email", "field_type": "string", "required": true, "unique": true, "primary_key": false },
        { "name": "name", "field_type": "string", "required": true, "unique": false, "primary_key": false },
        { "name": "createdAt", "field_type": "datetime", "required": true, "unique": false, "primary_key": false }
      ],
      "relations": [
        { "name": "posts", "target_model": "Post", "relation_type": "one-to-many" }
      ]
    }
  ]
}

Rules:
1. DEEP RELEVANCE MUST BE MAINTAINED: DO NOT generate generic tables like "Product", "Review", "Order" unless the idea explicitly describes an e-commerce store. Ensure ALL models are specifically tailored to the precise domain (e.g., if it's an ICU system, generate Patient, Admission, VitalSign, Doctor, Alert, etc.).
2. Use PascalCase for model names (e.g., User, MedicalRecord, PatientObservation).
3. Every model MUST have an "id" field with field_type "uuid", primary_key true, unique true.
4. Valid field types: uuid, string, text, int, float, boolean, datetime, json. 
5. Include createdAt and updatedAt timestamps for every model.
6. For relations, include the appropriate foreign key fields in the models (e.g., patientId in a VitalSign model) AND include the mapping in the "relations" array.
7. Valid relation_type values: one-to-one, one-to-many, many-to-many.
8. Generate 5 to 15 models depending on the complexity of the specific domain. Be thorough but do not hallucinate unrelated business concerns.
9. Consider the problem statement, core products, and features to ensure enough data fields are created for AI analytics, reports, notifications or whatever are core to the product.
10. ABSOLUTELY NO MARKDOWN CODE FENCES (e.g., \`\`\`json). Just return the raw JSON output.

${mode === 'fix' 
  ? "MODE: CHECK FOR MISSING AND FIX. Analyze the provided CURRENT EXISTING SCHEMA against the PROJECT IDEA. Identify gaps (missing tables, missing fields, or incorrect relations). Return the COMPLETE IMPROVED SCHEMA (including both unchanged and new/fixed parts)." 
  : "MODE: REGENERATE FROM SCRATCH. Ignore any previous schema and generate a completely new one based on the project idea."}`;

        const llmProvider = getLLMProvider();
        const modelOutput = await llmProvider.chat({
            model: activeModel || undefined,
            temperature: 0.2,
            max_tokens: 3000,
            apiKey: activeApiKey,
            apiBaseUrl: activeApiBaseUrl,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `PROJECT IDEA:\n${ideaText.slice(0, 8000)}${existingSchemaContext}` },
            ],
        });

        try {
            const parsed = await safeParseJson(modelOutput, {
                model: activeModel || undefined,
                apiKey: activeApiKey,
                apiBaseUrl: activeApiBaseUrl,
            });
            parsedModels = normalizeGeneratedModels(parsed);
        } catch (parseErr: any) {
            console.warn('Schema generation parse error. Attempting repair pass:', parseErr?.message || parseErr);
            try {
                const repairedOutput = await llmProvider.chat({
                    model: activeModel || undefined,
                    temperature: 0,
                    max_tokens: 3200,
                    apiKey: activeApiKey,
                    apiBaseUrl: activeApiBaseUrl,
                    messages: [
                        {
                            role: 'system',
                            content: `You convert malformed or non-JSON model output into strict valid JSON.
Return ONLY valid JSON and nothing else.
Required schema:
{
    "models": [
        {
            "name": "ModelName",
            "fields": [
                { "name": "id", "field_type": "uuid", "required": true, "unique": true, "primary_key": true }
            ],
            "relations": [
                { "name": "items", "target_model": "OtherModel", "relation_type": "one-to-many" }
            ]
        }
    ]
}
Rules:
- Keep all meaningful domain details from the provided text.
- Ensure every model has id(uuid, required, unique, primary_key=true).
- field_type must be one of: uuid, string, text, int, float, boolean, datetime, json.
- relation_type must be one of: one-to-one, one-to-many, many-to-many.
- No markdown fences, no explanation, JSON only.`
                        },
                        {
                            role: 'user',
                            content: `PROJECT IDEA:\n${ideaText.slice(0, 8000)}${existingSchemaContext}\n\nMODEL OUTPUT TO REPAIR:\n${modelOutput.slice(0, 12000)}`
                        }
                    ]
                });

                const repairedParsed = await safeParseJson(repairedOutput, {
                    model: activeModel || undefined,
                    apiKey: activeApiKey,
                    apiBaseUrl: activeApiBaseUrl,
                });
                parsedModels = normalizeGeneratedModels(repairedParsed);
            } catch (repairErr: any) {
                console.error('Schema generation repair failed:', repairErr?.message || repairErr);
                return res.status(500).json({ error: 'AI returned invalid schema. Please try again.' });
            }
        }

        if (parsedModels.length === 0) {
            return res.status(500).json({ error: 'AI generated no models. Please try again with a more detailed idea.' });
        }

        // 4. Create models in Prisma
        // If in fix mode, we might want to update existing models instead of creating new ones or just delete and replace for simplicity?
        // Deleting and replacing is simpler to maintain consistency with the AI output.
        if (mode === 'fix') {
            await prisma.dataModel.deleteMany({ where: { projectId } });
        }

        const createdModels: any[] = [];
        // First pass: create all models so we have their IDs for relations
        const modelIdMap: Record<string, string> = {};

        for (const model of parsedModels) {
            const schema = {
                fields: model.fields,
                relations: [],
            };

            const created = await prisma.dataModel.create({
                data: {
                    projectId,
                    name: model.name,
                    schema: JSON.stringify(schema),
                },
            });
            modelIdMap[model.name] = created.id;
            createdModels.push({
                id: created.id,
                name: model.name,
                fields: model.fields,
                relations: [],
            });
        }

        // Second pass: update relations with actual model IDs
        for (let i = 0; i < parsedModels.length; i++) {
            const model = parsedModels[i];
            if (!model || model.relations.length === 0) continue;

            const resolvedRelations = model.relations
                .filter(r => modelIdMap[r.target_model])
                .map(r => ({
                    id: `rel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    name: r.name,
                    target_model_id: modelIdMap[r.target_model],
                    relation_type: r.relation_type,
                }));

            if (resolvedRelations.length > 0) {
                const currentModel = await prisma.dataModel.findUnique({
                    where: { id: modelIdMap[model.name] },
                });
                if (currentModel) {
                    const currentSchema = JSON.parse(currentModel.schema);
                    currentSchema.relations = resolvedRelations;
                    await prisma.dataModel.update({
                        where: { id: modelIdMap[model.name] },
                        data: { schema: JSON.stringify(currentSchema) },
                    });
                    createdModels[i].relations = resolvedRelations;
                }
            }
        }

        res.json({
            success: true,
            modelsCreated: createdModels.length,
            models: createdModels,
        });
    } catch (err: any) {
        console.error('Schema generation error:', err.message);
        res.status(500).json({ error: 'Failed to generate schema: ' + err.message });
    }
}

export async function testConnection(req: Request, res: Response) {
    const { apiKey, model, apiBaseUrl } = req.body;
    try {
        const llmProvider = getLLMProvider();
        const modelOutput = await llmProvider.chat({
            model: model || undefined,
            apiKey: apiKey || undefined,
            apiBaseUrl: apiBaseUrl || undefined,
            bypassStore: true,
            messages: [
                { role: 'user', content: 'respond with exactly the word "ok".' }
            ]
        });

        if (!modelOutput || modelOutput.trim().length === 0) {
            throw new Error('No response received from the custom AI endpoint.');
        }

        res.json({ success: true, message: 'Connection successful!', response: modelOutput.trim() });
    } catch (err: any) {
        console.error('AI connection test error:', err.message);
        res.status(400).json({ error: err.message });
    }
}

export async function sandboxGeneratePages(req: Request, res: Response) {
    const { idea, projectId, apiKey, model, apiBaseUrl } = req.body;
    if (!idea || typeof idea !== 'string') {
        return res.status(400).json({ error: 'idea is required' });
    }
    const store = aiConfigStorage.getStore();
    const activeApiKey = apiKey || store?.apiKey || undefined;
    const activeModel = model || store?.model || undefined;
    const activeApiBaseUrl = apiBaseUrl || store?.apiBaseUrl || undefined;

    let projectContext = '';
    if (projectId) {
        try {
            const project = await prisma.project.findUnique({
                where: { id: projectId },
                include: { useCases: { where: { archived: false } }, dataModels: { where: { archived: false } } }
            });
            if (project) {
                projectContext = `Project Name: ${project.name}\nDescription: ${project.description || ''}\n`;
                if (project.useCases.length > 0) {
                    projectContext += `Use Cases:\n${project.useCases.map((u: any) => `- ${u.name}: ${u.description || ''}`).join('\n')}\n`;
                }
                if (project.dataModels.length > 0) {
                    projectContext += `Data Models:\n${project.dataModels.map((d: any) => `- ${d.name}`).join('\n')}\n`;
                }
            }
        } catch (dbErr) {
            console.error('[Sandbox AI] DB project lookup failed:', dbErr);
        }
    }

    try {
        const llmProvider = getLLMProvider();
        let modelOutput = await llmProvider.chat({
            model: activeModel || undefined,
            temperature: 0.2,
            apiKey: activeApiKey,
            apiBaseUrl: activeApiBaseUrl,
            messages: [
                {
                    role: 'system',
                    content: `You are a senior UX product planner and information architect. Given a product idea and project context, design a complete, logical sitemap.

RULES:
- Respond ONLY with a JSON array of page objects. No text, no markdown, no code fences.
- Generate exactly 6-8 pages that represent a complete, production-ready application.
- Each page: {"name":"Page Name","path":"/path","type":"dashboard|auth|settings|list|detail|landing|search|profile","description":"A detailed 2-3 sentence description of what this page contains, its key sections, and what data it displays."}
- Page names should be specific to the product (e.g. "Invoice Manager" not "List Page", "Patient Records" not "Data List").
- Descriptions should be rich enough to guide a developer building the page — mention specific UI sections, data tables, charts, forms, or interactive elements.
- Always include: a main dashboard/overview, at least one data list/management page, a settings/configuration page.
- Paths should use clean kebab-case slugs (e.g. /invoices, /team-members, /analytics).
- Types must be exactly one of: dashboard, auth, settings, list, detail, landing, search, profile.`
                },
                {
                    role: 'user',
                    content: `Product Idea: ${idea}\n\nProject Context:\n${projectContext}`
                }
            ]
        });

        modelOutput = modelOutput.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(extractJsonObject(modelOutput));
        res.json(parsed);
    } catch (err: any) {
        console.error('[Sandbox AI] Generate pages error:', err.message);
        res.status(500).json({ error: 'Failed to generate pages: ' + err.message });
    }
}

export async function sandboxGeneratePageHtml(req: Request, res: Response) {
    const { pageName, pageType, pageDescription, idea, themeDesc, apiKey, model, apiBaseUrl } = req.body;
    const store = aiConfigStorage.getStore();
    const activeApiKey = apiKey || store?.apiKey || undefined;
    const activeModel = model || store?.model || undefined;
    const activeApiBaseUrl = apiBaseUrl || store?.apiBaseUrl || undefined;

    const systemPrompt = `You are an elite senior frontend engineer and product designer. Generate a COMPLETE, standalone, production-quality HTML page that looks like a top-tier SaaS product.

CRITICAL RULES:
- Respond ONLY with the full HTML document. No markdown fences, no explanation, no commentary.
- The page must be a COMPLETE <!DOCTYPE html> document with <html>, <head>, and <body> tags.
- ALL CSS must be inline in a <style> tag inside <head>. No external CSS files.
- Import ONE Google Font via @import at the top of <style> matching the theme font token.
- Import Tabler Icons in the <head>: <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css">
- Use Tabler Icons (e.g. <i class="ti ti-[icon-name]"></i>) for ALL iconography — never use emoji or Unicode symbols for UI elements.
- No external JavaScript libraries (like jQuery, React, Vue). Use clean, modular, vanilla JavaScript inside a <script> tag for interactivity.
- NEVER use generic placeholders (like "Lorem Ipsum" or "John Doe"). Use specific, context-appropriate, rich copy that sounds real.
- The page must feel like a production-grade SaaS interface — polished, dense, functional, and animated.

DESIGN STANDARDS:
- FULL-WIDTH edge-to-edge layout. NO max-width containers or centered wrappers except for auth cards. Use responsive side padding (2rem-4rem) instead.
- Use the provided theme tokens as CSS variables in :root:
  :root {
    --primary: [Accent Color];
    --primary-dark: [Accent Dark/Shaded Color];
    --primary-light: [Accent at 10-15% opacity];
    --radius: [Border Radius]px;
    --font: '[Font Family]', sans-serif;
    --bg: [light/dark background];
    --bg-elevated: [slightly lighter/darker surface];
    --bg-sidebar: [sidebar background];
    --text: [primary text];
    --text-secondary: [muted text];
    --border: [subtle border];
    --shadow: [card shadow];
  }
- Use CSS Grid and Flexbox for all layouts. No float or table-based layouts.
- Color palette: deep neutrals for backgrounds (like #f5f7fa light / #0b0f19 dark), subtle borders (rgba(0,0,0,0.06) or rgba(255,255,255,0.08)), vibrant gradients for accents.
- EVERY interactive element must have CSS transitions (0.15s-0.2s ease) on hover/focus for transform, box-shadow, and background-color.
- Add at least 3 @keyframe animations (fade-in, slide-up, pulse, shimmer, or gradient-shift). Apply them to sections on load for a polished feel.
- Cards, modals, and dropdowns must have subtle box-shadow and border-radius using the provided radius token.
- Typography must use the theme font with a clear hierarchy: large bold headings, smaller subheadings, and compact body text.

CONTENT STANDARDS:
- Tables must have 5-8 columns and 6-10 rows of realistic data (real-sounding names, emails, amounts, statuses, dates).
- Status badges: pill-shaped with soft tinted backgrounds (emerald for active/paid, amber for pending, rose for failed/cancelled, slate for draft).
- Use colored avatar initials for user representations (e.g., circle with initials in contrasting colors).
- All timestamps should be realistic (e.g., "Mar 12, 2025 at 3:42pm", "2 hours ago", "Yesterday").
- Monetary values must be formatted ($1,234.56).

PAGE-SPECIFIC COMPONENT EXPECTATIONS:
- Dashboard: Full-width left sidebar (collapsible via hamburger), top navbar with breadcrumbs/search/bell+avatar, 3-4 metric cards with micro line/SVG charts, data grid table with sortable headers and pagination, recent activity feed.
- Landing Page: Fixed navbar with logo+links+CTA, full-bleed hero with gradient text headline, sub-text, dual CTA buttons, feature grid (3-col) with hover-lift cards, testimonial carousel with dots, accordion FAQ, 4-col footer with link groups.
- Auth Page: Split-screen (brand illustration or gradient left, form right) or centered card on gradient background. Floating labels, social buttons (Google/GitHub), password show/hide toggle, validation states.
- Settings Page: Vertical tab/sidebar menu with sections (Profile, Account, Notifications, Billing). Toggle switches, select dropdowns, avatar upload zone, danger zone with delete button.
- List Page: Search bar with icon, filter dropdowns + active filter chips, sortable table rows with checkboxes, bulk action bar, pagination.
- Detail Page: Back link, heading with breadcrumbs, 3-tab layout (Overview, Activity, Settings) with JS tab switching, metadata sidebar, tag pills, action buttons.
- Profile Page: Cover banner image, large circular avatar overlapping banner, edit info cards, tabbed content (Posts, Activity, Settings), stats row.

INTERACTIVE BEHAVIOR (VANILLA JS):
- Sidebar toggle: hamburger button adds/removes "collapsed" class on sidebar, animating width.
- Tab switching: click tabs to show/hide corresponding content panels.
- Dropdown: click avatar or "More" button to show a positioned dropdown menu; click outside to close.
- Search filter: on keyup, filter table rows by matching text.
- Form simulation: on submit, show a toast/snackbar notification at top-right, then reset form.
- Notifications: click bell icon to show a small dropdown with 2-3 notification items.
- Iframes: When generating an iframe (e.g. for previews, dashboards, or embeds), NEVER use an empty src="" or src="#" as this causes browser security errors (CORS/unique origin violations) when the page is exported and loaded locally under the file:// protocol. Always use src="about:blank" as the default/fallback source.

OUTPUT: Just the complete HTML. Nothing else.`;

    try {
        const llmProvider = getLLMProvider();
        let modelOutput = await llmProvider.chat({
            model: activeModel || undefined,
            temperature: 0.35,
            max_tokens: 8192,
            apiKey: activeApiKey,
            apiBaseUrl: activeApiBaseUrl,
            messages: [
                {
                    role: 'system',
                    content: systemPrompt
                },
                {
                    role: 'user',
                    content: `Page Name: ${pageName}\nPage Type: ${pageType}\nPage Description: ${pageDescription}\nProduct Context: ${idea}\nTheme Tokens: ${themeDesc}\n\nGenerate the full HTML page now.`
                }
            ]
        });

        modelOutput = modelOutput.replace(/```html|```/g, '').trim();
        res.json({ html: modelOutput });
    } catch (err: any) {
        console.error('[Sandbox AI] Generate page HTML error:', err.message);
        res.status(500).json({ error: 'Failed to generate page HTML: ' + err.message });
    }
}

export async function sandboxEditPage(req: Request, res: Response) {
    const { pageName, pageType, currentHTML, message, themeDesc, apiKey, model, apiBaseUrl } = req.body;
    const store = aiConfigStorage.getStore();
    const activeApiKey = apiKey || store?.apiKey || undefined;
    const activeModel = model || store?.model || undefined;
    const activeApiBaseUrl = apiBaseUrl || store?.apiBaseUrl || undefined;

    const editSystemPrompt = `You are an elite senior frontend engineer acting as a live page editor. The user provides instructions to modify a standalone HTML page.

RESPONSE FORMAT — you MUST respond with exactly TWO parts separated by this delimiter: |||HTML_START|||

Part 1 (before delimiter): A SHORT conversational explanation of what you changed (2-3 sentences max, plain text, no markdown). Be specific about what was modified.

Part 2 (after delimiter): The COMPLETE updated HTML page. This must be the FULL <!DOCTYPE html> document from start to finish. Never truncate, never use "..." or "<!-- rest of content -->". Every single line of code must be present. Omit NOTHING.

EDITING RULES:
- Preserve ALL existing content, structure, and styles unless the user explicitly asks to edit or remove them.
- Ensure the page contains the Tabler Icons CDN: <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css">
- Use Tabler Icons (<i class="ti ti-[icon-name]"></i>) for ALL icons — never use emoji or Unicode for UI icons.
- Avoid restrictive centered page containers or wrappers. Support full-width, edge-to-edge layouts using responsive side padding.
- When adding new sections, match the existing design language exactly (colors, fonts, border-radius, shadows, transitions, spacing scale).
- Apply the theme tokens: ${themeDesc}
- Include :hover and :focus transitions on ALL interactive elements (0.15s-0.2s ease).
- For "more content" or "realistic data", add detailed mock data (full names, email addresses, timestamps, status badges, monetary amounts with $) — never use "Lorem Ipsum" or placeholder text.
- If interactivity is requested, add vanilla JavaScript inside the <script> tags — do not import external libraries.
- Every edit must maintain or improve the visual polish: proper box-shadows, border-radius from theme, smooth animations, and consistent spacing.
- When modifying or generating an iframe (e.g. for previews, dashboards, or embeds), NEVER use an empty src="" or src="#" as this causes browser security errors (CORS/unique origin violations) when the page is exported and loaded locally under the file:// protocol. Always use src="about:blank" as the default/fallback source.
- The final output must be a completely valid, self-contained, and working HTML page.`;

    try {
        const llmProvider = getLLMProvider();
        let modelOutput = await llmProvider.chat({
            model: activeModel || undefined,
            temperature: 0.25,
            max_tokens: 8192,
            apiKey: activeApiKey,
            apiBaseUrl: activeApiBaseUrl,
            messages: [
                {
                    role: 'system',
                    content: editSystemPrompt
                },
                {
                    role: 'user',
                    content: `Current page: ${pageName} (${pageType})\nTheme: ${themeDesc}\n\nCurrent HTML:\n${currentHTML.slice(0, 15000)}\n\nUser instruction: ${message}`
                }
            ]
        });

        res.json({ response: modelOutput });
    } catch (err: any) {
        console.error('[Sandbox AI] Edit page error:', err.message);
        res.status(500).json({ error: 'Failed to edit page: ' + err.message });
    }
}

export async function sandboxSave(req: Request, res: Response) {
    const { projectId, idea, pages, theme, chatMessages } = req.body;
    if (!projectId) return res.status(400).json({ error: 'projectId is required' });

    try {
        await prisma.project.update({
            where: { id: projectId },
            data: {
                sandbox: {
                    idea: idea || '',
                    pages: pages || [],
                    theme: theme || null,
                    chatMessages: chatMessages || [],
                    updatedAt: new Date().toISOString(),
                }
            }
        });
        res.json({ success: true });
    } catch (err: any) {
        console.error('[Sandbox] Save error:', err.message);
        res.status(500).json({ error: err.message });
    }
}

export async function sandboxLoad(req: Request, res: Response) {
    const { projectId } = req.params;
    if (!projectId) return res.status(400).json({ error: 'projectId is required' });

    try {
        const project = await prisma.project.findUnique({
            where: { id: projectId }
        });
        if (!project) return res.status(404).json({ error: 'Project not found' });

        res.json({ sandbox: project.sandbox || null });
    } catch (err: any) {
        console.error('[Sandbox] Load error:', err.message);
        res.status(500).json({ error: err.message });
    }
}

export async function sandboxAutoSave(req: Request, res: Response) {
    const { projectId, idea, pages, theme, chatMessages } = req.body;
    if (!projectId) return res.status(400).json({ error: 'projectId is required' });

    try {
        // Atomic upsert – only writes fields that changed
        await prisma.project.update({
            where: { id: projectId },
            data: {
                sandbox: {
                    idea: idea ?? '',
                    pages: pages ?? [],
                    theme: theme ?? null,
                    chatMessages: chatMessages ?? [],
                    updatedAt: new Date().toISOString(),
                }
            }
        });
        res.json({ success: true, savedAt: new Date().toISOString() });
    } catch (err: any) {
        console.error('[Sandbox] Auto-save error:', err.message);
        res.status(500).json({ error: err.message });
    }
}

export async function getTeamMembers(req: Request, res: Response) {
    const { sessionId } = req.query;
    if (!sessionId || typeof sessionId !== 'string') return res.status(400).json({ error: 'Missing sessionId' });
    try {
        const member = await prisma.teamMember.findFirst({ where: { sessionId } });
        if (!member) {
            return res.json({ members: [] });
        }
        const team = await prisma.team.findUnique({
            where: { id: member.teamId },
            include: { members: true }
        });
        if (!team) {
            return res.json({ members: [] });
        }
        res.json({
            members: team.members.map((m: any) => ({
                sessionId: m.sessionId,
                username: m.username,
                role: m.role
            }))
        });
    } catch (err: any) {
        console.error('[getTeamMembers] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
}

// Fetch organization members for a project - auto-detects team from project's org
export async function getOrgMembers(req: Request, res: Response) {
    const { projectId } = req.query;
    if (!projectId || typeof projectId !== 'string') return res.status(400).json({ error: 'Missing projectId' });
    try {
        let OrgMember: any, User: any, Organization: any;
        try {
            const orgMemberMod = '../../models/OrgMember.js';
            const userMod = '../../models/User.js';
            const orgMod = '../../models/Organization.js';
            OrgMember = (await import(orgMemberMod)).default;
            User = (await import(userMod)).default;
            Organization = (await import(orgMod)).default;
        } catch {
            return res.json({ members: [], orgName: null });
        }

        // Find the project to get its orgId
        const project = await prisma.project.findUnique({ where: { id: projectId } });
        if (!project) return res.status(404).json({ error: 'Project not found' });

        const orgId = (project as any).orgId;
        if (!orgId) {
            // No org attached — return empty so the frontend falls back to local members
            return res.json({ members: [], orgName: null });
        }

        // Fetch the org name
        const org = await Organization.findById(orgId).select('name').lean();
        const orgName = org?.name || null;

        // Fetch all accepted members of this organization with their user details
        const memberships = await OrgMember.find({ orgId, status: 'accepted' })
            .populate('userId', 'username displayName jobTitle skillTags avatarUrl email')
            .lean();

        const members = memberships
            .filter((m: any) => m.userId) // guard against deleted users
            .map((m: any) => {
                const user = m.userId;
                return {
                    id: user._id?.toString?.() || '',
                    username: user.username || user.displayName || 'Unknown',
                    displayName: user.displayName || user.username || '',
                    jobTitle: user.jobTitle || '',
                    skillTags: user.skillTags || [],
                    avatarUrl: user.avatarUrl || '',
                    email: user.email || '',
                    orgRole: m.role || 'member',   // 'leader' | 'member'
                };
            });

        res.json({ members, orgName });
    } catch (err: any) {
        console.error('[getOrgMembers] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
}

// Role-based task assignment logic - maps task types to suitable roles
const ROLE_TASK_MAPPING: Record<string, string[]> = {
    "frontend": ["Frontend Engineer", "Fullstack Engineer", "UI/UX Designer"],
    "backend": ["Backend Engineer", "Fullstack Engineer"],
    "database": ["Backend Engineer", "Fullstack Engineer", "Database Admin"],
    "api": ["Backend Engineer", "Fullstack Engineer"],
    "ui": ["Frontend Engineer", "Fullstack Engineer", "UI/UX Designer"],
    "design": ["UI/UX Designer", "Frontend Engineer"],
    "architecture": ["Project Lead", "Backend Engineer", "Fullstack Engineer"],
    "testing": ["QA Engineer", "Fullstack Engineer", "Frontend Engineer", "Backend Engineer"],
    "devops": ["DevOps Engineer", "Backend Engineer", "Fullstack Engineer"],
    "mobile": ["Mobile Engineer", "Fullstack Engineer", "Frontend Engineer"],
    "all": ["Project Lead", "Fullstack Engineer", "Frontend Engineer", "Backend Engineer", "UI/UX Designer", "QA Engineer"]
};

function getLocalFallbackMilestones(projectName: string, projectDescription: string, teamMembers: any[]): any[] {
    const roles = teamMembers && teamMembers.length > 0
        ? teamMembers
        : [{ username: 'All', role: 'Team' }];
        
    // Enhanced milestones with task categories for role-based assignment
    const defaultMilestones = [
        { title: "Define Project Architecture & Specs", description: "Document technical requirements, framework selection, and scope based on: " + (projectDescription ? projectDescription.slice(0, 100) + "..." : "project specifications."), category: "architecture" },
        { title: "Design UI Wireframes & Layouts", description: "Create mockups and initial interface wireframes for the views.", category: "design" },
        { title: "Configure Database Schema & Relationships", description: "Define relational models, tables, and associations in schema.", category: "database" },
        { title: "Develop API Endpoints & Routes", description: "Build backend REST endpoints and tie logic flows.", category: "api" },
        { title: "Integrate Visual Components & State", description: "Mount and bind interactive UI components to frontend data stores.", category: "frontend" },
        { title: "Perform QA Testing & Bug Fixing", description: "Test core use cases, logic flows, and patch edge-case errors.", category: "testing" }
    ];

    return defaultMilestones.map((m, index) => {
        let assignedTo = "All";
        const suitableRoles = (ROLE_TASK_MAPPING as Record<string, string[]>)[m.category] || ROLE_TASK_MAPPING["all"] || [];
        
        // Find team member with matching role
        for (const suitableRole of suitableRoles) {
            const match = roles.find(r => r.role?.toLowerCase().includes(suitableRole.toLowerCase()));
            if (match) {
                assignedTo = match.username;
                break;
            }
        }
        
        // Fallback: round-robin if no role match
        if (assignedTo === "All" && roles.length > 0) {
            assignedTo = roles[index % roles.length].username;
        }

        return {
            id: `task-fallback-${Date.now()}-${index}`,
            title: m.title,
            description: m.description,
            assignedTo,
            status: "todo",
            createdAt: new Date().toISOString()
        };
    });
}

// Helper to find best assignee for a task based on category and team composition
function findBestAssignee(taskCategory: string, teamMembers: any[]): string {
    const suitableRoles = (ROLE_TASK_MAPPING as Record<string, string[]>)[taskCategory] || ROLE_TASK_MAPPING["all"] || [];
    for (const suitableRole of suitableRoles) {
        const match = teamMembers.find(r => r.role?.toLowerCase().includes(suitableRole.toLowerCase()));
        if (match) return match.username;
    }
    return teamMembers.length > 0 ? teamMembers[0].username : "All";
}

export async function generateTeamTasks(req: Request, res: Response) {
    const { projectName, projectDescription, ideaDetails, teamMembers } = req.body;
    const membersList = Array.isArray(teamMembers) ? teamMembers : [];
    
    try {
        const llmProvider = getLLMProvider();
        
        const membersListStr = membersList.length > 0
            ? membersList.map((m: any) => `- Name: ${m.username}, Role: ${m.role || 'General'}`).join('\n')
            : '- Name: All, Role: Team Milestone';

        const prompt = `You are a project manager and tech lead assistant.
Your task is to generate 5 to 8 concrete project milestones and tasks for a team.
Here is the project information:
Project Name: ${projectName || 'Unnamed Project'}
Description: ${projectDescription || 'No description provided.'}
Idea Details: ${ideaDetails ? JSON.stringify(ideaDetails) : 'None'}

Here are the team members and their roles:
${membersListStr}

Generate 5 to 8 milestone tasks. Assign each task to a specific team member name based on their role, or assign it to "All" if it requires the entire team.
Ensure the tasks are concrete, highly relevant to the project description, and follow standard software engineering milestones (e.g. database schema, UI mockups, backend APIs, testing).

Output format: Return ONLY a valid JSON array of objects, with NO markdown code fences or explanatory text.
Strict Rules:
- Keys and values must use double quotes (not single quotes).
- Do not use trailing commas inside JSON objects or arrays.

JSON Structure:
[
  {
    "id": "unique-uuid-like-string",
    "title": "Task title",
    "description": "Short, concrete description of the task",
    "assignedTo": "Name of member (e.g. David, Sarah, Emily) or 'All'",
    "status": "todo",
    "createdAt": "${new Date().toISOString()}"
  }
]
`;

        let tasks: any[] = [];
        try {
            const responseText = await llmProvider.chat({
                messages: [
                    { role: 'system', content: 'You are a technical product manager. You always output valid JSON arrays. Do not include markdown formatting, backticks or text explanation.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.1 // Low temperature for maximum compliance
            });

            // Clean output in case LLM returns markdown formatting
            let cleanText = responseText.trim();
            if (cleanText.startsWith('```json')) {
                cleanText = cleanText.substring(7);
            }
            if (cleanText.startsWith('```')) {
                cleanText = cleanText.substring(3);
            }
            if (cleanText.endsWith('```')) {
                cleanText = cleanText.substring(0, cleanText.length - 3);
            }
            cleanText = cleanText.trim();

            try {
                const parsed = JSON.parse(cleanText);
                if (Array.isArray(parsed)) {
                    tasks = parsed;
                }
            } catch (jsonErr: any) {
                console.warn('[generateTeamTasks] First parse failed, attempting regex cleanup:', jsonErr.message);
                // Regex cleanup: remove trailing commas
                let fixedText = cleanText.replace(/,(\s*[\]}])/g, '$1');
                // Replace single quoted keys/values with double quotes
                fixedText = fixedText.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"');
                const parsed = JSON.parse(fixedText);
                if (Array.isArray(parsed)) {
                    tasks = parsed;
                }
            }
        } catch (llmErr: any) {
            console.error('[generateTeamTasks] LLM generation/parsing failed, falling back to local milestones:', llmErr.message);
            tasks = getLocalFallbackMilestones(projectName, projectDescription, membersList);
        }

        if (tasks.length === 0) {
            tasks = getLocalFallbackMilestones(projectName, projectDescription, membersList);
        }

        res.json({ tasks });
    } catch (err: any) {
        console.error('[generateTeamTasks] Final catch error, returning fallback:', err.message);
        try {
            const fallbackTasks = getLocalFallbackMilestones(projectName, projectDescription, membersList);
            res.json({ tasks: fallbackTasks });
        } catch (innerErr: any) {
            res.status(500).json({ error: 'Failed to generate milestones: ' + err.message });
        }
    }
}

