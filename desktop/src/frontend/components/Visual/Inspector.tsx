/**
 * Inspector Panel - Visual Mode Property Editor
 * 
 * Shows properties, styles, and events for the selected component.
 * Similar to Figma/Webflow inspector panels.
 */

import React, { useState } from "react";
import { useProjectStore } from "../../hooks/useProjectStore";
import { getBlock, updateBlockProperty, updateBlockStyle } from "../../stores/projectStore";

type InspectorTab = "properties" | "styles" | "events";

const Inspector: React.FC = () => {
    const { selectedBlockId } = useProjectStore();
    const [activeTab, setActiveTab] = useState<InspectorTab>("properties");

    const selectedBlock = selectedBlockId ? getBlock(selectedBlockId) : null;

    if (!selectedBlock) {
        return (
            <div className="w-72 bg-[#252526] border-l border-[#1e1e1e] flex flex-col items-center justify-center p-8">
                <div className="text-center">
                    <div className="w-16 h-16 rounded-2xl bg-[#2d2d2d] border border-[#1e1e1e] flex items-center justify-center mb-4 mx-auto">
                        <svg className="w-8 h-8 text-[#858585]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                        </svg>
                    </div>
                    <h3 className="text-sm text-[#cccccc] font-medium mb-1">No Selection</h3>
                    <p className="text-xs text-[#858585]">Select a component to edit</p>
                </div>
            </div>
        );
    }

    const handlePropertyChange = async (property: string, value: unknown) => {
        await updateBlockProperty(selectedBlock.id, property, value);
    };

    const handleStyleChange = async (style: string, value: string) => {
        await updateBlockStyle(selectedBlock.id, style, value);
    };

    return (
        <div className="w-72 bg-[#252526] border-l border-[#1e1e1e] flex flex-col h-full">
            {/* Header */}
            <div className="h-9 bg-[#2d2d2d] px-3 flex items-center border-b border-[#1e1e1e]">
                <span className="text-[11px] text-[#cccccc] font-semibold uppercase tracking-wider">
                    Inspector
                </span>
            </div>

            {/* Component Info */}
            <div className="p-3 border-b border-[#1e1e1e]">
                <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded bg-[#0e639c]/20 flex items-center justify-center">
                        <span className="text-xs">📦</span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-xs text-[#cccccc] font-medium truncate">{selectedBlock.name}</div>
                        <div className="text-[10px] text-[#858585] truncate">{selectedBlock.block_type}</div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-[#1e1e1e]">
                {(["properties", "styles", "events"] as InspectorTab[]).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${activeTab === tab
                            ? "text-white bg-[#37373d] border-b-2 border-[#0e639c]"
                            : "text-[#858585] hover:text-[#cccccc] hover:bg-[#2a2d2e]"
                            }`}
                    >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {activeTab === "properties" && (
                    <PropertiesPanel block={selectedBlock} onChange={handlePropertyChange} />
                )}
                {activeTab === "styles" && (
                    <StylesPanel block={selectedBlock} onChange={handleStyleChange} />
                )}
                {activeTab === "events" && (
                    <EventsPanel />
                )}
            </div>
        </div>
    );
};

// Properties Panel
const PropertiesPanel: React.FC<{ block: any; onChange: (prop: string, value: unknown) => void }> = ({ block, onChange }) => {
    return (
        <div className="p-3 space-y-3">
            {/* Text Property (for text-based components) */}
            {["text", "paragraph", "heading", "button"].includes(block.block_type) && (
                <div>
                    <label className="block text-xs text-[#858585] mb-1">Text</label>
                    <input
                        type="text"
                        value={(block.properties.text as string) || ""}
                        onChange={(e) => onChange("text", e.target.value)}
                        className="w-full bg-[#3c3c3c] text-[#cccccc] text-xs px-2 py-1.5 rounded border border-[#1e1e1e] focus:outline-none focus:border-[#0e639c]"
                    />
                </div>
            )}

            {/* Placeholder (for inputs) */}
            {block.block_type === "input" && (
                <div>
                    <label className="block text-xs text-[#858585] mb-1">Placeholder</label>
                    <input
                        type="text"
                        value={(block.properties.placeholder as string) || ""}
                        onChange={(e) => onChange("placeholder", e.target.value)}
                        className="w-full bg-[#3c3c3c] text-[#cccccc] text-xs px-2 py-1.5 rounded border border-[#1e1e1e] focus:outline-none focus:border-[#0e639c]"
                    />
                </div>
            )}
        </div>
    );
};

// Styles Panel
const StylesPanel: React.FC<{ block: any; onChange: (style: string, value: string) => void }> = ({ block, onChange }) => {
    return (
        <div className="p-3 space-y-3">
            {/* Background Color */}
            <div>
                <label className="block text-xs text-[#858585] mb-1">Background</label>
                <input
                    type="color"
                    value={(block.styles.backgroundColor as string) || "#ffffff"}
                    onChange={(e) => onChange("backgroundColor", e.target.value)}
                    className="w-full h-8 rounded border border-[#1e1e1e] cursor-pointer"
                />
            </div>

            {/* Padding */}
            <div>
                <label className="block text-xs text-[#858585] mb-1">Padding</label>
                <input
                    type="text"
                    value={(block.styles.padding as string) || ""}
                    onChange={(e) => onChange("padding", e.target.value)}
                    placeholder="e.g. 16px"
                    className="w-full bg-[#3c3c3c] text-[#cccccc] text-xs px-2 py-1.5 rounded border border-[#1e1e1e] focus:outline-none focus:border-[#0e639c]"
                />
            </div>

            {/* Border Radius */}
            <div>
                <label className="block text-xs text-[#858585] mb-1">Border Radius</label>
                <input
                    type="text"
                    value={(block.styles.borderRadius as string) || ""}
                    onChange={(e) => onChange("borderRadius", e.target.value)}
                    placeholder="e.g. 8px"
                    className="w-full bg-[#3c3c3c] text-[#cccccc] text-xs px-2 py-1.5 rounded border border-[#1e1e1e] focus:outline-none focus:border-[#0e639c]"
                />
            </div>
        </div>
    );
};

// Events Panel
const EventsPanel: React.FC = () => {
    return (
        <div className="p-3">
            <p className="text-xs text-[#858585] text-center py-8">
                Event handlers coming soon...
            </p>
        </div>
    );
};

export default Inspector;
