import React from "react";
import { Layers } from "@craftjs/layers";

const LayersPanel: React.FC = () => {
    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-[var(--ide-bg-sidebar)]">
            <div className="p-4 border-b border-[var(--ide-border)] shrink-0">
                <div className="text-[10px] text-[var(--ide-text-secondary)] font-bold uppercase tracking-[0.2em] flex items-center gap-2">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                    <span>Layers</span>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar px-2 py-3">
                <div className="craft-layers-wrapper">
                    <Layers expandRootOnLoad={true} />
                </div>
            </div>
        </div>
    );
};

export default LayersPanel;
