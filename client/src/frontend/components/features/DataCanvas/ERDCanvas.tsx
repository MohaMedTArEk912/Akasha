/**
 * ERDCanvas Component - React version
 * 
 * Entity-Relationship Diagram editor for database schema design.
 * Allows creating data models with fields and relations.
 */

import React, { useState, useRef, useEffect } from "react";
import { addDataModel, addField, archiveDataModel, deleteField, generateSchemaFromIdea } from "../../../stores/projectStore";
import { useProjectStore } from "../../../hooks/useProjectStore";
import { DataModelSchema, FieldSchema } from "../../../hooks/useApi";
import PromptModal, { PromptField } from "../../ui/PromptModal";
import ConfirmModal from "../../Modals/ConfirmModal";
import { useToast } from "../../../context/ToastContext";

const ERDCanvas: React.FC = () => {
    const { project } = useProjectStore();
    const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
    const [zoom, setZoom] = useState(1);
    const [promptOpen, setPromptOpen] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [generateConfirmOpen, setGenerateConfirmOpen] = useState(false);
    const [showAiMenu, setShowAiMenu] = useState(false);
    const [aiMode, setAiMode] = useState<"scratch" | "fix">("scratch");
    const [deleteModelTarget, setDeleteModelTarget] = useState<{ id: string; name: string } | null>(null);
    const [deleteFieldTarget, setDeleteFieldTarget] = useState<{ modelId: string; fieldName: string } | null>(null);
    const [addFieldModelId, setAddFieldModelId] = useState<string | null>(null);
    const toast = useToast();

    const modelFields: PromptField[] = [
        {
            name: "name",
            label: "Model name",
            placeholder: "User",
            helperText: "Use PascalCase (e.g., User, BlogPost)",
            required: true,
        },
    ];

    const models = project?.data_models.filter(m => !m.archived) || [];

    const handleAddModel = () => {
        setPromptOpen(true);
    };

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
            toast.success(mode === "scratch" 
                ? "Database schema regenerated from scratch!" 
                : "Database schema updated and fixed!");
        } catch (err: any) {
            const message = err?.response?.data?.error || err?.message || String(err);
            toast.error(`AI Help failed: ${message}`);
        } finally {
            setGenerating(false);
        }
    };

    const handleDeleteModel = async () => {
        if (!deleteModelTarget) return;
        try {
            await archiveDataModel(deleteModelTarget.id);
            toast.success(`Model "${deleteModelTarget.name}" deleted`);
        } catch (err) {
            toast.error(`Failed to delete model: ${err}`);
        }
        setDeleteModelTarget(null);
    };

    const handleDeleteField = async () => {
        if (!deleteFieldTarget) return;
        try {
            await deleteField(deleteFieldTarget.modelId, deleteFieldTarget.fieldName);
        } catch (err) {
            toast.error(`Failed to delete field: ${err}`);
        }
        setDeleteFieldTarget(null);
    };

    const handleAddField = async (values: Record<string, string>) => {
        if (!addFieldModelId) return;
        try {
            await addField(
                addFieldModelId,
                values.name.trim(),
                values.type as any,
                values.required === "true"
            );
            toast.success(`Field "${values.name.trim()}" added`);
        } catch (err) {
            toast.error(`Failed to add field: ${err}`);
        }
    };

    return (
        <div className="flex-1 min-h-0 w-full flex flex-col bg-transparent">
            {/* ERD Toolbar */}
            <div className="h-12 bg-black/20 backdrop-blur-md border-b border-white/5 flex items-center px-6 gap-3">
                <button
                    className="btn-ghost flex items-center gap-1 text-sm font-medium hover:text-white transition-colors"
                    onClick={handleAddModel}
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Add Model
                </button>
                <div className="relative">
                    <button
                        className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md font-medium transition-all ${
                            generating
                                ? "bg-white/10 text-white cursor-wait"
                                : "bg-white/5 text-white/70 hover:bg-white/15 hover:text-white border border-white/10"
                        }`}
                        onClick={() => setShowAiMenu(!showAiMenu)}
                        disabled={generating}
                        title="AI assistant for your database schema"
                    >
                        {generating ? (
                            <>
                                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                AI Thinking...
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                AI Help
                                <svg className={`w-3 h-3 ml-0.5 transition-transform ${showAiMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                </svg>
                            </>
                        )}
                    </button>

                    {showAiMenu && !generating && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowAiMenu(false)} />
                            <div className="absolute top-full left-0 mt-2 w-64 bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl z-50 py-1 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
                                <button 
                                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-purple-500/10 flex items-center gap-2 group transition-colors"
                                    onClick={() => {
                                        setAiMode("scratch");
                                        handleGenerateClick(); // Opens modal
                                        setShowAiMenu(false);
                                    }}
                                >
                                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/40 group-hover:bg-white/15">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </div>
                                    <div>
                                        <div className="font-medium text-[var(--ide-text)]">Regenerate from Scratch</div>
                                        <div className="text-[10px] text-[var(--ide-text-muted)]">Delete all models and start over</div>
                                    </div>
                                </button>
                                <button 
                                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-white/5 flex items-center gap-2 group transition-colors border-t border-white/5"
                                    onClick={() => {
                                        setAiMode("fix");
                                        handleGenerateClick(); // Opens modal for fix too
                                        setShowAiMenu(false);
                                    }}
                                >
                                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/40 group-hover:bg-white/15">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                                        </svg>
                                    </div>
                                    <div>
                                        <div className="font-medium text-[var(--ide-text)]">Check and Fix Missing</div>
                                        <div className="text-[10px] text-[var(--ide-text-muted)]">Improve current schema using AI</div>
                                    </div>
                                </button>
                            </div>
                        </>
                    )}
                </div>
                <div className="w-px h-6 bg-[var(--ide-border)]" />
                <button className="btn-ghost text-sm" onClick={() => setZoom(z => Math.min(z + 0.1, 2))}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                    </svg>
                </button>
                <span className="text-xs text-[var(--ide-text-muted)]">{Math.round(zoom * 100)}%</span>
                <button className="btn-ghost text-sm" onClick={() => setZoom(z => Math.max(z - 0.1, 0.5))}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                    </svg>
                </button>
                <div className="flex-1" />
                <span className="text-xs text-[var(--ide-text-muted)]">
                    {models.length} models
                </span>
            </div>

            {/* Modals */}
            <PromptModal
                isOpen={promptOpen}
                title="New Data Model"
                fields={modelFields}
                confirmText="Create"
                onClose={() => setPromptOpen(false)}
                onSubmit={async (values) => {
                    try {
                        await addDataModel(values.name.trim());
                        toast.success(`Model "${values.name.trim()}" created`);
                    } catch (err) {
                        toast.error(`Failed to create model: ${err}`);
                    }
                }}
            />

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
                        required: true 
                    },
                    {
                        name: "required",
                        label: "Required?",
                        type: "select",
                        options: [
                            { label: "Yes", value: "true" },
                            { label: "No", value: "false" }
                        ],
                        required: true
                    }
                ]}
                confirmText="Add"
                onClose={() => setAddFieldModelId(null)}
                onSubmit={handleAddField}
            />

            <ConfirmModal
                isOpen={generateConfirmOpen}
                title={aiMode === "scratch" ? "Regenerate Schema" : "Improve Schema"}
                message={aiMode === "scratch" 
                    ? "This will DELETE ALL current models and recreate the entire database schema from your project idea. This cannot be undone. Proceed?"
                    : "This will analyze your current models and add any missing fields or tables needed to support your project idea. Proceed?"
                }
                confirmText={aiMode === "scratch" ? "Delete & Regenerate" : "Check & Fix"}
                cancelText="Cancel"
                variant={aiMode === "scratch" ? "danger" : "default"}
                onConfirm={() => handleGenerateConfirm(aiMode)}
                onCancel={() => setGenerateConfirmOpen(false)}
            />

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

            {/* ERD Canvas Area */}
            <div className="flex-1 overflow-auto p-6 md:p-10 relative">
                {models.length > 0 ? (
                    <div
                        className="relative min-h-[600px] min-w-[800px]"
                        style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}
                    >
                        {/* Render relation lines first (behind models) */}
                        <svg className="absolute inset-0 w-full h-full pointer-events-none">
                            <defs>
                                <marker
                                    id="arrowhead"
                                    markerWidth="10"
                                    markerHeight="7"
                                    refX="9"
                                    refY="3.5"
                                    orient="auto"
                                >
                                    <polygon points="0 0, 10 3.5, 0 7" fill="white" fillOpacity="0.4" />
                                </marker>
                            </defs>
                        </svg>

                        {/* Model Cards */}
                        <div className="flex flex-wrap gap-6">
                            {models.map((model, index) => (
                                <ModelCard
                                    key={model.id}
                                    model={model}
                                    selected={selectedModelId === model.id}
                                    onSelect={() => setSelectedModelId(model.id)}
                                    onRequestDelete={() => setDeleteModelTarget({ id: model.id, name: model.name })}
                                    onRequestDeleteField={(fieldName) => setDeleteFieldTarget({ modelId: model.id, fieldName })}
                                    onRequestAddField={() => setAddFieldModelId(model.id)}
                                    position={{ x: (index % 3) * 300 + 50, y: Math.floor(index / 3) * 280 + 50 }}
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

// Model Card Component
interface ModelCardProps {
    model: DataModelSchema;
    selected: boolean;
    onSelect: () => void;
    onRequestDelete: () => void;
    onRequestDeleteField: (fieldName: string) => void;
    onRequestAddField: () => void;
    position: { x: number; y: number };
}

const ModelCard: React.FC<ModelCardProps> = ({ model, selected, onSelect, onRequestDelete, onRequestDeleteField, onRequestAddField }) => {
    return (
        <div
            className={`w-64 rounded-xl border overflow-hidden bg-black/40 backdrop-blur-xl transition-all cursor-move shadow-2xl ${selected
                ? "border-white/40 shadow-white/5"
                : "border-white/10 hover:border-white/30"
                }`}
            onClick={onSelect}
        >
            {/* Model Header */}
            <div className="bg-white/5 px-4 py-3 pb-2.5 border-b border-white/5 flex items-center gap-2">
                <svg className="w-5 h-5 text-[var(--ide-text)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                </svg>
                <span className="font-semibold text-[var(--ide-text)] flex-1">{model.name}</span>
                <button
                    className="p-1 text-white/60 hover:text-red-300 transition-colors rounded"
                    title="Delete model"
                    onClick={(e) => {
                        e.stopPropagation();
                        onRequestDelete();
                    }}
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </button>
            </div>

            {/* Fields */}
            <div className="divide-y divide-white/5">
                {model.fields.length > 0 ? (
                    model.fields.map((field) => (
                        <FieldRow
                            key={`${model.id}-${field.name}`}
                            field={field}
                            modelId={model.id}
                            onRequestDelete={() => onRequestDeleteField(field.name)}
                        />
                    ))
                ) : (
                    <div className="px-4 py-3 text-xs text-[var(--ide-text-muted)] italic">
                        No fields defined
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 bg-black/20 flex items-center justify-between text-xs text-[var(--ide-text-muted)] border-t border-white/5">
                <span className="flex items-center gap-1">
                    {model.timestamps && (
                        <span className="px-1.5 py-0.5 rounded bg-white/5 text-white/40">timestamps</span>
                    )}
                    {model.soft_delete && (
                        <span className="px-1.5 py-0.5 rounded bg-white/5 text-white/40">soft delete</span>
                    )}
                </span>
                <button
                    className="hover:text-white transition-colors"
                    onClick={(e) => {
                        e.stopPropagation();
                        onRequestAddField();
                    }}
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                </button>
            </div>
        </div>
    );
};

// Field Row Component
interface FieldRowProps {
    field: FieldSchema;
    modelId: string;
    onRequestDelete: () => void;
}

const FieldRow: React.FC<FieldRowProps> = ({ field, onRequestDelete }) => {
    const getTypeColor = (): string => {
        switch (field.field_type) {
            default:
                return "text-white/45";
        }
    };

    return (
        <div className="px-4 py-2 flex items-center gap-2 hover:bg-white/[0.03] transition-colors group">
            {/* Key Icon */}
            {field.primary_key && (
                <svg className="w-3 h-3 text-white/60" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12.65 10A5.99 5.99 0 006 5c-3.31 0-6 2.69-6 6s2.68 6 6 6a5.99 5.99 0 006.65-5H18v4h4v-4h2v-2H12.65zM6 15c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z" />
                </svg>
            )}

            {/* Field Name */}
            <span className="text-sm text-[var(--ide-text)] flex-1">
                {field.name}
                {!field.required && (
                    <span className="text-[var(--ide-text-muted)]">?</span>
                )}
            </span>

            {/* Field Type */}
            <span className={`text-xs font-mono ${getTypeColor()}`}>
                {field.field_type}
            </span>

            {/* Unique Badge */}
            {field.unique && (
                <span className="text-[10px] px-1 py-0.5 rounded bg-white/5 text-white/40">
                    unique
                </span>
            )}

            {/* Delete field */}
            {!field.primary_key && (
                <button
                    className="opacity-0 group-hover:opacity-100 text-[var(--ide-text-muted)] hover:text-red-400 transition-all"
                    title="Delete field"
                    onClick={(e) => {
                        e.stopPropagation();
                        onRequestDelete();
                    }}
                >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            )}
        </div>
    );
};

// Empty State
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
                <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shadow-lg">
                    <svg className="w-10 h-10 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                    </svg>
                </div>
                <h3 className="text-lg font-semibold text-[var(--ide-text)] mb-2">
                    Database Designer
                </h3>
                <p className="text-sm text-[var(--ide-text-muted)] mb-6">
                    Design your database schema visually. Create models, define fields, and set up relations.
                </p>
                <div className="flex flex-col gap-3 items-center">
                    <div className="relative" ref={aiHelpRef}>
                        <button
                            className={`px-5 py-2.5 bg-white/10 border border-white/20 text-white font-bold rounded-xl shadow-lg hover:bg-white/15 hover:-translate-y-0.5 transition-all outline-none flex items-center gap-2 pr-2 ${generating ? "opacity-70 cursor-not-allowed" : ""}`}
                            onClick={() => !generating && setAiHelpOpen(!aiHelpOpen)}
                        >
                            {generating ? (
                                <>
                                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    AI Working...
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                                    </svg>
                                    AI Help
                                    <div className="ml-1 w-px h-4 bg-white/20 mx-1" />
                                    <svg className={`w-3.5 h-3.5 transition-transform ${aiHelpOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                    </svg>
                                </>
                            )}
                        </button>

                        {aiHelpOpen && (
                            <div className="absolute bottom-full mb-3 left-0 w-64 bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-scale-in">
                                <div className="p-1 px-3 py-2 border-b border-white/[0.06]">
                                    <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">AI Assistance</span>
                                </div>
                                <div className="p-1.5">
                                    <button
                                        onClick={() => { onGenerate("scratch"); setAiHelpOpen(false); }}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-medium text-[var(--ide-text)] hover:bg-white/5 rounded-lg transition-all text-left group"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/40 group-hover:bg-white/10 group-hover:scale-110 transition-all">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                        </div>
                                        <div>
                                            <div className="font-bold text-sm">Regenerate from Scratch</div>
                                            <div className="text-[10px] text-[var(--ide-text-muted)] font-normal mt-0.5">Wipe current schema and restart</div>
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => { onGenerate("fix"); setAiHelpOpen(false); }}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-medium text-[var(--ide-text)] hover:bg-white/5 rounded-lg transition-all text-left group mt-1"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/40 group-hover:bg-white/10 group-hover:scale-110 transition-all">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        </div>
                                        <div>
                                            <div className="font-bold text-sm">Check and Fix Schema</div>
                                            <div className="text-[10px] text-[var(--ide-text-muted)] font-normal mt-0.5">Add missing fields or fix errors</div>
                                        </div>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-4 w-full justify-center">
                        <div className="h-px bg-white/5 flex-1" />
                        <span className="text-[11px] text-[var(--ide-text-muted)] uppercase tracking-widest font-semibold">or</span>
                        <div className="h-px bg-white/5 flex-1" />
                    </div>
                    <button 
                        className="px-6 py-2.5 bg-white/5 border border-white/10 text-white font-medium rounded-xl hover:bg-white/10 hover:border-white/20 transition-all text-sm shadow-xl mt-1 w-full" 
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
