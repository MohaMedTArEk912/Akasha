/**
 * Variables Panel Component
 * 
 * Full CRUD for project variables — global, page-level, and component-scoped.
 */

import React, { useState } from "react";
import { useProjectStore } from "../../hooks/useProjectStore";
import {
    createVariable,
    updateVariable,
    deleteVariable,
} from "../../stores/projectStore";

const VAR_TYPES = ["String", "Number", "Boolean", "Array", "Object"];
const VAR_SCOPES = [
    { value: "global", label: "Global" },
    { value: "page", label: "Page" },
    { value: "component", label: "Component" },
];

const VariablesPanel: React.FC = () => {
    const { project } = useProjectStore();
    const [isAdding, setIsAdding] = useState(false);
    const [filter, setFilter] = useState<string>("all");
    const [error, setError] = useState<string | null>(null);
    const [newVar, setNewVar] = useState({
        name: "", var_type: "String", scope: "global", default_value: "", description: "", persist: false,
    });

    const variables = project?.variables?.filter(v => !v.archived) || [];
    const filtered = filter === "all" ? variables : variables.filter(v => v.scope === filter);

    const handleCreate = async () => {
        if (!newVar.name.trim()) { setError("Variable name is required"); return; }
        try {
            setError(null);
            await createVariable({
                name: newVar.name.trim(),
                var_type: newVar.var_type,
                scope: newVar.scope,
                default_value: newVar.default_value || undefined,
                description: newVar.description || undefined,
                persist: newVar.persist,
            });
            setNewVar({ name: "", var_type: "String", scope: "global", default_value: "", description: "", persist: false });
            setIsAdding(false);
        } catch (err) { setError(String(err)); }
    };

    const scopeColor: Record<string, string> = {
        global: "bg-blue-500/20 text-blue-400",
        page: "bg-purple-500/20 text-purple-400",
        component: "bg-orange-500/20 text-orange-400",
    };

    const typeColor: Record<string, string> = {
        String: "text-[#ce9178]",
        Number: "text-[#b5cea8]",
        Boolean: "text-[#569cd6]",
        Array: "text-[#dcdcaa]",
        Object: "text-[#4ec9b0]",
    };

    return (
        <div className="h-full flex flex-col bg-[var(--ide-bg)] text-[var(--ide-text)]">
            {/* Header */}
            <div className="p-4 border-b border-[var(--ide-border)] bg-[var(--ide-chrome)]">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <svg className="w-6 h-6 text-[#5a67d8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <h1 className="text-lg font-semibold">Variables</h1>
                        <span className="text-xs text-[var(--ide-text-muted)]">({variables.length})</span>
                    </div>
                    <button onClick={() => setIsAdding(true)}
                        className="px-3 py-1.5 bg-[var(--ide-primary)] hover:bg-[var(--ide-primary-hover)] text-white text-sm rounded transition-colors">
                        + Add Variable
                    </button>
                </div>

                {/* Scope filter */}
                <div className="flex gap-1">
                    {[{ value: "all", label: "All" }, ...VAR_SCOPES].map(s => (
                        <button key={s.value} onClick={() => setFilter(s.value)}
                            className={`px-2 py-1 text-xs rounded transition-colors ${filter === s.value
                                ? "bg-[var(--ide-primary)] text-white"
                                : "bg-[var(--ide-bg-elevated)] text-[var(--ide-text-secondary)] hover:bg-[var(--ide-bg-sidebar)]"
                                }`}>
                            {s.label}
                        </button>
                    ))}
                </div>
            </div>

            {error && (
                <div className="mx-4 mt-4 p-3 bg-[#5a1d1d] border border-[#be1100] rounded text-sm text-[#f48771]">{error}</div>
            )}

            {/* Add Variable Form */}
            {isAdding && (
                <div className="m-4 p-4 bg-[var(--ide-bg-panel)] border border-[var(--ide-border)] rounded space-y-3">
                    <h3 className="text-sm font-medium">New Variable</h3>
                    <div className="grid grid-cols-2 gap-2">
                        <input type="text" value={newVar.name}
                            onChange={(e) => setNewVar({ ...newVar, name: e.target.value })}
                            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                            placeholder="Variable name"
                            className="px-3 py-2 bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] rounded text-sm focus:outline-none focus:border-[var(--ide-primary)]"
                            autoFocus />
                        <select value={newVar.var_type}
                            onChange={(e) => setNewVar({ ...newVar, var_type: e.target.value })}
                            className="px-3 py-2 bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] rounded text-sm focus:outline-none focus:border-[var(--ide-primary)]">
                            {VAR_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <select value={newVar.scope}
                            onChange={(e) => setNewVar({ ...newVar, scope: e.target.value })}
                            className="px-3 py-2 bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] rounded text-sm focus:outline-none focus:border-[var(--ide-primary)]">
                            {VAR_SCOPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                        <input type="text" value={newVar.default_value}
                            onChange={(e) => setNewVar({ ...newVar, default_value: e.target.value })}
                            placeholder="Default value (optional)"
                            className="px-3 py-2 bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] rounded text-sm focus:outline-none focus:border-[var(--ide-primary)]" />
                    </div>
                    <input type="text" value={newVar.description}
                        onChange={(e) => setNewVar({ ...newVar, description: e.target.value })}
                        placeholder="Description (optional)"
                        className="w-full px-3 py-2 bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] rounded text-sm focus:outline-none focus:border-[var(--ide-primary)]" />
                    <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 text-xs text-[var(--ide-text-secondary)]">
                            <input type="checkbox" checked={newVar.persist}
                                onChange={(e) => setNewVar({ ...newVar, persist: e.target.checked })} className="rounded" />
                            Persist to localStorage
                        </label>
                        <div className="flex gap-2">
                            <button onClick={handleCreate}
                                className="px-4 py-2 bg-[var(--ide-primary)] hover:bg-[var(--ide-primary-hover)] text-white text-sm rounded">Create</button>
                            <button onClick={() => { setIsAdding(false); setError(null); }}
                                className="px-4 py-2 bg-[var(--ide-bg-elevated)] text-sm rounded border border-[var(--ide-border)]">Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Variables List */}
            <div className="flex-1 overflow-auto p-4">
                {filtered.length === 0 ? (
                    <div className="text-center py-12">
                        <svg className="w-12 h-12 mx-auto mb-4 text-[var(--ide-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <p className="text-sm text-[var(--ide-text-secondary)]">
                            {filter === "all" ? "No variables defined" : `No ${filter} variables`}
                        </p>
                        <p className="text-xs text-[var(--ide-text-muted)] mt-1">
                            Click "Add Variable" to create one
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {filtered.map((v) => (
                            <VariableRow key={v.id} variable={v} scopeColor={scopeColor} typeColor={typeColor} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

/* ============ Variable Row ============ */

interface VariableRowProps {
    variable: any;
    scopeColor: Record<string, string>;
    typeColor: Record<string, string>;
}

const VariableRow: React.FC<VariableRowProps> = ({ variable, scopeColor, typeColor }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({
        name: variable.name,
        var_type: variable.var_type || variable.variable_type || "String",
        scope: variable.scope || "global",
        default_value: variable.default_value || "",
        description: variable.description || "",
        persist: variable.persist || false,
    });

    const handleSave = async () => {
        try {
            const updates: Record<string, unknown> = {};
            if (editData.name !== variable.name) updates.name = editData.name;
            if (editData.var_type !== (variable.var_type || variable.variable_type)) updates.var_type = editData.var_type;
            if (editData.scope !== (variable.scope || "global")) updates.scope = editData.scope;
            if (editData.default_value !== (variable.default_value || "")) updates.default_value = editData.default_value;
            if (editData.description !== (variable.description || "")) updates.description = editData.description;
            if (editData.persist !== (variable.persist || false)) updates.persist = editData.persist;
            if (Object.keys(updates).length > 0) {
                await updateVariable(variable.id, updates);
            }
            setIsEditing(false);
        } catch (err) { console.error(err); }
    };

    const handleDelete = async () => {
        if (!confirm(`Delete variable "${variable.name}"?`)) return;
        try { await deleteVariable(variable.id); }
        catch (err) { console.error(err); }
    };

    if (isEditing) {
        return (
            <div className="p-4 bg-[var(--ide-bg-panel)] border border-[var(--ide-border)] rounded space-y-2">
                <div className="grid grid-cols-3 gap-2">
                    <input type="text" value={editData.name}
                        onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                        className="px-2 py-1.5 bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] rounded text-sm focus:outline-none focus:border-[var(--ide-primary)]" />
                    <select value={editData.var_type}
                        onChange={(e) => setEditData({ ...editData, var_type: e.target.value })}
                        className="px-2 py-1.5 bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] rounded text-sm focus:outline-none focus:border-[var(--ide-primary)]">
                        {["String", "Number", "Boolean", "Array", "Object"].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <select value={editData.scope}
                        onChange={(e) => setEditData({ ...editData, scope: e.target.value })}
                        className="px-2 py-1.5 bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] rounded text-sm focus:outline-none focus:border-[var(--ide-primary)]">
                        <option value="global">Global</option>
                        <option value="page">Page</option>
                        <option value="component">Component</option>
                    </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <input type="text" value={editData.default_value}
                        onChange={(e) => setEditData({ ...editData, default_value: e.target.value })}
                        placeholder="Default value"
                        className="px-2 py-1.5 bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] rounded text-sm focus:outline-none focus:border-[var(--ide-primary)]" />
                    <input type="text" value={editData.description}
                        onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                        placeholder="Description"
                        className="px-2 py-1.5 bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] rounded text-sm focus:outline-none focus:border-[var(--ide-primary)]" />
                </div>
                <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs text-[var(--ide-text-secondary)]">
                        <input type="checkbox" checked={editData.persist}
                            onChange={(e) => setEditData({ ...editData, persist: e.target.checked })} /> Persist
                    </label>
                    <div className="flex gap-1">
                        <button onClick={handleSave} className="px-3 py-1 bg-[var(--ide-primary)] text-white text-xs rounded">Save</button>
                        <button onClick={() => setIsEditing(false)} className="px-3 py-1 bg-[var(--ide-bg-elevated)] text-xs rounded border border-[var(--ide-border)]">Cancel</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="group flex items-center gap-3 p-3 bg-[var(--ide-bg-panel)] border border-[var(--ide-border)] rounded hover:border-[var(--ide-border-strong)] transition-colors">
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono font-medium text-sm text-[var(--ide-text)]">{variable.name}</span>
                    <span className={`font-mono text-xs ${typeColor[variable.var_type || variable.variable_type] || "text-[#cccccc]"}`}>
                        {variable.var_type || variable.variable_type || "String"}
                    </span>
                    <span className={`px-1.5 py-0.5 text-[9px] rounded ${scopeColor[variable.scope] || scopeColor.global}`}>
                        {variable.scope || "global"}
                    </span>
                    {variable.persist && (
                        <span className="px-1.5 py-0.5 text-[9px] rounded bg-green-500/20 text-green-400">persist</span>
                    )}
                </div>
                {variable.description && (
                    <p className="text-xs text-[var(--ide-text-muted)] truncate">{variable.description}</p>
                )}
                {variable.default_value && (
                    <p className="text-xs text-[var(--ide-text-muted)] font-mono mt-0.5">
                        default: <span className="text-[#ce9178]">{variable.default_value}</span>
                    </p>
                )}
            </div>
            <div className="hidden group-hover:flex items-center gap-1">
                <button onClick={() => setIsEditing(true)}
                    className="p-1.5 text-[var(--ide-text-muted)] hover:text-[var(--ide-primary)] rounded transition-colors" title="Edit">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                </button>
                <button onClick={handleDelete}
                    className="p-1.5 text-[var(--ide-text-muted)] hover:text-red-400 rounded transition-colors" title="Delete">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
            </div>
        </div>
    );
};

export default VariablesPanel;
