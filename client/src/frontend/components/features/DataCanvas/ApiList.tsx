import React, { useState, useEffect, useMemo } from "react";
import { addApi, archiveApi, updateEndpoint } from "../../../stores/projectStore";
import { useProjectStore } from "../../../hooks/useProjectStore";
import { useToast } from "../../../context/ToastContext";
import type { DataShape, ShapeField } from "../../../hooks/useApi";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getMethodStyle = (method: string) => {
    switch (method.toUpperCase()) {
        case "GET": return { text: "#10b981", bg: "rgba(16,185,129,0.1)", border: "rgba(16,185,129,0.3)" };
        case "POST": return { text: "#3b82f6", bg: "rgba(59,130,246,0.1)", border: "rgba(59,130,246,0.3)" };
        case "PUT": return { text: "#f59e0b", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.3)" };
        case "PATCH": return { text: "#8b5cf6", bg: "rgba(139,92,246,0.1)", border: "rgba(139,92,246,0.3)" };
        case "DELETE": return { text: "#ef4444", bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.3)" };
        default: return { text: "#9ca3af", bg: "rgba(156,163,175,0.1)", border: "rgba(156,163,175,0.3)" };
    }
};

const SHAPE_TYPES = ['string', 'number', 'boolean', 'object', 'array', 'model'] as const;
const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

// ─── Icons ────────────────────────────────────────────────────────────────────
const IconSearch = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>;
const IconPlus = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>;
const IconClose = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>;
const IconTrash = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>;
const IconLock = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;
const IconLink = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>;

// ─── Common Styles ────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
    width: "100%", background: "rgba(168,85,247,0.04)",
    border: "1px solid rgba(168,85,247,0.15)", borderRadius: 8,
    color: "#f3e8ff", fontSize: 13, padding: "9px 12px",
    outline: "none", fontFamily: "inherit", boxSizing: "border-box",
    transition: "border-color 0.2s",
};

const labelStyle: React.CSSProperties = {
    fontSize: 10.5, fontFamily: "'Space Mono', monospace",
    letterSpacing: "0.08em", color: "rgba(168,85,247,0.55)",
    textTransform: "uppercase", display: "block", marginBottom: 6,
};

// ─── Sub-Components ───────────────────────────────────────────────────────────

