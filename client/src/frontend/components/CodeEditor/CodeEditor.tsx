import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Editor, { type Monaco } from "@monaco-editor/react";
import type { editor as MonacoEditor } from "monaco-editor";
import { useProjectStore } from "../../hooks/useProjectStore";
import { useEditorSettings } from "../../hooks/useEditorSettings";
import { useTheme } from "../../context/ThemeContext";
import { getPage, getPageContent, getFileContent, saveFileContent, toggleTerminal } from "../../stores/projectStore";
import * as EditorSettingsStore from "../../stores/editorSettingsStore";

class MonacoErrorBoundary extends React.Component<
    { children: React.ReactNode },
    { hasError: boolean; message: string | null }
> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false, message: null };
    }

    static getDerivedStateFromError(error: unknown) {
        return { hasError: true, message: String(error) };
    }

    componentDidCatch(error: unknown) {
        console.error("Monaco editor crashed:", error);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="h-full w-full flex items-center justify-center bg-[var(--ide-bg)] text-[var(--ide-text-muted)] p-8">
                    <div className="max-w-md text-center">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <h3 className="text-[var(--ide-text)] font-semibold mb-2">Editor Failed To Load</h3>
                        <p className="text-sm mb-3">The Monaco editor crashed while opening this file.</p>
                        {this.state.message && (
                            <p className="text-xs opacity-80 break-words bg-[var(--ide-bg-panel)] p-3 rounded border border-[var(--ide-border)]">
                                {this.state.message}
                            </p>
                        )}
                        <button
                            onClick={() => window.location.reload()}
                            className="mt-4 px-4 py-2 text-sm bg-[var(--ide-primary)] hover:bg-[var(--ide-primary-hover)] text-white rounded transition-colors"
                        >
                            Reload Editor
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

function toMonacoModelPath(rawPath: string | null): string {
    if (!rawPath) return "inmemory://model/untitled.tsx";

    const normalized = rawPath.replace(/\\/g, "/");
    const fileName = normalized.split("/").filter(Boolean).pop() || "untitled.tsx";
    const key = encodeURIComponent(normalized);
    const safeName = encodeURIComponent(fileName);

    return `inmemory://model/${key}/${safeName}`;
}

function pascalCase(input: string): string {
    return input
        .split(/[^a-zA-Z0-9]+/)
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join("");
}

function getPageSourcePath(pageName: string): string {
    return `client/src/pages/${pascalCase(pageName)}.tsx`;
}

const EXT_TO_LANGUAGE: Record<string, string> = {
    // Web
    ".html": "html", ".htm": "html",
    ".css": "css", ".scss": "scss", ".less": "less",
    ".js": "javascript", ".jsx": "javascript", ".mjs": "javascript", ".cjs": "javascript",
    ".ts": "typescript", ".tsx": "typescript", ".mts": "typescript", ".cts": "typescript",
    ".json": "json", ".jsonc": "json",
    ".xml": "xml", ".xsl": "xml", ".xsd": "xml", ".svg": "xml",
    ".yaml": "yaml", ".yml": "yaml",
    ".md": "markdown", ".mdx": "markdown",
    ".graphql": "graphql", ".gql": "graphql",
    ".pug": "pug",
    ".hbs": "handlebars", ".handlebars": "handlebars",

    // Systems / compiled
    ".rs": "rust",
    ".go": "go",
    ".c": "cpp", ".h": "cpp", ".cpp": "cpp", ".cxx": "cpp", ".cc": "cpp", ".hpp": "cpp",
    ".cs": "csharp",
    ".java": "java",
    ".kt": "kotlin", ".kts": "kotlin",
    ".swift": "swift",
    ".m": "objective-c", ".mm": "objective-c",
    ".dart": "dart",
    ".scala": "scala",
    ".r": "r", ".R": "r",

    // Scripting
    ".py": "python", ".pyw": "python",
    ".rb": "ruby",
    ".php": "php",
    ".pl": "perl", ".pm": "perl",
    ".lua": "lua",
    ".coffee": "coffeescript",
    ".clj": "clojure", ".cljs": "clojure", ".cljc": "clojure",
    ".fs": "fsharp", ".fsx": "fsharp",
    ".ex": "elixir", ".exs": "elixir",
    ".jl": "julia",
    ".vb": "vb",

    // Shell / config
    ".sh": "shell", ".bash": "shell", ".zsh": "shell",
    ".bat": "bat", ".cmd": "bat",
    ".ps1": "powershell", ".psm1": "powershell",
    ".ini": "ini", ".cfg": "ini", ".conf": "ini", ".properties": "ini",
    ".toml": "ini",
    ".env": "ini",

    // Data / query
    ".sql": "sql",
    ".mysql": "mysql",
    ".pgsql": "pgsql",

    // DevOps / infra
    ".dockerfile": "dockerfile",
    ".tf": "hcl", ".hcl": "hcl",
    ".proto": "protobuf",

    // Misc
    ".pas": "pascal", ".pp": "pascal",
    ".sol": "sol",
    ".asm": "mips", ".s": "mips",
};

function getEditorLanguage(path: string | null): string {
    if (!path) return "typescript";

    // Handle dot-files like "Dockerfile", ".gitignore"
    const filename = path.split(/[/\\]/).pop()?.toLowerCase() ?? "";
    if (filename === "dockerfile" || filename.startsWith("dockerfile.")) return "dockerfile";
    if (filename === "makefile" || filename === "gnumakefile") return "shell";

    // Match by extension (try longest first for compound extensions like .d.ts)
    const lower = path.toLowerCase();
    const dotIdx = lower.lastIndexOf(".");
    if (dotIdx !== -1) {
        const ext = lower.slice(dotIdx);
        const lang = EXT_TO_LANGUAGE[ext];
        if (lang) return lang;
    }

    return "plaintext";
}

const CodeEditor: React.FC = () => {
    const { selectedPageId, selectedFilePath, project, terminalOpen } = useProjectStore();
    const settings = useEditorSettings();
    const { theme: appTheme } = useTheme();
    const [code, setCode] = useState<string>("");
    const [error, setError] = useState<string | null>(null);
    const [isDirty, setIsDirty] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });
    const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
    const decorationsRef = useRef<string[]>([]);
    const readOnlyRangesRef = useRef<{ startLine: number; endLine: number }[]>([]);

    const selectedPage = project && selectedPageId ? getPage(selectedPageId) : null;
    const activePath = useMemo(
        () => selectedFilePath ?? (selectedPage ? getPageSourcePath(selectedPage.name) : null),
        [selectedFilePath, selectedPage]
    );
    const editorLanguage = getEditorLanguage(activePath);
    const editorPath = toMonacoModelPath(activePath);
    const monacoTheme = appTheme === "light" ? "vs-light" : "vs-dark";

    // Calculate effective font size based on zoom level
    const effectiveFontSize = useMemo(() => {
        return Math.round(settings.fontSize * (settings.zoomLevel / 100));
    }, [settings.fontSize, settings.zoomLevel]);

    /**
     * Check whether any line in the given range [startLine, endLine] (1-based) is read-only.
     */
    const isRangeReadOnly = useCallback((startLine: number, endLine: number): boolean => {
        return readOnlyRangesRef.current.some(
            (r) => startLine <= r.endLine && endLine >= r.startLine
        );
    }, []);

    /**
     * Scan code for @akasha-block region markers and apply:
     *  1. Read-only range tracking
     *  2. Dimmed decorations on protected lines
     */
    const applyBlockRegions = useCallback((editor: MonacoEditor.IStandaloneCodeEditor) => {
        const model = editor.getModel();
        if (!model) return;

        const lines = model.getLinesContent();
        const regions: { startLine: number; endLine: number }[] = [];
        const decorations: MonacoEditor.IModelDeltaDecoration[] = [];
        let openLine: number | null = null;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.includes("@akasha-block:start") || line.includes("@akasha-block id=")) {
                openLine = i + 1; // 1-based
            } else if ((line.includes("@akasha-block:end") || line.includes("@akasha-block-end")) && openLine !== null) {
                const endLine = i + 1;
                regions.push({ startLine: openLine, endLine });
                decorations.push({
                    range: {
                        startLineNumber: openLine,
                        startColumn: 1,
                        endLineNumber: endLine,
                        endColumn: model.getLineMaxColumn(endLine),
                    },
                    options: {
                        isWholeLine: true,
                        className: "akasha-readonly-region",
                        glyphMarginClassName: "akasha-readonly-glyph",
                        overviewRuler: {
                            color: "rgba(99, 102, 241, 0.3)",
                            position: 1, // Full
                        },
                        minimap: {
                            color: "rgba(99, 102, 241, 0.15)",
                            position: 1,
                        },
                        hoverMessage: { value: "🔒 **Akasha-managed region** — edit this block visually" },
                    },
                });
                openLine = null;
            }
        }

        readOnlyRangesRef.current = regions;
        decorationsRef.current = editor.deltaDecorations(decorationsRef.current, decorations);
    }, []);

    const handleBeforeMount = (monaco: Monaco) => {
        try {
            monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
                target: monaco.languages.typescript.ScriptTarget.ES2020,
                module: monaco.languages.typescript.ModuleKind.ESNext,
                moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
                jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
                allowNonTsExtensions: true,
                allowSyntheticDefaultImports: true,
                esModuleInterop: true,
            });

            // Disable semantic validation for better performance
            monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
                noSemanticValidation: true,  // Disabled for performance
                noSyntaxValidation: false,
            });
        } catch (err) {
            console.warn("Failed to configure Monaco TypeScript compiler options:", err);
        }
    };

    useEffect(() => {
        const fetchContent = async () => {
            if (selectedFilePath) {
                try {
                    setError(null);
                    setSaveError(null);
                    const content = await getFileContent(selectedFilePath);
                    setCode(content);
                    setIsDirty(false);
                } catch (err) {
                    console.error("Failed to fetch file content:", err);
                    setError("read_error");
                }
                return;
            }

            if (!selectedPage) {
                setCode("");
                setError(null);
                setSaveError(null);
                setIsDirty(false);
                return;
            }

            try {
                setError(null);
                setSaveError(null);
                const content = await getPageContent(selectedPage.id);
                setCode(content);
                setIsDirty(false);
            } catch (err) {
                console.warn("Page content not yet available:", err);
                setCode("");
                setError("not_synced");
            }
        };
        fetchContent();
    }, [selectedPageId, selectedPage, selectedFilePath]);

    useEffect(() => {
        if (!activePath || !isDirty || !!error || !settings.autoSave) return;

        const timer = window.setTimeout(async () => {
            try {
                setIsSaving(true);
                setSaveError(null);
                await saveFileContent(activePath, code);
                setIsDirty(false);
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                setSaveError(msg);
                console.error("Autosave failed:", err);
            } finally {
                setIsSaving(false);
            }
        }, settings.autoSaveDelay);

        return () => window.clearTimeout(timer);
    }, [activePath, code, error, isDirty, settings.autoSave, settings.autoSaveDelay]);

    const handleEditorChange = (value: string | undefined) => {
        if (value === undefined) return;
        setCode(value);
        setIsDirty(true);
        setSaveError(null);
    };

    /**
     * Flash a brief visual notification on the editor when an edit is blocked.
     * Uses a transient CSS class to avoid spamming external toast systems.
     */
    const flashReadOnlyWarning = useCallback(() => {
        const el = editorRef.current?.getDomNode();
        if (!el) return;
        // Prevent rapid re-triggering
        if (el.classList.contains("akasha-readonly-flash")) return;
        el.classList.add("akasha-readonly-flash");
        setTimeout(() => el.classList.remove("akasha-readonly-flash"), 600);
    }, []);

    const handleEditorMount = (editor: MonacoEditor.IStandaloneCodeEditor) => {
        editorRef.current = editor;

        // Track cursor position for status bar
        editor.onDidChangeCursorPosition((e) => {
            setCursorPosition({ line: e.position.lineNumber, column: e.position.column });
        });

        // Apply @akasha-block regions on initial load and content changes
        applyBlockRegions(editor);
        editor.onDidChangeModelContent(() => {
            applyBlockRegions(editor);
        });

        // ─── Enforce read-only regions ─────────────────────────────────
        // Block keyboard input (typing, deletion) when cursor is inside
        // a protected @akasha-block region.
        editor.onKeyDown((e) => {
            const selections = editor.getSelections();
            if (!selections || readOnlyRangesRef.current.length === 0) return;

            // Check if ANY selection/cursor touches a read-only region
            const touchesReadOnly = selections.some((sel) =>
                isRangeReadOnly(
                    Math.min(sel.startLineNumber, sel.endLineNumber),
                    Math.max(sel.startLineNumber, sel.endLineNumber)
                )
            );

            if (!touchesReadOnly) return;

            // Determine if this key press would mutate editor content
            const isModifier = e.ctrlKey || e.metaKey || e.altKey;
            const isPrintable = e.browserEvent.key.length === 1 && !isModifier;
            const isDeletion =
                e.keyCode === 1  /* Backspace */ ||
                e.keyCode === 2  /* Tab (indent) */ ||
                e.keyCode === 46 /* Delete */ ||
                e.browserEvent.key === "Backspace" ||
                e.browserEvent.key === "Delete";
            const isEnter = e.keyCode === 3 || e.browserEvent.key === "Enter";

            // Allow navigation keys (arrows, Home, End, PgUp/Dn, Escape)
            // Allow Ctrl+C (copy), Ctrl+A (select all)
            const isCopy = isModifier && (e.browserEvent.key === "c" || e.browserEvent.key === "C");
            const isSelectAll = isModifier && (e.browserEvent.key === "a" || e.browserEvent.key === "A");
            const isFind = isModifier && (e.browserEvent.key === "f" || e.browserEvent.key === "F");

            if (isCopy || isSelectAll || isFind) return; // Allow read-only safe shortcuts

            // Block cut (Ctrl+X)
            const isCut = isModifier && (e.browserEvent.key === "x" || e.browserEvent.key === "X");
            // Block paste (Ctrl+V)
            const isPaste = isModifier && (e.browserEvent.key === "v" || e.browserEvent.key === "V");
            // Block undo/redo that might affect read-only regions
            const isUndo = isModifier && (e.browserEvent.key === "z" || e.browserEvent.key === "Z");

            if (isPrintable || isDeletion || isEnter || isCut || isPaste || isUndo) {
                e.preventDefault();
                e.stopPropagation();
                flashReadOnlyWarning();
            }
        });

        // Also intercept programmatic typing via onWillType
        // (catches auto-complete insertions, snippets, etc.)
        // NOTE: onWillType is not available in all Monaco versions;
        // the onKeyDown handler above covers the primary use cases.

        // Add keyboard shortcuts using numeric key codes
        // Ctrl/Cmd + = (zoom in)
        editor.addCommand(2048 | 81, () => {  // KeyMod.CtrlCmd | KeyCode.Equal
            EditorSettingsStore.zoomIn();
        });
        // Ctrl/Cmd + - (zoom out)
        editor.addCommand(2048 | 88, () => {  // KeyMod.CtrlCmd | KeyCode.Minus
            EditorSettingsStore.zoomOut();
        });
        // Ctrl/Cmd + 0 (reset zoom)
        editor.addCommand(2048 | 21, () => {  // KeyMod.CtrlCmd | KeyCode.Digit0
            EditorSettingsStore.resetZoom();
        });
    };

    const handleUndo = () => {
        editorRef.current?.trigger("akasha-editor", "undo", null);
    };

    const handleRedo = () => {
        editorRef.current?.trigger("akasha-editor", "redo", null);
    };

    const handleFormatDocument = useCallback(() => {
        editorRef.current?.getAction("editor.action.formatDocument")?.run();
    }, []);

    if (!selectedPage && !selectedFilePath) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-[var(--ide-text-muted)] bg-[var(--ide-bg)] animate-fade-in p-12">
                <div className="w-16 h-16 rounded-2xl bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] flex items-center justify-center mb-4 text-white/20">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                </div>
                <h3 className="text-[var(--ide-text)] font-bold mb-1">No File Selected</h3>
                <p className="text-xs text-[var(--ide-text-muted)]">Select a file from the explorer to view source code</p>
            </div>
        );
    }

    if (error === "not_synced" || error === "read_error") {
        return (
            <div className="h-full flex flex-col items-center justify-center bg-[var(--ide-bg)] p-8 animate-fade-in">
                <div className="w-20 h-20 rounded-3xl bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] flex items-center justify-center mb-6 shadow-2xl overflow-hidden relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <svg className="w-10 h-10 text-[var(--ide-text-muted)] group-hover:text-red-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                </div>
                <h3 className="text-xl font-black text-[var(--ide-text)] mb-2 tracking-tight">
                    {error === "read_error" ? "Read Error" : "Not Synced"}
                </h3>
                <p className="text-sm text-[var(--ide-text-muted)] text-center max-w-sm leading-relaxed">
                    {error === "read_error"
                        ? "The physical file couldn't be located or accessed on disk."
                        : "Visual changes haven't been exported to disk yet. Add some blocks to trigger a sync."}
                </p>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-[var(--ide-bg)]">
            {/* Simplified Editor Toolbar - VS Code style */}
            <div className="h-9 bg-[var(--ide-chrome)] border-b border-[var(--ide-border)] px-3 flex items-center justify-between shrink-0 select-none">
                {/* Left: Breadcrumb path */}
                <div className="flex items-center gap-1 text-[11px] text-[var(--ide-text-muted)] min-w-0">
                    {activePath?.split(/[/\\]/).slice(-3).map((part, i, arr) => (
                        <React.Fragment key={i}>
                            <span className={i === arr.length - 1 ? "text-[var(--ide-text)] font-medium" : "hover:text-[var(--ide-text)] cursor-pointer"}>
                                {part}
                            </span>
                            {i < arr.length - 1 && (
                                <svg className="w-3 h-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                </svg>
                            )}
                        </React.Fragment>
                    ))}
                </div>

                {/* Right: Controls */}
                <div className="flex items-center gap-2">
                    {/* Zoom Controls */}
                    <div className="flex items-center bg-[var(--ide-bg-panel)] rounded border border-[var(--ide-border)] overflow-hidden">
                        <button
                            onClick={() => EditorSettingsStore.zoomOut()}
                            className="h-6 w-6 flex items-center justify-center text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-text)]/10 transition-colors"
                            title="Zoom Out"
                            aria-label="Zoom out"
                        >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" />
                            </svg>
                        </button>
                        <button
                            onClick={() => EditorSettingsStore.resetZoom()}
                            className="h-6 px-1.5 text-[10px] font-medium text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-text)]/10 transition-colors border-x border-[var(--ide-border)] min-w-[38px]"
                            title="Reset Zoom"
                        >
                            {settings.zoomLevel}%
                        </button>
                        <button
                            onClick={() => EditorSettingsStore.zoomIn()}
                            className="h-6 w-6 flex items-center justify-center text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-text)]/10 transition-colors"
                            title="Zoom In"
                            aria-label="Zoom in"
                        >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                            </svg>
                        </button>
                    </div>

                    {/* Toggle Buttons */}
                    <div className="flex items-center gap-0.5">
                        <button
                            onClick={() => EditorSettingsStore.toggleMinimap()}
                            className={`h-6 px-2 text-[9px] font-bold rounded transition-colors ${settings.minimap
                                ? "bg-[var(--ide-primary)] text-white"
                                : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-text)]/10"
                                }`}
                            title="Toggle Minimap"
                        >
                            MAP
                        </button>
                        <button
                            onClick={() => EditorSettingsStore.toggleWordWrap()}
                            className={`h-6 px-2 text-[9px] font-bold rounded transition-colors ${settings.wordWrap === "on"
                                ? "bg-[var(--ide-primary)] text-white"
                                : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-text)]/10"
                                }`}
                            title="Toggle Word Wrap"
                        >
                            WRAP
                        </button>
                    </div>

                    {/* Format Button */}
                    <button
                        onClick={handleFormatDocument}
                        className="h-6 px-2 text-[9px] font-bold text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-text)]/10 rounded transition-colors"
                        title="Format Document (Shift+Alt+F)"
                    >
                        FMT
                    </button>

                    {/* Undo/Redo */}
                    <div className="flex items-center gap-0.5 border-l border-[var(--ide-border)] pl-2">
                        <button
                            onClick={handleUndo}
                            className="h-6 w-6 flex items-center justify-center text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-text)]/10 rounded transition-colors"
                            title="Undo"
                            aria-label="Undo"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                            </svg>
                        </button>
                        <button
                            onClick={handleRedo}
                            className="h-6 w-6 flex items-center justify-center text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-text)]/10 rounded transition-colors"
                            title="Redo"
                            aria-label="Redo"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 10H11a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* Monaco Editor */}
            <div className="flex-1 overflow-hidden">
                <MonacoErrorBoundary>
                    <Editor
                        height="100%"
                        beforeMount={handleBeforeMount}
                        language={editorLanguage}
                        path={editorPath}
                        theme={monacoTheme}
                        value={code}
                        onChange={handleEditorChange}
                        onMount={handleEditorMount}
                        options={{
                            minimap: { enabled: settings.minimap },
                            fontSize: effectiveFontSize,
                            fontFamily: settings.fontFamily,
                            lineHeight: settings.lineHeight * effectiveFontSize,
                            tabSize: settings.tabSize,
                            insertSpaces: settings.insertSpaces,
                            wordWrap: settings.wordWrap,
                            padding: { top: 12, bottom: 12 },
                            cursorSmoothCaretAnimation: "off",  // Disabled for performance
                            smoothScrolling: false,  // Disabled for performance
                            lineNumbersMinChars: 3,
                            glyphMargin: false,
                            folding: settings.folding,
                            scrollBeyondLastLine: false,
                            automaticLayout: true,
                            bracketPairColorization: { enabled: settings.bracketPairColorization },
                            stickyScroll: { enabled: settings.stickyScroll },
                            suggest: {
                                showInlineDetails: false,  // Reduced for performance
                                preview: false,  // Disabled for performance
                            },
                            quickSuggestions: {
                                other: false,  // Only show on trigger
                                comments: false,
                                strings: false,
                            },
                            parameterHints: { enabled: true },
                            formatOnPaste: false,  // Disabled for performance
                            formatOnType: false,  // Disabled for performance
                            renderWhitespace: "none",  // Disabled for performance
                            renderLineHighlight: "line",  // Reduced from "all"
                            occurrencesHighlight: "off",  // Disabled for performance
                        }}
                    />
                </MonacoErrorBoundary>
            </div>

            {/* Unified Status Bar - Matches IDELayout */}
            <div className="h-6 bg-[var(--ide-statusbar)] px-3 flex items-center justify-between text-[11px] text-white select-none shrink-0">
                <div className="flex items-center gap-4">
                    <span className="font-medium">{project?.name || "No Project"}</span>

                    {/* Git Branch */}
                    <div className="flex items-center gap-1 opacity-80">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                        <span>main</span>
                    </div>

                    {/* Sync Status */}
                    <div className={`flex items-center gap-1 ${saveError ? "text-red-300" : isDirty ? "text-yellow-300" : "opacity-80"
                        }`}>
                        {isDirty ? (
                            <>
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                    <circle cx="12" cy="12" r="4" />
                                </svg>
                                <span>Unsaved</span>
                            </>
                        ) : isSaving ? (
                            <>
                                <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                <span>Saving...</span>
                            </>
                        ) : (
                            null
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {/* Line/Column */}
                    <span className="opacity-80 hover:opacity-100 cursor-pointer">Ln {cursorPosition.line}, Col {cursorPosition.column}</span>

                    {/* Encoding */}
                    <span className="opacity-60">UTF-8</span>

                    {/* Language */}
                    <span className="uppercase font-medium opacity-80">{editorLanguage}</span>

                    {/* Terminal Toggle */}
                    <button
                        onClick={() => toggleTerminal()}
                        className="hover:bg-white/20 px-2 py-0.5 rounded transition-colors"
                    >
                        {terminalOpen ? "Hide Terminal" : "Terminal"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CodeEditor;
