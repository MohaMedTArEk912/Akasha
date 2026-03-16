import React, { useEffect, useMemo, useRef, useState } from "react";
import { useProjectStore } from "../../../hooks/useProjectStore";
import { addPage, applyBuilderLayout, generateBuilderLayout, selectPage } from "../../../stores/projectStore";
import { useToast } from "../../../context/ToastContext";
import type { UiBuilderGenerateResponse } from "../../../types/uiBuilder";

export type ArchitectFieldKey =
    | "productVision"
    | "targetAudience"
    | "coreFlows"
    | "tone"
    | "brandKeywords"
    | "colorPalette"
    | "typography"
    | "spacingRadius"
    | "components"
    | "statesMotion"
    | "accessibility"
    | "responsiveRules";

interface ArchitectField {
    key: ArchitectFieldKey;
    label: string;
    placeholder: string;
}

const ARCHITECT_FIELDS: ArchitectField[] = [
    { key: "coreFlows", label: "Core Flows", placeholder: "Main journeys: onboarding, primary tasks, checkout, etc." },
    { key: "tone", label: "Personality", placeholder: "Voice and emotional tone: calm, assertive, playful, etc." },
    { key: "brandKeywords", label: "Brand Keywords", placeholder: "Words that should define the visual system." },
    { key: "colorPalette", label: "Color Strategy", placeholder: "Brand, semantic, and accent colors (HEX or names)." },
    { key: "typography", label: "Typography", placeholder: "Font families, scale preferences, and hierarchy notes." },
    { key: "spacingRadius", label: "Spacing + Radius", placeholder: "Spacing rhythm and corner language." },
    { key: "components", label: "Component System", placeholder: "Critical components and variants needed." },
    { key: "statesMotion", label: "States + Motion", placeholder: "Hover/focus/error/loading and animation guidance." },
    { key: "accessibility", label: "Accessibility", placeholder: "Contrast goals, keyboard behavior, and semantics." },
    { key: "responsiveRules", label: "Responsive Rules", placeholder: "How layout adapts across desktop/tablet/mobile." },
];

export interface ArchitectFormType {
    name: string;
    industry: string;
    platform: "web" | "mobile" | "both";
    styleDirection: string;
    productVision: string;
    targetAudience: string;
    coreFlows: string;
    tone: string;
    brandKeywords: string;
    colorPalette: string;
    typography: string;
    spacingRadius: string;
    components: string;
    statesMotion: string;
    accessibility: string;
    responsiveRules: string;
}

export type ThemeMode = "dark" | "light" | "system";
export type SpacingScale = "compact" | "balanced" | "comfortable";
export type AnimationSpeed = "slow" | "normal" | "fast";
export type ContainerWidth = "narrow" | "standard" | "wide";

type BackgroundFieldKey = "name" | "industry" | "platform" | "productVision" | "targetAudience";

interface ArchitectDraftStorage {
    version: 2;
    form: Partial<ArchitectFormType>;
    manualBackgroundFields?: Partial<Record<BackgroundFieldKey, boolean>>;
}

const initialForm: ArchitectFormType = {
    name: "",
    industry: "",
    platform: "web",
    styleDirection: "Bold editorial with clean data density",
    productVision: "",
    targetAudience: "",
    coreFlows: "",
    tone: "Confident, clear, and focused",
    brandKeywords: "precision, trust, modern",
    colorPalette: "#0B132B, #1C2541, #3A506B, #5BC0BE, #F3F4F6",
    typography: "Sora for headings, IBM Plex Sans for UI",
    spacingRadius: "8px rhythm, radius 12px for cards and 999px for pills",
    components: "top nav, side navigation, cards, data table, modal, form controls",
    statesMotion: "subtle 180ms transitions, reduce motion respected",
    accessibility: "WCAG AA minimum, visible focus rings, keyboard first",
    responsiveRules: "desktop 12-col grid, tablet 8-col, mobile stacked",
};

