/**
 * Inspector Panel - Visual Mode Property Editor
 *
 * Now powered by craft.js:
 * - Properties / Styles / Events tabs read from and write to craft.js node state
 * - Layers and Assets tabs still read from the project store
 * - react-colorful replaces native <input type="color">
 */

import React, { useState } from "react";
import { useProjectStore } from "../../hooks/useProjectStore";
import {
    archivePage,
    archiveBlock,
} from "../../stores/projectStore";
import { useToast } from "../../context/ToastContext";
import ConfirmModal from "../Modals/ConfirmModal";
import { useSelectedNode } from "./craft/useSelectedNode";
import type { CraftBlockProps } from "./craft/serialization";
import { HexColorPicker } from "react-colorful";

type InspectorTab = "properties" | "styles" | "events";

const Inspector: React.FC = () => {
    const { project } = useProjectStore();
    const { isSelected, blockType, blockName, props, setProp, deleteNode, isDeletable } = useSelectedNode();

    const [activeTab, setActiveTab] = useState<InspectorTab>("properties");
    const toast = useToast();

    // Modal States
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

    // Modal Handlers
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


    const pendingBlockName =
        project?.blocks.find((b) => b.id === pendingDeleteBlockId)?.name || "this component";
    const pendingPageName =
        project?.pages.find((p) => p.id === pendingDeletePageId)?.name || "this page";

    return (
        <div className="w-64 bg-[var(--ide-bg-sidebar)] border-l border-[var(--ide-border)] flex flex-col flex-shrink-0 h-full relative z-10 transition-transform duration-300 shadow-xl">
            {/* Header / Actions */}
            <div className="flex p-2 shrink-0 bg-[var(--ide-bg-sidebar)] justify-between items-center h-10 border-b border-[var(--ide-border)]">
                <span className="text-[10px] font-bold text-[var(--ide-text-secondary)] uppercase tracking-wider pl-1">Inspector</span>
                <div className="flex gap-1">
                    <button
                        onClick={() => {
                            const { setInspectorOpen } = require("../../stores/projectStore");
                            setInspectorOpen(false);
                        }}
                        className="p-1.5 rounded-md text-[var(--ide-text-muted)] hover:text-white hover:bg-white/10 transition-colors ml-1"
                        title="Close Inspector"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            </div>

            {/* Block Brief Banner */}
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
                    {isDeletable && (
                        <button
                            onClick={deleteNode}
                            className="p-1 hover:bg-red-500/10 rounded text-red-400/70 hover:text-red-400 transition-all shrink-0"
                            title="Delete"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                    )}
                </div>
            )}

            {/* Tabs */}
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

            {/* Content Container */}
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
                                blockType={blockType!}
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
                                blockType={blockType!}
                                eventHandlers={props.eventHandlers}
                                bindings={props.bindings}
                                properties={props.properties}
                                setProp={setProp}
                            />
                        )}
                    </div>
                )}
            </div>

            {/* Centralized Modals */}
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

/* ═══════════════════  Helper Components  ═══════════ */

const InspectorSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="pt-5 first:pt-2 border-t border-[var(--ide-border)] mt-5 first:mt-0 first:border-0">
        <h4 className="flex items-center justify-between text-[11px] font-semibold text-[var(--ide-text-secondary)] mb-3 px-1 hover:text-white cursor-pointer transition-colors group">
            {title}
            <svg className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
        </h4>
        <div className="space-y-2.5 px-1">{children}</div>
    </div>
);

const PropertyRow: React.FC<{ label: string; children: React.ReactNode; layout?: "row" | "col" }> = ({ label, children, layout = "row" }) => (
    <div className={`flex ${layout === 'col' ? 'flex-col gap-1.5' : 'items-center justify-between gap-3'}`}>
        <label className={`text-[11px] ${layout === 'col' ? 'text-[var(--ide-text-secondary)]' : 'text-[var(--ide-text-muted)] w-1/3'} whitespace-nowrap font-medium hover:text-[var(--ide-text-secondary)] transition-colors cursor-default`}>{label}</label>
        <div className={`${layout === 'col' ? 'w-full' : 'flex-1'} flex justify-end min-w-0`}>{children}</div>
    </div>
);

const CompactInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
    <input
        {...props}
        className="w-full bg-white/5 hover:bg-white/10 focus:bg-white/10 focus:ring-1 focus:ring-indigo-500/50 border border-transparent rounded-md px-2 py-1 text-[11px] text-[var(--ide-text)] transition-all outline-none placeholder:text-white/20 font-medium"
    />
);

const CompactSelect: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = (props) => (
    <div className="relative w-full">
        <select
            {...props}
            className="w-full bg-white/5 hover:bg-white/10 focus:bg-white/10 focus:ring-1 focus:ring-indigo-500/50 border border-transparent rounded-md pl-2 pr-6 py-1 text-[11px] text-[var(--ide-text)] appearance-none transition-all outline-none font-medium cursor-pointer"
        >
            {props.children}
        </select>
        <svg className="absolute right-2 top-1.5 w-3 h-3 text-[var(--ide-text-muted)] pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
    </div>
);

/* ═══════════════════  Properties Panel  ═══════════ */

const PropertiesPanel: React.FC<{
    blockType: string;
    properties: Record<string, unknown>;
    text?: string;
    onChange: (prop: string, value: unknown) => void;
}> = ({ blockType, properties, text, onChange }) => {
    return (
        <div className="p-4 space-y-6">
            {/* Core Settings */}
            <InspectorSection title="Settings">
                {/* Text Property */}
                {["text", "paragraph", "heading", "button", "link"].includes(blockType) && (
                    <div className="space-y-1.5">
                        <label className="text-xs text-[var(--ide-text-muted)]">Content</label>
                        <textarea
                            value={String(text ?? properties.text ?? "")}
                            onChange={(e) => onChange("text", e.target.value)}
                            className="w-full bg-black/10 border border-white/5 rounded-lg px-3 py-2 text-xs text-[var(--ide-text)] focus:outline-none focus:border-indigo-500/50 transition-colors resize-none h-20 placeholder:text-white/20"
                            placeholder="Enter text..."
                        />
                    </div>
                )}

                {/* Link href */}
                {blockType === "link" && (
                    <PropertyRow label="URL">
                        <CompactInput
                            type="text"
                            value={String(properties.href ?? "#")}
                            onChange={(e) => onChange("href", e.target.value)}
                            placeholder="https://"
                        />
                    </PropertyRow>
                )}

                {/* Image src */}
                {blockType === "image" && (
                    <PropertyRow label="Source">
                        <CompactInput
                            type="text"
                            value={String(properties.src ?? "")}
                            onChange={(e) => onChange("src", e.target.value)}
                            placeholder="/assets/image.png"
                        />
                    </PropertyRow>
                )}

                {/* Input type */}
                {blockType === "input" && (
                    <PropertyRow label="Type">
                        <CompactSelect
                            value={String(properties.inputType ?? "text")}
                            onChange={(e) => onChange("inputType", e.target.value)}
                        >
                            {["text", "email", "password", "number", "tel", "url", "date"].map((t) => (
                                <option key={t} value={t} className="bg-[var(--ide-bg-sidebar)] text-white">{t}</option>
                            ))}
                        </CompactSelect>
                    </PropertyRow>
                )}

                {/* Heading level */}
                {blockType === "heading" && (
                    <PropertyRow label="Level">
                        <CompactSelect
                            value={String(properties.level ?? 2)}
                            onChange={(e) => onChange("level", Number(e.target.value))}
                        >
                            {[1, 2, 3, 4, 5, 6].map((l) => (
                                <option key={l} value={l} className="bg-[var(--ide-bg-sidebar)] text-white">H{l}</option>
                            ))}
                        </CompactSelect>
                    </PropertyRow>
                )}
            </InspectorSection>
        </div>
    );
};

