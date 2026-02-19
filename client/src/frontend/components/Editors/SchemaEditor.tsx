/**
 * Schema Editor Component
 * 
 * Full CRUD for data models, fields, and relations.
 * Production-ready schema management for SaaS export.
 */

import React, { useState } from "react";
import { useProjectStore } from "../../hooks/useProjectStore";
import {
    addDataModel,
    addField,
    updateField,
    deleteField,
    archiveDataModel,
    updateModel,
    addRelation,
    deleteRelation,
} from "../../stores/projectStore";
import { DataModelSchema, FieldSchema, RelationSchema } from "../../hooks/useTauri";

const FIELD_TYPES = [
    "String", "Int", "Float", "Boolean", "DateTime",
    "Json", "Text", "Uuid", "Email", "Url", "Bytes",
];

const RELATION_TYPES = [
    { value: "one_to_one", label: "One-to-One" },
    { value: "one_to_many", label: "One-to-Many" },
    { value: "many_to_one", label: "Many-to-One" },
    { value: "many_to_many", label: "Many-to-Many" },
];

const SchemaEditor: React.FC = () => {
    const { project, loading } = useProjectStore();
    const [isAddingModel, setIsAddingModel] = useState(false);
    const [newModelName, setNewModelName] = useState("");
    const [error, setError] = useState<string | null>(null);

    const models = project?.data_models?.filter(m => !m.archived) || [];

    const handleAddModel = async () => {
        if (!newModelName.trim()) { setError("Model name is required"); return; }
        try {
            setError(null);
            await addDataModel(newModelName.trim());
            setNewModelName("");
            setIsAddingModel(false);
        } catch (err) { setError(String(err)); }
    };

    return (
        <div className="h-full flex flex-col bg-[var(--ide-bg)] text-[var(--ide-text)]">
            {/* Header */}
            <div className="p-4 border-b border-[var(--ide-border)] flex items-center justify-between bg-[var(--ide-chrome)]">
                <div className="flex items-center gap-3">
                    <svg className="w-6 h-6 text-[#5a67d8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                    </svg>
                    <h1 className="text-lg font-semibold">Database Schema</h1>
                    <span className="text-xs text-[var(--ide-text-muted)]">({models.length} models)</span>
                </div>
                <button
                    onClick={() => setIsAddingModel(true)}
                    className="px-3 py-1.5 bg-[var(--ide-primary)] hover:bg-[var(--ide-primary-hover)] text-white text-sm rounded transition-colors"
                >+ Add Model</button>
            </div>

            {error && (
                <div className="mx-4 mt-4 p-3 bg-[#5a1d1d] border border-[#be1100] rounded text-sm text-[#f48771]">{error}</div>
            )}

            {isAddingModel && (
                <div className="m-4 p-4 bg-[var(--ide-bg-panel)] border border-[var(--ide-border)] rounded">
                    <h3 className="text-sm font-medium mb-3">New Data Model</h3>
                    <input
                        type="text"
                        value={newModelName}
                        onChange={(e) => setNewModelName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAddModel()}
                        placeholder="e.g., User, Product, Order"
                        className="w-full px-3 py-2 bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] rounded text-sm text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)] focus:outline-none focus:border-[var(--ide-primary)] mb-3"
                        autoFocus
                    />
                    <div className="flex gap-2">
                        <button onClick={handleAddModel} disabled={loading}
                            className="px-4 py-2 bg-[var(--ide-primary)] hover:bg-[var(--ide-primary-hover)] text-white text-sm rounded disabled:opacity-50">Create</button>
                        <button onClick={() => { setIsAddingModel(false); setNewModelName(""); setError(null); }}
                            className="px-4 py-2 bg-[var(--ide-bg-elevated)] hover:bg-[var(--ide-bg-sidebar)] text-sm rounded border border-[var(--ide-border)]">Cancel</button>
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-auto p-4">
                {models.length === 0 ? (
                    <div className="text-center py-12">
                        <svg className="w-12 h-12 mx-auto mb-4 text-[var(--ide-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                        </svg>
                        <p className="text-sm text-[var(--ide-text-secondary)]">No data models yet</p>
                        <p className="text-xs text-[var(--ide-text-muted)] mt-1">Click "Add Model" to create your first entity</p>
                    </div>
                ) : (
                    <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
                        {models.map((model) => (
                            <ModelCard key={model.id} model={model} allModels={models} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

/* ============ Model Card ============ */

interface ModelCardProps {
    model: DataModelSchema;
    allModels: DataModelSchema[];
}

const ModelCard: React.FC<ModelCardProps> = ({ model, allModels }) => {
    const [isAddingField, setIsAddingField] = useState(false);
    const [isAddingRelation, setIsAddingRelation] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);
    const [editName, setEditName] = useState(model.name);
    const [showRelations, setShowRelations] = useState(false);
    const [newField, setNewField] = useState({ name: "", fieldType: "String", required: true });
    const [newRelation, setNewRelation] = useState({ name: "", targetModelId: "", relationType: "one_to_many" });
    const [error, setError] = useState<string | null>(null);

    const handleAddField = async () => {
        if (!newField.name.trim()) { setError("Field name is required"); return; }
        try {
            setError(null);
            await addField(model.id, newField.name.trim(), newField.fieldType, newField.required);
            setNewField({ name: "", fieldType: "String", required: true });
            setIsAddingField(false);
        } catch (err) { setError(String(err)); }
    };

    const handleDeleteModel = async () => {
        if (!confirm(`Delete model "${model.name}"?`)) return;
        try { await archiveDataModel(model.id); }
        catch (err) { setError(String(err)); }
    };

    const handleSaveName = async () => {
        if (!editName.trim() || editName.trim() === model.name) { setIsEditingName(false); return; }
        try {
            await updateModel(model.id, { name: editName.trim() });
            setIsEditingName(false);
        } catch (err) { setError(String(err)); }
    };

    const handleAddRelation = async () => {
        if (!newRelation.name.trim() || !newRelation.targetModelId) {
            setError("Relation name and target model are required"); return;
        }
        try {
            setError(null);
            await addRelation(model.id, newRelation.name.trim(), newRelation.targetModelId, newRelation.relationType);
            setNewRelation({ name: "", targetModelId: "", relationType: "one_to_many" });
            setIsAddingRelation(false);
        } catch (err) { setError(String(err)); }
    };

    const handleDeleteRelation = async (relationId: string) => {
        try { await deleteRelation(model.id, relationId); }
        catch (err) { setError(String(err)); }
    };

    const otherModels = allModels.filter(m => m.id !== model.id);

    return (
        <div className="bg-[var(--ide-bg-panel)] border border-[var(--ide-border)] rounded overflow-hidden">
            {/* Model Header */}
            <div className="px-4 py-3 bg-[var(--ide-bg-elevated)] border-b border-[var(--ide-border)] flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <svg className="w-4 h-4 text-[#5a67d8] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7" />
                    </svg>
                    {isEditingName ? (
                        <input
                            type="text" value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onBlur={handleSaveName}
                            onKeyDown={(e) => { if (e.key === "Enter") handleSaveName(); if (e.key === "Escape") setIsEditingName(false); }}
                            className="font-semibold bg-transparent border-b border-[var(--ide-primary)] focus:outline-none text-sm flex-1 min-w-0"
                            autoFocus
                        />
                    ) : (
                        <h3 className="font-semibold truncate cursor-pointer hover:text-[var(--ide-primary)]"
                            onDoubleClick={() => { setEditName(model.name); setIsEditingName(true); }}
                            title="Double-click to rename"
                        >{model.name}</h3>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    {model.timestamps && <span className="px-1.5 py-0.5 bg-[#2d4a3e] text-[#4ec9b0] text-[9px] rounded">ts</span>}
                    {model.soft_delete && <span className="px-1.5 py-0.5 bg-[#3d3a2d] text-[#dcdcaa] text-[9px] rounded">sd</span>}
                    <button onClick={handleDeleteModel} className="ml-1 p-1 text-[var(--ide-text-muted)] hover:text-red-400 transition-colors" title="Delete model">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
            </div>

            {error && <div className="mx-3 mt-3 p-2 bg-[#5a1d1d] border border-[#be1100] rounded text-xs text-[#f48771]">{error}</div>}

            {/* Fields List */}
            <div className="p-3">
                {model.fields?.length > 0 ? (
                    <div className="space-y-0.5">
                        {model.fields.map((field) => (
                            <FieldRow key={field.id || field.name} field={field} modelId={model.id} />
                        ))}
                    </div>
                ) : (
                    <p className="text-xs text-[var(--ide-text-muted)] text-center py-2">No fields defined</p>
                )}
            </div>

            {/* Relations Section */}
            {(model.relations?.length > 0 || showRelations) && (
                <div className="px-3 pb-3">
                    <button onClick={() => setShowRelations(!showRelations)}
                        className="text-[10px] uppercase tracking-wider text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] mb-1">
                        Relations ({model.relations?.length || 0})
                    </button>
                    {showRelations && model.relations?.map((rel) => (
                        <div key={rel.id || rel.name} className="flex items-center gap-2 px-2 py-1 text-xs rounded hover:bg-[var(--ide-bg-elevated)]">
                            <span className="text-[var(--ide-text)] flex-1">{rel.name}</span>
                            <span className="text-[#9cdcfe] font-mono text-[10px]">{rel.relation_type}</span>
                            <span className="text-[var(--ide-text-muted)]">→ {allModels.find(m => m.id === rel.target_model_id)?.name || "?"}</span>
                            <button onClick={() => handleDeleteRelation(rel.id)} className="text-[var(--ide-text-muted)] hover:text-red-400 p-0.5">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Add Relation Form */}
            {isAddingRelation && (
                <div className="p-3 border-t border-[var(--ide-border)] bg-[var(--ide-bg-elevated)]">
                    <div className="space-y-2 mb-2">
                        <input type="text" value={newRelation.name}
                            onChange={(e) => setNewRelation({ ...newRelation, name: e.target.value })}
                            placeholder="Relation name (e.g. posts, author)"
                            className="w-full px-2 py-1.5 bg-[var(--ide-bg-panel)] border border-[var(--ide-border)] rounded text-xs focus:outline-none focus:border-[var(--ide-primary)]"
                            autoFocus />
                        <div className="flex gap-2">
                            <select value={newRelation.targetModelId}
                                onChange={(e) => setNewRelation({ ...newRelation, targetModelId: e.target.value })}
                                className="flex-1 px-2 py-1.5 bg-[var(--ide-bg-panel)] border border-[var(--ide-border)] rounded text-xs focus:outline-none focus:border-[var(--ide-primary)]">
                                <option value="">Target model...</option>
                                {otherModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </select>
                            <select value={newRelation.relationType}
                                onChange={(e) => setNewRelation({ ...newRelation, relationType: e.target.value })}
                                className="px-2 py-1.5 bg-[var(--ide-bg-panel)] border border-[var(--ide-border)] rounded text-xs focus:outline-none focus:border-[var(--ide-primary)]">
                                {RELATION_TYPES.map(rt => <option key={rt.value} value={rt.value}>{rt.label}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                        <button onClick={handleAddRelation} className="px-3 py-1 bg-[var(--ide-primary)] hover:bg-[var(--ide-primary-hover)] text-white text-xs rounded">Add</button>
                        <button onClick={() => setIsAddingRelation(false)} className="px-3 py-1 bg-[var(--ide-bg-panel)] text-xs rounded border border-[var(--ide-border)]">Cancel</button>
                    </div>
                </div>
            )}

            {/* Add Field Form */}
            {isAddingField && (
                <div className="p-3 border-t border-[var(--ide-border)] bg-[var(--ide-bg-elevated)]">
                    <div className="flex gap-2 mb-2">
                        <input type="text" value={newField.name}
                            onChange={(e) => setNewField({ ...newField, name: e.target.value })}
                            onKeyDown={(e) => e.key === "Enter" && handleAddField()}
                            placeholder="Field name"
                            className="flex-1 px-2 py-1.5 bg-[var(--ide-bg-panel)] border border-[var(--ide-border)] rounded text-xs focus:outline-none focus:border-[var(--ide-primary)]"
                            autoFocus />
                        <select value={newField.fieldType}
                            onChange={(e) => setNewField({ ...newField, fieldType: e.target.value })}
                            className="px-2 py-1.5 bg-[var(--ide-bg-panel)] border border-[var(--ide-border)] rounded text-xs focus:outline-none focus:border-[var(--ide-primary)]">
                            {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 text-xs text-[var(--ide-text-secondary)]">
                            <input type="checkbox" checked={newField.required}
                                onChange={(e) => setNewField({ ...newField, required: e.target.checked })} className="rounded" />
                            Required
                        </label>
                        <div className="flex gap-2">
                            <button onClick={handleAddField} className="px-3 py-1 bg-[var(--ide-primary)] hover:bg-[var(--ide-primary-hover)] text-white text-xs rounded">Add</button>
                            <button onClick={() => { setIsAddingField(false); setNewField({ name: "", fieldType: "String", required: true }); setError(null); }}
                                className="px-3 py-1 bg-[var(--ide-bg-panel)] text-xs rounded border border-[var(--ide-border)]">Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Action buttons */}
            {!isAddingField && !isAddingRelation && (
                <div className="flex border-t border-[var(--ide-border)]">
                    <button onClick={() => setIsAddingField(true)}
                        className="flex-1 py-2 text-xs text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-bg-elevated)] transition-colors">
                        + Field
                    </button>
                    <div className="w-px bg-[var(--ide-border)]" />
                    <button onClick={() => { setIsAddingRelation(true); setShowRelations(true); }}
                        className="flex-1 py-2 text-xs text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-bg-elevated)] transition-colors">
                        + Relation
                    </button>
                </div>
            )}
        </div>
    );
};

/* ============ Field Row ============ */

interface FieldRowProps {
    field: FieldSchema;
    modelId: string;
}

const FieldRow: React.FC<FieldRowProps> = ({ field, modelId }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({
        name: field.name,
        field_type: field.field_type,
        required: field.required,
        unique: field.unique,
    });

    const typeColor: Record<string, string> = {
        String: "text-[#ce9178]", Int: "text-[#b5cea8]", Float: "text-[#b5cea8]",
        Boolean: "text-[#569cd6]", DateTime: "text-[#4ec9b0]", Json: "text-[#dcdcaa]",
        Text: "text-[#ce9178]", Uuid: "text-[#9cdcfe]", Email: "text-[#ce9178]",
        Url: "text-[#ce9178]", Bytes: "text-[#cccccc]",
    };

    const handleSave = async () => {
        try {
            const updates: Record<string, unknown> = {};
            if (editData.name !== field.name) updates.name = editData.name;
            if (editData.field_type !== field.field_type) updates.field_type = editData.field_type;
            if (editData.required !== field.required) updates.required = editData.required;
            if (editData.unique !== field.unique) updates.unique = editData.unique;
            if (Object.keys(updates).length > 0) {
                await updateField(modelId, field.id, updates as any);
            }
            setIsEditing(false);
        } catch (err) { console.error(err); }
    };

    const handleDelete = async () => {
        try { await deleteField(modelId, field.id); }
        catch (err) { console.error(err); }
    };

    if (isEditing) {
        return (
            <div className="p-2 bg-[var(--ide-bg-elevated)] rounded border border-[var(--ide-border)] space-y-2">
                <div className="flex gap-2">
                    <input type="text" value={editData.name}
                        onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                        className="flex-1 px-2 py-1 bg-[var(--ide-bg-panel)] border border-[var(--ide-border)] rounded text-xs focus:outline-none focus:border-[var(--ide-primary)]" />
                    <select value={editData.field_type}
                        onChange={(e) => setEditData({ ...editData, field_type: e.target.value })}
                        className="px-2 py-1 bg-[var(--ide-bg-panel)] border border-[var(--ide-border)] rounded text-xs focus:outline-none focus:border-[var(--ide-primary)]">
                        {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
                <div className="flex items-center justify-between">
                    <div className="flex gap-3">
                        <label className="flex items-center gap-1 text-[10px] text-[var(--ide-text-secondary)]">
                            <input type="checkbox" checked={editData.required}
                                onChange={(e) => setEditData({ ...editData, required: e.target.checked })} /> Req
                        </label>
                        <label className="flex items-center gap-1 text-[10px] text-[var(--ide-text-secondary)]">
                            <input type="checkbox" checked={editData.unique}
                                onChange={(e) => setEditData({ ...editData, unique: e.target.checked })} /> Unique
                        </label>
                    </div>
                    <div className="flex gap-1">
                        <button onClick={handleSave} className="px-2 py-0.5 bg-[var(--ide-primary)] text-white text-[10px] rounded">Save</button>
                        <button onClick={() => setIsEditing(false)} className="px-2 py-0.5 bg-[var(--ide-bg-panel)] text-[10px] rounded border border-[var(--ide-border)]">Cancel</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="group flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[var(--ide-bg-elevated)] text-xs">
            <span className="text-[var(--ide-text)] font-medium flex-1 truncate">{field.name}</span>
            <span className={`font-mono ${typeColor[field.field_type] || "text-[#cccccc]"}`}>{field.field_type}</span>
            {field.primary_key && <span className="px-1 py-0.5 bg-[#3d3a2d] text-[#dcdcaa] text-[9px] rounded">PK</span>}
            {field.required && !field.primary_key && <span className="px-1 py-0.5 bg-[#5a1d1d] text-[#f48771] text-[9px] rounded">req</span>}
            {field.unique && <span className="px-1 py-0.5 bg-[#2d4a3e] text-[#4ec9b0] text-[9px] rounded">uniq</span>}
            {!field.primary_key && (
                <div className="hidden group-hover:flex items-center gap-0.5">
                    <button onClick={() => { setEditData({ name: field.name, field_type: field.field_type, required: field.required, unique: field.unique }); setIsEditing(true); }}
                        className="p-0.5 text-[var(--ide-text-muted)] hover:text-[var(--ide-primary)]" title="Edit">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                    </button>
                    <button onClick={handleDelete} className="p-0.5 text-[var(--ide-text-muted)] hover:text-red-400" title="Delete">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                </div>
            )}
        </div>
    );
};

export default SchemaEditor;