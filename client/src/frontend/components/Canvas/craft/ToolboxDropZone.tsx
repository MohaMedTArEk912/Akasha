/**
 * ToolboxDropZone — bridges the existing Akasha pointer-based drag system
 * with craft.js's node management.
 *
 * Since Tauri WebView2 has issues with HTML5 DnD, we keep the existing
 * DragDropContext (pointer-based system) and adapt it to create craft.js
 * nodes on drop instead of calling addBlockAtPosition().
 *
 * This component listens for "akasha-pointer-drop" events and translates
 * them into craft.js `actions.addNodeTree()` calls.
 */

import { useEffect, useRef } from "react";
import { useEditor } from "@craftjs/core";
import React from "react";
import { CraftBlock } from "./CraftBlock";
import { BLOCK_REGISTRY } from "./blockRegistry";
import type { DragPayload } from "../../../context/DragDropContext";

export const ToolboxDropZone: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { actions, query } = useEditor();
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail as {
                payload: DragPayload;
                x: number;
                y: number;
            };
            if (!detail?.payload) return;

            // Check if drop is over our container
            const els = document.elementsFromPoint(detail.x, detail.y);
            if (!containerRef.current) return;
            const isOverCanvas = els.some(
                (el) => containerRef.current!.contains(el) || el === containerRef.current,
            );
            if (!isOverCanvas) return;

            const { payload } = detail;

            // Skip if this is a move operation (handled by craft.js internally)
            if (payload.moveId) return;

            // New block from palette
            if (payload.type) {
                const meta = BLOCK_REGISTRY[payload.type];
                const defaultProps = meta
                    ? { ...meta.defaultProps, ...meta.defaultStyles }
                    : {};

                const nodeTree = query.parseReactElement(
                    React.createElement(CraftBlock, {
                        blockType: payload.type,
                        blockName: payload.label || payload.type.charAt(0).toUpperCase() + payload.type.slice(1),
                        blockId: "", // craft.js will assign an ID
                        text: (defaultProps as any).text || "",
                        styles: meta?.defaultStyles || {},
                        responsiveStyles: {},
                        properties: meta?.defaultProps || {},
                        bindings: {},
                        eventHandlers: [],
                        componentId: payload.componentId,
                    })
                ).toNodeTree();

                // Add to ROOT (the page root container)
                try {
                    actions.addNodeTree(nodeTree, "ROOT");
                } catch (err) {
                    console.error("[ToolboxDropZone] Failed to add node:", err);
                }
            }
        };

        document.addEventListener("akasha-pointer-drop", handler);
        return () => document.removeEventListener("akasha-pointer-drop", handler);
    }, [actions, query]);

    return (
        <div ref={containerRef} className="h-full">
            {children}
        </div>
    );
};

export default ToolboxDropZone;
