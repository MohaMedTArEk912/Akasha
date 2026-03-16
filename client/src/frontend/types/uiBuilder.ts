import type { BlockSchema } from "./api";

export type UiBuilderMode = "create" | "edit" | "suggest" | "ask" | "analyze" | "compete";

export type UiBuilderGuidanceActionType =
    | "create-page"
    | "select-page"
    | "open-inspector"
    | "apply-layout"
    | "noop";

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

export interface UiBuilderQualityDimension {
    key: string;
    label: string;
    score: number;
    note: string;
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
    type: string;
    title: string;
    description: string;
    items: string[];
    columns: number;
    cta_label?: string;
    media?: "image" | "chart" | "none";
    emphasis?: "primary" | "balanced" | "compact";
}

export interface UiBuilderLayoutPlan {
    page_name: string;
    page_purpose: string;
    sections: UiBuilderLayoutSection[];
}

export interface UiBuilderGenerateRequest {
    projectId: string;
    pageId?: string;
    mode: UiBuilderMode;
    prompt: string;
    context?: {
        projectName?: string;
        projectDescription?: string;
        viewport?: "desktop" | "tablet" | "mobile";
        selectedPage?: UiBuilderContextPage | null;
        pages?: UiBuilderContextPage[];
        existingBlocks?: UiBuilderContextBlock[];
        allowedBlockTypes?: string[];
        designSystem?: Record<string, unknown>;
    };
}

export interface UiBuilderGenerateResponse {
    mode: UiBuilderMode;
    provider: string;
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
    blocks: BlockSchema[];
    page: {
        id: string;
        root_block_id?: string;
        name: string;
        path: string;
    } | null;
}
