/**
 * APIs Page — Requestly-Style API Client (Full Featured)
 *
 * Features:
 * - Three-panel layout: Collections + History | Request Builder | Response Viewer
 * - Code generation (cURL, fetch, Python requests)
 * - Import from cURL
 * - JSON syntax highlighting in response
 * - Body format selector (JSON / Raw / Form Data)
 * - Copy response body
 * - Save request to project collection
 * - Keyboard shortcuts (Ctrl+Enter to send)
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import useApi from "../hooks/useApi";
import { useProjectStore } from "../hooks/useProjectStore";
import { addApi } from "../stores/projectStore";
import type { ProxyResponse, ApiRequestEntry } from "../types/api";

/* ━━━ Constants ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;

const METHOD_COLORS: Record<string, string> = {
    GET: "text-emerald-400", POST: "text-blue-400", PUT: "text-amber-400",
    PATCH: "text-orange-400", DELETE: "text-red-400", HEAD: "text-purple-400", OPTIONS: "text-cyan-400",
};

function getStatusColor(status: number): string {
    if (status >= 200 && status < 300) return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    if (status >= 300 && status < 400) return "bg-blue-500/15 text-blue-400 border-blue-500/30";
    if (status >= 400 && status < 500) return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    if (status >= 500) return "bg-red-500/15 text-red-400 border-red-500/30";
    return "bg-gray-500/15 text-gray-400 border-gray-500/30";
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

function parseCurl(curlStr: string): { method: string; url: string; headers: Record<string, string>; body: string } {
    const result = { method: "GET", url: "", headers: {} as Record<string, string>, body: "" };
    // Remove line continuations and normalize
    const cmd = curlStr.replace(/\\\n/g, " ").replace(/\\\r\n/g, " ").trim();

    // Extract URL — find first thing that looks like a URL
    const urlMatch = cmd.match(/(?:curl\s+)?(?:['"]?(https?:\/\/[^\s'"]+)['"]?)/i);
    if (urlMatch) result.url = urlMatch[1];

    // Method
    const methodMatch = cmd.match(/-X\s+(\w+)/i);
    if (methodMatch) result.method = methodMatch[1].toUpperCase();

    // Headers
    const headerRegex = /-H\s+['"]([^'"]+)['"]/gi;
    let hMatch;
    while ((hMatch = headerRegex.exec(cmd)) !== null) {
        const [key, ...valParts] = hMatch[1].split(":");
        if (key && valParts.length > 0) {
            result.headers[key.trim()] = valParts.join(":").trim();
        }
    }

    // Body (--data, -d, --data-raw)
    const bodyMatch = cmd.match(/(?:--data-raw|--data|-d)\s+['"]([^'"]*)['"]/i);
    if (bodyMatch) {
        result.body = bodyMatch[1];
        if (result.method === "GET") result.method = "POST";
    }

    return result;
}

/* ━━━ Code Generation ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function generateCurl(method: string, url: string, headers: Record<string, string>, body: string): string {
    let cmd = `curl -X ${method} '${url}'`;
    Object.entries(headers).forEach(([k, v]) => { cmd += ` \\\n  -H '${k}: ${v}'`; });
    if (body && method !== "GET" && method !== "HEAD") cmd += ` \\\n  -d '${body}'`;
    return cmd;
}

function generateFetch(method: string, url: string, headers: Record<string, string>, body: string): string {
    const opts: string[] = [`  method: '${method}'`];
    if (Object.keys(headers).length > 0) {
        opts.push(`  headers: ${JSON.stringify(headers, null, 4).split('\n').map((l, i) => i === 0 ? l : '  ' + l).join('\n')}`);
    }
    if (body && method !== "GET" && method !== "HEAD") {
        opts.push(`  body: ${JSON.stringify(body)}`);
    }
    return `const response = await fetch('${url}', {\n${opts.join(',\n')}\n});\nconst data = await response.json();\nconsole.log(data);`;
}

function generatePython(method: string, url: string, headers: Record<string, string>, body: string): string {
    let code = `import requests\n\n`;
    const hasHeaders = Object.keys(headers).length > 0;
    if (hasHeaders) code += `headers = ${JSON.stringify(headers, null, 4)}\n\n`;
    code += `response = requests.${method.toLowerCase()}(\n    '${url}'`;
    if (hasHeaders) code += `,\n    headers=headers`;
    if (body && method !== "GET" && method !== "HEAD") code += `,\n    json=${body}`;
    code += `\n)\n\nprint(response.status_code)\nprint(response.json())`;
    return code;
}

/* ━━━ JSON Syntax Highlighter ━━━━━━━━━━━━━━━━━━━━━━━━━ */

