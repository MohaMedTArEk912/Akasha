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
                await prisma.$transaction([
                    prisma.teamMember.create({ data: { teamId: team.id, sessionId: userSessionId, username: request.username, role: 'member' } }),
                    prisma.joinRequest.delete({ where: { id: request.id } })
                ]);
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

export async function analyzeIdea(req: Request, res: Response) {
    const { idea } = req.body;
    if (!idea || typeof idea !== 'string') {
        return res.status(400).json({ error: 'Valid idea string is required' });
    }

    try {
        const systemPrompt = `You are an elite startup mentor, product manager, and technical architect.
Analyze the following project idea. Return ONLY valid JSON. No markdown, no code fences, no extra text.
Keep answers concise to avoid token overflow:
- summary: max 25 words
- strengths/weaknesses/questions/suggestions: 4 items each, each item max 14 words
{
  "score": <number 0-100 evaluating viability and clarity>,
  "summary": "<one sentence clear summary of the core value proposition>",
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>", "<strength 4>"],
  "weaknesses": ["<potential pitfall 1>", "<weakness 2>", "<weakness 3>", "<weakness 4>"],
  "questions": ["<clarifying question 1>", "<clarifying question 2>", "<clarifying question 3>", "<clarifying question 4>"],
  "suggestions": ["<actionable suggestion 1>", "<actionable suggestion 2>", "<actionable suggestion 3>", "<actionable suggestion 4>"]
}`;

        const normalizeList = (value: unknown): string[] =>
            Array.isArray(value)
                ? value
                    .filter((item) => typeof item === 'string')
                    .map((item) => item.trim())
                    .filter(Boolean)
                    .slice(0, 4)
                : [];

        const parseJsonFromModelOutput = (modelOutput: string) => {
            let rawJson = modelOutput || '{}';
            const startIdx = rawJson.indexOf('{');
            const endIdx = rawJson.lastIndexOf('}');
            if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
                rawJson = rawJson.substring(startIdx, endIdx + 1);
            }
            return JSON.parse(rawJson);
        };

        const llmProvider = getLLMProvider();
        const response = await llmProvider.chat({
            model: 'google/gemini-2.5-flash',
            temperature: 0.2,
            max_tokens: 1200,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: idea }
            ]
        });

        const parsed = parseJsonFromModelOutput(response);
        const scoreNum = Number(parsed?.score);
        const safeScore = Number.isFinite(scoreNum)
            ? Math.max(0, Math.min(100, Math.round(scoreNum)))
            : 0;

        return res.json({
            score: safeScore,
            summary: typeof parsed?.summary === 'string' ? parsed.summary : '',
            strengths: normalizeList(parsed?.strengths),
            weaknesses: normalizeList(parsed?.weaknesses),
            questions: normalizeList(parsed?.questions),
            suggestions: normalizeList(parsed?.suggestions)
        });
    } catch (err: any) {
        console.error('Idea analysis error:', err.message);
        res.status(500).json({ error: 'Failed to analyze idea. ' + err.message });
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

export async function refineIdea(req: Request, res: Response) {
    const { idea, history, projectId } = req.body;
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

        messages.push({ role: 'user', content: 'Generate the final PRD JSON now.' });

        const llmProvider = getLLMProvider();
        const modelOutput = await llmProvider.chat({
            model: 'google/gemini-2.5-pro',
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
