/**
 * Component Palette - Visual Mode Sidebar
 * 
 * Replaces the file tree when in visual editing mode.
 * Provides drag-and-drop components for building UIs.
 */

import React, { useState } from "react";

interface ComponentItem {
    type: string;
    name: string;
    icon: string;
    description: string;
}

interface ComponentCategory {
    name: string;
    items: ComponentItem[];
}

const COMPONENT_LIBRARY: ComponentCategory[] = [
    {
        name: "Layout",
        items: [
            { type: "container", name: "Container", icon: "📦", description: "Flexible container" },
            { type: "section", name: "Section", icon: "📄", description: "Page section" },
            { type: "card", name: "Card", icon: "🃏", description: "Card component" },
        ]
    },
    {
        name: "Typography",
        items: [
            { type: "heading", name: "Heading", icon: "📝", description: "H1-H6 heading" },
            { type: "paragraph", name: "Paragraph", icon: "📃", description: "Text paragraph" },
            { type: "text", name: "Text", icon: "✏️", description: "Inline text" },
        ]
    },
    {
        name: "Forms",
        items: [
            { type: "button", name: "Button", icon: "🔘", description: "Interactive button" },
            { type: "input", name: "Input", icon: "📝", description: "Text input field" },
            { type: "form", name: "Form", icon: "📋", description: "Form container" },
        ]
    },
    {
        name: "Media",
        items: [
            { type: "image", name: "Image", icon: "🖼️", description: "Image element" },
        ]
    }
];

const ComponentPalette: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState("");
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
        new Set(COMPONENT_LIBRARY.map(cat => cat.name))
    );

    const toggleCategory = (categoryName: string) => {
        const newExpanded = new Set(expandedCategories);
        if (newExpanded.has(categoryName)) {
            newExpanded.delete(categoryName);
        } else {
            newExpanded.add(categoryName);
        }
        setExpandedCategories(newExpanded);
    };

    const handleDragStart = (e: React.DragEvent, componentType: string) => {
        e.dataTransfer.setData("application/grapes-block", componentType);
        e.dataTransfer.effectAllowed = "copy";
    };

    const filteredLibrary = COMPONENT_LIBRARY.map(category => ({
        ...category,
        items: category.items.filter(item =>
            item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.description.toLowerCase().includes(searchQuery.toLowerCase())
        )
    })).filter(category => category.items.length > 0);

    return (
        <div className="w-64 bg-[#252526] border-r border-[#1e1e1e] flex flex-col h-full">
            {/* Header */}
            <div className="h-9 bg-[#2d2d2d] px-3 flex items-center border-b border-[#1e1e1e]">
                <span className="text-[11px] text-[#cccccc] font-semibold uppercase tracking-wider">
                    Components
                </span>
            </div>

            {/* Search */}
            <div className="p-2 border-b border-[#1e1e1e]">
                <input
                    type="text"
                    placeholder="Search components..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#3c3c3c] text-[#cccccc] text-xs px-3 py-1.5 rounded border border-[#1e1e1e] focus:outline-none focus:border-[#0e639c]"
                />
            </div>

            {/* Component List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {filteredLibrary.length === 0 ? (
                    <div className="p-4 text-center text-[#858585] text-xs">
                        No components found
                    </div>
                ) : (
                    filteredLibrary.map((category) => (
                        <div key={category.name} className="border-b border-[#1e1e1e]">
                            {/* Category Header */}
                            <button
                                onClick={() => toggleCategory(category.name)}
                                className="w-full px-3 py-2 flex items-center gap-2 hover:bg-[#2a2d2e] transition-colors text-left"
                            >
                                <svg
                                    className={`w-3 h-3 text-[#858585] transition-transform ${expandedCategories.has(category.name) ? 'rotate-90' : ''
                                        }`}
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                >
                                    <path d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" />
                                </svg>
                                <span className="text-xs text-[#cccccc] font-medium">
                                    {category.name}
                                </span>
                                <span className="ml-auto text-[10px] text-[#858585]">
                                    {category.items.length}
                                </span>
                            </button>

                            {/* Category Items */}
                            {expandedCategories.has(category.name) && (
                                <div className="pb-2">
                                    {category.items.map((item) => (
                                        <div
                                            key={item.type}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, item.type)}
                                            className="mx-2 mb-1 px-3 py-2 bg-[#2d2d2d] hover:bg-[#37373d] rounded cursor-grab active:cursor-grabbing transition-colors group"
                                            title={item.description}
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="text-lg">{item.icon}</span>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-xs text-[#cccccc] font-medium truncate">
                                                        {item.name}
                                                    </div>
                                                    <div className="text-[10px] text-[#858585] truncate">
                                                        {item.description}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Footer Hint */}
            <div className="p-3 border-t border-[#1e1e1e] bg-[#2d2d2d]">
                <p className="text-[10px] text-[#858585] text-center">
                    Drag components to canvas
                </p>
            </div>
        </div>
    );
};

export default ComponentPalette;
