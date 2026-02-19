/**
 * Block Registry — single source of truth for every block type.
 *
 * CraftBlock reads this to decide how to render, what default props to use,
 * which inspector sections to show, and whether the block can have children.
 */

/* ═══════════════════  Types  ═══════════════════════ */

export type InspectorSection =
    | "text"
    | "layout"
    | "typography"
    | "background"
    | "border"
    | "spacing"
    | "size"
    | "image"
    | "link";

export type BlockCategory = "layout" | "typography" | "media" | "form" | "component";

export interface BlockMeta {
    /** Internal type key (matches block_type in BlockSchema) */
    type: string;
    /** Human-readable name */
    displayName: string;
    /** Palette category */
    category: BlockCategory;
    /** SVG path `d` attribute for the palette icon */
    iconPath: string;
    /** Whether this block can accept child blocks */
    canHaveChildren: boolean;
    /** Default property values when the block is created */
    defaultProps: Record<string, unknown>;
    /** Default inline styles */
    defaultStyles: Record<string, string | number>;
    /** Which inspector sections to show when selected */
    inspectorSections: InspectorSection[];
    /** Tailwind classes used for editor appearance */
    appearance: string;
    /** Short description for palette tooltip */
    description: string;
}

/* ═══════════════════  Registry  ════════════════════ */

