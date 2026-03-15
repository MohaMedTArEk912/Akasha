import React, { useEffect, useMemo, useRef, useState } from "react";
import { useEditor } from "@craftjs/core";
import { useProjectStore } from "../../../hooks/useProjectStore";
import { applyBuilderLayout, createPage, generateBuilderLayout, selectPage } from "../../../stores/projectStore";
import { useToast } from "../../../context/ToastContext";
import type { BlockSchema, PageSchema, ProjectSchema } from "../../../types/api";
import type { UiBuilderGenerateResponse, UiBuilderGuidanceItem as ServerGuidanceItem } from "../../../types/uiBuilder";
import { blocksToSerializedNodes } from "./craft/serialization";

type CopilotMode = "create" | "edit" | "suggest" | "ask" | "analyze" | "compete";
type SuggestionAction =
    | { type: "create-page"; name: string }
    | { type: "select-page"; pageId: string }
    | { type: "open-inspector" }
    | { type: "apply-layout" }
    | { type: "noop"; message?: string };

interface GuidanceItem {
    id: string;
    title: string;
    description: string;
    impact: string;
    actionLabel: string;
    action: SuggestionAction;
}

interface QueueItem extends GuidanceItem {
    rationale: string;
    status: "pending" | "approved" | "rejected";
    rating: number | null;
    comment: string;
}

interface ThemeDirection {
    theme: string;
    metaphor: string;
    motion: string;
    typography: string;
    note: string;
    palette: string[];
}

interface QualityDimension {
    key: string;
    label: string;
    score: number;
    note: string;
}

interface CompetitorIntel {
    patterns: string[];
    strengths: string[];
    weaknesses: string[];
    differentiation: string[];
}

interface CopilotResult {
    title: string;
    summary: string;
    detail: string;
    priorities: string[];
    nextAction: string;
    flow: string[];
    warnings: string[];
}

interface AIDesignCopilotPanelProps {
    onOpenInspector: () => void;
}

const COPILOT_MODES: Array<{
    key: CopilotMode;
    label: string;
    summary: string;
    placeholder: string;
    button: string;
}> = [
        {
            key: "create",
            label: "Create",
            summary: "Generate new UI structure from a product brief or screen idea.",
            placeholder: "Describe the screen, product, or flow you want the builder to create next.",
            button: "Generate Structure",
        },
        {
            key: "edit",
            label: "Edit",
            summary: "Refine the current page and improve existing layout decisions.",
            placeholder: "Describe what should change on the selected page.",
            button: "Propose Edits",
        },
        {
            key: "suggest",
            label: "Suggest",
            summary: "Surface the next best UX and visual improvements.",
            placeholder: "Ask for the next most valuable improvement.",
            button: "Get Suggestions",
        },
        {
            key: "ask",
            label: "Ask",
            summary: "Answer UX, UI, or implementation questions inside the builder.",
            placeholder: "Ask about UX, hierarchy, onboarding, copy, or front-end direction.",
            button: "Answer Question",
        },
        {
            key: "analyze",
            label: "Analyze",
            summary: "Score the current design direction and call out weak spots.",
            placeholder: "Ask for a critique of the current design or selected page.",
            button: "Analyze Layout",
        },
        {
            key: "compete",
            label: "Compete",
            summary: "Benchmark the product against competitors and find separation.",
            placeholder: "Name competitors or the market you want to outperform.",
            button: "Map Competition",
        },
    ];

const GENERATION_STEPS = [
    {
        title: "Skeleton structure",
        description: "Drafting the rough page and panel structure first.",
    },
    {
        title: "Section generation",
        description: "Ordering the most important screen sections and flows.",
    },
    {
        title: "Progressive filling",
        description: "Adding UX rationale, theme direction, and implementation detail.",
    },
    {
        title: "Completion",
        description: "Finalizing the next best action for the builder.",
    },
];

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function average(values: number[]): number {
    return Math.round(values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1));
}

function getActivePages(project: ProjectSchema | null): PageSchema[] {
    return project?.pages.filter((page) => !page.archived) ?? [];
}

function hasNamedPage(pages: PageSchema[], keywords: string[]): boolean {
    return pages.some((page) => {
        const haystack = `${page.name} ${page.path}`.toLowerCase();
        return keywords.some((keyword) => haystack.includes(keyword));
    });
}

function countBlocksForPage(blocks: BlockSchema[], pageId: string | null): number {
    if (!pageId) return 0;
    return blocks.filter((block) => !block.archived && block.page_id === pageId).length;
}

function toTitleCase(input: string): string {
    return input
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ");
}

function inferSubject(prompt: string, projectName?: string): string {
    const trimmed = prompt.trim();
    if (trimmed.length > 0) {
        return trimmed.length > 72 ? `${trimmed.slice(0, 69).trimEnd()}...` : trimmed;
    }

    if (projectName?.trim()) {
        return projectName.trim();
    }

    return "this product";
}

