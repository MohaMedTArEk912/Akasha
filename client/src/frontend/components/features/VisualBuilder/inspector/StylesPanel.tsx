import React, { useState } from "react";
import { HexColorPicker } from "react-colorful";
import { CompactInput, CompactSelect, InspectorSection, PropertyRow } from "./ui";

interface StylesPanelProps {
    styles: Record<string, string | number | boolean>;
    onChange: (style: string, value: string | number) => void;
}

const StylesPanel: React.FC<StylesPanelProps> = ({ styles, onChange }) => {
    const [showBgPicker, setShowBgPicker] = useState(false);
    const [showColorPicker, setShowColorPicker] = useState(false);

    const bgColor = String(styles.backgroundColor ?? "transparent");
    const textColor = String(styles.color ?? "#000000");

    const setAlignment = (align: string, justify: string) => {
        onChange("display", "flex");
        if (!styles.flexDirection) onChange("flexDirection", "column");
        onChange("alignItems", align);
        onChange("justifyContent", justify);
    };

    return (
        <div className="p-4 space-y-2">
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

            <InspectorSection title="Appearance">
                <div className="space-y-2">
                    <PropertyRow label="Fill">
                        <div className="flex items-center gap-2 max-w-[140px]">
                            <button
                                onClick={() => setShowBgPicker(!showBgPicker)}
                                className="w-5 h-5 rounded hover:scale-110 active:scale-95 transition-transform shadow-inner flex-shrink-0"
                                style={{ backgroundColor: bgColor === "transparent" ? "transparent" : bgColor, border: "1px solid rgba(255,255,255,0.2)" }}
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

                <div className="space-y-2">
                    <PropertyRow label="Text">
                        <div className="flex items-center gap-2 max-w-[140px]">
                            <button
                                onClick={() => setShowColorPicker(!showColorPicker)}
                                className="w-5 h-5 rounded hover:scale-110 active:scale-95 transition-transform shadow-inner flex-shrink-0"
                                style={{ backgroundColor: textColor, border: "1px solid rgba(255,255,255,0.2)" }}
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

                <div className={`space-y-3 transition-all duration-300 ${styles.display === "flex" ? "opacity-100 max-h-40" : "opacity-0 max-h-0 overflow-hidden pointer-events-none mb-0"}`}>
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

            <InspectorSection title="Size">
                <div className="grid grid-cols-2 gap-3">
                    <PropertyRow label="W"><CompactInput value={String(styles.width ?? "")} onChange={(e) => onChange("width", e.target.value)} placeholder="auto" /></PropertyRow>
                    <PropertyRow label="H"><CompactInput value={String(styles.height ?? "")} onChange={(e) => onChange("height", e.target.value)} placeholder="auto" /></PropertyRow>
                    <PropertyRow label="Min W"><CompactInput value={String(styles.minWidth ?? "")} onChange={(e) => onChange("minWidth", e.target.value)} placeholder="0" /></PropertyRow>
                    <PropertyRow label="Min H"><CompactInput value={String(styles.minHeight ?? "")} onChange={(e) => onChange("minHeight", e.target.value)} placeholder="0" /></PropertyRow>
                </div>
            </InspectorSection>

            <InspectorSection title="Spacing">
                <div className="grid grid-cols-2 gap-3">
                    <PropertyRow label="Padding"><CompactInput value={String(styles.padding ?? "")} onChange={(e) => onChange("padding", e.target.value)} placeholder="0px" /></PropertyRow>
                    <PropertyRow label="Margin"><CompactInput value={String(styles.margin ?? "")} onChange={(e) => onChange("margin", e.target.value)} placeholder="0px" /></PropertyRow>
                </div>
            </InspectorSection>

            <InspectorSection title="Border">
                <div className="grid grid-cols-2 gap-3">
                    <PropertyRow label="Radius"><CompactInput value={String(styles.borderRadius ?? "")} onChange={(e) => onChange("borderRadius", e.target.value)} placeholder="0px" /></PropertyRow>
                    <PropertyRow label="Width"><CompactInput value={String(styles.borderWidth ?? "")} onChange={(e) => onChange("borderWidth", e.target.value)} placeholder="0px" /></PropertyRow>
                </div>
            </InspectorSection>

            <InspectorSection title="Effects">
                <PropertyRow label="Opacity">
                    <div className="flex items-center gap-2 w-full">
                        <input
                            type="range"
                            min="0" max="1" step="0.01"
                            value={Number(styles.opacity ?? 1)}
                            onChange={(e) => onChange("opacity", e.target.value)}
                            className="flex-1 h-1 accent-indigo-500 cursor-pointer"
                        />
                        <span className="text-[10px] text-white/40 font-mono w-8 text-right">{Math.round(Number(styles.opacity ?? 1) * 100)}%</span>
                    </div>
                </PropertyRow>
                <PropertyRow label="Z-Index">
                    <CompactInput
                        type="number"
                        value={String(styles.zIndex ?? "")}
                        onChange={(e) => onChange("zIndex", e.target.value ? Number(e.target.value) : "")}
                        placeholder="auto"
                    />
                </PropertyRow>
            </InspectorSection>

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

export default StylesPanel;
