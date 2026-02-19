/**
 * Akasha Analysis Panel
 *
 * Displays the structured product graph analysis results:
 * - Stats overview (nodes, edges, issues)
 * - Node list with inferred types
 * - Edge list with relationship types
 * - Validation issues with severity badges
 */

import React, { useState } from "react";
import type { AnalysisResult, ProductNode, ValidationIssue, Severity, NodeType } from "../../hooks/useTauri";

interface AnalysisPanelProps {
    result: AnalysisResult | null;
    loading: boolean;
    error: string | null;
    onAnalyze: () => void;
}

const NODE_TYPE_COLORS: Record<NodeType, string> = {
    actor: "#60a5fa",
    feature: "#a78bfa",
    screen: "#34d399",
    api: "#fbbf24",
    database: "#f87171",
    external_service: "#fb923c",
    decision: "#e879f9",
    process: "#94a3b8",
    unknown: "#6b7280",
};

const NODE_TYPE_ICONS: Record<NodeType, string> = {
    actor: "👤",
    feature: "⚡",
    screen: "🖥️",
    api: "🔌",
    database: "🗄️",
    external_service: "☁️",
    decision: "◆",
    process: "⚙️",
    unknown: "❓",
};

const SEVERITY_STYLES: Record<Severity, { bg: string; text: string; border: string; icon: string }> = {
    error: { bg: "rgba(239,68,68,0.12)", text: "#ef4444", border: "#ef4444", icon: "✕" },
    warning: { bg: "rgba(245,158,11,0.12)", text: "#f59e0b", border: "#f59e0b", icon: "⚠" },
    info: { bg: "rgba(59,130,246,0.12)", text: "#3b82f6", border: "#3b82f6", icon: "ℹ" },
};

const AnalysisPanel: React.FC<AnalysisPanelProps> = ({
    result,
    loading,
    error,
    onAnalyze,
}) => {
    const [activeTab, setActiveTab] = useState<"overview" | "nodes" | "edges" | "issues">("overview");

    return (
        <div
            style={{
                width: 340,
                display: "flex",
                flexDirection: "column",
                background: "var(--ide-sidebar-bg)",
                borderLeft: "1px solid var(--ide-border)",
                overflow: "hidden",
            }}
        >
            {/* Header */}
            <div
                style={{
                    height: 36,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0 12px",
                    background: "var(--ide-chrome)",
                    borderBottom: "1px solid var(--ide-border)",
                }}
            >
                <span
                    style={{
                        fontSize: 11,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        color: "var(--ide-text-secondary)",
                    }}
                >
                    🧠 Akasha Analysis
                </span>
                <button
                    onClick={onAnalyze}
                    disabled={loading}
                    style={{
                        padding: "3px 10px",
                        fontSize: 11,
                        fontWeight: 500,
                        borderRadius: 4,
                        border: "none",
                        cursor: loading ? "not-allowed" : "pointer",
                        background: loading
                            ? "var(--ide-hover-bg)"
                            : "var(--ide-primary, #3b82f6)",
                        color: loading ? "var(--ide-text-secondary)" : "#fff",
                        transition: "all 0.15s",
                    }}
                >
                    {loading ? "Analyzing…" : "Analyze"}
                </button>
            </div>

            {/* Error */}
            {error && (
                <div
                    style={{
                        margin: 8,
                        padding: "8px 10px",
                        fontSize: 12,
                        borderRadius: 4,
                        background: "rgba(239,68,68,0.1)",
                        color: "#ef4444",
                        border: "1px solid rgba(239,68,68,0.2)",
                    }}
                >
                    {error}
                </div>
            )}

            {/* Empty state */}
            {!result && !loading && !error && (
                <div
                    style={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--ide-text-secondary)",
                        fontSize: 12,
                        padding: 24,
                        textAlign: "center",
                        gap: 8,
                    }}
                >
                    <span style={{ fontSize: 32, opacity: 0.4 }}>🧠</span>
                    <p>Click <b>Analyze</b> to extract the product graph from this diagram.</p>
                </div>
            )}

            {/* Results */}
            {result && (
                <>
                    {/* Tab bar */}
                    <div
                        style={{
                            display: "flex",
                            borderBottom: "1px solid var(--ide-border)",
                        }}
                    >
                        {(["overview", "nodes", "edges", "issues"] as const).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                style={{
                                    flex: 1,
                                    padding: "6px 0",
                                    fontSize: 11,
                                    fontWeight: activeTab === tab ? 600 : 400,
                                    textTransform: "capitalize",
                                    border: "none",
                                    borderBottom:
                                        activeTab === tab
                                            ? "2px solid var(--ide-primary, #3b82f6)"
                                            : "2px solid transparent",
                                    background: "none",
                                    color:
                                        activeTab === tab
                                            ? "var(--ide-active-text)"
                                            : "var(--ide-text-secondary)",
                                    cursor: "pointer",
                                    transition: "all 0.15s",
                                }}
                            >
                                {tab}
                                {tab === "issues" && result.issues.length > 0 && (
                                    <span
                                        style={{
                                            marginLeft: 4,
                                            padding: "1px 5px",
                                            fontSize: 9,
                                            borderRadius: 8,
                                            background: result.issues.some(
                                                (i) => i.severity === "error"
                                            )
                                                ? "#ef4444"
                                                : "#f59e0b",
                                            color: "#fff",
                                        }}
                                    >
                                        {result.issues.length}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Tab content */}
                    <div style={{ flex: 1, overflowY: "auto", padding: 10 }}>
                        {activeTab === "overview" && <OverviewTab result={result} />}
                        {activeTab === "nodes" && <NodesTab nodes={result.graph.nodes} />}
                        {activeTab === "edges" && <EdgesTab result={result} />}
                        {activeTab === "issues" && <IssuesTab issues={result.issues} />}
                    </div>
                </>
            )}
        </div>
    );
};