function resolveThemeDirection(seed: string, primaryColor?: string): ThemeDirection {
    const value = seed.toLowerCase();

    if (/(finance|bank|trading|wallet|fintech|payment)/.test(value)) {
        return {
            theme: "Market Pulse",
            metaphor: "A calm trading floor with clear signal lanes",
            motion: "Ticker-like reveals with short confidence pulses",
            typography: "Space Grotesk for headlines, IBM Plex Sans for interface copy",
            note: "Lean into trust, tempo, and fast comprehension rather than decorative complexity.",
            palette: [primaryColor || "#14b8a6", "#0f172a", "#134e4a", "#f59e0b"],
        };
    }

    if (/(health|care|clinic|medical|wellness)/.test(value)) {
        return {
            theme: "Quiet Vitality",
            metaphor: "A guided recovery path with precise checkpoints",
            motion: "Soft upward transitions and measured content fades",
            typography: "Sora for hierarchy, Source Sans 3 for long-form content",
            note: "Prioritize calm reassurance and plain-language task framing.",
            palette: [primaryColor || "#22c55e", "#083344", "#ecfeff", "#0f766e"],
        };
    }

    if (/(education|learning|course|academy|student)/.test(value)) {
        return {
            theme: "Studio Desk",
            metaphor: "A creative workshop with pinned milestones",
            motion: "Stacked card slides with crisp chapter transitions",
            typography: "Cabinet Grotesk for headings, Public Sans for interface text",
            note: "Make progress visible and keep lesson choices highly scannable.",
            palette: [primaryColor || "#f97316", "#1c1917", "#fed7aa", "#0ea5e9"],
        };
    }

    if (/(developer|code|api|saas|workspace|productivity|ai)/.test(value)) {
        return {
            theme: "Signal Studio",
            metaphor: "A control room where insights snap into place",
            motion: "Pane reveals, staggered traces, and deliberate progress sweeps",
            typography: "Space Grotesk for display, IBM Plex Mono for accent labels",
            note: "Bias toward strong hierarchy, visible system state, and fewer decorative surfaces.",
            palette: [primaryColor || "#06b6d4", "#111827", "#1d4ed8", "#f97316"],
        };
    }

    return {
        theme: "North Star Canvas",
        metaphor: "An editorial dashboard that always points to the next move",
        motion: "Layered fade-ins with directional slide emphasis",
        typography: "General Sans for hierarchy, Inter for compact utility text",
        note: "Aim for clear focal points, sharp spacing discipline, and visible progression.",
        palette: [primaryColor || "#38bdf8", "#0f172a", "#f97316", "#22c55e"],
    };
}

function buildCompetitorIntel(subject: string, pages: PageSchema[]): CompetitorIntel {
    const joined = subject.toLowerCase();
    const pageCount = pages.length;

    if (/(finance|payment|wallet|fintech)/.test(joined)) {
        return {
            patterns: [
                "Dense KPI dashboards with trust markers above the fold",
                "Fast multi-step onboarding with compliance checkpoints",
                "High-contrast CTA zones around transfer and portfolio actions",
            ],
            strengths: [
                "Users understand account state quickly",
                "Critical actions stay visible in navigation and summary cards",
            ],
            weaknesses: [
                "Many competitors feel sterile and over-compressed",
                "Educational guidance is usually buried after onboarding",
            ],
            differentiation: [
                "Use calmer pacing and plain-language explanations for complex actions",
                "Expose portfolio guidance earlier instead of hiding it behind settings",
            ],
        };
    }

    if (/(developer|api|saas|ai|workspace)/.test(joined)) {
        return {
            patterns: [
                "Command-bar driven navigation and dense sidebar layouts",
                "Empty states that push immediately into import or setup flows",
                "Usage analytics clustered near billing and deployment status",
            ],
            strengths: [
                "Power users get fast access to core tools",
                "System status is often explicit and trustworthy",
            ],
            weaknesses: [
                "New-user paths are weak once the product moves past setup",
                "Visual hierarchy often collapses under too many neutral surfaces",
            ],
            differentiation: [
                "Keep expert speed, but add a guided path for the first three jobs to be done",
                "Create stronger visual contrast between build, review, and ship moments",
            ],
        };
    }

    return {
        patterns: [
            "Card-based home screens with a primary workflow row",
            "Search and quick actions anchored near the top",
            "Feature education pushed into side panels or modals",
        ],
        strengths: [
            "Familiar layouts reduce cognitive load for first-time users",
            "Clear top-level navigation helps products scale across features",
        ],
        weaknesses: [
            "Many products look interchangeable after the first scroll",
            "Empty states rarely teach users why the workflow matters",
        ],
        differentiation: [
            "Build a clearer point of view in the first screen users see",
            pageCount < 4
                ? "Expand the flow beyond the initial page set so value is visible end to end"
                : "Use the richer page set to highlight outcomes, not just features",
        ],
    };
}

function buildQualityDimensions(
    project: ProjectSchema | null,
    pages: PageSchema[],
    selectedPage: PageSchema | null,
    selectedPageBlockCount: number,
    viewport: string
): QualityDimension[] {
    const hasLanding = hasNamedPage(pages, ["home", "landing", "hero"]);
    const hasOnboarding = hasNamedPage(pages, ["onboarding", "welcome", "start"]);
    const hasSettings = hasNamedPage(pages, ["settings", "profile", "account"]);
    const hasDashboard = hasNamedPage(pages, ["dashboard", "overview", "workspace"]);
    const hasPricing = hasNamedPage(pages, ["pricing", "plan", "billing"]);
    const themeConfigured = !!project?.settings?.theme?.primary_color || !!project?.settings?.theme?.font_family;

    const clarity = clamp(
        42 + pages.length * 8 + (selectedPage ? 8 : 0) + (selectedPageBlockCount >= 4 ? 10 : 0) + (hasLanding ? 10 : 0),
        28,
        96
    );
    const accessibility = clamp(56 + (themeConfigured ? 8 : 0) + (hasSettings ? 6 : 0) + (pages.length > 1 ? 5 : 0), 34, 92);
    const hierarchy = clamp(36 + selectedPageBlockCount * 7 + (hasDashboard ? 10 : 0), 24, 95);
    const responsiveness = clamp(48 + (viewport === "desktop" ? 8 : 0) + (selectedPageBlockCount > 0 ? 10 : 0) + (pages.length > 2 ? 8 : 0), 30, 91);
    const conversion = clamp(32 + (hasLanding ? 14 : 0) + (hasPricing ? 12 : 0) + (hasOnboarding ? 11 : 0), 22, 93);

    return [
        {
            key: "clarity",
            label: "UX clarity",
            score: clarity,
            note: selectedPage
                ? `${selectedPage.name} has ${selectedPageBlockCount} active blocks, which is ${selectedPageBlockCount >= 4 ? "enough to shape a clearer narrative." : "still thin for a confident flow."}`
                : "Select a page to let the copilot score the current story more accurately.",
        },
        {
            key: "accessibility",
            label: "Accessibility",
            score: accessibility,
            note: themeConfigured
                ? "Project theme tokens exist, so contrast and consistency are easier to enforce."
                : "No strong theme tokens were detected, so accessibility guardrails are still loose.",
        },
        {
            key: "hierarchy",
            label: "Visual hierarchy",
            score: hierarchy,
            note: hasDashboard
                ? "Core information architecture is present, but spacing rhythm still needs validation on the canvas."
                : "A stronger anchor page would make the product feel more coherent.",
        },
        {
            key: "responsive",
            label: "Responsiveness",
            score: responsiveness,
            note: `The builder is currently focused on ${viewport}; use tablet and mobile passes before export.`,
        },
        {
            key: "conversion",
            label: "Conversion",
            score: conversion,
            note: hasLanding || hasPricing
                ? "Acquisition and decision moments are partially covered."
                : "The flow still lacks strong acquisition and decision screens.",
        },
    ];
}

