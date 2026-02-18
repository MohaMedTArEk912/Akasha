/**
 * Use Cases Page
 *
 * Full-page view for logic flow editing:
 * - Left sidebar: Logic flow list
 * - Center: LogicCanvas (node-based flow editor)
 */

import React from "react";
import LogicCanvas from "../Canvas/LogicCanvas/LogicCanvas";

const UseCasesPage: React.FC = () => {
    return (
        <div className="flex flex-1 overflow-hidden h-full">
            {/* Center: Logic Canvas (has its own built-in sidebar) */}
            <main className="flex-1 overflow-hidden">
                <LogicCanvas />
            </main>
        </div>
    );
};

export default UseCasesPage;