// ─── Overview tab ────────────────────────────────────────────────────────────

const OverviewTab: React.FC<{ result: AnalysisResult }> = ({ result }) => {
    const { stats, graph } = result;

    // Count nodes by type
    const typeCounts: Record<string, number> = {};
    graph.nodes.forEach((n) => {
        typeCounts[n.node_type] = (typeCounts[n.node_type] || 0) + 1;
    });

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Stats cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                <StatCard label="Nodes" value={stats.total_nodes} color="#3b82f6" />
                <StatCard label="Edges" value={stats.total_edges} color="#8b5cf6" />
                <StatCard label="Issues" value={stats.issue_count} color={stats.issue_count > 0 ? "#f59e0b" : "#22c55e"} />
                <StatCard label="Unknown" value={stats.unknown_type_count} color={stats.unknown_type_count > 0 ? "#ef4444" : "#22c55e"} />
            </div>

            {/* Type breakdown */}
            <div>
                <div
                    style={{
                        fontSize: 10,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        color: "var(--ide-text-secondary)",
                        marginBottom: 6,
                        letterSpacing: "0.05em",
                    }}
                >
                    Node types
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    {Object.entries(typeCounts)
                        .sort(([, a], [, b]) => b - a)
                        .map(([type, count]) => (
                            <div
                                key={type}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    padding: "4px 8px",
                                    borderRadius: 4,
                                    background: "var(--ide-hover-bg)",
                                    fontSize: 12,
                                }}
                            >
                                <span>{NODE_TYPE_ICONS[type as NodeType] || "?"}</span>
                                <span
                                    style={{
                                        flex: 1,
                                        color: "var(--ide-text)",
                                        textTransform: "capitalize",
                                    }}
                                >
                                    {type.replace("_", " ")}
                                </span>
                                <span
                                    style={{
                                        fontWeight: 600,
                                        color: NODE_TYPE_COLORS[type as NodeType] || "#888",
                                    }}
                                >
                                    {count}
                                </span>
                            </div>
                        ))}
                </div>
            </div>
        </div>
    );
};

const StatCard: React.FC<{ label: string; value: number; color: string }> = ({
    label,
    value,
    color,
}) => (
    <div
        style={{
            padding: "10px 12px",
            borderRadius: 6,
            background: "var(--ide-hover-bg)",
            border: "1px solid var(--ide-border)",
        }}
    >
        <div style={{ fontSize: 18, fontWeight: 700, color }}>{value}</div>
        <div
            style={{
                fontSize: 10,
                color: "var(--ide-text-secondary)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
            }}
        >
            {label}
        </div>
    </div>
);

// ─── Nodes tab ──────────────────────────────────────────────────────────────