function buildGuidanceItems(
    pages: PageSchema[],
    selectedPage: PageSchema | null,
    selectedPageBlockCount: number
): GuidanceItem[] {
    const items: GuidanceItem[] = [];

    if (!hasNamedPage(pages, ["home", "landing", "hero"])) {
        items.push({
            id: "landing-page",
            title: "Add a stronger entry page",
            description: "Create a landing or home page that frames the product promise before users hit deeper workflows.",
            impact: "Improves hierarchy and first impression.",
            actionLabel: "Create Home",
            action: { type: "create-page", name: "Home" },
        });
    }

    if (!hasNamedPage(pages, ["onboarding", "welcome", "start"])) {
        items.push({
            id: "onboarding-flow",
            title: "Add onboarding guidance",
            description: "Introduce an onboarding page so new users can understand the first two actions without guesswork.",
            impact: "Reduces activation friction.",
            actionLabel: "Create Onboarding",
            action: { type: "create-page", name: "Onboarding" },
        });
    }

    if (!hasNamedPage(pages, ["dashboard", "overview", "workspace"])) {
        items.push({
            id: "dashboard-flow",
            title: "Create a high-signal dashboard",
            description: "A dashboard or workspace page gives the product a stable operating view after setup.",
            impact: "Improves retention and daily usability.",
            actionLabel: "Create Dashboard",
            action: { type: "create-page", name: "Dashboard" },
        });
    }

    if (selectedPage && selectedPageBlockCount < 4) {
        items.push({
            id: "selected-page-hierarchy",
            title: `Strengthen ${selectedPage.name} hierarchy`,
            description: "The selected page needs clearer content grouping, stronger CTA emphasis, and more deliberate spacing.",
            impact: "Makes the page easier to scan.",
            actionLabel: "Open Inspector",
            action: { type: "open-inspector" },
        });
    }

    if (!hasNamedPage(pages, ["pricing", "plan", "billing"])) {
        items.push({
            id: "pricing-proof",
            title: "Add a decision screen",
            description: "Create a pricing, plans, or value-proof page so the product has a visible conversion moment.",
            impact: "Improves conversion readiness.",
            actionLabel: "Create Pricing",
            action: { type: "create-page", name: "Pricing" },
        });
    }

    if (!hasNamedPage(pages, ["settings", "profile", "account"])) {
        items.push({
            id: "settings-page",
            title: "Add account control surfaces",
            description: "Users need a settings or profile page to manage preferences, trust, and long-term product use.",
            impact: "Improves product completeness.",
            actionLabel: "Create Settings",
            action: { type: "create-page", name: "Settings" },
        });
    }

    if (items.length === 0) {
        items.push({
            id: "refine-current-page",
            title: "Refine the current page",
            description: "The page set is in reasonable shape. Use the inspector to tighten spacing, contrast, and CTA rhythm.",
            impact: "Polishes the design for production.",
            actionLabel: "Open Inspector",
            action: { type: "open-inspector" },
        });
    }

    return items.slice(0, 4);
}

function buildFlowRecommendations(pages: PageSchema[]): string[] {
    const flow: string[] = [];

    if (!hasNamedPage(pages, ["home", "landing"])) {
        flow.push("Landing page to frame the product promise");
    } else {
        flow.push("Tighten the landing page narrative around one core action");
    }

    if (!hasNamedPage(pages, ["onboarding", "welcome", "start"])) {
        flow.push("Guided onboarding to get users from blank state to first value");
    } else {
        flow.push("Shorten onboarding to the minimum number of commitment steps");
    }

    if (!hasNamedPage(pages, ["dashboard", "overview", "workspace"])) {
        flow.push("Operational workspace or dashboard for daily usage");
    } else {
        flow.push("Clarify the dashboard hierarchy between insight, action, and status");
    }

    if (!hasNamedPage(pages, ["settings", "profile", "account"])) {
        flow.push("Settings or profile control surface for trust and retention");
    } else {
        flow.push("Connect settings to trust and preference visibility");
    }

    return flow;
}

