import React, { useState, useEffect } from "react";
import { Radio, X, Copy, Check } from "lucide-react";
import { fetchMcpConfig, type McpServerConfig } from "../../../services/agentSquadService";

interface McpConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCopySuccess?: (msg: string) => void;
}

export const McpConfigModal: React.FC<McpConfigModalProps> = ({
  isOpen,
  onClose,
  onCopySuccess,
}) => {
  const [mcpTab, setMcpTab] = useState<"antigravity" | "claude" | "http">("antigravity");
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [mcpConfig, setMcpConfig] = useState<McpServerConfig | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    fetchMcpConfig()
      .then((data) => setMcpConfig(data))
      .catch(() => null);
  }, [isOpen]);

  if (!isOpen) return null;

  const getMcpSnippet = (tab: "antigravity" | "claude" | "http") => {
    const origin =
      typeof window !== "undefined"
        ? window.location.origin.replace(":5173", ":3001")
        : "http://localhost:3001";

    if (tab === "http") {
      return mcpConfig?.httpEndpoint || `${origin}/api/mcp`;
    }

    if (tab === "antigravity") {
      if (mcpConfig?.antigravity) return JSON.stringify(mcpConfig.antigravity, null, 2);
      return JSON.stringify(
        { mcpServers: { akasha: { command: "node", args: ["server/dist/mcp/akashaMcpServer.js"] } } },
        null,
        2
      );
    }

    if (mcpConfig?.claudeDesktop) return JSON.stringify(mcpConfig.claudeDesktop, null, 2);
    return JSON.stringify(
      { mcpServers: { akasha: { command: "node", args: ["server/dist/mcp/akashaMcpServer.js"] } } },
      null,
      2
    );
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getMcpSnippet(mcpTab));
    setCopiedSnippet(true);
    if (onCopySuccess) onCopySuccess("MCP configuration copied");
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/35 dark:bg-black/65 backdrop-blur-[2px] animate-fade-in">
      <div className="bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] w-full max-w-2xl rounded-2xl p-6 shadow-[var(--ide-shadow-premium)] space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--ide-border)]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
              <Radio className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--ide-text)]">
                Connect an IDE agent via MCP
              </h3>
              <p className="text-xs text-[var(--ide-text-secondary)]">
                Share your live blueprint and stream updates from Antigravity, Cursor, or Claude.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-between px-3.5 py-2.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/25 rounded-xl text-xs">
          <span className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Akasha MCP server ready on stdio and /api/mcp
          </span>
          <span className="text-[11px] text-[var(--ide-text-muted)] font-mono">2024-11-05</span>
        </div>

        <div className="flex gap-1.5 border-b border-[var(--ide-border)] pb-2.5">
          {[
            { id: "antigravity", label: "Antigravity / VS Code" },
            { id: "claude", label: "Claude / Cursor" },
            { id: "http", label: "HTTP endpoint" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMcpTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                mcpTab === tab.id
                  ? "bg-[#1B5BFF] text-white"
                  : "text-[var(--ide-text-secondary)] hover:bg-[var(--ide-accent-subtle)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--ide-text-secondary)]">
              {mcpTab === "antigravity" && "Add to your workspace mcp_config.json:"}
              {mcpTab === "claude" && "Add to your claude_desktop_config.json:"}
              {mcpTab === "http" && "Direct JSON-RPC HTTP endpoint:"}
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="btn-ghost h-7 px-2.5 text-xs"
            >
              {copiedSnippet ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedSnippet ? "Copied" : "Copy"}
            </button>
          </div>

          <pre className="p-4 rounded-xl bg-[#0F172A] text-slate-100 font-mono text-xs overflow-x-auto leading-relaxed select-all">
            {getMcpSnippet(mcpTab)}
          </pre>
        </div>
      </div>
    </div>
  );
};
