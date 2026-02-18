/**
 * ProjectDashboard — In-project landing page
 *
 * Shows project overview and feature navigation as cards.
 * Replaces the old "home" button that used to close the project.
 */

import React from "react";
import { useProjectStore } from "../../hooks/useProjectStore";
import { setActivePage, closeProject } from "../../stores/projectStore";
import type { FeaturePage } from "../../stores/projectStore";

/* ─── Feature Card Definitions ─── */
interface FeatureCard {
    id: FeaturePage;
    label: string;
    description: string;
    icon: string;
    color: string;
}

const FEATURES: FeatureCard[] = [
    {
        id: "ui",
        label: "UI Design",
        description: "Visual drag-and-drop interface builder with live preview",
        icon: "M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z",
        color: "from-indigo-500/20 to-purple-500/20 border-indigo-500/30 hover:border-indigo-400/60",
    },
    {
        id: "usecases",
        label: "Use Cases",
        description: "Logic flows and business process workflows",
        icon: "M13 10V3L4 14h7v7l9-11h-7z",
        color: "from-amber-500/20 to-orange-500/20 border-amber-500/30 hover:border-amber-400/60",
    },
    {
        id: "apis",
        label: "APIs",
        description: "RESTful endpoints, request/response schemas",
        icon: "M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9",
        color: "from-green-500/20 to-emerald-500/20 border-green-500/30 hover:border-green-400/60",
    },
    {
        id: "database",
        label: "Database",
        description: "Entity-Relationship diagrams and data models",
        icon: "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4",
        color: "from-cyan-500/20 to-blue-500/20 border-cyan-500/30 hover:border-cyan-400/60",
    },
    {
        id: "diagrams",
        label: "Diagrams",
        description: "Architecture diagrams and system design",
        icon: "M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2",
        color: "from-pink-500/20 to-rose-500/20 border-pink-500/30 hover:border-pink-400/60",
    },
    {
        id: "code",
        label: "Source Code",
        description: "File explorer, code editor, and diff viewer",
        icon: "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4",
        color: "from-violet-500/20 to-fuchsia-500/20 border-violet-500/30 hover:border-violet-400/60",
    },
    {
        id: "git",
        label: "Source Control",
        description: "Git commits, diffs, and version history",
        icon: "M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z",
        color: "from-teal-500/20 to-emerald-500/20 border-teal-500/30 hover:border-teal-400/60",
    },
];

const ProjectDashboard: React.FC = () => {
    const { project } = useProjectStore();

    return (
        <div className="h-full w-full overflow-auto bg-[var(--ide-bg)]">
            <div className="max-w-5xl mx-auto px-8 py-10">

                {/* Header */}
                <div className="flex items-center justify-between mb-10">
                    <div>
                        <h1 className="text-3xl font-extrabold text-[var(--ide-text)] tracking-tight">
                            {project?.name || "Project"}
                        </h1>
                        <p className="text-sm text-[var(--ide-text-muted)] mt-1">
                            Project Dashboard — Select a feature to get started
                        </p>
                    </div>
                    <button
                        onClick={closeProject}
                        className="px-4 py-2 text-xs font-medium rounded-lg bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:border-[var(--ide-border-strong)] transition-colors"
                    >
                        ← Back to Projects
                    </button>
                </div>

                {/* Feature Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {FEATURES.map((feature) => (
                        <button
                            key={feature.id}
                            onClick={() => setActivePage(feature.id)}
                            className={`group text-left p-5 rounded-xl border bg-gradient-to-br ${feature.color} transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-black/20`}
                        >
                            {/* Icon */}
                            <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center mb-4 group-hover:bg-white/10 transition-colors">
                                <svg className="w-5 h-5 text-[var(--ide-text)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d={feature.icon} />
                                </svg>
                            </div>

                            {/* Label */}
                            <h3 className="text-sm font-bold text-[var(--ide-text)] mb-1">
                                {feature.label}
                            </h3>

                            {/* Description */}
                            <p className="text-xs text-[var(--ide-text-muted)] leading-relaxed">
                                {feature.description}
                            </p>
                        </button>
                    ))}
                </div>

                {/* Quick Stats */}
                {project && (
                    <div className="mt-8 grid grid-cols-4 gap-4">
                        <StatCard label="Pages" value={project.pages?.filter(p => !p.archived).length ?? 0} />
                        <StatCard label="APIs" value={project.apis?.filter(a => !a.archived).length ?? 0} />
                        <StatCard label="Logic Flows" value={project.logic_flows?.filter(f => !f.archived).length ?? 0} />
                        <StatCard label="Models" value={project.data_models?.filter(m => !m.archived).length ?? 0} />
                    </div>
                )}
            </div>
        </div>
    );
};

/* ─── Stats Card ─── */
const StatCard: React.FC<{ label: string; value: number }> = ({ label, value }) => (
    <div className="bg-[var(--ide-bg-elevated)] rounded-lg border border-[var(--ide-border)] p-4 text-center">
        <div className="text-2xl font-bold text-[var(--ide-text)]">{value}</div>
        <div className="text-[10px] uppercase tracking-wider text-[var(--ide-text-muted)] mt-1">{label}</div>
    </div>
);

export default ProjectDashboard;