function buildCopilotResult(
    mode: CopilotMode,
    subject: string,
    guidance: GuidanceItem[],
    quality: QualityDimension[],
    themeDirection: ThemeDirection,
    pages: PageSchema[]
): CopilotResult {
    const weakestDimension = quality.reduce((lowest, current) => current.score < lowest.score ? current : lowest, quality[0]);
    const strongestDimension = quality.reduce((best, current) => current.score > best.score ? current : best, quality[0]);
    const modeLabel = COPILOT_MODES.find((item) => item.key === mode)?.label ?? "Copilot";

    return {
        title: `${modeLabel} plan for ${subject}`,
        summary: `Push the product toward ${themeDirection.theme.toLowerCase()} while protecting ${strongestDimension.label.toLowerCase()}. The biggest gap right now is ${weakestDimension.label.toLowerCase()}.`,
        detail: `Priority the next builder move around ${guidance[0]?.title?.toLowerCase() || "the selected page"}, then tighten hierarchy using the inspector and generated layout preview.`,
        priorities: guidance.map((item, index) => `P${index + 1}: ${item.title}. ${item.description}`),
        nextAction: guidance[0]?.title ?? "Refine the selected page in the inspector.",
        flow: buildFlowRecommendations(pages),
        warnings: [],
    };
}

function mapServerGuidanceItem(item: ServerGuidanceItem): GuidanceItem {
    const action: SuggestionAction =
        item.action_type === "create-page"
            ? { type: "create-page", name: item.action_value || item.title.replace(/^Add\s+/i, "").trim() || "New Page" }
            : item.action_type === "select-page" && item.action_value
                ? { type: "select-page", pageId: item.action_value }
                : item.action_type === "open-inspector"
                    ? { type: "open-inspector" }
                    : item.action_type === "apply-layout"
                        ? { type: "apply-layout" }
                        : { type: "noop", message: item.description };

    return {
        id: item.id,
        title: item.title,
        description: item.description,
        impact: item.impact,
        actionLabel: item.action_label,
        action,
    };
}

function buildResultFromResponse(response: UiBuilderGenerateResponse, fallbackPages: PageSchema[]): CopilotResult {
    const priorities = response.guidance.length > 0
        ? response.guidance.map((item, index) => `P${index + 1}: ${item.title}. ${item.description}`)
        : response.layout_plan?.sections.map((section, index) => `P${index + 1}: ${section.title}. ${section.description}`) || [];
    const flow = response.suggested_pages.length > 0
        ? response.suggested_pages.map((page) => `${page.name}: ${page.reason}`)
        : response.layout_plan?.sections.map((section) => section.title) || buildFlowRecommendations(fallbackPages);

    return {
        title: response.title,
        summary: response.summary || response.answer_markdown,
        detail: response.answer_markdown || response.summary,
        priorities,
        nextAction: response.next_action || response.guidance[0]?.title || "Review the generated layout.",
        flow,
        warnings: response.warnings,
    };
}

function getStatusClasses(status: QueueItem["status"]): string {
    switch (status) {
        case "approved":
            return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
        case "rejected":
            return "border-red-500/30 bg-red-500/10 text-red-300";
        default:
            return "border-[var(--ide-border)] bg-[var(--ide-bg-elevated)] text-[var(--ide-text-muted)]";
    }
}

