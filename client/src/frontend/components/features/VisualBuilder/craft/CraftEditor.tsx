/**
 * CraftEditor — top-level craft.js <Editor> wrapper.
 *
 * All craft.js functionality requires components to be wrapped in this Editor.
 * Place it at the UIDesignPage level so that both the canvas, toolbox, and
 * inspector can access the craft.js context.
 */

import React from "react";
import { Editor } from "@craftjs/core";
import { CraftBlock } from "./CraftBlock";
import { RenderNode } from "./RenderNode";

interface CraftEditorProps {
    children: React.ReactNode;
    /** Set to false to disable editing (read-only preview mode) */
    enabled?: boolean;
}

export const CraftEditor: React.FC<CraftEditorProps> = ({
    children,
    enabled = true,
}) => {
    return (
        <Editor
            resolver={{ CraftBlock }}
            onRender={RenderNode}
            enabled={enabled}
        >
            {children}
        </Editor>
    );
};

export default CraftEditor;
