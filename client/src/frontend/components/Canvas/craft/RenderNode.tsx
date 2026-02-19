/**
 * RenderNode — craft.js onRender callback component.
 *
 * Wraps every node with:
 * - Selection ring (indigo border when selected)
 * - Hover highlight (light border when hovered)
 * - Block type label badge
 * - Resize handles via re-resizable (when selected)
 */

import React, { useCallback } from "react";
import { useNode, useEditor } from "@craftjs/core";
import { Resizable } from "re-resizable";
import type { CraftBlockProps } from "./serialization";

/* ═══════════════════  RenderNode  ══════════════════ */

export const RenderNode: React.FC<{ render: React.ReactElement }> = ({ render }) => {
    const {
        id,
        isActive,
        isHovered,
        dom,
        blockType,
        blockName,
        nodeWidth,
        nodeHeight,
        actions: { setProp },
    } = useNode((node) => ({
        isActive: node.events.selected,
        isHovered: node.events.hovered,
        dom: node.dom,
        blockType: (node.data.props as CraftBlockProps)?.blockType ?? "block",
        blockName: (node.data.props as CraftBlockProps)?.blockName ?? node.data.displayName ?? "Block",
        nodeWidth: (node.data.props as CraftBlockProps)?.styles?.width,
        nodeHeight: (node.data.props as CraftBlockProps)?.styles?.height,
    }));

    const { enabled } = useEditor((state) => ({
        enabled: state.options.enabled,
    }));

    /* ── Outline classes applied to the DOM element ── */
    React.useEffect(() => {
        if (!dom) return;
        if (isActive) {
            dom.classList.add("ring-2", "ring-indigo-500", "ring-offset-1");
            dom.classList.remove("ring-1", "ring-indigo-300/50");
        } else if (isHovered && enabled) {
            dom.classList.add("ring-1", "ring-indigo-300/50");
            dom.classList.remove("ring-2", "ring-indigo-500", "ring-offset-1");
        } else {
            dom.classList.remove("ring-2", "ring-indigo-500", "ring-offset-1", "ring-1", "ring-indigo-300/50");
        }
    }, [dom, isActive, isHovered, enabled]);

    /* ── Resize handler ── */
    const onResizeStop = useCallback(
        (_e: any, _dir: any, _ref: any, delta: { width: number; height: number }) => {
            setProp((props: CraftBlockProps) => {
                const curW = typeof props.styles?.width === "number" ? props.styles.width : 0;
                const curH = typeof props.styles?.height === "number" ? props.styles.height : 0;
                props.styles = {
                    ...props.styles,
                    width: curW + delta.width,
                    height: curH + delta.height,
                };
            });
        },
        [setProp],
    );

    return (
        <div className="relative transition-shadow duration-100 rounded-lg" data-craft-node={id}>
            {/* Block type label (selected or hovered) */}
            {(isActive || (isHovered && enabled)) && (
                <div
                    className={`absolute -top-5 left-0 z-20 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-t pointer-events-none whitespace-nowrap ${
                        isActive
                            ? "bg-indigo-500 text-white"
                            : "bg-slate-100 text-slate-400 border border-slate-200/60"
                    }`}
                >
                    {blockName || blockType}
                </div>
            )}

            {/* Resize wrapper (only when selected and editor is enabled) */}
            {isActive && enabled ? (
                <Resizable
                    size={{
                        width: (typeof nodeWidth === "boolean" ? "auto" : nodeWidth) ?? "auto",
                        height: (typeof nodeHeight === "boolean" ? "auto" : nodeHeight) ?? "auto",
                    }}
                    onResizeStop={onResizeStop}
                    enable={{
                        top: false,
                        right: true,
                        bottom: true,
                        left: false,
                        topRight: false,
                        bottomRight: true,
                        bottomLeft: false,
                        topLeft: false,
                    }}
                    handleStyles={{
                        right: {
                            width: "6px",
                            right: "-3px",
                            background: "transparent",
                        },
                        bottom: {
                            height: "6px",
                            bottom: "-3px",
                            background: "transparent",
                        },
                        bottomRight: {
                            width: "8px",
                            height: "8px",
                            right: "-4px",
                            bottom: "-4px",
                            background: "transparent",
                        },
                    }}
                    handleComponent={{
                        bottomRight: <ResizeCorner />,
                    }}
                    className="!relative"
                >
                    {render}
                    <ResizeHandles />
                </Resizable>
            ) : (
                render
            )}
        </div>
    );
};

/* ═══════════════════  Sub-components  ══════════════ */

/** Corner resize handles — visual indicators at block corners. */
const ResizeHandles: React.FC = () => (
    <>
        <div className="absolute -top-[3px] -left-[3px] w-[7px] h-[7px] bg-white border-2 border-indigo-500 rounded-full z-30 pointer-events-none" />
        <div className="absolute -top-[3px] -right-[3px] w-[7px] h-[7px] bg-white border-2 border-indigo-500 rounded-full z-30 pointer-events-none" />
        <div className="absolute -bottom-[3px] -left-[3px] w-[7px] h-[7px] bg-white border-2 border-indigo-500 rounded-full z-30 pointer-events-none" />
        <div className="absolute -bottom-[3px] -right-[3px] w-[7px] h-[7px] bg-white border-2 border-indigo-500 rounded-full z-30 cursor-se-resize" />
    </>
);

/** The actual draggable corner for resize */
const ResizeCorner: React.FC = () => (
    <div className="w-[8px] h-[8px] bg-white border-2 border-indigo-500 rounded-full cursor-se-resize" />
);

export default RenderNode;