/* ═══════════════════  Styles Panel  ═══════════════ */

const StylesPanel: React.FC<{
    styles: Record<string, string | number | boolean>;
    onChange: (style: string, value: string | number) => void;
}> = ({ styles, onChange }) => {
    const [showBgPicker, setShowBgPicker] = useState(false);
    const [showColorPicker, setShowColorPicker] = useState(false);

    const bgColor = String(styles.backgroundColor ?? "transparent");
    const textColor = String(styles.color ?? "#000000");

    const setAlignment = (align: string, justify: string) => {
        onChange("display", "flex");
        // default to column if not set, to make these alignments work optimally
        if (!styles.flexDirection) onChange("flexDirection", "column");
        onChange("alignItems", align);
        onChange("justifyContent", justify);
    };

    return (
        <div className="p-4 space-y-2">

            {/* Alignment Row (Framer Style) */}
            <div className="flex items-center justify-between bg-white/5 rounded-lg p-1 mb-4 mx-1">
                <div className="flex items-center gap-0.5 border-r border-white/10 pr-1.5 hidden md:flex">
                    <button onClick={() => setAlignment("flex-start", styles.justifyContent as string)} className="p-1.5 rounded hover:bg-white/10 text-[var(--ide-text-muted)] hover:text-white transition-colors" title="Align Top">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4h16M12 8v12M8 12h8" /></svg>
                    </button>
                    <button onClick={() => setAlignment("center", styles.justifyContent as string)} className="p-1.5 rounded hover:bg-white/10 text-[var(--ide-text-muted)] hover:text-white transition-colors" title="Align Middle">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 12h16M12 4v16M8 8h8M8 16h8" /></svg>
                    </button>
                    <button onClick={() => setAlignment("flex-end", styles.justifyContent as string)} className="p-1.5 rounded hover:bg-white/10 text-[var(--ide-text-muted)] hover:text-white transition-colors" title="Align Bottom">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 20h16M12 4v12M8 12h8" /></svg>
                    </button>
                    <button onClick={() => setAlignment("stretch", "space-between")} className="p-1.5 rounded hover:bg-white/10 text-[var(--ide-text-muted)] hover:text-white transition-colors" title="Distribute">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8h16M4 16h16" /></svg>
                    </button>
                </div>
                <div className="flex items-center gap-0.5 pl-1.5">
                    <button onClick={() => setAlignment(styles.alignItems as string, "flex-start")} className="p-1.5 rounded hover:bg-white/10 text-[var(--ide-text-muted)] hover:text-white transition-colors" title="Align Left">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v16M8 12h12M12 8v8" /></svg>
                    </button>
                    <button onClick={() => setAlignment(styles.alignItems as string, "center")} className="p-1.5 rounded hover:bg-white/10 text-[var(--ide-text-muted)] hover:text-white transition-colors" title="Align Center">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16M4 12h16M8 8v8M16 8v8" /></svg>
                    </button>
                    <button onClick={() => setAlignment(styles.alignItems as string, "flex-end")} className="p-1.5 rounded hover:bg-white/10 text-[var(--ide-text-muted)] hover:text-white transition-colors" title="Align Right">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 4v16M16 12H4M12 8v8" /></svg>
                    </button>
                </div>
            </div>

            {/* Colors */}
            <InspectorSection title="Appearance">
                {/* Background Color */}
                <div className="space-y-2">
                    <PropertyRow label="Fill">
                        <div className="flex items-center gap-2 max-w-[140px]">
                            <button
                                onClick={() => setShowBgPicker(!showBgPicker)}
                                className="w-5 h-5 rounded hover:scale-110 active:scale-95 transition-transform shadow-inner flex-shrink-0"
                                style={{ backgroundColor: bgColor === "transparent" ? "transparent" : bgColor, border: '1px solid rgba(255,255,255,0.2)' }}
                            />
                            <CompactInput
                                value={bgColor}
                                onChange={(e) => onChange("backgroundColor", e.target.value)}
                                placeholder="transparent"
                            />
                        </div>
                    </PropertyRow>
                    {showBgPicker && (
                        <div className="absolute z-50 right-6 mt-1 p-3 bg-[var(--ide-bg-sidebar)] rounded-xl border border-[var(--ide-border)] shadow-2xl animate-fade-in">
                            <div className="flex justify-between items-center mb-3">
                                <span className="text-[11px] font-bold text-[var(--ide-text-secondary)] uppercase">Fill</span>
                                <button onClick={() => setShowBgPicker(false)} className="text-[var(--ide-text-muted)] hover:text-white bg-white/5 rounded-full p-1"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
                            </div>
                            <HexColorPicker
                                color={bgColor === "transparent" ? "#ffffff" : bgColor}
                                onChange={(c) => onChange("backgroundColor", c)}
                                style={{ width: "160px", height: "160px" }}
                            />
                        </div>
                    )}
                </div>

                {/* Text Color */}
                <div className="space-y-2">
                    <PropertyRow label="Text">
                        <div className="flex items-center gap-2 max-w-[140px]">
                            <button
                                onClick={() => setShowColorPicker(!showColorPicker)}
                                className="w-5 h-5 rounded hover:scale-110 active:scale-95 transition-transform shadow-inner flex-shrink-0"
                                style={{ backgroundColor: textColor, border: '1px solid rgba(255,255,255,0.2)' }}
                            />
                            <CompactInput
                                value={textColor}
                                onChange={(e) => onChange("color", e.target.value)}
                                placeholder="#000000"
                            />
                        </div>
                    </PropertyRow>
                    {showColorPicker && (
                        <div className="absolute z-50 right-6 mt-1 p-3 bg-[var(--ide-bg-sidebar)] rounded-xl border border-[var(--ide-border)] shadow-2xl animate-fade-in">
                            <div className="flex justify-between items-center mb-3">
                                <span className="text-[11px] font-bold text-[var(--ide-text-secondary)] uppercase">Text</span>
                                <button onClick={() => setShowColorPicker(false)} className="text-[var(--ide-text-muted)] hover:text-white bg-white/5 rounded-full p-1"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
                            </div>
                            <HexColorPicker
                                color={textColor}
                                onChange={(c) => onChange("color", c)}
                                style={{ width: "160px", height: "160px" }}
                            />
                        </div>
                    )}
                </div>
            </InspectorSection>

            {/* Layout */}
            <InspectorSection title="Layout">
                <div className="flex bg-white/5 rounded-md p-1 mb-3">
                    <button
                        onClick={() => { onChange("display", "flex"); if (!styles.flexDirection) onChange("flexDirection", "column"); }}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-medium rounded transition-colors ${styles.display === "flex" ? "bg-white/10 text-white shadow-sm" : "text-[var(--ide-text-muted)] hover:text-white"}`}
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
                        Stack
                    </button>
                    <button
                        onClick={() => onChange("display", "grid")}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-medium rounded transition-colors ${styles.display === "grid" ? "bg-white/10 text-white shadow-sm" : "text-[var(--ide-text-muted)] hover:text-white"}`}
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                        Grid
                    </button>
                </div>

                <div className={`space-y-3 transition-all duration-300 ${styles.display === 'flex' ? 'opacity-100 max-h-40' : 'opacity-0 max-h-0 overflow-hidden pointer-events-none mb-0'}`}>
                    <div className="flex items-center justify-between pb-1">
                        <span className="text-[11px] text-[var(--ide-text-muted)] font-medium">Direction</span>
                        <div className="flex bg-white/5 rounded p-0.5">
                            <button onClick={() => onChange("flexDirection", "row")} className={`p-1 rounded ${styles.flexDirection === "row" ? "bg-white/10 text-white" : "text-[var(--ide-text-muted)] hover:text-white"}`} title="Row"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg></button>
                            <button onClick={() => onChange("flexDirection", "column")} className={`p-1 rounded ${styles.flexDirection !== "row" ? "bg-white/10 text-white" : "text-[var(--ide-text-muted)] hover:text-white"}`} title="Column"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg></button>
                        </div>
                    </div>
                    <PropertyRow label="Wrap">
                        <CompactSelect value={String(styles.flexWrap ?? "nowrap")} onChange={(e) => onChange("flexWrap", e.target.value)}>
                            <option value="nowrap" className="bg-[var(--ide-bg-sidebar)]">No Wrap</option>
                            <option value="wrap" className="bg-[var(--ide-bg-sidebar)]">Wrap</option>
                        </CompactSelect>
                    </PropertyRow>
                    <PropertyRow label="Gap">
                        <CompactInput value={String(styles.gap ?? "")} onChange={(e) => onChange("gap", e.target.value)} placeholder="0px" />
                    </PropertyRow>
                </div>
            </InspectorSection>

            {/* Size */}
            <InspectorSection title="Size">
                <div className="grid grid-cols-2 gap-3">
                    <PropertyRow label="W"><CompactInput value={String(styles.width ?? "")} onChange={(e) => onChange("width", e.target.value)} placeholder="auto" /></PropertyRow>
                    <PropertyRow label="H"><CompactInput value={String(styles.height ?? "")} onChange={(e) => onChange("height", e.target.value)} placeholder="auto" /></PropertyRow>
                    <PropertyRow label="Min W"><CompactInput value={String(styles.minWidth ?? "")} onChange={(e) => onChange("minWidth", e.target.value)} placeholder="0" /></PropertyRow>
                    <PropertyRow label="Min H"><CompactInput value={String(styles.minHeight ?? "")} onChange={(e) => onChange("minHeight", e.target.value)} placeholder="0" /></PropertyRow>
                </div>
            </InspectorSection>

            {/* Spacing */}
            <InspectorSection title="Spacing">
                <div className="grid grid-cols-2 gap-3">
                    <PropertyRow label="Padding"><CompactInput value={String(styles.padding ?? "")} onChange={(e) => onChange("padding", e.target.value)} placeholder="0px" /></PropertyRow>
                    <PropertyRow label="Margin"><CompactInput value={String(styles.margin ?? "")} onChange={(e) => onChange("margin", e.target.value)} placeholder="0px" /></PropertyRow>
                </div>
            </InspectorSection>

            {/* Border */}
            <InspectorSection title="Border">
                <div className="grid grid-cols-2 gap-3">
                    <PropertyRow label="Radius"><CompactInput value={String(styles.borderRadius ?? "")} onChange={(e) => onChange("borderRadius", e.target.value)} placeholder="0px" /></PropertyRow>
                    <PropertyRow label="Width"><CompactInput value={String(styles.borderWidth ?? "")} onChange={(e) => onChange("borderWidth", e.target.value)} placeholder="0px" /></PropertyRow>
                </div>
            </InspectorSection>

            {/* Typography */}
            <InspectorSection title="Typography">
                <div className="grid grid-cols-2 gap-3">
                    <PropertyRow label="Size"><CompactInput value={String(styles.fontSize ?? "")} onChange={(e) => onChange("fontSize", e.target.value)} placeholder="14px" /></PropertyRow>
                    <PropertyRow label="Weight">
                        <CompactSelect value={String(styles.fontWeight ?? "")} onChange={(e) => onChange("fontWeight", e.target.value)}>
                            <option value="" className="bg-[var(--ide-bg-sidebar)]">Default</option>
                            {["300", "400", "500", "600", "700", "800"].map((w) => (
                                <option key={w} value={w} className="bg-[var(--ide-bg-sidebar)]">{w}</option>
                            ))}
                        </CompactSelect>
                    </PropertyRow>
                </div>
            </InspectorSection>
        </div>
    );
};

