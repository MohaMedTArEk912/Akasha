import prisma from '../lib/prisma.js';
import { getLLMProvider, type LLMCompletionOptions } from '../lib/llmProvider.js';
import {
    clamp,
    extractJsonObject,
    normalizeCompetitorIntel,
    normalizeGuidanceItems,
    normalizeLayoutPlan,
    normalizeQualityDimensions,
    normalizeStringArray,
    normalizeSuggestedPages,
    normalizeThemeDirection,
    normalizeUiBuilderResponse,
    slugifyValue,
    type UiBuilderCompetitorIntel,
    type UiBuilderContextPage,
    type UiBuilderGenerateRequest,
    type UiBuilderGuidanceItem,
    type UiBuilderLayoutPlan,
    type UiBuilderMode,
    type UiBuilderQualityDimension,
    type UiBuilderResponsePayload,
    type UiBuilderSuggestedPage,
    type UiBuilderThemeDirection,
} from './uiBuilderSchema.js';
import { translateLayoutPlanToBlocks, type BuilderBlock } from './uiBuilderTranslator.js';

interface PageRecord {
    id: string;
    idRoot: string;
    name: string;
    path: string;
    archived: boolean;
    meta: string;
    isDynamic: boolean;
}

interface BlockRecord {
    id: string;
    pageId: string | null;
    parentId: string | null;
    blockType: string;
    name: string;
    archived: boolean;
}

interface BuilderPageTarget {
    id: string;
    root_block_id?: string;
    name: string;
    path: string;
}

export interface UiBuilderGenerateResult extends UiBuilderResponsePayload {
    mode: UiBuilderMode;
    provider: string;
    blocks: BuilderBlock[];
    page: BuilderPageTarget | null;
}

const DEFAULT_ALLOWED_BLOCKS = [
    'canvas',
    'section',
    'container',
    'columns',
    'column',
    'grid',
    'heading',
    'paragraph',
    'button',
    'card',
    'image',
    'form',
    'input',
    'textarea',
    'table',
    'accordion',
];

function parseJsonValue<T>(value: string | null | undefined, fallback: T): T {
    if (!value) return fallback;
    try {
        return JSON.parse(value) as T;
    } catch {
        return fallback;
    }
}

function toPublicPages(pages: PageRecord[]): UiBuilderContextPage[] {
    return pages
        .filter((page) => !page.archived)
        .map((page) => ({
            id: page.id,
            name: page.name,
            path: page.path,
        }));
}

function inferPageRootId(page: PageRecord | undefined, blocks: BlockRecord[]): string | undefined {
    if (!page) return undefined;

    const meta = parseJsonValue<Record<string, unknown>>(page.meta, {});
    if (typeof meta.root_block_id === 'string' && meta.root_block_id.trim()) {
        return meta.root_block_id.trim();
    }

    const rootBlock = blocks.find((block) => block.pageId === page.idRoot && !block.parentId && !block.archived);
    return rootBlock?.id;
}

function countBlocksForInternalPage(blocks: BlockRecord[], pageInternalId: string | undefined): number {
    if (!pageInternalId) return 0;
    return blocks.filter((block) => block.pageId === pageInternalId && !block.archived).length;
}

function inferSubject(prompt: string, projectName?: string): string {
    const trimmed = prompt.trim();
    if (trimmed) return trimmed;
    if (projectName?.trim()) return projectName.trim();
    return 'this product';
}

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function sanitizeString(value: unknown, maxLength = 800): string | undefined {
    if (typeof value !== 'string') return undefined;
    const compact = value.trim().replace(/\s+/g, ' ');
    if (!compact) return undefined;
    return compact.length > maxLength ? `${compact.slice(0, maxLength)}...` : compact;
}

function compactRecord(record: Record<string, unknown>): Record<string, unknown> | undefined {
    return Object.keys(record).length > 0 ? record : undefined;
}

