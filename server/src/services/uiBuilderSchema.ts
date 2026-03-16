export type UiBuilderMode = 'create' | 'edit' | 'suggest' | 'ask' | 'analyze' | 'compete';

export type UiBuilderGuidanceActionType =
    | 'create-page'
    | 'select-page'
    | 'open-inspector'
    | 'apply-layout'
    | 'noop';

export type UiBuilderSectionType =
    | 'hero'
    | 'stats'
    | 'features'
    | 'content'
    | 'cta'
    | 'form'
    | 'faq'
    | 'pricing'
    | 'testimonials'
    | 'activity'
    | 'table'
    | 'settings'
    | 'split'
    | 'dashboard';

export interface UiBuilderContextPage {
    id: string;
    name: string;
    path: string;
}

export interface UiBuilderContextBlock {
    id: string;
    type: string;
    name: string;
    parent_id?: string | null;
}

export interface UiBuilderRequestContext {
    projectName?: string;
    projectDescription?: string;
    viewport?: 'desktop' | 'tablet' | 'mobile';
    selectedPage?: UiBuilderContextPage | null;
    pages?: UiBuilderContextPage[];
    existingBlocks?: UiBuilderContextBlock[];
    allowedBlockTypes?: string[];
    designSystem?: Record<string, unknown>;
}

export interface UiBuilderGenerateRequest {
    projectId: string;
    pageId?: string;
    mode: UiBuilderMode;
    prompt: string;
    context?: UiBuilderRequestContext;
}

export interface UiBuilderQualityDimension {
    key: string;
    label: string;
    score: number;
    note: string;
}

export interface UiBuilderThemeDirection {
    theme: string;
    metaphor: string;
    motion: string;
    typography: string;
    note: string;
    palette: string[];
}

export interface UiBuilderCompetitorIntel {
    patterns: string[];
    strengths: string[];
    weaknesses: string[];
    differentiation: string[];
}

export interface UiBuilderGuidanceItem {
    id: string;
    title: string;
    description: string;
    impact: string;
    action_label: string;
    action_type: UiBuilderGuidanceActionType;
    action_value?: string;
}

export interface UiBuilderSuggestedPage {
    name: string;
    path: string;
    reason: string;
}

export interface UiBuilderLayoutSection {
    type: UiBuilderSectionType;
    title: string;
    description: string;
    items: string[];
    columns: number;
    cta_label?: string;
    media?: 'image' | 'chart' | 'none';
    emphasis?: 'primary' | 'balanced' | 'compact';
}

export interface UiBuilderLayoutPlan {
    page_name: string;
    page_purpose: string;
    sections: UiBuilderLayoutSection[];
}

export interface UiBuilderResponsePayload {
    title: string;
    summary: string;
    answer_markdown: string;
    next_action: string;
    guidance: UiBuilderGuidanceItem[];
    quality: UiBuilderQualityDimension[];
    theme_direction: UiBuilderThemeDirection;
    competitor_intelligence: UiBuilderCompetitorIntel;
    suggested_pages: UiBuilderSuggestedPage[];
    layout_plan: UiBuilderLayoutPlan | null;
    warnings: string[];
}

export interface UiBuilderModelShape extends Partial<UiBuilderResponsePayload> {
    provider?: string;
}

const ALLOWED_ACTION_TYPES: UiBuilderGuidanceActionType[] = [
    'create-page',
    'select-page',
    'open-inspector',
    'apply-layout',
    'noop',
];

const ALLOWED_SECTION_TYPES: UiBuilderSectionType[] = [
    'hero',
    'stats',
    'features',
    'content',
    'cta',
    'form',
    'faq',
    'pricing',
    'testimonials',
    'activity',
    'table',
    'settings',
    'split',
    'dashboard',
];

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

export function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

export function slugifyValue(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

export function extractJsonObject(raw: string): string {
    let text = raw.trim();
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
        throw new Error('No JSON object found in model output');
    }

    return text.slice(start, end + 1);
}

export function normalizeStringArray(value: unknown, maxItems = 8): string[] {
    if (!Array.isArray(value)) return [];
    return value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, maxItems);
}

function normalizeActionType(value: unknown): UiBuilderGuidanceActionType {
    if (typeof value !== 'string') return 'noop';
    const normalized = value.trim().toLowerCase() as UiBuilderGuidanceActionType;
    return ALLOWED_ACTION_TYPES.includes(normalized) ? normalized : 'noop';
}

