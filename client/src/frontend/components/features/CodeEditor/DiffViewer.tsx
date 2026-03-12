import React, { useEffect, useState } from "react";
import { DiffEditor } from "@monaco-editor/react";
import { useProjectStore } from "../../../hooks/useProjectStore";
import { closeDiffView } from "../../../stores/projectStore";
import useApi from "../../../hooks/useApi";

function getLanguage(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
        case 'ts': case 'tsx': return 'typescript';
        case 'js': case 'jsx': return 'javascript';
        case 'rs': return 'rust';
        case 'css': return 'css';
        case 'html': return 'html';
        case 'json': return 'json';
        case 'md': return 'markdown';
        case 'yml': case 'yaml': return 'yaml';
        case 'toml': return 'toml';
        default: return 'plaintext';
    }
}

const DiffViewer: React.FC = () => {
    const { diffView, project } = useProjectStore();
    const api = useApi();

    const [original, setOriginal] = useState<string>("");
    const [modified, setModified] = useState<string>("");
    const [loading, setLoading] = useState(false);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!diffView) return;

        const loadContent = async () => {
            setLoading(true);
            setError(null);
            setOriginal("");
            setModified("");

            try {
                if (diffView.commitId) {
                    // History mode: Compare commit^ vs commit
                    const [orig, mod] = await Promise.all([
                        api.gitGetFileContent(diffView.filename, `${diffView.commitId}^`).catch(() => ""),
                        api.gitGetFileContent(diffView.filename, diffView.commitId).catch(() => "")
                    ]);
                    setOriginal(orig);
                    setModified(mod);
                } else {
                    // Changes mode: Compare HEAD vs Working Directory
                    const orig = await api.gitGetFileContent(diffView.filename, "HEAD").catch(() => "");

                    // For working directory, we need absolute path
                    if (!project?.root_path) throw new Error("No project root");

                    const separator = project.root_path.includes("\\") ? "\\" : "/";
                    const cleanRoot = project.root_path.endsWith(separator)
                        ? project.root_path
                        : project.root_path + separator;

                    const normalizedFilename = separator === "\\"
                        ? diffView.filename.replace(/\//g, "\\")
                        : diffView.filename;

                    const absPath = cleanRoot + normalizedFilename;

                    const mod = await api.readFileContent(absPath)
                        .then(res => res.content)
                        .catch(() => "");

                    setOriginal(orig);
                    setModified(mod);
                }
            } catch (err) {
                console.error("Failed to load diff content:", err);
                setError(String(err));
            } finally {
                setLoading(false);
            }
        };

        loadContent();
    }, [diffView, api, project]);

    if (!diffView) return null;

    const basename = diffView.filename.split("/").pop() || diffView.filename;
    const language = getLanguage(diffView.filename);

    return (
        <div className="h-full flex flex-col bg-[var(--ide-bg)]">
            {/* Header */}
            <div className="h-9 bg-[var(--ide-chrome)] border-b border-[var(--ide-border)] px-3 flex items-center justify-between shrink-0 select-none">
                <div className="flex items-center gap-2 min-w-0">
                    <button
                        onClick={closeDiffView}
                        className="w-5 h-5 rounded hover:bg-[var(--ide-text)]/10 flex items-center justify-center text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-colors flex-shrink-0"
                        title="Close diff view"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                    <span className="text-xs text-[var(--ide-text)] font-medium truncate">{basename}</span>
                    {diffView.commitId && (
                        <span className="text-[10px] text-[var(--ide-text-muted)] ml-2 flex-shrink-0">
                            <span className="font-mono text-[var(--ide-primary)]">{diffView.commitId.slice(0, 7)}</span>
                        </span>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 relative">
                {loading && (
                    <div className="absolute inset-0 z-10 bg-[var(--ide-bg)]/50 flex items-center justify-center">
                        <div className="w-5 h-5 border-2 border-[var(--ide-primary)]/30 border-t-[var(--ide-primary)] rounded-full animate-spin" />
                    </div>
                )}
                {error && (
                    <div className="absolute inset-0 z-20 bg-[var(--ide-bg)] flex items-center justify-center p-4">
                        <div className="text-red-400 text-xs text-center border border-red-500/20 bg-red-500/10 p-4 rounded">
                            <p className="font-bold mb-1">Failed to load diff</p>
                            <p>{error}</p>
                        </div>
                    </div>
                )}
                <DiffEditor
                    original={original}
                    modified={modified}
                    language={language}
                    theme="vs-dark"
                    options={{
                        readOnly: true,
                        minimap: { enabled: false },
                        renderSideBySide: true,
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        originalEditable: false,
                    }}
                />
            </div>
        </div>
    );
};

export default DiffViewer;
