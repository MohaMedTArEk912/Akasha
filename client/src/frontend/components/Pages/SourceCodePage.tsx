/**
 * Source Code Page
 *
 * Full-page view for code editing:
 * - Left sidebar: File tree explorer
 * - Center: Monaco CodeEditor or DiffViewer
 * - Top: Editor tabs for open files
 */

import React from "react";
import { useProjectStore } from "../../hooks/useProjectStore";
import CodeEditor from "../Canvas/CodeEditor/CodeEditor";
import DiffViewer from "../Canvas/CodeEditor/DiffViewer";
import EditorTabs from "../Layout/EditorTabs";
import FileTree from "../FileTree/FileTree";

const SourceCodePage: React.FC = () => {
    const { diffView } = useProjectStore();

    return (
        <div className="flex flex-1 overflow-hidden h-full">
            {/* Left sidebar: File Tree */}
            <aside className="w-60 bg-[var(--ide-chrome)] border-r border-[var(--ide-border)] flex flex-col flex-shrink-0 overflow-hidden">
                <div className="h-9 px-4 flex items-center border-b border-[var(--ide-border)] flex-shrink-0">
                    <span className="text-[10px] font-black text-[var(--ide-text-secondary)] uppercase tracking-[0.2em]">
                        Explorer
                    </span>
                </div>
                <div className="flex-1 overflow-auto">
                    <FileTree />
                </div>
            </aside>

            {/* Center: Code Editor */}
            <main className="flex-1 flex flex-col overflow-hidden">
                <EditorTabs />
                <div className="flex-1 overflow-hidden">
                    {diffView ? <DiffViewer /> : <CodeEditor />}
                </div>
            </main>
        </div>
    );
};

export default SourceCodePage;
