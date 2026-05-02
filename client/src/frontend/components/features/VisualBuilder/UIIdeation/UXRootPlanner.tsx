import React, { useEffect, useMemo, useState } from "react";
import { useToast } from "../../../../context/ToastContext";
import { useProjectStore } from "../../../../hooks/useProjectStore";
import { addPage, selectPage } from "../../../../stores/projectStore";

export type UXRootPlannerTab = "product" | "flows" | "pages" | "specs" | "export";

type ProductType = "app" | "dashboard" | "website" | "admin panel";
type NavigationType = "sidebar" | "top nav" | "mixed";
type ComplexityLevel = "simple" | "medium" | "complex";

interface ProductDefinition {
    productName: string;
    productType: ProductType;
    targetUsers: string[];
    userRoles: string[];
    authRequired: boolean;
    coreFeatures: string[];
    dataEntities: string[];
    navigationType: NavigationType;
    complexityLevel: ComplexityLevel;
}

interface UserFlow {
    id: string;
    role: string;
    steps: string[];
}

interface PlannerPage {
    id: string;
    name: string;
    path: string;
    roleAccess: string[];
}

interface PageSpec {
    purpose: string;
    userGoal: string;
    sections: string[];
    components: string[];
    interactions: string[];
    states: string[];
    permissions: string[];
    dataRequirements: string[];
}

interface UXRootPlannerProps {
    tab: UXRootPlannerTab;
    onTabChange: (tab: UXRootPlannerTab) => void;
    onOpenBuilder: () => void;
}

const TARGET_USER_OPTIONS = ["Guest", "Customer", "Member", "Creator", "Analyst", "Admin"];
const DEFAULT_ROLES = ["guest", "user", "admin"];

const defaultProductDefinition: ProductDefinition = {
    productName: "",
    productType: "app",
    targetUsers: ["Customer"],
    userRoles: ["guest", "user"],
    authRequired: true,
    coreFeatures: ["Dashboard", "Profile", "Settings"],
    dataEntities: ["users"],
    navigationType: "sidebar",
    complexityLevel: "medium",
};

function uid(prefix: string): string {
    return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function toTitleCase(value: string): string {
    return value
        .replace(/[\-_]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b\w/g, (m) => m.toUpperCase()) || "Untitled";
}

function slugify(value: string): string {
    return (
        value
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "") || "page"
    );
}

function parseTagInput(value: string): string[] {
    return value
        .split(",")
        .map((token) => token.trim())
        .filter(Boolean);
}

function joinTags(values: string[]): string {
    return values.join(", ");
}

function moveItem<T>(items: T[], from: number, to: number): T[] {
    const next = [...items];
    const [removed] = next.splice(from, 1);
    next.splice(to, 0, removed);
    return next;
}