const NodesTab: React.FC<{ nodes: ProductNode[] }> = ({ nodes }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {nodes.map((node) => (
            <div
                key={node.id}
                style={{
                    padding: "8px 10px",
                    borderRadius: 6,
                    background: "var(--ide-hover-bg)",
                    border: "1px solid var(--ide-border)",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                }}
            >
                <span style={{ fontSize: 14 }}>
                    {NODE_TYPE_ICONS[node.node_type]}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                        style={{
                            fontSize: 12,
                            fontWeight: 500,
                            color: "var(--ide-text)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                        }}
                    >
                        {node.label || <em style={{ opacity: 0.5 }}>Unlabeled</em>}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--ide-text-secondary)" }}>
                        {node.id}
                    </div>
                </div>
                <span
                    style={{
                        fontSize: 10,
                        padding: "2px 6px",
                        borderRadius: 4,
                        fontWeight: 600,
                        textTransform: "capitalize",
                        color: NODE_TYPE_COLORS[node.node_type],
                        background: `${NODE_TYPE_COLORS[node.node_type]}18`,
                    }}
                >
                    {node.node_type.replace("_", " ")}
                </span>
            </div>
        ))}
        {nodes.length === 0 && (
            <div style={{ textAlign: "center", color: "var(--ide-text-secondary)", fontSize: 12, padding: 16 }}>
                No nodes found
            </div>
        )}
    </div>
);

// ─── Edges tab ──────────────────────────────────────────────────────────────

const EdgesTab: React.FC<{ result: AnalysisResult }> = ({ result }) => {
    const nodeMap = new Map(result.graph.nodes.map((n) => [n.id, n]));

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {result.graph.edges.map((edge) => {
                const src = nodeMap.get(edge.source);
                const tgt = nodeMap.get(edge.target);
                return (
                    <div
                        key={edge.id}
                        style={{
                            padding: "8px 10px",
                            borderRadius: 6,
                            background: "var(--ide-hover-bg)",
                            border: "1px solid var(--ide-border)",
                            fontSize: 12,
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                                color: "var(--ide-text)",
                            }}
                        >
                            <span style={{ fontWeight: 500 }}>
                                {src?.label || edge.source}
                            </span>
                            <span style={{ color: "var(--ide-text-secondary)" }}>→</span>
                            <span style={{ fontWeight: 500 }}>
                                {tgt?.label || edge.target}
                            </span>
                        </div>
                        <div
                            style={{
                                fontSize: 10,
                                color: "var(--ide-text-secondary)",
                                marginTop: 2,
                            }}
                        >
                            {edge.relationship_type} {edge.label ? `• "${edge.label}"` : ""}
                        </div>
                    </div>
                );
            })}
            {result.graph.edges.length === 0 && (
                <div style={{ textAlign: "center", color: "var(--ide-text-secondary)", fontSize: 12, padding: 16 }}>
                    No edges found
                </div>
            )}
        </div>
    );
};

// ─── Issues tab ─────────────────────────────────────────────────────────────

const IssuesTab: React.FC<{ issues: ValidationIssue[] }> = ({ issues }) => {
    const sorted = [...issues].sort((a, b) => {
        const order: Record<Severity, number> = { error: 0, warning: 1, info: 2 };
        return order[a.severity] - order[b.severity];
    });

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {sorted.map((issue, i) => {
                const style = SEVERITY_STYLES[issue.severity];
                return (
                    <div
                        key={i}
                        style={{
                            padding: "8px 10px",
                            borderRadius: 6,
                            background: style.bg,
                            borderLeft: `3px solid ${style.border}`,
                            fontSize: 12,
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                marginBottom: 2,
                            }}
                        >
                            <span style={{ fontSize: 11, color: style.text }}>
                                {style.icon}
                            </span>
                            <span
                                style={{
                                    fontSize: 10,
                                    fontWeight: 600,
                                    textTransform: "uppercase",
                                    color: style.text,
                                }}
                            >
                                {issue.severity}
                            </span>
                            <span
                                style={{
                                    fontSize: 9,
                                    color: "var(--ide-text-secondary)",
                                    marginLeft: "auto",
                                }}
                            >
                                {issue.rule}
                            </span>
                        </div>
                        <div style={{ color: "var(--ide-text)", lineHeight: 1.4 }}>
                            {issue.message}
                        </div>
                    </div>
                );
            })}
            {issues.length === 0 && (
                <div
                    style={{
                        textAlign: "center",
                        padding: 24,
                        fontSize: 12,
                    }}
                >
                    <span style={{ fontSize: 24 }}>✅</span>
                    <p style={{ color: "#22c55e", fontWeight: 600, marginTop: 8 }}>
                        No issues found
                    </p>
                    <p style={{ color: "var(--ide-text-secondary)", marginTop: 4 }}>
                        The product graph looks structurally valid.
                    </p>
                </div>
            )}
        </div>
    );
};

export default AnalysisPanel;
