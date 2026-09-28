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
                        className="w-6 h-6 rounded-md text-[var(--ide-text-muted)] hover:text-white hover:bg-white/10 transition-colors ml-1 flex items-center justify-center font-bold text-xs"
                        title="Close Inspector"
                    >
                        ✕
                    </button>
                </div>
            </div>

            {isSelected && (
                <div className="px-3 py-2 bg-[var(--ide-bg-sidebar)] flex items-center justify-between group shrink-0">
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <div className="w-6 h-6 rounded bg-white/5 border border-white/10 flex items-center justify-center shrink-0 text-white shadow-sm font-mono text-[9px] font-black">
                            UI
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="text-[11px] font-semibold text-white truncate leading-tight">{blockName || "Block"}</div>
                            <div className="text-[9px] text-[var(--ide-text-muted)] font-mono uppercase truncate">{blockType || "block"}</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        <button
                            onClick={handleToggleLock}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold transition-all shrink-0 ${isLocked ? "bg-amber-500/15 text-amber-400" : "hover:bg-white/10 text-[var(--ide-text-muted)] hover:text-white"}`}
                            title={isLocked ? "Unlock" : "Lock"}
                        >
                            {isLocked ? "LOCK" : "UNLK"}
                        </button>
                        {isDeletable && (
                            <button
                                onClick={handleDuplicate}
                                className="px-1.5 py-0.5 hover:bg-indigo-500/10 rounded text-[9px] font-mono font-bold text-[var(--ide-text-muted)] hover:text-indigo-400 transition-all shrink-0"
                                title="Duplicate (Ctrl+D)"
                            >
                                DUP
                            </button>
                        )}
                        {isDeletable && (
                            <button
                                onClick={deleteNode}
                                className="px-1.5 py-0.5 hover:bg-red-500/10 rounded text-[9px] font-mono font-bold text-red-400/70 hover:text-red-400 transition-all shrink-0"
                                title="Delete (Del)"
                            >
                                DEL
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
                            <span className="font-mono text-xs font-black text-white/40 tracking-widest">SELECT</span>
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
