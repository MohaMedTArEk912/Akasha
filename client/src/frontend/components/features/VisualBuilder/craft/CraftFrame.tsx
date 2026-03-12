/**
 * CraftFrame — the main canvas viewport.
 *
 * Renders:
 * - Unified toolbar: viewport switcher (left) + undo/redo & zoom (right)
 * - Zoomable artboard with craft.js <Frame>
 * - Empty state when no blocks exist
 * - Keyboard shortcuts for undo/redo/zoom/delete/duplicate/lock
 * - Palette→canvas drop handling (akasha-pointer-drop + HTML5 DnD)
 * - Page background settings (color, gradient, image)
 *
 * Loads blocks from the backend on page change and deserializes them
 * into craft.js's internal state.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Frame, Element, useEditor } from "@craftjs/core";
import { useProjectStore } from "../../../../hooks/useProjectStore";
import { setViewport } from "../../../../stores/projectStore";
import { CraftBlock } from "./CraftBlock";
import { blocksToSerializedNodes } from "./serialization";
import { useCanvasViewport } from "./useCanvasViewport";
import { CanvasToolbar } from "./CanvasToolbar";
import { BLOCK_REGISTRY } from "./blockRegistry";
import { HexColorPicker } from "react-colorful";

/* ═══════════════════  Constants  ═══════════════════ */

const ARTBOARD_SIZES: Record<string, { w: number; h: number; label: string }> = {
    desktop: { w: 1440, h: 900, label: "Desktop" },
    tablet: { w: 768, h: 1024, label: "Tablet" },
    mobile: { w: 375, h: 812, label: "Mobile" },
};

