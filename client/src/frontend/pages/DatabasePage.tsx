/**
 * Database Page
 *
 * Liquid Glass styling for database workflow:
 * - ERD schema design
 * - API JSON schema builder
 * Pure typography, high-contrast light and dark mode.
 */

import React, { useMemo, useState } from "react";
import ERDCanvas from "../components/features/DataCanvas/ERDCanvas";
import JsonSchemaBuilder from "../components/features/DataCanvas/JsonSchemaBuilder";
import { useProjectStore } from "../hooks/useProjectStore";
import { refreshCurrentProject } from "../stores/projectStore";
import { useBackgroundLoading } from "../context/BackgroundLoadingContext";
import { useToast } from "../context/ToastContext";
import { client } from "../hooks/useHttpApi";

type DatabaseTab = "schema" | "apiSchema";

const DatabasePage: React.FC = () => {
    const { project } = useProjectStore();
    const [tab, setTab] = useState<DatabaseTab>("schema");
    const [isSynthesizing, setIsSynthesizing] = useState(false);
    const toast = useToast();
    const { startTask, completeTask, failTask } = useBackgroundLoading();

    const handleSynthesizeModels = async () => {
        if (!project?.id) return;
        setIsSynthesizing(true);
        startTask({
            title: "Agent: Data Models",
            step: "Synthesizing relational models...",
            progress: 50,
        });
        toast.showToast("Synthesizing data models in background...", "info");
        try {
            const res = await client.post("/ai/agent/synthesize-step", {
                projectId: project.id,
                step: "models",
            });
            if (res.data?.success) {
                completeTask({
                    resultSummary: "Models Ready ✓",
                    step: "Created models and relations",
                });
                toast.showToast("Data models synthesized successfully!", "success");
                await refreshCurrentProject();
            } else {
                failTask({ error: res.data?.error || "Failed to synthesize models" });
                toast.showToast(`Error: ${res.data?.error}`, "error");
            }
        } catch (err: any) {
            failTask({ error: err.message });
            toast.showToast(`Failed: ${err.message}`, "error");
        } finally {
            setIsSynthesizing(false);
        }
    };

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
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden h-full w-full page-enter bg-transparent text-[var(--ide-text)] relative">
            <div
                className="absolute inset-0 pointer-events-none opacity-40 dark:opacity-20"
                style={{
                    backgroundImage:
                        "linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)",
                    backgroundSize: "44px 44px",
                    color: "rgba(100, 116, 139, 0.1)",
                }}
            />

            <div className="relative flex flex-col min-h-0 flex-1 px-6 py-6 gap-6">
                <header className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-white/80 dark:bg-white/[0.05] border border-black/[0.08] dark:border-white/10 backdrop-blur-xl flex items-center justify-center shadow-sm">
                            <span className="text-neutral-600 dark:text-white/60 text-[10px] font-black tracking-widest">DATA</span>
                        </div>
                        <div>
                            <h1 className="m-0 text-2xl font-black tracking-tight text-neutral-950 dark:text-white">Database</h1>
                            <p className="m-0 mt-0.5 text-xs uppercase tracking-[0.2em] font-semibold text-neutral-500 dark:text-neutral-400">
                                {stats.models} models · {stats.relations} relations · {stats.endpointsWithShapes} API schemas
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleSynthesizeModels}
                            disabled={isSynthesizing}
                            className="px-4 py-2 rounded-xl text-xs font-bold tracking-tight bg-blue-600 hover:bg-blue-500 text-white shadow-sm flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                        >
                            <span>{isSynthesizing ? "Synthesizing…" : "AI Synthesize Models"}</span>
                        </button>
                    </div>
                </header>

                <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <MetricCard label="Models" value={stats.models} />
                    <MetricCard label="Relations" value={stats.relations} />
                    <MetricCard label="API Endpoints" value={stats.apis} />
                    <MetricCard label="Shaped APIs" value={stats.endpointsWithShapes} />
                </section>

                <section className="flex flex-col min-h-0 flex-1 overflow-hidden relative rounded-3xl bg-white/70 dark:bg-neutral-950/40 border border-black/[0.08] dark:border-white/10 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
                    <div className="flex px-6 pt-3 pb-0 border-b border-black/[0.06] dark:border-white/[0.08] gap-4 z-10 bg-white/40 dark:bg-transparent">
                        <TabButton label="Schema Studio" active={tab === "schema"} onClick={() => setTab("schema")} />
                        <TabButton label="API Shape Builder" active={tab === "apiSchema"} onClick={() => setTab("apiSchema")} />
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

const MetricCard: React.FC<{ label: string; value: number }> = ({ label, value }) => (
    <div className="rounded-2xl px-5 py-4 bg-white/75 dark:bg-white/[0.03] border border-black/[0.08] dark:border-white/10 backdrop-blur-xl shadow-sm transition-all hover:border-black/[0.15] dark:hover:border-white/20">
        <div className="text-[11px] font-bold tracking-[0.08em] mb-1.5 text-neutral-500 dark:text-neutral-400">
            {label.toUpperCase()}
        </div>
        <div className="text-[28px] font-extrabold tracking-[-0.02em] text-neutral-950 dark:text-white">
            {value}
        </div>
    </div>
);

const TabButton: React.FC<{ label: string; active: boolean; onClick: () => void }> = ({ label, active, onClick }) => (
    <button
        onClick={onClick}
        className={`px-4 py-3 text-[13px] font-bold tracking-wider uppercase transition-all flex items-center gap-2 border-b-2 ${
            active
                ? "text-neutral-950 dark:text-white border-neutral-950 dark:border-white"
                : "text-neutral-400 dark:text-neutral-500 border-transparent hover:text-neutral-700 dark:hover:text-neutral-300"
        }`}
    >
        {label}
    </button>
);

export default DatabasePage;