const ApiTester: React.FC<{ api: any }> = ({ api }) => {
    const [baseUrl, setBaseUrl] = useState("http://localhost:8000");
    const [path, setPath] = useState(api.path);
    const [headers, setHeaders] = useState(
        api.auth_required ? '{\n  "Authorization": "Bearer YOUR_TOKEN"\n}' : "{}"
    );
    const [body, setBody] = useState("{\n  \n}");
    const [response, setResponse] = useState<{ status: number; data: any; time: number } | null>(null);
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        setPath(api.path);
        setHeaders(api.auth_required ? '{\n  "Authorization": "Bearer YOUR_TOKEN"\n}' : "{}");
    }, [api.id, api.path, api.auth_required]);

    const handleSend = async () => {
        setIsLoading(true);
        setError("");
        setResponse(null);
        try {
            let parsedHeaders: any = {};
            try {
                if (headers.trim()) parsedHeaders = JSON.parse(headers);
            } catch (e) {
                throw new Error("Invalid JSON in headers");
            }

            if (!parsedHeaders['Content-Type'] && ['POST', 'PUT', 'PATCH'].includes(api.method)) {
                parsedHeaders['Content-Type'] = 'application/json';
            }

            const url = baseUrl.replace(/\/$/, '') + '/' + path.replace(/^\//, '');
            const options: RequestInit = {
                method: api.method,
                headers: parsedHeaders,
            };

            if (['POST', 'PUT', 'PATCH'].includes(api.method)) {
                options.body = body;
            }

            const start = Date.now();
            const res = await fetch(url, options);
            const time = Date.now() - start;

            let data;
            const contentType = res.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
                data = await res.json();
            } else {
                data = await res.text();
            }

            setResponse({ status: res.status, data, time });
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* URL Row */}
            <div style={{ display: "flex", gap: 8 }}>
                <input style={{ ...inputStyle, width: "30%", fontFamily: "'Space Mono', monospace" }}
                    value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="http://localhost:3000" />
                <input style={{ ...inputStyle, flex: 1, fontFamily: "'Space Mono', monospace" }}
                    value={path} onChange={e => setPath(e.target.value)} placeholder="/api/endpoint" />
                <button
                    onClick={handleSend} disabled={isLoading}
                    style={{
                        background: isLoading ? "rgba(168,85,247,0.2)" : "linear-gradient(135deg, rgba(168,85,247,0.3) 0%, rgba(168,85,247,0.15) 100%)",
                        border: "1px solid rgba(168,85,247,0.4)", borderRadius: 8,
                        color: "#e9d5ff", cursor: isLoading ? "default" : "pointer", padding: "0 24px",
                        fontSize: 13, fontFamily: "inherit", fontWeight: 600,
                        boxShadow: isLoading ? "none" : "0 0 16px rgba(168,85,247,0.1)",
                    }}
                >{isLoading ? "..." : "Send"}</button>
            </div>

            <div style={{ display: "flex", gap: 16, height: 380 }}>
                {/* Left Col */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
                    <div style={{ flexShrink: 0 }}>
                        <label style={labelStyle}>Headers (JSON)</label>
                        <textarea style={{ ...inputStyle, height: 80, resize: "none", fontFamily: "'Space Mono', monospace" }}
                            value={headers} onChange={e => setHeaders(e.target.value)} />
                    </div>
                    {['POST', 'PUT', 'PATCH'].includes(api.method) && (
                        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                            <label style={labelStyle}>Body (JSON)</label>
                            <textarea style={{ ...inputStyle, flex: 1, resize: "none", fontFamily: "'Space Mono', monospace" }}
                                value={body} onChange={e => setBody(e.target.value)} />
                        </div>
                    )}
                </div>

                {/* Right Col */}
                <div style={{
                    flex: 1, background: "rgba(10,5,20,0.5)", border: "1px solid rgba(168,85,247,0.15)",
                    borderRadius: 12, display: "flex", flexDirection: "column", overflow: "hidden"
                }}>
                    <div style={{
                        padding: "12px 16px", borderBottom: "1px solid rgba(168,85,247,0.1)",
                        display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(168,85,247,0.03)"
                    }}>
                        <span style={{ fontSize: 11, fontFamily: "'Space Mono', monospace", color: "rgba(168,85,247,0.5)", letterSpacing: "0.1em" }}>RESPONSE</span>
                        {response && (
                            <div style={{ display: "flex", gap: 12, fontSize: 11, fontFamily: "'Space Mono', monospace" }}>
                                <span style={{ color: response.status < 300 ? "#10b981" : "#ef4444" }}>STATUS: {response.status}</span>
                                <span style={{ color: "rgba(216,180,254,0.6)" }}>TIME: {response.time}ms</span>
                            </div>
                        )}
                    </div>
                    <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
                        {error ? (
                            <div style={{ color: "#ef4444", fontSize: 13, fontFamily: "'Space Mono', monospace" }}>{error}</div>
                        ) : response ? (
                            <pre style={{ margin: 0, color: "#f3e8ff", fontSize: 12, fontFamily: "'Space Mono', monospace", whiteSpace: "pre-wrap" }}>
                                {typeof response.data === 'object' ? JSON.stringify(response.data, null, 2) : response.data}
                            </pre>
                        ) : (
                            <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(168,85,247,0.3)", fontSize: 13 }}>
                                No response yet
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const ShapeFieldEditor: React.FC<{
    field: ShapeField; onChange: (updated: ShapeField) => void; onRemove: () => void;
}> = ({ field, onChange, onRemove }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <input style={{ ...inputStyle, flex: 1, padding: "6px 10px", fontSize: 12 }}
            value={field.name} onChange={(e) => onChange({ ...field, name: e.target.value })} placeholder="field_name" />
        <select style={{ ...inputStyle, width: 100, padding: "6px 10px", fontSize: 12, cursor: "pointer" }}
            value={field.field_type} onChange={(e) => onChange({ ...field, field_type: e.target.value as ShapeField['field_type'] })}>
            {SHAPE_TYPES.map(t => <option key={t} value={t} style={{ background: "#0e0618" }}>{t}</option>)}
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "rgba(216,180,254,0.6)", cursor: "pointer" }}>
            <input type="checkbox" checked={field.required} onChange={(e) => onChange({ ...field, required: e.target.checked })} /> req
        </label>
        <button onClick={onRemove} style={{
            background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", opacity: 0.7, padding: 4
        }} title="Remove"><IconClose /></button>
    </div>
);

const DataShapeEditor: React.FC<{ label: string; shape?: DataShape; onChange: (s: DataShape | undefined) => void; }> = ({ label, shape, onChange }) => {
    const addField = () => {
        const current: DataShape = shape || { shape_type: 'object', fields: [] };
        onChange({ ...current, shape_type: 'object', fields: [...(current.fields || []), { name: '', field_type: 'string', required: true }] });
    };
    const updateField = (idx: number, updated: ShapeField) => {
        const fields = [...(shape?.fields || [])];
        fields[idx] = updated;
        onChange({ ...shape!, fields });
    };
    const removeField = (idx: number) => {
        const fields = (shape?.fields || []).filter((_, i) => i !== idx);
        onChange(fields.length === 0 ? undefined : { ...shape!, fields });
    };

    return (
        <div style={{ background: "rgba(10,5,20,0.4)", border: "1px dashed rgba(168,85,247,0.2)", borderRadius: 12, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={labelStyle}>{label}</span>
                <button onClick={addField} style={{
                    background: "rgba(168,85,247,0.1)", border: "none", borderRadius: 4,
                    color: "#c084fc", fontSize: 11, padding: "4px 8px", cursor: "pointer"
                }}>+ Add Field</button>
            </div>
            {(!shape || !shape.fields || shape.fields.length === 0) ? (
                <div style={{ fontSize: 12, color: "rgba(216,180,254,0.4)", fontStyle: "italic" }}>No fields defined.</div>
            ) : (
                <div>
                    {shape.fields.map((f, i) => <ShapeFieldEditor key={i} field={f} onChange={c => updateField(i, c)} onRemove={() => removeField(i)} />)}
                </div>
            )}
        </div>
    );
};

// ─── Api Editor Modal ─────────────────────────────────────────────────────────

const ApiEditorModal = ({
    api, onSave, onDelete, onClose
}: {
    api: any; onSave: (id: string, updates: any) => Promise<void>; onDelete: (id: string) => Promise<void>; onClose: () => void;
}) => {
    const { project } = useProjectStore();
    const [activeTab, setActiveTab] = useState<"design" | "test">("design");
    const [editData, setEditData] = useState({
        method: api.method, path: api.path, name: api.name,
        description: api.description || "", auth_required: api.auth_required || false,
    });
    const [reqBody, setReqBody] = useState<DataShape | undefined>(api.request_body);
    const [resBody, setResBody] = useState<DataShape | undefined>(api.response_body);
    const [logicFlowId, setLogicFlowId] = useState(api.logic_flow_id || "");

    const backendFlows = (project?.logic_flows || []).filter(f => !f.archived && f.context === "backend");

    const handleSave = async () => {
        const updates: any = {};
        if (editData.method !== api.method) updates.method = editData.method;
        if (editData.path !== api.path) updates.path = editData.path;
        if (editData.name !== api.name) updates.name = editData.name;
        if (editData.description !== (api.description || "")) updates.description = editData.description;
        if (editData.auth_required !== (api.auth_required || false)) updates.auth_required = editData.auth_required;
        if (JSON.stringify(reqBody) !== JSON.stringify(api.request_body)) updates.request_body = reqBody ?? null;
        if (JSON.stringify(resBody) !== JSON.stringify(api.response_body)) updates.response_body = resBody ?? null;
        if (logicFlowId !== (api.logic_flow_id || "")) updates.logic_flow_id = logicFlowId || null;

        await onSave(api.id, updates);
    };

    return (
        <div style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(6,2,12,0.85)", backdropFilter: "blur(8px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        }}>
            <div style={{
                background: "linear-gradient(145deg, #160a28 0%, #0e0618 100%)",
                border: "1px solid rgba(168,85,247,0.2)", borderRadius: 16, width: "100%", maxWidth: 860,
                maxHeight: "90vh", display: "flex", flexDirection: "column",
                boxShadow: "0 0 0 1px rgba(168,85,247,0.05), 0 24px 80px rgba(0,0,0,0.7)",
                overflow: "hidden",
            }}>
                {/* Header */}
                <div style={{
                    padding: "20px 24px", borderBottom: "1px solid rgba(168,85,247,0.08)",
                    display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
                }}>
                    <div style={{ flex: 1, display: "flex", gap: 16, alignItems: "center" }}>
                        <select style={{ ...inputStyle, width: 100, fontWeight: 700, cursor: "pointer", ...getMethodStyle(editData.method) }}
                            value={editData.method} onChange={e => setEditData({ ...editData, method: e.target.value })}>
                            {HTTP_METHODS.map(m => <option key={m} value={m} style={{ background: "#0e0618" }}>{m}</option>)}
                        </select>
                        <input style={{ ...inputStyle, flex: 1, fontSize: 16, fontFamily: "'Space Mono', monospace", background: "transparent", border: "none", borderBottom: "1px solid rgba(168,85,247,0.3)", borderRadius: 0 }}
                            value={editData.path} onChange={e => setEditData({ ...editData, path: e.target.value })} placeholder="/api/endpoint" />
                    </div>
                    <button onClick={onClose} style={{
                        background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 8, color: "rgba(216,180,254,0.6)", cursor: "pointer",
                        padding: "6px 8px", marginLeft: 16
                    }}><IconClose /></button>
                </div>

                {/* Tabs */}
                <div style={{ display: "flex", padding: "0 24px", borderBottom: "1px solid rgba(168,85,247,0.08)", flexShrink: 0 }}>
                    <button onClick={() => setActiveTab("design")} style={{
                        background: "none", border: "none", cursor: "pointer", padding: "12px 16px 10px", fontSize: 12.5,
                        fontFamily: "'Space Mono', monospace", letterSpacing: "0.03em",
                        color: activeTab === "design" ? "#c084fc" : "rgba(216,180,254,0.45)",
                        borderBottom: `2px solid ${activeTab === "design" ? "#c084fc" : "transparent"}`, transition: "all 0.2s", marginBottom: -1,
                    }}>Design Schema</button>
                    <button onClick={() => setActiveTab("test")} style={{
                        background: "none", border: "none", cursor: "pointer", padding: "12px 16px 10px", fontSize: 12.5,
                        fontFamily: "'Space Mono', monospace", letterSpacing: "0.03em",
                        color: activeTab === "test" ? "#c084fc" : "rgba(216,180,254,0.45)",
                        borderBottom: `2px solid ${activeTab === "test" ? "#c084fc" : "transparent"}`, transition: "all 0.2s", marginBottom: -1,
                    }}>Test API</button>
                </div>

                {/* Body */}
                <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
                    {activeTab === "design" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                            {/* Meta */}
                            <div style={{ display: "flex", gap: 16 }}>
                                <div style={{ flex: 1 }}>
                                    <label style={labelStyle}>Endpoint Name</label>
                                    <input style={inputStyle} value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })} placeholder="e.g. GetUser" />
                                </div>
                                <div style={{ flex: 2 }}>
                                    <label style={labelStyle}>Description</label>
                                    <input style={inputStyle} value={editData.description} onChange={e => setEditData({ ...editData, description: e.target.value })} placeholder="What does this do?" />
                                </div>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                                {/* Left Col */}
                                <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                                    <div>
                                        <label style={labelStyle}>Authentication</label>
                                        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#f3e8ff", cursor: "pointer", background: "rgba(10,5,20,0.4)", padding: 12, borderRadius: 8, border: "1px solid rgba(168,85,247,0.15)" }}>
                                            <input type="checkbox" checked={editData.auth_required} onChange={e => setEditData({ ...editData, auth_required: e.target.checked })} />
                                            Requires JWT Bearer Token
                                        </label>
                                    </div>
                                    <DataShapeEditor label="Request Body" shape={reqBody} onChange={setReqBody} />
                                </div>

                                {/* Right Col */}
                                <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                                    <div>
                                        <label style={labelStyle}>Logic Flow Handler</label>
                                        <select style={{ ...inputStyle, cursor: "pointer" }} value={logicFlowId} onChange={e => setLogicFlowId(e.target.value)}>
                                            <option value="" style={{ background: "#0e0618" }}>— No flow linked —</option>
                                            {backendFlows.map(f => <option key={f.id} value={f.id} style={{ background: "#0e0618" }}>{f.name}</option>)}
                                        </select>
                                    </div>
                                    <DataShapeEditor label="Response Body" shape={resBody} onChange={setResBody} />
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === "test" && (
                        <ApiTester api={{ ...api, ...editData, request_body: reqBody }} />
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: "14px 24px", borderTop: "1px solid rgba(168,85,247,0.08)",
                    display: "flex", justifyContent: "space-between", flexShrink: 0,
                }}>
                    <button onClick={() => onDelete(api.id)} style={{
                        background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.2)",
                        borderRadius: 8, color: "#ef4444", cursor: "pointer", padding: "9px 16px", fontSize: 13,
                        display: "flex", alignItems: "center", gap: 6
                    }}><IconTrash /> Delete API</button>
                    <div style={{ display: "flex", gap: 10 }}>
                        <button onClick={onClose} style={{
                            background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: 8, color: "rgba(216,180,254,0.6)", cursor: "pointer",
                            padding: "9px 20px", fontSize: 13, fontFamily: "inherit",
                        }}>Cancel</button>
                        <button onClick={handleSave} style={{
                            background: "linear-gradient(135deg, rgba(168,85,247,0.3) 0%, rgba(168,85,247,0.15) 100%)",
                            border: "1px solid rgba(168,85,247,0.4)", borderRadius: 8,
                            color: "#e9d5ff", cursor: "pointer", padding: "9px 22px",
                            fontSize: 13, fontFamily: "inherit", fontWeight: 600,
                            boxShadow: "0 0 16px rgba(168,85,247,0.1)",
                        }}>Save Changes</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── Api Card ─────────────────────────────────────────────────────────────────

const ApiCard = ({ api, onClick }: { api: any; onClick: () => void }) => {
    const [hovered, setHovered] = useState(false);
    const ms = getMethodStyle(api.method);

    return (
        <div
            onClick={onClick}
            onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
            style={{
                position: "relative",
                background: hovered ? "linear-gradient(135deg, rgba(168,85,247,0.06) 0%, rgba(14,6,24,0.95) 60%)" : "rgba(14,6,24,0.85)",
                border: `1px solid ${hovered ? "rgba(168,85,247,0.35)" : "rgba(168,85,247,0.15)"}`,
                borderRadius: 12, padding: "20px 22px", cursor: "pointer",
                transition: "all 0.22s cubic-bezier(0.4,0,0.2,1)", backdropFilter: "blur(12px)",
                boxShadow: hovered ? "0 0 0 1px rgba(168,85,247,0.12), 0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(168,85,247,0.05)" : "0 2px 8px rgba(0,0,0,0.3)",
                transform: hovered ? "translateY(-2px)" : "none", overflow: "hidden",
            }}
        >
            <div style={{
                position: "absolute", top: 0, left: 22, right: 22, height: 1,
                background: hovered ? `linear-gradient(90deg, transparent, ${ms.text}88, transparent)` : "transparent",
                transition: "all 0.3s ease",
            }} />

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <span style={{
                    fontSize: 10, fontFamily: "'Space Mono', monospace", padding: "3px 8px", borderRadius: 4,
                    background: ms.bg, color: ms.text, border: `1px solid ${ms.border}`, fontWeight: 600
                }}>{api.method}</span>
                {api.auth_required && <div style={{ color: "rgba(245,158,11,0.8)" }} title="Requires Auth"><IconLock /></div>}
            </div>

            <h3 style={{ margin: "0 0 4px", fontSize: 16, fontFamily: "'Outfit', sans-serif", fontWeight: 600, color: "#f3e8ff", lineHeight: 1.3 }}>{api.name}</h3>
            <p style={{ margin: "0 0 16px", fontSize: 13, fontFamily: "'Space Mono', monospace", color: "rgba(216,180,254,0.7)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {api.path}
            </p>

            <div style={{ borderTop: "1px solid rgba(168,85,247,0.1)", paddingTop: 12, display: "flex", alignItems: "center", gap: 6 }}>
                {api.logic_flow_id ? (
                    <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#a855f7" }}><IconLink /> Handler Linked</span>
                ) : (
                    <span style={{ fontSize: 11, color: "rgba(216,180,254,0.4)" }}>No Handler</span>
                )}
            </div>
        </div>
    );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const ApiList: React.FC = () => {
    const { project } = useProjectStore();
    const toast = useToast();
    const [search, setSearch] = useState("");
    const [methodFilter, setMethodFilter] = useState("ALL");
    const [selectedApi, setSelectedApi] = useState<any>(null);

    const apis = project?.apis.filter(a => !a.archived) || [];

    const filtered = useMemo(() => {
        let res = apis;
        if (methodFilter !== "ALL") res = res.filter(a => a.method === methodFilter);
        if (search) {
            const q = search.toLowerCase();
            res = res.filter(a => a.name.toLowerCase().includes(q) || a.path.toLowerCase().includes(q));
        }
        return res;
    }, [apis, search, methodFilter]);

    const handleCreate = async () => {
        try {
            await addApi("GET", "/api/new-endpoint", "NewEndpoint");
            toast.success("New endpoint created");
        } catch (err) { toast.error("Failed to create endpoint"); }
    };

    const handleSave = async (id: string, updates: any) => {
        try {
            await updateEndpoint(id, updates);
            toast.success("Endpoint saved");
            setSelectedApi(null);
        } catch (err) { toast.error("Failed to save endpoint"); }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Are you sure you want to delete this endpoint?")) return;
        try {
            await archiveApi(id);
            toast.success("Endpoint deleted");
            setSelectedApi(null);
        } catch (err) { toast.error("Failed to delete endpoint"); }
    };

    return (
        <div style={{
            height: "100%", overflowY: "auto", position: "relative",
            background: "linear-gradient(135deg, #090514 0%, #0d061c 50%, #090514 100%)",
            fontFamily: "'Outfit', 'Space Mono', sans-serif", color: "#f3e8ff",
        }}>
            {/* Background grid */}
            <div style={{
                position: "fixed", inset: 0, pointerEvents: "none",
                backgroundImage: `linear-gradient(rgba(168,85,247,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(168,85,247,0.03) 1px, transparent 1px)`,
                backgroundSize: "48px 48px",
            }} />

            <div style={{ position: "relative", maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>
                {/* Header */}
                <div style={{ marginBottom: 32, display: "flex", alignItems: "flex-start", justifyItems: "space-between" }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                            <div style={{ width: 6, height: 24, background: "linear-gradient(180deg, #c084fc, rgba(168,85,247,0.2))", borderRadius: 3 }} />
                            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: "-0.025em", color: "#f3e8ff" }}>
                                API Endpoints
                            </h1>
                        </div>
                        <p style={{ margin: 0, fontSize: 13.5, color: "rgba(216,180,254,0.5)", paddingLeft: 16, fontFamily: "'Space Mono', monospace" }}>
                            {apis.length} total endpoints · Architect your backend routing
                        </p>
                    </div>
                    <button onClick={handleCreate} style={{
                        background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.3)",
                        borderRadius: 8, color: "#e9d5ff", cursor: "pointer", padding: "10px 16px",
                        fontSize: 13, fontFamily: "'Space Mono', monospace", display: "flex", alignItems: "center", gap: 8,
                        boxShadow: "0 0 16px rgba(168,85,247,0.15)", transition: "all 0.2s"
                    }}>
                        <IconPlus /> New Endpoint
                    </button>
                </div>

                {/* Filters */}
                <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
                    <div style={{ position: "relative", width: 280 }}>
                        <div style={{ position: "absolute", left: 12, top: 10, color: "rgba(216,180,254,0.4)" }}><IconSearch /></div>
                        <input
                            style={{ ...inputStyle, paddingLeft: 36, background: "rgba(14,6,24,0.6)" }}
                            placeholder="Search endpoints..." value={search} onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    <select style={{ ...inputStyle, width: 140, cursor: "pointer", background: "rgba(14,6,24,0.6)" }}
                        value={methodFilter} onChange={e => setMethodFilter(e.target.value)}>
                        <option value="ALL" style={{ background: "#0e0618" }}>ALL METHODS</option>
                        {HTTP_METHODS.map(m => <option key={m} value={m} style={{ background: "#0e0618" }}>{m}</option>)}
                    </select>
                </div>

                {/* Grid */}
                {filtered.length === 0 ? (
                    <div style={{ padding: "60px 0", textAlign: "center", color: "rgba(216,180,254,0.4)" }}>
                        No endpoints match your filters.
                    </div>
                ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
                        {filtered.map(api => (
                            <ApiCard key={api.id} api={api} onClick={() => setSelectedApi(api)} />
                        ))}
                    </div>
                )}
            </div>

            {selectedApi && (
                <ApiEditorModal
                    api={selectedApi}
                    onSave={handleSave}
                    onDelete={handleDelete}
                    onClose={() => setSelectedApi(null)}
                />
            )}
        </div>
    );
};

export default ApiList;
