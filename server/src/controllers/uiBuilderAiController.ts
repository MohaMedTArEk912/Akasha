import type { Request, Response } from 'express';
import { createHash } from 'node:crypto';
import prisma from '../lib/prisma.js';
import { generateUiBuilderResult, generateUiBuilderStream, type UiBuilderGenerateResult } from '../services/uiBuilderAi.js';
import { normalizeLayoutPlan, type UiBuilderGenerateRequest } from '../services/uiBuilderSchema.js';
import { translateLayoutPlanToBlocks, type BuilderBlock } from '../services/uiBuilderTranslator.js';

const MAX_PROMPT_CHARS = 6000;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function parseGenerateRequest(req: Request, modeOverride?: UiBuilderGenerateRequest['mode']): UiBuilderGenerateRequest {
    const body = isRecord(req.body) ? req.body : {};
    const mode = modeOverride || (typeof body.mode === 'string' ? body.mode : 'create');
    const prompt = typeof body.prompt === 'string' ? body.prompt.slice(0, MAX_PROMPT_CHARS) : '';
    const projectId = typeof body.projectId === 'string' ? body.projectId : '';
    const pageId = typeof body.pageId === 'string' ? body.pageId : undefined;
    const context = isRecord(body.context) ? body.context : undefined;

    return {
        projectId,
        pageId,
        mode: mode as UiBuilderGenerateRequest['mode'],
        prompt,
        context: context as UiBuilderGenerateRequest['context'],
    };
}

function normalizeIncomingBlocks(value: unknown): BuilderBlock[] {
    if (!Array.isArray(value)) return [];

    const normalized: BuilderBlock[] = [];

    for (const item of value) {
        if (!isRecord(item)) continue;
        const id = typeof item.id === 'string' ? item.id : '';
        const blockType = typeof item.block_type === 'string' ? item.block_type : '';
        const name = typeof item.name === 'string' ? item.name : blockType || 'Block';
        if (!id || !blockType) continue;

        const block: BuilderBlock = {
            id,
            block_type: blockType,
            name,
            order: typeof item.order === 'number' ? item.order : 0,
            properties: isRecord(item.properties) ? item.properties : {},
            styles: isRecord(item.styles) ? item.styles as Record<string, string | number | boolean> : {},
            responsive_styles: isRecord(item.responsive_styles)
                ? item.responsive_styles as Record<string, Record<string, string | number | boolean>>
                : {},
            bindings: isRecord(item.bindings) ? item.bindings as Record<string, { type: string; value: unknown }> : {},
            event_handlers: Array.isArray(item.event_handlers) ? item.event_handlers as Array<{ event: string; logic_flow_id: string }> : [],
            archived: Boolean(item.archived),
            children: Array.isArray(item.children) ? item.children.filter((child): child is string => typeof child === 'string') : [],
            classes: Array.isArray(item.classes) ? item.classes.filter((cls): cls is string => typeof cls === 'string') : [],
        };

        if (typeof item.parent_id === 'string') block.parent_id = item.parent_id;
        if (typeof item.page_id === 'string') block.page_id = item.page_id;
        if (typeof item.slot === 'string') block.slot = item.slot;
        if (typeof item.component_id === 'string') block.component_id = item.component_id;

        normalized.push(block);
    }

    return normalized;
}

async function syncBlocksForPublicPageId(pageId: string, blocks: BuilderBlock[]): Promise<{ applied: boolean; hash: string }> {
    const page = await prisma.page.findUnique({
        where: { id: pageId },
        select: { id: true, idRoot: true, projectId: true, meta: true },
    });

    if (!page) {
        throw new Error('Page not found');
    }

    const meta = (() => {
        try {
            return JSON.parse(page.meta || '{}') as Record<string, unknown>;
        } catch {
            return {} as Record<string, unknown>;
        }
    })();

    const rootBlock = blocks.find((block) => !block.parent_id) ?? blocks[0];
    const applyHash = createHash('sha256')
        .update(JSON.stringify({ pageId, blocks }))
        .digest('hex');

    if (meta.ai_last_apply_hash === applyHash) {
        return { applied: false, hash: applyHash };
    }

    await prisma.$transaction(async (tx) => {
        await tx.block.deleteMany({ where: { pageId: page.idRoot } });

        await Promise.all(
            blocks.map((block, index) =>
                tx.block.create({
                    data: {
                        id: block.id,
                        projectId: page.projectId,
                        pageId: page.idRoot,
                        parentId: block.parent_id || null,
                        blockType: block.block_type,
                        name: block.name,
                        properties: JSON.stringify(block.properties || {}),
                        styles: JSON.stringify(block.styles || {}),
                        responsiveStyles: JSON.stringify(block.responsive_styles || {}),
                        classes: JSON.stringify(block.classes || []),
                        events: JSON.stringify(block.event_handlers || []),
                        bindings: JSON.stringify(block.bindings || {}),
                        children: JSON.stringify(block.children || []),
                        order: index,
                        archived: false,
                    },
                })
            ),
        );

        await tx.page.update({
            where: { id: page.id },
            data: {
                meta: JSON.stringify({
                    ...meta,
                    root_block_id: rootBlock?.id,
                    ai_last_apply_hash: applyHash,
                }),
            },
        });
    });

    return { applied: true, hash: applyHash };
}

