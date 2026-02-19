/**
 * useSelectedNode — bridge hook between craft.js selection and
 * the Inspector panel.
 *
 * Provides the selected node's data and a setProp function that
 * the Inspector can call to modify properties/styles without
 * directly importing craft.js hooks.
 */

import { useEditor } from "@craftjs/core";
import type { CraftBlockProps } from "./serialization";

export interface SelectedNodeInfo {
    /** Whether a node is currently selected */
    isSelected: boolean;
    /** The craft.js node ID */
    nodeId: string | null;
    /** The block type (e.g. "container", "button") */
    blockType: string | null;
    /** Display name */
    blockName: string | null;
    /** All props of the selected node */
    props: CraftBlockProps | null;
    /** Update one or more props on the selected node */
    setProp: (updater: (props: CraftBlockProps) => void) => void;
    /** Delete the selected node */
    deleteNode: () => void;
    /** Check if selected node is deletable */
    isDeletable: boolean;
}

export function useSelectedNode(): SelectedNodeInfo {
    const { selected, actions, query } = useEditor((state) => {
        const currentSelected = state.events.selected;
        return { selected: currentSelected };
    });

    // Get the first selected node ID
    const nodeId = selected && typeof selected === "object" && "values" in selected
        ? Array.from(selected as Set<string>)[0] ?? null
        : typeof selected === "string"
            ? selected
            : null;

    if (!nodeId) {
        return {
            isSelected: false,
            nodeId: null,
            blockType: null,
            blockName: null,
            props: null,
            setProp: () => {},
            deleteNode: () => {},
            isDeletable: false,
        };
    }

    let nodeData: any = null;
    try {
        nodeData = query.node(nodeId).get();
    } catch {
        // Node might not exist anymore
    }

    const props = (nodeData?.data?.props as CraftBlockProps) ?? null;
    const isRoot = nodeId === "ROOT";

    return {
        isSelected: true,
        nodeId,
        blockType: props?.blockType ?? null,
        blockName: props?.blockName ?? nodeData?.data?.displayName ?? null,
        props,
        setProp: (updater) => {
            if (nodeId) {
                actions.setProp(nodeId, updater as any);
            }
        },
        deleteNode: () => {
            if (nodeId && !isRoot) {
                actions.delete(nodeId);
            }
        },
        isDeletable: !isRoot,
    };
}

export default useSelectedNode;
