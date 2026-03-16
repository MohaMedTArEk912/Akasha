/**
 * UI Design Page — Production-ready Visual Builder.
 *
 * Layout:
 * ┌──────────────────────────────────────────────────────────┐
 * │                   CraftEditor (context)                   │
 * ├─────────┬──────────────────────────┬─────────────────────┤
 * │  Left   │     CraftFrame           │  Inspector          │
 * │ Sidebar │     (craft.js canvas)    │  (properties panel) │
 * │ (Pages/ │                          │                     │
 * │ Insert/ │                          │                     │
 * │ Layers) │                          │                     │
 * └─────────┴──────────────────────────┴─────────────────────┘
 */

import React, { useState } from "react";
import { CraftEditor } from "../components/features/VisualBuilder/craft/CraftEditor";
import ExportModal from "../components/features/VisualBuilder/ExportModal";
import ContextMenu from "../components/features/VisualBuilder/ContextMenu";
import BuilderWorkspace from "../components/features/VisualBuilder/workspace/BuilderWorkspace";

/* ═══════════════════  Main Page  ═══════════════════════ */

const UIDesignPage: React.FC = () => {
    const [exportOpen, setExportOpen] = useState(false);

    return (
        <CraftEditor>
            <div className="size-full flex flex-col bg-[var(--ide-bg)] overflow-hidden">
                <BuilderWorkspace onExportClick={() => setExportOpen(true)} />

                <ExportModal isOpen={exportOpen} onClose={() => setExportOpen(false)} />
                <ContextMenu />
            </div>
        </CraftEditor>
    );
};

export default UIDesignPage;
