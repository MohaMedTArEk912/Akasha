/**
 * ERDCanvas Component - React version
 * 
 * Entity-Relationship Diagram editor for database schema design.
 * Allows creating data models with fields and relations.
 */

import React, { useState } from "react";
import { addDataModel, addField, archiveDataModel, deleteField } from "../../../stores/projectStore";
import { useProjectStore } from "../../../hooks/useProjectStore";
import { DataModelSchema, FieldSchema } from "../../../hooks/useTauri";
import PromptModal, { PromptField } from "../../UI/PromptModal";
import { useToast } from "../../../context/ToastContext";

const ERDCanvas: React.FC = () => {
    const { project } = useProjectStore();
    const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
    const [zoom, setZoom] = useState(1);
    const [promptOpen, setPromptOpen] = useState(false);
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

    return (
        <div className="h-full flex flex-col bg-[var(--ide-bg)]">
            {/* ERD Toolbar */}
            <div className="h-10 bg-[var(--ide-bg-sidebar)] border-b border-[var(--ide-border)] flex items-center px-4 gap-2">
                <button
                    className="btn-ghost flex items-center gap-1 text-sm"
                    onClick={handleAddModel}
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Add Model
                </button>
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

            {/* ERD Canvas Area */}
            <div className="flex-1 overflow-auto p-8">
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
                                    <polygon points="0 0, 10 3.5, 0 7" fill="#6366f1" />
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
                                    position={{ x: (index % 3) * 300 + 50, y: Math.floor(index / 3) * 280 + 50 }}
                                />
                            ))}
                        </div>
                    </div>
                ) : (
                    <EmptyERDState onAdd={handleAddModel} />
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
    position: { x: number; y: number };
}

const ModelCard: React.FC<ModelCardProps> = ({ model, selected, onSelect }) => {
    const toast = useToast();
    return (
        <div
            className={`w-64 rounded-lg border overflow-hidden bg-ide-panel transition-all cursor-move ${selected
                ? "border-[var(--ide-primary)] shadow-lg shadow-indigo-500/20"
                : "border-[var(--ide-border)] hover:border-indigo-500/50"
                }`}
            onClick={onSelect}
        >
            {/* Model Header */}
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-[var(--ide-text)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                </svg>
                <span className="font-semibold text-[var(--ide-text)] flex-1">{model.name}</span>
                <button
                    className="p-1 text-white/60 hover:text-red-300 transition-colors rounded"
                    title="Delete model"
                    onClick={async (e) => {
                        e.stopPropagation();
                        if (confirm(`Delete model "${model.name}"? This cannot be undone.`)) {
                            try {
                                await archiveDataModel(model.id);
                                toast.success(`Model "${model.name}" deleted`);
                            } catch (err) {
                                toast.error(`Failed to delete model: ${err}`);
                            }
                        }
                    }}
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </button>
            </div>

            {/* Fields */}
            <div className="divide-y divide-[var(--ide-border)]">
                {model.fields.length > 0 ? (
                    model.fields.map((field) => <FieldRow key={`${model.id}-${field.name}`} field={field} modelId={model.id} />)
                ) : (
                    <div className="px-4 py-3 text-xs text-[var(--ide-text-muted)] italic">
                        No fields defined
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 bg-[var(--ide-bg-sidebar)] flex items-center justify-between text-xs text-[var(--ide-text-muted)]">
                <span className="flex items-center gap-1">
                    {model.timestamps && (
                        <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">timestamps</span>
                    )}
                    {model.soft_delete && (
                        <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">soft delete</span>
                    )}
                </span>
                <button
                    className="hover:text-[var(--ide-primary)] transition-colors"
                    onClick={async (e) => {
                        e.stopPropagation();
                        try {
                            await addField(model.id, "newField", "string", true);
                        } catch (err) {
                            toast.error(`Failed to add field: ${err}`);
                        }
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
}

const FieldRow: React.FC<FieldRowProps> = ({ field, modelId }) => {
    const toast = useToast();
    const getTypeColor = (): string => {
        switch (field.field_type) {
            case "string":
            case "text":
                return "text-green-400";
            case "int":
            case "float":
                return "text-blue-400";
            case "boolean":
                return "text-yellow-400";
            case "datetime":
                return "text-purple-400";
            case "uuid":
                return "text-pink-400";
            default:
                return "text-[var(--ide-text-muted)]";
        }
    };

    return (
        <div className="px-4 py-2 flex items-center gap-2 hover:bg-[var(--ide-bg-elevated)] transition-colors group">
            {/* Key Icon */}
            {field.primary_key && (
                <svg className="w-3 h-3 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
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
                <span className="text-[10px] px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                    unique
                </span>
            )}

            {/* Delete field */}
            {!field.primary_key && (
                <button
                    className="opacity-0 group-hover:opacity-100 text-[var(--ide-text-muted)] hover:text-red-400 transition-all"
                    title="Delete field"
                    onClick={async (e) => {
                        e.stopPropagation();
                        if (confirm(`Delete field "${field.name}"?`)) {
                            try {
                                await deleteField(modelId, field.name);
                            } catch (err) {
                                toast.error(`Failed to delete field: ${err}`);
                            }
                        }
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
}

const EmptyERDState: React.FC<EmptyERDStateProps> = ({ onAdd }) => {
    return (
        <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-sm">
                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center">
                    <svg className="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                    </svg>
                </div>
                <h3 className="text-lg font-semibold text-[var(--ide-text)] mb-2">
                    Database Designer
                </h3>
                <p className="text-sm text-[var(--ide-text-muted)] mb-4">
                    Design your database schema visually. Create models, define fields, and set up relations.
                </p>
                <button className="btn-primary" onClick={onAdd}>
                    Create First Model
                </button>
            </div>
        </div>
    );
};

export default ERDCanvas;