const AIDesignCopilotPanel: React.FC<AIDesignCopilotPanelProps> = ({ onOpenInspector }) => {
    const { project, selectedPageId, viewport } = useProjectStore();
    const { actions } = useEditor();
    const toast = useToast();

    const [mode, setMode] = useState<CopilotMode>("suggest");
    const [prompt, setPrompt] = useState("");
    const [activeStep, setActiveStep] = useState<number>(0);
    const [isGenerating, setIsGenerating] = useState(false);
    const [result, setResult] = useState<CopilotResult | null>(null);
    const [response, setResponse] = useState<UiBuilderGenerateResponse | null>(null);
    const [queue, setQueue] = useState<QueueItem[]>([]);
    const [pendingActionId, setPendingActionId] = useState<string | null>(null);
    const [generatedBlocks, setGeneratedBlocks] = useState<BlockSchema[]>([]);
    const [isApplyingLayout, setIsApplyingLayout] = useState(false);
    const [previewLoaded, setPreviewLoaded] = useState(false);
    const progressTimerRef = useRef<number | null>(null);

    const pages = useMemo(() => getActivePages(project), [project]);
    const selectedPage = useMemo(
        () => pages.find((page) => page.id === selectedPageId) ?? null,
        [pages, selectedPageId]
    );
    const selectedPageBlockCount = useMemo(
        () => countBlocksForPage(project?.blocks ?? [], selectedPage?.id ?? null),
        [project?.blocks, selectedPage?.id]
    );
    const subject = useMemo(() => inferSubject(prompt, project?.name), [prompt, project?.name]);
    const themeDirection = useMemo(
        () => resolveThemeDirection(`${project?.name ?? ""} ${prompt}`, project?.settings?.theme?.primary_color),
        [project?.name, project?.settings?.theme?.primary_color, prompt]
    );
    const competitorIntel = useMemo(
        () => buildCompetitorIntel(subject, pages),
        [subject, pages]
    );
    const quality = useMemo(
        () => buildQualityDimensions(project, pages, selectedPage, selectedPageBlockCount, viewport),
        [project, pages, selectedPage, selectedPageBlockCount, viewport]
    );
    const guidance = useMemo(
        () => buildGuidanceItems(pages, selectedPage, selectedPageBlockCount),
        [pages, selectedPage, selectedPageBlockCount]
    );
    const effectiveGuidance = useMemo(
        () => (response?.guidance?.length ? response.guidance.map((item) => mapServerGuidanceItem(item)) : guidance),
        [guidance, response]
    );
    const effectiveThemeDirection = response?.theme_direction ?? themeDirection;
    const effectiveCompetitorIntel = response?.competitor_intelligence ?? competitorIntel;
    const effectiveQuality = response?.quality?.length ? response.quality : quality;
    const overallScore = useMemo(
        () => average(effectiveQuality.map((item) => item.score)),
        [effectiveQuality]
    );

    useEffect(() => {
        return () => {
            if (progressTimerRef.current !== null) {
                window.clearInterval(progressTimerRef.current);
            }
        };
    }, []);

    useEffect(() => {
        setQueue((previous) => {
            const previousMap = new Map(previous.map((item) => [item.id, item]));

            return effectiveGuidance.map((item, index) => {
                const existing = previousMap.get(item.id);
                return {
                    ...item,
                    rationale:
                        index === 0
                            ? "Highest-impact move based on the current page set and selected canvas context."
                            : index === 1
                                ? "This closes a major product gap that will otherwise show up during export and review."
                                : "Useful follow-up after the top priorities land.",
                    status: existing?.status ?? "pending",
                    rating: existing?.rating ?? null,
                    comment: existing?.comment ?? "",
                };
            });
        });
    }, [effectiveGuidance]);

    const currentMode = COPILOT_MODES.find((item) => item.key === mode) ?? COPILOT_MODES[0];
    const currentQueueItem = queue.find((item) => item.status === "pending") ?? null;

    const stopProgress = () => {
        if (progressTimerRef.current !== null) {
            window.clearInterval(progressTimerRef.current);
            progressTimerRef.current = null;
        }
    };

    const startProgress = () => {
        stopProgress();
        setActiveStep(0);
        progressTimerRef.current = window.setInterval(() => {
            setActiveStep((previous) =>
                previous < GENERATION_STEPS.length - 1 ? previous + 1 : previous
            );
        }, 520);
    };

    const handlePreviewLayout = async (): Promise<boolean> => {
        const rootBlockId = response?.page?.root_block_id || selectedPage?.root_block_id;
        if (!rootBlockId || generatedBlocks.length === 0) {
            toast.error("No generated layout is available to preview.");
            return false;
        }

        try {
            const serialized = blocksToSerializedNodes(generatedBlocks, rootBlockId);
            actions.deserialize(serialized);
            setPreviewLoaded(true);
            toast.info("Preview loaded into the canvas.");
            return true;
        } catch (error) {
            toast.error(`Preview failed: ${String(error)}`);
            return false;
        }
    };

    const handleApplyLayout = async (): Promise<boolean> => {
        const targetPageId = response?.page?.id || selectedPage?.id;
        if (!targetPageId || generatedBlocks.length === 0) {
            toast.error("No generated layout is available to apply.");
            return false;
        }

        setIsApplyingLayout(true);
        try {
            await applyBuilderLayout(generatedBlocks, targetPageId);
            setPreviewLoaded(false);
            toast.success("Generated layout applied to the selected page.");
            return true;
        } catch (error) {
            toast.error(`Apply failed: ${String(error)}`);
            return false;
        } finally {
            setIsApplyingLayout(false);
        }
    };

    const runAction = async (item: GuidanceItem | QueueItem): Promise<boolean> => {
        setPendingActionId(item.id);
        try {
            switch (item.action.type) {
                case "create-page": {
                    const page = await createPage(item.action.name);
                    selectPage(page.id);
                    toast.success(`Created "${page.name}" from copilot guidance.`);
                    return true;
                }
                case "select-page":
                    selectPage(item.action.pageId);
                    toast.info("Switched the builder to the recommended page.");
                    return true;
                case "open-inspector":
                    onOpenInspector();
                    toast.info("Inspector opened for manual refinement.");
                    return true;
                case "apply-layout":
                    return await handlePreviewLayout();
                case "noop":
                    toast.info(item.action.message ?? "Guidance noted.");
                    return true;
                default:
                    item.action satisfies never;
                    return false;
            }
        } catch (error) {
            toast.error(`Copilot action failed: ${String(error)}`);
            return false;
        } finally {
            setPendingActionId(null);
        }
    };

    const handleApprove = async (item: QueueItem) => {
        const success = await runAction(item);
        if (!success) return;

        setQueue((previous) =>
            previous.map((entry) =>
                entry.id === item.id ? { ...entry, status: "approved" } : entry
            )
        );
    };

    const handleReject = (itemId: string) => {
        setQueue((previous) =>
            previous.map((entry) =>
                entry.id === itemId ? { ...entry, status: "rejected" } : entry
            )
        );
        toast.warning("Suggestion rejected. The queue will surface the next option.");
    };

    const handleRate = (itemId: string, rating: number) => {
        setQueue((previous) =>
            previous.map((entry) =>
                entry.id === itemId ? { ...entry, rating } : entry
            )
        );
    };

    const handleCommentChange = (itemId: string, comment: string) => {
        setQueue((previous) =>
            previous.map((entry) =>
                entry.id === itemId ? { ...entry, comment } : entry
            )
        );
    };

    const handleRunCopilot = async () => {
        setResult(null);
        setResponse(null);
        setGeneratedBlocks([]);
        setPreviewLoaded(false);
        setIsGenerating(true);
        startProgress();

        try {
            const serverResponse = await generateBuilderLayout(mode, prompt);
            stopProgress();
            setActiveStep(GENERATION_STEPS.length);
            setResponse(serverResponse);
            setGeneratedBlocks(serverResponse.blocks || []);
            setResult(buildResultFromResponse(serverResponse, pages));
            if (serverResponse.warnings.length > 0) {
                toast.warning(serverResponse.warnings[0]);
            }
        } catch (error) {
            stopProgress();
            setActiveStep(GENERATION_STEPS.length);
            const fallbackResult = buildCopilotResult(mode, subject, guidance, quality, themeDirection, pages);
            setResult({
                ...fallbackResult,
                detail: `Backend generation failed. Falling back to local builder guidance.\n\n${String(error)}`,
                warnings: [String(error)],
            });
            toast.error(`Copilot generation failed: ${String(error)}`);
        } finally {
            setIsGenerating(false);
        }
    };

    if (!project) {
        return (
            <div className="h-full flex items-center justify-center p-6 text-center text-sm text-[var(--ide-text-muted)]">
                Open a project to activate the design copilot.
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col text-[var(--ide-text)]">
            <div className="border-b border-[var(--ide-border)] bg-[linear-gradient(180deg,rgba(249,115,22,0.12),rgba(6,182,212,0.06)_55%,transparent)]">
                <div className="px-4 py-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-300">
                                Builder-aware preview
                            </div>
                            <h2 className="mt-2 text-lg font-black tracking-tight">AI Design Copilot</h2>
                            <p className="mt-1 text-xs leading-relaxed text-[var(--ide-text-secondary)]">
                                Guides page creation, quality scoring, and next-step execution directly from live builder state.
                            </p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-right shadow-[0_18px_40px_rgba(0,0,0,0.22)]">
                            <div className="text-[9px] uppercase tracking-[0.18em] text-[var(--ide-text-muted)]">Layout score</div>
                            <div className="mt-1 text-2xl font-black text-white">{overallScore}</div>
                            <div className="text-[10px] text-[var(--ide-text-muted)]">out of 100</div>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-xl border border-white/8 bg-black/20 px-3 py-2">
                            <div className="text-[9px] uppercase tracking-[0.14em] text-[var(--ide-text-muted)]">Pages</div>
                            <div className="mt-1 text-sm font-bold">{pages.length}</div>
                        </div>
                        <div className="rounded-xl border border-white/8 bg-black/20 px-3 py-2">
                            <div className="text-[9px] uppercase tracking-[0.14em] text-[var(--ide-text-muted)]">Selected</div>
                            <div className="mt-1 text-sm font-bold truncate">{selectedPage?.name ?? "None"}</div>
                        </div>
                        <div className="rounded-xl border border-white/8 bg-black/20 px-3 py-2">
                            <div className="text-[9px] uppercase tracking-[0.14em] text-[var(--ide-text-muted)]">Viewport</div>
                            <div className="mt-1 text-sm font-bold">{toTitleCase(viewport)}</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                <section className="space-y-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-xs font-black uppercase tracking-[0.18em] text-[var(--ide-text-muted)]">Interaction mode</h3>
                            <p className="mt-1 text-xs text-[var(--ide-text-secondary)]">{currentMode.summary}</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        {COPILOT_MODES.map((item) => (
                            <button
                                key={item.key}
                                onClick={() => setMode(item.key)}
                                className={`rounded-2xl border px-3 py-3 text-left transition-all ${mode === item.key
                                    ? "border-cyan-500/40 bg-cyan-500/12 shadow-[0_14px_32px_rgba(6,182,212,0.14)]"
                                    : "border-[var(--ide-border)] bg-[var(--ide-bg-elevated)] hover:border-white/15 hover:bg-white/[0.04]"
                                    }`}
                            >
                                <div className="text-sm font-bold">{item.label}</div>
                                <div className="mt-1 text-[11px] leading-relaxed text-[var(--ide-text-secondary)]">{item.summary}</div>
                            </button>
                        ))}
                    </div>
                </section>

                <section className="rounded-3xl border border-[var(--ide-border)] bg-[var(--ide-bg-elevated)] p-4 shadow-[0_16px_40px_rgba(0,0,0,0.16)]">
                    <div className="flex items-center justify-between gap-2">
                        <div>
                            <h3 className="text-sm font-black">Progressive response</h3>
                            <p className="mt-1 text-xs text-[var(--ide-text-secondary)]">
                                The copilot walks through the same staged output model defined in the feature plan.
                            </p>
                        </div>
                        <button
                            onClick={handleRunCopilot}
                            disabled={isGenerating}
                            className="rounded-xl bg-cyan-500 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-slate-950 transition-all hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {isGenerating ? "Thinking..." : currentMode.button}
                        </button>
                    </div>

                    <div className="mt-3">
                        <textarea
                            value={prompt}
                            onChange={(event) => setPrompt(event.target.value)}
                            placeholder={currentMode.placeholder}
                            className="h-28 w-full resize-none rounded-2xl border border-[var(--ide-border)] bg-[var(--ide-bg)] px-4 py-3 text-sm text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)] focus:outline-none focus:border-cyan-500/50"
                        />
                    </div>

                    <div className="mt-4 grid gap-2">
                        {GENERATION_STEPS.map((step, index) => {
                            const isComplete = activeStep > index || (!isGenerating && activeStep >= GENERATION_STEPS.length);
                            const isActive = isGenerating && activeStep === index;

                            return (
                                <div
                                    key={step.title}
                                    className={`rounded-2xl border px-3 py-3 transition-all ${isActive
                                        ? "border-cyan-500/40 bg-cyan-500/12"
                                        : isComplete
                                            ? "border-emerald-500/30 bg-emerald-500/10"
                                            : "border-[var(--ide-border)] bg-[var(--ide-bg)]"
                                        }`}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="text-sm font-semibold">{step.title}</div>
                                        <div className={`h-2.5 w-2.5 rounded-full ${isActive ? "bg-cyan-400 animate-pulse" : isComplete ? "bg-emerald-400" : "bg-white/15"}`} />
                                    </div>
                                    <p className="mt-1 text-xs text-[var(--ide-text-secondary)]">{step.description}</p>
                                </div>
                            );
                        })}
                    </div>

                    {isGenerating && (
                        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                            <div className="h-3 w-2/3 rounded-full bg-white/10 animate-pulse" />
                            <div className="mt-3 h-2.5 w-full rounded-full bg-white/10 animate-pulse" />
                            <div className="mt-2 h-2.5 w-5/6 rounded-full bg-white/10 animate-pulse" />
                            <div className="mt-2 h-2.5 w-4/6 rounded-full bg-white/10 animate-pulse" />
                        </div>
                    )}

                    {result && !isGenerating && (
                        <div className="mt-4 space-y-3 rounded-2xl border border-cyan-500/25 bg-[linear-gradient(180deg,rgba(6,182,212,0.1),rgba(17,24,39,0.18))] p-4">
                            <div>
                                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-300">Copilot output</div>
                                <h4 className="mt-1 text-base font-black">{result.title}</h4>
                                <p className="mt-2 text-sm leading-relaxed text-[var(--ide-text-secondary)]">{result.summary}</p>
                            </div>

                            <div className="space-y-2">
                                {result.priorities.map((priority) => (
                                    <div key={priority} className="rounded-2xl border border-white/8 bg-black/20 px-3 py-2 text-xs leading-relaxed text-[var(--ide-text-secondary)]">
                                        {priority}
                                    </div>
                                ))}
                            </div>

                            <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-3 py-3">
                                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-300">Next best action</div>
                                <div className="mt-1 text-sm font-semibold">{result.nextAction}</div>
                            </div>

                            <div>
                                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--ide-text-muted)]">Recommended flow</div>
                                <div className="mt-2 space-y-2">
                                    {result.flow.map((item, index) => (
                                        <div key={item} className="flex items-start gap-2 rounded-xl border border-white/8 bg-black/10 px-3 py-2">
                                            <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500/15 text-[10px] font-black text-cyan-300">
                                                {index + 1}
                                            </div>
                                            <div className="text-xs leading-relaxed text-[var(--ide-text-secondary)]">{item}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </section>

                <section className="rounded-3xl border border-[var(--ide-border)] bg-[var(--ide-bg-elevated)] p-4">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <h3 className="text-sm font-black">AI guidance dashboard</h3>
                            <p className="mt-1 text-xs text-[var(--ide-text-secondary)]">
                                Suggests the next highest-impact moves from the current builder state.
                            </p>
                        </div>
                        <div className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--ide-text-muted)]">
                            {guidance.length} live suggestions
                        </div>
                    </div>

                    <div className="mt-4 space-y-3">
                        {guidance.map((item) => (
                            <div key={item.id} className="rounded-2xl border border-[var(--ide-border)] bg-[var(--ide-bg)] p-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <h4 className="text-sm font-bold">{item.title}</h4>
                                        <p className="mt-1 text-xs leading-relaxed text-[var(--ide-text-secondary)]">{item.description}</p>
                                    </div>
                                    <button
                                        onClick={() => void runAction(item)}
                                        disabled={pendingActionId === item.id}
                                        className="shrink-0 rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-300 transition-all hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {pendingActionId === item.id ? "Working..." : item.actionLabel}
                                    </button>
                                </div>
                                <div className="mt-3 inline-flex rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-300">
                                    {item.impact}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="rounded-3xl border border-[var(--ide-border)] bg-[var(--ide-bg-elevated)] p-4">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <h3 className="text-sm font-black">Feature suggestion queue</h3>
                            <p className="mt-1 text-xs text-[var(--ide-text-secondary)]">
                                Review one proposal at a time and keep approval decisions explicit.
                            </p>
                        </div>
                        <div className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--ide-text-muted)]">
                            {queue.filter((item) => item.status === "pending").length} pending
                        </div>
                    </div>

                    {currentQueueItem ? (
                        <div className="mt-4 rounded-2xl border border-[var(--ide-border)] bg-[var(--ide-bg)] p-4">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--ide-text-muted)]">Up next</div>
                                    <h4 className="mt-1 text-sm font-black">{currentQueueItem.title}</h4>
                                </div>
                                <div className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${getStatusClasses(currentQueueItem.status)}`}>
                                    {currentQueueItem.status}
                                </div>
                            </div>

                            <p className="mt-2 text-xs leading-relaxed text-[var(--ide-text-secondary)]">
                                {currentQueueItem.description}
                            </p>
                            <p className="mt-2 rounded-xl border border-white/8 bg-black/10 px-3 py-2 text-xs leading-relaxed text-[var(--ide-text-secondary)]">
                                {currentQueueItem.rationale}
                            </p>

                            <div className="mt-4">
                                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--ide-text-muted)]">Rate usefulness</div>
                                <div className="mt-2 flex gap-2">
                                    {[1, 2, 3, 4, 5].map((rating) => (
                                        <button
                                            key={rating}
                                            onClick={() => handleRate(currentQueueItem.id, rating)}
                                            className={`h-8 w-8 rounded-full border text-xs font-black transition-all ${currentQueueItem.rating === rating
                                                ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-300"
                                                : "border-[var(--ide-border)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"
                                                }`}
                                        >
                                            {rating}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="mt-4">
                                <label className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--ide-text-muted)]">
                                    Comment
                                </label>
                                <textarea
                                    value={currentQueueItem.comment}
                                    onChange={(event) => handleCommentChange(currentQueueItem.id, event.target.value)}
                                    placeholder="Explain why this should be refined, delayed, or expanded."
                                    className="mt-2 h-24 w-full resize-none rounded-2xl border border-[var(--ide-border)] bg-[var(--ide-bg)] px-3 py-2 text-xs text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)] focus:outline-none focus:border-cyan-500/50"
                                />
                            </div>

                            <div className="mt-4 flex gap-2">
                                <button
                                    onClick={() => void handleApprove(currentQueueItem)}
                                    disabled={pendingActionId === currentQueueItem.id}
                                    className="flex-1 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-slate-950 transition-all hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {pendingActionId === currentQueueItem.id ? "Applying..." : "Approve"}
                                </button>
                                <button
                                    onClick={() => handleReject(currentQueueItem.id)}
                                    className="flex-1 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-red-300 transition-all hover:bg-red-500/20"
                                >
                                    Reject
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="mt-4 rounded-2xl border border-dashed border-[var(--ide-border)] bg-[var(--ide-bg)] px-4 py-6 text-center">
                            <div className="text-sm font-bold">Queue cleared</div>
                            <p className="mt-1 text-xs text-[var(--ide-text-secondary)]">
                                All current suggestions were reviewed. Generate another pass after new builder changes.
                            </p>
                        </div>
                    )}
                </section>

                <section className="rounded-3xl border border-[var(--ide-border)] bg-[var(--ide-bg-elevated)] p-4">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <h3 className="text-sm font-black">Layout quality validator</h3>
                            <p className="mt-1 text-xs text-[var(--ide-text-secondary)]">
                                Scores the current design direction across clarity, accessibility, hierarchy, responsiveness, and conversion.
                            </p>
                        </div>
                        <div className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--ide-text-muted)]">
                            Context aware
                        </div>
                    </div>

                    <div className="mt-4 space-y-3">
                        {quality.map((item) => (
                            <div key={item.key} className="rounded-2xl border border-[var(--ide-border)] bg-[var(--ide-bg)] p-3">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="text-sm font-semibold">{item.label}</div>
                                    <div className="text-sm font-black text-white">{item.score}</div>
                                </div>
                                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/8">
                                    <div
                                        className={`h-full rounded-full ${item.score >= 80 ? "bg-emerald-400" : item.score >= 65 ? "bg-amber-400" : "bg-rose-400"}`}
                                        style={{ width: `${item.score}%` }}
                                    />
                                </div>
                                <p className="mt-2 text-xs leading-relaxed text-[var(--ide-text-secondary)]">{item.note}</p>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="rounded-3xl border border-[var(--ide-border)] bg-[var(--ide-bg-elevated)] p-4">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h3 className="text-sm font-black">Theme and metaphor generator</h3>
                            <p className="mt-1 text-xs text-[var(--ide-text-secondary)]">
                                Suggests a visual language the builder can use as a consistent north star.
                            </p>
                        </div>
                        <div className="rounded-full border border-cyan-500/25 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-300">
                            {themeDirection.theme}
                        </div>
                    </div>

                    <div className="mt-4 grid gap-3">
                        <div className="rounded-2xl border border-white/8 bg-[linear-gradient(135deg,rgba(15,23,42,0.8),rgba(6,182,212,0.12),rgba(249,115,22,0.12))] p-4">
                            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--ide-text-muted)]">Metaphor</div>
                            <div className="mt-1 text-sm font-black">{themeDirection.metaphor}</div>
                            <div className="mt-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--ide-text-muted)]">Motion</div>
                            <div className="mt-1 text-xs leading-relaxed text-[var(--ide-text-secondary)]">{themeDirection.motion}</div>
                        </div>

                        <div className="rounded-2xl border border-[var(--ide-border)] bg-[var(--ide-bg)] p-4">
                            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--ide-text-muted)]">Typography</div>
                            <div className="mt-1 text-sm font-semibold">{themeDirection.typography}</div>
                            <p className="mt-2 text-xs leading-relaxed text-[var(--ide-text-secondary)]">{themeDirection.note}</p>

                            <div className="mt-4 flex items-center gap-2">
                                {themeDirection.palette.map((color) => (
                                    <div key={color} className="flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-2 py-1">
                                        <span className="h-3 w-3 rounded-full border border-white/20" style={{ backgroundColor: color }} />
                                        <span className="text-[10px] font-mono text-[var(--ide-text-secondary)]">{color}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                <section className="rounded-3xl border border-[var(--ide-border)] bg-[var(--ide-bg-elevated)] p-4">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h3 className="text-sm font-black">Competitor intelligence</h3>
                            <p className="mt-1 text-xs text-[var(--ide-text-secondary)]">
                                Keeps the builder focused on where the product can look sharper than comparable tools.
                            </p>
                        </div>
                        <div className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-amber-300">
                            {mode === "compete" ? "Focused" : "Ready"}
                        </div>
                    </div>

                    <div className="mt-4 grid gap-3">
                        <div className="rounded-2xl border border-[var(--ide-border)] bg-[var(--ide-bg)] p-4">
                            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--ide-text-muted)]">Common patterns</div>
                            <div className="mt-2 space-y-2">
                                {competitorIntel.patterns.map((item) => (
                                    <div key={item} className="rounded-xl border border-white/8 bg-black/10 px-3 py-2 text-xs leading-relaxed text-[var(--ide-text-secondary)]">
                                        {item}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-300">Strengths</div>
                                <div className="mt-2 space-y-2">
                                    {competitorIntel.strengths.map((item) => (
                                        <div key={item} className="text-xs leading-relaxed text-emerald-50/90">{item}</div>
                                    ))}
                                </div>
                            </div>
                            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4">
                                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-rose-300">Weaknesses</div>
                                <div className="mt-2 space-y-2">
                                    {competitorIntel.weaknesses.map((item) => (
                                        <div key={item} className="text-xs leading-relaxed text-rose-50/90">{item}</div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4">
                            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-300">Differentiation strategy</div>
                            <div className="mt-2 space-y-2">
                                {competitorIntel.differentiation.map((item) => (
                                    <div key={item} className="rounded-xl border border-cyan-500/10 bg-black/10 px-3 py-2 text-xs leading-relaxed text-cyan-50/90">
                                        {item}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default AIDesignCopilotPanel;