const JsonHighlight: React.FC<{ json: string }> = ({ json }) => {
    const highlighted = useMemo(() => {
        const pretty = tryPrettyJson(json);
        // Replace JSON tokens with styled spans
        return pretty.replace(
            /("(?:\\.|[^"\\])*")\s*:/g,
            '<span class="json-key">$1</span>:'
        ).replace(
            /:\s*("(?:\\.|[^"\\])*")/g,
            ': <span class="json-string">$1</span>'
        ).replace(
            /:\s*(\d+\.?\d*)/g,
            ': <span class="json-number">$1</span>'
        ).replace(
            /:\s*(true|false)/g,
            ': <span class="json-bool">$1</span>'
        ).replace(
            /:\s*(null)/g,
            ': <span class="json-null">$1</span>'
        );
    }, [json]);

    return <pre className="text-xs font-mono leading-relaxed whitespace-pre-wrap break-words" dangerouslySetInnerHTML={{ __html: highlighted }} />;
};

/* ━━━ Key-Value Editor ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

interface KVPair { key: string; value: string; enabled: boolean }

const KVEditor: React.FC<{
    pairs: KVPair[];
    onChange: (pairs: KVPair[]) => void;
    keyPlaceholder?: string;
    valuePlaceholder?: string;
}> = ({ pairs, onChange, keyPlaceholder = "Key", valuePlaceholder = "Value" }) => {
    const update = (i: number, field: keyof KVPair, value: any) => {
        const updated = [...pairs];
        updated[i] = { ...updated[i], [field]: value };
        onChange(updated);
    };
    const remove = (i: number) => onChange(pairs.filter((_, idx) => idx !== i));
    const add = () => onChange([...pairs, { key: "", value: "", enabled: true }]);

    return (
        <div className="space-y-1.5">
            {/* Column headers */}
            <div className="flex items-center gap-2 px-0.5 mb-1">
                <span className="w-4" />
                <span className="flex-1 text-[9px] uppercase tracking-wider text-[var(--ide-text-muted)] font-bold">{keyPlaceholder}</span>
                <span className="flex-1 text-[9px] uppercase tracking-wider text-[var(--ide-text-muted)] font-bold">{valuePlaceholder}</span>
                <span className="w-6" />
            </div>
            {pairs.map((pair, i) => (
                <div key={i} className="flex items-center gap-2 group">
                    <input type="checkbox" checked={pair.enabled} onChange={e => update(i, "enabled", e.target.checked)} className="rounded accent-indigo-500 shrink-0" />
                    <input className="flex-1 bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded-lg px-3 py-1.5 text-xs font-mono text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)]/40 focus:outline-none focus:border-indigo-500/50 transition-all" value={pair.key} onChange={e => update(i, "key", e.target.value)} placeholder={keyPlaceholder} />
                    <input className="flex-1 bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded-lg px-3 py-1.5 text-xs font-mono text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)]/40 focus:outline-none focus:border-indigo-500/50 transition-all" value={pair.value} onChange={e => update(i, "value", e.target.value)} placeholder={valuePlaceholder} />
                    <button onClick={() => remove(i)} className="opacity-0 group-hover:opacity-100 text-[var(--ide-text-muted)] hover:text-red-400 p-1 transition-all shrink-0">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            ))}
            <button onClick={add} className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors pl-7">+ Add</button>
        </div>
    );
};

