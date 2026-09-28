/**
 * Component Palette - Visual Mode Sidebar
 * 
 * Provides drag-and-drop components for building UIs.
 * Uses getPaletteCategories() from blockRegistry as single source of truth.
 * Click-to-add creates craft.js nodes directly (not old store addBlockAtPosition).
 */

import React, { useState, useCallback } from "react";
import { useProjectStore } from "../../../hooks/useProjectStore";
import { createMasterComponent, selectComponent } from "../../../stores/projectStore";
import { useDragDrop } from "../../../context/DragDropContext";
import { useEditor } from "@craftjs/core";
import { CraftBlock } from "./craft/CraftBlock";
import { BLOCK_REGISTRY, getPaletteCategories } from "./hooks/craft/blockRegistry";

const ComponentPalette: React.FC = () => {
    const { project } = useProjectStore();
    const { prepareDrag } = useDragDrop();
    const { actions, query } = useEditor();
    const [searchQuery, setSearchQuery] = useState("");
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
        new Set(["My Components", "Layout", "Typography", "Form", "Media", "Components"])
    );
    const [isCreatingComponent, setIsCreatingComponent] = useState(false);
    const [newComponentName, setNewComponentName] = useState("");
    const [lastAdded, setLastAdded] = useState<string | null>(null);

    const toggleCategory = (categoryName: string) => {
        const newExpanded = new Set(expandedCategories);
        if (newExpanded.has(categoryName)) {
            newExpanded.delete(categoryName);
        } else {
            newExpanded.add(categoryName);
        }
        setExpandedCategories(newExpanded);
    };

    /** Create a craft.js node and add it to ROOT */
    const addBlockViaCraft = useCallback((blockType: string, componentId?: string) => {
        try {
            const meta = BLOCK_REGISTRY[blockType];
            const nodeTree = query.parseReactElement(
                React.createElement(CraftBlock, {
                    blockType,
                    blockName: meta?.displayName || blockType.charAt(0).toUpperCase() + blockType.slice(1),
                    blockId: "", // craft.js assigns an ID
                    text: (meta?.defaultProps as any)?.text || "",
                    styles: meta?.defaultStyles || {},
                    responsiveStyles: {},
                    properties: meta?.defaultProps || {},
                    bindings: {},
                    eventHandlers: [],
                    componentId,
                }),
            ).toNodeTree();
            actions.addNodeTree(nodeTree, "ROOT");
            setLastAdded(blockType);
            setTimeout(() => setLastAdded(null), 600);
        } catch (err) {
            console.error("[Palette] click-to-add failed:", err);
        }
    }, [actions, query]);


    /** Pointer-based drag start (works in Tauri WebView) */
    const handlePointerDragStart = useCallback((e: React.MouseEvent, componentType: string, label: string, componentId?: string) => {
        prepareDrag(
            {
                type: componentType,
                componentId,
                label,
            },
            e,
        );
    }, [prepareDrag]);

    const handleCreateComponent = async () => {
        if (!newComponentName.trim()) return;
        try {
            await createMasterComponent(newComponentName);
            setNewComponentName("");
            setIsCreatingComponent(false);
        } catch (err) {
            console.error("Failed to create component:", err);
        }
    };

    // Build palette from blockRegistry (single source of truth)
    const registryCategories = getPaletteCategories().map(cat => ({
        name: cat.name,
        items: cat.blocks.map(b => ({
            type: b.type,
            name: b.displayName,
            icon: "",
            iconPath: b.iconPath,
            description: b.description,
        })),
    }));

    // Build dynamic library: project components + registry categories
    const dynamicLibrary = [
        {
            name: "My Components",
            items: [
                ...(project?.components.filter(c => !c.archived).map(c => ({
                    type: "instance",
                    name: c.name,
                    icon: "",
                    iconPath: "",
                    description: "Reusable component",
                    id: c.id
                })) || [])
            ]
        },
        ...registryCategories
    ];

    const filteredLibrary = dynamicLibrary.map(category => ({
        ...category,
        items: category.items.filter(item =>
            item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.description.toLowerCase().includes(searchQuery.toLowerCase())
        )
    })).filter(category => category.items.length > 0 || category.name === "My Components");

    const getCategoryBadge = (name: string) => {
        switch (name.toLowerCase()) {
            case "layout": return "LY";
            case "typography": return "TY";
            case "media": return "MD";
            case "forms": return "FM";
            case "my components": return "CP";
            case "pages": return "PG";
            case "section": return "SC";
            case "navigation": return "NV";
            default: return "UI";
        }
    };

    return (
        <div className="flex flex-col h-full bg-[var(--ide-bg-sidebar)]">
            {/* Search Section */}
            <div className="p-3 border-b border-[var(--ide-border)]">
                <div className="relative group flex items-center bg-white/5 hover:bg-white/10 rounded-lg px-2.5 h-8 transition-colors">
                    <span className="font-mono text-[9px] text-[var(--ide-text-muted)] font-black mr-2 select-none">FIND</span>
                    <input
                        type="search"
                        placeholder="Search components..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-transparent border-none text-[12px] text-white pr-2 h-full outline-none placeholder:text-[var(--ide-text-muted)] placeholder:font-medium"
                    />
                </div>
            </div>

            {/* Component List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-4">
                {filteredLibrary.map((category, catIdx) => (
                    <div key={`${catIdx}-${category.name}`} className="mb-px">
                        {/* Category Header */}
                        <div className="flex items-center justify-between group">
                            <button
                                onClick={() => toggleCategory(category.name)}
                                className="flex items-center gap-3 w-full px-2 py-2 rounded-lg hover:bg-white/5 transition-colors"
                            >
                                <div className="w-6 h-6 rounded flex items-center justify-center bg-white/5 text-[var(--ide-text-muted)] group-hover:text-white transition-colors font-mono text-[9px] font-black">
                                    {getCategoryBadge(category.name)}
                                </div>

                                <span className="text-[12px] font-medium text-[var(--ide-text-secondary)] group-hover:text-[var(--ide-text)] transition-colors flex-1 text-left">
                                    {category.name}
                                </span>

                                <span className="text-[9px] font-bold text-[var(--ide-text-muted)] group-hover:text-white select-none">
                                    {expandedCategories.has(category.name) ? '▼' : '▶'}
                                </span>
                            </button>

                            {/* Create Component Logic */}
                            {category.name === "My Components" && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); setIsCreatingComponent(!isCreatingComponent); }}
                                    className="absolute right-8 text-[var(--ide-text-muted)] hover:text-white px-1.5 py-0.5 rounded hover:bg-white/10 font-bold text-xs"
                                    title="Create Component"
                                >
                                    +
                                </button>
                            )}
                        </div>

                        {/* Create Component Input */}
                        {category.name === "My Components" && isCreatingComponent && expandedCategories.has("My Components") && (
                            <div className="mb-3 mt-2 px-2">
                                <form
                                    onSubmit={(e) => { e.preventDefault(); handleCreateComponent(); }}
                                    className="flex items-center gap-2"
                                >
                                    <input
                                        type="text"
                                        autoFocus
                                        placeholder="Name..."
                                        value={newComponentName}
                                        onChange={e => setNewComponentName(e.target.value)}
                                        className="w-full text-xs bg-white/5 border border-white/10 focus:border-indigo-500 rounded-md px-3 py-1.5 text-[var(--ide-text)] outline-none"
                                    />
                                    <button type="submit" className="text-xs font-bold bg-[#0099FF] hover:bg-[#0077CC] text-white px-3 py-1.5 rounded-md transition-colors shadow-sm">Add</button>
                                </form>
                            </div>
                        )}

                        {/* Category Items: Grid View */}
                        {expandedCategories.has(category.name) && (
                            <div className="grid grid-cols-2 gap-1.5 mt-2 mb-4 px-2">
                                {category.items.map((item) => (
                                    <div
                                        key={item.name + ((item as any).id || item.type)}
                                        onMouseDown={(e) => {
                                            if (e.button === 0 && (e.target as HTMLElement).closest('[data-palette-edit]') === null) {
                                                handlePointerDragStart(e, item.type, item.name, (item as any).id);
                                            }
                                        }}
                                        onClick={(e) => {
                                            if ((e.target as HTMLElement).closest('[data-palette-edit]') !== null) return;
                                            addBlockViaCraft(item.type, (item as any).id);
                                        }}
                                        className={`group relative h-16 bg-white/5 hover:bg-white/10 border border-transparent hover:border-white/10 rounded-lg cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-1 overflow-hidden ring-1 ring-inset ring-transparent hover:ring-[#0099FF]/30 shadow-sm ${lastAdded === item.type ? 'ring-2 ring-emerald-500 scale-95' : ''
                                            }`}
                                        title={`${item.description} — Click to add, or drag to canvas`}
                                    >
                                        <div className="text-[var(--ide-text-muted)] group-hover:text-white transition-colors transform group-hover:scale-105 duration-200">
                                            <span className="font-mono text-[9px] font-black uppercase text-[var(--ide-accent)] px-1.5 py-0.5 rounded bg-white/5 border border-white/10">
                                                {item.name.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase()}
                                            </span>
                                        </div>
                                        <div className="relative text-[9px] font-bold text-[var(--ide-text-secondary)] tracking-tight group-hover:text-[var(--ide-text)] transition-colors text-center px-1 truncate w-full">
                                            {item.name}
                                        </div>

                                        {/* Edit Button for Components */}
                                        {category.name === "My Components" && (
                                            <button
                                                data-palette-edit
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    selectComponent((item as any).id);
                                                }}
                                                className="absolute top-1 right-1 px-1 py-0.5 bg-white/10 hover:bg-[#0099FF]/80 rounded text-[7px] font-mono font-bold opacity-0 group-hover:opacity-100 transition-all backdrop-blur text-white uppercase"
                                                title="Edit Master Component"
                                            >
                                                EDIT
                                            </button>
                                        )}
                                    </div>
                                ))}
                                {category.name === "My Components" && category.items.length === 0 && !isCreatingComponent && (
                                    <div className="col-span-2 text-center text-[10px] text-[var(--ide-text-muted)] italic py-2">
                                        No components created yet
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ComponentPalette;
