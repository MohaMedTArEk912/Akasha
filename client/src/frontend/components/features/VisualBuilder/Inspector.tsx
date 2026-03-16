/**
 * Inspector Panel - Visual Mode Property Editor
 *
 * Orchestrates tabs and actions; tab content is modularized in ./inspector.
 */

import React, { useCallback, useState } from "react";
import { useEditor } from "@craftjs/core";
import {
    archiveBlock,
    archivePage,
} from "../../../stores/projectStore";
import { useToast } from "../../../context/ToastContext";
import ConfirmModal from "../../Modals/ConfirmModal";
import { useSelectedNode } from "./hooks/craft/useSelectedNode";
import type { CraftBlockProps } from "./hooks/craft/serialization";
import EventsPanel from "./inspector/EventsPanel";
import PropertiesPanel from "./inspector/PropertiesPanel";
import StylesPanel from "./inspector/StylesPanel";
import type { InspectorTab } from "./hooks/inspector/types";
import { useProjectStore } from "../../../hooks/useProjectStore";

interface InspectorProps {
    onClose?: () => void;
}

const Inspector: React.FC<InspectorProps> = ({ onClose }) => {
    const { project } = useProjectStore();
    const { isSelected, blockType, blockName, props, setProp, deleteNode, isDeletable, nodeId } = useSelectedNode();
    const { actions, query } = useEditor();
    const toast = useToast();

    const [activeTab, setActiveTab] = useState<InspectorTab>("properties");
    const [pendingDeleteBlockId, setPendingDeleteBlockId] = useState<string | null>(null);
    const [pendingDeletePageId, setPendingDeletePageId] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const handlePropertyChange = (property: string, value: unknown) => {
        setProp((p: CraftBlockProps) => {
            p.properties = { ...p.properties, [property]: value };
            if (property === "text") p.text = String(value);
        });
    };

    const handleStyleChange = (style: string, value: string | number) => {
        setProp((p: CraftBlockProps) => {
            p.styles = { ...p.styles, [style]: value };
        });
    };

    const confirmDeleteBlock = async () => {
        if (!pendingDeleteBlockId) return;
        setIsProcessing(true);
        try {
            await archiveBlock(pendingDeleteBlockId);
            toast.success("Component deleted");
            setPendingDeleteBlockId(null);
        } catch {
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
        } catch {
            toast.error("Failed to delete page");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDuplicate = useCallback(() => {
        if (!nodeId || nodeId === "ROOT") return;
        try {
            const nodeData = query.node(nodeId).get();
            const parentId = nodeData.data.parent;
            if (parentId) {
                const nodeTree = query.node(nodeId).toNodeTree();
                actions.addNodeTree(nodeTree, parentId);
                toast.success("Duplicated");
            }
        } catch {
            toast.error("Duplicate failed");
        }
    }, [nodeId, query, actions, toast]);

    const handleToggleLock = useCallback(() => {
        if (!nodeId) return;
        const isLocked = !!props?.properties?.__locked;
        setProp((p: CraftBlockProps) => {
            p.properties = { ...p.properties, __locked: !isLocked };
        });
        toast.success(isLocked ? "Unlocked" : "Locked");
    }, [nodeId, props, setProp, toast]);

    const isLocked = !!props?.properties?.__locked;
    const pendingBlockName = project?.blocks.find((b) => b.id === pendingDeleteBlockId)?.name || "this component";
    const pendingPageName = project?.pages.find((p) => p.id === pendingDeletePageId)?.name || "this page";

    return (
        <div className="w-full bg-[var(--ide-bg-sidebar)] flex flex-col h-full relative z-10">
            <div className="flex p-2 shrink-0 bg-[var(--ide-bg-sidebar)] justify-between items-center h-10 border-b border-[var(--ide-border)]">
                <span className="text-[10px] font-bold text-[var(--ide-text-secondary)] uppercase tracking-wider pl-1">Inspector</span>
                <div className="flex gap-1">
                    <button
                        onClick={() => onClose?.()}
                        disabled={!onClose}
                        className="p-1.5 rounded-md text-[var(--ide-text-muted)] hover:text-white hover:bg-white/10 transition-colors ml-1"
                        title="Close Inspector"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            </div>

            {isSelected && (
                <div className="px-3 py-2 bg-[var(--ide-bg-sidebar)] flex items-center justify-between group shrink-0">
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <div className="w-6 h-6 rounded bg-white/5 border border-white/10 flex items-center justify-center shrink-0 text-white shadow-sm">
                            <span className="text-[12px] opacity-80 leading-none">⚡</span>
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="text-[11px] font-semibold text-white truncate leading-tight">{blockName || "Block"}</div>
                            <div className="text-[9px] text-[var(--ide-text-muted)] font-mono uppercase truncate">{blockType || "block"}</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                        <button
                            onClick={handleToggleLock}
                            className={`p-1 rounded transition-all shrink-0 ${isLocked ? "bg-amber-500/15 text-amber-400" : "hover:bg-white/10 text-[var(--ide-text-muted)] hover:text-white"}`}
                            title={isLocked ? "Unlock" : "Lock"}
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={isLocked
                                    ? "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                                    : "M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
                                } />
                            </svg>
                        </button>
                        {isDeletable && (
                            <button
                                onClick={handleDuplicate}
                                className="p-1 hover:bg-indigo-500/10 rounded text-[var(--ide-text-muted)] hover:text-indigo-400 transition-all shrink-0"
                                title="Duplicate (Ctrl+D)"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                            </button>
                        )}
                        {isDeletable && (
                            <button
                                onClick={deleteNode}
                                className="p-1 hover:bg-red-500/10 rounded text-red-400/70 hover:text-red-400 transition-all shrink-0"
                                title="Delete (Del)"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                        )}
                    </div>
                </div>
            )}

            {isSelected && (
                <div className="flex px-3 pb-3 pt-1 border-b border-[var(--ide-border)] bg-[var(--ide-bg-sidebar)] gap-1 shrink-0">
                    {(["properties", "styles", "events"] as const).map((tab) => {
                        const isActive = activeTab === tab;
                        return (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`flex-1 py-1 text-[10px] font-semibold tracking-wide rounded-md transition-all ${isActive
                                    ? "bg-white/10 text-white shadow-sm border border-white/5"
                                    : "text-[var(--ide-text-muted)] hover:text-white hover:bg-white/5 border border-transparent"
                                    }`}
                            >
                                {tab === "properties" ? "Props" : tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </button>
                        );
                    })}
                </div>
            )}

            <div className="flex-1 overflow-y-auto custom-scrollbar relative">
                {!isSelected ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-8 opacity-60">
                        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4 ring-1 ring-white/10">
                            <svg className="w-6 h-6 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                            </svg>
                        </div>
                        <p className="text-xs font-bold text-white/50 uppercase tracking-widest">No Selection</p>
                        <p className="text-[10px] text-white/30 mt-2 text-center max-w-[150px]">Select a component on the canvas to edit its properties.</p>
                    </div>
                ) : (
                    <div className="animate-fade-in divide-y divide-[var(--ide-border)]">
                        {activeTab === "properties" && props && (
                            <PropertiesPanel
                                blockType={blockType || "block"}
                                properties={props.properties}
                                text={props.text}
                                onChange={handlePropertyChange}
                            />
                        )}
                        {activeTab === "styles" && props && (
                            <StylesPanel styles={props.styles} onChange={handleStyleChange} />
                        )}
                        {activeTab === "events" && props && (
                            <EventsPanel
                                eventHandlers={props.eventHandlers}
                                bindings={props.bindings}
                                properties={props.properties}
                                setProp={setProp}
                            />
                        )}
                    </div>
                )}
            </div>

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
        </div>
    );
};

export default Inspector;
