/**
 * ERDCanvas Component - React version
 *
 * Entity-Relationship Diagram editor for database schema design.
 * Allows creating data models with fields and relations.
 */

import React, { useState, useRef, useEffect } from "react";
import {
    addDataModel,
    addField,
    deleteField,
    archiveDataModel,
    generateSchemaFromIdea,
    addRelation,
    deleteRelation,
} from "../../../stores/projectStore";
import { useProjectStore } from "../../../hooks/useProjectStore";
import { DataModelSchema, FieldSchema, RelationSchema } from "../../../hooks/useApi";
import PromptModal, { PromptField } from "../../ui/PromptModal";
import ConfirmModal from "../../Modals/ConfirmModal";
import { useToast } from "../../../context/ToastContext";

// ─── Relation type helpers ──────────────────────────────────────────────────

const RELATION_TYPES = [
    { label: "One to One  (1 : 1)", value: "OneToOne" },
    { label: "One to Many (1 : N)", value: "OneToMany" },
    { label: "Many to Many (N : N)", value: "ManyToMany" },
];

function relationLabel(type: string): string {
    switch (type) {
        case "OneToOne": return "1 : 1";
        case "OneToMany": return "1 : N";
        case "ManyToMany": return "N : N";
        default: return type;
    }
}

function relationColor(type: string): string {
    switch (type) {
        case "OneToOne": return "#a78bfa";   // purple
        case "OneToMany": return "#60a5fa";  // blue
        case "ManyToMany": return "#34d399"; // green
        default: return "#9ca3af";
    }
}

// ─── Main Component ────────────────────────────────────────────────────────

