/**
 * CraftBlock — generic craft.js node component.
 *
 * Instead of having a separate file for every block type (TextNode, ButtonNode, etc.)
 * this single component reads from the block registry and renders any type.
 * craft.js uses this as the only resolver entry.
 *
 * Features:
 * - Root-aware: ROOT node fills entire artboard, is NOT draggable
 * - Position locking via __locked property
 * - Context menu dispatch for right-click actions
 * - Absolute positioning support for child blocks (free canvas mode)
 */

import React, { useCallback, useState, useRef, useEffect } from "react";
import { useNode, useEditor } from "@craftjs/core";
import { BLOCK_REGISTRY, CONTAINER_TYPES } from "../hooks/craft/blockRegistry";
import type { CraftBlockProps } from "../hooks/craft/serialization";

/* ═══════════════════  Component  ═══════════════════ */

export const CraftBlock: React.FC<React.PropsWithChildren<CraftBlockProps>> = (props) => {
    const {
        blockType,
        text,
        styles = {},
        properties = {},
        classes = [],
        children,
    } = props;

    const {
        connectors: { connect },
        id,
        actions: { setProp },
    } = useNode();

    const { enabled } = useEditor((state) => ({
        enabled: state.options.enabled,
    }));

    const [editing, setEditing] = useState(false);
    const blockRef = useRef<HTMLDivElement | null>(null);

    const meta = BLOCK_REGISTRY[blockType];
    const isContainer = CONTAINER_TYPES.has(blockType);
    const isLocked = !!properties?.__locked;
    const isRoot = id === "ROOT";

    /* ── Free drag-to-reposition for non-root blocks ── */
    const dragState = useRef<{
        active: boolean;
        startX: number;
        startY: number;
        origLeft: number;
        origTop: number;
    } | null>(null);

    const handleMouseDown = useCallback(
        (e: React.MouseEvent) => {
            if (!enabled || isRoot || isLocked || editing) return;
            // Only left button, no modifier keys
            if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey) return;
            // Don't intercept resize handles or content-editable
            if ((e.target as HTMLElement).closest(".react-resizable-handle")) return;
            if ((e.target as HTMLElement).isContentEditable) return;

            e.stopPropagation();

            const el = blockRef.current;
            if (!el) return;

            // Get current position
            const computedStyle = window.getComputedStyle(el);
            const currentLeft = parseInt(computedStyle.left, 10) || 0;
            const currentTop = parseInt(computedStyle.top, 10) || 0;

            dragState.current = {
                active: false, // becomes true after threshold
                startX: e.clientX,
                startY: e.clientY,
                origLeft: currentLeft,
                origTop: currentTop,
            };
        },
        [enabled, isRoot, isLocked, editing],
    );

    useEffect(() => {
        if (isRoot || !enabled) return;

        const handleMouseMove = (e: MouseEvent) => {
            const ds = dragState.current;
            if (!ds) return;

            const dx = e.clientX - ds.startX;
            const dy = e.clientY - ds.startY;

            // Activation threshold (4px)
            if (!ds.active && Math.abs(dx) + Math.abs(dy) < 4) return;
            ds.active = true;

            const el = blockRef.current;
            if (!el) return;

            // Calculate new position
            let newLeft = ds.origLeft + dx;
            let newTop = ds.origTop + dy;

            // Boundary clamping against parent
            const parent = el.parentElement;
            if (parent) {
                const parentRect = parent.getBoundingClientRect();
                const elRect = el.getBoundingClientRect();
                const elW = elRect.width;
                const elH = elRect.height;

                // Clamp so block stays within parent (allow at least 20px visible)
                const minVisible = 20;
                newLeft = Math.max(-elW + minVisible, Math.min(newLeft, parentRect.width - minVisible));
                newTop = Math.max(-elH + minVisible, Math.min(newTop, parentRect.height - minVisible));
            }

            // Apply visual position immediately
            el.style.position = "absolute";
            el.style.left = newLeft + "px";
            el.style.top = newTop + "px";
            el.style.zIndex = "10";
            el.style.cursor = "grabbing";
        };

        const handleMouseUp = (_e: MouseEvent) => {
            const ds = dragState.current;
            if (!ds) return;
            dragState.current = null;

            if (!ds.active) return; // Was a click, not a drag

            const el = blockRef.current;
            if (!el) return;

            // Persist the new position into craft.js props
            const finalLeft = parseInt(el.style.left, 10) || 0;
            const finalTop = parseInt(el.style.top, 10) || 0;

            el.style.cursor = "";
            el.style.zIndex = "";

            setProp((p: CraftBlockProps) => {
                p.styles = {
                    ...p.styles,
                    position: "absolute",
                    left: finalLeft + "px",
                    top: finalTop + "px",
                };
            });
        };

        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
        return () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
        };
    }, [isRoot, enabled, setProp]);

    /* ── Inline text editing ── */
    const isTextEditable = ["text", "paragraph", "heading", "button", "link"].includes(blockType);

    const onDoubleClick = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            if (isTextEditable && enabled) {
                setEditing(true);
            }
        },
        [isTextEditable, enabled],
    );

    const onBlur = useCallback(
        (e: React.FocusEvent) => {
            setEditing(false);
            const newText = (e.currentTarget as HTMLElement).innerText.trim();
            if (newText !== (text ?? "")) {
                setProp((p: CraftBlockProps) => {
                    p.text = newText;
                    p.properties = { ...p.properties, text: newText };
                });
            }
        },
        [text, setProp],
    );

    const onKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            (e.currentTarget as HTMLElement).blur();
        }
        if (e.key === "Escape") {
            setEditing(false);
            (e.currentTarget as HTMLElement).blur();
        }
    }, []);

    /* ── Context menu ── */
    const onContextMenu = useCallback((e: React.MouseEvent) => {
        if (!enabled) return;
        e.preventDefault();
        e.stopPropagation();
        const evt = new CustomEvent("akasha-context-menu", {
            detail: { nodeId: id, x: e.clientX, y: e.clientY },
        });
        document.dispatchEvent(evt);
    }, [enabled, id]);

    /* ── Convert styles object to React CSSProperties ── */
    const inlineStyle: React.CSSProperties = {};
    if (styles) {
        for (const [k, v] of Object.entries(styles)) {
            if (k === "pointer-events" || k === "pointerEvents") continue;
            if (typeof v === "string" || typeof v === "number") {
                (inlineStyle as Record<string, unknown>)[k] = v;
            }
        }
    }
    inlineStyle.pointerEvents = "auto";

    /* ── ROOT-specific styles: fill entire artboard ── */
    if (isRoot) {
        inlineStyle.position = "relative";
        inlineStyle.minHeight = "100%";
        inlineStyle.width = "100%";
        if (!inlineStyle.padding) inlineStyle.padding = "16px";
    }

    /* ── Base CSS classes ── */
    const registryClasses = meta?.appearance ?? "p-3 bg-white rounded-lg border border-slate-200 min-h-[36px]";
    const blockClasses = classes.length > 0 ? classes.join(" ") : "";

    /* ── Editor-mode container styling ── */
    const containerEditorClasses = isContainer && enabled && !isRoot
        ? "border border-dashed border-indigo-200/50 rounded-xl bg-gradient-to-b from-slate-50/50 to-white min-h-[80px] p-3"
        : "";

    // Root has no visible container styling — it's the page itself
    const rootClasses = isRoot
        ? "bg-white"
        : "";

    // Priority: root → block classes → container editor → registry
    const appliedClasses = isRoot
        ? rootClasses
        : (blockClasses || (isContainer && enabled ? containerEditorClasses : "") || registryClasses);

    /* ── Lock indicator style ── */
    const lockStyle = isLocked && enabled ? "opacity-70" : "";

    /* ── Cursor ── */
    const cursorClass = editing
        ? ""
        : isRoot
            ? "cursor-default"
            : isLocked
                ? "cursor-not-allowed"
                : "cursor-grab";

    /* ── Render ── */
    return (
        <div
            ref={(ref) => {
                blockRef.current = ref;
                if (ref) {
                    connect(ref);
                }
            }}
            className={`relative ${appliedClasses} ${lockStyle} ${cursorClass}`}
            style={inlineStyle}
            onDoubleClick={onDoubleClick}
            onMouseDown={handleMouseDown}
            onContextMenu={onContextMenu}
            data-block-id={id}
            data-block-type={blockType}
        >
            {/* Lock badge */}
            {isLocked && enabled && !isRoot && (
                <div className="absolute -top-1 -right-1 z-30 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center shadow-sm" title="Locked">
                    <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                </div>
            )}

            {/* Inline text editing */}
            {editing && isTextEditable ? (
                <div
                    contentEditable
                    suppressContentEditableWarning
                    className="outline-none min-h-[1em] cursor-text"
                    onBlur={onBlur}
                    onKeyDown={onKeyDown}
                    ref={(el) => {
                        if (el) {
                            const current = (text as string) || "";
                            if (el.innerText.trim() !== current) el.innerText = current;
                            el.focus();
                        }
                    }}
                />
            ) : (
                <BlockVisual
                    blockType={blockType}
                    text={text}
                    properties={properties}
                />
            )}

            {/* Children slot for container types */}
            {isContainer && (
                <div className={`craft-children ${isRoot ? "min-h-full" : "min-h-[40px]"}`}>
                    {children}
                </div>
            )}
        </div>
    );
};