export const BLOCK_REGISTRY: Record<string, BlockMeta> = {
    /* ────────────── Layout ────────────── */
    container: {
        type: "container",
        displayName: "Container",
        category: "layout",
        iconPath: "M4 5a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5z",
        canHaveChildren: true,
        defaultProps: {},
        defaultStyles: { padding: "16px", minHeight: "60px" },
        inspectorSections: ["layout", "background", "border", "spacing", "size"],
        appearance: "p-4 bg-white rounded-xl border border-slate-200 min-h-[60px]",
        description: "Basic container",
    },
    section: {
        type: "section",
        displayName: "Section",
        category: "layout",
        iconPath: "M4 6h16M4 12h16m-7 6h7",
        canHaveChildren: true,
        defaultProps: {},
        defaultStyles: { padding: "24px", minHeight: "60px" },
        inspectorSections: ["layout", "background", "border", "spacing", "size"],
        appearance: "p-6 bg-gradient-to-b from-slate-50 to-white rounded-xl border border-slate-200/80 min-h-[60px]",
        description: "Page section",
    },
    columns: {
        type: "columns",
        displayName: "Columns",
        category: "layout",
        iconPath: "M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2",
        canHaveChildren: true,
        defaultProps: {},
        defaultStyles: { display: "flex", gap: "12px", padding: "16px", minHeight: "60px" },
        inspectorSections: ["layout", "background", "border", "spacing", "size"],
        appearance: "p-4 bg-white rounded-xl border border-blue-100 min-h-[60px] flex gap-3",
        description: "Multi-column layout",
    },
    column: {
        type: "column",
        displayName: "Column",
        category: "layout",
        iconPath: "M4 5a1 1 0 011-1h4a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5z",
        canHaveChildren: true,
        defaultProps: {},
        defaultStyles: { flex: "1", minHeight: "40px" },
        inspectorSections: ["layout", "background", "spacing", "size"],
        appearance: "flex-1 p-2 bg-white rounded-lg border border-slate-100 min-h-[40px]",
        description: "Single column",
    },
    flex: {
        type: "flex",
        displayName: "Flex",
        category: "layout",
        iconPath: "M4 6h16M4 10h16M4 14h16M4 18h16",
        canHaveChildren: true,
        defaultProps: {},
        defaultStyles: { display: "flex", gap: "12px", padding: "16px", minHeight: "60px" },
        inspectorSections: ["layout", "background", "border", "spacing", "size"],
        appearance: "p-4 bg-white rounded-xl border border-blue-100 min-h-[60px] flex gap-3",
        description: "Flexbox container",
    },
    grid: {
        type: "grid",
        displayName: "Grid",
        category: "layout",
        iconPath: "M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z",
        canHaveChildren: true,
        defaultProps: {},
        defaultStyles: { display: "grid", gap: "12px", padding: "16px", minHeight: "60px" },
        inspectorSections: ["layout", "background", "border", "spacing", "size"],
        appearance: "p-4 bg-white rounded-xl border border-purple-100 min-h-[60px]",
        description: "CSS Grid",
    },

    /* ────────────── Typography ────────────── */
    heading: {
        type: "heading",
        displayName: "Heading",
        category: "typography",
        iconPath: "M4 6h16M4 12h8m-8 6h16",
        canHaveChildren: false,
        defaultProps: { text: "Heading", level: 2 },
        defaultStyles: { fontSize: "18px", fontWeight: "700", color: "#1e293b" },
        inspectorSections: ["text", "typography", "spacing"],
        appearance: "p-3",
        description: "H1-H6 heading",
    },
    paragraph: {
        type: "paragraph",
        displayName: "Paragraph",
        category: "typography",
        iconPath: "M4 6h16M4 12h16M4 18h7",
        canHaveChildren: false,
        defaultProps: { text: "Text content..." },
        defaultStyles: { fontSize: "14px", color: "#475569", lineHeight: "1.625" },
        inspectorSections: ["text", "typography", "spacing"],
        appearance: "p-3",
        description: "Text paragraph",
    },
    text: {
        type: "text",
        displayName: "Text",
        category: "typography",
        iconPath: "M12 6v6m0 0v6m0-6h6m-6 0H6",
        canHaveChildren: false,
        defaultProps: { text: "Text content..." },
        defaultStyles: { fontSize: "14px", color: "#475569" },
        inspectorSections: ["text", "typography", "spacing"],
        appearance: "p-3",
        description: "Inline text",
    },
    link: {
        type: "link",
        displayName: "Link",
        category: "typography",
        iconPath: "M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1",
        canHaveChildren: false,
        defaultProps: { text: "Link", href: "#" },
        defaultStyles: { fontSize: "14px", color: "#6366f1" },
        inspectorSections: ["text", "link", "typography", "spacing"],
        appearance: "p-2",
        description: "Hyperlink",
    },

    /* ────────────── Media ────────────── */
    image: {
        type: "image",
        displayName: "Image",
        category: "media",
        iconPath: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
        canHaveChildren: false,
        defaultProps: { src: "", alt: "Image" },
        defaultStyles: { minHeight: "80px" },
        inspectorSections: ["image", "size", "border", "spacing"],
        appearance: "bg-slate-50 rounded-xl border border-dashed border-slate-200 min-h-[80px]",
        description: "Image",
    },
    video: {
        type: "video",
        displayName: "Video",
        category: "media",
        iconPath: "M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
        canHaveChildren: false,
        defaultProps: { src: "" },
        defaultStyles: { minHeight: "80px" },
        inspectorSections: ["size", "border", "spacing"],
        appearance: "bg-slate-50 rounded-xl border border-dashed border-slate-200 min-h-[80px]",
        description: "Video player",
    },
    icon: {
        type: "icon",
        displayName: "Icon",
        category: "media",
        iconPath: "M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
        canHaveChildren: false,
        defaultProps: { name: "star" },
        defaultStyles: { width: "24px", height: "24px" },
        inspectorSections: ["size", "spacing"],
        appearance: "inline-flex items-center justify-center",
        description: "Icon",
    },

    /* ────────────── Form ────────────── */
    form: {
        type: "form",
        displayName: "Form",
        category: "form",
        iconPath: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
        canHaveChildren: true,
        defaultProps: {},
        defaultStyles: { padding: "20px", minHeight: "60px" },
        inspectorSections: ["layout", "background", "border", "spacing", "size"],
        appearance: "p-5 bg-white rounded-xl border border-slate-200 min-h-[60px]",
        description: "Form container",
    },
    input: {
        type: "input",
        displayName: "Input",
        category: "form",
        iconPath: "M4 6h16v4H4zM4 14h16v4H4z",
        canHaveChildren: false,
        defaultProps: { text: "Input field...", inputType: "text" },
        defaultStyles: {},
        inspectorSections: ["text", "typography", "border", "spacing", "size"],
        appearance: "border border-slate-300 rounded-lg px-3 py-2.5 bg-white",
        description: "Text input",
    },
    textarea: {
        type: "textarea",
        displayName: "Textarea",
        category: "form",
        iconPath: "M4 5h16a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1z",
        canHaveChildren: false,
        defaultProps: { text: "Multi-line input..." },
        defaultStyles: { minHeight: "60px" },
        inspectorSections: ["text", "typography", "border", "spacing", "size"],
        appearance: "border border-slate-300 rounded-lg px-3 py-2.5 bg-white min-h-[60px]",
        description: "Multi-line input",
    },
    select: {
        type: "select",
        displayName: "Select",
        category: "form",
        iconPath: "M8 9l4-4 4 4m0 6l-4 4-4-4",
        canHaveChildren: false,
        defaultProps: { text: "Select...", options: [] },
        defaultStyles: {},
        inspectorSections: ["text", "border", "spacing", "size"],
        appearance: "border border-slate-300 rounded-lg px-3 py-2.5 bg-white",
        description: "Dropdown select",
    },
    checkbox: {
        type: "checkbox",
        displayName: "Checkbox",
        category: "form",
        iconPath: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
        canHaveChildren: false,
        defaultProps: { text: "Checkbox", checked: false },
        defaultStyles: {},
        inspectorSections: ["text", "spacing"],
        appearance: "flex items-center gap-2",
        description: "Checkbox",
    },
    button: {
        type: "button",
        displayName: "Button",
        category: "form",
        iconPath: "M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122",
        canHaveChildren: false,
        defaultProps: { text: "Button" },
        defaultStyles: { backgroundColor: "#6366f1", color: "#ffffff", fontWeight: "500" },
        inspectorSections: ["text", "typography", "background", "border", "spacing", "size"],
        appearance: "px-5 py-2.5 bg-indigo-500 text-white rounded-lg text-center font-medium shadow-sm inline-block",
        description: "Button",
    },

    /* ────────────── Components ────────────── */
    card: {
        type: "card",
        displayName: "Card",
        category: "component",
        iconPath: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10",
        canHaveChildren: true,
        defaultProps: {},
        defaultStyles: { padding: "20px" },
        inspectorSections: ["layout", "background", "border", "spacing", "size"],
        appearance: "p-5 bg-white rounded-xl shadow-sm border border-slate-100",
        description: "Content card",
    },
    modal: {
        type: "modal",
        displayName: "Modal",
        category: "component",
        iconPath: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
        canHaveChildren: true,
        defaultProps: { title: "Modal" },
        defaultStyles: { padding: "24px", minHeight: "120px" },
        inspectorSections: ["text", "layout", "background", "border", "spacing", "size"],
        appearance: "p-6 bg-white rounded-xl shadow-lg border border-slate-200 min-h-[120px]",
        description: "Modal dialog",
    },
    tabs: {
        type: "tabs",
        displayName: "Tabs",
        category: "component",
        iconPath: "M4 6h4v2H4V6zm6 0h4v2h-4V6zm6 0h4v2h-4V6zM4 12h16v8H4v-8z",
        canHaveChildren: true,
        defaultProps: {},
        defaultStyles: { minHeight: "80px" },
        inspectorSections: ["layout", "background", "border", "spacing", "size"],
        appearance: "bg-white rounded-xl border border-slate-200 min-h-[80px] overflow-hidden",
        description: "Tab container",
    },
    accordion: {
        type: "accordion",
        displayName: "Accordion",
        category: "component",
        iconPath: "M4 6h16M4 12h16M4 18h16",
        canHaveChildren: true,
        defaultProps: {},
        defaultStyles: { minHeight: "60px" },
        inspectorSections: ["layout", "background", "border", "spacing"],
        appearance: "bg-white rounded-xl border border-slate-200 min-h-[60px] divide-y divide-slate-100",
        description: "Collapsible sections",
    },
    table: {
        type: "table",
        displayName: "Table",
        category: "component",
        iconPath: "M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z",
        canHaveChildren: false,
        defaultProps: { columns: [], rows: [] },
        defaultStyles: { minHeight: "80px" },
        inspectorSections: ["size", "border", "spacing"],
        appearance: "bg-white rounded-xl border border-slate-200 min-h-[80px] overflow-hidden",
        description: "Data table",
    },

    /* ────────────── Special ────────────── */
    instance: {
        type: "instance",
        displayName: "Component Instance",
        category: "component",
        iconPath: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
        canHaveChildren: false,
        defaultProps: {},
        defaultStyles: { minHeight: "60px" },
        inspectorSections: ["layout", "spacing"],
        appearance: "border-2 border-dashed border-indigo-400/50 rounded-xl bg-indigo-50/10 min-h-[60px]",
        description: "Reusable component",
    },
};

/* ═══════════════════  Helpers  ═════════════════════ */

/** Container types that can accept children */
export const CONTAINER_TYPES = new Set(
    Object.entries(BLOCK_REGISTRY)
        .filter(([, meta]) => meta.canHaveChildren)
        .map(([key]) => key),
);

/** Get block categories for the palette */
export function getPaletteCategories(): { name: string; blocks: BlockMeta[] }[] {
    const categories: Record<string, BlockMeta[]> = {};
    for (const meta of Object.values(BLOCK_REGISTRY)) {
        if (meta.type === "instance" || meta.type === "column") continue; // skip specials
        const cat = meta.category;
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(meta);
    }

    const order: BlockCategory[] = ["layout", "typography", "media", "form", "component"];
    const labels: Record<BlockCategory, string> = {
        layout: "Layout",
        typography: "Typography",
        media: "Media",
        form: "Form",
        component: "Components",
    };

    return order
        .filter((cat) => categories[cat]?.length)
        .map((cat) => ({ name: labels[cat], blocks: categories[cat] }));
}