function uniqueNormalized(values: string[]): string[] {
    return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function arraysEqualIgnoreCase(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((item, index) => item.toLowerCase() === b[index]?.toLowerCase());
}

function inferProductType(idea: any, projectDescription: string): ProductType {
    const haystack = [
        idea?.ideaMetadata?.category,
        idea?.ideaMetadata?.industry,
        idea?.ideaMetadata?.summary,
        projectDescription,
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

    if (/admin|backoffice/.test(haystack)) return "admin panel";
    if (/dashboard|analytics|bi/.test(haystack)) return "dashboard";
    if (/website|landing|portfolio|marketing/.test(haystack)) return "website";
    return "app";
}

function inferNavigationType(productType: ProductType): NavigationType {
    if (productType === "dashboard" || productType === "admin panel") return "sidebar";
    if (productType === "website") return "top nav";
    return "mixed";
}

function inferAuthRequired(idea: any, projectDescription: string): boolean {
    const text = [
        projectDescription,
        idea?.problem?.problemStatement,
        idea?.solution?.productDescription,
        idea?.ideaMetadata?.summary,
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

    if (/public|anonymous|guest checkout|no account/.test(text)) return false;
    if (/login|register|account|profile|auth|authentication/.test(text)) return true;
    return true;
}

function inferRoles(idea: any, projectDescription: string): string[] {
    const text = [
        projectDescription,
        idea?.problem?.problemStatement,
        idea?.solution?.productDescription,
        idea?.ideaMetadata?.summary,
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

    const roles = new Set<string>(["user"]);
    if (/admin|moderator|manager/.test(text)) roles.add("admin");
    if (/guest|visitor|anonymous/.test(text)) roles.add("guest");
    if (roles.size === 1) roles.add("guest");
    return Array.from(roles);
}

function inferComplexity(idea: any): ComplexityLevel {
    const featureCount =
        (idea?.product?.coreFeatures?.length ?? 0) +
        (idea?.product?.advancedFeatures?.length ?? 0) +
        (idea?.dataModel?.coreEntities?.length ?? 0);
    if (featureCount >= 10) return "complex";
    if (featureCount >= 5) return "medium";
    return "simple";
}

function inferTargetUsers(idea: any): string[] {
    const candidates = [
        ...(idea?.targetMarket?.primaryUsers ?? []),
        ...(idea?.targetMarket?.customerSegments ?? []),
        ...(idea?.problem?.whoHasThisProblem ?? []),
    ]
        .map((value: string) => toTitleCase(value))
        .filter(Boolean);
    return uniqueNormalized(candidates).slice(0, 6);
}

function inferFeatures(idea: any): string[] {
    const features = [
        ...(idea?.product?.coreFeatures ?? []),
        ...(idea?.solution?.keyBenefits ?? []),
    ]
        .map((value: string) => toTitleCase(value))
        .filter(Boolean);
    return uniqueNormalized(features).slice(0, 10);
}

function inferDataEntities(idea: any): string[] {
    const entities = [
        ...(idea?.dataModel?.coreEntities ?? []),
        ...(idea?.technicalArchitecture?.integrations ?? []),
    ]
        .map((value: string) => value.trim().toLowerCase())
        .filter(Boolean);
    return uniqueNormalized(entities).slice(0, 10);
}

function generateFlowsFromDefinition(definition: ProductDefinition): UserFlow[] {
    const normalizedRoles = Array.from(new Set(definition.userRoles.map((r) => r.toLowerCase())));
    const featureSteps = definition.coreFeatures.slice(0, 4).map((feature) => toTitleCase(feature));

    const flows: UserFlow[] = [];

    if (normalizedRoles.includes("guest")) {
        flows.push({
            id: uid("flow"),
            role: "guest",
            steps: definition.authRequired
                ? ["Landing", "Login", "Register"]
                : ["Landing", "Explore", "Get Started"],
        });
    }

    normalizedRoles
        .filter((role) => role !== "guest")
        .forEach((role) => {
            const base = definition.authRequired ? ["Login"] : ["Landing"];
            const roleSpecific = role.includes("admin")
                ? ["Dashboard", "Users", "Analytics", "Settings"]
                : ["Dashboard", "Profile", "Settings"];
            const withFeatures = Array.from(new Set([...base, ...roleSpecific, ...featureSteps]));
            flows.push({
                id: uid("flow"),
                role,
                steps: withFeatures,
            });
        });

    if (flows.length === 0) {
        flows.push({
            id: uid("flow"),
            role: "user",
            steps: ["Landing", "Dashboard", "Profile"],
        });
    }

    return flows;
}

function generatePagesFromFlows(flows: UserFlow[]): PlannerPage[] {
    const roleByStep = new Map<string, Set<string>>();

    flows.forEach((flow) => {
        flow.steps.forEach((step) => {
            const key = toTitleCase(step);
            if (!roleByStep.has(key)) {
                roleByStep.set(key, new Set<string>());
            }
            roleByStep.get(key)?.add(flow.role);
        });
    });

    return Array.from(roleByStep.entries()).map(([name, roles]) => ({
        id: uid("page"),
        name,
        path: `/${slugify(name)}`,
        roleAccess: Array.from(roles),
    }));
}

function getDefaultSpec(page: PlannerPage): PageSpec {
    return {
        purpose: `Enable ${page.name.toLowerCase()} workflow for the assigned role(s).`,
        userGoal: `Complete ${page.name.toLowerCase()} quickly and without confusion.`,
        sections: ["Header", "Main Content"],
        components: ["Button", "Form", "List"],
        interactions: ["Click", "Input", "Validation"],
        states: ["loading", "success", "error"],
        permissions: page.roleAccess,
        dataRequirements: ["session", "primary entity"],
    };
}

function downloadText(content: string, fileName: string, mimeType = "text/plain;charset=utf-8"): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
}

function generateWireframeHtml(page: PlannerPage, spec: PageSpec, navType: NavigationType): string {
    const sections = spec.sections.length > 0 ? spec.sections : ["Main Content"];
    const components = spec.components.length > 0 ? spec.components : ["Block"];

    const sectionHtml = sections
        .map((section) => {
            const blocks = components
                .map((component) => `<div class="wf-block">${component}</div>`)
                .join("\n        ");
            return `<section class="wf-section">\n        <h2>${section}</h2>\n        ${blocks}\n      </section>`;
        })
        .join("\n      ");

    const sidebar = navType === "sidebar" || navType === "mixed" ? `<aside class="wf-sidebar">Sidebar Navigation</aside>` : "";
    const topNav = navType === "top nav" || navType === "mixed" ? `<nav class="wf-topnav">Top Navigation</nav>` : "";

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${page.name} Wireframe</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; }
    .wf-page { min-height: 100vh; display: grid; grid-template-rows: auto auto 1fr; }
    .wf-header { border-bottom: 1px solid; padding: 12px; }
    .wf-topnav { border-bottom: 1px solid; padding: 12px; }
    .wf-layout { display: grid; grid-template-columns: ${navType === "sidebar" || navType === "mixed" ? "240px 1fr" : "1fr"}; min-height: 0; }
    .wf-sidebar { border-right: 1px solid; padding: 12px; }
    .wf-main { padding: 12px; display: grid; gap: 12px; }
    .wf-section { border: 1px dashed; padding: 12px; display: grid; gap: 8px; }
    .wf-block { border: 1px solid; padding: 8px; }
  </style>
</head>
<body>
  <div class="wf-page">
    <header class="wf-header">${page.name} Header</header>
    ${topNav}
    <div class="wf-layout">
      ${sidebar}
      <main class="wf-main">
      ${sectionHtml}
      </main>
    </div>
  </div>
</body>
</html>`;
}

const UXRootPlanner: React.FC<UXRootPlannerProps> = ({ tab, onTabChange, onOpenBuilder }) => {
    const toast = useToast();
    const { project } = useProjectStore();
    const ideaDetails = project?.settings?.ideaDetails;

    const [definition, setDefinition] = useState<ProductDefinition>(defaultProductDefinition);
    const [flows, setFlows] = useState<UserFlow[]>([]);
    const [pages, setPages] = useState<PlannerPage[]>([]);
    const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
    const [pageSpecs, setPageSpecs] = useState<Record<string, PageSpec>>({});
    const [customRoleInput, setCustomRoleInput] = useState("");
    const [didHydrateFromIdea, setDidHydrateFromIdea] = useState(false);

    const lockedByIdea = useMemo(() => {
        return {
            productName: !!ideaDetails?.ideaMetadata?.ideaName,
            targetUsers:
                (ideaDetails?.targetMarket?.primaryUsers?.length ?? 0) > 0 ||
                (ideaDetails?.targetMarket?.customerSegments?.length ?? 0) > 0 ||
                (ideaDetails?.problem?.whoHasThisProblem?.length ?? 0) > 0,
            coreFeatures: (ideaDetails?.product?.coreFeatures?.length ?? 0) > 0,
            dataEntities: (ideaDetails?.dataModel?.coreEntities?.length ?? 0) > 0,
        };
    }, [ideaDetails]);

    const activeSpec = selectedPageId ? pageSpecs[selectedPageId] : null;
    const selectedPage = selectedPageId ? pages.find((page) => page.id === selectedPageId) ?? null : null;

    useEffect(() => {
        if (!project || didHydrateFromIdea) return;

        const idea = project.settings?.ideaDetails;
        const projectDescription = project.description || "";

        const inferredName = idea?.ideaMetadata?.ideaName || project.name || "";
        const inferredType = inferProductType(idea, projectDescription);
        const inferredTargets = inferTargetUsers(idea);
        const inferredRoles = inferRoles(idea, projectDescription);
        const inferredAuth = inferAuthRequired(idea, projectDescription);
        const inferredFeatures = inferFeatures(idea);
        const inferredEntities = inferDataEntities(idea);
        const inferredComplexity = inferComplexity(idea);
        const inferredNavigation = inferNavigationType(inferredType);

        setDefinition((prev) => ({
            ...prev,
            productName: prev.productName.trim() ? prev.productName : inferredName,
            productType: prev.productType !== defaultProductDefinition.productType ? prev.productType : inferredType,
            targetUsers: arraysEqualIgnoreCase(prev.targetUsers, defaultProductDefinition.targetUsers) && inferredTargets.length > 0
                ? inferredTargets
                : prev.targetUsers,
            userRoles: arraysEqualIgnoreCase(prev.userRoles, defaultProductDefinition.userRoles) && inferredRoles.length > 0
                ? inferredRoles
                : prev.userRoles,
            authRequired: prev.authRequired !== defaultProductDefinition.authRequired ? prev.authRequired : inferredAuth,
            coreFeatures: arraysEqualIgnoreCase(prev.coreFeatures, defaultProductDefinition.coreFeatures) && inferredFeatures.length > 0
                ? inferredFeatures
                : prev.coreFeatures,
            dataEntities: arraysEqualIgnoreCase(prev.dataEntities, defaultProductDefinition.dataEntities) && inferredEntities.length > 0
                ? inferredEntities
                : prev.dataEntities,
            navigationType: prev.navigationType !== defaultProductDefinition.navigationType ? prev.navigationType : inferredNavigation,
            complexityLevel: prev.complexityLevel !== defaultProductDefinition.complexityLevel ? prev.complexityLevel : inferredComplexity,
        }));

        setDidHydrateFromIdea(true);
    }, [didHydrateFromIdea, project]);

    useEffect(() => {
        setPageSpecs((previous) => {
            const next: Record<string, PageSpec> = {};
            pages.forEach((page) => {
                next[page.id] = previous[page.id] ?? getDefaultSpec(page);
            });
            return next;
        });

        if (pages.length > 0 && !selectedPageId) {
            setSelectedPageId(pages[0].id);
        }

        if (selectedPageId && !pages.some((page) => page.id === selectedPageId)) {
            setSelectedPageId(pages[0]?.id ?? null);
        }
    }, [pages, selectedPageId]);

    const plannerOutput = useMemo(() => {
        return {
            project: {
                name: definition.productName || "Untitled Product",
                type: definition.productType,
                targetUsers: definition.targetUsers,
                roles: definition.userRoles,
                auth: definition.authRequired,
                features: definition.coreFeatures,
                dataEntities: definition.dataEntities,
                navigation: definition.navigationType,
                complexity: definition.complexityLevel,
            },
            flows,
            pages,
            pageSpecs,
        };
    }, [definition, flows, pages, pageSpecs]);

    const flowMermaid = useMemo(() => {
        const lines: string[] = ["flowchart LR"];
        flows.forEach((flow) => {
            for (let index = 0; index < flow.steps.length - 1; index += 1) {
                const from = `${flow.role}_${slugify(flow.steps[index])}`;
                const to = `${flow.role}_${slugify(flow.steps[index + 1])}`;
                lines.push(`  ${from}[${flow.role}: ${flow.steps[index]}] --> ${to}[${flow.role}: ${flow.steps[index + 1]}]`);
            }
        });
        return lines.join("\n");
    }, [flows]);

    const allComponents = useMemo(() => {
        const componentSet = new Set<string>();
        Object.values(pageSpecs).forEach((spec) => {
            spec.components.forEach((component) => componentSet.add(component));
        });
        return Array.from(componentSet).sort((a, b) => a.localeCompare(b));
    }, [pageSpecs]);

    const generateFlows = () => {
        const next = generateFlowsFromDefinition(definition);
        setFlows(next);
        toast.success("User flows generated.");
        onTabChange("flows");
    };

    const generatePages = () => {
        if (flows.length === 0) {
            toast.error("Generate user flows first.");
            return;
        }
        const next = generatePagesFromFlows(flows);
        setPages(next);
        toast.success(`${next.length} pages generated from user flows.`);
        onTabChange("pages");
    };

    const updateFlowStep = (flowId: string, stepIndex: number, value: string) => {
        setFlows((current) =>
            current.map((flow) => {
                if (flow.id !== flowId) return flow;
                const next = [...flow.steps];
                next[stepIndex] = value;
                return { ...flow, steps: next };
            }),
        );
    };

    const addFlowStep = (flowId: string) => {
        setFlows((current) =>
            current.map((flow) => (flow.id === flowId ? { ...flow, steps: [...flow.steps, "New Step"] } : flow)),
        );
    };

    const removeFlowStep = (flowId: string, stepIndex: number) => {
        setFlows((current) =>
            current.map((flow) => {
                if (flow.id !== flowId) return flow;
                return { ...flow, steps: flow.steps.filter((_, idx) => idx !== stepIndex) };
            }),
        );
    };

    const reorderFlowStep = (flowId: string, from: number, to: number) => {
        setFlows((current) =>
            current.map((flow) => {
                if (flow.id !== flowId || to < 0 || to >= flow.steps.length) return flow;
                return { ...flow, steps: moveItem(flow.steps, from, to) };
            }),
        );
    };

    const updatePageSpec = (pageId: string, field: keyof PageSpec, value: string | string[]) => {
        setPageSpecs((previous) => ({
            ...previous,
            [pageId]: {
                ...previous[pageId],
                [field]: Array.isArray(value) ? value : value,
            },
        }));
    };

    const addManualPage = () => {
        const name = `Page ${pages.length + 1}`;
        const newPage: PlannerPage = {
            id: uid("page"),
            name,
            path: `/${slugify(name)}`,
            roleAccess: ["user"],
        };
        setPages((current) => [...current, newPage]);
        setSelectedPageId(newPage.id);
    };

    const deletePage = (pageId: string) => {
        setPages((current) => current.filter((page) => page.id !== pageId));
    };

    const exportJsonSpec = () => {
        downloadText(JSON.stringify(plannerOutput, null, 2), `${slugify(definition.productName || "ux-root-plan")}.ux-spec.json`, "application/json;charset=utf-8");
    };

    const exportFlowDiagram = () => {
        downloadText(flowMermaid, `${slugify(definition.productName || "ux-root-plan")}.flows.mmd`);
    };

    const exportComponentList = () => {
        downloadText(allComponents.join("\n"), `${slugify(definition.productName || "ux-root-plan")}.components.txt`);
    };

    const exportHtmlWireframes = () => {
        if (pages.length === 0) {
            toast.error("No pages available to export.");
            return;
        }

        pages.forEach((page) => {
            const spec = pageSpecs[page.id] ?? getDefaultSpec(page);
            const html = generateWireframeHtml(page, spec, definition.navigationType);
            downloadText(html, `${slugify(page.name)}.html`, "text/html;charset=utf-8");
        });
        toast.success("Wireframe HTML files generated.");
    };

    const syncPagesToVisualBuilder = async () => {
        if (!project) {
            toast.error("No active project loaded.");
            return;
        }

        if (pages.length === 0) {
            toast.error("No planner pages to sync.");
            return;
        }

        const existing = new Set(project.pages.filter((page) => !page.archived).map((page) => page.path.toLowerCase()));
        let created = 0;
        let firstSyncedPageId: string | null = null;

        for (const plannerPage of pages) {
            const alreadyExists = existing.has(plannerPage.path.toLowerCase());
            if (!alreadyExists) {
                const createdPage = await addPage(plannerPage.name, plannerPage.path);
                existing.add(createdPage.path.toLowerCase());
                created += 1;
                if (!firstSyncedPageId) {
                    firstSyncedPageId = createdPage.id;
                }
            } else if (!firstSyncedPageId) {
                const existingPage = project.pages.find(
                    (page) => !page.archived && page.path.toLowerCase() === plannerPage.path.toLowerCase(),
                );
                firstSyncedPageId = existingPage?.id ?? null;
            }
        }

        if (firstSyncedPageId) {
            selectPage(firstSyncedPageId);
        }

        toast.success(`${created} new page(s) synced to the Visual Builder.`);
    };

    const renderProductDefinition = () => (
        <div className="h-full overflow-auto p-6">
            <div className="max-w-6xl mx-auto grid gap-6 lg:grid-cols-2">
                <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
                    <h2 className="text-lg font-semibold text-white">Product Definition</h2>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="space-y-1 sm:col-span-2">
                            <span className="text-xs uppercase tracking-wider text-white/60">Product Name</span>
                            <input
                                value={definition.productName}
                                onChange={(event) => setDefinition((prev) => ({ ...prev, productName: event.target.value }))}
                                disabled={lockedByIdea.productName}
                                className="h-10 w-full rounded-lg border border-white/15 bg-black/20 disabled:opacity-60 disabled:cursor-not-allowed px-3 text-sm text-white focus:outline-none focus:border-white/30"
                                placeholder="Fitness App"
                            />
                            {lockedByIdea.productName && (
                                <span className="text-[10px] text-white/40">Locked: sourced from Idea page metadata</span>
                            )}
                        </label>

                        <label className="space-y-1">
                            <span className="text-xs uppercase tracking-wider text-white/60">Product Type</span>
                            <select
                                value={definition.productType}
                                onChange={(event) => setDefinition((prev) => ({ ...prev, productType: event.target.value as ProductType }))}
                                className="h-10 w-full rounded-lg border border-white/15 bg-black/20 px-3 text-sm text-white focus:outline-none"
                            >
                                <option value="app">App</option>
                                <option value="dashboard">Dashboard</option>
                                <option value="website">Website</option>
                                <option value="admin panel">Admin Panel</option>
                            </select>
                        </label>

                        <label className="space-y-1">
                            <span className="text-xs uppercase tracking-wider text-white/60">Navigation Type</span>
                            <select
                                value={definition.navigationType}
                                onChange={(event) => setDefinition((prev) => ({ ...prev, navigationType: event.target.value as NavigationType }))}
                                className="h-10 w-full rounded-lg border border-white/15 bg-black/20 px-3 text-sm text-white focus:outline-none"
                            >
                                <option value="sidebar">Sidebar</option>
                                <option value="top nav">Top Nav</option>
                                <option value="mixed">Mixed</option>
                            </select>
                        </label>

                        <label className="space-y-1">
                            <span className="text-xs uppercase tracking-wider text-white/60">Complexity</span>
                            <select
                                value={definition.complexityLevel}
                                onChange={(event) => setDefinition((prev) => ({ ...prev, complexityLevel: event.target.value as ComplexityLevel }))}
                                className="h-10 w-full rounded-lg border border-white/15 bg-black/20 px-3 text-sm text-white focus:outline-none"
                            >
                                <option value="simple">Simple</option>
                                <option value="medium">Medium</option>
                                <option value="complex">Complex</option>
                            </select>
                        </label>

                        <label className="space-y-1 sm:col-span-2">
                            <span className="text-xs uppercase tracking-wider text-white/60">Core Features (comma separated)</span>
                            <input
                                value={joinTags(definition.coreFeatures)}
                                onChange={(event) => setDefinition((prev) => ({ ...prev, coreFeatures: parseTagInput(event.target.value) }))}
                                disabled={lockedByIdea.coreFeatures}
                                className="h-10 w-full rounded-lg border border-white/15 bg-black/20 disabled:opacity-60 disabled:cursor-not-allowed px-3 text-sm text-white focus:outline-none"
                                placeholder="profile, dashboard, analytics"
                            />
                            {lockedByIdea.coreFeatures && (
                                <span className="text-[10px] text-white/40">Locked: sourced from Idea page product features</span>
                            )}
                        </label>

                        <label className="space-y-1 sm:col-span-2">
                            <span className="text-xs uppercase tracking-wider text-white/60">Data Entities (comma separated)</span>
                            <input
                                value={joinTags(definition.dataEntities)}
                                onChange={(event) => setDefinition((prev) => ({ ...prev, dataEntities: parseTagInput(event.target.value) }))}
                                disabled={lockedByIdea.dataEntities}
                                className="h-10 w-full rounded-lg border border-white/15 bg-black/20 disabled:opacity-60 disabled:cursor-not-allowed px-3 text-sm text-white focus:outline-none"
                                placeholder="users, orders, invoices"
                            />
                            {lockedByIdea.dataEntities && (
                                <span className="text-[10px] text-white/40">Locked: sourced from Idea page data model entities</span>
                            )}
                        </label>
                    </div>

                    <div className="space-y-2">
                        <p className="text-xs uppercase tracking-wider text-white/60">Target Users</p>
                        <div className="flex flex-wrap gap-2">
                            {TARGET_USER_OPTIONS.map((option) => {
                                const checked = definition.targetUsers.includes(option);
                                return (
                                    <button
                                        key={option}
                                        onClick={() =>
                                            !lockedByIdea.targetUsers &&
                                            setDefinition((prev) => ({
                                                ...prev,
                                                targetUsers: checked
                                                    ? prev.targetUsers.filter((item) => item !== option)
                                                    : [...prev.targetUsers, option],
                                            }))
                                        }
                                        disabled={lockedByIdea.targetUsers}
                                        className={`px-3 h-8 rounded-full border text-xs disabled:opacity-60 disabled:cursor-not-allowed ${checked ? "border-white/40 bg-white/10 text-white" : "border-white/15 text-white/70"}`}
                                    >
                                        {option}
                                    </button>
                                );
                            })}
                        </div>
                        {lockedByIdea.targetUsers && (
                            <p className="text-[10px] text-white/40">Locked: sourced from Idea page target market definitions</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <p className="text-xs uppercase tracking-wider text-white/60">User Roles</p>
                        <div className="flex flex-wrap gap-2">
                            {DEFAULT_ROLES.concat(definition.userRoles.filter((role) => !DEFAULT_ROLES.includes(role))).map((role) => {
                                const checked = definition.userRoles.includes(role);
                                return (
                                    <button
                                        key={role}
                                        onClick={() =>
                                            setDefinition((prev) => ({
                                                ...prev,
                                                userRoles: checked
                                                    ? prev.userRoles.filter((item) => item !== role)
                                                    : [...prev.userRoles, role],
                                            }))
                                        }
                                        className={`px-3 h-8 rounded-full border text-xs ${checked ? "border-white/40 bg-white/10 text-white" : "border-white/15 text-white/70"}`}
                                    >
                                        {role}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="flex gap-2">
                            <input
                                value={customRoleInput}
                                onChange={(event) => setCustomRoleInput(event.target.value)}
                                className="h-9 flex-1 rounded-lg border border-white/15 bg-black/20 px-3 text-sm text-white focus:outline-none"
                                placeholder="Custom role"
                            />
                            <button
                                onClick={() => {
                                    const role = customRoleInput.trim().toLowerCase();
                                    if (!role) return;
                                    setDefinition((prev) => ({
                                        ...prev,
                                        userRoles: prev.userRoles.includes(role) ? prev.userRoles : [...prev.userRoles, role],
                                    }));
                                    setCustomRoleInput("");
                                }}
                                className="h-9 px-3 rounded-lg border border-white/15 text-xs text-white/80"
                            >
                                Add Role
                            </button>
                        </div>
                    </div>

                    <label className="flex items-center gap-2 text-sm text-white/80">
                        <input
                            type="checkbox"
                            checked={definition.authRequired}
                            onChange={(event) => setDefinition((prev) => ({ ...prev, authRequired: event.target.checked }))}
                        />
                        Authentication required
                    </label>

                    <div className="flex items-center gap-2 pt-2">
                        <button
                            onClick={generateFlows}
                            className="h-10 px-4 rounded-lg bg-white/10 border border-white/20 text-sm font-semibold text-white hover:bg-white/15 transition-all"
                        >
                            Generate User Flows
                        </button>
                        <button
                            onClick={() => onTabChange("flows")}
                            className="h-10 px-4 rounded-lg border border-white/20 text-sm text-white/80"
                        >
                            Go To User Flows
                        </button>
                    </div>
                </section>

                <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                    <h2 className="text-lg font-semibold text-white mb-3">Definition Output</h2>
                    <pre className="overflow-auto rounded-lg border border-white/10 bg-black/30 p-4 text-xs text-white/60 whitespace-pre-wrap">
{JSON.stringify(
    {
        product: definition.productName || "Untitled Product",
        roles: definition.userRoles,
        features: definition.coreFeatures,
        auth: definition.authRequired,
    },
    null,
    2,
)}
                    </pre>
                </section>
            </div>
        </div>
    );

    const renderUserFlows = () => (
        <div className="h-full overflow-auto p-6">
            <div className="max-w-6xl mx-auto space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-white">User Flow Generator</h2>
                    <div className="flex gap-2">
                        <button onClick={generateFlows} className="h-9 px-3 rounded-lg border border-white/20 text-sm text-white/80 hover:bg-white/5 transition-all">Regenerate Flows</button>
                        <button onClick={generatePages} className="h-9 px-3 rounded-lg bg-white/10 border border-white/20 text-sm font-semibold text-white hover:bg-white/15 transition-all">Generate Pages</button>
                    </div>
                </div>

                {flows.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-white/15 p-8 text-center text-white/60">
                        No flows yet. Generate flows from Product Definition.
                    </div>
                ) : (
                    flows.map((flow) => (
                        <section key={flow.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-semibold text-white uppercase tracking-wider">{flow.role} Flow</h3>
                                <button
                                    onClick={() => addFlowStep(flow.id)}
                                    className="h-8 px-3 rounded-lg border border-white/20 text-xs text-white/80"
                                >
                                    Add Step
                                </button>
                            </div>
                            <div className="grid gap-2">
                                {flow.steps.map((step, index) => (
                                    <div key={`${flow.id}-${index}`} className="flex items-center gap-2">
                                        <span className="w-7 text-center text-xs text-white/40">{index + 1}</span>
                                        <input
                                            value={step}
                                            onChange={(event) => updateFlowStep(flow.id, index, event.target.value)}
                                            className="h-9 flex-1 rounded-lg border border-white/15 bg-black/20 px-3 text-sm text-white"
                                        />
                                        <button
                                            onClick={() => reorderFlowStep(flow.id, index, index - 1)}
                                            className="h-9 w-9 rounded-lg border border-white/20 text-white/80"
                                        >
                                            ↑
                                        </button>
                                        <button
                                            onClick={() => reorderFlowStep(flow.id, index, index + 1)}
                                            className="h-9 w-9 rounded-lg border border-white/20 text-white/80"
                                        >
                                            ↓
                                        </button>
                                        <button
                                            onClick={() => removeFlowStep(flow.id, index)}
                                            className="h-9 w-9 rounded-lg border border-white/15 text-white/40 hover:text-white/70 transition-all"
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </section>
                    ))
                )}
            </div>
        </div>
    );

    const renderPages = () => (
        <div className="h-full overflow-auto p-6">
            <div className="max-w-6xl mx-auto space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-white">Auto Page Generator</h2>
                    <div className="flex gap-2">
                        <button onClick={addManualPage} className="h-9 px-3 rounded-lg border border-white/20 text-sm text-white/80 hover:bg-white/5 transition-all">Add Page</button>
                        <button onClick={() => onTabChange("specs")} className="h-9 px-3 rounded-lg bg-white/10 border border-white/20 text-sm font-semibold text-white hover:bg-white/15 transition-all">Open Page Specs</button>
                    </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-white/[0.04] text-white/70">
                            <tr>
                                <th className="text-left p-3">Page Name</th>
                                <th className="text-left p-3">Path</th>
                                <th className="text-left p-3">Role Access</th>
                                <th className="text-right p-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pages.map((page) => (
                                <tr key={page.id} className="border-t border-white/10">
                                    <td className="p-3">
                                        <input
                                            value={page.name}
                                            onChange={(event) =>
                                                setPages((current) =>
                                                    current.map((item) =>
                                                        item.id === page.id
                                                            ? { ...item, name: event.target.value, path: `/${slugify(event.target.value)}` }
                                                            : item,
                                                    ),
                                                )
                                            }
                                            className="h-8 w-full rounded border border-white/15 bg-black/20 px-2 text-white"
                                        />
                                    </td>
                                    <td className="p-3 text-white/75">{page.path}</td>
                                    <td className="p-3">
                                        <div className="flex flex-wrap gap-1">
                                            {definition.userRoles.map((role) => {
                                                const hasRole = page.roleAccess.includes(role);
                                                return (
                                                    <button
                                                        key={`${page.id}-${role}`}
                                                        onClick={() =>
                                                            setPages((current) =>
                                                                current.map((item) =>
                                                                    item.id === page.id
                                                                        ? {
                                                                              ...item,
                                                                              roleAccess: hasRole
                                                                                  ? item.roleAccess.filter((entry) => entry !== role)
                                                                                  : [...item.roleAccess, role],
                                                                          }
                                                                        : item,
                                                                ),
                                                            )
                                                        }
                                                        className={`h-7 px-2 rounded-full border text-xs ${hasRole ? "border-white/40 bg-white/10 text-white" : "border-white/20 text-white/70"}`}
                                                    >
                                                        {role}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </td>
                                    <td className="p-3 text-right">
                                        <button onClick={() => deletePage(page.id)} className="h-8 px-3 rounded border border-white/15 text-white/40 hover:text-white/70 transition-all">Delete</button>
                                    </td>
                                </tr>
                            ))}
                            {pages.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="p-6 text-center text-white/50">
                                        No pages generated yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );

    const renderPageSpecs = () => (
        <div className="h-full overflow-hidden p-4">
            <div className="h-full grid gap-4 grid-cols-1 xl:grid-cols-[260px_1fr_1fr]">
                <aside className="rounded-xl border border-white/10 bg-white/[0.03] p-3 overflow-auto">
                    <div className="text-xs uppercase tracking-wider text-white/60 mb-2">Pages</div>
                    <div className="space-y-2">
                        {pages.map((page) => (
                            <button
                                key={page.id}
                                onClick={() => setSelectedPageId(page.id)}
                                className={`w-full text-left rounded-lg border px-3 py-2 text-sm ${selectedPageId === page.id ? "border-white/40 bg-white/10 text-white" : "border-white/15 text-white/70"}`}
                            >
                                <div>{page.name}</div>
                                <div className="text-xs opacity-70">{page.path}</div>
                            </button>
                        ))}
                    </div>
                </aside>

                <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4 overflow-auto space-y-3">
                    <h3 className="text-sm font-semibold text-white">Page Specification</h3>
                    {selectedPage && activeSpec ? (
                        <>
                            <label className="space-y-1 block">
                                <span className="text-xs uppercase tracking-wider text-white/60">Page Name</span>
                                <input
                                    value={selectedPage.name}
                                    onChange={(event) =>
                                        setPages((current) =>
                                            current.map((page) =>
                                                page.id === selectedPage.id
                                                    ? { ...page, name: event.target.value, path: `/${slugify(event.target.value)}` }
                                                    : page,
                                            ),
                                        )
                                    }
                                    className="h-10 w-full rounded-lg border border-white/15 bg-black/20 px-3 text-sm text-white"
                                />
                            </label>

                            <label className="space-y-1 block">
                                <span className="text-xs uppercase tracking-wider text-white/60">Purpose</span>
                                <textarea
                                    value={activeSpec.purpose}
                                    onChange={(event) => updatePageSpec(selectedPage.id, "purpose", event.target.value)}
                                    className="min-h-[72px] w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm text-white"
                                />
                            </label>

                            <label className="space-y-1 block">
                                <span className="text-xs uppercase tracking-wider text-white/60">User Goal</span>
                                <textarea
                                    value={activeSpec.userGoal}
                                    onChange={(event) => updatePageSpec(selectedPage.id, "userGoal", event.target.value)}
                                    className="min-h-[72px] w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm text-white"
                                />
                            </label>

                            <label className="space-y-1 block">
                                <span className="text-xs uppercase tracking-wider text-white/60">Sections (comma separated)</span>
                                <input
                                    value={joinTags(activeSpec.sections)}
                                    onChange={(event) => updatePageSpec(selectedPage.id, "sections", parseTagInput(event.target.value))}
                                    className="h-10 w-full rounded-lg border border-white/15 bg-black/20 px-3 text-sm text-white"
                                />
                            </label>

                            <label className="space-y-1 block">
                                <span className="text-xs uppercase tracking-wider text-white/60">Components (comma separated)</span>
                                <input
                                    value={joinTags(activeSpec.components)}
                                    onChange={(event) => updatePageSpec(selectedPage.id, "components", parseTagInput(event.target.value))}
                                    className="h-10 w-full rounded-lg border border-white/15 bg-black/20 px-3 text-sm text-white"
                                />
                            </label>
                        </>
                    ) : (
                        <div className="text-white/60 text-sm">Select a page to edit its specification.</div>
                    )}
                </section>

                <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4 overflow-auto space-y-3">
                    <h3 className="text-sm font-semibold text-white">Interactions, States, Permissions, Data</h3>
                    {selectedPage && activeSpec ? (
                        <>
                            <label className="space-y-1 block">
                                <span className="text-xs uppercase tracking-wider text-white/60">Interactions</span>
                                <input
                                    value={joinTags(activeSpec.interactions)}
                                    onChange={(event) => updatePageSpec(selectedPage.id, "interactions", parseTagInput(event.target.value))}
                                    className="h-10 w-full rounded-lg border border-white/15 bg-black/20 px-3 text-sm text-white"
                                />
                            </label>
                            <label className="space-y-1 block">
                                <span className="text-xs uppercase tracking-wider text-white/60">States</span>
                                <input
                                    value={joinTags(activeSpec.states)}
                                    onChange={(event) => updatePageSpec(selectedPage.id, "states", parseTagInput(event.target.value))}
                                    className="h-10 w-full rounded-lg border border-white/15 bg-black/20 px-3 text-sm text-white"
                                />
                            </label>
                            <label className="space-y-1 block">
                                <span className="text-xs uppercase tracking-wider text-white/60">Permissions</span>
                                <input
                                    value={joinTags(activeSpec.permissions)}
                                    onChange={(event) => updatePageSpec(selectedPage.id, "permissions", parseTagInput(event.target.value))}
                                    className="h-10 w-full rounded-lg border border-white/15 bg-black/20 px-3 text-sm text-white"
                                />
                            </label>
                            <label className="space-y-1 block">
                                <span className="text-xs uppercase tracking-wider text-white/60">Data Requirements</span>
                                <textarea
                                    value={joinTags(activeSpec.dataRequirements)}
                                    onChange={(event) => updatePageSpec(selectedPage.id, "dataRequirements", parseTagInput(event.target.value))}
                                    className="min-h-[72px] w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm text-white"
                                />
                            </label>
                        </>
                    ) : (
                        <div className="text-white/60 text-sm">Select a page from the left panel first.</div>
                    )}
                </section>
            </div>
        </div>
    );

    const renderWireframeExport = () => (
        <div className="h-full overflow-auto p-6">
            <div className="max-w-6xl mx-auto grid gap-6 lg:grid-cols-2">
                <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-3">
                    <h2 className="text-lg font-semibold text-white">Wireframe HTML Generator</h2>
                    <p className="text-sm text-white/65">
                        Generates low-fidelity layout-only HTML files with structural blocks and no branding styling.
                    </p>

                    <div className="grid gap-2">
                        {pages.map((page) => (
                            <div key={page.id} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-white/80 flex items-center justify-between">
                                <span>{page.name}</span>
                                <span className="text-xs text-white/50">{slugify(page.name)}.html</span>
                            </div>
                        ))}
                        {pages.length === 0 && (
                            <div className="rounded-lg border border-dashed border-white/15 p-4 text-sm text-white/60">No pages available. Generate pages first.</div>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2">
                        <button onClick={exportHtmlWireframes} className="h-10 px-4 rounded-lg bg-white/10 border border-white/20 text-sm font-semibold text-white hover:bg-white/15 transition-all">Export HTML Files</button>
                        <button onClick={exportJsonSpec} className="h-10 px-4 rounded-lg border border-white/20 text-sm text-white/80 hover:bg-white/5 transition-all">Export JSON UX Spec</button>
                        <button onClick={exportFlowDiagram} className="h-10 px-4 rounded-lg border border-white/20 text-sm text-white/80 hover:bg-white/5 transition-all">Export Flow Diagram</button>
                        <button onClick={exportComponentList} className="h-10 px-4 rounded-lg border border-white/20 text-sm text-white/80 hover:bg-white/5 transition-all">Export Component List</button>
                    </div>
                </section>

                <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-3">
                    <h2 className="text-lg font-semibold text-white">Frontend Handoff</h2>
                    <p className="text-sm text-white/65">
                        Push generated pages into the existing Visual Builder or continue with export-only UX handoff.
                    </p>
                    <div className="space-y-2 text-sm text-white/75">
                        <p>1. Sync page map to project pages.</p>
                        <p>2. Open Visual Builder to start hi-fi implementation.</p>
                        <p>3. Keep JSON + wireframes as handoff package.</p>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-2">
                        <button
                            onClick={async () => {
                                await syncPagesToVisualBuilder();
                            }}
                            className="h-10 px-4 rounded-lg bg-white/10 border border-white/20 text-sm font-semibold text-white hover:bg-white/15 transition-all"
                        >
                            Sync Pages To Builder
                        </button>
                        <button onClick={onOpenBuilder} className="h-10 px-4 rounded-lg border border-white/20 text-sm text-white/80 hover:bg-white/5 transition-all">
                            Open Visual Builder
                        </button>
                    </div>

                    <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-xs text-white/60 overflow-auto max-h-[280px] whitespace-pre-wrap">
{JSON.stringify(plannerOutput, null, 2)}
                    </div>
                </section>
            </div>
        </div>
    );

    if (tab === "product") return renderProductDefinition();
    if (tab === "flows") return renderUserFlows();
    if (tab === "pages") return renderPages();
    if (tab === "specs") return renderPageSpecs();
    return renderWireframeExport();
};

export default UXRootPlanner;