/* ── craft.js configuration ── */
(CraftBlock as any).craft = {
    displayName: "Block",
    props: {
        blockType: "container",
        blockName: "Block",
        blockId: "",
        text: "",
        styles: {},
        responsiveStyles: {},
        properties: {},
        bindings: {},
        eventHandlers: [],
    } as CraftBlockProps,
    rules: {
        canDrag: (_node: any) => {
            // Root can never be dragged
            if (_node?.id === "ROOT") return false;
            const locked = _node?.data?.props?.properties?.__locked;
            return !locked;
        },
        canDrop: (dropTarget: any) => {
            const bt = dropTarget?.data?.props?.blockType;
            return bt ? CONTAINER_TYPES.has(bt) : false;
        },
        canMoveIn: (_incoming: any[], self: any) => {
            const bt = self?.data?.props?.blockType;
            return bt ? CONTAINER_TYPES.has(bt) : false;
        },
        canMoveOut: () => true,
    },
};

/* ═══════════════════  Block Visual  ════════════════ */

interface BlockVisualProps {
    blockType: string;
    text?: string;
    properties: Record<string, unknown>;
}

const BlockVisual: React.FC<BlockVisualProps> = ({ blockType, text, properties }) => {
    switch (blockType) {
        case "instance":
            return (
                <div className="flex flex-col items-center justify-center p-4 min-h-[60px]">
                    <span className="text-xl mb-1">🧩</span>
                    <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
                        Component
                    </span>
                </div>
            );
        case "heading":
            return <h2 className="text-lg font-bold text-slate-800 leading-tight">{text || "Heading"}</h2>;
        case "text":
        case "paragraph":
            return <p className="text-sm text-slate-600 leading-relaxed">{text || "Text content..."}</p>;
        case "button":
            return <span className="text-sm font-medium">{text || "Button"}</span>;
        case "link":
            return <span className="text-sm text-indigo-500 underline underline-offset-2">{text || "Link"}</span>;
        case "image":
            return (
                <div className="flex flex-col items-center justify-center py-6 text-slate-300">
                    <svg className="w-8 h-8 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-[10px]">Image</span>
                </div>
            );
        case "video":
            return (
                <div className="flex flex-col items-center justify-center py-6 text-slate-300">
                    <svg className="w-8 h-8 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-[10px]">Video</span>
                </div>
            );
        case "input":
            return (
                <input
                    type="text"
                    placeholder={text || "Input field..."}
                    className="w-full outline-none bg-transparent text-sm text-slate-500 pointer-events-none"
                    disabled
                    tabIndex={-1}
                />
            );
        case "textarea":
            return <div className="text-sm text-slate-400 italic">Multi-line input...</div>;
        case "select":
            return (
                <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">{text || "Select..."}</span>
                    <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            );
        case "checkbox":
            return (
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded border-2 border-slate-300 shrink-0" />
                    <span className="text-sm text-slate-600">{text || "Checkbox"}</span>
                </div>
            );
        case "icon":
            return (
                <div className="flex items-center justify-center p-2 text-slate-400">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                </div>
            );
        // Container types show nothing extra (children render inside)
        case "canvas":
        case "container":
        case "section":
        case "columns":
        case "column":
        case "flex":
        case "grid":
        case "form":
        case "card":
        case "modal":
        case "tabs":
        case "accordion":
            return null;
        case "table":
            return (
                <div className="text-center py-4 text-slate-300 text-xs">
                    <svg className="w-6 h-6 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Table
                </div>
            );
        default:
            return (
                <span className="text-xs text-slate-400 font-medium">
                    {text || properties?.name as string || blockType}
                </span>
            );
    }
};

export default CraftBlock;
