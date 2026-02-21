/**
 * Serialization Bridge — bidirectional conversion between
 * Akasha BlockSchema[] and craft.js SerializedNodes.
 *
 * Load:  BlockSchema[] → SerializedNodes  (opening a page)
 * Save:  SerializedNodes → BlockSchema[]  (persisting changes)
 */

import type { SerializedNodes } from "@craftjs/core";
import type { BlockSchema } from "../../../hooks/useApi";
import { CONTAINER_TYPES } from "./blockRegistry";

/* ═══════════════════  Types  ═══════════════════════ */

/**
 * The props shape stored inside each craft.js node.
 * We embed all BlockSchema fields that aren't structural.
 */
export interface CraftBlockProps {
    blockType: string;
    blockName: string;
    blockId: string;
    text?: string;
    styles: Record<string, string | number | boolean>;
    responsiveStyles: Record<string, Record<string, string | number | boolean>>;
    properties: Record<string, unknown>;
    bindings: Record<string, { type: string; value: unknown }>;
    eventHandlers: Array<{ event: string; logic_flow_id: string }>;
    classes?: string[];
    componentId?: string;
    slot?: string;
    [key: string]: unknown;
}

/* ═══════════════════  Load: BlockSchema[] → craft.js  ═══════════════ */

/**
 * Convert a flat array of BlockSchema (from the Rust backend) into
 * craft.js `SerializedNodes` that can be passed to `<Frame data={...}>`.
 *
 * @param blocks  All active blocks for the current page (non-archived)
 * @param rootId  The page's root_block_id
 */
export function blocksToSerializedNodes(
    blocks: BlockSchema[],
    rootId: string,
): SerializedNodes {
    const blockMap = new Map(blocks.map((b) => [b.id, b]));
    const result: SerializedNodes = {};

    // Build a child→parent map and ordered children map
    const childrenOf = new Map<string, BlockSchema[]>();
    for (const b of blocks) {
        const pid = b.parent_id ?? "__ROOT__";
        if (!childrenOf.has(pid)) childrenOf.set(pid, []);
        childrenOf.get(pid)!.push(b);
    }
    // Sort children by order
    for (const [, children] of childrenOf) {
        children.sort((a, b) => a.order - b.order);
    }

    function convertBlock(block: BlockSchema, parentNodeId: string | null): void {
        const isCanvas = CONTAINER_TYPES.has(block.block_type);
        const children = childrenOf.get(block.id) || [];
        const childIds = children.map((c) => c.id);

        const props: CraftBlockProps = {
            blockType: block.block_type,
            blockName: block.name,
            blockId: block.id,
            styles: { ...block.styles },
            responsiveStyles: { ...block.responsive_styles },
            properties: { ...block.properties },
            bindings: { ...block.bindings },
            eventHandlers: [...(block.event_handlers || [])],
            classes: (block as any).classes || [],
            componentId: block.component_id,
            slot: block.slot,
        };

        // Extract text for convenience (used by CraftBlock for inline editing)
        if (block.properties?.text != null) {
            props.text = String(block.properties.text);
        }

        result[block.id] = {
            type: { resolvedName: "CraftBlock" },
            isCanvas,
            props,
            displayName: block.name || block.block_type,
            parent: parentNodeId,
            linkedNodes: {},
            nodes: childIds,
            hidden: false,
            custom: {
                originalBlockType: block.block_type,
            },
        };

        // Recurse into children
        for (const child of children) {
            convertBlock(child, block.id);
        }
    }

    // Find the root block
    const rootBlock = blockMap.get(rootId);
    if (!rootBlock) {
        // Return a minimal empty root for craft.js
        result["ROOT"] = {
            type: { resolvedName: "CraftBlock" },
            isCanvas: true,
            props: {
                blockType: "container",
                blockName: "Root",
                blockId: "ROOT",
                styles: {},
                responsiveStyles: {},
                properties: {},
                bindings: {},
                eventHandlers: [],
            } as CraftBlockProps,
            displayName: "Root",
            parent: null,
            linkedNodes: {},
            nodes: [],
            hidden: false,
        };
        return result;
    }

    // Convert root and all descendants
    convertBlock(rootBlock, null);

    // craft.js expects the root node to have key "ROOT"
    // If the root block ID is not "ROOT", remap it
    if (rootId !== "ROOT" && result[rootId]) {
        const rootNode = result[rootId];
        result["ROOT"] = { ...rootNode, parent: null };
        delete result[rootId];

        // Update all children that reference rootId as parent
        for (const [nodeId, node] of Object.entries(result)) {
            if (node.parent === rootId) {
                result[nodeId] = { ...node, parent: "ROOT" };
            }
        }

        // Update ROOT's nodes array
        result["ROOT"].nodes = result["ROOT"].nodes.map(
            (id: string) => id // children IDs don't change
        );
    }

    return result;
}

/* ═══════════════════  Save: craft.js → BlockSchema[]  ═══════════════ */

/**
 * Convert craft.js `SerializedNodes` back into a flat BlockSchema[] array
 * suitable for sending to the Rust backend via IPC.
 *
 * @param serialized  The JSON string from `query.serialize()` or the object from `query.getSerializedNodes()`
 * @param pageId      The current page ID
 * @param rootBlockId The original root_block_id for the page
 */
export function serializedNodesToBlocks(
    serialized: SerializedNodes | string,
    pageId: string,
    rootBlockId: string,
): BlockSchema[] {
    const nodes: SerializedNodes =
        typeof serialized === "string" ? JSON.parse(serialized) : serialized;

    const blocks: BlockSchema[] = [];
    let orderCounter = 0;

    function convertNode(
        nodeId: string,
        parentId: string | undefined,
    ): void {
        const node = nodes[nodeId];
        if (!node) return;

        const props = node.props as CraftBlockProps;

        // Resolve the actual block ID (ROOT → rootBlockId)
        const actualId = nodeId === "ROOT" ? rootBlockId : (props.blockId || nodeId);
        const actualParentId = parentId === undefined
            ? undefined
            : parentId === "ROOT"
                ? rootBlockId
                : parentId;

        const block: BlockSchema = {
            id: actualId,
            block_type: props.blockType || "container",
            name: props.blockName || node.displayName || props.blockType || "Block",
            parent_id: actualParentId,
            page_id: parentId === undefined ? pageId : undefined, // only root has page_id
            slot: props.slot,
            order: orderCounter++,
            properties: { ...props.properties },
            styles: { ...props.styles } as Record<string, string | number | boolean>,
            responsive_styles: { ...props.responsiveStyles } as Record<string, Record<string, string | number | boolean>>,
            bindings: { ...props.bindings } as Record<string, { type: string; value: unknown }>,
            event_handlers: [...(props.eventHandlers || [])],
            archived: false,
            component_id: props.componentId,
            classes: props.classes || [],
            children: (node.nodes || []).map((childId: string) => {
                const childProps = nodes[childId]?.props as CraftBlockProps | undefined;
                return childProps?.blockId || childId;
            }),
        };

        // Sync text back to properties
        if (props.text !== undefined) {
            block.properties.text = props.text;
        }

        blocks.push(block);

        // Recurse into children
        for (const childId of node.nodes || []) {
            convertNode(childId, nodeId);
        }
    }

    // Start from ROOT
    if (nodes["ROOT"]) {
        convertNode("ROOT", undefined);
    }

    return blocks;
}
