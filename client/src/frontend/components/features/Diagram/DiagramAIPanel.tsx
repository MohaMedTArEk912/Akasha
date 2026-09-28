import React, { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Trash2 } from "lucide-react";

interface DiagramAIPanelProps {
    projectId: string | null;
    currentDiagramName: string | null;
    currentDiagramContent: string | null;
    onClose?: () => void;
    autoPrompt?: { text: string; timestamp: number } | null;
    currentMode: "ERD" | "UseCase" | "Architecture";
}

interface ChatMessage {
    role: "user" | "ai";
    content: string;
}

const API_BASE = "/api/akasha/ai";

const QUICK_PROMPTS = [
    "Generate an ERD for this project",
    "Create a sequence diagram for user login",
    "Draw an architecture diagram",
    "Generate a use case diagram",
    "Analyze my current diagram",
    "Explain this diagram to me",
];

const CodeBlock: React.FC<{ inline?: boolean; className?: string; children?: React.ReactNode }> = ({
    inline,
    className,
    children,
}) => {
    const [copied, setCopied] = useState(false);
    const lang = className?.replace(/language-/, "") || "text";
    const code = String(children).replace(/\n$/, "");

    if (inline) return <code className={className}>{children}</code>;

    const handleCopy = async () => {
        await navigator.clipboard.writeText(code).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div style={{ position: "relative", margin: "10px 0", borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 12px", background: "rgba(0,0,0,0.4)", fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: "monospace" }}>
                <span>{lang}</span>
                <button
                    onClick={handleCopy}
                    style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 4, padding: "2px 8px", color: copied ? "#4ade80" : "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 10, fontWeight: 700 }}
                >
                    {copied ? "COPIED!" : "COPY"}
                </button>
            </div>
            <pre style={{ overflow: "auto", padding: "12px", fontSize: 12, lineHeight: 1.6, margin: 0, background: "rgba(0,0,0,0.3)" }}>
                <code>{code}</code>
            </pre>
        </div>
    );
};

const DiagramAIPanel: React.FC<DiagramAIPanelProps> = ({
    projectId,
    currentDiagramName,
    currentDiagramContent,
    onClose,
    autoPrompt,
    currentMode,
}) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const [copyFeedback, setCopyFeedback] = useState<Record<number, string>>({});
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const lastHandledPromptRef = useRef<number>(0);

    const storageKey = `akasha_diagram_chat_${projectId || "none"}_${currentMode}`;

    // Persist / restore chat
    useEffect(() => {
        try {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                setMessages(JSON.parse(saved));
            } else {
                setMessages([]);
            }
        } catch {
            setMessages([]);
        }
    }, [storageKey]);

    useEffect(() => {
        if (messages.length > 0) {
            localStorage.setItem(storageKey, JSON.stringify(messages));
        }
    }, [messages, storageKey]);

    useEffect(() => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
        }
    }, [messages, isTyping]);

    const handleSend = useCallback(async (text?: string) => {
        const userMsg = (text ?? input).trim();
        if (!userMsg || !projectId) return;

        const newMessages: ChatMessage[] = [...messages, { role: "user", content: userMsg }];
        setMessages(newMessages);
        setInput("");
        setIsTyping(true);

        try {
            const fetchHeaders: Record<string, string> = { "Content-Type": "application/json" };
            if (typeof window !== "undefined") {
                const storedKey = localStorage.getItem("akasha_api_key")?.trim();
                const storedModel = localStorage.getItem("akasha_model")?.trim();
                const storedBase = localStorage.getItem("akasha_api_base_url")?.trim();
                const token = (localStorage.getItem("akasha_token") || localStorage.getItem("token"))?.trim();
                if (storedKey) fetchHeaders["x-ai-api-key"] = storedKey;
                if (storedModel) fetchHeaders["x-ai-model"] = storedModel;
                if (storedBase) fetchHeaders["x-ai-api-base-url"] = storedBase;
                if (token) fetchHeaders["Authorization"] = `Bearer ${token}`;
            }

            const historyForPayload = newMessages.slice(0, -1).slice(-8);

            const res = await fetch(`${API_BASE}/diagram-chat`, {
                method: "POST",
                headers: fetchHeaders,
                body: JSON.stringify({
                    message: userMsg,
                    projectId,
                    history: historyForPayload,
                    currentDiagramName: currentDiagramName || null,
                    currentDiagramContent: currentDiagramContent || null,
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || data.message || "Failed to get response");

            const aiContent =
                typeof data.response?.answer_markdown === "string"
                    ? data.response.answer_markdown
                    : typeof data.reply === "string"
                    ? data.reply
                    : "No response received.";

            setMessages((prev) => [...prev, { role: "ai", content: aiContent }]);
        } catch (err: any) {
            setMessages((prev) => [
                ...prev,
                { role: "ai", content: `❌ Error: ${err.message || "Connection failed"}` },
            ]);
        } finally {
            setIsTyping(false);
        }
    }, [input, messages, projectId, currentDiagramName, currentDiagramContent, storageKey]);

    useEffect(() => {
        if (autoPrompt && autoPrompt.timestamp > lastHandledPromptRef.current) {
            lastHandledPromptRef.current = autoPrompt.timestamp;
            
            // Check if there is already a saved chat history for this mode/tab
            let hasHistory = false;
            try {
                const saved = localStorage.getItem(storageKey);
                if (saved && JSON.parse(saved).length > 0) {
                    hasHistory = true;
                }
            } catch {}

            if (!hasHistory) {
                handleSend(autoPrompt.text);
            }
        }
    }, [autoPrompt, handleSend, storageKey]);

    const handleClear = () => {
        setMessages([]);
        localStorage.removeItem(storageKey);
    };

    const handleCopy = async (text: string, idx: number) => {
        await navigator.clipboard.writeText(text).catch(() => {});
        setCopyFeedback((p) => ({ ...p, [idx]: "Copied!" }));
        setTimeout(() => setCopyFeedback((p) => ({ ...p, [idx]: "" })), 2000);
    };

    const panelBg = "var(--ide-bg-panel, #0d0d14)";
    const border = "var(--ide-border, rgba(255,255,255,0.08))";
    const text = "var(--ide-text, #e2e8f0)";
    const textSec = "var(--ide-text-secondary, rgba(255,255,255,0.45))";

    return (
        <div
            style={{
                width: 360,
                display: "flex",
                flexDirection: "column",
                height: "100%",
                background: panelBg,
                borderLeft: `1px solid ${border}`,
                overflow: "hidden",
            }}
        >
            {/* Header */}
            <div
                style={{
                    height: 44,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0 14px",
                    background: "var(--ide-chrome, rgba(255,255,255,0.02))",
                    borderBottom: `1px solid ${border}`,
                    flexShrink: 0,
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 15 }}>🤖</span>
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: textSec }}>
                        Diagram AI
                    </span>
                    {currentDiagramName && (
                        <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 6, background: "rgba(255,255,255,0.06)", border: `1px solid ${border}`, color: textSec, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {currentDiagramName.replace(/\.excalidraw$/, "")}
                        </span>
                    )}
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                    <button
                        onClick={handleClear}
                        title="Clear chat"
                        style={{ background: "none", border: "none", cursor: "pointer", color: textSec, fontSize: 14, padding: "4px 6px", borderRadius: 6, lineHeight: 1 }}
                    >
                        <Trash2 size={14} aria-hidden="true" />
                    </button>
                    {onClose && (
                        <button
                            onClick={onClose}
                            title="Close"
                            style={{ background: "none", border: "none", cursor: "pointer", color: textSec, fontSize: 16, padding: "4px 6px", borderRadius: 6, lineHeight: 1 }}
                        >
                            ×
                        </button>
                    )}
                </div>
            </div>

            {/* Messages */}
            <div
                ref={scrollContainerRef}
                style={{ flex: 1, overflowY: "auto", padding: "12px 12px 0", display: "flex", flexDirection: "column", gap: 10 }}
            >
                {messages.length === 0 && !isTyping && (
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 24, textAlign: "center" }}>
                        <div style={{ fontSize: 36, opacity: 0.3 }}>📐</div>
                        <p style={{ fontSize: 12, color: textSec, lineHeight: 1.6, margin: 0 }}>
                            I know your project's data models, pages, use cases, and logic flows.
                            <br />Ask me to generate, analyze, or explain any diagram.
                        </p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", marginTop: 8 }}>
                            {QUICK_PROMPTS.map((p) => (
                                <button
                                    key={p}
                                    onClick={() => handleSend(p)}
                                    style={{
                                        fontSize: 10, padding: "5px 10px", borderRadius: 8,
                                        background: "rgba(255,255,255,0.04)", border: `1px solid ${border}`,
                                        color: textSec, cursor: "pointer", lineHeight: 1.4, fontWeight: 500,
                                        transition: "all 0.15s",
                                    }}
                                    onMouseOver={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
                                    onMouseOut={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {messages.map((msg, idx) => {
                    const displayContent = msg.content.replace(/<summary>[\s\S]*?<\/summary>/g, "").trim();
                    return (
                        <div
                            key={idx}
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: msg.role === "user" ? "flex-end" : "flex-start",
                                gap: 4,
                            }}
                        >
                            <div
                                style={{
                                    maxWidth: "93%",
                                    padding: "10px 13px",
                                    borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                                    fontSize: 13,
                                    lineHeight: 1.65,
                                    background: msg.role === "user"
                                        ? "rgba(255,255,255,0.08)"
                                        : "rgba(255,255,255,0.03)",
                                    border: `1px solid ${msg.role === "user" ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)"}`,
                                    color: text,
                                }}
                            >
                                {msg.role === "ai" ? (
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        components={{ code: CodeBlock as any }}
                                    >
                                        {displayContent}
                                    </ReactMarkdown>
                                ) : (
                                    displayContent
                                )}
                            </div>
                            {msg.role === "ai" && (
                                <button
                                    onClick={() => handleCopy(displayContent, idx)}
                                    style={{ fontSize: 10, color: textSec, background: "none", border: "none", cursor: "pointer", padding: "2px 4px" }}
                                >
                                    {copyFeedback[idx] || "Copy"}
                                </button>
                            )}
                        </div>
                    );
                })}

                {isTyping && (
                    <div style={{ display: "flex", gap: 4, padding: "10px 13px", alignItems: "center" }}>
                        {[0, 150, 300].map((delay) => (
                            <div key={delay} style={{ width: 7, height: 7, borderRadius: "50%", background: "rgba(255,255,255,0.4)", animation: `bounce 1s ${delay}ms ease-in-out infinite` }} />
                        ))}
                    </div>
                )}
            </div>

            {/* Input */}
            <div style={{ padding: "10px 12px 12px", borderTop: `1px solid ${border}`, flexShrink: 0 }}>
                {!projectId && (
                    <div style={{ fontSize: 11, color: "#f87171", marginBottom: 8, textAlign: "center" }}>
                        Open a project to use Diagram AI
                    </div>
                )}
                <div style={{ display: "flex", gap: 8, alignItems: "flex-end", background: "rgba(255,255,255,0.04)", border: `1px solid ${border}`, borderRadius: 12, padding: "8px 10px" }}>
                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        placeholder={projectId ? "Ask about diagrams… (Shift+Enter for newline)" : "No project open"}
                        disabled={!projectId || isTyping}
                        rows={1}
                        style={{
                            flex: 1,
                            background: "transparent",
                            border: "none",
                            outline: "none",
                            resize: "none",
                            fontSize: 13,
                            color: text,
                            lineHeight: 1.5,
                            minHeight: 36,
                            maxHeight: 120,
                            fontFamily: "inherit",
                        }}
                    />
                    <button
                        onClick={() => handleSend()}
                        disabled={!input.trim() || isTyping || !projectId}
                        style={{
                            padding: "0 14px",
                            height: 34,
                            borderRadius: 9,
                            background: !input.trim() || isTyping || !projectId ? "rgba(255,255,255,0.06)" : "var(--ide-accent, #2563eb)",
                            color: !input.trim() || isTyping || !projectId ? "rgba(255,255,255,0.3)" : "white",
                            border: "none",
                            cursor: !input.trim() || isTyping || !projectId ? "not-allowed" : "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                            fontSize: 11,
                            fontWeight: 800,
                            letterSpacing: "0.05em",
                            transition: "all 0.15s",
                        }}
                    >
                        SEND
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes bounce {
                    0%, 100% { transform: translateY(0); opacity: 0.4; }
                    50% { transform: translateY(-5px); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default DiagramAIPanel;
