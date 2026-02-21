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
import { CraftBlock } from "./craft/CraftBlock";
import { BLOCK_REGISTRY, getPaletteCategories } from "./craft/blockRegistry";

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

    const getCategoryIcon = (name: string) => {
        switch (name.toLowerCase()) {
            case "layout": return <path d="M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 0h6v6h-6v-6z" />;
            case "typography": return <path d="M4 6h16v2H4V6zm5 4h6v10H9v-10zm-5 4h3v2H4v-2zm13 0h3v2h-3v-2z" />;
            case "media": return <path d="M4 4h16v16H4V4zm2 2v12h12V6H6zm2 8l3-3 4 5 2-2 1 1v1H8v-2z" />;
            case "forms": return <path d="M3 5h18v2H3V5zm0 6h18v2H3v-2zm0 6h12v2H3v-2zm14 0h4v2h-4v-2z" />;
            case "my components": return <path d="M12 2l-5.5 9h11L12 2zm0 3.84L14.12 9H9.88L12 5.84zM12 13l-5.5 9h11L12 13zm0 3.84l2.12 3.16H9.88L12 16.84z" />;
            case "pages": return <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM6 20V4h5v6h6v10H6z" />;
            case "section": return <path d="M4 6h16v12H4V6zm2 2v8h12V8H6z" />;
            case "navigation": return <path d="M3 4h18v4H3V4zm0 6h18v10H3V10zm2-4v2h14V6H5zm0 6v6h14v-6H5z" />;
            default: return <path d="M12 2L2 22h20L12 2z" />;
        }
    };

    return (
        <div className="flex flex-col h-full bg-[var(--ide-bg-sidebar)]">
            {/* Search Section (Framer style) */}
            <div className="p-3 border-b border-[var(--ide-border)]">
                <div className="relative group flex items-center bg-white/5 hover:bg-white/10 rounded-lg px-3 h-8 transition-colors">
                    <svg className="w-3.5 h-3.5 text-[var(--ide-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                        type="search"
                        placeholder="Search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-transparent border-none text-[12px] text-white pl-2 pr-2 h-full outline-none placeholder:text-[var(--ide-text-muted)] placeholder:font-medium"
                    />
                </div>
            </div>

            {/* Component List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-4">



                {filteredLibrary.map((category, catIdx) => (
                    <div key={`${catIdx}-${category.name}`} className="mb-px">
                        {/* Category Header (Framer List Item Style) */}
                        <div className="flex items-center justify-between group">
                            <button
                                onClick={() => toggleCategory(category.name)}
                                className="flex items-center gap-3 w-full px-2 py-2 rounded-lg hover:bg-white/5 transition-colors"
                            >
                                <div className="w-6 h-6 rounded flex items-center justify-center bg-white/5 text-[var(--ide-text-muted)] group-hover:text-white transition-colors">
                                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                        {getCategoryIcon(category.name)}
                                    </svg>
                                </div>

                                <span className="text-[12px] font-medium text-[var(--ide-text-secondary)] group-hover:text-[var(--ide-text)] transition-colors flex-1 text-left">
                                    {category.name}
                                </span>

                                <svg
                                    className={`w-3.5 h-3.5 text-[var(--ide-text-muted)] group-hover:text-white transition-transform duration-200 ${expandedCategories.has(category.name) ? 'rotate-90' : ''}`}
                                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                </svg>
                            </button>

                            {/* Create Component Logic */}
                            {category.name === "My Components" && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); setIsCreatingComponent(!isCreatingComponent); }}
                                    className="absolute right-8 text-[var(--ide-text-muted)] hover:text-white p-1 rounded hover:bg-white/10"
                                    title="Create Component"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                                    </svg>
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
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, item.type, (item as any).id)}
                                        onMouseDown={(e) => {
                                            if (e.button === 0 && (e.target as HTMLElement).closest('[data-palette-edit]') === null) {
                                                handlePointerDragStart(e, item.type, (item as any).id);
                                            }
                                        }}
                                        className={`group relative h-16 bg-white/5 hover:bg-white/10 border border-transparent hover:border-white/10 rounded-lg cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-1 overflow-hidden ring-1 ring-inset ring-transparent hover:ring-[#0099FF]/30 shadow-sm ${lastAdded === item.type ? 'ring-2 ring-emerald-500 scale-95' : ''
                                            }`}
                                        title={`${item.description} — Click to add, or drag to canvas`}
                                    >
                                        <div className="text-[var(--ide-text-muted)] group-hover:text-white transition-colors transform group-hover:scale-110 duration-200">
                                            {(item as any).iconPath ? (
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d={(item as any).iconPath} />
                                                </svg>
                                            ) : (
                                                <span className="text-lg filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] leading-none">{item.icon}</span>
                                            )}
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
                                                className="absolute top-1 right-1 p-1 bg-white/10 hover:bg-[#0099FF]/80 rounded-full opacity-0 group-hover:opacity-100 transition-all backdrop-blur"
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
