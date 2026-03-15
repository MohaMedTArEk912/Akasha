import type { Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { getLLMProvider } from '../lib/llmProvider.js';

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
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
        throw new Error('No JSON object found in model output');
    }
    return text.slice(start, end + 1);
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
            .map((item, index) => {
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

async function getStructuredChatResponse(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options?: { model?: string; temperature?: number; max_tokens?: number }
): Promise<StructuredChatResponse> {
    const llmProvider = getLLMProvider();
    const modelOutput = await llmProvider.chat({
        model: options?.model || 'google/gemma-3-4b-it:free',
        temperature: options?.temperature ?? 0.3,
        max_tokens: options?.max_tokens,
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
        const structured = await getStructuredChatResponse(chatHistory, {
            model: 'google/gemma-3-4b-it:free',
            temperature: 0.3,
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
        const newIdea = await prisma.teamIdea.create({ data: { teamId: member.teamId, username: member.username, content: idea } });
        res.json({ ...newIdea, idea, evaluation: null });

        // Background AI Evaluation
        try {
            const prompt = `You are a professional innovation evaluator.\nEvaluate the startup idea for Feasibility (1-10), Innovation (1-10), MarketPotential (1-10).\nRespond ONLY in JSON matching this structure exactly (no markdown formatting, no comments):\n{\n  "feasibility": 8,\n  "innovation": 7,\n  "marketPotential": 9,\n  "overallScore": 8.0,\n  "strengths": ["point1", "point2"],\n  "weaknesses": ["point1", "point2"],\n  "summary": "short paragraph",\n  "recommendedNextSteps": ["step1", "step2", "step3"]\n}\n\nSTARTUP IDEA TO EVALUATE:\n${idea}`;
            const llmProvider = getLLMProvider();
            const response = await llmProvider.chat({
                model: 'google/gemma-3-4b-it:free',
                temperature: 0.2,
                messages: [{ role: 'user', content: prompt }]
            });
            let rawJson = response.trim() || "{}";
            if (rawJson.startsWith('```json')) rawJson = rawJson.replace(/```json/g, '').replace(/```/g, '').trim();
            if (rawJson.startsWith('```')) rawJson = rawJson.replace(/```/g, '').trim();
            const evaluation = JSON.parse(rawJson);
            await prisma.teamIdea.update({ where: { id: newIdea.id }, data: { evaluation: JSON.stringify(evaluation) } });
        } catch (err: any) { console.error('Evaluation generated error:', err.message); }
    } catch (err: any) { res.status(500).json({ error: err.message }); }
}

// --- Simple Chat (from merged server.js) ---

export async function simpleChat(req: Request, res: Response) {
    const { message } = req.body;
    if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Invalid message' });
    }
    try {
        const structured = await getStructuredChatResponse([
            { role: 'user', content: message }
        ], {
            model: 'google/gemma-3-4b-it:free',
            temperature: 0.3,
        });
        res.json({ reply: structured.answer_markdown, response: structured });
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

        const structured = await getStructuredChatResponse(messages, {
            model: 'google/gemma-3-4b-it:free',
            temperature: 0.4,
        });

        res.json({ reply: structured.answer_markdown, response: structured, projectName: project.name });
    } catch (err: any) {
        console.error('Project chat error:', err.message);
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
    const { idea } = req.body;
    if (!idea || typeof idea !== 'string') {
        return res.status(400).json({ error: 'Valid idea string is required' });
    }

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
      "user_comment": "",
      "integrated_summary": ""
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

        const parseJsonFromModelOutput = async (modelOutput: string) => {
            const rawJson = extractJsonObject(modelOutput || '{}');
            try {
                return JSON.parse(rawJson);
            } catch {
                // If the model returns near-valid JSON (missing comma/trailing issue),
                // ask for a strict JSON repair pass before giving up.
                const repaired = await llmProvider.chat({
                    model: 'google/gemma-3-4b-it:free',
                    temperature: 0,
                    max_tokens: 3000,
                    messages: [
                        {
                            role: 'system',
                            content: 'You repair malformed JSON. Return ONLY valid JSON with the same keys and values. Do not add markdown fences or commentary.'
                        },
                        {
                            role: 'user',
                            content: rawJson
                        }
                    ]
                });

                const repairedJson = extractJsonObject(repaired || rawJson);
                return JSON.parse(repairedJson);
            }
        };

        const response = await llmProvider.chat({
            model: 'google/gemini-2.5-flash',
            temperature: 0.2,
            max_tokens: 2600,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: idea }
            ]
        });

        let parsed: any = null;
        try {
            parsed = await parseJsonFromModelOutput(response);
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
    const { idea, feature, structuredConcept, action, feedback, approvedFeatures, rejectedFeatures } = req.body;
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

        const systemPrompt = `You are an elite product manager running an interactive feature refinement queue.
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
    "integrated_summary": "string"
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

        const llmProvider = getLLMProvider();
        const modelOutput = await llmProvider.chat({
            model: 'google/gemma-3-4b-it:free',
            temperature: 0.2,
            max_tokens: 2400,
            messages: [
                { role: 'system', content: systemPrompt },
                {
                    role: 'user',
                    content: JSON.stringify({
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

        const parsed = JSON.parse(extractJsonObject(modelOutput));
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
    const { idea, history, projectId, structuredConcept, featureQueue, understanding } = req.body;
    if (!idea || typeof idea !== 'string' || !idea.trim()) {
        return res.status(400).json({ error: 'Original idea is required' });
    }

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
            model: 'google/gemma-3-4b-it:free',
            temperature: 0.3,
            max_tokens: 2200,
            messages
        });

        if (!modelOutput || modelOutput.trim().length === 0) {
            throw new Error('Empty refinement response from AI model');
        }

        let refinedDoc: RefinedIdeaDocument;
        try {
            const jsonText = extractJsonObject(modelOutput);
            const parsed = JSON.parse(jsonText);
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
