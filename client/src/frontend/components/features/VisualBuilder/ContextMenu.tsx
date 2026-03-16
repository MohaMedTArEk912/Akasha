/**
 * ContextMenu — Professional right-click context menu for the Visual Builder.
 *
 * Actions: Duplicate, Delete, Lock/Unlock, Z-order (forward/backward/front/back),
 * Copy/Paste styles, Wrap in Container.
 *
 * Usage: Render once at page level. Listens for a custom 'akasha-context-menu' event
 * dispatched from CraftBlock's onContextMenu handler.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useEditor } from "@craftjs/core";
import { CraftBlock } from "./craft/CraftBlock";
import type { CraftBlockProps } from "./hooks/craft/serialization";

interface MenuPosition {
    x: number;
    y: number;
    nodeId: string;
}

/** Clipboard for copy/paste styles */
let copiedStyles: Record<string, string | number | boolean> | null = null;

const ContextMenu: React.FC = () => {
    const [menu, setMenu] = useState<MenuPosition | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const { actions, query } = useEditor();

    // Listen for context menu events from CraftBlock
    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail?.nodeId && detail?.x !== undefined) {
                setMenu({ x: detail.x, y: detail.y, nodeId: detail.nodeId });
            }
        };
        document.addEventListener("akasha-context-menu", handler);
        return () => document.removeEventListener("akasha-context-menu", handler);
    }, []);

    // Close on click outside or Escape
    useEffect(() => {
        if (!menu) return;
        const handleClick = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setMenu(null);
            }
        };
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setMenu(null);
        };
        document.addEventListener("mousedown", handleClick);
        document.addEventListener("keydown", handleKey);
        return () => {
            document.removeEventListener("mousedown", handleClick);
            document.removeEventListener("keydown", handleKey);
        };
    }, [menu]);

    const close = useCallback(() => setMenu(null), []);

    if (!menu) return null;

    let nodeData: any = null;
    try {
        nodeData = query.node(menu.nodeId).get();
    } catch {
        return null;
    }
    if (!nodeData) return null;

    const props = nodeData.data.props as CraftBlockProps;
    const isRoot = menu.nodeId === "ROOT";
    const isLocked = !!props?.properties?.__locked;
    const parentId = nodeData.data.parent;

    // Get sibling info for z-order
    let siblingIds: string[] = [];
    let myIndex = -1;
    if (parentId) {
        try {
            const parentData = query.node(parentId).get();
            siblingIds = parentData.data.nodes || [];
            myIndex = siblingIds.indexOf(menu.nodeId);
        } catch { /* ignore */ }
    }

    /* ── Actions ── */

    const handleDuplicate = () => {
        if (isRoot) { close(); return; }
        try {
            const nodeTree = query.node(menu.nodeId).toNodeTree();
            if (parentId) {
                actions.addNodeTree(nodeTree, parentId);
            }
        } catch (err) {
            console.error("[ContextMenu] Duplicate failed:", err);
        }
        close();
    };

    const handleDelete = () => {
        if (isRoot) { close(); return; }
        try { actions.delete(menu.nodeId); } catch { /* ignore */ }
        close();
    };

    const handleToggleLock = () => {
        try {
            actions.setProp(menu.nodeId, (p: any) => {
                p.properties = { ...p.properties, __locked: !isLocked };
            });
        } catch { /* ignore */ }
        close();
    };

    const handleMoveIndex = (direction: "up" | "down" | "top" | "bottom") => {
        if (!parentId || myIndex < 0) { close(); return; }
        try {
            const parentNode = query.node(parentId).get();
            const siblings = [...(parentNode.data.nodes || [])];
            const current = siblings.indexOf(menu.nodeId);
            if (current < 0) { close(); return; }

            let newIndex: number;
            switch (direction) {
                case "up": newIndex = Math.min(current + 1, siblings.length - 1); break;
                case "down": newIndex = Math.max(current - 1, 0); break;
                case "top": newIndex = siblings.length - 1; break;
                case "bottom": newIndex = 0; break;
            }

            if (newIndex !== current) {
                // Move by delete + re-add at index
                const nodeTree = query.node(menu.nodeId).toNodeTree();
                actions.delete(menu.nodeId);
                actions.addNodeTree(nodeTree, parentId, newIndex);
            }
        } catch (err) {
            console.error("[ContextMenu] Move failed:", err);
        }
        close();
    };

    const handleCopyStyles = () => {
        copiedStyles = props?.styles ? { ...props.styles } : {};
        close();
    };

    const handlePasteStyles = () => {
        if (!copiedStyles) { close(); return; }
        try {
            actions.setProp(menu.nodeId, (p: any) => {
                p.styles = { ...p.styles, ...copiedStyles };
            });
        } catch { /* ignore */ }
        close();
    };

    const handleWrapInContainer = () => {
        if (isRoot || !parentId) { close(); return; }
        try {
            const nodeTree = query.node(menu.nodeId).toNodeTree();
            const _myIdx = myIndex >= 0 ? myIndex : undefined;

            // Create a container node tree
            const containerTree = query.parseReactElement(
                React.createElement(CraftBlock, {
                    blockType: "container",
                    blockName: "Container",
                    blockId: "",
                    text: "",
                    styles: { padding: "16px", minHeight: "60px" },
                    responsiveStyles: {},
                    properties: {},
                    bindings: {},
                    eventHandlers: [],
                }),
            ).toNodeTree();

            // Delete original, add container, then add original inside container
            actions.delete(menu.nodeId);
            actions.addNodeTree(containerTree, parentId, _myIdx);

            // Get the new container's ID (last added node)
            const newParentNodes = query.node(parentId).get().data.nodes || [];
            const containerId = newParentNodes[_myIdx ?? newParentNodes.length - 1];
            if (containerId) {
                actions.addNodeTree(nodeTree, containerId);
            }
        } catch (err) {
            console.error("[ContextMenu] Wrap failed:", err);
        }
        close();
    };

    // Clamp menu position to viewport
    const style: React.CSSProperties = {
        position: "fixed",
        left: Math.min(menu.x, window.innerWidth - 220),
        top: Math.min(menu.y, window.innerHeight - 400),
        zIndex: 99999,
    };

    const Divider = () => <div className="h-px bg-white/[0.08] my-1" />;

    const MenuItem: React.FC<{
        label: string;
        shortcut?: string;
        icon: React.ReactNode;
        onClick: () => void;
        danger?: boolean;
        disabled?: boolean;
    }> = ({ label, shortcut, icon, onClick, danger, disabled }) => (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-[12px] rounded-md transition-colors ${disabled
                ? "opacity-30 cursor-not-allowed"
                : danger
                    ? "text-red-400 hover:bg-red-500/15 hover:text-red-300"
                    : "text-white/80 hover:bg-white/[0.08] hover:text-white"
                }`}
        >
            <span className="w-4 h-4 flex items-center justify-center shrink-0 opacity-60">{icon}</span>
            <span className="flex-1 font-medium">{label}</span>
            {shortcut && (
                <span className="text-[10px] text-white/25 font-mono ml-2">{shortcut}</span>
            )}
        </button>
    );

    const SvgIcon: React.FC<{ d: string }> = ({ d }) => (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={d} />
        </svg>
    );

    return (
        <div
            ref={menuRef}
            style={style}
            className="w-52 bg-[#1a1a24]/95 backdrop-blur-xl border border-white/[0.1] rounded-xl shadow-2xl shadow-black/50 py-1.5 px-1 animate-in zoom-in-95 fade-in duration-150"
        >
            {/* Block info header */}
            <div className="px-3 py-1.5 mb-1">
                <div className="text-[10px] font-bold text-white/30 uppercase tracking-wider">
                    {props?.blockName || props?.blockType || "Block"}
                </div>
            </div>
            <Divider />

            <MenuItem
                label="Duplicate"
                shortcut="Ctrl+D"
                icon={<SvgIcon d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />}
                onClick={handleDuplicate}
                disabled={isRoot}
            />
            <MenuItem
                label={isLocked ? "Unlock" : "Lock"}
                shortcut="Ctrl+L"
                icon={<SvgIcon d={isLocked
                    ? "M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
                    : "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                } />}
                onClick={handleToggleLock}
            />

            <Divider />

            {/* Z-order */}
            <MenuItem
                label="Bring Forward"
                icon={<SvgIcon d="M5 15l7-7 7 7" />}
                onClick={() => handleMoveIndex("up")}
                disabled={isRoot || myIndex >= siblingIds.length - 1}
            />
            <MenuItem
                label="Send Backward"
                icon={<SvgIcon d="M19 9l-7 7-7-7" />}
                onClick={() => handleMoveIndex("down")}
                disabled={isRoot || myIndex <= 0}
            />
            <MenuItem
                label="Bring to Front"
                icon={<SvgIcon d="M5 11l7-7 7 7M5 19l7-7 7 7" />}
                onClick={() => handleMoveIndex("top")}
                disabled={isRoot || myIndex >= siblingIds.length - 1}
            />
            <MenuItem
                label="Send to Back"
                icon={<SvgIcon d="M19 13l-7 7-7-7M19 5l-7 7-7-7" />}
                onClick={() => handleMoveIndex("bottom")}
                disabled={isRoot || myIndex <= 0}
            />

            <Divider />

            {/* Copy/Paste Styles */}
            <MenuItem
                label="Copy Styles"
                icon={<SvgIcon d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />}
                onClick={handleCopyStyles}
            />
            <MenuItem
                label="Paste Styles"
                icon={<SvgIcon d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />}
                onClick={handlePasteStyles}
                disabled={!copiedStyles}
            />

            <Divider />

            <MenuItem
                label="Wrap in Container"
                icon={<SvgIcon d="M4 5a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5z" />}
                onClick={handleWrapInContainer}
                disabled={isRoot}
            />

            <Divider />

            <MenuItem
                label="Delete"
                shortcut="Del"
                icon={<SvgIcon d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />}
                onClick={handleDelete}
                danger
                disabled={isRoot}
            />
        </div>
    );
};

export default ContextMenu;