function normalizeDesignSystemContext(designSystem: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
    if (!designSystem) return undefined;

    const source = asRecord(designSystem);
    const sourceProject = asRecord(source.project);
    const sourceFoundations = asRecord(source.foundations);
    const sourceUx = asRecord(source.ux);

    const project = compactRecord({
        ...(sanitizeString(sourceProject.name, 180) ? { name: sanitizeString(sourceProject.name, 180) } : {}),
        ...(sanitizeString(sourceProject.industry, 180) ? { industry: sanitizeString(sourceProject.industry, 180) } : {}),
        ...(sanitizeString(sourceProject.platform, 60) ? { platform: sanitizeString(sourceProject.platform, 60) } : {}),
        ...(sanitizeString(sourceProject.styleDirection, 220) ? { styleDirection: sanitizeString(sourceProject.styleDirection, 220) } : {}),
    });

    const foundations = compactRecord({
        ...(sanitizeString(sourceFoundations.colorPalette, 260) ? { colorPalette: sanitizeString(sourceFoundations.colorPalette, 260) } : {}),
        ...(sanitizeString(sourceFoundations.typography, 220) ? { typography: sanitizeString(sourceFoundations.typography, 220) } : {}),
        ...(sanitizeString(sourceFoundations.spacingRadius, 200) ? { spacingRadius: sanitizeString(sourceFoundations.spacingRadius, 200) } : {}),
        ...(sanitizeString(sourceFoundations.tone, 200) ? { tone: sanitizeString(sourceFoundations.tone, 200) } : {}),
        ...(sanitizeString(sourceFoundations.brandKeywords, 220) ? { brandKeywords: sanitizeString(sourceFoundations.brandKeywords, 220) } : {}),
    });

    const ux = compactRecord({
        ...(sanitizeString(sourceUx.audience, 260) ? { audience: sanitizeString(sourceUx.audience, 260) } : {}),
        ...(sanitizeString(sourceUx.coreFlows, 400) ? { coreFlows: sanitizeString(sourceUx.coreFlows, 400) } : {}),
        ...(sanitizeString(sourceUx.accessibility, 260) ? { accessibility: sanitizeString(sourceUx.accessibility, 260) } : {}),
        ...(sanitizeString(sourceUx.responsiveRules, 260) ? { responsiveRules: sanitizeString(sourceUx.responsiveRules, 260) } : {}),
        ...(sanitizeString(sourceUx.statesMotion, 260) ? { statesMotion: sanitizeString(sourceUx.statesMotion, 260) } : {}),
    });

    const normalized: Record<string, unknown> = {};
    if (project) normalized.project = project;
    if (foundations) normalized.foundations = foundations;
    if (ux) normalized.ux = ux;

    const components = sanitizeString(source.components, 400);
    if (components) normalized.components = components;

    const vision = sanitizeString(source.vision, 400);
    if (vision) normalized.vision = vision;

    return compactRecord(normalized);
}

function stringifyDesignSystem(designSystem: Record<string, unknown> | undefined): string {
    if (!designSystem) return 'Not provided';
    try {
        const project = (designSystem.project && typeof designSystem.project === 'object')
            ? (designSystem.project as Record<string, unknown>)
            : {};
        const foundations = (designSystem.foundations && typeof designSystem.foundations === 'object')
            ? (designSystem.foundations as Record<string, unknown>)
            : {};
        const ux = (designSystem.ux && typeof designSystem.ux === 'object')
            ? (designSystem.ux as Record<string, unknown>)
            : {};

        const snippets = [
            typeof project.name === 'string' ? `name:${project.name}` : null,
            typeof project.industry === 'string' ? `industry:${project.industry}` : null,
            typeof project.platform === 'string' ? `platform:${project.platform}` : null,
            typeof project.styleDirection === 'string' ? `style:${project.styleDirection}` : null,
            typeof foundations.colorPalette === 'string' ? `palette:${foundations.colorPalette}` : null,
            typeof foundations.typography === 'string' ? `typography:${foundations.typography}` : null,
            typeof foundations.spacingRadius === 'string' ? `spacing:${foundations.spacingRadius}` : null,
            typeof foundations.tone === 'string' ? `tone:${foundations.tone}` : null,
            typeof ux.audience === 'string' ? `audience:${ux.audience}` : null,
            typeof ux.coreFlows === 'string' ? `flows:${ux.coreFlows}` : null,
            typeof ux.accessibility === 'string' ? `a11y:${ux.accessibility}` : null,
            typeof ux.responsiveRules === 'string' ? `responsive:${ux.responsiveRules}` : null,
            typeof designSystem.components === 'string' ? `components:${designSystem.components}` : null,
            typeof designSystem.vision === 'string' ? `vision:${designSystem.vision}` : null,
        ].filter((part): part is string => Boolean(part));

        if (snippets.length === 0) return 'Not provided';

        const compact = snippets.join(' | ');
        return compact.length > 3000 ? `${compact.slice(0, 3000)}...` : compact;
    } catch {
        return 'Not provided';
    }
}

