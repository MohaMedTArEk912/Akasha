/**
 * Inspector Panel - Visual Mode Property Editor
 * 
 * Shows properties, styles, and events for the selected component.
 * When no component is selected, shows Layers, Pages, and Assets tabs with full CRUD.
 */

import React, { useState, useEffect } from "react";
import { useProjectStore } from "../../hooks/useProjectStore";
import {
    getBlock,
    updateBlockProperty,
    updateBlockStyle,
    selectPage,
    createPage,
    updatePage,
    archivePage,
    archiveBlock,
    listDirectory,
    createFile,
    deleteFile,
    selectBlock
} from "../../stores/projectStore";
import { useToast } from "../../context/ToastContext";
import ConfirmModal from "../Modals/ConfirmModal";

type InspectorTab = "properties" | "styles" | "events";
type GlobalTab = "layers" | "pages" | "assets";

const Inspector: React.FC = () => {
    const { selectedBlockId, project } = useProjectStore();

    const [activeTab, setActiveTab] = useState<InspectorTab>("properties");
    const [globalTab, setGlobalTab] = useState<GlobalTab>("layers");
    const toast = useToast();

    // Modal States
    const [pendingDeleteBlockId, setPendingDeleteBlockId] = useState<string | null>(null);
    const [pendingDeletePageId, setPendingDeletePageId] = useState<string | null>(null);
    const [pendingDeleteAssetPath, setPendingDeleteAssetPath] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const selectedBlock = selectedBlockId ? getBlock(selectedBlockId) : null;

    const handlePropertyChange = async (property: string, value: unknown) => {
        if (selectedBlock) {
            await updateBlockProperty(selectedBlock.id, property, value);
        }
    };

    const handleStyleChange = async (style: string, value: string) => {
        if (selectedBlock) {
            await updateBlockStyle(selectedBlock.id, style, value);
        }
    };

    // --- Modal Handlers ---

    const confirmDeleteBlock = async () => {
        if (!pendingDeleteBlockId) return;
        setIsProcessing(true);
        try {
            await archiveBlock(pendingDeleteBlockId);
            toast.success("Component deleted");
            setPendingDeleteBlockId(null);
        } catch (err) {
            toast.error("Failed to delete component");
        } finally {
            setIsProcessing(false);
        }
    };

    const confirmDeletePage = async () => {
        if (!pendingDeletePageId) return;
        setIsProcessing(true);
        try {
            await archivePage(pendingDeletePageId);
            toast.success("Page deleted");
            setPendingDeletePageId(null);
        } catch (err) {
            toast.error("Failed to delete page");
        } finally {
            setIsProcessing(false);
        }
    };

    const confirmDeleteAsset = async () => {
        if (!pendingDeleteAssetPath) return;
        setIsProcessing(true);
        try {
            await deleteFile(pendingDeleteAssetPath);
            setPendingDeleteAssetPath(null);
            toast.success("Asset deleted");
        } catch (err) {
            toast.error("Delete failed");
        } finally {
            setIsProcessing(false);
        }
    };

    // Helper names for modals
    const pendingBlockName = project?.blocks.find(b => b.id === pendingDeleteBlockId)?.name || "this component";
    const pendingPageName = project?.pages.find(p => p.id === pendingDeletePageId)?.name || "this page";
    const pendingAssetName = pendingDeleteAssetPath?.split("/").pop() || "this file";

    return (
        <div className="w-72 bg-[var(--ide-bg-sidebar)] border-l border-[var(--ide-border)] flex flex-col h-full overflow-hidden animate-slide-up">
            {/* ── Header ── */}
            <div className="h-12 px-4 flex items-center justify-between border-b border-[var(--ide-border)] bg-[var(--ide-bg-elevated)]">
                <span className="text-[10px] text-[var(--ide-text-secondary)] font-bold uppercase tracking-[0.2em]">
                    {selectedBlock ? "Selection" : "Inspector"}
                </span>
                {selectedBlock && (
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">
                        <div className="w-1 h-1 rounded-full bg-indigo-400" />
                        <span className="text-[9px] text-indigo-500 font-bold uppercase tracking-tighter">Active</span>
                    </div>
                )}
            </div>

            {/* ── Tabs ── */}
            <div className="flex border-b border-[var(--ide-border)] bg-[var(--ide-bg-elevated)]">
                {(selectedBlock ? ["properties", "styles", "events"] : ["layers", "pages", "assets"]).map((tab) => {
                    const isActive = selectedBlock ? activeTab === tab : globalTab === tab;
                    return (
                        <button
                            key={tab}
                            onClick={() => selectedBlock ? setActiveTab(tab as InspectorTab) : setGlobalTab(tab as GlobalTab)}
                            className={`flex-1 px-2 py-3 text-[10px] font-bold uppercase tracking-widest transition-all relative ${isActive ? "text-[var(--ide-text)]" : "text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-bg-panel)]"
                                }`}
                        >
                            {tab}
                            {isActive && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
                            )}
                        </button>
                    );
                })}
            </div>

            {/* ── Content ── */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {!selectedBlock ? (
                    <>
                        {globalTab === "layers" && <LayersPanel onDeleteRequest={setPendingDeleteBlockId} />}
                        {globalTab === "pages" && <PagesPanel onDeleteRequest={setPendingDeletePageId} />}
                        {globalTab === "assets" && <AssetsPanel onDeleteRequest={setPendingDeleteAssetPath} />}
                    </>
                ) : (
                    <div className="animate-fade-in">
                        {/* Selected Component Brief */}
                        <div className="p-4 bg-[var(--ide-bg-elevated)] border-b border-[var(--ide-border)]">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shadow-inner">
                                    <span className="text-xl">📦</span>
                                </div>
                                <div className="min-w-0">
                                    <div className="text-xs text-[var(--ide-text)] font-bold truncate tracking-tight">{selectedBlock.name}</div>
                                    <div className="text-[9px] text-[var(--ide-text-secondary)] font-bold uppercase tracking-widest mt-0.5 italic">{selectedBlock.block_type}</div>
                                </div>
                            </div>
                        </div>

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
                )}
            </div>

            {/* ── CENTRALIZED MODALS (Outside containers) ── */}

            <ConfirmModal
                isOpen={pendingDeleteBlockId !== null}
                title="Delete Component"
                message={`Delete "${pendingBlockName}"? This action cannot be undone.`}
                confirmText="Delete"
                variant="danger"
                isLoading={isProcessing}
                onConfirm={confirmDeleteBlock}
                onCancel={() => !isProcessing && setPendingDeleteBlockId(null)}
            />

            <ConfirmModal
                isOpen={pendingDeletePageId !== null}
                title="Delete Page"
                message={`Delete "${pendingPageName}" permanently? This action cannot be undone.`}
                confirmText="Delete"
                variant="danger"
                isLoading={isProcessing}
                onConfirm={confirmDeletePage}
                onCancel={() => !isProcessing && setPendingDeletePageId(null)}
            />

            <ConfirmModal
                isOpen={pendingDeleteAssetPath !== null}
                title="Delete Asset"
                message={`Delete "${pendingAssetName}" permanently? This action cannot be undone.`}
                confirmText="Delete"
                variant="danger"
                isLoading={isProcessing}
                onConfirm={confirmDeleteAsset}
                onCancel={() => !isProcessing && setPendingDeleteAssetPath(null)}
            />
        </div>
    );
};