const ARCHITECT_DRAFT_STORAGE_KEY = "akasha_ui_architect_draft";
const BACKGROUND_FIELDS: BackgroundFieldKey[] = ["name", "industry", "platform", "productVision", "targetAudience"];

function slugify(input: string): string {
    return input
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "page";
}

function downloadText(content: string, fileName: string): void {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function parsePalette(input: string): string[] {
    return input
        .split(",")
        .map((token) => token.trim())
        .filter((token) => token.length > 0)
        .slice(0, 8);
}

function parseTypography(input: string): { heading: string; body: string } {
    const [heading, body] = input.split("for").map((part) => part.trim());
    return {
        heading: heading || "Sora",
        body: body || "IBM Plex Sans",
    };
}

function isSameText(a: string, b: string): boolean {
    return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function isDraftStorageV2(value: unknown): value is ArchitectDraftStorage {
    if (!value || typeof value !== "object") return false;
    const draft = value as Partial<ArchitectDraftStorage>;
    return draft.version === 2 && !!draft.form && typeof draft.form === "object";
}

export function inferPlatformFromIdea(ideaDetails: unknown): ArchitectFormType["platform"] | null {
    if (!ideaDetails || typeof ideaDetails !== "object") return null;
    const product = (ideaDetails as { product?: { platforms?: unknown } }).product;
    const platforms = Array.isArray(product?.platforms)
        ? product.platforms.filter((item): item is string => typeof item === "string")
        : [];

    if (platforms.length === 0) return null;
    const combined = platforms.join(" ").toLowerCase();

    const hasWeb = /web|browser|website/.test(combined);
    const hasMobile = /mobile|ios|android|app/.test(combined);

    if (hasWeb && hasMobile) return "both";
    if (hasMobile) return "mobile";
    return "web";
}

function pickFirstText(values: unknown[]): string {
    for (const value of values) {
        if (typeof value === "string" && value.trim()) return value.trim();
    }
    return "";
}

function inferVisionFromIdea(ideaDetails: unknown): string {
    if (!ideaDetails || typeof ideaDetails !== "object") return "";
    const details = ideaDetails as {
        problem?: unknown;
        solution?: unknown;
        valueProposition?: unknown;
        summary?: unknown;
        product?: { summary?: unknown; pitch?: unknown };
    };
    return pickFirstText([
        details.valueProposition,
        details.solution,
        details.problem,
        details.summary,
        details.product?.summary,
        details.product?.pitch,
    ]);
}

function inferAudienceFromIdea(ideaDetails: unknown): string {
    if (!ideaDetails || typeof ideaDetails !== "object") return "";
    const details = ideaDetails as {
        targetAudience?: unknown;
        audience?: unknown;
        users?: unknown;
        product?: { audience?: unknown };
    };
    return pickFirstText([
        details.targetAudience,
        details.audience,
        details.users,
        details.product?.audience,
    ]);
}

interface ArchitectFormProps {
    onOpenBuilder: () => void;
}

const ArchitectForm: React.FC<ArchitectFormProps> = ({ onOpenBuilder }) => {
    const { project, selectedPageId } = useProjectStore();
    const toast = useToast();

    const [form, setForm] = useState<ArchitectFormType>(initialForm);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isApplying, setIsApplying] = useState(false);
    const [lastResult, setLastResult] = useState<UiBuilderGenerateResponse | null>(null);
    const [themeMode, setThemeMode] = useState<ThemeMode>("dark");
    const [spacingScale, setSpacingScale] = useState<SpacingScale>("balanced");
    const [animationSpeed, setAnimationSpeed] = useState<AnimationSpeed>("normal");
    const [containerWidth, setContainerWidth] = useState<ContainerWidth>("standard");
    const didNormalizeDraftRef = useRef(false);
    const manualBackgroundFieldsRef = useRef<Record<BackgroundFieldKey, boolean>>({
        name: false,
        industry: false,
        platform: false,
        productVision: false,
        targetAudience: false,
    });

    const pages = useMemo(() => project?.pages.filter((p) => !p.archived) ?? [], [project]);

    useEffect(() => {
        try {
            const raw = localStorage.getItem(ARCHITECT_DRAFT_STORAGE_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw) as unknown;

            if (isDraftStorageV2(parsed)) {
                const manual = {
                    name: !!parsed.manualBackgroundFields?.name,
                    industry: !!parsed.manualBackgroundFields?.industry,
                    platform: !!parsed.manualBackgroundFields?.platform,
                    productVision: !!parsed.manualBackgroundFields?.productVision,
                    targetAudience: !!parsed.manualBackgroundFields?.targetAudience,
                };
                manualBackgroundFieldsRef.current = manual;
                setForm((prev) => {
                    const next = { ...prev, ...parsed.form } as ArchitectFormType;
                    BACKGROUND_FIELDS.forEach((field) => {
                        if (!manual[field]) next[field] = initialForm[field];
                    });
                    return next;
                });
                return;
            }

            // Legacy drafts may contain previously auto-filled values. Keep non-background fields only.
            const legacy = parsed as Partial<ArchitectFormType>;
            setForm((prev) => {
                const next = { ...prev, ...legacy } as ArchitectFormType;
                BACKGROUND_FIELDS.forEach((field) => {
                    next[field] = initialForm[field];
                });
                return next;
            });
        } catch {
            // Ignore malformed drafts and keep defaults.
        }
    }, []);

    useEffect(() => {
        if (!project || didNormalizeDraftRef.current) return;

        const ideaDetails = project.settings?.ideaDetails;
        const inferredName = ideaDetails?.ideaMetadata?.ideaName || project.name || "";
        const inferredIndustry = ideaDetails?.ideaMetadata?.industry || ideaDetails?.ideaMetadata?.category || "";
        const inferredPlatform = inferPlatformFromIdea(ideaDetails);
        const inferredVision = inferVisionFromIdea(ideaDetails);
        const inferredAudience = inferAudienceFromIdea(ideaDetails);

        didNormalizeDraftRef.current = true;
        setForm((prev) => ({
            ...prev,
            name: inferredName && isSameText(prev.name, inferredName) ? "" : prev.name,
            industry: inferredIndustry && isSameText(prev.industry, inferredIndustry) ? "" : prev.industry,
            platform: inferredPlatform && prev.platform === inferredPlatform ? initialForm.platform : prev.platform,
            productVision: inferredVision && isSameText(prev.productVision, inferredVision) ? "" : prev.productVision,
            targetAudience: inferredAudience && isSameText(prev.targetAudience, inferredAudience) ? "" : prev.targetAudience,
        }));
    }, [project]);

    useEffect(() => {
        try {
            const payload: ArchitectDraftStorage = {
                version: 2,
                form,
                manualBackgroundFields: manualBackgroundFieldsRef.current,
            };
            localStorage.setItem(ARCHITECT_DRAFT_STORAGE_KEY, JSON.stringify(payload));
        } catch {
            // Ignore storage failures
        }
    }, [form]);

    const backgroundContext = useMemo(() => {
        const ideaDetails = project?.settings?.ideaDetails;
        const inferredName = ideaDetails?.ideaMetadata?.ideaName || project?.name || "";
        const inferredIndustry = ideaDetails?.ideaMetadata?.industry || ideaDetails?.ideaMetadata?.category || "";
        const inferredPlatform = inferPlatformFromIdea(ideaDetails);
        const inferredVision = inferVisionFromIdea(ideaDetails);
        const inferredAudience = inferAudienceFromIdea(ideaDetails);

        return {
            name: inferredName || form.name,
            industry: inferredIndustry || form.industry,
            platform: inferredPlatform || form.platform,
            productVision: inferredVision || form.productVision,
            targetAudience: inferredAudience || form.targetAudience,
        };
    }, [form.industry, form.name, form.platform, form.productVision, form.targetAudience, project]);

    const designSystem = useMemo<Record<string, unknown>>(() => ({
        project: {
            name: backgroundContext.name || project?.name || "Untitled Product",
            industry: backgroundContext.industry,
            platform: backgroundContext.platform,
            styleDirection: form.styleDirection,
        },
        foundations: {
            colorPalette: form.colorPalette,
            typography: form.typography,
            spacingRadius: form.spacingRadius,
            tone: form.tone,
            brandKeywords: form.brandKeywords,
        },
        ux: {
            audience: backgroundContext.targetAudience,
            coreFlows: form.coreFlows,
            accessibility: form.accessibility,
            responsiveRules: form.responsiveRules,
            statesMotion: form.statesMotion,
        },
        components: form.components,
        vision: backgroundContext.productVision,
        globals: { themeMode, spacingScale, animationSpeed, containerWidth },
    }), [animationSpeed, backgroundContext, containerWidth, form, project?.name, spacingScale, themeMode]);

    const palette = useMemo(() => parsePalette(form.colorPalette), [form.colorPalette]);
    const typography = useMemo(() => parseTypography(form.typography), [form.typography]);

    const previewTokens = useMemo(() => {
        const primary = palette[0] || "#06b6d4";
        const secondary = palette[1] || "#1c2541";
        const accent = palette[2] || "#f97316";
        const surface = themeMode === "light" ? "#f8fafc" : "#0f172a";
        const panel = themeMode === "light" ? "#ffffff" : "#111827";
        const textMain = themeMode === "light" ? "#0f172a" : "#e5e7eb";
        const textMuted = themeMode === "light" ? "#64748b" : "#94a3b8";
        const radius = /\d+\s*px|\d+px|full/i.test(form.spacingRadius)
            ? (form.spacingRadius.match(/\d+\s*px|\d+px/)?.[0] ?? "12px")
            : "12px";
        const spacing = spacingScale === "compact" ? 10 : spacingScale === "comfortable" ? 20 : 14;
        const motionMs = animationSpeed === "slow" ? 320 : animationSpeed === "fast" ? 120 : 180;
        const contentWidth = containerWidth === "narrow" ? "860px" : containerWidth === "wide" ? "1280px" : "1080px";

        return {
            primary, secondary, accent, surface, panel, textMain, textMuted,
            radius, spacing, motionMs, contentWidth,
            headingFont: typography.heading, bodyFont: typography.body,
        };
    }, [animationSpeed, containerWidth, form.spacingRadius, palette, spacingScale, themeMode, typography]);

    const componentSchema = useMemo(() => {
        const componentNames = form.components.split(",").map((item) => item.trim()).filter(Boolean);
        return componentNames.map((name) => ({
            name,
            variants: ["default", "compact", "emphasis"],
            states: ["default", "hover", "focus", "disabled"],
            accessibility: { keyboard: true, ariaRequired: true },
        }));
    }, [form.components]);

    const structuredPrompt = useMemo(() => {
        const promptProjectName = backgroundContext.name || project?.name || "Untitled Product";
        return [
            `You are Akasha AI UI Architect. Produce a production-ready UI plan for ${promptProjectName}.`,
            "Use the provided designSystem object as source-of-truth constraints.",
            "Leverage Qwen-style structured reasoning and output pragmatic layout decisions.",
            "Return component hierarchy, section-level structure, and implementation-ready block guidance.",
            "Prioritize consistency, accessibility, and responsive behavior.",
            `Background idea context: industry=${backgroundContext.industry || "n/a"}; platform=${backgroundContext.platform}; vision=${backgroundContext.productVision || "n/a"}; audience=${backgroundContext.targetAudience || "n/a"}.`,
        ].join(" ");
    }, [backgroundContext, project?.name]);

    const contextItems = useMemo(() => ([
        { label: "Product", value: backgroundContext.name || "Not detected" },
        { label: "Industry", value: backgroundContext.industry || "Not detected" },
        { label: "Platform", value: backgroundContext.platform || "web" },
        { label: "Vision", value: backgroundContext.productVision || "Not detected" },
        { label: "Audience", value: backgroundContext.targetAudience || "Not detected" },
    ]), [backgroundContext]);

    const createExportPayload = useMemo(() => () => ({
        version: "1.0.0",
        generatedAt: new Date().toISOString(),
        designSystem,
        tokens: {
            color: { palette, primary: previewTokens.primary, secondary: previewTokens.secondary, accent: previewTokens.accent, surface: previewTokens.surface, panel: previewTokens.panel, textMain: previewTokens.textMain, textMuted: previewTokens.textMuted },
            typography: { headingFont: previewTokens.headingFont, bodyFont: previewTokens.bodyFont },
            spacing: { scale: spacingScale, baseUnit: previewTokens.spacing },
            radius: { base: previewTokens.radius },
            motion: { speed: animationSpeed, durationMs: previewTokens.motionMs },
            layout: { containerWidth: previewTokens.contentWidth, platform: backgroundContext.platform, responsiveRules: form.responsiveRules },
        },
        componentSchema,
        uiDocs: {
            vision: backgroundContext.productVision,
            targetAudience: backgroundContext.targetAudience,
            coreFlows: form.coreFlows,
            accessibility: form.accessibility,
            statesMotion: form.statesMotion,
            styleDirection: form.styleDirection,
            brandKeywords: form.brandKeywords,
        },
        ai: { prompt: structuredPrompt },
    }), [animationSpeed, backgroundContext, componentSchema, designSystem, form, palette, previewTokens, spacingScale, structuredPrompt]);

    const handleFieldChange = <K extends keyof ArchitectFormType>(key: K, value: ArchitectFormType[K]) => {
        if (BACKGROUND_FIELDS.includes(key as BackgroundFieldKey)) {
            manualBackgroundFieldsRef.current[key as BackgroundFieldKey] = true;
        }
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const ensureSelectedPage = async (): Promise<string> => {
        if (selectedPageId && pages.some((page) => page.id === selectedPageId)) {
            return selectedPageId;
        }
        if (pages.length > 0) {
            selectPage(pages[0].id);
            return pages[0].id;
        }
        const pageName = backgroundContext.name ? `${backgroundContext.name} Home` : "Home";
        const pagePath = `/${slugify(pageName)}`;
        const created = await addPage(pageName, pagePath);
        selectPage(created.id);
        return created.id;
    };

    const handleGenerateArchitecture = async () => {
        if (!project) {
            toast.error("Open a project before generating UI architecture.");
            return;
        }
        setIsGenerating(true);
        try {
            const response = await generateBuilderLayout("create", structuredPrompt, designSystem);
            setLastResult(response);
            if (response.warnings.length > 0) toast.warning(response.warnings[0]);
            if (response.blocks.length > 0) toast.success("AI Architect generated a layout. Review it, then click Apply Layout.");
            else toast.warning("AI Architect returned no blocks. Update constraints and try again.");
        } catch (error) {
            toast.error(`Generation failed: ${String(error)}`);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleApplyLatestLayout = async () => {
        if (!lastResult || lastResult.blocks.length === 0) {
            toast.error("No generated layout to apply yet.");
            return;
        }
        setIsApplying(true);
        try {
            const ensuredPageId = await ensureSelectedPage();
            await applyBuilderLayout(lastResult.blocks, ensuredPageId);
            toast.success("Latest generated layout applied.");
            onOpenBuilder();
        } catch (error) {
            toast.error(`Apply failed: ${String(error)}`);
        } finally {
            setIsApplying(false);
        }
    };

    const handleExportJson = () => { downloadText(JSON.stringify(createExportPayload(), null, 2), "ui-architect-export.json"); toast.success("UI Architect export JSON generated."); };
    const handleExportPrompt = () => { downloadText(`${structuredPrompt}\n\nArchitect Export:\n${JSON.stringify(createExportPayload(), null, 2)}`, "ui-architect-prompt.txt"); toast.success("Prompt package exported."); };
    const handleCopyJson = async () => { try { await navigator.clipboard.writeText(JSON.stringify(createExportPayload(), null, 2)); toast.success("Architect export copied to clipboard."); } catch { toast.error("Clipboard copy failed."); } };

    return (
        <div className="flex-1 overflow-hidden bg-[radial-gradient(circle_at_12%_10%,rgba(16,185,129,0.14),transparent_34%),radial-gradient(circle_at_88%_18%,rgba(245,158,11,0.12),transparent_36%),linear-gradient(160deg,#060b15_0%,#060b12_45%,#0d1722_100%)]">
            <div className="h-full grid grid-cols-1 xl:grid-cols-[1.7fr_1fr]">
                <section className="overflow-y-auto border-r border-white/10 p-6 lg:p-8">
                    <div className="mx-auto max-w-5xl space-y-5">
                        <div className="rounded-2xl border border-emerald-300/25 bg-gradient-to-r from-emerald-500/14 via-teal-500/8 to-transparent p-5 shadow-[0_0_0_1px_rgba(16,185,129,0.08)_inset]">
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-200/90">AI Design Control Center</p>
                            <h2 className="mt-1 text-lg font-black text-white">Design System Builder</h2>
                            <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-200/75">Define editable constraints only. Product and audience context is locked from your idea and injected in the background for every generation.</p>
                            <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
                                {contextItems.map((item) => (
                                    <div key={item.label} className="rounded-lg border border-white/10 bg-slate-950/45 px-3 py-2">
                                        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{item.label}</div>
                                        <div className="mt-1 line-clamp-2 text-[11px] font-semibold text-slate-100">{item.value}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                            <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-300">Global Controls</h3>
                            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                                <label className="space-y-1">
                                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-300/80">Theme</span>
                                    <select value={themeMode} onChange={(e) => setThemeMode(e.target.value as ThemeMode)} className="h-10 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 text-sm text-slate-100 focus:border-emerald-400/50 focus:outline-none">
                                        <option value="dark">Dark</option><option value="light">Light</option><option value="system">System</option>
                                    </select>
                                </label>
                                <label className="space-y-1">
                                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-300/80">Spacing Scale</span>
                                    <select value={spacingScale} onChange={(e) => setSpacingScale(e.target.value as SpacingScale)} className="h-10 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 text-sm text-slate-100 focus:border-emerald-400/50 focus:outline-none">
                                        <option value="compact">Compact</option><option value="balanced">Balanced</option><option value="comfortable">Comfortable</option>
                                    </select>
                                </label>
                                <label className="space-y-1">
                                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-300/80">Animation Speed</span>
                                    <select value={animationSpeed} onChange={(e) => setAnimationSpeed(e.target.value as AnimationSpeed)} className="h-10 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 text-sm text-slate-100 focus:border-emerald-400/50 focus:outline-none">
                                        <option value="slow">Slow</option><option value="normal">Normal</option><option value="fast">Fast</option>
                                    </select>
                                </label>
                                <label className="space-y-1">
                                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-300/80">Container</span>
                                    <select value={containerWidth} onChange={(e) => setContainerWidth(e.target.value as ContainerWidth)} className="h-10 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 text-sm text-slate-100 focus:border-emerald-400/50 focus:outline-none">
                                        <option value="narrow">Narrow</option><option value="standard">Standard</option><option value="wide">Wide</option>
                                    </select>
                                </label>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                            <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-300">UX And Visual Constraints</h3>
                            <div className="mt-3 grid grid-cols-1 gap-3">
                                <label className="space-y-1">
                                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-300/80">Style Direction</span>
                                    <input value={form.styleDirection} onChange={(e) => handleFieldChange("styleDirection", e.target.value)} className="h-10 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 text-sm text-slate-100 focus:border-emerald-400/50 focus:outline-none" />
                                </label>
                            </div>
                            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                                {ARCHITECT_FIELDS.map((field) => (
                                    <label key={field.key} className="space-y-1">
                                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-300/80">{field.label}</span>
                                        <textarea
                                            value={form[field.key]}
                                            onChange={(e) => handleFieldChange(field.key, e.target.value)}
                                            placeholder={field.placeholder}
                                            className={`w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 resize-y focus:border-emerald-400/50 focus:outline-none ${field.key === "coreFlows" || field.key === "components" || field.key === "responsiveRules" ? "min-h-[120px]" : "min-h-[92px]"}`}
                                        />
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="sticky bottom-0 z-10 flex flex-wrap gap-2 rounded-xl border border-white/10 bg-slate-950/80 p-3 backdrop-blur">
                            <button onClick={handleGenerateArchitecture} disabled={isGenerating} className="h-10 px-5 rounded-lg bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-600 text-white text-sm font-bold shadow-[0_10px_24px_rgba(16,185,129,0.35)] disabled:opacity-60">{isGenerating ? "Generating..." : "Generate With AI Architect"}</button>
                            <button onClick={handleExportJson} className="h-10 px-4 rounded-lg border border-white/15 bg-white/[0.04] text-sm font-semibold text-slate-100 hover:bg-white/[0.1]">Export JSON</button>
                            <button onClick={handleCopyJson} className="h-10 px-4 rounded-lg border border-white/15 bg-white/[0.04] text-sm font-semibold text-slate-100 hover:bg-white/[0.1]">Copy JSON</button>
                            <button onClick={handleExportPrompt} className="h-10 px-4 rounded-lg border border-white/15 bg-white/[0.04] text-sm font-semibold text-slate-100 hover:bg-white/[0.1]">Export Prompt</button>
                        </div>
                    </div>
                </section>

                <aside className="overflow-y-auto border-l border-white/5 bg-slate-950/35 p-6">
                    <div className="max-w-xl space-y-4">
                        {!lastResult?.layout_plan && (
                            <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
                                <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-slate-300">Latest Generated Layout</h3>
                                <p className="mt-2 text-xs leading-5 text-slate-400">Generate once to preview section structure here. Then apply directly to the visual builder.</p>
                            </div>
                        )}
                        {lastResult?.layout_plan && (
                            <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/[0.05] p-4">
                                <div className="flex items-center justify-between gap-2">
                                    <h3 className="text-xs uppercase tracking-[0.1em] font-bold text-emerald-100">Latest Generated Layout</h3>
                                    <button onClick={handleApplyLatestLayout} disabled={isApplying || lastResult.blocks.length === 0} className="h-7 px-3 rounded-md border border-emerald-300/40 bg-emerald-500/20 text-emerald-100 text-[11px] font-semibold disabled:opacity-50">{isApplying ? "Applying..." : "Apply Layout"}</button>
                                </div>
                                <p className="text-xs text-slate-200/85 mt-2">{lastResult.layout_plan.page_purpose}</p>
                                <div className="mt-3 space-y-2">
                                    {lastResult.layout_plan.sections.map((section, index) => (
                                        <div key={`${section.type}-${index}`} className="rounded-lg border border-white/10 bg-slate-900/55 p-3">
                                            <div className="text-[11px] font-semibold text-slate-100">{section.title}</div>
                                            <div className="text-[10px] text-slate-400 mt-1">{section.type} · {section.columns} col</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </aside>
            </div>
        </div>
    );
};

export default ArchitectForm;
