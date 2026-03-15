import type { Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { randomUUID } from 'crypto';

function parseJsonValue<T>(value: unknown, fallback: T): T {
    if (typeof value !== 'string') {
        return (value as T) ?? fallback;
    }

    try {
        return JSON.parse(value) as T;
    } catch {
        return fallback;
    }
}

function toPageSchema(page: any, blocks: any[] = []) {
    const meta = parseJsonValue<Record<string, unknown>>(page.meta, {});
    const inferredRootBlockId = typeof meta.root_block_id === 'string' && meta.root_block_id
        ? meta.root_block_id
        : blocks.find((block) => String(block.pageId) === String(page.idRoot) && !block.parentId && !block.archived)?.id;

    return {
        id: page.id,
        name: page.name,
        path: page.path,
        root_block_id: inferredRootBlockId,
        is_dynamic: page.isDynamic || false,
        meta,
        archived: page.archived || false,
    };
}

// Transform Prisma project to client-expected snake_case format
function toProjectSchema(p: any, pages: any[] = [], blocks: any[] = []) {
    const serializedPages = (pages || []).map((pg: any) => toPageSchema(pg, blocks));
    const pageIdByInternalId = new Map<string, string>();

    for (const pg of pages || []) {
        if (pg.idRoot && pg.id) {
            pageIdByInternalId.set(String(pg.idRoot), String(pg.id));
        }
    }

    return {
        id: p.id,
        name: p.name,
        description: p.description || '',
        created_at: (p.createdAt instanceof Date ? p.createdAt : new Date(p.createdAt)).toISOString(),
        updated_at: (p.updatedAt instanceof Date ? p.updatedAt : new Date(p.updatedAt)).toISOString(),
        root_path: p.rootPath || '',
        version: '1.0.0',
        settings: parseJsonValue<Record<string, unknown>>(p.settings, {}),
        blocks: blocks.map((b: any) => ({
            id: b.id,
            block_type: b.blockType,
            name: b.name,
            properties: parseJsonValue<Record<string, unknown>>(b.properties, {}),
            styles: parseJsonValue<Record<string, string | number | boolean>>(b.styles, {}),
            responsive_styles: parseJsonValue<Record<string, Record<string, string | number | boolean>>>(b.responsiveStyles, {}),
            classes: parseJsonValue<string[]>(b.classes, []),
            event_handlers: parseJsonValue<any[]>(b.events, []),
            bindings: parseJsonValue<Record<string, unknown>>(b.bindings, {}),
            children: parseJsonValue<string[]>(b.children, []),
            parent_id: b.parentId || null,
            page_id: b.pageId ? pageIdByInternalId.get(String(b.pageId)) || null : null,
            order: b.order || 0,
            archived: b.archived || false,
        })),
        pages: serializedPages,
        apis: [],
        logic_flows: [],
        data_models: [],
        variables: [],
        components: [],
    };
}

export async function listProjects(req: Request, res: Response) {
    try {
        const projects = await prisma.project.findMany({
            orderBy: { updatedAt: 'desc' }
        });
        res.json(projects);
    } catch (error) {
        console.error('Error listing projects:', error);
        res.status(500).json({ error: 'Failed to list projects' });
    }
}

export async function getProject(req: Request, res: Response) {
    try {
        const { id } = req.params;
        const project = await prisma.project.findUnique({
            where: { id: id as string },
            include: { pages: true, blocks: true }
        });

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        res.json(toProjectSchema(project, project.pages, project.blocks));
    } catch (error) {
        console.error('Error getting project:', error);
        res.status(500).json({ error: 'Failed to get project' });
    }
}

export async function createProject(req: Request, res: Response) {
    try {
        const { name, description } = req.body;
        const project = await prisma.project.create({
            data: {
                name,
                description,
                settings: JSON.stringify({
                    theme: { primary_color: '#3b82f6' }
                })
            }
        });

        // Prisma requires explicit ObjectID referencing for relations on MongoDB
        // but simple scalar assignment usually doesn't trigger a transaction 
        // if we don't use nested 'page: { create: {} }' syntax.
        const homePage = await prisma.page.create({
            data: {
                id: randomUUID(),
                projectId: project.id, // Explicit scalar foreign key
                name: 'Home',
                path: '/',
                isDynamic: false
            }
        });

        const rootBlock = await prisma.block.create({
            data: {
                projectId: project.id,
                pageId: homePage.idRoot,
                parentId: null,
                blockType: 'canvas',
                name: 'Page Root',
                properties: JSON.stringify({}),
                styles: JSON.stringify({}),
                responsiveStyles: JSON.stringify({}),
                classes: JSON.stringify([]),
                events: JSON.stringify([]),
                bindings: JSON.stringify({}),
                children: JSON.stringify([]),
                order: 0,
            }
        });

        const updatedHomePage = await prisma.page.update({
            where: { id: homePage.id },
            data: {
                meta: JSON.stringify({
                    root_block_id: rootBlock.id,
                }),
            }
        });

        res.json(toProjectSchema(project, [updatedHomePage], [rootBlock]));
    } catch (error) {
        console.error('Error creating project:', error);
        res.status(500).json({ error: 'Failed to create project' });
    }
}

export async function updateProject(req: Request, res: Response) {
    try {
        const { id } = req.params;
        const { name, description, settings } = req.body;

        const project = await prisma.project.update({
            where: { id: id as string },
            data: {
                name,
                description,
                ...(settings && { settings: JSON.stringify(settings) })
            },
            include: { pages: true, blocks: true }
        });
        res.json(toProjectSchema(project, project.pages, project.blocks));
    } catch (error) {
        console.error('Error updating project:', error);
        res.status(500).json({ error: 'Failed to update project' });
    }
}

export async function deleteProject(req: Request, res: Response) {
    try {
        const { id } = req.params;
        await prisma.project.delete({ where: { id: id as string } });
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting project:', error);
        res.status(500).json({ error: 'Failed to delete project' });
    }
}

export async function updateProjectIdea(req: Request, res: Response) {
    try {
        const { id } = req.params;
        const { idea } = req.body;

        const project = await prisma.project.update({
            where: { id: id as string },
            data: { description: idea || '' },
            include: { pages: true, blocks: true }
        });
        res.json(toProjectSchema(project, project.pages, project.blocks));
    } catch (error) {
        console.error('Error updating project idea:', error);
        res.status(500).json({ error: 'Failed to update project idea' });
    }
}

import { getLLMProvider } from '../lib/llmProvider.js';

export async function generateStructuredIdea(req: Request, res: Response) {
    try {
        const { id } = req.params;
        
        const project = await prisma.project.findUnique({
            where: { id: id as string }
        });
        
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        
        const rawIdea = req.body.ideaContent || project.description;
        if (!rawIdea || !rawIdea.trim()) {
            return res.status(400).json({ error: 'Project description/idea is empty. Please write an idea first.'});
        }
        
        // Compact schema that fits comfortably within Qwen's output window
        const systemPrompt = `You are a product architect. Analyze the project idea below and return ONLY a valid JSON object — no markdown, no explanation, no trailing commas.

Use this exact structure:
{
  "ideaMetadata": {
    "ideaName": "string",
    "tagline": "string",
    "summary": "string",
    "industry": "string",
    "category": "saas | ai_tool | marketplace | mobile_app | platform",
    "innovationType": "incremental | disruptive | ai_first"
  },
  "problem": {
    "problemStatement": "string",
    "painPoints": ["string", "string", "string"],
    "whoHasThisProblem": ["string", "string"],
    "urgencyLevel": "low | medium | high"
  },
  "solution": {
    "productDescription": "string",
    "coreInnovation": "string",
    "valueProposition": "string",
    "keyBenefits": ["string", "string", "string"]
  },
  "product": {
    "coreFeatures": ["string", "string", "string", "string"],
    "platforms": ["web", "mobile"]
  },
  "targetMarket": {
    "primaryUsers": ["string", "string"],
    "geographicFocus": "string"
  },
  "technicalArchitecture": {
    "frontend": "string",
    "backend": "string",
    "database": "string"
  },
  "mvpPlan": {
    "mvpGoal": "string",
    "mustHaveFeatures": ["string", "string"],
    "developmentTimeEstimate": "string"
  },
  "ideaScore": {
    "marketPotential": "number 1-10",
    "technicalFeasibility": "number 1-10",
    "overallScore": "number 1-10"
  }
}

Fill ALL string values with real content inferred from the project idea. Return ONLY the JSON object, nothing else.`;

        const llmProvider = getLLMProvider();
        // Qwen's /chat API has no 'system' role — merge the system prompt into the user message directly
        const combinedUserMessage = `${systemPrompt}\n\nProject idea:\n${rawIdea}`;
        const modelOutput = await llmProvider.chat({
            model: 'qwen',
            temperature: 0.2,
            max_tokens: 2000,
            messages: [
                { role: 'user', content: combinedUserMessage }
            ]
        });

        let jsonText = modelOutput.trim();
        
        // Strip markdown code fences if present
        jsonText = jsonText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
        
        // Find outermost JSON object, discarding any extra text before/after
        const start = jsonText.indexOf('{');
        const end = jsonText.lastIndexOf('}');
        if (start !== -1 && end !== -1 && end > start) {
            jsonText = jsonText.slice(start, end + 1);
        } else {
            console.error('No valid JSON object found in AI output:', jsonText.slice(0, 200));
            return res.status(500).json({ error: 'AI did not return a valid JSON object.' });
        }

        let structuredIdea;
        try {
            structuredIdea = JSON.parse(jsonText);
        } catch (parseError: any) {
            console.warn('Direct JSON.parse failed. Trying trailing-comma cleanup...');
            try {
                // Fix most common LLM mistake: trailing commas before ] or }
                const cleaned = jsonText.replace(/,(\s*[}\]])/g, '$1');
                structuredIdea = JSON.parse(cleaned);
                console.log('Parsed successfully after trailing-comma cleanup!');
            } catch {
                console.error('All JSON parsing attempts failed.\nRaw AI output (first 500 chars):\n', jsonText.slice(0, 500));
                return res.status(500).json({ 
                    error: 'AI returned invalid JSON that could not be repaired.',
                    details: parseError.message
                });
            }
        }

        // Persist in project settings
        const settings = typeof project.settings === 'string'
            ? JSON.parse(project.settings || '{}')
            : (project.settings || {});
        settings.ideaDetails = structuredIdea;

        const updatedProject = await prisma.project.update({
            where: { id: id as string },
            data: { settings: JSON.stringify(settings) },
            include: { pages: true, blocks: true }
        });

        res.json(toProjectSchema(updatedProject, updatedProject.pages, updatedProject.blocks));

    } catch (error: any) {
        console.error('Error generating structured idea details:', error);
        res.status(500).json({ error: 'Failed to generate structured idea: ' + error.message });
    }
}