const BG_PRESETS = [
    { label: "White", value: "#ffffff" },
    { label: "Light Gray", value: "#f8fafc" },
    { label: "Warm", value: "#fffbeb" },
    { label: "Cool", value: "#f0f9ff" },
    { label: "Dark", value: "#0f172a" },
    { label: "Gradient 1", value: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" },
    { label: "Gradient 2", value: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)" },
    { label: "Gradient 3", value: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)" },
];

/* ═══════════════════  CraftFrame  ═════════════════ */

export const CraftFrame: React.FC = () => {
    const { project, selectedPageId, selectedComponentId, viewport } = useProjectStore();
    const { actions, query } = useEditor();
    const {
        zoom, scrollRef,
        zoomIn, zoomOut, zoomReset, setZoom,
        onScroll, onWheel,
    } = useCanvasViewport();

    // Viewport measurement
    const [vpSize, setVpSize] = useState({ w: 0, h: 0 });
    // Page background
    const [pageBg, setPageBg] = useState("#ffffff");
    const [showBgPicker, setShowBgPicker] = useState(false);
    const bgPickerRef = useRef<HTMLDivElement>(null);
    // Artboard ref for drop coordinate calculation
    const artboardRef = useRef<HTMLDivElement>(null);

    const ab = ARTBOARD_SIZES[viewport] || ARTBOARD_SIZES.desktop;
    const artW = viewport === "desktop" ? Math.max(ab.w, vpSize.w) : ab.w;
    const artH = viewport === "desktop" ? Math.max(ab.h, vpSize.h) : ab.h;

    // ── Viewport size tracking ──
    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const sync = () => setVpSize({ w: el.clientWidth, h: el.clientHeight });
        sync();
        const ro = new ResizeObserver(sync);
        ro.observe(el);
        return () => ro.disconnect();
    }, [scrollRef]);

    // ── Scroll to top on page change ──
    useEffect(() => {
        if (!scrollRef.current || !selectedPageId) return;
        scrollRef.current.scrollTop = 0;
    }, [selectedPageId, scrollRef]);

    // ── Load blocks into craft.js when page changes ──
    useEffect(() => {
        if (!project || !selectedPageId) return;

        const page = project.pages.find((p) => p.id === selectedPageId && !p.archived);
        if (!page?.root_block_id) return;

        const activeBlocks = project.blocks.filter((b) => !b.archived);
        const pageBlocks = getPageBlocks(activeBlocks, page.root_block_id);

        if (pageBlocks.length === 0) return;

        const serialized = blocksToSerializedNodes(pageBlocks, page.root_block_id);

        try {
            actions.deserialize(serialized);
        } catch (err) {
            console.error("[CraftFrame] Failed to deserialize blocks:", err);
        }
    }, [project, selectedPageId, actions]);

    // ── Close BG picker on outside click ──
    useEffect(() => {
        if (!showBgPicker) return;
        const handler = (e: MouseEvent) => {
            if (bgPickerRef.current && !bgPickerRef.current.contains(e.target as Node)) {
                setShowBgPicker(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [showBgPicker]);

    // ── Helper: add a block via craft.js ──
    const addBlockToCraft = useCallback((blockType: string, parentId?: string, componentId?: string) => {
        try {
            const meta = BLOCK_REGISTRY[blockType];
            const nodeTree = query.parseReactElement(
                React.createElement(CraftBlock, {
                    blockType,
                    blockName: meta?.displayName || blockType.charAt(0).toUpperCase() + blockType.slice(1),
                    blockId: "",
                    text: (meta?.defaultProps as any)?.text || "",
                    styles: meta?.defaultStyles || {},
                    responsiveStyles: {},
                    properties: meta?.defaultProps || {},
                    bindings: {},
                    eventHandlers: [],
                    componentId,
                }),
            ).toNodeTree();
            actions.addNodeTree(nodeTree, parentId || "ROOT");
        } catch (err) {
            console.error("[CraftFrame] Failed to add block:", err);
        }
    }, [actions, query]);

    // ── Palette pointer-drop handler ──
    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (!detail?.payload?.type) return;

            const { type, componentId } = detail.payload;

            // Find the drop target - check if we dropped over a container node
            const dropX = detail.x;
            const dropY = detail.y;

            // Check if drop is within the artboard area
            const artboard = artboardRef.current;
            if (artboard) {
                const rect = artboard.getBoundingClientRect();
                if (dropX < rect.left || dropX > rect.right || dropY < rect.top || dropY > rect.bottom) {
                    return; // Drop outside canvas
                }
            }

            // Find the craft node under the cursor
            let targetNodeId = "ROOT";
            const el = document.elementFromPoint(dropX, dropY);
            if (el) {
                const craftNode = el.closest("[data-block-type]");
                if (craftNode) {
                    const nodeId = craftNode.getAttribute("data-block-id");
                    const nodeType = craftNode.getAttribute("data-block-type");
                    // Only target containers
                    if (nodeId && nodeType) {
                        try {
                            const nd = query.node(nodeId).get();
                            if (nd?.data?.isCanvas) {
                                targetNodeId = nodeId;
                            }
                        } catch { /* ignore */ }
                    }
                }
            }

            addBlockToCraft(type, targetNodeId, componentId);
        };

        document.addEventListener("akasha-pointer-drop", handler);
        return () => document.removeEventListener("akasha-pointer-drop", handler);
    }, [addBlockToCraft, query]);

    // ── HTML5 DnD drop handler (fallback for browser) ──
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        const blockType = e.dataTransfer.getData("application/akasha-block")
            || (window as any).__akashaDragData?.type;
        const componentId = e.dataTransfer.getData("application/akasha-component-id")
            || (window as any).__akashaDragData?.componentId;

        if (!blockType) return;

        // Find target under cursor
        let targetNodeId = "ROOT";
        const el = document.elementFromPoint(e.clientX, e.clientY);
        if (el) {
            const craftNode = el.closest("[data-block-type]");
            if (craftNode) {
                const nodeId = craftNode.getAttribute("data-block-id");
                if (nodeId) {
                    try {
                        const nd = query.node(nodeId).get();
                        if (nd?.data?.isCanvas) targetNodeId = nodeId;
                    } catch { /* ignore */ }
                }
            }
        }

        addBlockToCraft(blockType, targetNodeId, componentId || undefined);
        (window as any).__akashaDragData = null;
    }, [addBlockToCraft, query]);

    // ── Keyboard shortcuts ──
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const ctrl = e.ctrlKey || e.metaKey;

            // Don't intercept if user is in an input/textarea
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;

            if (ctrl) {
                switch (e.key) {
                    case "z":
                        if (e.shiftKey) {
                            e.preventDefault();
                            actions.history.redo();
                        } else {
                            e.preventDefault();
                            actions.history.undo();
                        }
                        break;
                    case "y":
                        e.preventDefault();
                        actions.history.redo();
                        break;
                    case "=":
                    case "+":
                        e.preventDefault();
                        zoomIn();
                        break;
                    case "-":
                        e.preventDefault();
                        zoomOut();
                        break;
                    case "0":
                        e.preventDefault();
                        zoomReset();
                        break;
                    case "d":
                    case "D":
                        e.preventDefault();
                        // Duplicate selected node
                        duplicateSelected();
                        break;
                    case "l":
                    case "L":
                        e.preventDefault();
                        // Toggle lock on selected node
                        toggleLockSelected();
                        break;
                }
                return;
            }

            // Delete key
            if (e.key === "Delete" || e.key === "Backspace") {
                e.preventDefault();
                deleteSelected();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [actions, zoomIn, zoomOut, zoomReset]);

    // ── Helper: get selected node ID ──
    const getSelectedId = useCallback((): string | null => {
        try {
            const state = query.getState();
            const sel = state.events.selected;
            if (!sel) return null;
            if (sel instanceof Set) return Array.from(sel)[0] ?? null;
            if (typeof sel === "string") return sel;
            if (Array.isArray(sel)) return sel[0] ?? null;
            if (typeof sel === "object" && typeof (sel as any)[Symbol.iterator] === "function") {
                return Array.from(sel as Iterable<string>)[0] ?? null;
            }
        } catch { /* ignore */ }
        return null;
    }, [query]);

    const deleteSelected = useCallback(() => {
        const nodeId = getSelectedId();
        if (!nodeId || nodeId === "ROOT") return;
        try { actions.delete(nodeId); } catch { /* ignore */ }
    }, [actions, getSelectedId]);

    const duplicateSelected = useCallback(() => {
        const nodeId = getSelectedId();
        if (!nodeId || nodeId === "ROOT") return;
        try {
            const nodeData = query.node(nodeId).get();
            const parentId = nodeData.data.parent;
            if (parentId) {
                const nodeTree = query.node(nodeId).toNodeTree();
                actions.addNodeTree(nodeTree, parentId);
            }
        } catch (err) {
            console.error("[CraftFrame] Duplicate failed:", err);
        }
    }, [actions, query, getSelectedId]);

    const toggleLockSelected = useCallback(() => {
        const nodeId = getSelectedId();
        if (!nodeId) return;
        try {
            const nodeData = query.node(nodeId).get();
            const locked = !!(nodeData.data.props as any)?.properties?.__locked;
            actions.setProp(nodeId, (p: any) => {
                p.properties = { ...p.properties, __locked: !locked };
            });
        } catch { /* ignore */ }
    }, [actions, query, getSelectedId]);

    // ── Background style ──
    const bgStyle: React.CSSProperties = {};
    if (pageBg.startsWith("linear-gradient") || pageBg.startsWith("radial-gradient")) {
        bgStyle.backgroundImage = pageBg;
    } else {
        bgStyle.backgroundColor = pageBg;
    }

    // ── Early returns ──
    if (!project) {
        return (
            <div className="h-full flex items-center justify-center bg-[var(--ide-bg)]">
                <p className="text-sm text-[var(--ide-text-secondary)]">Open or create a project to get started.</p>
            </div>
        );
    }

    return (
        <div className="h-full bg-[var(--ide-canvas-bg)] flex flex-col overflow-hidden">
            {/* ── Unified Toolbar ── */}
            <div className="h-10 bg-[var(--ide-bg-sidebar)]/80 backdrop-blur border-b border-[var(--ide-border)] px-4 flex items-center justify-between shrink-0 select-none shadow-sm z-10">
                {/* Left: Viewport switcher */}
                <ViewportButtons viewport={viewport} artW={artW} artH={artH} />

                {/* Center: Page Background */}
                <div className="flex items-center gap-2 relative">
                    <button
                        onClick={() => setShowBgPicker(!showBgPicker)}
                        className="flex items-center gap-1.5 h-7 px-2.5 bg-black/10 rounded-lg border border-white/5 hover:bg-black/20 transition-colors"
                        title="Page Background"
                    >
                        <div
                            className="w-4 h-4 rounded border border-white/20 shadow-inner"
                            style={pageBg.startsWith("linear") ? { backgroundImage: pageBg } : { backgroundColor: pageBg }}
                        />
                        <span className="text-[10px] text-[var(--ide-text-muted)] font-medium hidden sm:inline">Background</span>
                    </button>

                    {showBgPicker && (
                        <div
                            ref={bgPickerRef}
                            className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-50 bg-[#1a1a24] border border-white/10 rounded-xl shadow-2xl p-3 w-56"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Page Background</span>
                                <button onClick={() => setShowBgPicker(false)} className="text-white/30 hover:text-white p-0.5">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                            {/* Presets */}
                            <div className="grid grid-cols-4 gap-1.5 mb-3">
                                {BG_PRESETS.map(p => (
                                    <button
                                        key={p.label}
                                        onClick={() => setPageBg(p.value)}
                                        className={`h-8 rounded-lg border transition-all hover:scale-105 ${pageBg === p.value ? "border-indigo-500 ring-1 ring-indigo-500/50" : "border-white/10 hover:border-white/20"}`}
                                        style={p.value.startsWith("linear") ? { backgroundImage: p.value } : { backgroundColor: p.value }}
                                        title={p.label}
                                    />
                                ))}
                            </div>
                            {/* Custom color */}
                            <HexColorPicker
                                color={pageBg.startsWith("#") ? pageBg : "#ffffff"}
                                onChange={(c) => setPageBg(c)}
                                style={{ width: "100%", height: "120px" }}
                            />
                            {/* Custom input */}
                            <input
                                value={pageBg}
                                onChange={(e) => setPageBg(e.target.value)}
                                className="w-full mt-2 bg-white/5 border border-white/10 rounded-md px-2 py-1 text-[11px] text-white/70 focus:outline-none focus:border-indigo-500/50"
                                placeholder="#ffffff or linear-gradient(...)"
                            />
                        </div>
                    )}
                </div>

                {/* Right: Undo/Redo + Zoom */}
                <CanvasToolbar zoom={zoom} onZoomChange={setZoom} />
            </div>

            {/* ── Canvas area ── */}
            <div className="flex-1 relative overflow-hidden bg-[var(--ide-canvas-bg)]">
                {/* Subtle dot grid background */}
                <div className="absolute inset-0 pointer-events-none opacity-[0.15]"
                    style={{
                        backgroundImage: 'radial-gradient(circle, var(--ide-text-muted) 1.5px, transparent 1.5px)',
                        backgroundSize: '24px 24px',
                    }}
                />

                {/* Scrollable canvas */}
                <div
                    ref={scrollRef}
                    className="absolute overflow-auto inset-0 custom-scrollbar"
                    onScroll={onScroll}
                    onWheel={onWheel}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                >
                    <div
                        className="min-h-full"
                        style={{
                            display: "flex",
                            justifyContent: viewport === "desktop" ? "stretch" : "center",
                            padding: viewport === "desktop" ? 0 : "40px",
                        }}
                    >
                        {/* Zoom wrapper */}
                        <div
                            style={{
                                transform: viewport === "desktop" ? "none" : `scale(${zoom})`,
                                transformOrigin: "top center",
                                width: viewport === "desktop" ? "100%" : artW,
                                minHeight: viewport === "desktop" ? "100%" : artH,
                                transition: "all 0.3s ease-out"
                            }}
                            className="relative"
                        >
                            {/* Artboard (page surface) */}
                            <div
                                ref={artboardRef}
                                className={`transition-all duration-300 relative ${viewport !== "desktop" ? "shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.1)] rounded-[32px] overflow-hidden border border-white/5 ring-4 ring-black/20" : ""}`}
                                style={{
                                    width: viewport === "desktop" ? "100%" : artW,
                                    height: viewport === "desktop" ? "100%" : artH,
                                    minHeight: viewport === "desktop" ? "100%" : artH,
                                    ...bgStyle,
                                }}
                            >
                                {/* Mobile/Tablet Device Chrome (optional subtle top bar) */}
                                {viewport !== "desktop" && (
                                    <div className="absolute top-0 inset-x-0 h-6 bg-black/5 border-b border-black/5 flex items-center justify-center pointer-events-none z-50">
                                        <div className="w-16 h-1 rounded-full bg-black/10" />
                                    </div>
                                )}

                                {/* Component editing banner */}
                                {selectedComponentId && (
                                    <ComponentBanner
                                        name={project.components?.find((c: any) => c.id === selectedComponentId)?.name}
                                    />
                                )}

                                {/* craft.js Frame — force all internal wrapper divs to stretch */}
                                <div
                                    className={`craft-root-stretch ${viewport !== "desktop" ? "mt-6" : ""}`}
                                    style={{ height: "100%", minHeight: "100%" }}
                                >
                                    <Frame>
                                        <Element
                                            canvas
                                            is={CraftBlock}
                                            blockType="canvas"
                                            blockName="Page Root"
                                            blockId="ROOT"
                                            styles={{}}
                                            responsiveStyles={{}}
                                            properties={{}}
                                            bindings={{}}
                                            eventHandlers={[]}
                                            custom={{ isRoot: true }}
                                        >
                                        </Element>
                                    </Frame>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

/* ═══════════════════  Helpers  ═════════════════════ */

/**
 * Collect all blocks that belong to a page (root + all descendants).
 */
function getPageBlocks(allBlocks: any[], rootId: string): any[] {
    const result: any[] = [];
    const idSet = new Set<string>();

    function collect(blockId: string) {
        if (idSet.has(blockId)) return;
        const block = allBlocks.find((b: any) => b.id === blockId);
        if (!block) return;
        idSet.add(blockId);
        result.push(block);

        const children = allBlocks.filter((b: any) => b.parent_id === blockId);
        for (const child of children) {
            collect(child.id);
        }
    }

    collect(rootId);
    return result;
}

/* ═══════════════════  Sub-components  ══════════════ */

/** Viewport size switcher buttons. */
const ViewportButtons: React.FC<{
    viewport: string;
    artW: number;
    artH: number;
}> = ({ viewport, artW, artH }) => {
    const icons: Record<string, React.ReactNode> = {
        desktop: (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
        ),
        tablet: (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
        ),
        mobile: (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
        ),
    };

    return (
        <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5 bg-black/10 rounded-lg p-1 border border-white/5">
                {Object.entries(ARTBOARD_SIZES).map(([key, val]) => (
                    <button
                        key={key}
                        onClick={() => setViewport(key as "desktop" | "tablet" | "mobile")}
                        className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all flex items-center gap-1.5 ${viewport === key
                            ? "bg-white/10 text-[var(--ide-text)] shadow-sm"
                            : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-white/5"
                            }`}
                        title={`${val.label} (${val.w}px)`}
                    >
                        {icons[key]}
                        <span className={viewport === key ? "" : "hidden sm:inline"}>{val.label}</span>
                    </button>
                ))}
            </div>

            <div className="hidden md:flex items-center px-3 py-1.5 bg-black/10 rounded-lg border border-white/5 text-[10px] font-mono text-[var(--ide-text-secondary)] tabular-nums font-bold tracking-widest">
                {artW} <span className="mx-1.5 text-indigo-500/50">&times;</span> {artH}
            </div>
        </div>
    );
};

/** Component editing banner at top of artboard. */
const ComponentBanner: React.FC<{ name?: string }> = ({ name }) => (
    <div className="bg-indigo-600 text-white px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
            <span className="text-sm">🧩</span>
            <div>
                <p className="text-[9px] text-indigo-200 font-bold uppercase tracking-wider leading-none">Editing Component</p>
                <p className="text-xs font-bold truncate max-w-[200px]">{name || "Unknown"}</p>
            </div>
        </div>
        <button
            onClick={(e) => {
                e.stopPropagation();
                import("../../../../stores/projectStore").then(m => m.closeComponentEditor());
            }}
            className="px-3 py-1 text-[10px] font-bold bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
        >
            Exit
        </button>
    </div>
);

export default CraftFrame;
