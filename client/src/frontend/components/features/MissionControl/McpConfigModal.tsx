import React, { useState, useEffect } from 'react';
import { Radio, X, Copy, Check } from 'lucide-react';
import { fetchMcpConfig, type McpServerConfig } from '../../../services/agentSquadService';

interface McpConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCopySuccess?: (msg: string) => void;
}

export const McpConfigModal: React.FC<McpConfigModalProps> = ({ isOpen, onClose, onCopySuccess }) => {
    const [mcpTab, setMcpTab] = useState<'antigravity' | 'claude' | 'http'>('antigravity');
    const [copiedSnippet, setCopiedSnippet] = useState(false);
    const [mcpConfig, setMcpConfig] = useState<McpServerConfig | null>(null);

    useEffect(() => {
        if (!isOpen) return;

        fetchMcpConfig()
            .then((data) => setMcpConfig(data))
            .catch(() => {
                // If fetch fails, mcpConfig remains null and fallback generator is used
            });
    }, [isOpen]);

    if (!isOpen) return null;

    const getMcpSnippet = (tab: 'antigravity' | 'claude' | 'http') => {
        const origin = typeof window !== 'undefined'
            ? window.location.origin.replace(':5173', ':3001')
            : 'http://localhost:3001';

        if (tab === 'http') {
            return mcpConfig?.httpEndpoint || `${origin}/api/mcp`;
        }

        if (tab === 'antigravity') {
            if (mcpConfig?.antigravity) {
                return JSON.stringify(mcpConfig.antigravity, null, 2);
            }
            return JSON.stringify({
                mcpServers: {
                    akasha: {
                        command: "node",
                        args: ["server/dist/mcp/akashaMcpServer.js"]
                    }
                }
            }, null, 2);
        }

        if (tab === 'claude') {
            if (mcpConfig?.claudeDesktop) {
                return JSON.stringify(mcpConfig.claudeDesktop, null, 2);
            }
            return JSON.stringify({
                mcpServers: {
                    akasha: {
                        command: "node",
                        args: ["server/dist/mcp/akashaMcpServer.js"]
                    }
                }
            }, null, 2);
        }

        return '';
    };

    const handleCopy = () => {
        const text = getMcpSnippet(mcpTab);
        navigator.clipboard.writeText(text);
        setCopiedSnippet(true);
        if (onCopySuccess) {
            onCopySuccess('MCP configuration copied to clipboard!');
        }
        setTimeout(() => setCopiedSnippet(false), 2000);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
            <div className="bg-[#0d121f] border border-cyan-500/40 w-full max-w-2xl rounded-2xl p-6 shadow-[0_0_60px_rgba(6,182,212,0.2)] space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-300">
                            <Radio className="w-5 h-5 animate-pulse" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-100">Connect External AI Agent via MCP</h3>
                            <p className="text-xs text-slate-400">Model Context Protocol integration with Akasha</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
                        title="Close modal"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Status bar */}
                <div className="flex items-center justify-between px-3 py-2 bg-emerald-500/10 border border-emerald-500/25 rounded-xl text-xs">
                    <span className="flex items-center gap-2 text-emerald-300 font-semibold">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                        Akasha MCP Server is Active on stdio & HTTP (/api/mcp)
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">Protocol: 2024-11-05</span>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 border-b border-white/10 pb-2">
                    <button
                        onClick={() => setMcpTab('antigravity')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            mcpTab === 'antigravity'
                                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                                : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        Antigravity / VS Code
                    </button>
                    <button
                        onClick={() => setMcpTab('claude')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            mcpTab === 'claude'
                                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                                : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        Claude Desktop / Cursor
                    </button>
                    <button
                        onClick={() => setMcpTab('http')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            mcpTab === 'http'
                                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                                : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        HTTP Endpoint
                    </button>
                </div>

                {/* Snippet Display */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">
                            {mcpTab === 'antigravity' && 'Paste into your workspace mcp_config.json:'}
                            {mcpTab === 'claude' && 'Add to your claude_desktop_config.json:'}
                            {mcpTab === 'http' && 'Use direct JSON-RPC HTTP transport for remote agents:'}
                        </span>
                        <button
                            onClick={handleCopy}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-cyan-300 text-xs font-semibold cursor-pointer"
                        >
                            {copiedSnippet ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            {copiedSnippet ? 'Copied!' : 'Copy Config'}
                        </button>
                    </div>

                    <pre className="p-4 rounded-xl bg-black/80 border border-white/10 text-emerald-400 font-mono text-xs overflow-x-auto leading-relaxed select-all custom-scrollbar">
                        {getMcpSnippet(mcpTab)}
                    </pre>
                </div>

                <div className="text-xs text-slate-400 space-y-1 bg-white/5 p-3.5 rounded-xl border border-white/5">
                    <p className="font-semibold text-slate-200">How it works:</p>
                    <p>1. When connected, any AI agent (Antigravity, Claude, Cursor) calls <code className="text-cyan-300 font-mono">akasha_get_structured_blueprint</code> to understand your app with 92% token savings.</p>
                    <p>2. The agent executes tasks and reports live thoughts & tool calls back to this screen via <code className="text-cyan-300 font-mono">akasha_stream_agent_telemetry</code>.</p>
                </div>
            </div>
        </div>
    );
};
