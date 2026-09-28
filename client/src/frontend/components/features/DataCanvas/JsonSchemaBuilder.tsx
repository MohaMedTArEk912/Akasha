/**
 * JSON Schema Builder Component
 *
 * Visual builder for constructing JSON Schemas (draft-07).
 * Features:
 * - Add/remove/reorder fields with type selection
 * - Nested object support (recursive)
 * - Required/Array toggles per field
 * - Advanced options: title, description, example, min/max, pattern, enum
 * - Real-time JSON Schema preview with syntax highlighting
 * - Import from project data models
 * - Apply schema to API endpoint request/response bodies
 * - Save/Load schemas to localStorage
 */

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useProjectStore } from "../../../hooks/useProjectStore";
import { updateEndpoint } from "../../../stores/projectStore";
import { useToast } from "../../../context/ToastContext";

/* ━━━ Types ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

type FieldType = "string" | "integer" | "number" | "boolean" | "object" | "array" | "enum" | "date" | "datetime";

interface SchemaField {
    id: string;
    name: string;
    type: FieldType;
    required: boolean;
    isArray: boolean;
    title?: string;
    description?: string;
    example?: string;
    minimum?: number;
    maximum?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    defaultValue?: string;
    enumValues?: string[];
    children?: SchemaField[]; // for object types
    arrayItemType?: FieldType; // for array types
}

interface SavedSchema {
    name: string;
    fields: SchemaField[];
    savedAt: string;
}

/* ━━━ Constants ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const FIELD_TYPES: { value: FieldType; label: string; icon: string; color: string }[] = [
    { value: "string", label: "String", icon: "T", color: "text-white" },
    { value: "integer", label: "Integer", icon: "#", color: "text-white/80" },
    { value: "number", label: "Float", icon: ".", color: "text-white/80" },
    { value: "boolean", label: "Boolean", icon: "B", color: "text-white/60" },
    { value: "object", label: "Object", icon: "{}", color: "text-white/70" },
    { value: "array", label: "Array", icon: "[]", color: "text-white/70" },
    { value: "enum", label: "Enum", icon: "E", color: "text-white/50" },
    { value: "date", label: "Date", icon: "D", color: "text-white/80" },
    { value: "datetime", label: "DateTime", icon: "DT", color: "text-white/80" },
];

const STORAGE_KEY = "akasha_json_schemas";

let fieldIdCounter = 0;
function newFieldId(): string {
    return `f_${Date.now()}_${++fieldIdCounter}`;
}

function createEmptyField(): SchemaField {
    return { id: newFieldId(), name: "", type: "string", required: true, isArray: false };
}

/* ━━━ Schema Generation ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function fieldToJsonSchema(field: SchemaField): Record<string, unknown> {
    let schema: Record<string, unknown> = {};

    const mapType = (type: FieldType): Record<string, unknown> => {
        switch (type) {
            case "string": return { type: "string" };
            case "integer": return { type: "integer" };
            case "number": return { type: "number" };
            case "boolean": return { type: "boolean" };
            case "date": return { type: "string", format: "date" };
            case "datetime": return { type: "string", format: "date-time" };
            case "enum": return { type: "string", enum: field.enumValues?.filter(v => v.trim()) || [] };
            case "object": {
                const props: Record<string, unknown> = {};
                const req: string[] = [];
                (field.children || []).forEach(child => {
                    if (child.name.trim()) {
                        props[child.name] = fieldToJsonSchema(child);
                        if (child.required) req.push(child.name);
                    }
                });
                const obj: Record<string, unknown> = { type: "object", properties: props };
                if (req.length > 0) obj.required = req;
                return obj;
            }
            case "array": {
                const itemSchema = field.children && field.children.length > 0
                    ? (() => {
                        const props: Record<string, unknown> = {};
                        const req: string[] = [];
                        field.children.forEach(child => {
                            if (child.name.trim()) {
                                props[child.name] = fieldToJsonSchema(child);
                                if (child.required) req.push(child.name);
                            }
                        });
                        const obj: Record<string, unknown> = { type: "object", properties: props };
                        if (req.length > 0) obj.required = req;
                        return obj;
                    })()
                    : { type: field.arrayItemType || "string" };
                return { type: "array", items: itemSchema };
            }
            default: return { type: "string" };
        }
    };

    schema = mapType(field.type);

    if (field.isArray && field.type !== "array") {
        schema = { type: "array", items: schema };
    }

    // Advanced options
    if (field.title) schema.title = field.title;
    if (field.description) schema.description = field.description;
    if (field.example) {
        try { schema.examples = [JSON.parse(field.example)]; } catch { schema.examples = [field.example]; }
    }
    if (field.minimum !== undefined && field.minimum !== null) schema.minimum = field.minimum;
    if (field.maximum !== undefined && field.maximum !== null) schema.maximum = field.maximum;
    if (field.minLength !== undefined && field.minLength !== null) (schema as any).minLength = field.minLength;
    if (field.maxLength !== undefined && field.maxLength !== null) (schema as any).maxLength = field.maxLength;
    if (field.pattern) schema.pattern = field.pattern;
    if (field.defaultValue) {
        try { schema.default = JSON.parse(field.defaultValue); } catch { schema.default = field.defaultValue; }
    }

    return schema;
}

function fieldsToJsonSchema(fields: SchemaField[]): Record<string, unknown> {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    fields.forEach(field => {
        if (field.name.trim()) {
            properties[field.name] = fieldToJsonSchema(field);
            if (field.required) required.push(field.name);
        }
    });

    const schema: Record<string, unknown> = {
        $schema: "http://json-schema.org/draft-07/schema#",
        type: "object",
        properties,
    };
    if (required.length > 0) schema.required = required;

    return schema;
}

/* ━━━ JSON Syntax Highlighter ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const JsonHighlight: React.FC<{ json: string }> = ({ json }) => {
    const highlighted = useMemo(() => {
        return json.replace(
            /("(?:\\.|[^"\\])*")\s*:/g,
            '<span class="text-neutral-950 dark:text-white font-bold">$1</span>:'
        ).replace(
            /:\s*("(?:\\.|[^"\\])*")/g,
            ': <span class="text-emerald-700 dark:text-emerald-300 font-medium">$1</span>'
        ).replace(
            /:\s*(\d+\.?\d*)/g,
            ': <span class="text-blue-700 dark:text-blue-300 font-mono font-medium">$1</span>'
        ).replace(
            /:\s*(true|false)/g,
            ': <span class="text-purple-700 dark:text-purple-300 font-bold">$1</span>'
        ).replace(
            /:\s*(null)/g,
            ': <span class="text-neutral-500 dark:text-neutral-400 italic">$1</span>'
        );
    }, [json]);

    return <pre className="text-xs font-mono leading-relaxed whitespace-pre-wrap break-words select-text text-neutral-800 dark:text-neutral-200" dangerouslySetInnerHTML={{ __html: highlighted }} />;
};

/* ━━━ Sub-Components ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/* Toolbar Action Button */
const ToolbarButton: React.FC<{
    icon?: string;
    label: string;
    onClick: () => void;
    danger?: boolean;
    accent?: boolean;
}> = ({ label, onClick, danger, accent }) => (
    <button
        onClick={onClick}
        title={label}
        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold tracking-wider uppercase transition-all ${danger
            ? "text-red-500 hover:bg-red-500/10 border border-red-500/20"
            : accent
                ? "text-neutral-900 dark:text-white bg-black/[0.05] dark:bg-white/10 hover:bg-black/[0.08] dark:hover:bg-white/15 border border-black/[0.08] dark:border-white/10"
                : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/5 border border-transparent"
            }`}
    >
        {label}
    </button>
);

const ToolbarDivider: React.FC = () => <div className="w-px h-5 bg-black/[0.08] dark:bg-white/10 mx-0.5" />;

/* Toggle Switch */
const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string; size?: "sm" | "xs" }> = ({ checked, onChange, label, size = "sm" }) => (
    <label className="flex items-center gap-1.5 cursor-pointer select-none group">
        <div
            className={`relative rounded-full transition-all duration-200 ${checked ? "bg-neutral-900 dark:bg-white" : "bg-black/10 dark:bg-white/10"} ${size === "xs" ? "w-7 h-3.5" : "w-8 h-4"}`}
            onClick={() => onChange(!checked)}
        >
            <div className={`absolute top-0.5 rounded-full bg-white dark:bg-black transition-all duration-200 shadow-sm ${checked ? (size === "xs" ? "left-3.5" : "left-4") : "left-0.5"} ${size === "xs" ? "w-2.5 h-2.5" : "w-3 h-3"}`} />
        </div>
        <span className={`font-medium text-[var(--ide-text-muted)] group-hover:text-[var(--ide-text)] transition-colors ${size === "xs" ? "text-[9px]" : "text-[10px]"}`}>{label}</span>
    </label>
);

/* Collapsible Section */
const Collapsible: React.FC<{ title: string; children: React.ReactNode; defaultOpen?: boolean }> = ({ title, children, defaultOpen = false }) => {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="border-t border-[var(--ide-border)]/30 mt-2 pt-2">
            <button onClick={() => setOpen(!open)} className="flex items-center gap-1.5 text-[10px] font-semibold text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-colors w-full">
                <span className="text-[9px] font-bold">{open ? "▼" : "▶"}</span>
                {title}
            </button>
            {open && <div className="mt-2 space-y-2">{children}</div>}
        </div>
    );
};

/* Small labeled input */
const MiniInput: React.FC<{ label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }> = ({ label, value, onChange, placeholder, type = "text" }) => (
    <div className="flex-1 min-w-0">
        <label className="text-[9px] uppercase font-bold text-[var(--ide-text-muted)]/60 tracking-wider block mb-0.5">{label}</label>
        <input
            type={type}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full bg-[var(--ide-bg)] border border-[var(--ide-border)]/40 rounded px-2 py-1 text-[10px] font-mono text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)]/30 focus:outline-none focus:border-white/40 transition-all"
        />
    </div>
);

/* ━━━ Field Row Component ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

interface FieldRowProps {
    field: SchemaField;
    depth: number;
    onUpdate: (id: string, updates: Partial<SchemaField>) => void;
    onRemove: (id: string) => void;
    onAddChild: (parentId: string) => void;
}

const FieldRowComponent: React.FC<FieldRowProps> = ({ field, depth, onUpdate, onRemove, onAddChild }) => {
    const typeInfo = FIELD_TYPES.find(t => t.value === field.type) || FIELD_TYPES[0];
    const hasChildren = field.type === "object" || field.type === "array";
    const [collapsed, setCollapsed] = useState(false);

    return (
        <div className="jsb-field-enter" style={{ animationDelay: `${depth * 30}ms` }}>
            {/* Main Field Row */}
            <div
                className={`flex items-center gap-2 px-3 py-2 group rounded-lg transition-all hover:bg-white/[0.02] ${depth > 0 ? "ml-" + Math.min(depth * 6, 18) : ""}`}
                style={{ marginLeft: depth > 0 ? `${depth * 24}px` : undefined }}
            >
                {/* Drag Handle */}
                <span className="opacity-0 group-hover:opacity-40 transition-opacity cursor-grab text-[10px] font-mono text-[var(--ide-text-muted)] select-none">
                    ::
                </span>

                {/* Collapse toggle for nested */}
                {hasChildren ? (
                    <button onClick={() => setCollapsed(!collapsed)} className="text-[10px] font-bold text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-colors px-0.5">
                        {collapsed ? "▶" : "▼"}
                    </button>
                ) : <div className="w-3" />}

                {/* Type Icon */}
                <span className={`text-[10px] font-bold font-mono w-5 h-5 flex items-center justify-center rounded ${typeInfo.color} bg-black/[0.04] dark:bg-white/[0.04] border border-black/[0.08] dark:border-white/[0.06]`}>
                    {typeInfo.icon}
                </span>

                {/* Name Input */}
                <input
                    type="text"
                    value={field.name}
                    onChange={e => onUpdate(field.id, { name: e.target.value.replace(/[^a-zA-Z0-9_-]/g, '') })}
                    placeholder="fieldName"
                    className="flex-1 min-w-0 bg-transparent border-b border-transparent hover:border-[var(--ide-border)]/40 focus:border-neutral-900 dark:focus:border-white/60 px-1 py-0.5 text-xs font-mono text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)]/30 focus:outline-none transition-all"
                />

                {/* Type Selector */}
                <select
                    value={field.type}
                    onChange={e => {
                        const newType = e.target.value as FieldType;
                        const updates: Partial<SchemaField> = { type: newType };
                        if (newType === "object" || newType === "array") {
                            updates.children = field.children?.length ? field.children : [];
                        }
                        if (newType === "enum") {
                            updates.enumValues = field.enumValues?.length ? field.enumValues : [""];
                        }
                        onUpdate(field.id, updates);
                    }}
                    className={`bg-[var(--ide-bg)] border border-[var(--ide-border)]/40 rounded px-2 py-1 text-[10px] font-mono font-bold ${typeInfo.color} focus:outline-none focus:border-white/50 cursor-pointer transition-all`}
                >
                    {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>

                {/* Toggles */}
                <Toggle checked={field.isArray} onChange={v => onUpdate(field.id, { isArray: v })} label="Array" size="xs" />
                <Toggle checked={field.required} onChange={v => onUpdate(field.id, { required: v })} label="Required" size="xs" />

                {/* Delete */}
                <button
                    onClick={() => onRemove(field.id)}
                    className="opacity-0 group-hover:opacity-100 px-1.5 py-0.5 text-[10px] font-bold text-red-500 hover:bg-red-500/10 rounded transition-all"
                    title="Remove field"
                >
                    DEL
                </button>
            </div>

            {/* Enum Values Editor */}
            {field.type === "enum" && (
                <div className="px-3 py-2" style={{ marginLeft: `${(depth + 1) * 24 + 20}px` }}>
                    <label className="text-[9px] uppercase font-bold text-[var(--ide-text-muted)]/60 tracking-wider block mb-1">Enum Values</label>
                    <div className="flex flex-wrap gap-1.5">
                        {(field.enumValues || [""]).map((val, i) => (
                            <div key={i} className="flex items-center gap-1">
                                <input
                                    type="text"
                                    value={val}
                                    onChange={e => {
                                        const updated = [...(field.enumValues || [""])];
                                        updated[i] = e.target.value;
                                        onUpdate(field.id, { enumValues: updated });
                                    }}
                                    placeholder={`value${i + 1}`}
                                    className="w-24 bg-[var(--ide-bg)] border border-[var(--ide-border)]/40 rounded px-2 py-0.5 text-[10px] font-mono text-[var(--ide-text)] focus:outline-none focus:border-white/50 transition-all"
                                />
                                <button
                                    onClick={() => {
                                        const updated = (field.enumValues || [""]).filter((_, idx) => idx !== i);
                                        onUpdate(field.id, { enumValues: updated.length > 0 ? updated : [""] });
                                    }}
                                    className="text-[10px] font-bold text-neutral-400 hover:text-red-500 transition-colors px-1"
                                >
                                    ✕
                                </button>
                            </div>
                        ))}
                        <button
                            onClick={() => onUpdate(field.id, { enumValues: [...(field.enumValues || [""]), ""] })}
                            className="text-[10px] text-neutral-900 dark:text-white font-bold transition-colors"
                        >+ ADD</button>
                    </div>
                </div>
            )}

            {/* Advanced Options */}
            <div style={{ marginLeft: `${(depth + 1) * 24 + 20}px` }} className="px-3">
                <Collapsible title="Validation & Metadata">
                    <div className="space-y-2 py-1">
                        <div className="flex gap-2">
                            <MiniInput label="Title" value={field.title || ""} onChange={v => onUpdate(field.id, { title: v || undefined })} placeholder="Human-readable title" />
                            <MiniInput label="Description" value={field.description || ""} onChange={v => onUpdate(field.id, { description: v || undefined })} placeholder="Field description" />
                        </div>
                        <div className="flex gap-2">
                            <MiniInput label="Default" value={field.defaultValue || ""} onChange={v => onUpdate(field.id, { defaultValue: v || undefined })} placeholder="Default value" />
                            <MiniInput label="Example" value={field.example || ""} onChange={v => onUpdate(field.id, { example: v || undefined })} placeholder='e.g. "value"' />
                        </div>
                        {(field.type === "string" || field.type === "date" || field.type === "datetime") && (
                            <div className="flex gap-2">
                                <MiniInput label="Min Length" value={field.minLength?.toString() || ""} onChange={v => onUpdate(field.id, { minLength: v ? parseInt(v) : undefined })} placeholder="0" type="number" />
                                <MiniInput label="Max Length" value={field.maxLength?.toString() || ""} onChange={v => onUpdate(field.id, { maxLength: v ? parseInt(v) : undefined })} placeholder="255" type="number" />
                                <MiniInput label="Pattern (Regex)" value={field.pattern || ""} onChange={v => onUpdate(field.id, { pattern: v || undefined })} placeholder="^[a-z]+$" />
                            </div>
                        )}
                        {(field.type === "number" || field.type === "integer") && (
                            <div className="flex gap-2">
                                <MiniInput label="Minimum" value={field.minimum?.toString() || ""} onChange={v => onUpdate(field.id, { minimum: v ? parseFloat(v) : undefined })} placeholder="min" type="number" />
                                <MiniInput label="Maximum" value={field.maximum?.toString() || ""} onChange={v => onUpdate(field.id, { maximum: v ? parseFloat(v) : undefined })} placeholder="max" type="number" />
                            </div>
                        )}
                    </div>
                </Collapsible>
            </div>

            {/* Nested Children (for objects/arrays) */}
            {hasChildren && !collapsed && (
                <div className="border-l border-black/[0.08] dark:border-white/[0.04] mt-0.5" style={{ marginLeft: `${depth * 24 + 18}px` }}>
                    {(field.children || []).map(child => (
                        <FieldRowComponent
                            key={child.id}
                            field={child}
                            depth={depth + 1}
                            onUpdate={onUpdate}
                            onRemove={onRemove}
                            onAddChild={onAddChild}
                        />
                    ))}
                    <button
                        onClick={() => onAddChild(field.id)}
                        className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-700 dark:text-white/70 hover:text-neutral-950 dark:hover:text-white transition-colors py-1.5 px-3"
                        style={{ marginLeft: `${(depth + 1) * 24 + 20}px` }}
                    >
                        + ADD PROPERTY TO {field.name || "OBJECT"}
                    </button>
                </div>
            )}
        </div>
    );
};

/* ━━━ Save/Load Modal ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const SchemaManagerModal: React.FC<{
    isOpen: boolean;
    mode: "save" | "load";
    onClose: () => void;
    onSave?: (name: string) => void;
    onLoad?: (schema: SavedSchema) => void;
    onDelete?: (name: string) => void;
}> = ({ isOpen, mode, onClose, onSave, onLoad, onDelete }) => {
    const [saveName, setSaveName] = useState("");
    const [schemas, setSchemas] = useState<SavedSchema[]>([]);

    useEffect(() => {
        if (isOpen) {
            try {
                const raw = localStorage.getItem(STORAGE_KEY);
                setSchemas(raw ? JSON.parse(raw) : []);
            } catch { setSchemas([]); }
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div className="relative bg-[var(--ide-bg-sidebar)] rounded-xl border border-[var(--ide-border)] shadow-2xl animate-scale-in w-[90%] max-w-lg" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--ide-border)]">
                    <h3 className="text-sm font-bold text-[var(--ide-text)]">{mode === "save" ? "Save Schema" : "Load Schema"}</h3>
                    <button onClick={onClose} className="text-xs font-bold text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-colors px-1">
                        ✕
                    </button>
                </div>
                <div className="p-5">
                    {mode === "save" ? (
                        <div className="space-y-3">
                            <input
                                type="text"
                                value={saveName}
                                onChange={e => setSaveName(e.target.value)}
                                placeholder="Schema name..."
                                className="w-full bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded-lg px-4 py-2.5 text-sm text-[var(--ide-text)] focus:outline-none focus:border-white/50 transition-all"
                                autoFocus
                                onKeyDown={e => { if (e.key === "Enter" && saveName.trim()) { onSave?.(saveName.trim()); onClose(); } }}
                            />
                            <div className="flex justify-end">
                                <button
                                    onClick={() => { if (saveName.trim()) { onSave?.(saveName.trim()); onClose(); } }}
                                    disabled={!saveName.trim()}
                                    className="px-4 py-2 text-sm bg-neutral-900 dark:bg-white text-white dark:text-black rounded-lg font-semibold disabled:opacity-40 transition-all"
                                >Save</button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-1.5 max-h-80 overflow-y-auto custom-scrollbar">
                            {schemas.length === 0 ? (
                                <div className="text-center py-8 text-[var(--ide-text-muted)] text-sm">
                                    <p>No saved schemas yet.</p>
                                </div>
                            ) : schemas.map(s => (
                                <div key={s.name} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors group">
                                    <div className="flex-1 cursor-pointer" onClick={() => { onLoad?.(s); onClose(); }}>
                                        <div className="text-sm font-medium text-[var(--ide-text)]">{s.name}</div>
                                        <div className="text-[10px] text-[var(--ide-text-muted)]">{s.fields.length} fields · Saved {new Date(s.savedAt).toLocaleDateString()}</div>
                                    </div>
                                    <button
                                        onClick={() => { onDelete?.(s.name); setSchemas(prev => prev.filter(x => x.name !== s.name)); }}
                                        className="opacity-0 group-hover:opacity-100 text-[10px] font-bold text-red-500 transition-all px-1.5"
                                    >
                                        DEL
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

/* ━━━ Import/Apply Modals ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const ImportModelModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onImport: (fields: SchemaField[]) => void;
}> = ({ isOpen, onClose, onImport }) => {
    const { project } = useProjectStore();
    const models = (project?.data_models || []).filter(m => !m.archived);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div className="relative bg-[var(--ide-bg-sidebar)] rounded-xl border border-[var(--ide-border)] shadow-2xl animate-scale-in w-[90%] max-w-md" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--ide-border)]">
                    <h3 className="text-sm font-bold text-[var(--ide-text)]">Import from Data Model</h3>
                    <button onClick={onClose} className="text-xs font-bold text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-colors px-1">
                        ✕
                    </button>
                </div>
                <div className="p-5 space-y-1.5 max-h-80 overflow-y-auto custom-scrollbar">
                    {models.length === 0 ? (
                        <div className="text-center py-8 text-[var(--ide-text-muted)] text-sm">
                            <p>No data models defined yet.</p>
                            <p className="text-[10px] mt-1 opacity-60">Create models in the Schema tab first.</p>
                        </div>
                    ) : models.map(model => (
                        <button
                            key={model.id}
                            onClick={() => {
                                const fields: SchemaField[] = model.fields.map(f => ({
                                    id: newFieldId(),
                                    name: f.name,
                                    type: mapModelFieldType(f.field_type),
                                    required: f.required,
                                    isArray: false,
                                    description: f.description,
                                }));
                                onImport(fields);
                                onClose();
                            }}
                            className="w-full text-left px-4 py-3 rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                                    MDL
                                </span>
                                <span className="font-semibold text-sm text-[var(--ide-text)]">{model.name}</span>
                                <span className="text-[10px] text-[var(--ide-text-muted)] ml-auto">{model.fields.length} fields</span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

const ApplyToApiModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    schema: Record<string, unknown>;
}> = ({ isOpen, onClose, schema }) => {
    const { project } = useProjectStore();
    const toast = useToast();
    const apis = (project?.apis || []).filter(a => !a.archived);
    const [target, setTarget] = useState<"request" | "response">("request");

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div className="relative bg-[var(--ide-bg-sidebar)] rounded-xl border border-[var(--ide-border)] shadow-2xl animate-scale-in w-[90%] max-w-md" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--ide-border)]">
                    <h3 className="text-sm font-bold text-[var(--ide-text)]">Apply Schema to API Endpoint</h3>
                    <button onClick={onClose} className="text-xs font-bold text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-colors px-1">
                        ✕
                    </button>
                </div>
                <div className="p-5">
                    {/* Target selector */}
                    <div className="flex gap-2 mb-4">
                        {(["request", "response"] as const).map(t => (
                            <button
                                key={t}
                                onClick={() => setTarget(t)}
                                className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-bold uppercase border transition-all ${target === t
                                    ? "bg-white/10 text-white border-white/20"
                                    : "text-[var(--ide-text-muted)] border-[var(--ide-border)] hover:text-[var(--ide-text)]"
                                    }`}
                            >{t} body</button>
                        ))}
                    </div>

                    <div className="space-y-1.5 max-h-60 overflow-y-auto custom-scrollbar">
                        {apis.length === 0 ? (
                            <div className="text-center py-8 text-[var(--ide-text-muted)] text-sm">
                                <p>No API endpoints defined.</p>
                            </div>
                        ) : apis.map(api => (
                            <button
                                key={api.id}
                                onClick={async () => {
                                    try {
                                        // Convert JSON Schema fields to DataShape
                                        const dataShape = jsonSchemaToDataShape(schema);
                                        const updates = target === "request"
                                            ? { request_body: dataShape }
                                            : { response_body: dataShape };
                                        await updateEndpoint(api.id, updates);
                                        toast.success(`Schema applied to ${api.method} ${api.path} (${target} body)`);
                                        onClose();
                                    } catch (err) {
                                        toast.error(`Failed to apply schema: ${err}`);
                                    }
                                }}
                                className="w-full text-left px-4 py-2.5 rounded-lg hover:bg-white/[0.04] transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold font-mono text-white/40">
                                        {api.method}
                                    </span>
                                    <span className="text-xs font-mono text-[var(--ide-text)]">{api.path}</span>
                                    <span className="text-[10px] text-[var(--ide-text-muted)] ml-auto">{api.name}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

/* ━━━ Helpers ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function mapModelFieldType(type: string): FieldType {
    switch (type.toLowerCase()) {
        case "string": case "text": case "uuid": return "string";
        case "int": case "integer": return "integer";
        case "float": case "double": case "decimal": case "number": return "number";
        case "boolean": case "bool": return "boolean";
        case "datetime": case "timestamp": return "datetime";
        case "date": return "date";
        default: return "string";
    }
}

function jsonSchemaToDataShape(schema: Record<string, unknown>): import("../../../types/api").DataShape {
    const properties = (schema.properties || {}) as Record<string, Record<string, unknown>>;
    const fields = Object.entries(properties).map(([name, prop]) => {
        const fieldType = mapJsonSchemaTypeToShapeType(prop.type as string);
        return {
            name,
            field_type: fieldType as any,
            required: ((schema.required || []) as string[]).includes(name),
        };
    });
    return { shape_type: "object", fields };
}

function mapJsonSchemaTypeToShapeType(type: string): string {
    switch (type) {
        case "string": return "string";
        case "integer": case "number": return "number";
        case "boolean": return "boolean";
        case "object": return "object";
        case "array": return "array";
        default: return "string";
    }
}

/* ━━━ Main Component ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const JsonSchemaBuilder: React.FC = () => {
    const toast = useToast();
    const [fields, setFields] = useState<SchemaField[]>([]);
    const [schemaManagerOpen, setSchemaManagerOpen] = useState<"save" | "load" | null>(null);
    const [importModelOpen, setImportModelOpen] = useState(false);
    const [applyApiOpen, setApplyApiOpen] = useState(false);
    const [previewCollapsed, setPreviewCollapsed] = useState(false);

    // Generate JSON Schema in real-time
    const jsonSchema = useMemo(() => fieldsToJsonSchema(fields), [fields]);
    const jsonString = useMemo(() => JSON.stringify(jsonSchema, null, 2), [jsonSchema]);

    // Deep field operations (works recursively through nested children)
    const updateFieldDeep = useCallback((id: string, updates: Partial<SchemaField>) => {
        setFields(prev => {
            const update = (items: SchemaField[]): SchemaField[] =>
                items.map(f => {
                    if (f.id === id) return { ...f, ...updates };
                    if (f.children) return { ...f, children: update(f.children) };
                    return f;
                });
            return update(prev);
        });
    }, []);

    const removeFieldDeep = useCallback((id: string) => {
        setFields(prev => {
            const remove = (items: SchemaField[]): SchemaField[] =>
                items.filter(f => f.id !== id).map(f =>
                    f.children ? { ...f, children: remove(f.children) } : f
                );
            return remove(prev);
        });
    }, []);

    const addChildField = useCallback((parentId: string) => {
        setFields(prev => {
            const addChild = (items: SchemaField[]): SchemaField[] =>
                items.map(f => {
                    if (f.id === parentId) {
                        return { ...f, children: [...(f.children || []), createEmptyField()] };
                    }
                    if (f.children) return { ...f, children: addChild(f.children) };
                    return f;
                });
            return addChild(prev);
        });
    }, []);

    const addRootField = useCallback(() => {
        setFields(prev => [...prev, createEmptyField()]);
    }, []);

    const clearAll = useCallback(() => { setFields([]); }, []);

    // Save schema to localStorage
    const handleSave = useCallback((name: string) => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            const schemas: SavedSchema[] = raw ? JSON.parse(raw) : [];
            const existing = schemas.findIndex(s => s.name === name);
            const saved: SavedSchema = { name, fields, savedAt: new Date().toISOString() };
            if (existing >= 0) schemas[existing] = saved;
            else schemas.push(saved);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(schemas));
            toast.success(`Schema "${name}" saved`);
        } catch (err) {
            toast.error(`Failed to save: ${err}`);
        }
    }, [fields, toast]);

    const handleLoad = useCallback((schema: SavedSchema) => {
        setFields(schema.fields);
        toast.success(`Loaded "${schema.name}"`);
    }, [toast]);

    const handleDeleteSaved = useCallback((name: string) => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            const schemas: SavedSchema[] = raw ? JSON.parse(raw) : [];
            localStorage.setItem(STORAGE_KEY, JSON.stringify(schemas.filter(s => s.name !== name)));
            toast.success(`Deleted "${name}"`);
        } catch { /* ignore */ }
    }, [toast]);

    const handleImportModel = useCallback((importedFields: SchemaField[]) => {
        setFields(prev => [...prev, ...importedFields]);
        toast.success(`Imported ${importedFields.length} fields from data model`);
    }, [toast]);

    const copyToClipboard = useCallback(() => {
        navigator.clipboard.writeText(jsonString);
        toast.success("JSON Schema copied to clipboard");
    }, [jsonString, toast]);

    const downloadSchema = useCallback(() => {
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "schema.json";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("Schema downloaded");
    }, [jsonString, toast]);

    const importFromJson = useCallback(() => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json";
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;
            try {
                const text = await file.text();
                const schema = JSON.parse(text);
                if (schema.properties) {
                    const imported = Object.entries(schema.properties as Record<string, Record<string, unknown>>).map(([name, prop]): SchemaField => ({
                        id: newFieldId(),
                        name,
                        type: (prop.type === "integer" ? "integer" : prop.type === "number" ? "number" : prop.type === "boolean" ? "boolean" : prop.type === "object" ? "object" : prop.type === "array" ? "array" : "string") as FieldType,
                        required: ((schema.required || []) as string[]).includes(name),
                        isArray: false,
                        description: prop.description as string | undefined,
                        title: prop.title as string | undefined,
                    }));
                    setFields(imported);
                    toast.success(`Imported ${imported.length} fields from JSON file`);
                }
            } catch (err) {
                toast.error(`Invalid JSON file: ${err}`);
            }
        };
        input.click();
    }, [toast]);

    const fieldCount = useMemo(() => {
        let count = 0;
        const countFields = (items: SchemaField[]) => {
            items.forEach(f => {
                count++;
                if (f.children) countFields(f.children);
            });
        };
        countFields(fields);
        return count;
    }, [fields]);

    return (
        <div className="flex-1 min-h-0 w-full flex flex-col bg-transparent overflow-hidden">

            {/* Toolbar */}
            <div className="h-12 bg-black/20 backdrop-blur-md border-b border-white/5 flex items-center px-6 gap-2 flex-shrink-0">
                {/* Left: Actions */}
                <ToolbarButton icon="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" label="Clear All" onClick={clearAll} danger />
                <ToolbarDivider />
                <ToolbarButton icon="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" label="Save" onClick={() => setSchemaManagerOpen("save")} />
                <ToolbarButton icon="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" label="Load" onClick={() => setSchemaManagerOpen("load")} />
                <ToolbarDivider />
                <ToolbarButton icon="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" label="Import JSON" onClick={importFromJson} />
                <ToolbarButton icon="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" label="Download" onClick={downloadSchema} />
                <ToolbarDivider />
                <ToolbarButton icon="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" label="Import from Model" onClick={() => setImportModelOpen(true)} accent />
                <ToolbarButton icon="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" label="Apply to API" onClick={() => setApplyApiOpen(true)} accent />

                <div className="flex-1" />
                <span className="text-[10px] text-[var(--ide-text-muted)] font-mono">{fieldCount} fields</span>
            </div>

            {/* Main Content: Builder + Preview */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left: Schema Builder */}
                <div className={`flex-1 flex flex-col overflow-hidden ${previewCollapsed ? "" : "border-r border-[var(--ide-border)]"}`}>
                    <div className="flex-1 overflow-y-auto custom-scrollbar py-3">
                        {fields.length > 0 ? (
                            <div className="space-y-0.5">
                                {fields.map(field => (
                                    <FieldRowComponent
                                        key={field.id}
                                        field={field}
                                        depth={0}
                                        onUpdate={updateFieldDeep}
                                        onRemove={removeFieldDeep}
                                        onAddChild={addChildField}
                                    />
                                ))}
                            </div>
                        ) : (
                            /* Empty State */
                            <div className="h-full flex items-center justify-center p-8">
                                <div className="text-center max-w-sm w-full">
                                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center shadow-lg shadow-teal-500/5">
                                        <span className="text-lg font-black tracking-widest text-teal-600 dark:text-teal-400">JSON</span>
                                    </div>
                                    <h3 className="text-lg font-bold text-neutral-950 dark:text-white mb-2">
                                        JSON Schema Builder
                                    </h3>
                                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-6 leading-relaxed">
                                        Visually define your API request/response schemas. Add fields, set types, nest objects, and export as JSON Schema.
                                    </p>
                                    <div className="flex items-center justify-center gap-2">
                                        <button 
                                            className="px-4 py-2 bg-teal-600 dark:bg-teal-500 text-white dark:text-neutral-950 font-bold text-xs uppercase tracking-wider rounded-xl shadow-md hover:bg-teal-700 transition-all flex items-center gap-1.5" 
                                            onClick={addRootField}
                                        >
                                            + ADD FIRST FIELD
                                        </button>
                                        <button
                                            className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-300 hover:text-teal-600 dark:hover:text-teal-400 border border-black/[0.08] dark:border-white/10 rounded-xl hover:border-teal-500/40 transition-all"
                                            onClick={() => setImportModelOpen(true)}
                                        >
                                            IMPORT MODEL
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Bottom: Add New Field Button */}
                    {fields.length > 0 && (
                        <div className="flex-shrink-0 border-t border-black/[0.06] dark:border-white/[0.06] bg-black/[0.01] dark:bg-white/[0.01]">
                            <button
                                onClick={addRootField}
                                className="w-full py-2.5 flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 hover:bg-teal-500/10 transition-all"
                            >
                                + ADD NEW FIELD
                            </button>
                        </div>
                    )}
                </div>

                {/* Right: JSON Preview Panel */}
                <div className={`flex flex-col bg-black/[0.02] dark:bg-black/20 backdrop-blur-sm transition-all duration-200 border-l border-black/[0.08] dark:border-white/5 ${previewCollapsed ? "w-10" : "w-[380px]"}`}>
                    {/* Preview Header */}
                    <div className="h-10 flex items-center px-3 border-b border-black/[0.06] dark:border-white/[0.06] flex-shrink-0 gap-2">
                        <button onClick={() => setPreviewCollapsed(!previewCollapsed)} className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors px-1">
                            {previewCollapsed ? "◀" : "▶"}
                        </button>
                        {!previewCollapsed && (
                            <>
                                <span className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider flex-1">JSON Schema</span>
                                <button onClick={copyToClipboard} className="px-2 py-0.5 text-[10px] font-bold text-neutral-600 dark:text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-500/10 rounded transition-all" title="Copy">
                                    COPY
                                </button>
                                <button onClick={downloadSchema} className="px-2 py-0.5 text-[10px] font-bold text-neutral-600 dark:text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-500/10 rounded transition-all" title="Download">
                                    DL
                                </button>
                            </>
                        )}
                    </div>

                    {!previewCollapsed && (
                        <div className="flex-1 overflow-auto custom-scrollbar p-4">
                            <JsonHighlight json={jsonString} />
                        </div>
                    )}
                </div>
            </div>

            {/* ─── Modals ─── */}
            <SchemaManagerModal
                isOpen={schemaManagerOpen !== null}
                mode={schemaManagerOpen || "save"}
                onClose={() => setSchemaManagerOpen(null)}
                onSave={handleSave}
                onLoad={handleLoad}
                onDelete={handleDeleteSaved}
            />
            <ImportModelModal
                isOpen={importModelOpen}
                onClose={() => setImportModelOpen(false)}
                onImport={handleImportModel}
            />
            <ApplyToApiModal
                isOpen={applyApiOpen}
                onClose={() => setApplyApiOpen(false)}
                schema={jsonSchema}
            />

            {/* ─── Styles ─── */}
            <style>{`
                .jsb-key { color: #93c5fd; }
                .jsb-string { color: #86efac; }
                .jsb-number { color: #fbbf24; }
                .jsb-bool { color: #c084fc; }
                .jsb-null { color: #f87171; }

                @keyframes jsb-field-enter {
                    from { opacity: 0; transform: translateX(-8px); }
                    to { opacity: 1; transform: translateX(0); }
                }
                .jsb-field-enter {
                    animation: jsb-field-enter 0.2s ease-out both;
                }
            `}</style>
        </div>
    );
};



export default JsonSchemaBuilder;