/* ━━━ Tab Bar ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const TabBar: React.FC<{ tabs: string[]; active: string; onChange: (tab: string) => void; counts?: Record<string, number>; extra?: React.ReactNode }> = ({ tabs, active, onChange, counts, extra }) => (
    <div className="flex border-b border-[var(--ide-border)] items-center">
        {tabs.map(tab => (
            <button key={tab} onClick={() => onChange(tab)}
                className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all border-b-2 ${active === tab ? "text-indigo-400 border-indigo-400" : "text-[var(--ide-text-muted)] border-transparent hover:text-[var(--ide-text)]"}`}>
                {tab}
                {counts && counts[tab] !== undefined && counts[tab] > 0 && (
                    <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)]">{counts[tab]}</span>
                )}
            </button>
        ))}
        {extra && <div className="ml-auto pr-2 flex items-center gap-1">{extra}</div>}
    </div>
);

/* ━━━ Modal Overlay ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; width?: string; children: React.ReactNode }> = ({ isOpen, onClose, title, width = "600px", children }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div className="relative bg-[var(--ide-bg-sidebar)] rounded-xl border border-[var(--ide-border)] shadow-2xl animate-scale-in" style={{ maxWidth: width, width: "90%", maxHeight: "80vh" }} onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--ide-border)]">
                    <h3 className="text-sm font-bold text-[var(--ide-text)]">{title}</h3>
                    <button onClick={onClose} className="text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <div className="p-5 overflow-y-auto" style={{ maxHeight: "calc(80vh - 52px)" }}>
                    {children}
                </div>
            </div>
        </div>
    );
};

/* ━━━ Toast ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const Toast: React.FC<{ message: string; type?: "success" | "error"; onDone: () => void }> = ({ message, type = "success", onDone }) => {
    useEffect(() => { const t = setTimeout(onDone, 2500); return () => clearTimeout(t); }, [onDone]);
    const color = type === "success" ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300" : "bg-red-500/20 border-red-500/40 text-red-300";
    return (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-lg border backdrop-blur-md text-sm font-medium ${color}`} style={{ animation: "api-fadeIn 0.2s ease-out" }}>
            {message}
        </div>
    );
};

/* ━━━ Main Page ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const APIsPage: React.FC = () => {
    const api = useApi();
    const { project } = useProjectStore();

    // Request state
    const [method, setMethod] = useState("GET");
    const [url, setUrl] = useState("");
    const [params, setParams] = useState<KVPair[]>([{ key: "", value: "", enabled: true }]);
    const [headers, setHeaders] = useState<KVPair[]>([{ key: "Content-Type", value: "application/json", enabled: true }]);
    const [bodyText, setBodyText] = useState("");
    const [bodyFormat, setBodyFormat] = useState<"json" | "raw" | "form">("json");
    const [authToken, setAuthToken] = useState("");

    // Tabs
    const [reqTab, setReqTab] = useState("Params");
    const [resTab, setResTab] = useState("Body");

    // Response
    const [response, setResponse] = useState<ProxyResponse | null>(null);
    const [loading, setLoading] = useState(false);

    // Sidebar
    const [sidebarTab, setSidebarTab] = useState<"collections" | "history">("collections");
    const [history, setHistory] = useState<ApiRequestEntry[]>([]);

    // Modals
    const [codeGenOpen, setCodeGenOpen] = useState(false);
    const [codeGenLang, setCodeGenLang] = useState<"curl" | "fetch" | "python">("curl");
    const [importCurlOpen, setImportCurlOpen] = useState(false);
    const [importCurlText, setImportCurlText] = useState("");
    const [saveCollOpen, setSaveCollOpen] = useState(false);
    const [saveCollName, setSaveCollName] = useState("");

    // Toast
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

    // Collections from project
    const collections = useMemo(() => (project?.apis || []).filter((a: any) => !a.archived), [project]);

    // Load history
    useEffect(() => { api.listApiHistory().then(setHistory).catch(console.error); }, []);

    const urlRef = useRef<HTMLInputElement>(null);

    /* ─── Build headers/params objects ─────────── */
    const buildHeaders = useCallback((): Record<string, string> => {
        const hdrs: Record<string, string> = {};
        headers.filter(h => h.enabled && h.key.trim()).forEach(h => { hdrs[h.key.trim()] = h.value; });
        if (authToken.trim()) hdrs["Authorization"] = `Bearer ${authToken.trim()}`;
        return hdrs;
    }, [headers, authToken]);

    const buildParams = useCallback((): Record<string, string> => {
        const prms: Record<string, string> = {};
        params.filter(p => p.enabled && p.key.trim()).forEach(p => { prms[p.key.trim()] = p.value; });
        return prms;
    }, [params]);

    /* ─── Send Request ─────────────────────────── */
    const sendRequest = useCallback(async () => {
        if (!url.trim()) return;
        setLoading(true);
        setResponse(null);
        const hdrs = buildHeaders();
        const prms = buildParams();

        // Handle form data body format
        let sendBody = bodyText;
        if (bodyFormat === "form" && bodyText.trim()) {
            // Convert key=value lines to JSON
            try {
                const obj: Record<string, string> = {};
                bodyText.split("\n").forEach(line => {
                    const [k, ...v] = line.split("=");
                    if (k?.trim()) obj[k.trim()] = v.join("=").trim();
                });
                sendBody = JSON.stringify(obj);
                if (!hdrs["Content-Type"]) hdrs["Content-Type"] = "application/x-www-form-urlencoded";
            } catch { /* keep as-is */ }
        }

        try {
            const result: ProxyResponse = await api.sendProxyRequest({
                method, url: url.trim(), headers: hdrs, body: sendBody || undefined,
                params: Object.keys(prms).length > 0 ? prms : undefined,
            });
            setResponse(result);
            // Save to history
            try {
                await api.saveApiHistory({
                    method, url: url.trim(), headers: hdrs, body: sendBody,
                    params: prms, responseStatus: result.status, responseHeaders: result.headers,
                    responseBody: result.body?.substring(0, 5000) || "", duration: result.duration_ms,
                });
                setHistory(await api.listApiHistory());
            } catch { /* non-critical */ }
        } catch (err: any) {
            setResponse({ status: 0, statusText: "Error", headers: {}, body: err.message || "Request failed", duration_ms: 0, url: url.trim(), error: true });
        } finally { setLoading(false); }
    }, [method, url, headers, params, bodyText, bodyFormat, authToken, api, buildHeaders, buildParams]);

    /* ─── Keyboard shortcut ────────────────────── */
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); sendRequest(); }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [sendRequest]);

    /* ─── Load from collection / history ──────── */
    const loadFromEndpoint = (ep: any) => {
        setMethod(ep.method || "GET");
        setUrl(ep.path.startsWith("http") ? ep.path : `http://localhost:3001${ep.path}`);
        setResponse(null);
        if (ep.request_body?.fields?.length > 0) {
            const skeleton: Record<string, string> = {};
            ep.request_body.fields.forEach((f: any) => {
                skeleton[f.name] = f.field_type === "number" ? "0" : f.field_type === "boolean" ? "false" : "";
            });
            setBodyText(JSON.stringify(skeleton, null, 2));
        } else { setBodyText(""); }
    };

    const loadFromHistory = (entry: ApiRequestEntry) => {
        setMethod(entry.method);
        setUrl(entry.url);
        setBodyText(entry.body || "");
        setResponse(null);
        const hPairs = Object.entries(entry.headers || {}).map(([key, value]) => ({ key, value, enabled: true }));
        if (hPairs.length > 0) setHeaders(hPairs);
        const pPairs = Object.entries(entry.params || {}).map(([key, value]) => ({ key, value, enabled: true }));
        if (pPairs.length > 0) setParams(pPairs);
        if (entry.response_status) {
            setResponse({ status: entry.response_status, statusText: entry.response_status >= 200 && entry.response_status < 300 ? "OK" : "Error", headers: entry.response_headers || {}, body: entry.response_body || "", duration_ms: entry.duration || 0, url: entry.url });
        }
    };

    /* ─── Import cURL ──────────────────────────── */
    const handleImportCurl = () => {
        const parsed = parseCurl(importCurlText);
        if (!parsed.url) { setToast({ message: "Could not parse URL from cURL", type: "error" }); return; }
        setMethod(parsed.method);
        setUrl(parsed.url);
        setBodyText(parsed.body);
        const hPairs = Object.entries(parsed.headers).map(([key, value]) => ({ key, value, enabled: true }));
        if (hPairs.length > 0) setHeaders(hPairs);
        setImportCurlOpen(false);
        setImportCurlText("");
        setToast({ message: "cURL imported successfully", type: "success" });
    };

    /* ─── Save to Collection ───────────────────── */
    const handleSaveToCollection = async () => {
        if (!saveCollName.trim()) return;
        try {
            const path = url.replace(/^https?:\/\/[^/]+/, "") || "/api/new";
            await addApi(method, path, saveCollName.trim());
            setSaveCollOpen(false);
            setSaveCollName("");
            setToast({ message: `Saved "${saveCollName}" to collections`, type: "success" });
        } catch (err: any) {
            setToast({ message: `Failed to save: ${err.message}`, type: "error" });
        }
    };

    /* ─── Copy to clipboard ────────────────────── */
    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        setToast({ message: `${label} copied to clipboard`, type: "success" });
    };

    /* ─── Generated code ───────────────────────── */
    const generatedCode = useMemo(() => {
        const hdrs = buildHeaders();
        switch (codeGenLang) {
            case "curl": return generateCurl(method, url || "https://example.com", hdrs, bodyText);
            case "fetch": return generateFetch(method, url || "https://example.com", hdrs, bodyText);
            case "python": return generatePython(method, url || "https://example.com", hdrs, bodyText);
        }
    }, [codeGenLang, method, url, bodyText, buildHeaders]);

    const reqTabCounts = {
        Params: params.filter(p => p.enabled && p.key.trim()).length,
        Headers: headers.filter(h => h.enabled && h.key.trim()).length,
        Body: bodyText.trim() ? 1 : 0,
        Auth: authToken.trim() ? 1 : 0,
    };

    const isJsonResponse = useMemo(() => {
        if (!response?.body) return false;
        try { JSON.parse(response.body); return true; } catch { return false; }
    }, [response]);

    return (
        <div className="flex flex-1 overflow-hidden h-full bg-[var(--ide-bg)] page-enter">
            {/* ─── Left Sidebar ─────────────────── */}
            <div className="w-72 bg-[var(--ide-bg-sidebar)] border-r border-[var(--ide-border)] flex flex-col flex-shrink-0 animate-slide-left">
                {/* Sidebar Tabs */}
                <div className="flex border-b border-[var(--ide-border)] shrink-0">
                    <button onClick={() => setSidebarTab("collections")}
                        className={`flex-1 px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider transition-all ${sidebarTab === "collections" ? "text-indigo-400 border-b-2 border-indigo-400" : "text-[var(--ide-text-muted)]"}`}>
                        Collections
                    </button>
                    <button onClick={() => setSidebarTab("history")}
                        className={`flex-1 px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider transition-all ${sidebarTab === "history" ? "text-indigo-400 border-b-2 border-indigo-400" : "text-[var(--ide-text-muted)]"}`}>
                        History {history.length > 0 && <span className="ml-1 text-[9px] opacity-60">({history.length})</span>}
                    </button>
                </div>

                {/* Sidebar Actions */}
                <div className="shrink-0 flex items-center gap-1 px-2 py-1.5 border-b border-[var(--ide-border)]">
                    <button onClick={() => setImportCurlOpen(true)} title="Import cURL"
                        className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-[10px] font-semibold text-[var(--ide-text-muted)] hover:text-indigo-400 hover:bg-indigo-500/10 rounded-md transition-all">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                        Import cURL
                    </button>
                    <button onClick={() => setCodeGenOpen(true)} title="Generate Code"
                        className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-[10px] font-semibold text-[var(--ide-text-muted)] hover:text-indigo-400 hover:bg-indigo-500/10 rounded-md transition-all">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                        Code Gen
                    </button>
                </div>

                {/* Sidebar Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {sidebarTab === "collections" ? (
                        <div className="p-2 space-y-0.5">
                            {collections.length === 0 ? (
                                <div className="p-4 text-center text-[var(--ide-text-muted)] text-xs">
                                    <svg className="w-10 h-10 mx-auto mb-2 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                                    <p className="mb-1 font-medium">No endpoints yet</p>
                                    <p className="text-[10px] opacity-60">Define endpoints or save requests here</p>
                                </div>
                            ) : (
                                collections.map((ep: any) => (
                                    <button key={ep.id} onClick={() => loadFromEndpoint(ep)}
                                        className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-[var(--ide-bg-panel)] transition-colors group">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className={`text-[10px] font-bold font-mono ${METHOD_COLORS[ep.method] || "text-gray-400"}`}>{ep.method}</span>
                                            <span className="text-xs font-mono text-[var(--ide-text)] truncate">{ep.path}</span>
                                        </div>
                                        <span className="text-[10px] text-[var(--ide-text-muted)]">{ep.name}</span>
                                    </button>
                                ))
                            )}
                        </div>
                    ) : (
                        <div className="p-2 space-y-0.5">
                            {history.length === 0 ? (
                                <div className="p-4 text-center text-[var(--ide-text-muted)] text-xs">
                                    <svg className="w-10 h-10 mx-auto mb-2 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    <p className="font-medium mb-1">No history</p>
                                    <p className="text-[10px] opacity-60">Send a request to see it here</p>
                                </div>
                            ) : (
                                <>
                                    <button onClick={async () => { await api.clearApiHistory(); setHistory([]); setToast({ message: "History cleared", type: "success" }); }}
                                        className="w-full text-[10px] text-[var(--ide-text-muted)] hover:text-red-400 py-1 transition-colors text-right pr-2">
                                        Clear All
                                    </button>
                                    {history.map((entry) => (
                                        <button key={entry.id} onClick={() => loadFromHistory(entry)}
                                            className="w-full text-left px-3 py-2 rounded-lg hover:bg-[var(--ide-bg-panel)] transition-colors group">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span className={`text-[10px] font-bold font-mono ${METHOD_COLORS[entry.method] || "text-gray-400"}`}>{entry.method}</span>
                                                {entry.response_status && (
                                                    <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${getStatusColor(entry.response_status)}`}>{entry.response_status}</span>
                                                )}
                                                <span className="text-[10px] text-[var(--ide-text-muted)] ml-auto">{formatDuration(entry.duration)}</span>
                                            </div>
                                            <span className="text-[10px] font-mono text-[var(--ide-text-secondary)] truncate block">{entry.url.replace(/^https?:\/\//, '').substring(0, 35)}</span>
                                            <span className="text-[9px] text-[var(--ide-text-muted)]">{new Date(entry.created_at).toLocaleTimeString()}</span>
                                        </button>
                                    ))}
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ─── Main Content ─────────────────── */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* URL Bar */}
                <div className="shrink-0 px-4 py-3 bg-[var(--ide-chrome)] border-b border-[var(--ide-border)] animate-slide-down">
                    <div className="flex items-center gap-2">
                        <select value={method} onChange={e => setMethod(e.target.value)}
                            className={`bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded-lg text-sm font-mono font-bold px-3 py-2.5 focus:outline-none focus:border-indigo-500/50 transition-all cursor-pointer ${METHOD_COLORS[method] || "text-gray-400"}`}
                            style={{ minWidth: 100 }}>
                            {HTTP_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>

                        <input ref={urlRef} type="text" value={url} onChange={e => setUrl(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) sendRequest(); }}
                            placeholder="Enter URL (e.g., https://jsonplaceholder.typicode.com/posts)"
                            className="flex-1 bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded-lg px-4 py-2.5 text-sm font-mono text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)]/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all" />

                        {/* Action Buttons */}
                        <button onClick={() => setSaveCollOpen(true)} title="Save to Collection"
                            className="p-2.5 text-[var(--ide-text-muted)] hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-all">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                        </button>

                        <button onClick={sendRequest} disabled={loading || !url.trim()}
                            className="px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold uppercase tracking-wider transition-all disabled:opacity-40 shadow-lg shadow-indigo-500/20 flex items-center gap-2">
                            {loading ? <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>}
                            Send
                        </button>
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[10px] text-[var(--ide-text-muted)]">
                            <kbd className="px-1.5 py-0.5 rounded bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] text-[9px] font-mono mr-1">Ctrl+Enter</kbd>
                            to send
                        </span>
                    </div>
                </div>

                {/* Request / Response Split */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Request Section */}
                    <div className="shrink-0 border-b border-[var(--ide-border)]" style={{ minHeight: 160 }}>
                        <TabBar tabs={["Params", "Headers", "Body", "Auth"]} active={reqTab} onChange={setReqTab} counts={reqTabCounts} />
                        <div className="p-4 overflow-y-auto" style={{ maxHeight: 220 }}>
                            {reqTab === "Params" && <KVEditor pairs={params} onChange={setParams} keyPlaceholder="Parameter" valuePlaceholder="Value" />}
                            {reqTab === "Headers" && <KVEditor pairs={headers} onChange={setHeaders} keyPlaceholder="Header" valuePlaceholder="Value" />}
                            {reqTab === "Body" && (
                                <div>
                                    <div className="flex items-center gap-2 mb-3">
                                        {(["json", "raw", "form"] as const).map(fmt => (
                                            <button key={fmt} onClick={() => setBodyFormat(fmt)}
                                                className={`px-3 py-1 text-[10px] font-bold uppercase rounded-md border transition-all ${bodyFormat === fmt ? "bg-indigo-500/15 text-indigo-400 border-indigo-500/30" : "text-[var(--ide-text-muted)] border-[var(--ide-border)] hover:text-[var(--ide-text)]"}`}>
                                                {fmt === "json" ? "JSON" : fmt === "raw" ? "Raw" : "Form Data"}
                                            </button>
                                        ))}
                                    </div>
                                    <textarea
                                        className="w-full h-32 bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded-lg px-4 py-3 text-xs font-mono text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)]/40 focus:outline-none focus:border-indigo-500/50 resize-none transition-all"
                                        value={bodyText} onChange={e => setBodyText(e.target.value)}
                                        placeholder={bodyFormat === "form" ? "key1=value1\nkey2=value2" : bodyFormat === "json" ? '{"key": "value"}' : "Raw body content..."} />
                                    {bodyFormat === "json" && bodyText.trim() && (
                                        <div className="mt-1.5 flex items-center gap-2">
                                            {(() => { try { JSON.parse(bodyText); return <span className="text-[10px] text-emerald-400 flex items-center gap-1"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>Valid JSON</span>; } catch { return <span className="text-[10px] text-red-400 flex items-center gap-1"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>Invalid JSON</span>; } })()}
                                            <button onClick={() => { try { setBodyText(JSON.stringify(JSON.parse(bodyText), null, 2)); } catch { } }}
                                                className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors">Prettify</button>
                                        </div>
                                    )}
                                </div>
                            )}
                            {reqTab === "Auth" && (
                                <div className="space-y-3">
                                    <label className="text-xs font-semibold text-[var(--ide-text-muted)] uppercase tracking-wide">Bearer Token</label>
                                    <input className="w-full bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded-lg px-4 py-2.5 text-xs font-mono text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)]/40 focus:outline-none focus:border-indigo-500/50 transition-all"
                                        value={authToken} onChange={e => setAuthToken(e.target.value)} placeholder="Enter your bearer token..." type="password" />
                                    <p className="text-[10px] text-[var(--ide-text-muted)]">
                                        Sent as <code className="bg-[var(--ide-bg-elevated)] px-1.5 py-0.5 rounded text-indigo-400 text-[9px]">Authorization: Bearer &lt;token&gt;</code>
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Response Section */}
                    <div className="flex-1 flex flex-col overflow-hidden bg-[var(--ide-bg-panel)]">
                        {!response && !loading ? (
                            <div className="flex-1 flex items-center justify-center text-[var(--ide-text-muted)]">
                                <div className="text-center">
                                    <svg className="w-16 h-16 mx-auto mb-3 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                    <p className="text-sm font-medium mb-1">Ready to send</p>
                                    <p className="text-xs opacity-60">Enter a URL and press <kbd className="px-1.5 py-0.5 rounded bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] text-[9px] font-mono">Ctrl+Enter</kbd></p>
                                </div>
                            </div>
                        ) : loading ? (
                            <div className="flex-1 flex items-center justify-center text-[var(--ide-text-muted)]">
                                <div className="flex items-center gap-3">
                                    <span className="inline-block w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin" />
                                    <span className="text-sm">Sending request...</span>
                                </div>
                            </div>
                        ) : response ? (
                            <div className="flex flex-col flex-1 overflow-hidden" style={{ animation: "api-fadeIn 0.2s ease-out" }}>
                                {/* Response Status Bar */}
                                <div className="shrink-0 px-4 py-2.5 flex items-center gap-3 border-b border-[var(--ide-border)] bg-[var(--ide-chrome)]">
                                    <span className={`text-xs font-bold font-mono px-3 py-1 rounded-lg border ${response.error ? "bg-red-500/15 text-red-400 border-red-500/30" : getStatusColor(response.status)}`}>
                                        {response.error ? "ERR" : response.status} {response.statusText}
                                    </span>
                                    <span className="text-xs text-[var(--ide-text-muted)] flex items-center gap-1">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth="2" /><path strokeLinecap="round" strokeWidth="2" d="M12 6v6l4 2" /></svg>
                                        {formatDuration(response.duration_ms)}
                                    </span>
                                    <span className="text-xs text-[var(--ide-text-muted)] flex items-center gap-1">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7c-2 0-3 1-3 3z" /></svg>
                                        {formatBytes(response.body)}
                                    </span>
                                    <div className="ml-auto flex items-center gap-1">
                                        <button onClick={() => copyToClipboard(response.body, "Response")}
                                            className="p-1.5 text-[var(--ide-text-muted)] hover:text-indigo-400 hover:bg-indigo-500/10 rounded transition-all" title="Copy Response">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" strokeWidth="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" strokeWidth="2" /></svg>
                                        </button>
                                    </div>
                                </div>

                                {/* Response Tabs */}
                                <TabBar tabs={["Body", "Headers"]} active={resTab} onChange={setResTab}
                                    counts={{ Headers: Object.keys(response.headers).length }} />

                                {/* Response Content */}
                                <div className="flex-1 overflow-auto custom-scrollbar p-4">
                                    {resTab === "Body" ? (
                                        isJsonResponse ? <JsonHighlight json={response.body} />
                                            : <pre className="text-xs font-mono text-[var(--ide-text)] whitespace-pre-wrap break-words leading-relaxed">{response.body}</pre>
                                    ) : (
                                        <div className="space-y-1">
                                            {Object.entries(response.headers).map(([key, value]) => (
                                                <div key={key} className="flex gap-3 text-xs font-mono group">
                                                    <span className="text-indigo-400 shrink-0 font-medium">{key}:</span>
                                                    <span className="text-[var(--ide-text-secondary)] break-all">{value}</span>
                                                    <button onClick={() => copyToClipboard(value, key)}
                                                        className="opacity-0 group-hover:opacity-100 text-[var(--ide-text-muted)] hover:text-indigo-400 transition-all shrink-0">
                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" strokeWidth="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" strokeWidth="2" /></svg>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>

            {/* ─── Code Gen Modal ───────────────── */}
            <Modal isOpen={codeGenOpen} onClose={() => setCodeGenOpen(false)} title="Generate Code" width="650px">
                <div className="flex gap-2 mb-4">
                    {(["curl", "fetch", "python"] as const).map(lang => (
                        <button key={lang} onClick={() => setCodeGenLang(lang)}
                            className={`px-4 py-1.5 text-xs font-bold rounded-lg border transition-all ${codeGenLang === lang ? "bg-indigo-500/15 text-indigo-400 border-indigo-500/30" : "text-[var(--ide-text-muted)] border-[var(--ide-border)] hover:text-[var(--ide-text)]"}`}>
                            {lang === "curl" ? "cURL" : lang === "fetch" ? "JavaScript" : "Python"}
                        </button>
                    ))}
                </div>
                <div className="relative">
                    <pre className="bg-[var(--ide-bg)] rounded-lg p-4 text-xs font-mono text-[var(--ide-text)] whitespace-pre-wrap border border-[var(--ide-border)] overflow-auto max-h-64">{generatedCode}</pre>
                    <button onClick={() => copyToClipboard(generatedCode, "Code")}
                        className="absolute top-2 right-2 p-2 text-[var(--ide-text-muted)] hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-all">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" strokeWidth="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" strokeWidth="2" /></svg>
                    </button>
                </div>
            </Modal>

            {/* ─── Import cURL Modal ─────────────── */}
            <Modal isOpen={importCurlOpen} onClose={() => setImportCurlOpen(false)} title="Import from cURL" width="600px">
                <p className="text-xs text-[var(--ide-text-muted)] mb-3">Paste a cURL command and we'll parse it into the request builder.</p>
                <textarea className="w-full h-40 bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded-lg px-4 py-3 text-xs font-mono text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)]/40 focus:outline-none focus:border-indigo-500/50 resize-none"
                    value={importCurlText} onChange={e => setImportCurlText(e.target.value)}
                    placeholder={`curl -X POST 'https://api.example.com/data' \\\n  -H 'Content-Type: application/json' \\\n  -d '{"key": "value"}'`} autoFocus />
                <div className="flex justify-end gap-2 mt-4">
                    <button onClick={() => setImportCurlOpen(false)} className="px-4 py-2 text-sm text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] rounded-lg border border-[var(--ide-border)] transition-all">Cancel</button>
                    <button onClick={handleImportCurl} disabled={!importCurlText.trim()} className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold disabled:opacity-40 transition-all">Import</button>
                </div>
            </Modal>

            {/* ─── Save to Collection Modal ──────── */}
            <Modal isOpen={saveCollOpen} onClose={() => setSaveCollOpen(false)} title="Save to Collection" width="450px">
                <p className="text-xs text-[var(--ide-text-muted)] mb-3">Save the current request as a project API endpoint.</p>
                <div className="space-y-3">
                    <div>
                        <label className="text-[10px] uppercase font-bold text-[var(--ide-text-muted)] tracking-wide">Endpoint Name</label>
                        <input className="w-full bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded-lg px-4 py-2.5 text-sm text-[var(--ide-text)] mt-1 focus:outline-none focus:border-indigo-500/50"
                            value={saveCollName} onChange={e => setSaveCollName(e.target.value)} placeholder="e.g., List Users" autoFocus
                            onKeyDown={e => { if (e.key === "Enter") handleSaveToCollection(); }} />
                    </div>
                    <div className="bg-[var(--ide-bg)] rounded-lg p-3 border border-[var(--ide-border)]">
                        <div className="flex items-center gap-2 text-xs font-mono">
                            <span className={`font-bold ${METHOD_COLORS[method] || "text-gray-400"}`}>{method}</span>
                            <span className="text-[var(--ide-text)]">{url || "/api/..."}</span>
                        </div>
                    </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                    <button onClick={() => setSaveCollOpen(false)} className="px-4 py-2 text-sm text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] rounded-lg border border-[var(--ide-border)] transition-all">Cancel</button>
                    <button onClick={handleSaveToCollection} disabled={!saveCollName.trim()} className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold disabled:opacity-40 transition-all">Save</button>
                </div>
            </Modal>

            {/* ─── Toast ─────────────────────────── */}
            {toast && <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />}

            {/* ─── Styles ────────────────────────── */}
            <style>{`
                @keyframes api-fadeIn {
                    from { opacity: 0; transform: translateY(4px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .json-key { color: #93c5fd; }
                .json-string { color: #86efac; }
                .json-number { color: #fbbf24; }
                .json-bool { color: #c084fc; }
                .json-null { color: #f87171; }
            `}</style>
        </div>
    );
};

export default APIsPage;