const ERDCanvas: React.FC = () => {
    const { project } = useProjectStore();
    const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
    const [zoom, setZoom] = useState(1);
    const [promptOpen, setPromptOpen] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [generateConfirmOpen, setGenerateConfirmOpen] = useState(false);
    const [showAiMenu, setShowAiMenu] = useState(false);
    const aiMenuRef = useRef<HTMLDivElement>(null);
    const [aiMode, setAiMode] = useState<"scratch" | "fix">("scratch");
    const [deleteModelTarget, setDeleteModelTarget] = useState<{ id: string; name: string } | null>(null);
    const [deleteFieldTarget, setDeleteFieldTarget] = useState<{ modelId: string; fieldId: string; fieldName: string } | null>(null);
    const [addFieldModelId, setAddFieldModelId] = useState<string | null>(null);

    // Close AI menu on click outside or Escape
    useEffect(() => {
        if (!showAiMenu) return;
        const handleClickOutside = (event: MouseEvent) => {
            if (aiMenuRef.current && !aiMenuRef.current.contains(event.target as Node)) {
                setShowAiMenu(false);
            }
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setShowAiMenu(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [showAiMenu]);

    // Relation state
    const [addRelationModelId, setAddRelationModelId] = useState<string | null>(null);
    const [deleteRelationTarget, setDeleteRelationTarget] = useState<{
        modelId: string;
        relationId: string;
        relationName: string;
    } | null>(null);

    const toast = useToast();

    const models = project?.data_models.filter(m => !m.archived) || [];

    // ── Model fields for prompt modal ──────────────────────────────────────
    const modelFields: PromptField[] = [
        {
            name: "name",
            label: "Model name",
            placeholder: "User",
            helperText: "Use PascalCase (e.g., User, BlogPost)",
            required: true,
        },
    ];

    // ── AI Generate ────────────────────────────────────────────────────────
    const handleAddModel = () => setPromptOpen(true);

    const handleGenerateClick = () => {
        if (!project?.description?.trim()) {
            toast.error("No project idea found. Please add a project idea first on the Idea page.");
            return;
        }
        setGenerateConfirmOpen(true);
    };

    const handleGenerateConfirm = async (modeOverride?: "scratch" | "fix") => {
        const mode = modeOverride || aiMode;
        setGenerateConfirmOpen(false);
        setGenerating(true);
        try {
            await generateSchemaFromIdea(mode);
            toast.success(
                mode === "scratch"
                    ? "Database schema regenerated from scratch!"
                    : "Database schema updated and fixed!"
            );
        } catch (err: any) {
            const message = err?.response?.data?.error || err?.message || String(err);
            toast.error(`AI Help failed: ${message}`);
        } finally {
            setGenerating(false);
        }
    };

    // ── Delete Model ───────────────────────────────────────────────────────
    const handleDeleteModel = async () => {
        if (!deleteModelTarget) return;
        try {
            await archiveDataModel(deleteModelTarget.id);
            toast.success(`Model "${deleteModelTarget.name}" deleted`);
            if (selectedModelId === deleteModelTarget.id) setSelectedModelId(null);
        } catch (err) {
            toast.error(`Failed to delete model: ${err}`);
        }
        setDeleteModelTarget(null);
    };

    // ── Delete Field ───────────────────────────────────────────────────────
    // FIX: use fieldId (not fieldName) — the API expects the UUID field ID
    const handleDeleteField = async () => {
        if (!deleteFieldTarget) return;
        try {
            await deleteField(deleteFieldTarget.modelId, deleteFieldTarget.fieldId);
            toast.success(`Field "${deleteFieldTarget.fieldName}" deleted`);
        } catch (err) {
            toast.error(`Failed to delete field: ${err}`);
        }
        setDeleteFieldTarget(null);
    };

    // ── Add Field ──────────────────────────────────────────────────────────
    const handleAddField = async (formValues: Record<string, string>) => {
        if (!addFieldModelId) return;
        const { name, type, required } = formValues as { name?: string; type?: string; required?: string };
        const trimmedName = (name || "").trim();

        if (!trimmedName) {
            toast.error("Field name is required");
            return;
        }

        try {
            await addField(addFieldModelId, trimmedName, type || "string", required === "true");
            toast.success(`Field "${trimmedName}" added`);
            setAddFieldModelId(null);
        } catch (err) {
            toast.error(`Failed to add field: ${err}`);
        }
    };

    // ── Add Relation ───────────────────────────────────────────────────────
    const handleAddRelation = async (formValues: Record<string, string>) => {
        if (!addRelationModelId) return;
        const { name, targetModelId, relationType } = formValues as { name?: string; targetModelId?: string; relationType?: string };
        const trimmedName = (name || "").trim();

        if (!trimmedName || !targetModelId || !relationType) {
            toast.error("All relation fields are required");
            return;
        }

        try {
            await addRelation(addRelationModelId, trimmedName, targetModelId, relationType);
            toast.success(`Relation "${trimmedName}" added`);
            setAddRelationModelId(null);
        } catch (err) {
            toast.error(`Failed to add relation: ${err}`);
        }
    };

    // ── Delete Relation ────────────────────────────────────────────────────
    const handleDeleteRelation = async () => {
        if (!deleteRelationTarget) return;
        try {
            await deleteRelation(deleteRelationTarget.modelId, deleteRelationTarget.relationId);
            toast.success(`Relation "${deleteRelationTarget.relationName}" deleted`);
        } catch (err) {
            toast.error(`Failed to delete relation: ${err}`);
        }
        setDeleteRelationTarget(null);
    };

    // ─── Relation prompt fields (dynamic based on available models) ────────
    const relationFields: PromptField[] = [
        {
            name: "name",
            label: "Relation name",
            placeholder: "e.g. posts, author, tags",
            helperText: "camelCase property name for this relation",
            required: true,
        },
        {
            name: "targetModelId",
            label: "Target model",
            type: "select",
            options: models
                .filter(m => m.id !== addRelationModelId)
                .map(m => ({ label: m.name, value: m.id })),
            required: true,
        },
        {
            name: "relationType",
            label: "Relation type",
            type: "select",
            options: RELATION_TYPES,
            required: true,
        },
    ];

    return (
        <div className="flex-1 min-h-0 w-full flex flex-col bg-transparent">
            {/* ERD Toolbar */}
            <div className="relative z-30 h-12 bg-white/70 dark:bg-black/30 backdrop-blur-xl border-b border-black/[0.08] dark:border-white/10 flex items-center px-6 gap-3">
                <button
                    className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200 hover:text-neutral-950 dark:hover:text-white px-3 py-1.5 rounded-lg bg-black/[0.04] dark:bg-white/5 border border-black/[0.08] dark:border-white/10 transition-all"
                    onClick={handleAddModel}
                >
                    + ADD MODEL
                </button>
                <div className="relative z-50" ref={aiMenuRef}>
                    <button
                        className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-bold uppercase tracking-wider transition-all ${
                            generating
                                ? "bg-purple-500/20 text-purple-600 dark:text-purple-300 border border-purple-500/30 cursor-wait"
                                : "bg-black/[0.04] dark:bg-white/5 text-neutral-700 dark:text-white/80 hover:bg-black/[0.08] dark:hover:bg-white/10 border border-black/[0.08] dark:border-white/10"
                        }`}
                        onClick={() => setShowAiMenu(!showAiMenu)}
                        disabled={generating}
                        title="AI assistant for your database schema"
                    >
                        {generating ? "AI THINKING..." : `AI HELP ${showAiMenu ? "▲" : "▼"}`}
                    </button>

                    {showAiMenu && !generating && (
                        <div className="absolute top-full left-0 mt-2 w-64 bg-white/95 dark:bg-[#0c0d16]/95 backdrop-blur-2xl border border-black/[0.08] dark:border-white/12 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] z-50 py-1.5 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
                            <button
                                className="w-full text-left px-4 py-2.5 text-sm hover:bg-purple-500/10 flex items-center gap-3 group transition-colors"
                                onClick={() => {
                                    setAiMode("scratch");
                                    handleGenerateClick();
                                    setShowAiMenu(false);
                                }}
                            >
                                <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-[10px] font-black text-purple-600 dark:text-purple-400 group-hover:bg-purple-500/20">
                                    SCRATCH
                                </div>
                                <div>
                                    <div className="font-bold text-neutral-950 dark:text-white text-xs">Regenerate from Scratch</div>
                                    <div className="text-[10px] text-neutral-500 dark:text-neutral-400">Delete all models and start over</div>
                                </div>
                            </button>
                            <button
                                className="w-full text-left px-4 py-2.5 text-sm hover:bg-blue-500/10 flex items-center gap-3 group transition-colors border-t border-black/[0.05] dark:border-white/5"
                                onClick={() => {
                                    setAiMode("fix");
                                    handleGenerateClick();
                                    setShowAiMenu(false);
                                }}
                            >
                                <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-[10px] font-black text-blue-600 dark:text-blue-400 group-hover:bg-blue-500/20">
                                    FIX
                                </div>
                                <div>
                                    <div className="font-bold text-neutral-950 dark:text-white text-xs">Check and Fix Missing</div>
                                    <div className="text-[10px] text-neutral-500 dark:text-neutral-400">Improve current schema using AI</div>
                                </div>
                            </button>
                        </div>
                    )}
                </div>
                <div className="w-px h-6 bg-black/[0.08] dark:bg-white/10" />
                <button
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black bg-black/[0.04] dark:bg-white/5 border border-black/[0.08] dark:border-white/10 text-neutral-800 dark:text-neutral-200 hover:bg-black/[0.08] dark:hover:bg-white/10"
                    onClick={() => setZoom(z => Math.min(z + 0.1, 2))}
                    title="Zoom in"
                >
                    +
                </button>
                <span className="text-xs font-mono font-bold text-neutral-600 dark:text-neutral-300 min-w-[40px] text-center">{Math.round(zoom * 100)}%</span>
                <button
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black bg-black/[0.04] dark:bg-white/5 border border-black/[0.08] dark:border-white/10 text-neutral-800 dark:text-neutral-200 hover:bg-black/[0.08] dark:hover:bg-white/10"
                    onClick={() => setZoom(z => Math.max(z - 0.1, 0.5))}
                    title="Zoom out"
                >
                    -
                </button>
                <div className="flex-1" />
                <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">{models.length} models</span>
            </div>

            {/* ── Modals ───────────────────────────────────────────────────────── */}

            {/* Create Model */}
            <PromptModal
                isOpen={promptOpen}
                title="New Data Model"
                fields={modelFields}
                confirmText="Create"
                onClose={() => setPromptOpen(false)}
                onSubmit={async (formValues) => {
                    const { name } = formValues as { name?: string };
                    const trimmedName = (name || "").trim();
                    if (!trimmedName) {
                        toast.error("Model name is required");
                        return;
                    }
                    try {
                        await addDataModel(trimmedName);
                        toast.success(`Model "${trimmedName}" created`);
                        setPromptOpen(false);
                    } catch (err) {
                        toast.error(`Failed to create model: ${err}`);
                    }
                }}
            />

            {/* Add Field */}
            <PromptModal
                isOpen={!!addFieldModelId}
                title="Add Field"
                fields={[
                    { name: "name", label: "Field name", placeholder: "e.g. email, status", required: true },
                    {
                        name: "type",
                        label: "Field type",
                        type: "select",
                        options: [
                            { label: "String", value: "string" },
                            { label: "Int", value: "int" },
                            { label: "Float", value: "float" },
                            { label: "Boolean", value: "boolean" },
                            { label: "DateTime", value: "datetime" },
                            { label: "UUID", value: "uuid" },
                            { label: "Text", value: "text" },
                        ],
                        required: true,
                    },
                    {
                        name: "required",
                        label: "Required?",
                        type: "select",
                        options: [
                            { label: "Yes", value: "true" },
                            { label: "No", value: "false" },
                        ],
                        required: true,
                    },
                ]}
                confirmText="Add Field"
                onClose={() => setAddFieldModelId(null)}
                onSubmit={handleAddField}
            />

            {/* Add Relation */}
            <PromptModal
                isOpen={!!addRelationModelId}
                title="Add Relation"
                fields={relationFields}
                confirmText="Add Relation"
                onClose={() => setAddRelationModelId(null)}
                onSubmit={handleAddRelation}
            />

            {/* Confirm: AI Regenerate */}
            <ConfirmModal
                isOpen={generateConfirmOpen}
                title={aiMode === "scratch" ? "Regenerate Schema" : "Improve Schema"}
                message={
                    aiMode === "scratch"
                        ? "This will DELETE ALL current models and recreate the entire database schema from your project idea. This cannot be undone. Proceed?"
                        : "This will analyze your current models and add any missing fields or tables needed to support your project idea. Proceed?"
                }
                confirmText={aiMode === "scratch" ? "Delete & Regenerate" : "Check & Fix"}
                cancelText="Cancel"
                variant={aiMode === "scratch" ? "danger" : "default"}
                onConfirm={() => handleGenerateConfirm(aiMode)}
                onCancel={() => setGenerateConfirmOpen(false)}
            />

            {/* Confirm: Delete Model */}
            <ConfirmModal
                isOpen={!!deleteModelTarget}
                title="Delete Model"
                message={`Are you sure you want to delete the model "${deleteModelTarget?.name}"? This cannot be undone.`}
                confirmText="Delete"
                cancelText="Cancel"
                variant="danger"
                onConfirm={handleDeleteModel}
                onCancel={() => setDeleteModelTarget(null)}
            />

            {/* Confirm: Delete Field */}
            <ConfirmModal
                isOpen={!!deleteFieldTarget}
                title="Delete Field"
                message={`Are you sure you want to delete the field "${deleteFieldTarget?.fieldName}"?`}
                confirmText="Delete"
                cancelText="Cancel"
                variant="danger"
                onConfirm={handleDeleteField}
                onCancel={() => setDeleteFieldTarget(null)}
            />

            {/* Confirm: Delete Relation */}
            <ConfirmModal
                isOpen={!!deleteRelationTarget}
                title="Delete Relation"
                message={`Are you sure you want to delete the relation "${deleteRelationTarget?.relationName}"?`}
                confirmText="Delete"
                cancelText="Cancel"
                variant="danger"
                onConfirm={handleDeleteRelation}
                onCancel={() => setDeleteRelationTarget(null)}
            />

            {/* ── ERD Canvas Area ──────────────────────────────────────────────── */}
            <div className="flex-1 overflow-auto p-6 md:p-10 relative">
                {models.length > 0 ? (
                    <div
                        className="relative min-h-[600px] min-w-[800px]"
                        style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}
                    >
                        {/* Relation lines (placeholder SVG layer) */}
                        <svg className="absolute inset-0 w-full h-full pointer-events-none">
                            <defs>
                                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                                    <polygon points="0 0, 10 3.5, 0 7" fill="white" fillOpacity="0.4" />
                                </marker>
                            </defs>
                        </svg>

                        {/* Model Cards */}
                        <div className="flex flex-wrap gap-6">
                            {models.map((model) => (
                                <ModelCard
                                    key={model.id}
                                    model={model}
                                    allModels={models}
                                    selected={selectedModelId === model.id}
                                    onSelect={() => setSelectedModelId(model.id)}
                                    onRequestDelete={() => setDeleteModelTarget({ id: model.id, name: model.name })}
                                    onRequestDeleteField={(fieldId, fieldName) =>
                                        setDeleteFieldTarget({ modelId: model.id, fieldId, fieldName })
                                    }
                                    onRequestAddField={() => setAddFieldModelId(model.id)}
                                    onRequestAddRelation={() => setAddRelationModelId(model.id)}
                                    onRequestDeleteRelation={(relationId, relationName) =>
                                        setDeleteRelationTarget({ modelId: model.id, relationId, relationName })
                                    }
                                />
                            ))}
                        </div>
                    </div>
                ) : (
                    <EmptyERDState
                        onAdd={handleAddModel}
                        onGenerate={(mode) => {
                            if (mode) setAiMode(mode);
                            handleGenerateClick();
                        }}
                        generating={generating}
                    />
                )}
            </div>
        </div>
    );
};

// ─── Model Card ────────────────────────────────────────────────────────────

interface ModelCardProps {
    model: DataModelSchema;
    allModels: DataModelSchema[];
    selected: boolean;
    onSelect: () => void;
    onRequestDelete: () => void;
    onRequestDeleteField: (fieldId: string, fieldName: string) => void;
    onRequestAddField: () => void;
    onRequestAddRelation: () => void;
    onRequestDeleteRelation: (relationId: string, relationName: string) => void;
}

const ModelCard: React.FC<ModelCardProps> = ({
    model,
    allModels,
    selected,
    onSelect,
    onRequestDelete,
    onRequestDeleteField,
    onRequestAddField,
    onRequestAddRelation,
    onRequestDeleteRelation,
}) => {
    return (
        <div
            className={`w-72 rounded-2xl border overflow-hidden bg-white/75 dark:bg-black/60 backdrop-blur-2xl transition-all cursor-pointer shadow-xl ${
                selected ? "border-blue-500/60 ring-2 ring-blue-500/20 shadow-blue-500/10" : "border-black/[0.08] dark:border-white/10 hover:border-black/[0.15] dark:hover:border-white/30"
            }`}
            onClick={onSelect}
        >
            {/* Header */}
            <div className="bg-black/[0.03] dark:bg-white/5 px-4 py-3 pb-2.5 border-b border-black/[0.06] dark:border-white/5 flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                    TBL
                </span>
                <span className="font-bold text-sm text-neutral-900 dark:text-white flex-1 truncate">{model.name}</span>
                <button
                    className="px-2 py-0.5 text-[10px] font-bold text-red-500/70 hover:text-red-600 transition-colors rounded uppercase"
                    title="Delete model"
                    onClick={(e) => { e.stopPropagation(); onRequestDelete(); }}
                >
                    DEL
                </button>
            </div>

            {/* Fields */}
            <div className="divide-y divide-black/[0.04] dark:divide-white/5">
                {model.fields.length > 0 ? (
                    model.fields.map((field) => (
                        <FieldRow
                            key={field.id}
                            field={field}
                            onRequestDelete={() => onRequestDeleteField(field.id, field.name)}
                        />
                    ))
                ) : (
                    <div className="px-4 py-3 text-xs text-neutral-400 dark:text-neutral-500 italic">No fields defined</div>
                )}
            </div>

            {/* Relations section */}
            {model.relations && model.relations.length > 0 && (
                <div className="border-t border-black/[0.06] dark:border-white/[0.06]">
                    <div className="px-4 py-1.5 text-[10px] font-bold text-neutral-400 dark:text-white/30 uppercase tracking-widest">
                        Relations
                    </div>
                    <div className="divide-y divide-black/[0.04] dark:divide-white/5">
                        {model.relations.map((rel) => (
                            <RelationRow
                                key={rel.id}
                                relation={rel}
                                allModels={allModels}
                                onRequestDelete={() => onRequestDeleteRelation(rel.id, rel.name)}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Footer */}
            <div className="px-4 py-2 bg-black/[0.02] dark:bg-black/30 flex items-center justify-between border-t border-black/[0.06] dark:border-white/5">
                <span className="flex items-center gap-1 flex-wrap">
                    {model.timestamps && (
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-black/[0.04] dark:bg-white/5 text-neutral-500 dark:text-white/40">timestamps</span>
                    )}
                    {model.soft_delete && (
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-black/[0.04] dark:bg-white/5 text-neutral-500 dark:text-white/40">soft-del</span>
                    )}
                </span>
                <div className="flex items-center gap-1.5">
                    {/* Add Relation button */}
                    <button
                        className="px-1.5 py-0.5 text-[10px] font-bold text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 transition-colors rounded uppercase"
                        title="Add relation"
                        onClick={(e) => { e.stopPropagation(); onRequestAddRelation(); }}
                    >
                        + REL
                    </button>
                    {/* Add Field button */}
                    <button
                        className="px-1.5 py-0.5 text-[10px] font-bold text-neutral-700 dark:text-white/70 hover:bg-black/[0.04] dark:hover:bg-white/10 transition-colors rounded uppercase"
                        title="Add field"
                        onClick={(e) => { e.stopPropagation(); onRequestAddField(); }}
                    >
                        + FLD
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Field Row ─────────────────────────────────────────────────────────────

interface FieldRowProps {
    field: FieldSchema;
    onRequestDelete: () => void;
}

const FIELD_TYPE_COLORS: Record<string, string> = {
    string: "text-emerald-600 dark:text-emerald-400",
    text: "text-emerald-600 dark:text-emerald-400",
    int: "text-blue-600 dark:text-blue-400",
    float: "text-cyan-600 dark:text-cyan-400",
    boolean: "text-amber-600 dark:text-amber-400",
    datetime: "text-purple-600 dark:text-purple-400",
    uuid: "text-pink-600 dark:text-pink-400",
};

const FieldRow: React.FC<FieldRowProps> = ({ field, onRequestDelete }) => {
    const typeColor = FIELD_TYPE_COLORS[field.field_type?.toLowerCase()] ?? "text-neutral-500 dark:text-white/45";

    return (
        <div className="px-4 py-2 flex items-center gap-2 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors group">
            {field.primary_key && (
                <span className="text-[9px] font-black font-mono px-1 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 flex-shrink-0">
                    PK
                </span>
            )}
            <span className="text-sm font-medium text-neutral-900 dark:text-white flex-1 truncate">
                {field.name}
                {!field.required && <span className="text-neutral-400 dark:text-neutral-500">?</span>}
            </span>
            <span className={`text-xs font-mono font-medium flex-shrink-0 ${typeColor}`}>{field.field_type}</span>
            {field.unique && (
                <span className="text-[9px] font-bold font-mono px-1 py-0.5 rounded bg-neutral-200 dark:bg-white/5 text-neutral-600 dark:text-white/50 flex-shrink-0">
                    UQ
                </span>
            )}
            {!field.primary_key && (
                <button
                    className="opacity-0 group-hover:opacity-100 text-[11px] font-bold text-neutral-400 hover:text-red-500 transition-all flex-shrink-0 px-1"
                    title="Delete field"
                    onClick={(e) => { e.stopPropagation(); onRequestDelete(); }}
                >
                    ✕
                </button>
            )}
        </div>
    );
};

// ─── Relation Row ──────────────────────────────────────────────────────────

interface RelationRowProps {
    relation: RelationSchema;
    allModels: DataModelSchema[];
    onRequestDelete: () => void;
}

const RelationRow: React.FC<RelationRowProps> = ({ relation, allModels, onRequestDelete }) => {
    const targetModel = allModels.find(m => m.id === relation.target_model_id);
    const color = relationColor(relation.relation_type);
    const label = relationLabel(relation.relation_type);

    return (
        <div className="px-4 py-2 flex items-center gap-2 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors group">
            {/* Relation type badge */}
            <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                style={{ color, background: `${color}18`, border: `1px solid ${color}30` }}
            >
                {label}
            </span>
            {/* Relation name */}
            <span className="text-sm font-medium text-neutral-900 dark:text-white flex-1 truncate">{relation.name}</span>
            {/* Target model */}
            <span className="text-xs text-neutral-500 dark:text-white/40 flex-shrink-0 truncate max-w-[80px]">
                → {targetModel?.name ?? "Unknown"}
            </span>
            {/* Delete */}
            <button
                className="opacity-0 group-hover:opacity-100 text-[11px] font-bold text-neutral-400 hover:text-red-500 transition-all flex-shrink-0 px-1"
                title="Delete relation"
                onClick={(e) => { e.stopPropagation(); onRequestDelete(); }}
            >
                ✕
            </button>
        </div>
    );
};

// ─── Empty State ───────────────────────────────────────────────────────────

interface EmptyERDStateProps {
    onAdd: () => void;
    onGenerate: (mode?: "scratch" | "fix") => void;
    generating: boolean;
}

const EmptyERDState: React.FC<EmptyERDStateProps> = ({ onAdd, onGenerate, generating }) => {
    const [aiHelpOpen, setAiHelpOpen] = useState(false);
    const aiHelpRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (aiHelpRef.current && !aiHelpRef.current.contains(event.target as Node)) {
                setAiHelpOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="h-full flex items-center justify-center p-8">
            <div className="text-center max-w-sm w-full">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/80 dark:bg-white/[0.05] border border-black/[0.08] dark:border-white/10 flex items-center justify-center shadow-md">
                    <span className="text-xl font-black tracking-widest text-neutral-700 dark:text-white/70">ERD</span>
                </div>
                <h3 className="text-lg font-bold text-neutral-950 dark:text-white mb-2">Database Designer</h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-6 leading-relaxed">
                    Design your database schema visually. Create models, add fields, and set up 1:1, 1:N, and N:N relations.
                </p>
                <div className="flex flex-col gap-3 items-center">
                    <div className="relative w-full z-30" ref={aiHelpRef}>
                        <button
                            className={`w-full py-2.5 px-4 bg-neutral-900 dark:bg-white/10 border border-neutral-900 dark:border-white/20 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md hover:bg-neutral-800 dark:hover:bg-white/15 transition-all outline-none flex items-center justify-center gap-2 ${generating ? "opacity-70 cursor-not-allowed" : ""}`}
                            onClick={() => !generating && setAiHelpOpen(!aiHelpOpen)}
                        >
                            {generating ? "AI WORKING..." : `AI HELP ${aiHelpOpen ? "▲" : "▼"}`}
                        </button>

                        {aiHelpOpen && (
                            <div className="absolute bottom-full mb-3 left-0 right-0 bg-white/95 dark:bg-[#0c0d16]/95 backdrop-blur-2xl border border-black/[0.08] dark:border-white/12 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] overflow-hidden animate-scale-in z-50">
                                <div className="p-1 px-3 py-2 border-b border-black/[0.06] dark:border-white/[0.06]">
                                    <span className="text-[10px] font-bold text-neutral-400 dark:text-white/40 uppercase tracking-widest">AI Assistance</span>
                                </div>
                                <div className="p-1.5 flex flex-col gap-1">
                                    <button
                                        onClick={() => { onGenerate("scratch"); setAiHelpOpen(false); }}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-medium text-neutral-900 dark:text-white hover:bg-purple-500/10 rounded-xl transition-all text-left group"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-[10px] font-black text-purple-600 dark:text-purple-400 group-hover:bg-purple-500/20">
                                            NEW
                                        </div>
                                        <div>
                                            <div className="font-bold text-xs">Regenerate from Scratch</div>
                                            <div className="text-[10px] text-neutral-500 dark:text-neutral-400 font-normal">Wipe current schema and restart</div>
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => { onGenerate("fix"); setAiHelpOpen(false); }}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-medium text-neutral-900 dark:text-white hover:bg-blue-500/10 rounded-xl transition-all text-left group"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-[10px] font-black text-blue-600 dark:text-blue-400 group-hover:bg-blue-500/20">
                                            FIX
                                        </div>
                                        <div>
                                            <div className="font-bold text-xs">Check and Fix Schema</div>
                                            <div className="text-[10px] text-neutral-500 dark:text-neutral-400 font-normal">Add missing fields or fix errors</div>
                                        </div>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-4 w-full justify-center">
                        <div className="h-px bg-black/[0.08] dark:bg-white/10 flex-1" />
                        <span className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold">OR</span>
                        <div className="h-px bg-black/[0.08] dark:bg-white/10 flex-1" />
                    </div>
                    <button
                        className="px-6 py-2.5 bg-black/[0.04] dark:bg-white/5 border border-black/[0.08] dark:border-white/10 text-neutral-900 dark:text-white font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-black/[0.08] dark:hover:bg-white/10 transition-all shadow-sm w-full"
                        onClick={onAdd}
                    >
                        Create First Model
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ERDCanvas;
