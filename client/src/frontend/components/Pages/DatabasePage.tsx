/**
 * Database Page
 *
 * Full-page view for database schema management:
 * - Center: ERDCanvas (entity relationship diagram)
 * - Variables panel accessible via tab
 */

import React, { useState } from "react";
import ERDCanvas from "../Canvas/DataCanvas/ERDCanvas";
import VariablesPanel from "../Editors/VariablesPanel";

type DatabaseTab = "schema" | "variables";

const DatabasePage: React.FC = () => {
    const [tab, setTab] = useState<DatabaseTab>("schema");

    return (
        <div className="flex flex-col flex-1 overflow-hidden h-full">
            {/* Tab Bar */}
            <div className="h-9 bg-[var(--ide-chrome)] border-b border-[var(--ide-border)] flex items-center px-2 gap-1 flex-shrink-0">
                <TabButton label="Schema" active={tab === "schema"} onClick={() => setTab("schema")} />
                <TabButton label="Variables" active={tab === "variables"} onClick={() => setTab("variables")} />
            </div>

            {/* Content */}
            <main className="flex-1 overflow-hidden">
                {tab === "schema" && <ERDCanvas />}
                {tab === "variables" && <VariablesPanel />}
            </main>
        </div>
    );
};

/* Internal tab button */
const TabButton: React.FC<{ label: string; active: boolean; onClick: () => void }> = ({ label, active, onClick }) => (
    <button
        onClick={onClick}
        className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${active
                ? "bg-[var(--ide-bg)] text-[var(--ide-text)] border border-[var(--ide-border)]"
                : "text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-bg-hover)]"
            }`}
    >
        {label}
    </button>
);

export default DatabasePage;
