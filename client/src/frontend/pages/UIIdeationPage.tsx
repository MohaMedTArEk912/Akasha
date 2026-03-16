import React, { useEffect, useMemo, useState } from "react";
import { useProjectStore } from "../hooks/useProjectStore";
import {
    addPage,
    applyBuilderLayout,
    archivePage,
    generateBuilderLayout,
    selectPage,
} from "../stores/projectStore";
import { useToast } from "../context/ToastContext";
import UIDesignPage from "./UIDesignPage";
import type { UiBuilderGenerateResponse } from "../types/uiBuilder";

type UiDesignTab = "ideation" | "pages" | "builder";

type ArchitectFieldKey =
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
    { key: "productVision", label: "Product Vision", placeholder: "What are you building and why now?" },
    { key: "targetAudience", label: "Target Audience", placeholder: "Primary users, context, and constraints." },
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

interface ArchitectForm {
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

type ThemeMode = "dark" | "light" | "system";
type SpacingScale = "compact" | "balanced" | "comfortable";
type AnimationSpeed = "slow" | "normal" | "fast";
type ContainerWidth = "narrow" | "standard" | "wide";

const initialForm: ArchitectForm = {
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

const UIIdeationPage: React.FC = () => {
    const { project, selectedPageId } = useProjectStore();
    const toast = useToast();

    const [activeTab, setActiveTab] = useState<UiDesignTab>("ideation");
    const [form, setForm] = useState<ArchitectForm>(initialForm);
    const [search, setSearch] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [isApplying, setIsApplying] = useState(false);
    const [lastResult, setLastResult] = useState<UiBuilderGenerateResponse | null>(null);
    const [themeMode, setThemeMode] = useState<ThemeMode>("dark");
    const [spacingScale, setSpacingScale] = useState<SpacingScale>("balanced");
    const [animationSpeed, setAnimationSpeed] = useState<AnimationSpeed>("normal");
    const [containerWidth, setContainerWidth] = useState<ContainerWidth>("standard");

    const pages = useMemo(() => project?.pages.filter((p) => !p.archived) ?? [], [project]);

    useEffect(() => {
        try {
            const raw = localStorage.getItem(ARCHITECT_DRAFT_STORAGE_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw) as Partial<ArchitectForm>;
            setForm((prev) => ({ ...prev, ...parsed }));
        } catch {
            // Ignore malformed drafts and keep defaults.
        }
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem(ARCHITECT_DRAFT_STORAGE_KEY, JSON.stringify(form));
        } catch {
            // Ignore storage failures (private mode, quota, etc).
        }
    }, [form]);

    const filteredPages = useMemo(() => {
        if (!search.trim()) return pages;
        const query = search.toLowerCase();
        return pages.filter((page) => page.name.toLowerCase().includes(query) || page.path.toLowerCase().includes(query));
    }, [pages, search]);

    const designSystem = useMemo<Record<string, unknown>>(() => ({
        project: {
            name: form.name || project?.name || "Untitled Product",
            industry: form.industry,
            platform: form.platform,
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
            audience: form.targetAudience,
            coreFlows: form.coreFlows,
            accessibility: form.accessibility,
            responsiveRules: form.responsiveRules,
            statesMotion: form.statesMotion,
        },
        components: form.components,
        vision: form.productVision,
        globals: {
            themeMode,
            spacingScale,
            animationSpeed,
            containerWidth,
        },
    }), [animationSpeed, containerWidth, form, project?.name, spacingScale, themeMode]);

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
            primary,
            secondary,
            accent,
            surface,
            panel,
            textMain,
            textMuted,
            radius,
            spacing,
            motionMs,
            contentWidth,
            headingFont: typography.heading,
            bodyFont: typography.body,
        };
    }, [animationSpeed, containerWidth, form.spacingRadius, palette, spacingScale, themeMode, typography.body, typography.heading]);

    const componentSchema = useMemo(() => {
        const componentNames = form.components
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean);

        return componentNames.map((name) => ({
            name,
            variants: ["default", "compact", "emphasis"],
            states: ["default", "hover", "focus", "disabled"],
            accessibility: {
                keyboard: true,
                ariaRequired: true,
            },
        }));
    }, [form.components]);

    const structuredPrompt = useMemo(() => {
        const promptProjectName = form.name || project?.name || "Untitled Product";
        return [
            `You are Akasha AI UI Architect. Produce a production-ready UI plan for ${promptProjectName}.`,
            "Use the provided designSystem object as source-of-truth constraints.",
            "Leverage Qwen-style structured reasoning and output pragmatic layout decisions.",
            "Return component hierarchy, section-level structure, and implementation-ready block guidance.",
            "Prioritize consistency, accessibility, and responsive behavior.",
        ].join(" ");
    }, [form.name, project?.name]);

    const createExportPayload = useMemo(() => () => ({
        version: "1.0.0",
        generatedAt: new Date().toISOString(),
        designSystem,
        tokens: {
            color: {
                palette,
                primary: previewTokens.primary,
                secondary: previewTokens.secondary,
                accent: previewTokens.accent,
                surface: previewTokens.surface,
                panel: previewTokens.panel,
                textMain: previewTokens.textMain,
                textMuted: previewTokens.textMuted,
            },
            typography: {
                headingFont: previewTokens.headingFont,
                bodyFont: previewTokens.bodyFont,
            },
            spacing: {
                scale: spacingScale,
                baseUnit: previewTokens.spacing,
            },
            radius: {
                base: previewTokens.radius,
            },
            motion: {
                speed: animationSpeed,
                durationMs: previewTokens.motionMs,
            },
            layout: {
                containerWidth: previewTokens.contentWidth,
                platform: form.platform,
                responsiveRules: form.responsiveRules,
            },
        },
        componentSchema,
        uiDocs: {
            vision: form.productVision,
            targetAudience: form.targetAudience,
            coreFlows: form.coreFlows,
            accessibility: form.accessibility,
            statesMotion: form.statesMotion,
            styleDirection: form.styleDirection,
            brandKeywords: form.brandKeywords,
        },
        ai: {
            prompt: structuredPrompt,
        },
    }), [animationSpeed, componentSchema, designSystem, form.accessibility, form.brandKeywords, form.coreFlows, form.platform, form.productVision, form.responsiveRules, form.statesMotion, form.styleDirection, form.targetAudience, palette, previewTokens.accent, previewTokens.bodyFont, previewTokens.contentWidth, previewTokens.headingFont, previewTokens.motionMs, previewTokens.panel, previewTokens.primary, previewTokens.radius, previewTokens.secondary, previewTokens.spacing, previewTokens.surface, previewTokens.textMain, previewTokens.textMuted, spacingScale, structuredPrompt]);

    const handleFieldChange = (key: keyof ArchitectForm, value: string) => {
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

        const pageName = form.name ? `${form.name} Home` : "Home";
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
            if (response.warnings.length > 0) {
                toast.warning(response.warnings[0]);
            }
            if (response.blocks.length > 0) {
                toast.success("AI Architect generated a layout. Review it, then click Apply Layout.");
            } else {
                toast.warning("AI Architect returned no blocks. Update constraints and try again.");
            }
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
            setActiveTab("builder");
        } catch (error) {
            toast.error(`Apply failed: ${String(error)}`);
        } finally {
            setIsApplying(false);
        }
    };

    const handleExportJson = () => {
        const payload = JSON.stringify(createExportPayload(), null, 2);
        downloadText(payload, "ui-architect-export.json");
        toast.success("UI Architect export JSON generated.");
    };

    const handleExportPrompt = () => {
        const payload = `${structuredPrompt}\n\nArchitect Export:\n${JSON.stringify(createExportPayload(), null, 2)}`;
        downloadText(payload, "ui-architect-prompt.txt");
        toast.success("Prompt package exported.");
    };

    const handleCopyJson = async () => {
        try {
            await navigator.clipboard.writeText(JSON.stringify(createExportPayload(), null, 2));
            toast.success("Architect export copied to clipboard.");
        } catch {
            toast.error("Clipboard copy failed.");
        }
    };

    const handleCreateBlankPage = async () => {
        const index = pages.length + 1;
        const name = `Page ${index}`;
        try {
            const page = await addPage(name, `/${slugify(name)}`);
            selectPage(page.id);
            toast.success(`Created ${name}.`);
        } catch {
            toast.error("Could not create page.");
        }
    };

    const handleDeletePage = async (id: string, name: string) => {
        if (!confirm(`Delete ${name}?`)) return;
        try {
            await archivePage(id);
            toast.success(`${name} deleted.`);
        } catch {
            toast.error("Could not delete page.");
        }
    };

    return (
        <div className="size-full bg-[var(--ide-bg)] text-[var(--ide-text)] flex flex-col overflow-hidden">
            <header className="h-14 border-b border-[var(--ide-border)] px-5 flex items-center justify-between bg-[var(--ide-bg-sidebar)]/70 backdrop-blur-xl">
                <div className="flex items-center gap-4">
                    <h1 className="text-sm tracking-[0.12em] uppercase font-extrabold text-white/90">AI UI Architect</h1>
                    <div className="h-8 rounded-lg border border-white/10 bg-white/[0.03] p-0.5 flex items-center gap-0.5">
                        <button
                            onClick={() => setActiveTab("ideation")}
                            className={`h-7 px-3 rounded-md text-[11px] font-semibold ${activeTab === "ideation" ? "bg-cyan-500/20 text-cyan-200 border border-cyan-400/30" : "text-white/50 hover:text-white/80"}`}
                        >
                            Architect
                        </button>
                        <button
                            onClick={() => setActiveTab("pages")}
                            className={`h-7 px-3 rounded-md text-[11px] font-semibold ${activeTab === "pages" ? "bg-cyan-500/20 text-cyan-200 border border-cyan-400/30" : "text-white/50 hover:text-white/80"}`}
                        >
                            Pages
                        </button>
                    </div>
                </div>
                <button
                    onClick={() => setActiveTab("builder")}
                    className="h-9 px-4 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-bold hover:from-cyan-400 hover:to-blue-500 transition-colors"
                >
                    Open Builder
                </button>
            </header>

            {activeTab === "builder" && (
                <div className="flex-1 overflow-hidden">
                    <UIDesignPage />
                </div>
            )}

            {activeTab === "pages" && (
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="max-w-6xl mx-auto">
                        <div className="flex items-center justify-between gap-3 mb-5">
                            <div className="relative w-64 max-w-full">
                                <input
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder="Search pages"
                                    className="h-9 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-white/80 placeholder:text-white/30 focus:outline-none focus:border-cyan-400/40"
                                />
                            </div>
                            <button
                                onClick={handleCreateBlankPage}
                                className="h-9 px-4 rounded-lg border border-white/15 bg-white/[0.03] text-sm font-semibold text-white/80 hover:bg-white/[0.08]"
                            >
                                New Page
                            </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredPages.map((page) => (
                                <article
                                    key={page.id}
                                    className="rounded-xl border border-white/10 bg-white/[0.03] p-4 hover:border-cyan-400/40 transition-colors"
                                >
                                    <button
                                        onClick={() => {
                                            selectPage(page.id);
                                            setActiveTab("builder");
                                        }}
                                        className="text-left block w-full"
                                    >
                                        <h2 className="text-sm font-semibold text-white/90 truncate">{page.name}</h2>
                                        <p className="text-xs text-white/35 mt-1 truncate">{page.path}</p>
                                    </button>
                                    <div className="mt-4 flex items-center justify-between">
                                        <button
                                            onClick={() => {
                                                selectPage(page.id);
                                                setActiveTab("builder");
                                            }}
                                            className="text-xs font-semibold text-cyan-300 hover:text-cyan-200"
                                        >
                                            Open in Builder
                                        </button>
                                        <button
                                            onClick={() => handleDeletePage(page.id, page.name)}
                                            className="text-xs font-semibold text-red-300 hover:text-red-200"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </article>
                            ))}
                        </div>
                        {filteredPages.length === 0 && (
                            <div className="rounded-xl border border-dashed border-white/15 p-8 text-center text-sm text-white/50 mt-4">
                                No pages found.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === "ideation" && (
                <div className="flex-1 overflow-hidden">
                    <div className="h-full grid grid-cols-1 xl:grid-cols-[1.7fr_1fr] gap-0">
                        <section className="overflow-y-auto p-6 border-r border-[var(--ide-border)]">
                            <div className="max-w-4xl mx-auto space-y-4">
                                <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-cyan-500/10 via-blue-500/5 to-transparent p-4">
                                    <h2 className="text-sm font-bold text-white/90 uppercase tracking-[0.1em]">Design System Builder</h2>
                                    <p className="text-xs text-white/60 mt-2">
                                        Fill in product, UX, and visual constraints. The AI Architect will generate a builder-ready layout plan and keep outputs exportable as machine-readable JSON.
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <label className="space-y-1">
                                        <span className="text-[11px] font-semibold text-white/70 uppercase tracking-wide">Product Name</span>
                                        <input
                                            value={form.name}
                                            onChange={(event) => handleFieldChange("name", event.target.value)}
                                            className="h-10 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-white/85 focus:outline-none focus:border-cyan-400/40"
                                            placeholder="Akasha Commerce"
                                        />
                                    </label>
                                    <label className="space-y-1">
                                        <span className="text-[11px] font-semibold text-white/70 uppercase tracking-wide">Industry</span>
                                        <input
                                            value={form.industry}
                                            onChange={(event) => handleFieldChange("industry", event.target.value)}
                                            className="h-10 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-white/85 focus:outline-none focus:border-cyan-400/40"
                                            placeholder="Fintech / Health / Productivity"
                                        />
                                    </label>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                                    <label className="space-y-1">
                                        <span className="text-[11px] font-semibold text-white/70 uppercase tracking-wide">Theme</span>
                                        <select
                                            value={themeMode}
                                            onChange={(event) => setThemeMode(event.target.value as ThemeMode)}
                                            className="h-10 w-full rounded-lg border border-white/10 bg-[#111723] px-3 text-sm text-white/85 focus:outline-none focus:border-cyan-400/40"
                                        >
                                            <option value="dark">Dark</option>
                                            <option value="light">Light</option>
                                            <option value="system">System</option>
                                        </select>
                                    </label>
                                    <label className="space-y-1">
                                        <span className="text-[11px] font-semibold text-white/70 uppercase tracking-wide">Spacing Scale</span>
                                        <select
                                            value={spacingScale}
                                            onChange={(event) => setSpacingScale(event.target.value as SpacingScale)}
                                            className="h-10 w-full rounded-lg border border-white/10 bg-[#111723] px-3 text-sm text-white/85 focus:outline-none focus:border-cyan-400/40"
                                        >
                                            <option value="compact">Compact</option>
                                            <option value="balanced">Balanced</option>
                                            <option value="comfortable">Comfortable</option>
                                        </select>
                                    </label>
                                    <label className="space-y-1">
                                        <span className="text-[11px] font-semibold text-white/70 uppercase tracking-wide">Animation Speed</span>
                                        <select
                                            value={animationSpeed}
                                            onChange={(event) => setAnimationSpeed(event.target.value as AnimationSpeed)}
                                            className="h-10 w-full rounded-lg border border-white/10 bg-[#111723] px-3 text-sm text-white/85 focus:outline-none focus:border-cyan-400/40"
                                        >
                                            <option value="slow">Slow</option>
                                            <option value="normal">Normal</option>
                                            <option value="fast">Fast</option>
                                        </select>
                                    </label>
                                    <label className="space-y-1">
                                        <span className="text-[11px] font-semibold text-white/70 uppercase tracking-wide">Container</span>
                                        <select
                                            value={containerWidth}
                                            onChange={(event) => setContainerWidth(event.target.value as ContainerWidth)}
                                            className="h-10 w-full rounded-lg border border-white/10 bg-[#111723] px-3 text-sm text-white/85 focus:outline-none focus:border-cyan-400/40"
                                        >
                                            <option value="narrow">Narrow</option>
                                            <option value="standard">Standard</option>
                                            <option value="wide">Wide</option>
                                        </select>
                                    </label>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <label className="space-y-1">
                                        <span className="text-[11px] font-semibold text-white/70 uppercase tracking-wide">Platform</span>
                                        <select
                                            value={form.platform}
                                            onChange={(event) => handleFieldChange("platform", event.target.value as ArchitectForm["platform"])}
                                            className="h-10 w-full rounded-lg border border-white/10 bg-[#111723] px-3 text-sm text-white/85 focus:outline-none focus:border-cyan-400/40"
                                        >
                                            <option value="web">Web</option>
                                            <option value="mobile">Mobile</option>
                                            <option value="both">Web + Mobile</option>
                                        </select>
                                    </label>
                                    <label className="space-y-1">
                                        <span className="text-[11px] font-semibold text-white/70 uppercase tracking-wide">Style Direction</span>
                                        <input
                                            value={form.styleDirection}
                                            onChange={(event) => handleFieldChange("styleDirection", event.target.value)}
                                            className="h-10 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-white/85 focus:outline-none focus:border-cyan-400/40"
                                        />
                                    </label>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {ARCHITECT_FIELDS.map((field) => (
                                        <label key={field.key} className="space-y-1">
                                            <span className="text-[11px] font-semibold text-white/70 uppercase tracking-wide">{field.label}</span>
                                            <textarea
                                                value={form[field.key]}
                                                onChange={(event) => handleFieldChange(field.key, event.target.value)}
                                                placeholder={field.placeholder}
                                                className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/85 placeholder:text-white/35 min-h-[86px] resize-y focus:outline-none focus:border-cyan-400/40"
                                            />
                                        </label>
                                    ))}
                                </div>

                                <div className="flex flex-wrap gap-2 pt-1">
                                    <button
                                        onClick={handleGenerateArchitecture}
                                        disabled={isGenerating}
                                        className="h-10 px-5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-bold disabled:opacity-60"
                                    >
                                        {isGenerating ? "Generating..." : "Generate With AI Architect"}
                                    </button>
                                    <button
                                        onClick={handleExportJson}
                                        className="h-10 px-4 rounded-lg border border-white/15 bg-white/[0.03] text-sm font-semibold text-white/80 hover:bg-white/[0.08]"
                                    >
                                        Export JSON
                                    </button>
                                    <button
                                        onClick={handleCopyJson}
                                        className="h-10 px-4 rounded-lg border border-white/15 bg-white/[0.03] text-sm font-semibold text-white/80 hover:bg-white/[0.08]"
                                    >
                                        Copy JSON
                                    </button>
                                    <button
                                        onClick={handleExportPrompt}
                                        className="h-10 px-4 rounded-lg border border-white/15 bg-white/[0.03] text-sm font-semibold text-white/80 hover:bg-white/[0.08]"
                                    >
                                        Export Prompt
                                    </button>
                                </div>
                            </div>
                        </section>

                        <aside className="overflow-y-auto p-6 bg-[var(--ide-bg-sidebar)]/70">
                            <div className="max-w-xl space-y-4">
                                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                                    <h3 className="text-xs uppercase tracking-[0.1em] font-bold text-cyan-200">Live Architecture Preview</h3>
                                    <p className="text-sm text-white/80 mt-2">{form.name || project?.name || "Untitled Product"}</p>
                                    <p className="text-xs text-white/45 mt-1">{form.styleDirection}</p>
                                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-white/70">
                                        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2">
                                            <div className="text-white/40 uppercase tracking-wide text-[10px]">Platform</div>
                                            <div className="mt-1">{form.platform}</div>
                                        </div>
                                        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2">
                                            <div className="text-white/40 uppercase tracking-wide text-[10px]">Industry</div>
                                            <div className="mt-1">{form.industry || "Not specified"}</div>
                                        </div>
                                    </div>
                                    <div
                                        className="mt-4 rounded-xl border border-white/10 p-3"
                                        style={{
                                            backgroundColor: previewTokens.surface,
                                            color: previewTokens.textMain,
                                            transition: `all ${previewTokens.motionMs}ms ease`,
                                        }}
                                    >
                                        <div className="mx-auto" style={{ maxWidth: previewTokens.contentWidth }}>
                                            <div
                                                className="rounded-lg p-3 border"
                                                style={{
                                                    backgroundColor: previewTokens.panel,
                                                    borderColor: `${previewTokens.primary}55`,
                                                    borderRadius: previewTokens.radius,
                                                }}
                                            >
                                                <div className="flex items-center justify-between gap-3">
                                                    <div style={{ fontFamily: previewTokens.headingFont }} className="text-sm font-bold">Navbar Preview</div>
                                                    <button
                                                        className="px-3 py-1 text-xs font-semibold"
                                                        style={{
                                                            backgroundColor: previewTokens.primary,
                                                            color: themeMode === "light" ? "#0f172a" : "#00151f",
                                                            borderRadius: previewTokens.radius,
                                                            transition: `all ${previewTokens.motionMs}ms ease`,
                                                        }}
                                                    >
                                                        Primary Action
                                                    </button>
                                                </div>

                                                <div className="mt-3 grid gap-3" style={{ gridTemplateColumns: "1.1fr 1fr" }}>
                                                    <div
                                                        className="p-3 border"
                                                        style={{
                                                            backgroundColor: `${previewTokens.secondary}22`,
                                                            borderColor: `${previewTokens.secondary}66`,
                                                            borderRadius: previewTokens.radius,
                                                        }}
                                                    >
                                                        <div style={{ fontFamily: previewTokens.headingFont }} className="text-xs font-semibold">Card</div>
                                                        <p style={{ color: previewTokens.textMuted, fontFamily: previewTokens.bodyFont }} className="text-[11px] mt-1">
                                                            Token-driven card preview with spacing {previewTokens.spacing}px and motion {previewTokens.motionMs}ms.
                                                        </p>
                                                        <div className="mt-2 flex gap-2">
                                                            <button
                                                                className="px-2 py-1 text-[11px] font-medium border"
                                                                style={{ borderColor: `${previewTokens.accent}66`, borderRadius: previewTokens.radius }}
                                                            >
                                                                Secondary
                                                            </button>
                                                            <button
                                                                className="px-2 py-1 text-[11px] font-medium"
                                                                style={{ backgroundColor: previewTokens.accent, color: "#111827", borderRadius: previewTokens.radius }}
                                                            >
                                                                Accent
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <div
                                                        className="p-3 border"
                                                        style={{
                                                            backgroundColor: `${previewTokens.primary}18`,
                                                            borderColor: `${previewTokens.primary}66`,
                                                            borderRadius: previewTokens.radius,
                                                        }}
                                                    >
                                                        <div style={{ fontFamily: previewTokens.headingFont }} className="text-xs font-semibold">Input + Modal</div>
                                                        <input
                                                            readOnly
                                                            value="sample@email.com"
                                                            className="mt-2 w-full px-2 py-1.5 text-[11px] border bg-transparent"
                                                            style={{ borderColor: `${previewTokens.textMuted}66`, borderRadius: previewTokens.radius, color: previewTokens.textMain }}
                                                        />
                                                        <div
                                                            className="mt-2 border p-2"
                                                            style={{
                                                                borderColor: `${previewTokens.textMuted}44`,
                                                                borderRadius: previewTokens.radius,
                                                                backgroundColor: `${previewTokens.panel}cc`,
                                                            }}
                                                        >
                                                            <div className="text-[10px] font-semibold" style={{ fontFamily: previewTokens.headingFont }}>Modal Header</div>
                                                            <div className="text-[10px] mt-1" style={{ color: previewTokens.textMuted, fontFamily: previewTokens.bodyFont }}>
                                                                Focus ring, spacing rhythm, and type scale follow your current settings.
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                                    <h3 className="text-xs uppercase tracking-[0.1em] font-bold text-cyan-200">Architect Export Payload</h3>
                                    <pre className="mt-3 max-h-[420px] overflow-auto text-[11px] leading-relaxed text-white/70 bg-black/20 rounded-lg p-3 border border-white/10">
{JSON.stringify(createExportPayload(), null, 2)}
                                    </pre>
                                </div>

                                {lastResult?.layout_plan && (
                                    <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/[0.06] p-4">
                                        <div className="flex items-center justify-between gap-2">
                                            <h3 className="text-xs uppercase tracking-[0.1em] font-bold text-cyan-200">Latest Generated Layout</h3>
                                            <button
                                                onClick={handleApplyLatestLayout}
                                                disabled={isApplying || lastResult.blocks.length === 0}
                                                className="h-7 px-3 rounded-md border border-cyan-400/40 bg-cyan-500/20 text-cyan-100 text-[11px] font-semibold disabled:opacity-50"
                                            >
                                                {isApplying ? "Applying..." : "Apply Layout"}
                                            </button>
                                        </div>
                                        <p className="text-xs text-white/70 mt-2">{lastResult.layout_plan.page_purpose}</p>
                                        <div className="mt-3 space-y-2">
                                            {lastResult.layout_plan.sections.map((section, index) => (
                                                <div key={`${section.type}-${index}`} className="rounded-lg border border-white/10 bg-black/20 p-2.5">
                                                    <div className="text-[11px] font-semibold text-white/85">{section.title}</div>
                                                    <div className="text-[10px] text-white/50 mt-1">{section.type} · {section.columns} col</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </aside>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UIIdeationPage;