function normalizeSectionType(value: unknown): UiBuilderSectionType {
    if (typeof value !== 'string') return 'content';
    const normalized = value.trim().toLowerCase() as UiBuilderSectionType;
    return ALLOWED_SECTION_TYPES.includes(normalized) ? normalized : 'content';
}

function normalizeScore(value: unknown, fallback = 60): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return clamp(Math.round(value), 0, 100);
    }
    if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
            return clamp(Math.round(parsed), 0, 100);
        }
    }
    return fallback;
}

function normalizeGuidanceItem(value: unknown, index: number): UiBuilderGuidanceItem | null {
    if (!isRecord(value)) return null;
    const title = typeof value.title === 'string' ? value.title.trim() : '';
    if (!title) return null;

    return {
        id: typeof value.id === 'string' && value.id.trim()
            ? value.id.trim()
            : `guidance-${index + 1}-${slugifyValue(title) || 'item'}`,
        title,
        description: typeof value.description === 'string' ? value.description.trim() : '',
        impact: typeof value.impact === 'string' ? value.impact.trim() : '',
        action_label: typeof value.action_label === 'string'
            ? value.action_label.trim()
            : typeof value.actionLabel === 'string'
                ? value.actionLabel.trim()
                : 'Review',
        action_type: normalizeActionType(value.action_type ?? value.actionType),
        action_value: typeof value.action_value === 'string'
            ? value.action_value.trim()
            : typeof value.actionValue === 'string'
                ? value.actionValue.trim()
                : undefined,
    };
}

export function normalizeGuidanceItems(value: unknown): UiBuilderGuidanceItem[] {
    if (!Array.isArray(value)) return [];

    const usedIds = new Set<string>();
    const normalized: UiBuilderGuidanceItem[] = [];

    for (let index = 0; index < value.length; index += 1) {
        const item = normalizeGuidanceItem(value[index], index);
        if (!item) continue;

        const baseId = item.id.trim() || `guidance-${index + 1}-item`;
        let uniqueId = baseId;
        let suffix = 2;
        while (usedIds.has(uniqueId)) {
            uniqueId = `${baseId}-${suffix}`;
            suffix += 1;
        }

        usedIds.add(uniqueId);
        normalized.push({ ...item, id: uniqueId });

        if (normalized.length >= 6) break;
    }

    return normalized;
}

function normalizeQualityDimension(value: unknown, index: number): UiBuilderQualityDimension | null {
    if (!isRecord(value)) return null;
    const label = typeof value.label === 'string' ? value.label.trim() : '';
    const key = typeof value.key === 'string' ? value.key.trim() : slugifyValue(label || `dimension-${index + 1}`);
    if (!label) return null;

    return {
        key,
        label,
        score: normalizeScore(value.score, 60),
        note: typeof value.note === 'string' ? value.note.trim() : '',
    };
}

export function normalizeQualityDimensions(value: unknown): UiBuilderQualityDimension[] {
    if (!Array.isArray(value)) return [];
    return value
        .map((item, index) => normalizeQualityDimension(item, index))
        .filter((item): item is UiBuilderQualityDimension => !!item)
        .slice(0, 6);
}

export function normalizeThemeDirection(value: unknown, fallbackPalette: string[] = ['#06b6d4', '#111827', '#f97316']): UiBuilderThemeDirection {
    const source = isRecord(value) ? value : {};
    return {
        theme: typeof source.theme === 'string' && source.theme.trim() ? source.theme.trim() : 'Signal Studio',
        metaphor: typeof source.metaphor === 'string' && source.metaphor.trim() ? source.metaphor.trim() : 'A control room where product decisions stay visible',
        motion: typeof source.motion === 'string' && source.motion.trim() ? source.motion.trim() : 'Staggered reveals with deliberate panel transitions',
        typography: typeof source.typography === 'string' && source.typography.trim() ? source.typography.trim() : 'Space Grotesk for display, IBM Plex Sans for interface copy',
        note: typeof source.note === 'string' && source.note.trim() ? source.note.trim() : 'Emphasize hierarchy and system state before decoration.',
        palette: normalizeStringArray(source.palette, 5).length > 0 ? normalizeStringArray(source.palette, 5) : fallbackPalette,
    };
}

