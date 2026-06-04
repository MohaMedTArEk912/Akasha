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
                background: "var(--ide-bg)",
                color: "var(--ide-text)",
            }}
        >
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    pointerEvents: "none",
                    backgroundImage:
                        "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)",
                    backgroundSize: "44px 44px",
                }}
            />

            <div className="relative flex flex-col min-h-0 flex-1 px-6 py-6 gap-6">
                <header className="flex items-start justify-between gap-4" style={{ animation: "fadeSlideUp 0.5s ease-out both" }}>
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                            <span className="text-white/40 text-[10px] font-black tracking-widest">DATA</span>
                        </div>
                        <div>
                            <h1 className="m-0 text-2xl font-extrabold tracking-tight text-[var(--ide-text)]">Database</h1>
                            <p className="m-0 mt-0.5 text-xs uppercase tracking-[0.2em] text-[var(--ide-text-secondary)]">
                                {stats.models} models · {stats.relations} relations · {stats.endpointsWithShapes} API schemas
                            </p>
                        </div>
                    </div>
                </header>

                <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <MetricCard label="Models" value={stats.models} color="#ffffff" />
                    <MetricCard label="Relations" value={stats.relations} color="#e5e7eb" />
                    <MetricCard label="API Endpoints" value={stats.apis} color="#d1d5db" />
                    <MetricCard label="Shaped APIs" value={stats.endpointsWithShapes} color="#9ca3af" />
                </section>

                <section
                    className="flex flex-col min-h-0 flex-1 overflow-hidden relative"
                    style={{
                        background: "rgba(255,255,255,0.02)",
                        border: "1px solid rgba(255,255,255,0.06)",
                        borderRadius: 24,
                        backdropFilter: "blur(10px)",
                        boxShadow: "var(--ide-shadow)",
                    }}
                >
                    <div className="flex px-6 pt-4 pb-0 border-b border-white/[0.06] gap-6 z-10">
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
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
        }}
    >
        <div
            className="text-[11px] tracking-[0.08em] mb-1.5"
            style={{
            color: "var(--ide-text-secondary)",
            }}
        >
            {label.toUpperCase()}
        </div>
        <div className="text-[28px] font-bold tracking-[-0.02em]" style={{ color }}>
            {value}
        </div>
    </div>
);

const TabButton: React.FC<{ label: string; active: boolean; onClick: () => void; icon?: boolean }> = ({ label, active, onClick, icon: _icon }) => (
    <button
        onClick={onClick}
        className="px-4 py-3 text-[14px] font-semibold transition-all flex items-center gap-2 border-b-2"
        style={
            active
                ? {
                    color: "var(--ide-text)",
                    borderBottomColor: "#ffffff",
                }
                : {
                    color: "var(--ide-text-secondary)",
                    borderBottomColor: "transparent",
                }
        }
    >
        {label}
    </button>
);

export default DatabasePage;