// Layers Panel
const LayersPanel: React.FC<{ onDeleteRequest: (id: string) => void }> = ({ onDeleteRequest }) => {
    const { project, selectedBlockId } = useProjectStore();
    const rootBlocks = project?.blocks.filter(b => !b.archived && !b.parent_id) || [];

    return (
        <div className="p-3">
            <div className="mb-4">
                <div className="text-xs text-[var(--ide-text-secondary)] flex items-center gap-2">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                    <span>Layers</span>
                </div>
            </div>

            {rootBlocks.length === 0 ? (
                <div className="text-center py-10 px-4 bg-[var(--ide-bg-sidebar)]/30 rounded-2xl border border-dashed border-[var(--ide-border)]">
                    <p className="text-[10px] text-[var(--ide-text-muted)] uppercase tracking-widest font-bold">Empty Canvas</p>
                    <p className="text-[9px] text-[var(--ide-text-muted)] mt-1">Drag components from the palette</p>
                </div>
            ) : (
                <div className="space-y-1">
                    {rootBlocks.map((block) => (
                        <div
                            key={block.id}
                            onClick={() => selectBlock(block.id)}
                            className={`group px-3 py-2.5 rounded-xl border transition-all flex items-center gap-3 cursor-pointer ${block.id === selectedBlockId
                                ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/30 shadow-sm"
                                : "text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] bg-[var(--ide-bg-elevated)] border-[var(--ide-border)] hover:border-[var(--ide-border-strong)]"
                                }`}
                        >
                            <svg className={`w-4 h-4 shrink-0 ${block.id === selectedBlockId ? "text-indigo-400" : "text-[var(--ide-text-muted)]"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                            <span className="truncate flex-1 font-bold text-[11px] tracking-tight">{block.name}</span>

                            <button
                                onClick={(e) => { e.stopPropagation(); onDeleteRequest(block.id); }}
                                className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/10 rounded-lg text-red-500/60 hover:text-red-500 transition-all"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// Pages Panel
const PagesPanel: React.FC<{ onDeleteRequest: (id: string) => void }> = ({ onDeleteRequest }) => {
    const { project, selectedPageId } = useProjectStore();
    const [isCreating, setIsCreating] = useState(false);
    const [editingPageId, setEditingPageId] = useState<string | null>(null);
    const [editName, setEditName] = useState("");
    const toast = useToast();

    const pages = project?.pages.filter(p => !p.archived) || [];

    const handleCreatePage = async () => {
        setIsCreating(true);
        try {
            await createPage("New Page");
            toast.success("Page created successfully");
        } catch (err) {
            toast.error("Failed to create page");
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div className="p-3">
            <div className="mb-4 flex items-center justify-between">
                <div className="text-xs text-[var(--ide-text-secondary)] flex items-center gap-2">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span>Pages</span>
                </div>
                <button
                    onClick={handleCreatePage}
                    disabled={isCreating}
                    className="p-1.5 hover:bg-indigo-500/10 rounded-lg text-indigo-400 group transition-colors"
                >
                    <svg className={`w-4 h-4 transition-transform ${isCreating ? "animate-spin" : "group-hover:scale-110"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                    </svg>
                </button>
            </div>

            <div className="space-y-2">
                {pages.map((page) => (
                    <div
                        key={page.id}
                        className={`group relative rounded-xl border transition-all duration-300 overflow-hidden ${page.id === selectedPageId
                            ? "bg-indigo-500/10 border-indigo-500/40 shadow-sm"
                            : "bg-[var(--ide-bg-elevated)] border-[var(--ide-border)] hover:border-[var(--ide-border-strong)]"
                            }`}
                    >
                        <div
                            onClick={() => page.id !== selectedPageId && selectPage(page.id)}
                            className={`px-3 py-3 cursor-pointer flex items-center gap-3 ${page.id === selectedPageId ? "" : "hover:bg-[var(--ide-bg-panel)]"}`}
                        >
                            <svg className={`w-4 h-4 shrink-0 transition-colors ${page.id === selectedPageId ? "text-indigo-400" : "text-[var(--ide-text-muted)]"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>

                            <div className="flex-1 min-w-0">
                                {editingPageId === page.id ? (
                                    <input
                                        autoFocus
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        onBlur={() => {
                                            if (editName.trim()) updatePage(page.id, editName.trim());
                                            setEditingPageId(null);
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                if (editName.trim()) updatePage(page.id, editName.trim());
                                                setEditingPageId(null);
                                            }
                                        }}
                                        className="w-full bg-transparent text-xs font-bold text-[var(--ide-text)] border-none focus:ring-0 p-0"
                                    />
                                ) : (
                                    <>
                                        <div className={`text-xs font-bold truncate tracking-tight transition-colors ${page.id === selectedPageId ? "text-indigo-400" : "text-[var(--ide-text)]"}`}>
                                            {page.name}
                                        </div>
                                        <div className="text-[9px] text-[var(--ide-text-muted)] truncate font-mono opacity-50 mt-0.5">
                                            {page.path}
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity translate-x-1 group-hover:translate-x-0">
                                <button
                                    onClick={(e) => { e.stopPropagation(); setEditingPageId(page.id); setEditName(page.name); }}
                                    className="p-1.5 hover:bg-white/10 rounded-lg text-[var(--ide-text-secondary)] hover:text-indigo-400 transition-colors"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                    </svg>
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onDeleteRequest(page.id); }}
                                    className="p-1.5 hover:bg-red-500/10 rounded-lg text-red-500/40 hover:text-red-500 transition-colors"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// Assets Panel
const AssetsPanel: React.FC<{ onDeleteRequest: (path: string) => void }> = ({ onDeleteRequest }) => {
    const { project } = useProjectStore();
    const [assets, setAssets] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const toast = useToast();

    const assetsPath = project?.root_path ? `${project.root_path}/client/public/assets` : null;

    const loadAssets = async () => {
        if (!assetsPath) return;
        setLoading(true);
        try {
            const res = await listDirectory(assetsPath);
            setAssets(res.entries.filter(e => !e.is_directory));
        } catch (err) {
            setAssets([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAssets();
    }, [assetsPath]);

    const handleAddDemo = async () => {
        if (!assetsPath) return;
        try {
            const name = `asset_${Date.now()}.png`;
            await createFile(`${assetsPath}/${name}`, "");
            loadAssets();
            toast.success("Demo asset registered");
        } catch (err) {
            toast.error("Failed to add asset");
        }
    };

    return (
        <div className="p-3">
            <div className="mb-4 flex items-center justify-between">
                <div className="text-xs text-[var(--ide-text-secondary)] flex items-center gap-2">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>Assets</span>
                </div>
                <button
                    onClick={handleAddDemo}
                    className="p-1.5 hover:bg-indigo-500/10 rounded-lg text-indigo-400 group transition-colors"
                >
                    <svg className="w-4 h-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                    </svg>
                </button>
            </div>

            {loading ? (
                <div className="text-center py-12">
                    <div className="animate-spin w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto" />
                </div>
            ) : assets.length === 0 ? (
                <div className="text-center py-12 px-4 bg-[var(--ide-bg-sidebar)]/30 rounded-2xl border border-dashed border-[var(--ide-border)]">
                    <p className="text-[10px] text-[var(--ide-text-muted)] uppercase tracking-widest font-bold">No Assets</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-2">
                    {assets.map((asset) => (
                        <div key={asset.path} className="group relative aspect-square bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] rounded-xl overflow-hidden hover:border-indigo-500/50 transition-all">
                            <div className="w-full h-full flex items-center justify-center text-indigo-400/20">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                                <div className="text-[8px] text-white truncate">{asset.name}</div>
                            </div>
                            <button
                                onClick={() => onDeleteRequest(asset.path)}
                                className="absolute top-1 right-1 p-1 bg-red-500/80 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// Properties Panel
const PropertiesPanel: React.FC<{ block: any; onChange: (prop: string, value: unknown) => void }> = ({ block, onChange }) => {
    return (
        <div className="p-4 space-y-4">
            {/* Text Property */}
            {["text", "paragraph", "heading", "button"].includes(block.block_type) && (
                <div>
                    <label className="block text-[10px] text-[var(--ide-text-secondary)] font-bold uppercase tracking-wider mb-1.5">Text Content</label>
                    <input
                        type="text"
                        value={(block.properties.text as string) || ""}
                        onChange={(e) => onChange("text", e.target.value)}
                        className="w-full bg-[var(--ide-bg-panel)] text-[var(--ide-text)] text-xs px-3 py-2 rounded-xl border border-[var(--ide-border)] focus:outline-none focus:border-indigo-500 transition-colors shadow-inner"
                    />
                </div>
            )}
        </div>
    );
};

// Styles Panel
const StylesPanel: React.FC<{ block: any; onChange: (style: string, value: string) => void }> = ({ block, onChange }) => {
    return (
        <div className="p-4 space-y-5">
            {/* Background Color */}
            <div className="space-y-2">
                <label className="block text-[10px] text-[var(--ide-text-secondary)] font-bold uppercase tracking-wider">Appearance</label>
                <div className="flex items-center gap-3">
                    <div
                        className="w-10 h-10 rounded-xl border-2 border-[var(--ide-border)] relative overflow-hidden group cursor-pointer"
                        style={{ backgroundColor: (block.styles.backgroundColor as string) || "transparent" }}
                    >
                        <input
                            type="color"
                            value={(block.styles.backgroundColor as string) || "#ffffff"}
                            onChange={(e) => onChange("backgroundColor", e.target.value)}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        />
                    </div>
                    <div className="flex-1">
                        <div className="text-[10px] text-[var(--ide-text-muted)] font-mono uppercase">Background</div>
                        <div className="text-xs font-bold text-[var(--ide-text)] mt-0.5">{(block.styles.backgroundColor as string) || "Transparent"}</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Events Panel Placeholder
const EventsPanel: React.FC = () => {
    return (
        <div className="p-8 text-center flex flex-col items-center justify-center h-full max-w-[200px] mx-auto mt-10">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-indigo-500/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
            </div>
            <h3 className="text-xs font-bold text-[var(--ide-text-secondary)] mb-2 uppercase tracking-tight">Logic Engine</h3>
            <p className="text-[10px] text-[var(--ide-text-muted)] leading-relaxed font-medium">
                Visual event handlers and logic flows are currently being polished.
            </p>
        </div>
    );
};

export default Inspector;
