import React, { useState } from "react";
import { CraftEditor } from "../craft/CraftEditor";
import { CraftFrame } from "../craft/CraftFrame";

import ContextMenu from "../ContextMenu";
import LeftSidebar from "../panels/LeftSidebar";
import RightInspectorRail from "../panels/RightInspectorRail";
import type { BuilderLeftTab } from "../hooks/panels/types";

interface BuilderWorkspaceProps {
    onBack?: () => void;
}

const BuilderWorkspace: React.FC<BuilderWorkspaceProps> = ({ onBack }) => {
    const [leftTab, setLeftTab] = useState<BuilderLeftTab>("pages");
    const [inspectorOpen, setInspectorOpen] = useState(true);


    return (
        <CraftEditor>
            <div className="size-full flex flex-col bg-[var(--ide-bg)] overflow-hidden">
                <div className="flex-1 flex overflow-hidden">
                    <LeftSidebar 
                        tab={leftTab} 
                        onTabChange={setLeftTab} 
 
                        onBack={onBack} 
                    />

                    <div className="flex-1 overflow-hidden">
                        <CraftFrame />
                    </div>

                    <RightInspectorRail
                        open={inspectorOpen}
                        onOpen={() => setInspectorOpen(true)}
                        onClose={() => setInspectorOpen(false)}
                    />
                </div>


                <ContextMenu />
            </div>
        </CraftEditor>
    );
};

export default BuilderWorkspace;