function extractPrimaryColorFromDesignSystem(designSystem: Record<string, unknown> | undefined): string | undefined {
    if (!designSystem) return undefined;
    const foundations = designSystem.foundations;
    if (!foundations || typeof foundations !== 'object') return undefined;
    const palette = (foundations as Record<string, unknown>).colorPalette;
    if (typeof palette !== 'string') return undefined;
    const match = palette.match(/#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/);
    return match?.[0];
}

function hasNamedPage(pages: UiBuilderContextPage[], keywords: string[]): boolean {
    return pages.some((page) => {
        const haystack = `${page.name} ${page.path}`.toLowerCase();
        return keywords.some((keyword) => haystack.includes(keyword));
    });
}

function buildFallbackTheme(seed: string, primaryColor?: string): UiBuilderThemeDirection {
    return normalizeThemeDirection(
        /(finance|payment|wallet|trading|fintech)/i.test(seed)
            ? {
                theme: 'Market Pulse',
                metaphor: 'A disciplined trading desk with obvious signal lanes',
                motion: 'Short confidence pulses and crisp panel reveals',
                typography: 'Space Grotesk with IBM Plex Sans',
                note: 'Make trust and action velocity visible at first glance.',
                palette: [primaryColor || '#14b8a6', '#0f172a', '#134e4a', '#f59e0b'],
            }
            : /(health|care|clinic|medical|wellness)/i.test(seed)
                ? {
                    theme: 'Quiet Vitality',
                    metaphor: 'A guided path with precise checkpoints',
                    motion: 'Measured fades and calm upward movement',
                    typography: 'Sora with Source Sans 3',
                    note: 'Optimize for calm confidence and plain-language tasks.',
                    palette: [primaryColor || '#22c55e', '#083344', '#ecfeff', '#0f766e'],
                }
                : {
                    theme: 'Signal Studio',
                    metaphor: 'A control room where important product state stays obvious',
                    motion: 'Pane transitions, staggered cards, and deliberate progress traces',
                    typography: 'Space Grotesk with IBM Plex Sans',
                    note: 'Bias toward hierarchy and system-state visibility over ornament.',
                    palette: [primaryColor || '#06b6d4', '#111827', '#1d4ed8', '#f97316'],
                },
        primaryColor ? [primaryColor, '#111827', '#f97316'] : undefined,
    );
}

function buildFallbackCompetitorIntel(subject: string, pages: UiBuilderContextPage[]): UiBuilderCompetitorIntel {
    if (/(developer|api|saas|workspace|ai)/i.test(subject)) {
        return {
            patterns: [
                'Dense sidebars with command-first navigation',
                'Setup flows optimized for power users, not new users',
                'Usage and billing surfaced near system status',
            ],
            strengths: [
                'Fast navigation for experienced users',
                'Operational state is often explicit',
            ],
            weaknesses: [
                'First-run guidance is often weak',
                'Visual hierarchy collapses under too many neutral surfaces',
            ],
            differentiation: [
                'Keep power-user speed while adding a guided first-success path',
                'Separate build, review, and ship moments visually',
            ],
        };
    }

    return {
        patterns: [
            'Top-heavy hero sections with card-based follow-up content',
            'Search and quick actions near the top of the page',
            'Feature education hidden in secondary surfaces',
        ],
        strengths: [
            'Familiar structure lowers initial learning cost',
            'Card layouts scale well as products grow',
        ],
        weaknesses: [
            'Many products feel interchangeable after the first fold',
            'Empty states rarely teach the user what matters next',
        ],
        differentiation: [
            'Give the first screen a stronger point of view',
            pages.length < 4
                ? 'Expand the page flow so value is visible end to end'
                : 'Use the broader page set to tell a more outcome-driven story',
        ],
    };
}

function buildFallbackQuality(
    pages: UiBuilderContextPage[],
    selectedPage: BuilderPageTarget | null,
    selectedPageBlockCount: number,
    viewport: string,
    hasThemeTokens: boolean,
): UiBuilderQualityDimension[] {
    const hasLanding = hasNamedPage(pages, ['home', 'landing', 'hero']);
    const hasDashboard = hasNamedPage(pages, ['dashboard', 'overview', 'workspace']);
    const hasSettings = hasNamedPage(pages, ['settings', 'profile', 'account']);
    const hasPricing = hasNamedPage(pages, ['pricing', 'plan', 'billing']);

    return [
        {
            key: 'clarity',
            label: 'UX clarity',
            score: clamp(42 + pages.length * 7 + (selectedPage ? 8 : 0) + (selectedPageBlockCount >= 5 ? 14 : 0), 28, 96),
            note: selectedPage
                ? `${selectedPage.name} currently has ${selectedPageBlockCount} blocks driving the visible narrative.`
                : 'Select a page to score the current journey more precisely.',
        },
        {
            key: 'accessibility',
            label: 'Accessibility',
            score: clamp(52 + (hasThemeTokens ? 8 : 0) + (hasSettings ? 6 : 0), 34, 92),
            note: hasThemeTokens
                ? 'Theme tokens exist, so consistent contrast rules are easier to apply.'
                : 'Theme tokens are still weak, so accessibility guardrails are loose.',
        },
        {
            key: 'hierarchy',
            label: 'Visual hierarchy',
            score: clamp(36 + selectedPageBlockCount * 8 + (hasDashboard ? 10 : 0), 24, 95),
            note: hasDashboard
                ? 'The information architecture exists, but spacing rhythm still needs refinement.'
                : 'The product still needs a stronger anchor page.',
        },
        {
            key: 'responsive',
            label: 'Responsiveness',
            score: clamp(46 + (viewport === 'desktop' ? 8 : 4) + (pages.length > 2 ? 8 : 0), 30, 91),
            note: `Current builder context is ${viewport}; validate tablet and mobile before export.`,
        },
        {
            key: 'conversion',
            label: 'Conversion',
            score: clamp(34 + (hasLanding ? 14 : 0) + (hasPricing ? 12 : 0), 22, 93),
            note: hasLanding || hasPricing
                ? 'The product has visible acquisition or decision moments.'
                : 'The current flow lacks a strong acquisition or decision screen.',
        },
    ];
}

function buildSuggestedPages(pages: UiBuilderContextPage[]): UiBuilderSuggestedPage[] {
    const suggestions: UiBuilderSuggestedPage[] = [];

    if (!hasNamedPage(pages, ['home', 'landing'])) {
        suggestions.push({ name: 'Home', path: '/', reason: 'Frame the product promise before deeper workflows.' });
    }
    if (!hasNamedPage(pages, ['dashboard', 'overview', 'workspace'])) {
        suggestions.push({ name: 'Dashboard', path: '/dashboard', reason: 'Give users a stable operating view after setup.' });
    }
    if (!hasNamedPage(pages, ['settings', 'profile', 'account'])) {
        suggestions.push({ name: 'Settings', path: '/settings', reason: 'Expose trust, preferences, and long-term controls.' });
    }
    if (!hasNamedPage(pages, ['pricing', 'billing', 'plan'])) {
        suggestions.push({ name: 'Pricing', path: '/pricing', reason: 'Create a visible conversion moment.' });
    }

    return suggestions.slice(0, 4);
}

function buildFallbackGuidance(
    pages: UiBuilderContextPage[],
    selectedPage: BuilderPageTarget | null,
    selectedPageBlockCount: number,
): UiBuilderGuidanceItem[] {
    const suggestions = buildSuggestedPages(pages);
    const items: UiBuilderGuidanceItem[] = suggestions.map((page, index) => ({
        id: `guidance-create-${slugifyValue(page.name) || index + 1}`,
        title: `Add ${page.name}`,
        description: page.reason,
        impact: index === 0 ? 'High leverage' : 'Improves flow completeness',
        action_label: `Create ${page.name}`,
        action_type: 'create-page',
        action_value: page.name,
    }));

    if (selectedPage && selectedPageBlockCount < 4) {
        items.push({
            id: `guidance-refine-${selectedPage.id}`,
            title: `Strengthen ${selectedPage.name}`,
            description: 'The selected page needs more deliberate content grouping and CTA emphasis.',
            impact: 'Improves scanability',
            action_label: 'Open Inspector',
            action_type: 'open-inspector',
        });
    }

    items.push({
        id: 'guidance-apply-layout',
        title: 'Generate and preview a stronger layout',
        description: 'Use the current prompt to replace guesswork with a structured layout draft.',
        impact: 'Direct builder output',
        action_label: 'Preview layout',
        action_type: 'apply-layout',
    });

    return items.slice(0, 5);
}

function buildFallbackLayoutPlan(mode: UiBuilderMode, prompt: string, pageName?: string): UiBuilderLayoutPlan | null {
    if (mode === 'ask' || mode === 'compete') {
        return null;
    }

    const text = prompt.toLowerCase();
    const resolvedPageName = pageName || 'Generated Page';

    if (/(login|sign in|auth|authentication|register|signup)/i.test(text)) {
        return {
            page_name: resolvedPageName,
            page_purpose: 'Guide users through authentication with minimal friction.',
            sections: [
                { type: 'hero', title: 'Welcome back', description: 'Use a concise trust-building intro before the form.', items: ['Fast access', 'Clear trust signal'], columns: 2, cta_label: 'Sign in', media: 'image', emphasis: 'balanced' },
                { type: 'form', title: 'Access your workspace', description: 'Keep the form direct and reduce optional choices.', items: ['Email address', 'Password', 'Message'], columns: 1, cta_label: 'Continue', emphasis: 'compact' },
                { type: 'content', title: 'Why teams use this', description: 'Reinforce confidence with product proof.', items: ['Reliable sync', 'Secure access', 'Faster reviews'], columns: 3, emphasis: 'compact' },
            ],
        };
    }

    if (/(pricing|plans|billing)/i.test(text)) {
        return {
            page_name: resolvedPageName,
            page_purpose: 'Help buyers compare plans and move toward a decision quickly.',
            sections: [
                { type: 'hero', title: 'Pick the plan that fits your team', description: 'Frame the decision around outcomes instead of line items.', items: ['Clear tiers', 'Short decision path'], columns: 2, cta_label: 'Compare plans', media: 'chart', emphasis: 'primary' },
                { type: 'pricing', title: 'Plans', description: 'Make scope, differentiation, and CTA hierarchy obvious.', items: ['Starter', 'Growth', 'Scale'], columns: 3, cta_label: 'Start free', emphasis: 'balanced' },
                { type: 'faq', title: 'Questions buyers ask before committing', description: 'Reduce hesitation with operational clarity.', items: ['What changes between plans?', 'How fast can we onboard?', 'What support is included?'], columns: 1, emphasis: 'compact' },
                { type: 'cta', title: 'Move into trial with confidence', description: 'Keep the final step direct and low-friction.', items: ['Start free'], columns: 1, cta_label: 'Start free', emphasis: 'compact' },
            ],
        };
    }

    if (/(dashboard|analytics|metrics|workspace|control panel)/i.test(text)) {
        return {
            page_name: resolvedPageName,
            page_purpose: 'Give users an immediate operating view across signal, action, and recent activity.',
            sections: [
                { type: 'hero', title: 'Run the product from one control surface', description: 'Anchor the page around the clearest signal and first action.', items: ['Live overview', 'Daily focus'], columns: 2, cta_label: 'Review metrics', media: 'chart', emphasis: 'primary' },
                { type: 'stats', title: 'Key metrics', description: 'Surface the three to four numbers that shape today’s decisions.', items: ['Revenue', 'Conversion', 'Active users', 'Alerts'], columns: 4, emphasis: 'compact' },
                { type: 'activity', title: 'Recent activity', description: 'Show the latest events, approvals, or changes that need attention.', items: ['Approvals', 'Alerts', 'Recent changes'], columns: 3, emphasis: 'balanced' },
                { type: 'table', title: 'Detailed performance', description: 'Back summary cards with a deeper operational table.', items: ['Revenue', 'Retention', 'Latency'], columns: 1, emphasis: 'balanced' },
                { type: 'cta', title: 'Push the next action forward', description: 'End with one clear operational next step.', items: ['Create report'], columns: 1, cta_label: 'Create report', emphasis: 'compact' },
            ],
        };
    }

    return {
        page_name: resolvedPageName,
        page_purpose: 'Introduce the product clearly and move the user toward the first meaningful action.',
        sections: [
            { type: 'hero', title: resolvedPageName, description: 'Lead with a strong promise, plain-language value, and a visible CTA.', items: ['Clear narrative', 'Primary action'], columns: 2, cta_label: 'Get started', media: 'image', emphasis: 'primary' },
            { type: 'features', title: 'Core benefits', description: 'Translate capabilities into outcomes users can scan quickly.', items: ['Fast setup', 'Operational clarity', 'Confident execution'], columns: 3, emphasis: 'balanced' },
            { type: 'stats', title: 'Proof points', description: 'Give the product evidence, not just claims.', items: ['Activation', 'Time saved', 'User trust'], columns: 3, emphasis: 'compact' },
            { type: 'cta', title: 'Move to the next step', description: 'Finish the page with one focused action.', items: ['Start building'], columns: 1, cta_label: 'Start building', emphasis: 'compact' },
        ],
    };
}

function buildFallbackAnswer(mode: UiBuilderMode, subject: string, selectedPageName?: string): string {
    switch (mode) {
        case 'edit':
            return `Refine **${selectedPageName || 'the selected page'}** by tightening hierarchy, reducing neutral filler, and making the primary action more obvious.`;
        case 'suggest':
            return `The next best move for **${subject}** is to close the biggest flow gap first, then tighten the visual hierarchy on the current page.`;
        case 'ask':
            return `Use the builder to keep the first screen outcome-focused: one promise, one primary action, and one proof cluster.`;
        case 'analyze':
            return `The current design direction is functional, but it still needs stronger hierarchy, clearer conversion moments, and more visible system state.`;
        case 'compete':
            return `Differentiate **${subject}** by making the first-run workflow clearer than competitors and by separating insight, action, and trust more aggressively.`;
        default:
            return `Generated a builder-ready layout direction for **${subject}** with a stronger first-run narrative and clearer action path.`;
    }
}

function buildFallbackResponse(
    request: UiBuilderGenerateRequest,
    pages: UiBuilderContextPage[],
    selectedPage: BuilderPageTarget | null,
    selectedPageBlockCount: number,
    hasThemeTokens: boolean,
): UiBuilderResponsePayload {
    const subject = inferSubject(request.prompt, request.context?.projectName);
    const designSystemSeed = stringifyDesignSystem(request.context?.designSystem);
    const theme = buildFallbackTheme(
        `${subject} ${request.context?.projectDescription || ''} ${designSystemSeed === 'Not provided' ? '' : designSystemSeed}`,
        extractPrimaryColorFromDesignSystem(request.context?.designSystem),
    );
    const competitor = buildFallbackCompetitorIntel(subject, pages);
    const quality = buildFallbackQuality(pages, selectedPage, selectedPageBlockCount, request.context?.viewport || 'desktop', hasThemeTokens);
    const guidance = buildFallbackGuidance(pages, selectedPage, selectedPageBlockCount);
    const layoutPlan = buildFallbackLayoutPlan(request.mode, request.prompt, selectedPage?.name || request.context?.selectedPage?.name);
    const suggestedPages = buildSuggestedPages(pages);
    const modeTitle = `${request.mode.charAt(0).toUpperCase()}${request.mode.slice(1)}`;
    const title = `${modeTitle} plan for ${selectedPage?.name || request.context?.projectName || 'this builder'}`;
    const answer = buildFallbackAnswer(request.mode, subject, selectedPage?.name);

    return {
        title,
        summary: answer.replace(/\*\*/g, ''),
        answer_markdown: answer,
        next_action: guidance[0]?.title || 'Review the generated layout.',
        guidance,
        quality,
        theme_direction: theme,
        competitor_intelligence: competitor,
        suggested_pages: suggestedPages,
        layout_plan: layoutPlan,
        warnings: [],
    };
}

function countRawLayoutSections(raw: unknown): number {
    if (!raw || typeof raw !== 'object') return 0;
    const rec = raw as Record<string, unknown>;
    return Array.isArray(rec.sections) ? rec.sections.length : 0;
}

function buildPrompt(request: UiBuilderGenerateRequest, pages: UiBuilderContextPage[], selectedPage: BuilderPageTarget | null, existingBlocks: BlockRecord[]): string {
    const allowedBlocks = request.context?.allowedBlockTypes?.length ? request.context.allowedBlockTypes : DEFAULT_ALLOWED_BLOCKS;
    const selectedBlockSummary = existingBlocks
        .filter((block) => !block.archived)
        .slice(0, 12)
        .map((block) => `${block.blockType}:${block.name}`)
        .join(', ');

    return `You are Akasha's UI Builder AI.
Return ONLY valid JSON. No markdown fences. No explanation outside JSON.

Use this exact schema:
{
  "title": "string",
  "summary": "string",
  "answer_markdown": "string",
  "next_action": "string",
  "guidance": [
    {
      "id": "string",
      "title": "string",
      "description": "string",
      "impact": "string",
      "action_label": "string",
      "action_type": "create-page | select-page | open-inspector | apply-layout | noop",
      "action_value": "string"
    }
  ],
  "quality": [
    { "key": "string", "label": "string", "score": 0, "note": "string" }
  ],
  "theme_direction": {
    "theme": "string",
    "metaphor": "string",
    "motion": "string",
    "typography": "string",
    "note": "string",
    "palette": ["#hex"]
  },
  "competitor_intelligence": {
    "patterns": ["string"],
    "strengths": ["string"],
    "weaknesses": ["string"],
    "differentiation": ["string"]
  },
  "suggested_pages": [
    { "name": "string", "path": "/string", "reason": "string" }
  ],
  "layout_plan": {
    "page_name": "string",
    "page_purpose": "string",
    "sections": [
      {
        "type": "hero | stats | features | content | cta | form | faq | pricing | testimonials | activity | table | settings | split | dashboard",
        "title": "string",
        "description": "string",
        "items": ["string"],
        "columns": 1,
        "cta_label": "string",
        "media": "image | chart | none",
        "emphasis": "primary | balanced | compact"
      }
    ]
  },
  "warnings": ["string"]
}

Rules:
- Keep JSON compact and valid.
- Use only section types from the schema.
- Use only action_type values from the schema.
- Keep guidance <= 5 items.
- Keep quality <= 5 items.
- Keep suggested_pages <= 4 items.
- Keep sections <= 6 items.
- layout_plan may be null only if the mode is primarily conversational and no layout should be generated.
- Optimize for a real visual builder, not a marketing essay.

Builder mode: ${request.mode}
Project name: ${request.context?.projectName || 'Unknown'}
Project description: ${request.context?.projectDescription || 'Not provided'}
Viewport: ${request.context?.viewport || 'desktop'}
Selected page: ${selectedPage ? `${selectedPage.name} (${selectedPage.path})` : 'None'}
Pages: ${pages.map((page) => `${page.name}:${page.path}`).join(', ') || 'None'}
Existing block summary: ${selectedBlockSummary || 'None'}
Allowed block types: ${allowedBlocks.join(', ')}
Design system context: ${stringifyDesignSystem(request.context?.designSystem)}

User request:
${request.prompt}`;
}

// ---------------------------------------------------------------------------
// Shared finalization helper — assembles the final result from a normalized
// payload, translating the layout plan to blocks.
// ---------------------------------------------------------------------------
function finalizeUiBuilderPayload(
    normalized: UiBuilderResponsePayload,
    fallback: UiBuilderResponsePayload,
    request: UiBuilderGenerateRequest,
    selectedPage: BuilderPageTarget | null,
    providerName: string,
): UiBuilderGenerateResult {
    let layoutPlan = normalized.layout_plan ? normalizeLayoutPlan(normalized.layout_plan) : null;
    if (!layoutPlan && (request.mode === 'create' || request.mode === 'edit' || request.mode === 'suggest' || request.mode === 'analyze')) {
        layoutPlan = fallback.layout_plan;
    }

    const blocksForPage = selectedPage?.root_block_id && request.pageId && layoutPlan
        ? translateLayoutPlanToBlocks(layoutPlan, {
            pageId: request.pageId,
            rootBlockId: selectedPage.root_block_id,
        })
        : [];

    return {
        ...normalized,
        layout_plan: layoutPlan,
        guidance: normalizeGuidanceItems(normalized.guidance),
        quality: normalizeQualityDimensions(normalized.quality),
        theme_direction: normalizeThemeDirection(normalized.theme_direction, fallback.theme_direction.palette),
        competitor_intelligence: normalizeCompetitorIntel(normalized.competitor_intelligence),
        suggested_pages: normalizeSuggestedPages(normalized.suggested_pages),
        mode: request.mode,
        provider: providerName,
        blocks: blocksForPage,
        page: selectedPage,
    };
}

// Merge raw LLM text into a normalized response, falling back on errors.
async function mergeLLMText(
    rawText: string,
    fallback: UiBuilderResponsePayload,
): Promise<{ normalized: UiBuilderResponsePayload; error?: string }> {
    const parseNormalized = (jsonText: string): UiBuilderResponsePayload => {
        const parsed = JSON.parse(extractJsonObject(jsonText));
        const candidate = normalizeUiBuilderResponse(parsed);

        const rawLayout = (parsed as Record<string, unknown>).layout_plan ?? (parsed as Record<string, unknown>).layoutPlan;
        const rawSectionCount = countRawLayoutSections(rawLayout);
        const normalizedSectionCount = candidate.layout_plan?.sections.length ?? 0;
        const droppedSectionCount = Math.max(0, rawSectionCount - normalizedSectionCount);
        const normalizationWarnings = droppedSectionCount > 0
            ? [`Dropped ${droppedSectionCount} invalid layout section${droppedSectionCount > 1 ? 's' : ''} during normalization.`]
            : [];

        const mergedWarnings = [...candidate.warnings, ...normalizationWarnings];

        return {
            ...fallback,
            ...candidate,
            guidance: candidate.guidance.length > 0 ? candidate.guidance : fallback.guidance,
            quality: candidate.quality.length > 0 ? candidate.quality : fallback.quality,
            theme_direction: normalizeThemeDirection(candidate.theme_direction, fallback.theme_direction.palette),
            competitor_intelligence: {
                patterns: candidate.competitor_intelligence.patterns.length > 0 ? candidate.competitor_intelligence.patterns : fallback.competitor_intelligence.patterns,
                strengths: candidate.competitor_intelligence.strengths.length > 0 ? candidate.competitor_intelligence.strengths : fallback.competitor_intelligence.strengths,
                weaknesses: candidate.competitor_intelligence.weaknesses.length > 0 ? candidate.competitor_intelligence.weaknesses : fallback.competitor_intelligence.weaknesses,
                differentiation: candidate.competitor_intelligence.differentiation.length > 0 ? candidate.competitor_intelligence.differentiation : fallback.competitor_intelligence.differentiation,
            },
            suggested_pages: candidate.suggested_pages.length > 0 ? candidate.suggested_pages : fallback.suggested_pages,
            layout_plan: candidate.layout_plan ?? fallback.layout_plan,
            warnings: mergedWarnings.length > 0 ? mergedWarnings : fallback.warnings,
            answer_markdown: candidate.answer_markdown || fallback.answer_markdown,
            summary: candidate.summary || fallback.summary,
            title: candidate.title || fallback.title,
            next_action: candidate.next_action || fallback.next_action,
        };
    };

    try {
        return {
            normalized: parseNormalized(rawText),
        };
    } catch (error: any) {
        // One repair pass: ask the active LLM provider to return strict valid JSON only.
        try {
            const llmProvider = getLLMProvider();
            const repairPrompt = [
                'Repair the following malformed JSON.',
                'Return ONLY valid JSON with the same schema and values where possible.',
                'Do not add markdown code fences or commentary.',
                '',
                rawText,
            ].join('\n');

            const repairedText = await llmProvider.chat({
                model: '',
                temperature: 0,
                max_tokens: 2600,
                messages: [{ role: 'user', content: repairPrompt }],
            });

            return {
                normalized: parseNormalized(repairedText),
            };
        } catch {
            // fall through to deterministic fallback warning below
        }

        return {
            normalized: {
                ...fallback,
                warnings: [
                    ...fallback.warnings,
                    `Model response fallback used: ${error?.message || 'Unknown parsing error'}`,
                ].slice(0, 4),
            },
            error: error?.message,
        };
    }
}

export async function generateUiBuilderResult(request: UiBuilderGenerateRequest): Promise<UiBuilderGenerateResult> {
    const project = await prisma.project.findUnique({
        where: { id: request.projectId },
        include: { pages: true, blocks: true },
    });

    if (!project) {
        throw new Error('Project not found');
    }

    const normalizedDesignSystem = normalizeDesignSystemContext(request.context?.designSystem);
    const normalizedRequest: UiBuilderGenerateRequest = {
        ...request,
        context: {
            ...(request.context || {}),
            designSystem: normalizedDesignSystem,
        },
    };

    const pages = project.pages as unknown as PageRecord[];
    const blocks = project.blocks as unknown as BlockRecord[];
    const publicPages = toPublicPages(pages);
    const pageRecord = normalizedRequest.pageId ? pages.find((page) => page.id === normalizedRequest.pageId) : undefined;
    const pageRootId = inferPageRootId(pageRecord, blocks);
    const selectedPage: BuilderPageTarget | null = pageRecord
        ? {
            id: pageRecord.id,
            name: pageRecord.name,
            path: pageRecord.path,
            root_block_id: pageRootId,
        }
        : normalizedRequest.context?.selectedPage
            ? {
                id: normalizedRequest.context.selectedPage.id,
                name: normalizedRequest.context.selectedPage.name,
                path: normalizedRequest.context.selectedPage.path,
            }
            : null;
    const selectedPageBlocks = pageRecord ? blocks.filter((block) => block.pageId === pageRecord.idRoot) : [];
    const hasThemeTokens = Boolean(parseJsonValue<Record<string, unknown>>(project.settings, {}).theme) || Boolean(normalizedRequest.context?.designSystem);

    const fallback = buildFallbackResponse(
        normalizedRequest,
        publicPages,
        selectedPage,
        countBlocksForInternalPage(blocks, pageRecord?.idRoot),
        hasThemeTokens,
    );

    let normalized = fallback;
    let providerName = 'Unavailable';

    try {
        const llmProvider = getLLMProvider();
        providerName = llmProvider.getActiveProvider();
        const prompt = buildPrompt(normalizedRequest, publicPages, selectedPage, selectedPageBlocks);
        const modelOutput = await llmProvider.chat({
            model: '',
            temperature: normalizedRequest.mode === 'analyze' ? 0.2 : 0.35,
            max_tokens: 2200,
            messages: [{ role: 'user', content: prompt }],
        });
        normalized = (await mergeLLMText(modelOutput, fallback)).normalized;
    } catch (error: any) {
        normalized = {
            ...fallback,
            warnings: [
                ...fallback.warnings,
                `Model response fallback used: ${error?.message || 'Unknown parsing error'}`,
            ].slice(0, 4),
        };
    }

    return finalizeUiBuilderPayload(normalized, fallback, normalizedRequest, selectedPage, providerName);
}

/**
 * Streaming variant: yields raw LLM token chunks as they arrive, then returns
 * the fully assembled UiBuilderGenerateResult as the generator return value.
 *
 * Usage in controller:
 *   const gen = generateUiBuilderStream(request);
 *   while (true) {
 *     const step = await gen.next();
 *     if (step.done) { sendEvent('result', step.value); break; }
 *     sendEvent('token', { text: step.value });
 *   }
 */
export async function* generateUiBuilderStream(
    request: UiBuilderGenerateRequest,
): AsyncGenerator<string, UiBuilderGenerateResult, undefined> {
    const project = await prisma.project.findUnique({
        where: { id: request.projectId },
        include: { pages: true, blocks: true },
    });

    if (!project) throw new Error('Project not found');

    const normalizedDesignSystem = normalizeDesignSystemContext(request.context?.designSystem);
    const normalizedRequest: UiBuilderGenerateRequest = {
        ...request,
        context: {
            ...(request.context || {}),
            designSystem: normalizedDesignSystem,
        },
    };

    const pages = project.pages as unknown as PageRecord[];
    const blocks = project.blocks as unknown as BlockRecord[];
    const publicPages = toPublicPages(pages);
    const pageRecord = normalizedRequest.pageId ? pages.find((page) => page.id === normalizedRequest.pageId) : undefined;
    const pageRootId = inferPageRootId(pageRecord, blocks);
    const selectedPage: BuilderPageTarget | null = pageRecord
        ? { id: pageRecord.id, name: pageRecord.name, path: pageRecord.path, root_block_id: pageRootId }
        : normalizedRequest.context?.selectedPage
            ? { id: normalizedRequest.context.selectedPage.id, name: normalizedRequest.context.selectedPage.name, path: normalizedRequest.context.selectedPage.path }
            : null;
    const selectedPageBlocks = pageRecord ? blocks.filter((block) => block.pageId === pageRecord.idRoot) : [];
    const hasThemeTokens = Boolean(parseJsonValue<Record<string, unknown>>(project.settings, {}).theme) || Boolean(normalizedRequest.context?.designSystem);

    const fallback = buildFallbackResponse(
        normalizedRequest,
        publicPages,
        selectedPage,
        countBlocksForInternalPage(blocks, pageRecord?.idRoot),
        hasThemeTokens,
    );

    const llmProvider = getLLMProvider();
    const providerName = llmProvider.getActiveProvider();
    const prompt = buildPrompt(normalizedRequest, publicPages, selectedPage, selectedPageBlocks);
    const llmOptions: LLMCompletionOptions = {
        model: '',
        temperature: normalizedRequest.mode === 'analyze' ? 0.2 : 0.35,
        max_tokens: 2200,
        messages: [{ role: 'user', content: prompt }],
    };

    let fullText = '';
    try {
        for await (const chunk of llmProvider.chatStream(llmOptions)) {
            fullText += chunk;
            yield chunk;
        }
    } catch (streamError: any) {
        console.error('[LLM] Stream failed in generateUiBuilderStream:', streamError.message);
    }

    const normalized = fullText
        ? (await mergeLLMText(fullText, fallback)).normalized
        : { ...fallback, warnings: [...fallback.warnings, 'Model stream produced no output; fallback used.'].slice(0, 4) };

    return finalizeUiBuilderPayload(normalized, fallback, normalizedRequest, selectedPage, providerName);
}