/* ═══════════════════  Events Panel  ═══════════════ */

const BLOCK_EVENTS = [
    "onClick", "onDoubleClick", "onChange", "onSubmit",
    "onFocus", "onBlur", "onMouseEnter", "onMouseLeave", "onKeyDown",
];
const BINDING_TYPES = ["variable", "api", "state", "prop"];

const EventsPanel: React.FC<{
    blockType: string;
    eventHandlers: Array<{ event: string; logic_flow_id: string }>;
    bindings: Record<string, { type: string; value: unknown }>;
    properties: Record<string, unknown>;
    setProp: (updater: (props: CraftBlockProps) => void) => void;
}> = ({ eventHandlers, bindings, properties, setProp }) => {
    const { project } = useProjectStore();
    const [newEvent, setNewEvent] = useState("");
    const [newBindingProp, setNewBindingProp] = useState("");

    const logicFlows = project?.logic_flows.filter((lf) => !lf.archived) || [];
    const variables = project?.variables.filter((v) => !v.archived) || [];

    const usedEvents = eventHandlers.map((h) => h.event);
    const availableEvents = BLOCK_EVENTS.filter((e) => !usedEvents.includes(e));

    const handleAddEvent = (eventName: string) => {
        if (!eventName) return;
        setProp((p: CraftBlockProps) => {
            p.eventHandlers = [...(p.eventHandlers || []), { event: eventName, logic_flow_id: "" }];
        });
        setNewEvent("");
    };

    const handleRemoveEvent = (eventName: string) => {
        setProp((p: CraftBlockProps) => {
            p.eventHandlers = (p.eventHandlers || []).filter((h) => h.event !== eventName);
        });
    };

    const handleEventFlowChange = (eventName: string, flowId: string) => {
        setProp((p: CraftBlockProps) => {
            p.eventHandlers = (p.eventHandlers || []).map((h) =>
                h.event === eventName ? { ...h, logic_flow_id: flowId } : h,
            );
        });
    };

    const handleAddBinding = (propName: string) => {
        if (!propName) return;
        setProp((p: CraftBlockProps) => {
            p.bindings = { ...p.bindings, [propName]: { type: "variable", value: "" } };
        });
        setNewBindingProp("");
    };

    const handleRemoveBinding = (propName: string) => {
        setProp((p: CraftBlockProps) => {
            const next = { ...p.bindings };
            delete next[propName];
            p.bindings = next;
        });
    };

    const handleBindingChange = (propName: string, type: string, value: unknown) => {
        setProp((p: CraftBlockProps) => {
            p.bindings = { ...p.bindings, [propName]: { type, value } };
        });
    };

    const blockProps = Object.keys(properties || {});
    const unboundProps = blockProps.filter((p) => !bindings[p]);

    return (
        <div className="p-4 space-y-6">
            {/* Event Handlers */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--ide-text-secondary)]">
                        Event Handlers
                    </h3>
                </div>
                {eventHandlers.length === 0 && (
                    <p className="text-[10px] text-[var(--ide-text-muted)] italic mb-2">
                        No event handlers configured
                    </p>
                )}
                {eventHandlers.map((handler) => (
                    <div key={handler.event} className="mb-2 p-2 bg-[var(--ide-bg-elevated)] rounded border border-[var(--ide-border)] group">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-mono text-indigo-400">{handler.event}</span>
                            <button
                                onClick={() => handleRemoveEvent(handler.event)}
                                className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 text-xs transition-opacity"
                            >
                                &times;
                            </button>
                        </div>
                        <select
                            value={handler.logic_flow_id || ""}
                            onChange={(e) => handleEventFlowChange(handler.event, e.target.value)}
                            className="w-full px-2 py-1 text-xs bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded text-[var(--ide-text)] focus:outline-none focus:border-[var(--ide-primary)]"
                        >
                            <option value="">-- Select logic flow --</option>
                            {logicFlows.map((lf) => (
                                <option key={lf.id} value={lf.id}>{lf.name}</option>
                            ))}
                        </select>
                    </div>
                ))}
                {availableEvents.length > 0 && (
                    <div className="flex gap-1 mt-2">
                        <select
                            value={newEvent}
                            onChange={(e) => setNewEvent(e.target.value)}
                            className="flex-1 px-2 py-1 text-xs bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded text-[var(--ide-text-muted)] focus:outline-none"
                        >
                            <option value="">+ Add event...</option>
                            {availableEvents.map((e) => (
                                <option key={e} value={e}>{e}</option>
                            ))}
                        </select>
                        {newEvent && (
                            <button
                                onClick={() => handleAddEvent(newEvent)}
                                className="px-2 py-1 text-xs bg-[var(--ide-primary)] text-white rounded hover:bg-[var(--ide-primary-hover)]"
                            >
                                Add
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Data Bindings */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--ide-text-secondary)]">
                        Data Bindings
                    </h3>
                </div>
                {Object.keys(bindings).length === 0 && (
                    <p className="text-[10px] text-[var(--ide-text-muted)] italic mb-2">
                        No data bindings configured
                    </p>
                )}
                {Object.entries(bindings).map(([propName, binding]) => (
                    <div key={propName} className="mb-2 p-2 bg-[var(--ide-bg-elevated)] rounded border border-[var(--ide-border)] group">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-mono text-green-400">{propName}</span>
                            <button
                                onClick={() => handleRemoveBinding(propName)}
                                className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 text-xs transition-opacity"
                            >
                                &times;
                            </button>
                        </div>
                        <div className="flex gap-1">
                            <select
                                value={binding.type}
                                onChange={(e) => handleBindingChange(propName, e.target.value, binding.value)}
                                className="w-20 px-1 py-1 text-[10px] bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded text-[var(--ide-text-muted)] focus:outline-none"
                            >
                                {BINDING_TYPES.map((t) => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                            {binding.type === "variable" ? (
                                <select
                                    value={String(binding.value || "")}
                                    onChange={(e) => handleBindingChange(propName, binding.type, e.target.value)}
                                    className="flex-1 px-2 py-1 text-xs bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded text-[var(--ide-text)] focus:outline-none"
                                >
                                    <option value="">-- Select variable --</option>
                                    {variables.map((v) => (
                                        <option key={v.id} value={v.id}>{v.name}</option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    value={String(binding.value || "")}
                                    onChange={(e) => handleBindingChange(propName, binding.type, e.target.value)}
                                    placeholder="value / path"
                                    className="flex-1 px-2 py-1 text-xs bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded text-[var(--ide-text)] focus:outline-none focus:border-[var(--ide-primary)]"
                                />
                            )}
                        </div>
                    </div>
                ))}
                {unboundProps.length > 0 && (
                    <div className="flex gap-1 mt-2">
                        <select
                            value={newBindingProp}
                            onChange={(e) => setNewBindingProp(e.target.value)}
                            className="flex-1 px-2 py-1 text-xs bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded text-[var(--ide-text-muted)] focus:outline-none"
                        >
                            <option value="">+ Bind property...</option>
                            {unboundProps.map((p) => (
                                <option key={p} value={p}>{p}</option>
                            ))}
                        </select>
                        {newBindingProp && (
                            <button
                                onClick={() => handleAddBinding(newBindingProp)}
                                className="px-2 py-1 text-xs bg-[var(--ide-primary)] text-white rounded hover:bg-[var(--ide-primary-hover)]"
                            >
                                Bind
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Inspector;
