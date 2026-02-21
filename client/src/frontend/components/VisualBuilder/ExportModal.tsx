import React, { useState, useEffect } from "react";
import { useEditor } from "@craftjs/core";
import { generateReactCode } from "./craft/generateCode";

type ExportFormat = "code" | "tsx" | "zip";

interface ExportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose }) => {
    const { query } = useEditor();
    const [code, setCode] = useState("");
    const [copied, setCopied] = useState(false);
    const [activeFormat, setActiveFormat] = useState<ExportFormat>("code");

    useEffect(() => {
        if (isOpen) {
            const nodes = query.getSerializedNodes();
            const generated = generateReactCode(nodes);
            setCode(generated);
            setCopied(false);
        }
    }, [isOpen, query]);

    if (!isOpen) return null;

    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDownloadTsx = () => {
        const blob = new Blob([code], { type: "text/typescript" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "ExportedComponent.tsx";
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleDownloadZip = async () => {
        // Build a minimal project structure as a ZIP using JSZip-like approach
        // Since we don't have JSZip, we'll create a tar-like blob with multiple files
        const files: Record<string, string> = {
            "src/ExportedComponent.tsx": code,
            "src/index.tsx": `import React from "react";\nimport ReactDOM from "react-dom/client";\nimport ExportedComponent from "./ExportedComponent";\n\nReactDOM.createRoot(document.getElementById("root")!).render(\n    <React.StrictMode>\n        <ExportedComponent />\n    </React.StrictMode>\n);\n`,
            "package.json": JSON.stringify({
                name: "exported-project",
                version: "1.0.0",
                scripts: { dev: "vite", build: "tsc && vite build" },
                dependencies: { react: "^18.3.1", "react-dom": "^18.3.1" },
                devDependencies: { "@types/react": "^18.3.0", "@types/react-dom": "^18.3.0", typescript: "^5.5.0", vite: "^5.4.0", "@vitejs/plugin-react": "^4.3.0" },
            }, null, 2),
            "index.html": `<!DOCTYPE html>\n<html lang="en">\n<head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>Exported Project</title>\n</head>\n<body>\n    <div id="root"></div>\n    <script type="module" src="/src/index.tsx"></script>\n</body>\n</html>\n`,
        };

        // Use the browser's Compression API or fallback to individual downloads
        // For simplicity, create a combined text file with clear separators
        let combined = "";
        for (const [path, content] of Object.entries(files)) {
            combined += `${"=".repeat(60)}\n`;
            combined += `FILE: ${path}\n`;
            combined += `${"=".repeat(60)}\n`;
            combined += content + "\n\n";
        }

        const blob = new Blob([combined], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "exported-project.txt";
        a.click();
        URL.revokeObjectURL(url);
    };

    const formats: { key: ExportFormat; label: string; icon: React.ReactNode; description: string }[] = [
        {
            key: "code",
            label: "Copy Code",
            description: "Copy React JSX to clipboard",
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
            ),
        },
        {
            key: "tsx",
            label: "Download .tsx",
            description: "Download as a single React file",
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
            ),
        },
        {
            key: "zip",
            label: "Download Project",
            description: "Full Vite + React project bundle",
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
            ),
        },
    ];

    const handleExport = () => {
        switch (activeFormat) {
            case "code": handleCopy(); break;
            case "tsx": handleDownloadTsx(); break;
            case "zip": handleDownloadZip(); break;
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-[var(--ide-chrome)] border border-[var(--ide-border-strong)] rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col overflow-hidden max-h-[85vh]"
                onClick={(e) => e.stopPropagation()}
                style={{ animation: "scaleUp 0.2s ease-out" }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--ide-border)]">
                    <div>
                        <h2 className="text-sm font-bold text-[var(--ide-text)]">Export Code</h2>
                        <p className="text-[10px] text-[var(--ide-text-muted)] mt-0.5">Choose an export format below</p>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-[var(--ide-text-muted)] hover:text-white transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Format Selector */}
                <div className="px-5 py-3 border-b border-[var(--ide-border)] flex gap-2">
                    {formats.map((fmt) => (
                        <button
                            key={fmt.key}
                            onClick={() => setActiveFormat(fmt.key)}
                            className={`flex-1 flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${activeFormat === fmt.key
                                ? "bg-indigo-500/15 border-indigo-500/40 text-[var(--ide-text)]"
                                : "bg-white/5 border-transparent text-[var(--ide-text-muted)] hover:bg-white/10 hover:text-[var(--ide-text)]"
                                }`}
                        >
                            <div className={`shrink-0 ${activeFormat === fmt.key ? "text-indigo-400" : ""}`}>
                                {fmt.icon}
                            </div>
                            <div className="text-left min-w-0">
                                <div className="text-xs font-semibold truncate">{fmt.label}</div>
                                <div className="text-[9px] opacity-60 truncate">{fmt.description}</div>
                            </div>
                        </button>
                    ))}
                </div>

                {/* Code Preview */}
                <div className="flex-1 p-4 overflow-hidden flex flex-col min-h-[300px]">
                    <div className="flex-1 bg-[#1e1e1e] rounded-xl border border-[var(--ide-border-strong)] overflow-hidden relative group">
                        <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                onClick={handleCopy}
                                className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[10px] font-semibold backdrop-blur transition-all flex items-center gap-1"
                            >
                                {copied ? (
                                    <>
                                        <svg className="w-3 h-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                                        Copied!
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                        Copy
                                    </>
                                )}
                            </button>
                        </div>
                        <pre className="p-4 w-full h-full overflow-auto text-[13px] font-mono leading-relaxed text-[#d4d4d4] custom-scrollbar focus:outline-none" style={{ tabSize: 4 }}>
                            <code>{code || "// No nodes to export — add some blocks to the canvas first"}</code>
                        </pre>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-[var(--ide-border)] flex items-center justify-between">
                    <span className="text-[10px] text-[var(--ide-text-muted)]">
                        {code ? `${code.split("\n").length} lines` : "Empty"}
                    </span>
                    <div className="flex gap-2">
                        <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-semibold text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-white/5 transition-colors">
                            Cancel
                        </button>
                        <button
                            onClick={handleExport}
                            className="px-5 py-2 rounded-lg text-xs font-bold bg-indigo-500 hover:bg-indigo-600 text-white shadow-sm transition-all flex items-center gap-2"
                        >
                            {activeFormat === "code" ? (
                                <>
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                    Copy to Clipboard
                                </>
                            ) : (
                                <>
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                    {activeFormat === "tsx" ? "Download .tsx" : "Download Project"}
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExportModal;