export async function generate(req: Request, res: Response) {
    try {
        const payload = parseGenerateRequest(req);
        if (!payload.projectId) {
            return res.status(400).json({ error: 'projectId is required' });
        }

        const result = await generateUiBuilderResult(payload);
        res.json(result);
    } catch (error: any) {
        console.error('UI builder generate error:', error);
        res.status(500).json({ error: error?.message || 'Failed to generate UI builder output' });
    }
}

export async function analyze(req: Request, res: Response) {
    try {
        const payload = parseGenerateRequest(req, 'analyze');
        if (!payload.projectId) {
            return res.status(400).json({ error: 'projectId is required' });
        }

        const result = await generateUiBuilderResult(payload);
        res.json(result);
    } catch (error: any) {
        console.error('UI builder analyze error:', error);
        res.status(500).json({ error: error?.message || 'Failed to analyze UI builder state' });
    }
}

export async function apply(req: Request, res: Response) {
    try {
        const body = isRecord(req.body) ? req.body : {};
        const pageId = typeof body.pageId === 'string' ? body.pageId : '';
        if (!pageId) {
            return res.status(400).json({ error: 'pageId is required' });
        }

        let blocks = normalizeIncomingBlocks(body.blocks);

        if (blocks.length === 0 && isRecord(body.layout_plan)) {
            const layoutPlan = normalizeLayoutPlan(body.layout_plan);
            if (!layoutPlan) {
                return res.status(400).json({ error: 'layout_plan is invalid' });
            }

            const page = await prisma.page.findUnique({
                where: { id: pageId },
                select: { id: true, meta: true, blocks: { where: { parentId: null }, select: { id: true } } },
            });

            if (!page) {
                return res.status(404).json({ error: 'Page not found' });
            }

            const meta = (() => {
                try {
                    return JSON.parse(page.meta || '{}') as Record<string, unknown>;
                } catch {
                    return {} as Record<string, unknown>;
                }
            })();

            const rootBlockId = typeof meta.root_block_id === 'string'
                ? meta.root_block_id
                : page.blocks[0]?.id;

            if (!rootBlockId) {
                return res.status(400).json({ error: 'Page has no root block id' });
            }

            blocks = translateLayoutPlanToBlocks(layoutPlan, { pageId, rootBlockId });
        }

        if (blocks.length === 0) {
            return res.status(400).json({ error: 'No blocks provided for apply' });
        }

        const sync = await syncBlocksForPublicPageId(pageId, blocks);
        res.json({
            success: true,
            pageId,
            blockCount: blocks.length,
            skipped: !sync.applied,
            apply_hash: sync.hash,
        });
    } catch (error: any) {
        console.error('UI builder apply error:', error);
        res.status(500).json({ error: error?.message || 'Failed to apply generated layout' });
    }
}

export async function stream(req: Request, res: Response) {
    const payload = parseGenerateRequest(req);

    if (!payload.projectId) {
        res.status(400).json({ error: 'projectId is required' });
        return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const sendEvent = (event: string, data: unknown) => {
        if (res.writableEnded) return;
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    let closed = false;
    req.on('close', () => {
        closed = true;
    });

    const heartbeat = setInterval(() => {
        if (closed || res.writableEnded) return;
        sendEvent('heartbeat', { ts: Date.now() });
    }, 10000);

    try {
        const gen = generateUiBuilderStream(payload);
        let result: UiBuilderGenerateResult | null = null;

        // Consume token chunks from the generator
        while (true) {
            const step = await gen.next();
            if (step.done) {
                result = step.value as UiBuilderGenerateResult;
                break;
            }
            if (closed) {
                // Client disconnected — cancel the generator cleanly
                await gen.return(undefined as unknown as UiBuilderGenerateResult);
                break;
            }
            sendEvent('token', { text: step.value });
        }

        if (!closed && result) {
            sendEvent('result', result);
            sendEvent('done', { success: true });
        }
    } catch (error: any) {
        if (!closed) {
            sendEvent('error', { message: error?.message || 'Failed to stream UI builder output' });
        }
    } finally {
        clearInterval(heartbeat);
        if (!res.writableEnded) {
            res.end();
        }
    }
}
