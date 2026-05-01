/**
 * Database Page
 *
 * Styled shell for database workflow:
 * - ERD schema design
 * - API JSON schema builder
 */

import React, { useMemo, useState } from "react";
import ERDCanvas from "../components/features/DataCanvas/ERDCanvas";
import JsonSchemaBuilder from "../components/features/DataCanvas/JsonSchemaBuilder";
import { useProjectStore } from "../hooks/useProjectStore";

type DatabaseTab = "schema" | "apiSchema";

const DatabasePage: React.FC = () => {
    const { project } = useProjectStore();
    const [tab, setTab] = useState<DatabaseTab>("schema");

    const stats = useMemo(() => {
        const models = (project?.data_models || []).filter((m) => !m.archived).length;
        const apis = (project?.apis || []).filter((a) => !a.archived).length;
        const relations = (project?.data_models || [])
            .filter((m) => !m.archived)
            .reduce((sum, model) => sum + (model.relations?.length || 0), 0);
        const endpointsWithShapes = (project?.apis || [])
            .filter((a) => !a.archived)
            .filter((a) => a.request_body || a.response_body).length;

        return { models, apis, relations, endpointsWithShapes };
    }, [project]);

    return (
        <div
            className="flex flex-col flex-1 min-h-0 overflow-hidden h-full w-full page-enter"
            style={{
                background: "linear-gradient(135deg, #06120f 0%, #0b1f1a 48%, #06120f 100%)",
                color: "#e8f7f0",
                fontFamily: "'Outfit', 'Space Mono', sans-serif",
            }}
        >
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    pointerEvents: "none",
                    backgroundImage:
                        "linear-gradient(rgba(40,216,156,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(40,216,156,0.03) 1px, transparent 1px)",
                    backgroundSize: "44px 44px",
                }}
            />

            <div className="relative flex flex-col min-h-0 flex-1 px-8 py-6 gap-6">
                <header className="flex items-start justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div
                                style={{
                                    width: 6,
                                    height: 24,
                                    borderRadius: 4,
                                    background: "linear-gradient(180deg, #28d89c, rgba(40,216,156,0.2))",
                                }}
                            />
                            <h1 className="m-0 text-[26px] font-bold tracking-[-0.02em] text-[#e8f7f0]">Database</h1>
                        </div>
                        <p
                            className="m-0 text-[13px]"
                            style={{
                                paddingLeft: 18,
                                color: "rgba(184,228,209,0.62)",
                                fontFamily: "'Space Mono', monospace",
                            }}
                        >
                            {stats.models} models · {stats.relations} relations · {stats.endpointsWithShapes} API schemas
                        </p>
                    </div>
                </header>

                <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <MetricCard label="Models" value={stats.models} color="#28d89c" />
                    <MetricCard label="Relations" value={stats.relations} color="#2dc7b2" />
                    <MetricCard label="API Endpoints" value={stats.apis} color="#67e8a5" />
                    <MetricCard label="Shaped APIs" value={stats.endpointsWithShapes} color="#5dd8ff" />
                </section>

                <section
                    className="flex flex-col min-h-0 flex-1 overflow-hidden relative"
                    style={{
                        background: "rgba(11, 28, 23, 0.72)",
                        border: "1px solid rgba(40,216,156,0.14)",
                        borderRadius: 16,
                        backdropFilter: "blur(10px)",
                        boxShadow: "0 10px 34px rgba(0,0,0,0.35)",
                    }}
                >
                    <div className="flex px-6 pt-4 pb-0 border-b border-[rgba(40,216,156,0.12)] gap-6 z-10">
                        <TabButton label="Schema Studio" active={tab === "schema"} onClick={() => setTab("schema")} />
                        <TabButton label="API Shape Builder" active={tab === "apiSchema"} onClick={() => setTab("apiSchema")} icon />
                    </div>

                    <main className="flex flex-col flex-1 min-h-0 overflow-hidden">
                        {tab === "schema" && <ERDCanvas />}
                        {tab === "apiSchema" && <JsonSchemaBuilder />}
                    </main>
                </section>
            </div>
        </div>
    );
};

const MetricCard: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
    <div
        className="rounded-xl px-5 py-4"
        style={{
            background: "rgba(40,216,156,0.04)",
            border: "1px solid rgba(40,216,156,0.11)",
            borderTop: `2px solid ${color}55`,
        }}
    >
        <div
            className="text-[11px] tracking-[0.08em] mb-1.5"
            style={{
                color: "rgba(184,228,209,0.48)",
                fontFamily: "'Space Mono', monospace",
            }}
        >
            {label.toUpperCase()}
        </div>
        <div className="text-[28px] font-bold tracking-[-0.02em]" style={{ color }}>
            {value}
        </div>
    </div>
);

const TabButton: React.FC<{ label: string; active: boolean; onClick: () => void; icon?: boolean }> = ({ label, active, onClick, icon }) => (
    <button
        onClick={onClick}
        className="px-4 py-3 text-[14px] font-semibold transition-all flex items-center gap-2 border-b-2"
        style={
            active
                ? {
                    color: "#9ff2cf",
                    borderBottomColor: "#28d89c",
                }
                : {
                    color: "rgba(184,228,209,0.5)",
                    borderBottomColor: "transparent",
                }
        }
    >
        {icon && (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
        )}
        {label}
    </button>
);

export default DatabasePage;
