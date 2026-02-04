/**
 * ERDCanvas Component
 * 
 * Entity-Relationship Diagram editor for database schema design.
 * Allows creating data models with fields and relations.
 */

import { Component, For, Show, createSignal, createMemo } from "solid-js";
import { projectState, addDataModel } from "../../stores/projectStore";
import { DataModelSchema, FieldSchema } from "../../hooks/useTauri";
import PromptModal, { PromptField } from "../UI/PromptModal";
import { useToast } from "../../context/ToastContext";

const ERDCanvas: Component = () => {
    const [selectedModelId, setSelectedModelId] = createSignal<string | null>(null);
    const [zoom, setZoom] = createSignal(1);
    const [promptOpen, setPromptOpen] = createSignal(false);
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

    const models = createMemo(() =>
        projectState.project?.data_models.filter(m => !m.archived) || []
    );

    const handleAddModel = async () => {
        setPromptOpen(true);
    };

    return (
        <div class="h-full flex flex-col bg-ide-bg">
            {/* ERD Toolbar */}
            <div class="h-10 bg-ide-sidebar border-b border-ide-border flex items-center px-4 gap-2">
                <button
                    class="btn-ghost flex items-center gap-1 text-sm"
                    onClick={handleAddModel}
                >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Add Model
                </button>
                <div class="w-px h-6 bg-ide-border" />
                <button class="btn-ghost text-sm" onClick={() => setZoom(z => Math.min(z + 0.1, 2))}>
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                    </svg>
                </button>
                <span class="text-xs text-ide-text-muted">{Math.round(zoom() * 100)}%</span>
                <button class="btn-ghost text-sm" onClick={() => setZoom(z => Math.max(z - 0.1, 0.5))}>
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                    </svg>
                </button>
                <div class="flex-1" />
                <span class="text-xs text-ide-text-muted">
                    {models().length} models
                </span>
            </div>

            <PromptModal
                isOpen={promptOpen()}
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
            <div class="flex-1 overflow-auto p-8">
                <Show
                    when={models().length > 0}
                    fallback={<EmptyERDState onAdd={handleAddModel} />}
                >
                    <div
                        class="relative min-h-[600px] min-w-[800px]"
                        style={{ transform: `scale(${zoom()})`, "transform-origin": "top left" }}
                    >
                        {/* Render relation lines first (behind models) */}
                        <svg class="absolute inset-0 w-full h-full pointer-events-none">
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
                            {/* Relations would be drawn here */}
                        </svg>

                        {/* Model Cards */}
                        <div class="flex flex-wrap gap-6">
                            <For each={models()}>
                                {(model, index) => (
                                    <ModelCard
                                        model={model}
                                        selected={selectedModelId() === model.id}
                                        onSelect={() => setSelectedModelId(model.id)}
                                        position={{ x: (index() % 3) * 300 + 50, y: Math.floor(index() / 3) * 280 + 50 }}
                                    />
                                )}
                            </For>
                        </div>
                    </div>
                </Show>
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

const ModelCard: Component<ModelCardProps> = (props) => {
    return (
        <div
            class={`w-64 rounded-lg border overflow-hidden bg-ide-panel transition-all cursor-move ${props.selected
                    ? "border-ide-accent shadow-lg shadow-ide-accent/20"
                    : "border-ide-border hover:border-ide-accent/50"
                }`}
            onClick={props.onSelect}
        >
            {/* Model Header */}
            <div class="bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-3 flex items-center gap-2">
                <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                </svg>
                <span class="font-semibold text-white">{props.model.name}</span>
            </div>

            {/* Fields */}
            <div class="divide-y divide-ide-border">
                <Show
                    when={props.model.fields.length > 0}
                    fallback={
                        <div class="px-4 py-3 text-xs text-ide-text-muted italic">
                            No fields defined
                        </div>
                    }
                >
                    <For each={props.model.fields}>
                        {(field) => <FieldRow field={field} />}
                    </For>
                </Show>
            </div>

            {/* Footer */}
            <div class="px-4 py-2 bg-ide-sidebar/50 flex items-center justify-between text-xs text-ide-text-muted">
                <span class="flex items-center gap-1">
                    <Show when={props.model.timestamps}>
                        <span class="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">timestamps</span>
                    </Show>
                    <Show when={props.model.soft_delete}>
                        <span class="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">soft delete</span>
                    </Show>
                </span>
                <button class="hover:text-ide-accent transition-colors">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                </button>
            </div>
        </div>
    );
};

// Field Row Component
interface FieldRowProps {
    field: FieldSchema;
}

const FieldRow: Component<FieldRowProps> = (props) => {
    const getTypeColor = (): string => {
        switch (props.field.field_type) {
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
                return "text-ide-text-muted";
        }
    };

    return (
        <div class="px-4 py-2 flex items-center gap-2 hover:bg-ide-bg/50 transition-colors">
            {/* Key Icon */}
            <Show when={props.field.primary_key}>
                <svg class="w-3 h-3 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12.65 10A5.99 5.99 0 006 5c-3.31 0-6 2.69-6 6s2.68 6 6 6a5.99 5.99 0 006.65-5H18v4h4v-4h2v-2H12.65zM6 15c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z" />
                </svg>
            </Show>

            {/* Field Name */}
            <span class="text-sm text-ide-text flex-1">
                {props.field.name}
                <Show when={!props.field.required}>
                    <span class="text-ide-text-muted">?</span>
                </Show>
            </span>

            {/* Field Type */}
            <span class={`text-xs font-mono ${getTypeColor()}`}>
                {props.field.field_type}
            </span>

            {/* Unique Badge */}
            <Show when={props.field.unique}>
                <span class="text-[10px] px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                    unique
                </span>
            </Show>
        </div>
    );
};

// Empty State
interface EmptyERDStateProps {
    onAdd: () => void;
}

const EmptyERDState: Component<EmptyERDStateProps> = (props) => {
    return (
        <div class="h-full flex items-center justify-center">
            <div class="text-center max-w-sm">
                <div class="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center">
                    <svg class="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                    </svg>
                </div>
                <h3 class="text-lg font-semibold text-ide-text mb-2">
                    Database Designer
                </h3>
                <p class="text-sm text-ide-text-muted mb-4">
                    Design your database schema visually. Create models, define fields, and set up relations.
                </p>
                <button class="btn-primary" onClick={props.onAdd}>
                    Create First Model
                </button>
            </div>
        </div>
    );
};

export default ERDCanvas;
