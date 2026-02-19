/**
 * Source Control Page
 *
 * Full-page view for Git operations:
 * - Renders SourceControlPanel as the main content
 */

import React from "react";
import SourceControlPanel from "../SourceControl/SourceControlPanel";

const SourceControlPage: React.FC = () => {
    return (
        <div className="flex flex-1 overflow-hidden h-full">
            <main className="flex-1 overflow-auto bg-[var(--ide-bg)]">
                <SourceControlPanel />
            </main>
        </div>
    );
};

export default SourceControlPage;
