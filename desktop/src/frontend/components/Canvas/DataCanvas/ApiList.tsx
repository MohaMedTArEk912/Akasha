/**
 * ApiList Component - React version
 * 
 * Displays and manages API endpoints in a list view.
 */

import React, { useState, useEffect, useCallback } from "react";
import { addApi, archiveApi, addLogicFlow, setActivePage, updateEndpoint } from "../../../stores/projectStore";
import { useProjectStore } from "../../../hooks/useProjectStore";
import PromptModal from "../../UI/PromptModal";
import { useToast } from "../../../context/ToastContext";
import type { DataShape, ShapeField } from "../../../hooks/useTauri";

const getMethodColor = (method: string): string => {
    switch (method.toUpperCase()) {
        case "GET": return "bg-green-500/20 text-green-400 border-green-500/50";
        case "POST": return "bg-blue-500/20 text-blue-400 border-blue-500/50";
        case "PUT": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/50";
        case "PATCH": return "bg-orange-500/20 text-orange-400 border-orange-500/50";
        case "DELETE": return "bg-red-500/20 text-red-400 border-red-500/50";
        default: return "bg-gray-500/20 text-gray-400 border-gray-500/50";
    }
};

const ApiList: React.FC = () => {
    const { project } = useProjectStore();
    const [selectedApiId, setSelectedApiId] = useState<string | null>(null);
    const [promptOpen, setPromptOpen] = useState(false);
    const toast = useToast();

    const apis = project?.apis.filter(a => !a.archived) || [];
    const selectedApi = apis.find(a => a.id === selectedApiId);

    const handleAddApi = () => setPromptOpen(true);

    return (
        <div className="h-full flex">
            {/* API List */}
            <div className="w-80 bg-[var(--ide-bg-sidebar)] border-r border-[var(--ide-border)] flex flex-col flex-shrink-0">
                {/* Header */}
                <div className="h-10 px-4 flex items-center justify-between border-b border-[var(--ide-border)]">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[var(--ide-text-muted)]">
                        API Endpoints
                    </span>
                    <button
                        className="p-1 hover:bg-[var(--ide-bg-panel)] rounded text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-colors"
                        onClick={handleAddApi}
                        aria-label="Add endpoint"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                    </button>
                </div>

                {/* List */}
                <div className="flex-1 overflow-auto">
                    {apis.length > 0 ? (
                        <div className="p-2 space-y-1">
                            {apis.map((api) => (
                                <button
                                    key={api.id}
                                    className={`w-full text-left p-3 rounded-lg transition-colors ${selectedApiId === api.id
                                        ? "bg-[var(--ide-accent-subtle)] border border-[var(--ide-border-strong)]"
                                        : "hover:bg-[var(--ide-bg-panel)] border border-transparent"
                                        }`}
                                    onClick={() => setSelectedApiId(api.id)}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${getMethodColor(api.method)}`}>
                                            {api.method}
                                        </span>
                                        <span className="text-sm font-mono text-[var(--ide-text)] truncate">
                                            {api.path}
                                        </span>
                                    </div>
                                    <span className="text-xs text-[var(--ide-text-muted)]">{api.name}</span>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="p-4 text-center text-[var(--ide-text-muted)] text-sm">
                            <p>No API endpoints yet</p>
                            <button
                                className="mt-2 text-[var(--ide-primary)] hover:underline"
                                onClick={handleAddApi}
                            >
                                Create your first endpoint
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <PromptModal
                isOpen={promptOpen}
                title="New API Endpoint"
                confirmText="Create"
                fields={[
                    { name: "method", label: "HTTP method", placeholder: "GET", value: "GET", required: true },
                    { name: "path", label: "API path", placeholder: "/api/", value: "/api/", required: true },
                    { name: "name", label: "Endpoint name", placeholder: "ListUsers", required: true },
                ]}
                onClose={() => setPromptOpen(false)}
                onSubmit={async (values) => {
                    try {
                        const method = values.method.trim().toUpperCase();
                        const path = values.path.trim();
                        const name = values.name.trim();
                        await addApi(method, path, name);
                        toast.success(`API "${name}" created`);
                    } catch (err) {
                        toast.error(`Failed to create API: ${err}`);
                    }
                }}
            />

            {/* API Detail Panel */}
            <div className="flex-1 overflow-auto bg-[var(--ide-bg)]">
                {!selectedApi ? (
                    <div className="h-full flex items-center justify-center text-[var(--ide-text-muted)]">
                        <div className="text-center">
                            <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            <p className="text-sm">Select an endpoint to view details</p>
                        </div>
                    </div>
                ) : (
                    <div className="p-6">
                        <EndpointDetail api={selectedApi} onDelete={() => { setSelectedApiId(null); }} />
                    </div>
                )}
            </div>
        </div>
    );
};

/* ============ Endpoint Detail (Editable) ============ */

const SHAPE_TYPES = ['string', 'number', 'boolean', 'object', 'array', 'model'] as const;

const ShapeFieldEditor: React.FC<{
    field: ShapeField;
    onChange: (updated: ShapeField) => void;
    onRemove: () => void;
}> = ({ field, onChange, onRemove }) => (
    <div className="flex items-center gap-2 mb-1.5 group">
        <input
            value={field.name}
            onChange={(e) => onChange({ ...field, name: e.target.value })}
            placeholder="field name"
            className="flex-1 px-2 py-1 text-xs font-mono bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded text-[var(--ide-text)] focus:border-[var(--ide-primary)] focus:outline-none"
        />
        <select
            value={field.field_type}
            onChange={(e) => onChange({ ...field, field_type: e.target.value as ShapeField['field_type'] })}
            className="px-2 py-1 text-xs bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded text-[var(--ide-text-muted)] focus:outline-none"
        >
            {SHAPE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <label className="flex items-center gap-1 text-[10px] text-[var(--ide-text-muted)]">
            <input type="checkbox" checked={field.required} onChange={(e) => onChange({ ...field, required: e.target.checked })} className="rounded" />
            req
        </label>
        <button onClick={onRemove} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity" title="Remove field">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
    </div>
);

const DataShapeEditor: React.FC<{
    label: string;
    shape?: DataShape;
    onChange: (shape: DataShape | undefined) => void;
}> = ({ label, shape, onChange }) => {
    const addField = () => {
        const current: DataShape = shape || { shape_type: 'object', fields: [] };
        const fields = [...(current.fields || []), { name: '', field_type: 'string' as const, required: true }];
        onChange({ ...current, shape_type: 'object', fields });
    };

    const updateField = (idx: number, updated: ShapeField) => {
        const fields = [...(shape?.fields || [])];
        fields[idx] = updated;
        onChange({ ...shape!, fields });
    };

    const removeField = (idx: number) => {
        const fields = (shape?.fields || []).filter((_, i) => i !== idx);
        if (fields.length === 0) {
            onChange(undefined);
        } else {
            onChange({ ...shape!, fields });
        }
    };

    return (
        <div className="bg-[var(--ide-bg-panel)] rounded-lg p-4 border border-[var(--ide-border)]">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-[var(--ide-text)]">{label}</h3>
                <button onClick={addField}
                    className="text-xs px-2 py-1 rounded bg-[var(--ide-primary)]/10 text-[var(--ide-primary)] hover:bg-[var(--ide-primary)]/20 transition-colors">
                    + Field
                </button>
            </div>
            {(!shape || !shape.fields || shape.fields.length === 0) ? (
                <p className="text-xs text-[var(--ide-text-muted)] italic">No fields defined — click "+ Field" to add</p>
            ) : (
                <div>
                    <div className="flex items-center gap-2 mb-1 px-1">
                        <span className="flex-1 text-[10px] uppercase tracking-wider text-[var(--ide-text-muted)]">Name</span>
                        <span className="w-20 text-[10px] uppercase tracking-wider text-[var(--ide-text-muted)]">Type</span>
                        <span className="w-9 text-[10px] uppercase tracking-wider text-[var(--ide-text-muted)]"></span>
                        <span className="w-3.5"></span>
                    </div>
                    {shape.fields.map((field, idx) => (
                        <ShapeFieldEditor
                            key={idx}
                            field={field}
                            onChange={(f) => updateField(idx, f)}
                            onRemove={() => removeField(idx)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

interface EndpointDetailProps {
    api: any;
    onDelete: () => void;
}

const EndpointDetail: React.FC<EndpointDetailProps> = ({ api, onDelete }) => {
    const { project } = useProjectStore();
    const toast = useToast();
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({
        method: api.method,
        path: api.path,
        name: api.name,
        description: api.description || "",
        auth_required: api.auth_required || false,
    });
    const [reqBody, setReqBody] = useState<DataShape | undefined>(api.request_body);
    const [resBody, setResBody] = useState<DataShape | undefined>(api.response_body);
    const backendFlows = (project?.logic_flows || []).filter(
        (flow) => !flow.archived && flow.context === "backend"
    );

    // Reset form when selected api changes
    useEffect(() => {
        setEditData({
            method: api.method,
            path: api.path,
            name: api.name,
            description: api.description || "",
            auth_required: api.auth_required || false,
        });
        setReqBody(api.request_body);
        setResBody(api.response_body);
        setIsEditing(false);
    }, [api.id]);

    const handleSave = async () => {
        try {
            const updates: Record<string, unknown> = {};
            if (editData.method !== api.method) updates.method = editData.method;
            if (editData.path !== api.path) updates.path = editData.path;
            if (editData.name !== api.name) updates.name = editData.name;
            if (editData.description !== (api.description || "")) updates.description = editData.description;
            if (editData.auth_required !== (api.auth_required || false)) updates.auth_required = editData.auth_required;
            if (JSON.stringify(reqBody) !== JSON.stringify(api.request_body)) updates.request_body = reqBody ?? null;
            if (JSON.stringify(resBody) !== JSON.stringify(api.response_body)) updates.response_body = resBody ?? null;
            if (Object.keys(updates).length > 0) {
                await updateEndpoint(api.id, updates);
                toast.success("Endpoint updated");
            }
            setIsEditing(false);
        } catch (err) { toast.error(`Failed to update: ${err}`); }
    };

    const handleDelete = async () => {
        if (!confirm(`Delete endpoint "${api.name}"?`)) return;
        try {
            await archiveApi(api.id);
            onDelete();
            toast.success(`Endpoint "${api.name}" deleted`);
        } catch (err) { toast.error(`Failed to delete: ${err}`); }
    };

    return (
        <>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    {isEditing ? (
                        <>
                            <select value={editData.method}
                                onChange={(e) => setEditData({ ...editData, method: e.target.value })}
                                className={`text-sm font-mono px-2 py-1 rounded border ${getMethodColor(editData.method)} bg-transparent focus:outline-none`}>
                                {HTTP_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                            <input value={editData.path}
                                onChange={(e) => setEditData({ ...editData, path: e.target.value })}
                                className="text-xl font-mono text-[var(--ide-text)] bg-transparent border-b border-[var(--ide-primary)] focus:outline-none"
                            />
                        </>
                    ) : (
                        <>
                            <span className={`text-sm font-mono px-2 py-1 rounded border ${getMethodColor(api.method)}`}>{api.method}</span>
                            <span className="text-xl font-mono text-[var(--ide-text)]">{api.path}</span>
                        </>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    {isEditing ? (
                        <>
                            <button onClick={handleSave} className="px-3 py-1.5 bg-[var(--ide-primary)] hover:bg-[var(--ide-primary-hover)] text-white text-sm rounded">Save</button>
                            <button onClick={() => { setIsEditing(false); setEditData({ method: api.method, path: api.path, name: api.name, description: api.description || "", auth_required: api.auth_required || false }); setReqBody(api.request_body); setResBody(api.response_body); }}
                                className="px-3 py-1.5 bg-[var(--ide-bg-elevated)] text-sm rounded border border-[var(--ide-border)]">Cancel</button>
                        </>
                    ) : (
                        <>
                            <button onClick={() => setIsEditing(true)}
                                className="p-2 text-[var(--ide-text-muted)] hover:text-[var(--ide-primary)] hover:bg-[var(--ide-primary)]/10 rounded transition-colors" title="Edit">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                            <button onClick={handleDelete}
                                className="p-2 text-[var(--ide-text-muted)] hover:text-red-400 hover:bg-red-500/10 rounded transition-colors" title="Delete">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Name & Description */}
            <div className="mb-6">
                {isEditing ? (
                    <>
                        <input value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                            className="text-2xl font-bold text-[var(--ide-text)] bg-transparent border-b border-[var(--ide-border)] focus:border-[var(--ide-primary)] focus:outline-none w-full mb-2"
                            placeholder="Endpoint name" />
                        <textarea value={editData.description} onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                            className="w-full px-3 py-2 bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] rounded text-sm text-[var(--ide-text-muted)] focus:outline-none focus:border-[var(--ide-primary)] resize-none"
                            rows={2} placeholder="Description (optional)" />
                    </>
                ) : (
                    <>
                        <h2 className="text-2xl font-bold text-[var(--ide-text)]">{api.name}</h2>
                        {api.description && <p className="mt-2 text-[var(--ide-text-muted)]">{api.description}</p>}
                    </>
                )}
            </div>

            {/* Sections */}
            <div className="space-y-6">
                {/* Auth */}
                <div className="bg-[var(--ide-bg-panel)] rounded-lg p-4 border border-[var(--ide-border)]">
                    <h3 className="text-sm font-semibold text-[var(--ide-text)] mb-3">Authentication</h3>
                    {isEditing ? (
                        <label className="flex items-center gap-2 text-sm text-[var(--ide-text-secondary)] cursor-pointer">
                            <input type="checkbox" checked={editData.auth_required}
                                onChange={(e) => setEditData({ ...editData, auth_required: e.target.checked })}
                                className="rounded" />
                            Requires authentication (JWT Bearer token)
                        </label>
                    ) : (
                        <div className="flex items-center gap-2">
                            {api.auth_required ? (
                                <>
                                    <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                    <span className="text-sm text-[var(--ide-text)]">Protected — JWT required</span>
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>
                                    <span className="text-sm text-[var(--ide-text-muted)]">Public — no authentication required</span>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Request Preview / Editor */}
                {isEditing ? (
                    <>
                        <div className="bg-[var(--ide-bg-panel)] rounded-lg p-4 border border-[var(--ide-border)] mb-1">
                            <h3 className="text-sm font-semibold text-[var(--ide-text)] mb-2">Request Preview</h3>
                            <div className="bg-[var(--ide-bg)] rounded p-3 font-mono text-sm text-[var(--ide-text-muted)]">
                                <span className="text-green-400">{editData.method}</span>{" "}
                                <span className="text-[var(--ide-text)]">{editData.path}</span>
                                {editData.auth_required && (
                                    <div className="mt-1 text-xs text-yellow-400">Authorization: Bearer &lt;token&gt;</div>
                                )}
                            </div>
                        </div>
                        <DataShapeEditor label="Request Body" shape={reqBody} onChange={setReqBody} />
                    </>
                ) : (
                    <div className="bg-[var(--ide-bg-panel)] rounded-lg p-4 border border-[var(--ide-border)]">
                        <h3 className="text-sm font-semibold text-[var(--ide-text)] mb-3">Request</h3>
                        <div className="bg-[var(--ide-bg)] rounded p-3 font-mono text-sm text-[var(--ide-text-muted)]">
                            <span className="text-green-400">{api.method}</span>{" "}
                            <span className="text-[var(--ide-text)]">{api.path}</span>
                            {api.auth_required && (
                                <div className="mt-1 text-xs text-yellow-400">Authorization: Bearer &lt;token&gt;</div>
                            )}
                        </div>
                        {api.request_body && api.request_body.fields && api.request_body.fields.length > 0 && (
                            <div className="mt-3 bg-[var(--ide-bg)] rounded p-3 font-mono text-xs text-[var(--ide-text-muted)]">
                                <div className="text-[10px] uppercase text-[var(--ide-text-muted)] mb-1">Body Fields</div>
                                {api.request_body.fields.map((f: ShapeField, i: number) => (
                                    <div key={i} className="flex gap-2">
                                        <span className="text-[var(--ide-text)]">{f.name}</span>
                                        <span className="text-purple-400">{f.field_type}</span>
                                        {f.required && <span className="text-red-400">*</span>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Response Body Editor / Preview */}
                {isEditing ? (
                    <DataShapeEditor label="Response Body" shape={resBody} onChange={setResBody} />
                ) : (
                    <div className="bg-[var(--ide-bg-panel)] rounded-lg p-4 border border-[var(--ide-border)]">
                        <h3 className="text-sm font-semibold text-[var(--ide-text)] mb-3">Response</h3>
                        <div className="bg-[var(--ide-bg)] rounded p-3 font-mono text-xs text-[var(--ide-text-muted)]">
                            {api.response_body && api.response_body.fields && api.response_body.fields.length > 0 ? (
                                <div>
                                    {api.response_body.fields.map((f: ShapeField, i: number) => (
                                        <div key={i} className="flex gap-2">
                                            <span className="text-[var(--ide-text)]">{f.name}</span>
                                            <span className="text-purple-400">{f.field_type}</span>
                                            {f.required && <span className="text-red-400">*</span>}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <pre>{`{
  "success": true,
  "data": {}
}`}</pre>
                            )}
                        </div>
                    </div>
                )}

                {/* Logic Flow */}
                <div className="bg-[var(--ide-bg-panel)] rounded-lg p-4 border border-[var(--ide-border)]">
                    <h3 className="text-sm font-semibold text-[var(--ide-text)] mb-3">Handler Logic</h3>
                    <div className="space-y-3">
                        <select
                            value={api.logic_flow_id || ""}
                            onChange={async (e) => {
                                try {
                                    await updateEndpoint(api.id, { logic_flow_id: e.target.value || null });
                                    toast.success(e.target.value ? "Logic flow linked" : "Logic flow unlinked");
                                } catch (err) {
                                    toast.error(`Failed to update logic flow link: ${err}`);
                                }
                            }}
                            className="w-full px-3 py-2 text-sm bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded text-[var(--ide-text)] focus:outline-none focus:border-[var(--ide-primary)]"
                        >
                            <option value="">— No flow linked —</option>
                            {backendFlows.map((flow) => (
                                <option key={flow.id} value={flow.id}>
                                    {flow.name}
                                </option>
                            ))}
                        </select>

                        <button
                            onClick={async () => {
                                try {
                                    const flow = await addLogicFlow(`${api.name}_handler`, "backend");
                                    await updateEndpoint(api.id, { logic_flow_id: flow.id });
                                    toast.success("Logic flow created and linked — switching to Use Cases");
                                    setActivePage("usecases");
                                } catch (err) {
                                    toast.error(`Failed to create logic flow: ${err}`);
                                }
                            }}
                            className="w-full py-3 border-2 border-dashed border-[var(--ide-border)] rounded-lg text-[var(--ide-text-muted)] hover:border-[var(--ide-primary)] hover:text-[var(--ide-primary)] transition-colors"
                        >
                            + Create & Link Logic Flow
                        </button>

                        {api.logic_flow_id && (
                            <p className="text-sm text-[var(--ide-text-muted)]">
                                Connected to logic flow: {api.logic_flow_id}
                            </p>
                        )}
                    </div>
                </div>

                {/* Permissions */}
                <div className="bg-[var(--ide-bg-panel)] rounded-lg p-4 border border-[var(--ide-border)]">
                    <h3 className="text-sm font-semibold text-[var(--ide-text)] mb-3">Permissions</h3>
                    {api.permissions?.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            {api.permissions.map((perm: string) => (
                                <span key={perm} className="px-2 py-1 text-xs rounded bg-purple-500/20 text-purple-400">{perm}</span>
                            ))}
                        </div>
                    ) : (
                        <span className="text-sm text-[var(--ide-text-muted)]">No role-based permissions configured</span>
                    )}
                </div>
            </div>
        </>
    );
};

export default ApiList;
