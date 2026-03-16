import React from "react";
import { useEditor } from "@craftjs/core";
import { DefaultLayerHeader, Layers, useLayer } from "@craftjs/layers";

const DarkLayer: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
    const {
        id,
        expanded,
        hovered,
        connectors: { layer },
    } = useLayer((layerState) => ({
        hovered: layerState.event.hovered,
        expanded: layerState.expanded,
    }));

    const { hasChildCanvases } = useEditor((_, query) => ({
        hasChildCanvases: query.node(id).isParentOfTopLevelNodes(),
    }));

    return (
        <div
            ref={(dom) => {
                if (dom) {
                    layer(dom);
                }
            }}
            className={`transition-colors ${hovered ? "bg-white/5" : "bg-transparent"}`}
            style={{ paddingBottom: hasChildCanvases && expanded ? 5 : 0 }}
        >
            <DefaultLayerHeader />
            {children ? (
                <div
                    className="craft-layer-children"
                    style={{
                        margin: `0 0 0 ${hasChildCanvases ? 35 : 0}px`,
                        background: hasChildCanvases ? "rgba(255, 255, 255, 0.02)" : "transparent",
                        padding: "0 0 0 5px",
                    }}
                >
                    {children}
                </div>
            ) : null}
        </div>
    );
};

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
                    <Layers expandRootOnLoad={true} renderLayer={DarkLayer} />
                </div>
            </div>
        </div>
    );
};

export default LayersPanel;
