/**
 * Component Palette - Visual Mode Sidebar
 * 
 * Provides drag-and-drop components for building UIs.
 * Uses getPaletteCategories() from blockRegistry as single source of truth.
 * Click-to-add creates craft.js nodes directly (not old store addBlockAtPosition).
 */

import React, { useState, useCallback, useEffect } from "react";
import { useProjectStore } from "../../hooks/useProjectStore";
import { createMasterComponent, selectComponent } from "../../stores/projectStore";
import { useDragDrop } from "../../context/DragDropContext";
import { useEditor } from "@craftjs/core";
import { CraftBlock } from "../Canvas/craft/CraftBlock";
import { BLOCK_REGISTRY, getPaletteCategories } from "../Canvas/craft/blockRegistry";

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

    // Listen for palette-click events from DragDropContext (mousedown+mouseup without move)
    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail?.payload?.type && !detail?.payload?.moveId) {
                addBlockViaCraft(detail.payload.type, detail.payload.componentId);
            }
        };
        document.addEventListener("akasha-palette-click", handler);
        return () => document.removeEventListener("akasha-palette-click", handler);
    }, [addBlockViaCraft]);

    /** Pointer-based drag start (works in Tauri WebView) */
    const handlePointerDragStart = useCallback((e: React.MouseEvent, componentType: string, componentId?: string) => {
        prepareDrag(
            {
                type: componentType,
                componentId,
                label: componentType.toUpperCase(),
            },
            e,
        );
    }, [prepareDrag]);

    /** Legacy HTML5 DnD start (kept as backup for browser mode) */
    const handleDragStart = (e: React.DragEvent, componentType: string, componentId?: string) => {
        e.dataTransfer.setData("application/akasha-block", componentType);
        if (componentId) {
            e.dataTransfer.setData("application/akasha-component-id", componentId);
        }
        e.dataTransfer.setData("text/plain", componentType);
        e.dataTransfer.effectAllowed = "copy";

        // Store in global for WebView fallback (Tauri doesn't preserve DataTransfer)
        (window as any).__akashaDragData = { type: componentType, componentId };

        // Add a ghost image
        const ghost = document.createElement('div');
        ghost.className = 'px-3 py-1.5 rounded-lg text-xs font-bold shadow-2xl';
        ghost.style.background = "linear-gradient(135deg, var(--ide-primary), var(--ide-primary-hover))";
        ghost.style.color = "#ffffff";
        ghost.innerText = componentType.toUpperCase();
        document.body.appendChild(ghost);
        e.dataTransfer.setDragImage(ghost, 0, 0);
        setTimeout(() => document.body.removeChild(ghost), 0);
    };

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
            icon: b.iconPath.length > 0 ? "" : "📦", // We use SVG paths, not emojis
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
                    icon: "🧩",
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

    return (
        <div className="flex flex-col h-full">
            {/* Search Section */}
            <div className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[var(--ide-text-secondary)] font-bold uppercase tracking-[0.2em]">Components</span>
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                </div>
                <div className="relative group">
                    <input
                        type="search"
                        placeholder="Quick search..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-[var(--ide-bg-panel)] text-[var(--ide-text)] text-[11px] pl-8 pr-3 py-2 rounded-lg border border-[var(--ide-border)] focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-[var(--ide-text-muted)]"
                    />
                    <svg className="absolute left-2.5 top-2.5 w-3 h-3 text-[var(--ide-text-muted)] group-focus-within:text-indigo-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </div>
            </div>

            {/* Component List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-4">
                {filteredLibrary.map((category, catIdx) => (
                    <div key={`${catIdx}-${category.name}`} className="mb-6 animate-fade-in">
                        {/* Category Header */}
                        <div className="flex items-center justify-between mb-2">
                            <button
                                onClick={() => toggleCategory(category.name)}
                                className="flex items-center gap-2 group w-full"
                            >
                                <svg
                                    className={`w-2.5 h-2.5 text-[var(--ide-text-muted)] group-hover:text-indigo-400 transition-all ${expandedCategories.has(category.name) ? 'rotate-90' : ''}`}
                                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" />
                                </svg>
                                <span className="text-[10px] text-[var(--ide-text-secondary)] font-bold uppercase tracking-widest leading-none group-hover:text-[var(--ide-text)] transition-colors">
                                    {category.name}
                                </span>
                            </button>

                            {/* Create Component Logic */}
                            {category.name === "My Components" && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); setIsCreatingComponent(!isCreatingComponent); }}
                                    className="text-[var(--ide-text-muted)] hover:text-indigo-400 p-1"
                                    title="Create Component"
                                >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                                    </svg>
                                </button>
                            )}
                        </div>

                        {/* Create Component Input */}
                        {category.name === "My Components" && isCreatingComponent && expandedCategories.has("My Components") && (
                            <div className="mb-3 px-1">
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
                                        className="w-full text-xs bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] rounded px-2 py-1 text-[var(--ide-text)]"
                                    />
                                    <button type="submit" className="text-xs bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700">Add</button>
                                </form>
                            </div>
                        )}

                        {/* Category Items: Grid View */}
                        {expandedCategories.has(category.name) && (
                            <div className="grid grid-cols-2 gap-2">
                                {category.items.map((item) => (
                                    <div
                                        key={item.name + ((item as any).id || item.type)}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, item.type, (item as any).id)}
                                        onMouseDown={(e) => {
                                            if (e.button === 0 && (e.target as HTMLElement).closest('[data-palette-edit]') === null) {
                                                handlePointerDragStart(e, item.type, (item as any).id);
                                            }
                                        }}
                                        className={`group relative h-20 bg-[var(--ide-bg-panel)] hover:bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] hover:border-indigo-500/30 rounded-xl cursor-pointer transition-all duration-300 flex flex-col items-center justify-center gap-2 overflow-hidden shadow-sm ${lastAdded === item.type ? 'ring-2 ring-green-400 scale-95' : ''
                                            }`}
                                        title={`${item.description} — Click to add, or drag to canvas`}
                                    >
                                        <div className="absolute inset-0 bg-indigo-500/10 opacity-0 group-hover:opacity-100 blur-xl transition-opacity pointer-events-none" />
                                        <div className="relative transform group-hover:scale-110 transition-transform duration-300">
                                            {(item as any).iconPath ? (
                                                <svg className="w-5 h-5 text-[var(--ide-text-muted)] group-hover:text-indigo-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d={(item as any).iconPath} />
                                                </svg>
                                            ) : (
                                                <span className="text-xl filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">{item.icon}</span>
                                            )}
                                        </div>
                                        <div className="relative text-[10px] text-[var(--ide-text-secondary)] font-bold tracking-tight group-hover:text-[var(--ide-text)] transition-colors text-center px-1 truncate w-full">
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
                                                className="absolute top-1 right-1 p-1 bg-white/10 hover:bg-white/30 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                                title="Edit Master Component"
                                            >
                                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                </svg>
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
