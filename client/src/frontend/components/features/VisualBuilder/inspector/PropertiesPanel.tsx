import React from "react";
import { CompactInput, CompactSelect, InspectorSection, PropertyRow } from "./ui";

interface PropertiesPanelProps {
    blockType: string;
    properties: Record<string, unknown>;
    text?: string;
    onChange: (prop: string, value: unknown) => void;
}

const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ blockType, properties, text, onChange }) => {
    return (
        <div className="p-4 space-y-6">
            <InspectorSection title="Settings">
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

export default PropertiesPanel;
