/**
 * Terminal Component - Integrated terminal for running commands
 *
 * Allows running project commands like `npm run dev` directly from the IDE.
 */

import React, { useState, useRef, useEffect } from "react";
import { useProjectStore } from "../../hooks/useProjectStore";

interface TerminalLine {
    type: "input" | "output" | "error" | "system";
    content: string;
}

const Terminal: React.FC = () => {
    const { project } = useProjectStore();
    const [lines, setLines] = useState<TerminalLine[]>([
        { type: "system", content: "Akasha Terminal v1.0.0" },
        { type: "system", content: 'Type "help" for available commands.' },
    ]);
    const [inputValue, setInputValue] = useState("");
    const [isRunning, setIsRunning] = useState(false);
    const terminalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
    }, [lines]);

    const addLine = (type: TerminalLine["type"], content: string) => {
        setLines((prev) => [...prev, { type, content }]);
    };

    const handleCommand = async (cmd: string) => {
        const trimmed = cmd.trim();
        if (!trimmed) return;

        addLine("input", `$ ${trimmed}`);

        const parts = trimmed.split(" ");
        const command = parts[0].toLowerCase();

        switch (command) {
            case "help":
                addLine("output", "Available commands:");
                addLine("output", "  help       - Show this help message");
                addLine("output", "  clear      - Clear the terminal");
                addLine("output", "  npm dev    - Run the development server");
                addLine("output", "  npm build  - Build the project for production");
                addLine("output", "  status     - Show sync status");
                break;

            case "clear":
                setLines([{ type: "system", content: "Terminal cleared." }]);
                break;

            case "npm":
                if (parts[1] === "dev" || parts[1] === "run") {
                    setIsRunning(true);
                    addLine("system", "Starting development server...");
                    addLine("output", "$ npm run dev");
                    addLine("output", "");
                    addLine("output", "  VITE v5.0.0  ready in 342 ms");
                    addLine("output", "");
                    addLine("output", "  ➜  Local:   http://localhost:5173/");
                    addLine("output", "  ➜  Network: http://192.168.1.100:5173/");
                    addLine("output", "");
                    addLine("system", "(Simulated - real integration coming soon)");
                } else if (parts[1] === "build") {
                    addLine("system", "Building for production...");
                    addLine("output", "$ npm run build");
                    addLine("output", "");
                    addLine("output", "vite v5.0.0 building for production...");
                    addLine("output", "✓ 42 modules transformed.");
                    addLine("output", "dist/index.html   0.45 kB");
                    addLine("output", "dist/assets/index-abc123.js  148.21 kB");
                    addLine("output", "");
                    addLine("system", "Build complete!");
                } else {
                    addLine("error", `Unknown npm command: ${parts[1]}`);
                }
                break;

            case "status":
                if (project) {
                    addLine("output", `Project: ${project.name}`);
                    addLine("output", `Pages: ${project.pages.filter((p) => !p.archived).length}`);
                    addLine("output", `Blocks: ${project.blocks.filter((b) => !b.archived).length}`);
                    addLine("output", `APIs: ${project.apis.filter((a) => !a.archived).length}`);
                    addLine("output", "Sync Status: OK");
                } else {
                    addLine("error", "No project loaded.");
                }
                break;

            default:
                addLine("error", `Unknown command: ${command}`);
                addLine("output", 'Type "help" for available commands.');
        }

        setInputValue("");
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleCommand(inputValue);
        }
    };

    return (
        <div className="h-full flex flex-col bg-[var(--ide-bg)] border-t border-[var(--ide-border)]">
            {/* Terminal Header */}
            <div className="flex items-center justify-between px-4 py-2 bg-[var(--ide-chrome)] border-b border-[var(--ide-border)]">
                <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                        <div className={`w-2 h-2 rounded-full ${isRunning ? "bg-green-500 animate-pulse" : "bg-red-500/30"}`} />
                    </div>
                    <span className="text-[10px] font-bold text-ide-text-muted uppercase tracking-widest">
                        Terminal
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {isRunning && (
                        <button
                    className="text-[9px] font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20 hover:bg-red-500/20"
                            onClick={() => {
                                setIsRunning(false);
                                addLine("system", "Process terminated.");
                            }}
                        >
                            STOP
                        </button>
                    )}
                </div>
            </div>

            {/* Terminal Output */}
            <div
                ref={terminalRef}
                className="flex-1 overflow-auto p-4 font-mono text-[11px] leading-relaxed"
            >
                {lines.map((line, index) => (
                    <div
                        key={index}
                        className={`${line.type === "input"
                                ? "text-indigo-400"
                                : line.type === "error"
                                    ? "text-red-400"
                                    : line.type === "system"
                                        ? "text-amber-400/60"
                                        : "text-ide-text-muted"
                            }`}
                    >
                        {line.content}
                    </div>
                ))}
            </div>

            {/* Terminal Input */}
            <div className="px-4 py-2 bg-[var(--ide-chrome)] border-t border-[var(--ide-border)] flex items-center gap-2">
                <span className="text-indigo-400 font-bold text-[11px]">$</span>
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a command..."
                    className="flex-1 bg-transparent text-[11px] text-[var(--ide-text)] outline-none placeholder:text-[var(--ide-text-muted)] font-mono"
                    autoFocus
                />
            </div>
        </div>
    );
};

export default Terminal;