export function normalizeCompetitorIntel(value: unknown): UiBuilderCompetitorIntel {
    const source = isRecord(value) ? value : {};
    return {
        patterns: normalizeStringArray(source.patterns, 6),
        strengths: normalizeStringArray(source.strengths, 6),
        weaknesses: normalizeStringArray(source.weaknesses, 6),
        differentiation: normalizeStringArray(source.differentiation, 6),
    };
}

function normalizeSuggestedPage(value: unknown, index: number): UiBuilderSuggestedPage | null {
    if (!isRecord(value)) return null;
    const name = typeof value.name === 'string' ? value.name.trim() : '';
    if (!name) return null;
    const pathRaw = typeof value.path === 'string' ? value.path.trim() : `/${slugifyValue(name) || `page-${index + 1}`}`;
    const normalizedPath = pathRaw.startsWith('/') ? pathRaw : `/${pathRaw}`;

    return {
        name,
        path: normalizedPath,
        reason: typeof value.reason === 'string' ? value.reason.trim() : '',
    };
}

export function normalizeSuggestedPages(value: unknown): UiBuilderSuggestedPage[] {
    if (!Array.isArray(value)) return [];
    return value
        .map((item, index) => normalizeSuggestedPage(item, index))
        .filter((item): item is UiBuilderSuggestedPage => !!item)
        .slice(0, 6);
}

function normalizeLayoutSection(value: unknown): UiBuilderLayoutSection | null {
    if (!isRecord(value)) return null;
    const title = typeof value.title === 'string' ? value.title.trim() : '';
    if (!title) return null;

    return {
        type: normalizeSectionType(value.type),
        title,
        description: typeof value.description === 'string' ? value.description.trim() : '',
        items: normalizeStringArray(value.items, 8),
        columns: clamp(
            typeof value.columns === 'number' && Number.isFinite(value.columns)
                ? Math.round(value.columns)
                : typeof value.columns === 'string'
                    ? Math.round(Number(value.columns))
                    : 3,
            1,
            4,
        ),
        cta_label: typeof value.cta_label === 'string'
            ? value.cta_label.trim()
            : typeof value.ctaLabel === 'string'
                ? value.ctaLabel.trim()
                : undefined,
        media: value.media === 'image' || value.media === 'chart' || value.media === 'none'
            ? value.media
            : 'none',
        emphasis: value.emphasis === 'primary' || value.emphasis === 'balanced' || value.emphasis === 'compact'
            ? value.emphasis
            : 'balanced',
    };
}

export function normalizeLayoutPlan(value: unknown): UiBuilderLayoutPlan | null {
    if (!isRecord(value)) return null;
    const pageName = typeof value.page_name === 'string'
        ? value.page_name.trim()
        : typeof value.pageName === 'string'
            ? value.pageName.trim()
            : '';

    if (!pageName) return null;

    const sections = Array.isArray(value.sections)
        ? value.sections
            .map((section) => normalizeLayoutSection(section))
            .filter((section): section is UiBuilderLayoutSection => !!section)
            .slice(0, 8)
        : [];

    return {
        page_name: pageName,
        page_purpose: typeof value.page_purpose === 'string'
            ? value.page_purpose.trim()
            : typeof value.pagePurpose === 'string'
                ? value.pagePurpose.trim()
                : '',
        sections,
    };
}

export function normalizeUiBuilderResponse(raw: unknown): UiBuilderResponsePayload {
    const source = isRecord(raw) ? raw : {};
    return {
        title: typeof source.title === 'string' && source.title.trim() ? source.title.trim() : 'AI UI Builder output',
        summary: typeof source.summary === 'string' ? source.summary.trim() : '',
        answer_markdown: typeof source.answer_markdown === 'string'
            ? source.answer_markdown.trim()
            : typeof source.answer === 'string'
                ? source.answer.trim()
                : '',
        next_action: typeof source.next_action === 'string'
            ? source.next_action.trim()
            : typeof source.nextAction === 'string'
                ? source.nextAction.trim()
                : '',
        guidance: normalizeGuidanceItems(source.guidance),
        quality: normalizeQualityDimensions(source.quality),
        theme_direction: normalizeThemeDirection(source.theme_direction ?? source.themeDirection),
        competitor_intelligence: normalizeCompetitorIntel(source.competitor_intelligence ?? source.competitorIntel),
        suggested_pages: normalizeSuggestedPages(source.suggested_pages ?? source.suggestedPages),
        layout_plan: normalizeLayoutPlan(source.layout_plan ?? source.layoutPlan),
        warnings: normalizeStringArray(source.warnings, 8),
    };
}
