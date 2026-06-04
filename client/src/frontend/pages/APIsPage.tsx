// APIs Page — Professional Monochrome API Client (v2)
import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import useApi from "../hooks/useApi";
import { useProjectStore } from "../hooks/useProjectStore";
import { addApi } from "../stores/projectStore";
import Modal from "../components/ui/Modal";
import type { ProxyResponse, ApiRequestEntry } from "../types/api";

/* ━━━ Environments ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
interface ApiEnvironment { name: string; baseUrl: string; token: string; }
const DEFAULT_ENVS: ApiEnvironment[] = [
    { name: "Local", baseUrl: "http://localhost:3001", token: "" },
    { name: "Dev", baseUrl: "http://dev-api.example.com", token: "" },
    { name: "Staging", baseUrl: "https://staging-api.example.com", token: "" },
    { name: "Production", baseUrl: "https://api.example.com", token: "" },
];

/* ━━━ Presets ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
interface RequestPreset { label: string; method: string; path: string; headers: Record<string, string>; body: string; }
const REQUEST_PRESETS: RequestPreset[] = [
    { label: "GET JSON", method: "GET", path: "/api/resource", headers: { "Accept": "application/json" }, body: "" },
    { label: "POST JSON", method: "POST", path: "/api/resource", headers: { "Content-Type": "application/json" }, body: '{\n  "name": "",\n  "value": ""\n}' },
    { label: "PUT Update", method: "PUT", path: "/api/resource/:id", headers: { "Content-Type": "application/json" }, body: '{\n  "name": "",\n  "value": ""\n}' },
    { label: "DELETE", method: "DELETE", path: "/api/resource/:id", headers: {}, body: "" },
    { label: "Auth Login", method: "POST", path: "/api/auth/login", headers: { "Content-Type": "application/json" }, body: '{\n  "email": "",\n  "password": ""\n}' },
    { label: "File Upload", method: "POST", path: "/api/upload", headers: { "Content-Type": "multipart/form-data" }, body: "" },
    { label: "GraphQL", method: "POST", path: "/graphql", headers: { "Content-Type": "application/json" }, body: '{\n  "query": "{ users { id name } }"\n}' },
    { label: "Health Check", method: "GET", path: "/health", headers: {}, body: "" },
];

/* ━━━ Constants ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;

const METHOD_COLORS: Record<string, string> = {
    GET: "#ffffff", POST: "#e5e7eb", PUT: "#d1d5db",
    PATCH: "#9ca3af", DELETE: "#6b7280", HEAD: "#4b5563", OPTIONS: "#374151",
};

const shellSurface = "rgba(255,255,255,0.02)";
const shellSurfaceSoft = "rgba(255,255,255,0.03)";
const shellSurfaceMuted = "rgba(255,255,255,0.01)";
const shellBorder = "rgba(255,255,255,0.06)";
const shellBorderStrong = "rgba(255,255,255,0.10)";

function getStatusColor(status: number): { text: string; bg: string; border: string } {
    if (status >= 200 && status < 300) return { text: "#ffffff", bg: "rgba(255,255,255,0.1)", border: "rgba(255,255,255,0.3)" };
    if (status >= 300 && status < 400) return { text: "#e5e7eb", bg: "rgba(255,255,255,0.08)", border: "rgba(255,255,255,0.2)" };
    if (status >= 400 && status < 500) return { text: "#d1d5db", bg: "rgba(255,255,255,0.05)", border: "rgba(255,255,255,0.15)" };
    if (status >= 500) return { text: "#9ca3af", bg: "rgba(255,255,255,0.03)", border: "rgba(255,255,255,0.1)" };
    return { text: "#6b7280", bg: "rgba(255,255,255,0.02)", border: "rgba(255,255,255,0.05)" };
}

function tryPrettyJson(str: string): string {
    try { return JSON.stringify(JSON.parse(str), null, 2); } catch { return str; }
}

function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
}

function formatBytes(str: string): string {
    const bytes = new TextEncoder().encode(str).length;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ━━━ cURL Parsing ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function parseCurl(curlStr: string) {
    const result = { method: "GET", url: "", headers: {} as Record<string, string>, body: "" };
    const cmd = curlStr.replace(/\\\n/g, " ").replace(/\\\r\n/g, " ").trim();
    const urlMatch = cmd.match(/(?:curl\s+)?(?:['"]?(https?:\/\/[^\s'"]+)['"]?)/i);
    if (urlMatch) result.url = urlMatch[1];
    const methodMatch = cmd.match(/-X\s+(\w+)/i);
    if (methodMatch) result.method = methodMatch[1].toUpperCase();
    const headerRegex = /-H\s+['"]([^'"]+)['"]/gi;
    let hMatch;
    while ((hMatch = headerRegex.exec(cmd)) !== null) {
        const [key, ...valParts] = hMatch[1].split(":");
        if (key && valParts.length > 0) result.headers[key.trim()] = valParts.join(":").trim();
    }
    const bodyMatch = cmd.match(/(?:--data-raw|--data|-d)\s+['"]([^'"]*)['"]/i);
    if (bodyMatch) {
        result.body = bodyMatch[1];
        if (result.method === "GET") result.method = "POST";
    }
    return result;
}

/* ━━━ Code Generation ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function generateCurl(method: string, url: string, headers: Record<string, string>, body: string) {
    let cmd = `curl -X ${method} '${url}'`;
    Object.entries(headers).forEach(([k, v]) => { cmd += ` \\\n  -H '${k}: ${v}'`; });
    if (body && method !== "GET" && method !== "HEAD") cmd += ` \\\n  -d '${body}'`;
    return cmd;
}
function generateFetch(method: string, url: string, headers: Record<string, string>, body: string) {
    const opts: string[] = [`  method: '${method}'`];
    if (Object.keys(headers).length > 0) opts.push(`  headers: ${JSON.stringify(headers, null, 4).split('\n').map((l, i) => i === 0 ? l : '  ' + l).join('\n')}`);
    if (body && method !== "GET" && method !== "HEAD") opts.push(`  body: ${JSON.stringify(body)}`);
    return `const response = await fetch('${url}', {\n${opts.join(',\n')}\n});\nconst data = await response.json();\nconsole.log(data);`;
}
function generatePython(method: string, url: string, headers: Record<string, string>, body: string) {
    let code = `import requests\n\n`;
    const hasHeaders = Object.keys(headers).length > 0;
    if (hasHeaders) code += `headers = ${JSON.stringify(headers, null, 4)}\n\n`;
    code += `response = requests.${method.toLowerCase()}(\n    '${url}'`;
    if (hasHeaders) code += `,\n    headers=headers`;
    if (body && method !== "GET" && method !== "HEAD") code += `,\n    json=${body}`;
    code += `\n)\n\nprint(response.status_code)\nprint(response.json())`;
    return code;
}

/* ━━━ UI Components ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const JsonHighlight: React.FC<{ json: string }> = ({ json }) => {
    const highlighted = useMemo(() => {
        return tryPrettyJson(json).replace(/("(?:\\.|[^"\\])*")\s*:/g, '<span style="color:#ffffff">$1</span>:')
            .replace(/:\s*("(?:\\.|[^"\\])*")/g, ': <span style="color:#e5e7eb">$1</span>')
            .replace(/:\s*(\d+\.?\d*)/g, ': <span style="color:#d1d5db">$1</span>')
            .replace(/:\s*(true|false)/g, ': <span style="color:#9ca3af">$1</span>')
            .replace(/:\s*(null)/g, ': <span style="color:#6b7280">$1</span>');
    }, [json]);
    return <pre style={{ margin: 0, fontSize: 12, fontFamily: "'Space Mono', monospace", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-all" }} dangerouslySetInnerHTML={{ __html: highlighted }} />;
};

// ─── Input Styles ───
const inputStyle: React.CSSProperties = {
    background: shellSurfaceSoft, border: `1px solid ${shellBorderStrong}`, borderRadius: 8,
    color: "var(--ide-text)", fontSize: 13, padding: "8px 12px", outline: "none", fontFamily: "'Space Mono', monospace",
    transition: "all 0.2s", width: "100%", boxSizing: "border-box"
};
const labelStyle: React.CSSProperties = {
    fontSize: 10, fontFamily: "'Space Mono', monospace", letterSpacing: "0.08em",
    color: "var(--ide-text-secondary)", textTransform: "uppercase", display: "block", marginBottom: 6
};

// ─── KV Editor ───
interface KVPair { key: string; value: string; enabled: boolean }
const KVEditor: React.FC<{ pairs: KVPair[]; onChange: (pairs: KVPair[]) => void; keyPlaceholder?: string; valuePlaceholder?: string; }> = ({ pairs, onChange, keyPlaceholder = "Key", valuePlaceholder = "Value" }) => {
    const update = (i: number, field: keyof KVPair, value: any) => { const u = [...pairs]; u[i] = { ...u[i], [field]: value }; onChange(u); };
    const remove = (i: number) => onChange(pairs.filter((_, idx) => idx !== i));
    const add = () => onChange([...pairs, { key: "", value: "", enabled: true }]);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", gap: 8, padding: "0 4px", marginBottom: 4 }}>
                <span style={{ width: 20 }} />
                <span style={{ flex: 1, ...labelStyle, marginBottom: 0 }}>{keyPlaceholder}</span>
                <span style={{ flex: 1, ...labelStyle, marginBottom: 0 }}>{valuePlaceholder}</span>
                <span style={{ width: 24 }} />
            </div>
            {pairs.map((pair, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input type="checkbox" checked={pair.enabled} onChange={e => update(i, "enabled", e.target.checked)} style={{ accentColor: "#ffffff" }} />
                    <input style={{ ...inputStyle, flex: 1, padding: "6px 10px", fontSize: 12 }} value={pair.key} onChange={e => update(i, "key", e.target.value)} placeholder={keyPlaceholder} />
                    <input style={{ ...inputStyle, flex: 1, padding: "6px 10px", fontSize: 12 }} value={pair.value} onChange={e => update(i, "value", e.target.value)} placeholder={valuePlaceholder} />
                    <button onClick={() => remove(i)} style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", padding: "2px 6px", fontSize: 10, fontFamily: "'Space Mono', monospace" }}>DEL</button>
                </div>
            ))}
            <button onClick={add} style={{ alignSelf: "flex-start", background: "none", border: "none", color: "white", opacity: 0.6, fontSize: 11, cursor: "pointer", marginLeft: 28, padding: 4 }}>+ Add</button>
        </div>
    );
};

// ─── Modal ───
const ApiModal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; width?: string; children: React.ReactNode }> = ({ isOpen, onClose, title, width = "600px", children }) => (
    <Modal isOpen={isOpen} onClose={onClose} title={title} width={width} size="lg">
        <div className="overflow-y-auto">{children}</div>
    </Modal>
);

// ─── Toast ───
const Toast: React.FC<{ message: string; type?: "success" | "error"; onDone: () => void }> = ({ message, type: _type = "success", onDone }) => {
    useEffect(() => { const t = setTimeout(onDone, 2500); return () => clearTimeout(t); }, [onDone]);
    return (
        <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999, padding: "12px 20px", borderRadius: 12, fontSize: 13, fontFamily: "'Outfit', sans-serif", fontWeight: 500, background: "rgba(255,255,255,0.1)", color: "white", border: "1px solid rgba(255,255,255,0.2)", backdropFilter: "blur(20px)", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
            {message}
        </div>
    );
};

/* ━━━ Main Page ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const APIsPage: React.FC = () => {
    const api = useApi();
    const { project } = useProjectStore();

    const [method, setMethod] = useState("GET");
    const [url, setUrl] = useState("");
    const [params, setParams] = useState<KVPair[]>([{ key: "", value: "", enabled: true }]);
    const [headers, setHeaders] = useState<KVPair[]>([{ key: "Content-Type", value: "application/json", enabled: true }]);
    const [bodyText, setBodyText] = useState("");
    const [bodyFormat, setBodyFormat] = useState<"json" | "raw" | "form">("json");
    const [authToken, setAuthToken] = useState("");

    const [reqTab, setReqTab] = useState("Params");
    const [resTab, setResTab] = useState("Body");

    const [response, setResponse] = useState<ProxyResponse | null>(null);
    const [loading, setLoading] = useState(false);

    const [sidebarTab, setSidebarTab] = useState<"collections" | "history">("collections");
    const [history, setHistory] = useState<ApiRequestEntry[]>([]);

    const [codeGenOpen, setCodeGenOpen] = useState(false);
    const [codeGenLang, setCodeGenLang] = useState<"curl" | "fetch" | "python">("curl");
    const [importCurlOpen, setImportCurlOpen] = useState(false);
    const [importCurlText, setImportCurlText] = useState("");
    const [saveCollOpen, setSaveCollOpen] = useState(false);
    const [saveCollName, setSaveCollName] = useState("");
    const [saveCollFolder, setSaveCollFolder] = useState("");

    // Collection Folders
    const [collFolders, setCollFolders] = useState<Record<string, string>>(() => {
        try { const s = localStorage.getItem('akasha_api_folders'); return s ? JSON.parse(s) : {}; } catch { return {}; }
    });
    const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
    useEffect(() => { try { localStorage.setItem('akasha_api_folders', JSON.stringify(collFolders)); } catch {} }, [collFolders]);

    const allFolderNames = useMemo(() => {
        const names = new Set(Object.values(collFolders).filter(Boolean));
        return Array.from(names).sort();
    }, [collFolders]);

    const toggleFolder = (name: string) => {
        setCollapsedFolders(prev => {
            const next = new Set(prev);
            next.has(name) ? next.delete(name) : next.add(name);
            return next;
        });
    };

    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

    // ─── New Feature State ───
    const [environments, setEnvironments] = useState<ApiEnvironment[]>(() => {
        try { const s = localStorage.getItem('akasha_api_envs'); return s ? JSON.parse(s) : DEFAULT_ENVS; } catch { return DEFAULT_ENVS; }
    });
    const [activeEnvIdx, setActiveEnvIdx] = useState(0);
    const [envEditorOpen, setEnvEditorOpen] = useState(false);
    const [presetOpen, setPresetOpen] = useState(false);
    const [responseSearch, setResponseSearch] = useState("");
    const [responseWrap, setResponseWrap] = useState(true);
    const [requestCount, setRequestCount] = useState(0);
    const [avgLatency, setAvgLatency] = useState(0);

    // Persist environments
    useEffect(() => { try { localStorage.setItem('akasha_api_envs', JSON.stringify(environments)); } catch {} }, [environments]);

    const activeEnv = environments[activeEnvIdx] || environments[0];

    const collections = useMemo(() => (project?.apis || []).filter((a: any) => !a.archived), [project]);
    useEffect(() => { api.listApiHistory().then(setHistory).catch(console.error); }, []);
    const urlRef = useRef<HTMLInputElement>(null);

    // Stats tracking
    const updateStats = useCallback((durationMs: number) => {
        setRequestCount(c => c + 1);
        setAvgLatency(prev => prev === 0 ? durationMs : Math.round((prev + durationMs) / 2));
    }, []);

    // Apply preset
    const applyPreset = (preset: RequestPreset) => {
        setMethod(preset.method);
        setUrl(activeEnv.baseUrl + preset.path);
        setBodyText(preset.body);
        const hPairs = Object.entries(preset.headers).map(([key, value]) => ({ key, value, enabled: true }));
        if (hPairs.length > 0) setHeaders(hPairs);
        if (activeEnv.token) setAuthToken(activeEnv.token);
        setPresetOpen(false);
        setToast({ message: `Preset "${preset.label}" loaded`, type: "success" });
    };

    // Switch environment
    const switchEnv = (idx: number) => {
        setActiveEnvIdx(idx);
        const env = environments[idx];
        if (env.token) setAuthToken(env.token);
        // Replace base URL in current URL if applicable
        if (url) {
            const oldBase = activeEnv.baseUrl;
            if (url.startsWith(oldBase)) setUrl(url.replace(oldBase, env.baseUrl));
        }
        setToast({ message: `Switched to ${env.name}`, type: "success" });
    };

    // Filtered response for search
    const filteredResponseBody = useMemo(() => {
        if (!response?.body || !responseSearch.trim()) return null;
        try {
            const parsed = JSON.parse(response.body);
            const search = responseSearch.toLowerCase();
            const filterObj = (obj: any): any => {
                if (typeof obj === 'string') return obj.toLowerCase().includes(search) ? obj : undefined;
                if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj).toLowerCase().includes(search) ? obj : undefined;
                if (Array.isArray(obj)) { const r = obj.map(filterObj).filter(v => v !== undefined); return r.length > 0 ? r : undefined; }
                if (obj && typeof obj === 'object') {
                    const r: any = {}; let found = false;
                    for (const [k, v] of Object.entries(obj)) {
                        if (k.toLowerCase().includes(search)) { r[k] = v; found = true; }
                        else { const fv = filterObj(v); if (fv !== undefined) { r[k] = fv; found = true; } }
                    }
                    return found ? r : undefined;
                }
                return undefined;
            };
            const result = filterObj(parsed);
            return result !== undefined ? JSON.stringify(result, null, 2) : '// No matches found';
        } catch { return null; }
    }, [response?.body, responseSearch]);

    const buildHeaders = useCallback(() => {
        const hdrs: Record<string, string> = {};
        headers.filter(h => h.enabled && h.key.trim()).forEach(h => { hdrs[h.key.trim()] = h.value; });
        if (authToken.trim()) hdrs["Authorization"] = `Bearer ${authToken.trim()}`;
        return hdrs;
    }, [headers, authToken]);

    const buildParams = useCallback(() => {
        const prms: Record<string, string> = {};
        params.filter(p => p.enabled && p.key.trim()).forEach(p => { prms[p.key.trim()] = p.value; });
        return prms;
    }, [params]);

    const sendRequest = useCallback(async () => {
        if (!url.trim()) return;
        setLoading(true); setResponse(null);
        const hdrs = buildHeaders();
        const prms = buildParams();
        let sendBody = bodyText;
        if (bodyFormat === "form" && bodyText.trim()) {
            try {
                const obj: Record<string, string> = {};
                bodyText.split("\n").forEach(line => {
                    const [k, ...v] = line.split("=");
                    if (k?.trim()) obj[k.trim()] = v.join("=").trim();
                });
                sendBody = JSON.stringify(obj);
                if (!hdrs["Content-Type"]) hdrs["Content-Type"] = "application/x-www-form-urlencoded";
            } catch { }
        }

        try {
            const result = await api.sendProxyRequest({ method, url: url.trim(), headers: hdrs, body: sendBody || undefined, params: Object.keys(prms).length > 0 ? prms : undefined });
            setResponse(result);
            updateStats(result.duration_ms);
            try {
                await api.saveApiHistory({
                    method, url: url.trim(), headers: hdrs, body: sendBody, params: prms, responseStatus: result.status,
                    responseHeaders: result.headers, responseBody: result.body?.substring(0, 5000) || "", duration: result.duration_ms,
                });
                setHistory(await api.listApiHistory());
            } catch { }
        } catch (err: any) {
            setResponse({ status: 0, statusText: "Error", headers: {}, body: err.message || "Request failed", duration_ms: 0, url: url.trim(), error: true });
        } finally { setLoading(false); }
    }, [method, url, headers, params, bodyText, bodyFormat, authToken, api, buildHeaders, buildParams]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); sendRequest(); } };
        window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler);
    }, [sendRequest]);

    const loadFromEndpoint = (ep: any) => {
        setMethod(ep.method || "GET"); setUrl(ep.path.startsWith("http") ? ep.path : `http://localhost:3001${ep.path}`); setResponse(null);
        if (ep.request_body?.fields?.length > 0) {
            const skeleton: Record<string, string> = {};
            ep.request_body.fields.forEach((f: any) => { skeleton[f.name] = f.field_type === "number" ? "0" : f.field_type === "boolean" ? "false" : ""; });
            setBodyText(JSON.stringify(skeleton, null, 2));
        } else { setBodyText(""); }
    };

    const loadFromHistory = (entry: ApiRequestEntry) => {
        setMethod(entry.method); setUrl(entry.url); setBodyText(entry.body || ""); setResponse(null);
        const hPairs = Object.entries(entry.headers || {}).map(([key, value]) => ({ key, value, enabled: true }));
        if (hPairs.length > 0) setHeaders(hPairs);
        const pPairs = Object.entries(entry.params || {}).map(([key, value]) => ({ key, value, enabled: true }));
        if (pPairs.length > 0) setParams(pPairs);
        if (entry.response_status) {
            setResponse({ status: entry.response_status, statusText: entry.response_status >= 200 && entry.response_status < 300 ? "OK" : "Error", headers: entry.response_headers || {}, body: entry.response_body || "", duration_ms: entry.duration || 0, url: entry.url });
        }
    };

    const handleImportCurl = () => {
        const parsed = parseCurl(importCurlText);
        if (!parsed.url) { setToast({ message: "Could not parse URL from cURL", type: "error" }); return; }
        setMethod(parsed.method); setUrl(parsed.url); setBodyText(parsed.body);
        const hPairs = Object.entries(parsed.headers).map(([key, value]) => ({ key, value, enabled: true }));
        if (hPairs.length > 0) setHeaders(hPairs);
        setImportCurlOpen(false); setImportCurlText(""); setToast({ message: "cURL imported successfully", type: "success" });
    };

    const handleSaveToCollection = async () => {
        if (!saveCollName.trim()) return;
        try {
            const path = url.replace(/^https?:\/\/[^/]+/, "") || "/api/new";
            await addApi(method, path, saveCollName.trim());
            // Assign folder if specified
            if (saveCollFolder.trim()) {
                const updated = (project?.apis || []).filter((a: any) => !a.archived);
                const newest = updated[updated.length - 1];
                if (newest) setCollFolders(prev => ({ ...prev, [newest.id]: saveCollFolder.trim() }));
            }
            setSaveCollOpen(false); setSaveCollName(""); setSaveCollFolder(""); setToast({ message: `Saved "${saveCollName}" to ${saveCollFolder || 'collections'}`, type: "success" });
        } catch (err: any) { setToast({ message: `Failed to save: ${err.message}`, type: "error" }); }
    };

    const copyToClipboard = (text: string, label: string) => { navigator.clipboard.writeText(text); setToast({ message: `${label} copied`, type: "success" }); };

    const generatedCode = useMemo(() => {
        const hdrs = buildHeaders();
        switch (codeGenLang) { case "curl": return generateCurl(method, url || "https://example.com", hdrs, bodyText); case "fetch": return generateFetch(method, url || "https://example.com", hdrs, bodyText); case "python": return generatePython(method, url || "https://example.com", hdrs, bodyText); }
    }, [codeGenLang, method, url, bodyText, buildHeaders]);

    const reqTabCounts = { Params: params.filter(p => p.enabled && p.key.trim()).length, Headers: headers.filter(h => h.enabled && h.key.trim()).length, Body: bodyText.trim() ? 1 : 0, Auth: authToken.trim() ? 1 : 0 };
    const isJsonResponse = useMemo(() => { if (!response?.body) return false; try { JSON.parse(response.body); return true; } catch { return false; } }, [response]);
    const [collectionSearch, setCollectionSearch] = useState("");
    const filteredCollections = useMemo(() => {
        if (!collectionSearch.trim()) return collections;
        const q = collectionSearch.toLowerCase();
        return collections.filter((a: any) => a.name.toLowerCase().includes(q) || a.path.toLowerCase().includes(q) || a.method.toLowerCase().includes(q));
    }, [collections, collectionSearch]);

    // Group collections by folder
    const groupedCollections = useMemo(() => {
        const groups: Record<string, any[]> = { '': [] };
        filteredCollections.forEach((ep: any) => {
            const folder = collFolders[ep.id] || '';
            if (!groups[folder]) groups[folder] = [];
            groups[folder].push(ep);
        });
        return groups;
    }, [filteredCollections, collFolders]);

    // ─── Theme Elements ───
    const TabButton = ({ active, label, count, onClick }: { active: boolean; label: string; count?: number; onClick: () => void }) => (
        <button onClick={onClick} style={{
            background: "none", border: "none", cursor: "pointer", padding: "12px 16px 10px", fontSize: 12,
            fontFamily: "'Space Mono', monospace", letterSpacing: "0.05em",
            color: active ? "var(--ide-text)" : "var(--ide-text-secondary)",
            borderBottom: `2px solid ${active ? "#ffffff" : "transparent"}`, transition: "all 0.2s", marginBottom: -1,
            display: "flex", alignItems: "center", gap: 6, textTransform: "uppercase"
        }}>
            {label}
            {count !== undefined && count > 0 && <span style={{ background: shellSurfaceSoft, color: "var(--ide-text)", padding: "2px 6px", borderRadius: 10, fontSize: 10 }}>{count}</span>}
        </button>
    );

    const getMethodStyle = (m: string) => {
        const c = METHOD_COLORS[m] || "#9ca3af";
        return { text: c, bg: `${c}15`, border: `${c}40` };
    };

    return (
        <div style={{
            display: "flex", flex: 1, overflow: "hidden", height: "100%", position: "relative",
            padding: 16, gap: 16,
            background: "var(--ide-bg)",
            color: "var(--ide-text)",
        }}>
            {/* Background grid */}
            <div style={{ position: "fixed", inset: 0, pointerEvents: "none", backgroundImage: `linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)`, backgroundSize: "48px 48px" }} />

            <div style={{ width: 300, display: "flex", flexDirection: "column", flexShrink: 0, background: shellSurface, border: `1px solid ${shellBorder}`, borderRadius: 24, overflow: "hidden", backdropFilter: "blur(12px)", zIndex: 10 }}>
                {/* Environment Switcher */}
                <div style={{ padding: "10px 12px", borderBottom: `1px solid ${shellBorder}`, display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: 9, color: "var(--ide-text-secondary)", fontFamily: "'Space Mono', monospace", letterSpacing: "0.08em", textTransform: "uppercase", whiteSpace: "nowrap" }}>ENV</span>
                    <select value={activeEnvIdx} onChange={e => switchEnv(Number(e.target.value))} style={{ ...inputStyle, padding: "4px 8px", fontSize: 11, flex: 1, cursor: "pointer" }}>
                        {environments.map((env, i) => <option key={i} value={i} style={{ background: "var(--ide-bg)" }}>{env.name} — {env.baseUrl.replace(/^https?:\/\//, '')}</option>)}
                    </select>
                    <button onClick={() => setEnvEditorOpen(true)} style={{ background: shellSurfaceSoft, border: `1px solid ${shellBorderStrong}`, borderRadius: 4, color: "var(--ide-text)", cursor: "pointer", padding: "3px 8px", fontSize: 9, fontWeight: 700, fontFamily: "'Space Mono', monospace" }} title="Edit Environments">CONFIG</button>
                </div>

                {/* Tabs */}
                <div style={{ display: "flex", borderBottom: `1px solid ${shellBorder}`, flexShrink: 0 }}>
                    <button onClick={() => setSidebarTab("collections")} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", padding: "12px 0", fontSize: 10, fontFamily: "'Space Mono', monospace", color: sidebarTab === "collections" ? "var(--ide-text)" : "var(--ide-text-secondary)", borderBottom: `2px solid ${sidebarTab === "collections" ? "#ffffff" : "transparent"}`, textTransform: "uppercase", letterSpacing: "0.05em", transition: "all 0.2s", marginBottom: -1 }}>Collections ({collections.length})</button>
                    <button onClick={() => setSidebarTab("history")} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", padding: "12px 0", fontSize: 10, fontFamily: "'Space Mono', monospace", color: sidebarTab === "history" ? "var(--ide-text)" : "var(--ide-text-secondary)", borderBottom: `2px solid ${sidebarTab === "history" ? "#ffffff" : "transparent"}`, textTransform: "uppercase", letterSpacing: "0.05em", transition: "all 0.2s", marginBottom: -1 }}>History ({history.length})</button>
                </div>

                {/* Actions Row */}
                <div style={{ display: "flex", gap: 6, padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0, flexWrap: "wrap" }}>
                    <button onClick={() => setImportCurlOpen(true)} style={{ flex: 1, background: shellSurfaceSoft, border: `1px solid ${shellBorderStrong}`, borderRadius: 6, color: "var(--ide-text)", fontSize: 9, fontFamily: "'Space Mono', monospace", padding: "5px 0", cursor: "pointer", minWidth: 70 }}>IMPORT CURL</button>
                    <button onClick={() => setCodeGenOpen(true)} style={{ flex: 1, background: shellSurfaceSoft, border: `1px solid ${shellBorderStrong}`, borderRadius: 6, color: "var(--ide-text)", fontSize: 9, fontFamily: "'Space Mono', monospace", padding: "5px 0", cursor: "pointer", minWidth: 70 }}>GENERATE CODE</button>
                    <button onClick={() => setPresetOpen(true)} style={{ flex: 1, background: shellSurfaceSoft, border: `1px solid ${shellBorderStrong}`, borderRadius: 6, color: "var(--ide-text)", fontSize: 9, fontFamily: "'Space Mono', monospace", padding: "5px 0", cursor: "pointer", minWidth: 70 }}>LOAD PRESET</button>
                </div>

                {/* Collection Search */}
                {sidebarTab === "collections" && collections.length > 3 && (
                    <div style={{ padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
                        <input style={{ ...inputStyle, padding: "5px 10px", fontSize: 11, background: "rgba(255,255,255,0.03)" }} placeholder="Search collections..." value={collectionSearch} onChange={e => setCollectionSearch(e.target.value)} />
                    </div>
                )}

                {/* List */}
                <div style={{ flex: 1, overflowY: "auto", padding: 10 }}>
                    {sidebarTab === "collections" ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            {filteredCollections.length === 0 ? (
                                <div style={{ textAlign: "center", color: "var(--ide-text-secondary)", fontSize: 12, marginTop: 40, padding: "20px 0" }}>
                                    <div style={{ fontSize: 11, fontWeight: "black", opacity: 0.3, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.1em" }}>Empty</div>
                                    {collectionSearch ? "No matches" : "No endpoints"}
                                </div>
                            ) : (
                                <>
                                    {/* Render folders */}
                                    {Object.entries(groupedCollections).filter(([k]) => k !== '').sort(([a],[b]) => a.localeCompare(b)).map(([folder, eps]) => (
                                        <div key={folder} style={{ marginBottom: 4 }}>
                                            <button onClick={() => toggleFolder(folder)} style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", padding: "6px 8px", background: shellSurfaceSoft, border: `1px solid ${shellBorderStrong}`, borderRadius: 6, cursor: "pointer", color: "var(--ide-text)", fontSize: 10, fontFamily: "'Space Mono', monospace", textAlign: "left" }}>
                                                <span style={{ fontSize: 8, color: "var(--ide-text-secondary)", fontWeight: 700 }}>{collapsedFolders.has(folder) ? "CLOSED" : "OPEN"}</span>
                                                <span style={{ flex: 1, fontWeight: 600 }}>{folder}</span>
                                                <span style={{ fontSize: 9, color: "var(--ide-text-secondary)", background: shellSurface, padding: "1px 5px", borderRadius: 8 }}>{eps.length}</span>
                                            </button>
                                            {!collapsedFolders.has(folder) && (
                                                <div style={{ paddingLeft: 12, marginTop: 4, display: "flex", flexDirection: "column", gap: 3, borderLeft: `2px solid ${shellBorder}` }}>
                                                    {eps.map((ep: any) => { const ms = getMethodStyle(ep.method); return (
                                                        <div key={ep.id} onClick={() => loadFromEndpoint(ep)} style={{ padding: "8px 10px", background: shellSurfaceMuted, border: `1px solid ${shellBorder}`, borderRadius: 6, cursor: "pointer", transition: "all 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = shellSurfaceSoft} onMouseLeave={e => e.currentTarget.style.background = shellSurfaceMuted}>
                                                            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                                                <span style={{ fontSize: 8, fontWeight: 700, fontFamily: "'Space Mono', monospace", padding: "1px 5px", borderRadius: 3, background: ms.bg, color: ms.text, border: `1px solid ${ms.border}` }}>{ep.method}</span>
                                                                <span style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: "var(--ide-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{ep.name || ep.path}</span>
                                                            </div>
                                                        </div>
                                                    ); })}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {/* Ungrouped items */}
                                    {(groupedCollections[''] || []).map((ep: any) => {
                                        const ms = getMethodStyle(ep.method);
                                        return (
                                            <div key={ep.id} onClick={() => loadFromEndpoint(ep)} style={{ padding: "10px 12px", background: shellSurfaceMuted, border: `1px solid ${shellBorder}`, borderRadius: 8, cursor: "pointer", transition: "all 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = shellSurfaceSoft} onMouseLeave={e => e.currentTarget.style.background = shellSurfaceMuted}>
                                                <div style={{ display: "flex", gap: 8, marginBottom: 5, alignItems: "center" }}>
                                                    <span style={{ fontSize: 9, fontWeight: 700, fontFamily: "'Space Mono', monospace", padding: "2px 6px", borderRadius: 3, background: ms.bg, color: ms.text, border: `1px solid ${ms.border}` }}>{ep.method}</span>
                                                    <span style={{ fontSize: 11, fontFamily: "'Space Mono', monospace", color: "var(--ide-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>{ep.path}</span>
                                                </div>
                                                <div style={{ fontSize: 11, color: "var(--ide-text-secondary)" }}>{ep.name}</div>
                                            </div>
                                        );
                                    })}
                                </>
                            )}
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            {history.length === 0 ? (
                                <div style={{ textAlign: "center", color: "var(--ide-text-secondary)", fontSize: 12, marginTop: 40 }}>
                                    <div style={{ fontSize: 11, fontWeight: "black", opacity: 0.3, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.1em" }}>History Clear</div>
                                    No history
                                </div>
                            ) : (
                                <>
                                    <button onClick={async () => { try { await api.clearApiHistory(); setHistory([]); setToast({ message: "History cleared", type: "success" }); } catch {} }} style={{ alignSelf: "flex-end", background: "none", border: "none", color: "rgba(239,68,68,0.6)", fontSize: 9, cursor: "pointer", padding: "2px 4px", fontFamily: "'Space Mono', monospace" }}>Clear All</button>
                                    {history.map((entry) => {
                                        const sc = entry.response_status ? getStatusColor(entry.response_status) : null;
                                        return (
                                            <div key={entry.id} onClick={() => loadFromHistory(entry)} style={{ padding: "10px 12px", background: shellSurfaceMuted, border: `1px solid ${shellBorder}`, borderRadius: 8, cursor: "pointer", transition: "all 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = shellSurfaceSoft} onMouseLeave={e => e.currentTarget.style.background = shellSurfaceMuted}>
                                                <div style={{ display: "flex", gap: 8, marginBottom: 5, alignItems: "center", justifyContent: "space-between" }}>
                                                    <span style={{ fontSize: 9, fontWeight: 700, fontFamily: "'Space Mono', monospace", color: METHOD_COLORS[entry.method] }}>{entry.method}</span>
                                                    {sc && <span style={{ fontSize: 8, fontFamily: "'Space Mono', monospace", background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`, padding: "1px 5px", borderRadius: 3 }}>{entry.response_status}</span>}
                                                    <span style={{ fontSize: 9, color: "var(--ide-text-secondary)", marginLeft: "auto" }}>{formatDuration(entry.duration || 0)}</span>
                                                </div>
                                                <div style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: "var(--ide-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 4 }}>{entry.url.replace(/^https?:\/\//, '')}</div>
                                                <div style={{ fontSize: 8, color: "var(--ide-text-secondary)" }}>{new Date(entry.created_at).toLocaleString()}</div>
                                            </div>
                                        );
                                    })}
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Session Stats Footer */}
                <div style={{ padding: "10px 12px", borderTop: `1px solid ${shellBorder}`, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, flexShrink: 0, background: shellSurface }}>
                    <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ide-text)", fontFamily: "'Space Mono', monospace" }}>{requestCount}</div>
                        <div style={{ fontSize: 8, color: "var(--ide-text-secondary)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Requests</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ide-text)", fontFamily: "'Space Mono', monospace" }}>{avgLatency ? `${avgLatency}ms` : "—"}</div>
                        <div style={{ fontSize: 8, color: "var(--ide-text-secondary)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Avg Latency</div>
                    </div>
                </div>
            </div>

            {/* ─── Main Content ─────────────────── */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", zIndex: 10, minWidth: 0, border: `1px solid ${shellBorder}`, borderRadius: 24, overflow: "hidden", background: shellSurface }}>
                {/* URL Bar */}
                <div style={{ padding: "16px 24px", background: shellSurface, borderBottom: `1px solid ${shellBorder}`, backdropFilter: "blur(12px)", flexShrink: 0 }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        <select value={method} onChange={e => setMethod(e.target.value)} style={{ ...inputStyle, width: 100, fontWeight: 700, color: "white", cursor: "pointer", padding: "10px 12px" }}>
                            {HTTP_METHODS.map(m => <option key={m} value={m} style={{ background: "var(--ide-bg)", color: "#fff" }}>{m}</option>)}
                        </select>
                        <input ref={urlRef} value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) sendRequest(); }} placeholder="Enter URL (e.g., https://api.example.com/data)" style={{ ...inputStyle, flex: 1, padding: "10px 16px", fontSize: 14 }} />
                        <button onClick={() => setSaveCollOpen(true)} style={{ background: shellSurfaceSoft, border: `1px solid ${shellBorderStrong}`, borderRadius: 8, color: "var(--ide-text)", cursor: "pointer", padding: "10px 14px", display: "flex", alignItems: "center" }} title="Save">SAVE</button>
                        <button onClick={sendRequest} disabled={loading || !url.trim()} style={{
                            background: loading ? shellSurfaceSoft : "rgba(255,255,255,0.1)",
                            border: `1px solid ${shellBorderStrong}`, borderRadius: 8, color: "var(--ide-text)", cursor: loading || !url.trim() ? "default" : "pointer",
                            padding: "0 28px", fontSize: 14, fontFamily: "'Space Mono', monospace", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
                            boxShadow: loading ? "none" : "0 0 20px rgba(255,255,255,0.05)", height: 42, display: "flex", alignItems: "center", opacity: url.trim() ? 1 : 0.5
                        }}>
                            {loading ? "..." : "SEND"}
                        </button>
                    </div>
                </div>

                <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                    {/* Request Area */}
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", borderBottom: `1px solid ${shellBorder}`, background: shellSurfaceMuted }}>
                        <div style={{ display: "flex", padding: "0 24px", borderBottom: `1px solid ${shellBorder}`, flexShrink: 0 }}>
                            {(["Params", "Headers", "Body", "Auth"] as const).map(t => (
                                <TabButton key={t} active={reqTab === t} label={t} count={reqTabCounts[t as keyof typeof reqTabCounts]} onClick={() => setReqTab(t)} />
                            ))}
                        </div>
                        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
                            {reqTab === "Params" && <KVEditor pairs={params} onChange={setParams} keyPlaceholder="Query Parameter" valuePlaceholder="Value" />}
                            {reqTab === "Headers" && <KVEditor pairs={headers} onChange={setHeaders} keyPlaceholder="Header" valuePlaceholder="Value" />}
                            {reqTab === "Body" && (
                                <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 12 }}>
                                    <div style={{ display: "flex", gap: 8 }}>
                                        {(["json", "raw", "form"] as const).map(fmt => (
                                            <button key={fmt} onClick={() => setBodyFormat(fmt)} style={{
                                                background: bodyFormat === fmt ? shellSurfaceSoft : "transparent",
                                                border: `1px solid ${bodyFormat === fmt ? shellBorderStrong : shellBorder}`,
                                                borderRadius: 6, color: bodyFormat === fmt ? "var(--ide-text)" : "var(--ide-text-secondary)",
                                                fontSize: 10, fontFamily: "'Space Mono', monospace", padding: "4px 12px", cursor: "pointer", textTransform: "uppercase"
                                            }}>
                                                {fmt === "json" ? "JSON" : fmt === "raw" ? "Raw" : "Form"}
                                            </button>
                                        ))}
                                    </div>
                                    <textarea style={{ ...inputStyle, flex: 1, resize: "none" }} value={bodyText} onChange={e => setBodyText(e.target.value)} placeholder={bodyFormat === "json" ? '{"key": "value"}' : "Enter body content..."} />
                                </div>
                            )}
                            {reqTab === "Auth" && (
                                <div style={{ maxWidth: 400 }}>
                                    <label style={labelStyle}>Bearer Token</label>
                                    <input style={{ ...inputStyle, marginBottom: 8 }} value={authToken} onChange={e => setAuthToken(e.target.value)} placeholder="Token" type="password" />
                                    <div style={{ fontSize: 11, color: "var(--ide-text-secondary)", fontFamily: "'Space Mono', monospace" }}>Sent as: Authorization: Bearer &lt;token&gt;</div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Response Area */}
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: shellSurfaceMuted }}>
                        {!response && !loading ? (
                            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ide-text-secondary)", flexDirection: "column", gap: 12 }}>
                                <div style={{ fontSize: 11, fontWeight: "black", opacity: 0.3, textTransform: "uppercase", letterSpacing: "0.1em" }}>Ready</div>
                                <div style={{ fontSize: 16, fontFamily: "'Outfit', sans-serif" }}>Send Request</div>
                                <div style={{ fontSize: 12, fontFamily: "'Space Mono', monospace" }}>Enter URL and execute</div>
                            </div>
                        ) : loading ? (
                            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ide-text)", fontSize: 14, fontFamily: "'Space Mono', monospace" }}>
                                Sending...
                            </div>
                        ) : response ? (
                            <>
                                <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "12px 24px", borderBottom: `1px solid ${shellBorder}`, background: shellSurface }}>
                                    <span style={{ ...getStatusColor(response.status), padding: "4px 10px", borderRadius: 6, fontSize: 12, fontFamily: "'Space Mono', monospace", fontWeight: 700 }}>
                                        {response.error ? "ERR" : response.status} {response.statusText}
                                    </span>
                                    <span style={{ fontSize: 12, fontFamily: "'Space Mono', monospace", color: "var(--ide-text-secondary)" }}>TIME: {formatDuration(response.duration_ms)}</span>
                                    <span style={{ fontSize: 12, fontFamily: "'Space Mono', monospace", color: "var(--ide-text-secondary)" }}>SIZE: {formatBytes(response.body)}</span>
                                    <button onClick={() => copyToClipboard(response.body, "Response")} style={{ marginLeft: "auto", background: shellSurfaceSoft, border: `1px solid ${shellBorderStrong}`, borderRadius: 6, color: "var(--ide-text)", fontSize: 11, fontFamily: "'Space Mono', monospace", padding: "4px 10px", cursor: "pointer" }}>Copy</button>
                                </div>
                                <div style={{ display: "flex", padding: "0 24px", borderBottom: `1px solid ${shellBorder}`, flexShrink: 0, alignItems: "center" }}>
                                    <TabButton active={resTab === "Body"} label="Body" onClick={() => setResTab("Body")} />
                                    <TabButton active={resTab === "Headers"} label="Headers" count={Object.keys(response.headers).length} onClick={() => setResTab("Headers")} />
                                    {/* Response controls */}
                                    <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center", paddingRight: 4 }}>
                                        {resTab === "Body" && isJsonResponse && (
                                            <>
                                                <input style={{ ...inputStyle, width: 140, padding: "3px 8px", fontSize: 10 }} placeholder="Search response..." value={responseSearch} onChange={e => setResponseSearch(e.target.value)} />
                                                <button onClick={() => setResponseWrap(w => !w)} style={{ background: responseWrap ? shellSurfaceSoft : "transparent", border: `1px solid ${shellBorderStrong}`, borderRadius: 4, color: "var(--ide-text)", fontSize: 9, padding: "3px 6px", cursor: "pointer", fontFamily: "'Space Mono', monospace" }} title="Toggle word wrap">{responseWrap ? "Wrap" : "NoWrap"}</button>
                                                <button onClick={() => copyToClipboard(tryPrettyJson(response.body), "Pretty JSON")} style={{ background: "transparent", border: `1px solid ${shellBorderStrong}`, borderRadius: 4, color: "var(--ide-text)", fontSize: 9, padding: "3px 6px", cursor: "pointer", fontFamily: "'Space Mono', monospace" }} title="Copy prettified JSON">Pretty</button>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
                                    {resTab === "Body" ? (
                                        responseSearch.trim() && filteredResponseBody ? (
                                            <pre style={{ margin: 0, fontSize: 12, fontFamily: "'Space Mono', monospace", whiteSpace: responseWrap ? "pre-wrap" : "pre", wordBreak: responseWrap ? "break-all" : "normal", color: "var(--ide-text)" }}>{filteredResponseBody}</pre>
                                        ) : isJsonResponse ? (
                                            <div style={{ whiteSpace: responseWrap ? undefined : "pre", overflowX: responseWrap ? undefined : "auto" }}><JsonHighlight json={response.body} /></div>
                                        ) : (
                                            <pre style={{ margin: 0, fontSize: 12, fontFamily: "'Space Mono', monospace", whiteSpace: responseWrap ? "pre-wrap" : "pre" }}>{response.body}</pre>
                                        )
                                    ) : (
                                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                            {Object.entries(response.headers).map(([key, value]) => (
                                                <div key={key} style={{ display: "flex", gap: 12, fontSize: 12, fontFamily: "'Space Mono', monospace" }}>
                                                    <span style={{ color: "var(--ide-text)" }}>{key}:</span>
                                                    <span style={{ color: "var(--ide-text-secondary)", wordBreak: "break-all" }}>{value}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : null}
                    </div>
                </div>
            </div>

            {/* Modals */}
                <ApiModal isOpen={codeGenOpen} onClose={() => setCodeGenOpen(false)} title="Generate Code" width="650px">
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                    {(["curl", "fetch", "python"] as const).map(lang => (
                        <button key={lang} onClick={() => setCodeGenLang(lang)} style={{ background: codeGenLang === lang ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.03)", border: `1px solid ${codeGenLang === lang ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.1)"}`, borderRadius: 8, color: "white", padding: "6px 16px", fontSize: 12, fontFamily: "'Space Mono', monospace", cursor: "pointer" }}>{lang}</button>
                    ))}
                </div>
                <div style={{ position: "relative" }}>
                    <pre style={{ margin: 0, background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: 16, fontSize: 12, fontFamily: "'Space Mono', monospace", color: "white", whiteSpace: "pre-wrap" }}>{generatedCode}</pre>
                    <button onClick={() => copyToClipboard(generatedCode, "Code")} style={{ position: "absolute", top: 8, right: 8, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 6, color: "white", fontSize: 11, padding: "4px 10px", cursor: "pointer" }}>Copy</button>
                </div>
                </ApiModal>

                <ApiModal isOpen={importCurlOpen} onClose={() => setImportCurlOpen(false)} title="Import cURL" width="600px">
                <textarea style={{ ...inputStyle, height: 160, resize: "none", marginBottom: 16 }} value={importCurlText} onChange={e => setImportCurlText(e.target.value)} placeholder="Paste cURL command..." autoFocus />
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                    <button onClick={handleImportCurl} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, color: "white", cursor: "pointer", padding: "8px 20px", fontSize: 13, fontWeight: 600 }}>Import</button>
                </div>
                </ApiModal>

                <ApiModal isOpen={saveCollOpen} onClose={() => setSaveCollOpen(false)} title="Save to Collection" width="450px">
                <label style={labelStyle}>Endpoint Name</label>
                <input style={{ ...inputStyle, marginBottom: 12 }} value={saveCollName} onChange={e => setSaveCollName(e.target.value)} placeholder="e.g. Get Users" autoFocus />
                <label style={labelStyle}>Folder / Group</label>
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                    <select value={saveCollFolder} onChange={e => setSaveCollFolder(e.target.value)} style={{ ...inputStyle, flex: 1, cursor: "pointer" }}>
                        <option value="" style={{ background: "#0a0a0a" }}>— No folder (ungrouped) —</option>
                        {allFolderNames.map(f => <option key={f} value={f} style={{ background: "#0a0a0a" }}>{f}</option>)}
                    </select>
                    <button onClick={() => { const name = prompt("New folder name:"); if (name?.trim()) setSaveCollFolder(name.trim()); }} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "white", fontSize: 11, padding: "6px 10px", cursor: "pointer", whiteSpace: "nowrap" }}>+ New</button>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                    <button onClick={handleSaveToCollection} disabled={!saveCollName.trim()} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, color: "white", cursor: saveCollName.trim() ? "pointer" : "default", padding: "8px 20px", fontSize: 13, fontWeight: 600 }}>Save</button>
                </div>
                </ApiModal>

            {/* Preset Picker */}
                <ApiModal isOpen={presetOpen} onClose={() => setPresetOpen(false)} title="Request Presets" width="560px">
                {/* Dynamic presets from project APIs */}
                {collections.length > 0 && (
                    <>
                        <div style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Your Endpoints ({collections.length})</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 16 }}>
                            {collections.slice(0, 8).map((ep: any) => {
                                const ms = getMethodStyle(ep.method);
                                return (
                                    <button key={ep.id} onClick={() => { loadFromEndpoint(ep); setPresetOpen(false); }} style={{ padding: "10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, cursor: "pointer", textAlign: "left", transition: "all 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.1)"} onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}>
                                        <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 3 }}>
                                            <span style={{ fontSize: 8, fontWeight: 700, fontFamily: "'Space Mono', monospace", padding: "1px 5px", borderRadius: 3, background: ms.bg, color: ms.text, border: `1px solid ${ms.border}` }}>{ep.method}</span>
                                            <span style={{ fontSize: 11, fontWeight: 600, color: "white", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ep.name}</span>
                                        </div>
                                        <div style={{ fontSize: 9, fontFamily: "'Space Mono', monospace", color: "rgba(255,255,255,0.3)" }}>{ep.path}</div>
                                    </button>
                                );
                            })}
                        </div>
                    </>
                )}
                {/* Static templates */}
                <div style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Templates</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    {REQUEST_PRESETS.map(p => {
                        const ms = getMethodStyle(p.method);
                        return (
                            <button key={p.label} onClick={() => applyPreset(p)} style={{ padding: "10px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, cursor: "pointer", textAlign: "left", transition: "all 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.12)"} onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}>
                                <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 3 }}>
                                    <span style={{ fontSize: 8, fontWeight: 700, fontFamily: "'Space Mono', monospace", padding: "1px 5px", borderRadius: 3, background: ms.bg, color: ms.text, border: `1px solid ${ms.border}` }}>{p.method}</span>
                                    <span style={{ fontSize: 11, fontWeight: 600, color: "white" }}>{p.label}</span>
                                </div>
                                <div style={{ fontSize: 9, fontFamily: "'Space Mono', monospace", color: "rgba(255,255,255,0.3)" }}>{p.path}</div>
                            </button>
                        );
                    })}
                </div>
                </ApiModal>

            {/* Environment Editor */}
                <ApiModal isOpen={envEditorOpen} onClose={() => setEnvEditorOpen(false)} title="Manage Environments" width="550px">
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {environments.map((env, i) => (
                        <div key={i} style={{ padding: 12, background: "rgba(255,255,255,0.02)", border: `1px solid ${i === activeEnvIdx ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.1)"}`, borderRadius: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                            <div style={{ display: "flex", gap: 8 }}>
                                <input style={{ ...inputStyle, flex: 1, padding: "5px 10px", fontSize: 12 }} value={env.name} onChange={e => { const u = [...environments]; u[i] = { ...u[i], name: e.target.value }; setEnvironments(u); }} placeholder="Name" />
                                <button onClick={() => { if (environments.length > 1) setEnvironments(environments.filter((_, j) => j !== i)); }} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, color: "rgba(255,255,255,0.6)", fontSize: 9, padding: "4px 8px", cursor: "pointer", fontWeight: 700, fontFamily: "'Space Mono', monospace" }}>REMOVE</button>
                            </div>
                            <input style={{ ...inputStyle, padding: "5px 10px", fontSize: 11 }} value={env.baseUrl} onChange={e => { const u = [...environments]; u[i] = { ...u[i], baseUrl: e.target.value }; setEnvironments(u); }} placeholder="Base URL" />
                            <input style={{ ...inputStyle, padding: "5px 10px", fontSize: 11 }} value={env.token} onChange={e => { const u = [...environments]; u[i] = { ...u[i], token: e.target.value }; setEnvironments(u); }} placeholder="Bearer Token (optional)" type="password" />
                        </div>
                    ))}
                    <button onClick={() => setEnvironments([...environments, { name: "New", baseUrl: "http://localhost:3000", token: "" }])} style={{ alignSelf: "flex-start", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, color: "white", fontSize: 11, padding: "6px 14px", cursor: "pointer" }}>+ Add Environment</button>
                </div>
                </ApiModal>

            {toast && <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />}
        </div>
    );
};

export default APIsPage;
