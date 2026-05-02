import React, { useState, useRef, useEffect } from "react";
import StructuredAiResponseCard from "../../ui/StructuredAiResponse";
import { normalizeAiResponse, type StructuredAiResponse } from "../../../utils/aiResponse";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const CONTEXTS = [
    { id: "global", label: "Global Project" },
    { id: "database", label: "Data Models (ERD)" },
    { id: "api", label: "API Endpoints" },
    { id: "logic", label: "Logic Flows" },
    { id: "builder", label: "UI Builder" },
    { id: "settings", label: "Settings" },
];

const getPageContext = () => {
    if (typeof window === "undefined") return "global";
    const path = window.location.pathname;
    if (path.includes('/database')) return "database";
    if (path.includes('/api')) return "api";
    if (path.includes('/logic')) return "logic";
    if (path.includes('/builder')) return "builder";
    if (path.includes('/settings')) return "settings";
    return "global";
};

interface BotChatProps {
    onClose: () => void;
    projectId: string | null;
    projectName: string | null;
    anchorX: number;
    anchorY: number;
}

interface ChatMessage {
    role: "user" | "ai";
    content: string;
    structured?: StructuredAiResponse;
}

const API_BASE = "http://localhost:3001/api/ai";

const QUICK_PROMPTS: Record<string, string[]> = {
    global: [
        "What should I build first?",
        "Suggest improvements",
        "Explain the architecture",
    ],
    database: [
        "Design an entity relationship diagram",
        "Suggest database schema optimizations",
        "Generate sample data model",
    ],
    api: [
        "Generate REST API endpoints",
        "Suggest API improvements",
        "Create API documentation",
    ],
    ui: [
        "Design a layout",
        "Improve the UI",
        "Create component structure",
    ],
    logic: [
        "Create a workflow",
        "Map the logic flow",
        "Suggest optimizations",
    ],
    builder: [
        "Generate new components",
        "Improve this page",
        "Add interactive elements",
    ],
    settings: [
        "Configure settings",
        "Optimize performance",
        "Security recommendations",
    ],
};

const CodeBlock: React.FC<{ inline?: boolean; className?: string; children?: React.ReactNode }> = ({ inline, className, children }) => {
    const lang = className?.replace(/language-/, '') || 'text';
    const code = String(children).replace(/\n$/, '');
    
    if (inline) return <code className={className}>{children}</code>;
    
    return (
        <div className="relative bg-black/40 border border-white/10 rounded-lg my-2 group/code">
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/5 bg-black/20 text-[10px] text-white/40 font-mono">
                <span>{lang}</span>
                <button
                    onClick={() => copyToClipboard(code, (fb) => { /* feedback for inline code */ })}
                    className="px-2 py-0.5 rounded text-[9px] bg-white/5 hover:bg-white/10 text-white/30 hover:text-white opacity-0 group-hover/code:opacity-100 transition-all font-bold"
                >
                    COPY
                </button>
            </div>
            <pre className="overflow-x-auto p-3 text-[12px] leading-relaxed">
                <code>{code}</code>
            </pre>
        </div>
    );
};

const copyToClipboard = async (text: string, feedback: (msg: string) => void) => {
    try {
        await navigator.clipboard.writeText(text);
        feedback("Copied!");
        setTimeout(() => feedback(""), 2000);
    } catch {
        feedback("Copy failed");
    }
};

const BotChat: React.FC<BotChatProps> = ({ onClose, projectId, projectName, anchorX, anchorY: _anchorY }) => {
    const [currentContext, setCurrentContext] = useState(getPageContext());
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isMaximized, setIsMaximized] = useState(false);
    const [fsSize, setFsSize] = useState({ w: 800, h: 600 });
    const [fsPos, setFsPos] = useState({ x: 100, y: 100 });
    const [resizing, setResizing] = useState<string | null>(null);
    const [sideWidth, setSideWidth] = useState(() => {
        const saved = localStorage.getItem("akasha_chat_panel_width");
        return saved ? parseInt(saved, 10) : 480;
    });
    const [isResizingSide, setIsResizingSide] = useState(false);
    const [copyFeedback, setCopyFeedback] = useState<Record<number, string>>({});
    const [viewport, setViewport] = useState(() => ({
        width: typeof window !== "undefined" ? window.innerWidth : 1024,
        height: typeof window !== "undefined" ? window.innerHeight : 768,
    }));
    const chatEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const fsRef = useRef<HTMLDivElement>(null);

    // Load messages from local storage when context or project changes
    useEffect(() => {
        if (!projectId) return;
        const key = `akasha_chat_history_${projectId}_${currentContext}`;
        const saved = localStorage.getItem(key);
        if (saved) {
            try {
                setMessages(JSON.parse(saved));
            } catch (e) {
                setMessages([]);
            }
        } else {
            setMessages([]);
        }
    }, [projectId, currentContext]);

    // Save messages to local storage
    useEffect(() => {
        if (!projectId || messages.length === 0) return;
        const key = `akasha_chat_history_${projectId}_${currentContext}`;
        localStorage.setItem(key, JSON.stringify(messages));

        // Save latest summary if available in the last AI message
        const lastMsg = messages[messages.length - 1];
        if (lastMsg && lastMsg.role === 'ai') {
            const summaryMatch = lastMsg.content.match(/<summary>([\s\S]*?)<\/summary>/);
            if (summaryMatch) {
                localStorage.setItem(`akasha_chat_summary_${projectId}_${currentContext}`, summaryMatch[1].trim());
            }
        }
    }, [messages, projectId, currentContext]);

    const isMobile = viewport.width < 768;
    const dockToRight = isMobile || anchorX >= viewport.width / 2;
    const panelWidth = isMobile ? viewport.width : sideWidth;

    // Handle side panel resize
    useEffect(() => {
        if (!isResizingSide) return;
        const handleMouseMove = (e: MouseEvent) => {
            const newWidth = dockToRight 
                ? viewport.width - e.clientX 
                : e.clientX;
            const clampedWidth = Math.min(Math.max(newWidth, 320), viewport.width * 0.8);
            setSideWidth(clampedWidth);
        };
        const handleMouseUp = () => {
            setIsResizingSide(false);
            localStorage.setItem("akasha_chat_panel_width", sideWidth.toString());
        };
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizingSide, dockToRight, viewport.width, sideWidth]);

    // Handle detached (fullscreen) resize
    useEffect(() => {
        if (!resizing || isMaximized) return;
        const handleMouseMove = (e: MouseEvent) => {
            if (resizing === 'se') {
                setFsSize(prev => ({
                    w: Math.max(400, e.clientX - fsPos.x),
                    h: Math.max(300, e.clientY - fsPos.y),
                }));
            }
        };
        const handleMouseUp = () => setResizing(null);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [resizing, fsPos, isMaximized]);

    const panelStyle: React.CSSProperties = isMobile
        ? {
            position: "fixed",
            inset: 0,
            zIndex: 9998,
        }
        : isMaximized
            ? {
                position: "fixed",
                inset: "20px",
                zIndex: 10000,
                background: "rgba(0,0,0,0.45)",
                backdropFilter: "blur(16px)",
            }
        : isFullscreen
            ? {
                position: "fixed",
                left: fsPos.x,
                top: fsPos.y,
                width: fsSize.w,
                height: fsSize.h,
                zIndex: 10000,
                background: "rgba(0,0,0,0.45)",
                backdropFilter: "blur(16px)",
            }
        : {
            position: "fixed",
            top: 0,
            bottom: 0,
            zIndex: 9998,
            width: panelWidth,
            right: dockToRight ? 0 : "auto",
            left: dockToRight ? "auto" : 0,
            transition: isResizingSide ? 'none' : 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        };

    // Handle dragging for detached panel
    const handleMouseDown = (e: React.MouseEvent) => {
        if (!isFullscreen || isMaximized) return;
        const startX = e.clientX - fsPos.x;
        const startY = e.clientY - fsPos.y;

        const handleMouseMove = (moveEvent: MouseEvent) => {
            setFsPos({
                x: moveEvent.clientX - startX,
                y: moveEvent.clientY - startY,
            });
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    // Auto scroll
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isTyping]);

    useEffect(() => {
        const handleResize = () => {
            setViewport({
                width: window.innerWidth,
                height: window.innerHeight,
            });
        };

        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    // Focus input on mount
    useEffect(() => {
        setTimeout(() => inputRef.current?.focus(), 100);
    }, []);

    useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                if (isMaximized) {
                    setIsMaximized(false);
                    return;
                }
                if (isFullscreen) {
                    setIsFullscreen(false);
                    return;
                }
                onClose();
            }
        };

        window.addEventListener("keydown", handleEscape);
        return () => window.removeEventListener("keydown", handleEscape);
    }, [onClose, isFullscreen]);

    const handleClearChat = () => {
        if (!projectId) return;
        const key = `akasha_chat_history_${projectId}_${currentContext}`;
        localStorage.removeItem(key);
        localStorage.removeItem(`akasha_chat_summary_${projectId}_${currentContext}`);
        setMessages([]);
    };

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMsg = input.trim();
        const newMessages = [...messages, { role: "user" as const, content: userMsg }];
        setMessages(newMessages);
        setInput("");
        setIsTyping(true);

        try {
            const endpoint = projectId ? `${API_BASE}/project-chat` : `${API_BASE}/simple-chat`;

            // Add context awareness instructions to the user message to make it smart
            const contextLabel = CONTEXTS.find(c => c.id === currentContext)?.label || "Project";
            let contextInstruction = "";
            if (newMessages.length === 1) {
                // First request, ask for summary
                contextInstruction = `\n\n[SYSTEM INSTRUCTION: You are assisting the user on the '${contextLabel}' page. Please consider this context. Also, at the very end of your response, output a brief summary of the conversation so far enclosed in <summary> tags.]`;
            } else {
                // Subsequent requests, ask for updated summary
                contextInstruction = `\n\n[SYSTEM INSTRUCTION: Remember we are focused on the '${contextLabel}' context. At the end of your response, update the <summary> of our conversation.]`;
            }

            const payloadHistory = [...newMessages];
            payloadHistory[payloadHistory.length - 1] = {
                role: "user",
                content: userMsg + contextInstruction
            };

            // Smart Context: If history is long, use the latest summary to save tokens
            let finalHistoryToSend = payloadHistory.slice(0, -1);
            if (finalHistoryToSend.length > 6) {
                const savedSummary = localStorage.getItem(`akasha_chat_summary_${projectId}_${currentContext}`);
                if (savedSummary) {
                    finalHistoryToSend = [
                        { role: "user", content: `[SYSTEM: Previous conversation summary: ${savedSummary}]` },
                        ...finalHistoryToSend.slice(-4) // Keep only the last 4 messages for immediate context
                    ];
                }
            }

            const body = projectId
                ? { message: userMsg + contextInstruction, projectId, history: finalHistoryToSend }
                : { message: userMsg + contextInstruction };

            // Build headers — include AI auth headers (same as axios interceptor)
            const fetchHeaders: Record<string, string> = { "Content-Type": "application/json" };
            if (typeof window !== "undefined") {
                const storedKey = localStorage.getItem("akasha_api_key")?.trim();
                const storedModel = localStorage.getItem("akasha_model")?.trim();
                const storedBase = localStorage.getItem("akasha_api_base_url")?.trim();
                if (storedKey) fetchHeaders["x-ai-api-key"] = storedKey;
                if (storedModel) fetchHeaders["x-ai-model"] = storedModel;
                if (storedBase) fetchHeaders["x-ai-api-base-url"] = storedBase;
            }

            const res = await fetch(endpoint, {
                method: "POST",
                headers: fetchHeaders,
                body: JSON.stringify(body),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to get response");

            const structured = normalizeAiResponse(data);
            setMessages(prev => [...prev, { role: "ai", content: structured.answer_markdown, structured }]);
        } catch (err: any) {
            setMessages(prev => [...prev, { role: "ai", content: `ERR: ${err.message || "Connection failed"}` }]);
        } finally {
            setIsTyping(false);
        }
    };

    return (
        <div
            ref={fsRef}
            style={panelStyle}
            className={isMobile ? "animate-chat-in-mobile" : dockToRight && !isFullscreen ? "animate-chat-in-right" : !isFullscreen ? "animate-chat-in-left" : ""}
        >
            <div
                className={`h-full flex flex-col bg-[#0a0a0f]/90 backdrop-blur-xl overflow-hidden ${isMobile
                        ? "rounded-none border-0"
                        : isFullscreen
                            ? "rounded-[2rem] border border-white/10 shadow-[0_40px_120px_-20px_rgba(0,0,0,0.8),0_0_1px_rgba(255,255,255,0.2)]"
                            : `rounded-none border-y-0 ${dockToRight ? "border-l" : "border-r"} border-white/5 shadow-[-20px_0_60px_-15px_rgba(0,0,0,0.5)]`
                    }`}
            >
                {/* High-Fidelity Header */}
                <div 
                    onMouseDown={handleMouseDown}
                    className="h-20 px-8 border-b border-white/[0.03] flex items-center justify-between bg-gradient-to-b from-white/[0.02] to-transparent select-none cursor-default"
                >
                    <div className="flex items-center gap-5">
                        <div className="relative">
                            <div className="absolute inset-0 bg-white/20 blur-md rounded-full opacity-20"></div>
                            <div className="relative w-10 h-10 rounded-xl bg-black border border-white/10 flex items-center justify-center shadow-inner">
                                <div className="w-4 h-4 bg-white/10 rounded-sm rotate-45 animate-[pulse_3s_ease-in-out_infinite]"></div>
                                <span className="absolute text-[8px] font-black text-white/60 tracking-tighter">AK</span>
                            </div>
                        </div>
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[12px] font-black text-white tracking-[0.2em] uppercase">Akasha Assistant</span>
                            <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80 shadow-[0_0_8px_rgba(16,185,129,0.4)] animate-pulse"></span>
                                <span className="text-[9px] text-white/30 font-bold tracking-widest uppercase">{currentContext} node • encrypted</span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        <div className="hidden sm:flex bg-white/[0.03] rounded-xl p-1 border border-white/[0.05]">
                            <button 
                                onClick={() => setCurrentContext('project')}
                                className={`px-4 py-1.5 rounded-lg text-[10px] font-black tracking-widest transition-all ${currentContext === 'project' ? 'bg-white text-black shadow-lg' : 'text-white/20 hover:text-white/40'}`}
                            >
                                PROJECT
                            </button>
                            <button 
                                onClick={() => setCurrentContext('global')}
                                className={`px-4 py-1.5 rounded-lg text-[10px] font-black tracking-widest transition-all ${currentContext === 'global' ? 'bg-white text-black shadow-lg' : 'text-white/20 hover:text-white/40'}`}
                            >
                                GLOBAL
                            </button>
                        </div>
                        
                        <div className="h-8 w-[1px] bg-white/5 mx-2" />
                        
                        <div className="flex items-center gap-1">
                            {!isMobile && (
                                <button
                                    onClick={() => { setIsMaximized(!isMaximized); if (isFullscreen) setIsFullscreen(false); }}
                                    className="w-9 h-9 rounded-xl flex items-center justify-center text-white/20 hover:text-white hover:bg-white/5 transition-all group"
                                >
                                    <svg className="w-4 h-4 opacity-40 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
                                </button>
                            )}
                            <button
                                onClick={onClose}
                                className="w-9 h-9 rounded-xl flex items-center justify-center text-white/20 hover:text-red-400 hover:bg-red-500/5 transition-all group"
                            >
                                <svg className="w-5 h-5 opacity-40 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Main Interaction Hub */}
                <div className="flex-1 overflow-hidden relative flex flex-col">
                    <div className="flex-1 overflow-y-auto px-8 py-10 space-y-10 custom-scrollbar scroll-smooth">
                        {messages.length === 0 && !isTyping && (
                            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto">
                                <div className="mb-12 relative group">
                                    <div className="absolute inset-0 bg-white/10 blur-[100px] rounded-full opacity-20 group-hover:opacity-40 transition-opacity duration-1000"></div>
                                    <div className="relative w-24 h-24 rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.05] to-transparent flex items-center justify-center shadow-2xl backdrop-blur-md">
                                        <div className="w-10 h-10 border-2 border-white/5 rounded-full animate-[spin_8s_linear_infinite] border-t-white/40"></div>
                                        <div className="absolute w-2 h-2 bg-white rounded-full animate-ping"></div>
                                    </div>
                                </div>
                                <h2 className="text-white text-[18px] font-black tracking-[0.3em] uppercase mb-4">Neural Link Active</h2>
                                <p className="text-white/30 text-[12px] leading-relaxed mb-12 font-medium tracking-wide">
                                    Awaiting cryptographically signed instructions from the primary developer node. Protocol is ready for code injection, architectural analysis, or UI synthesis.
                                </p>
                            </div>
                        )}

                        {messages.map((msg, idx) => {
                            const displayContent = msg.content
                                .replace(/<summary>[\s\S]*?<\/summary>/g, '')
                                .replace(/\*\*Summary:\*\*[\s\S]*?$/i, '')
                                .replace(/Summary:[\s\S]*?$/i, '')
                                .trim();
                                
                            return (
                                <div key={idx} className={`flex gap-6 group animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 text-[10px] font-black tracking-tighter border shadow-xl transition-all group-hover:scale-105 ${msg.role === "user" ? "bg-white text-black border-white shadow-white/5" : "bg-[#11111a] text-white/40 border-white/10"}`}>
                                        {msg.role === "user" ? "USER" : "BOT"}
                                    </div>
                                    <div className={`flex flex-col gap-4 max-w-[88%] ${msg.role === "user" ? "items-end" : "items-start"}`}>
                                        <div className={`px-6 py-5 rounded-[1.5rem] text-[14px] font-medium leading-[1.7] transition-all ${msg.role === "user" 
                                            ? "bg-white/[0.07] text-white rounded-tr-sm border border-white/10 shadow-lg" 
                                            : "bg-white/[0.02] text-white/90 border border-white/[0.05] rounded-tl-sm prose prose-invert prose-p:leading-relaxed max-w-full shadow-sm"}`}>
                                            {msg.role === "ai" && msg.structured ? (
                                                <StructuredAiResponseCard response={msg.structured} compact />
                                            ) : msg.role === "ai" ? (
                                                <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ code: CodeBlock }}>{displayContent}</ReactMarkdown>
                                            ) : displayContent}
                                        </div>
                                        {msg.role === "ai" && (
                                            <div className="flex gap-6 ml-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-1 group-hover:translate-y-0">
                                                <button 
                                                    onClick={() => copyToClipboard(displayContent, (fb) => setCopyFeedback(p => ({ ...p, [idx]: fb })))}
                                                    className="flex items-center gap-2 text-[10px] font-black text-white/20 hover:text-white transition-colors uppercase tracking-[0.2em]"
                                                >
                                                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                                                    {copyFeedback[idx] || "Capture"}
                                                </button>
                                                <button 
                                                    onClick={() => { setInput(displayContent); inputRef.current?.focus(); }}
                                                    className="flex items-center gap-2 text-[10px] font-black text-white/20 hover:text-white transition-colors uppercase tracking-[0.2em]"
                                                >
                                                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 10 20 15 15 20"></polyline><path d="M4 4v7a4 4 0 0 0 4 4h12"></path></svg>
                                                    Modify
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        {isTyping && (
                            <div className="flex gap-6">
                                <div className="w-10 h-10 rounded-2xl bg-[#11111a] text-white/40 border border-white/10 flex items-center justify-center text-[10px] font-black tracking-tighter">BOT</div>
                                <div className="px-6 py-5 rounded-[1.5rem] bg-white/[0.02] border border-white/[0.05] flex items-center gap-2 rounded-tl-sm">
                                    <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                    <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                    <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" />
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    {/* Command Console */}
                    <div className="p-8 bg-gradient-to-t from-[#0a0a0f] via-[#0a0a0f]/95 to-transparent border-t border-white/[0.03]">
                        <div className="relative group">
                            <div className="absolute -inset-1 bg-gradient-to-r from-white/20 via-white/5 to-transparent rounded-[1.8rem] blur opacity-0 group-focus-within:opacity-100 transition duration-700"></div>
                            <div className="relative flex items-end gap-4 bg-[#11111a]/80 border border-white/10 rounded-[1.5rem] p-3 pl-6 shadow-2xl transition-all focus-within:border-white/30 focus-within:bg-[#11111a]">
                                <textarea
                                    ref={inputRef}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                                    placeholder="Input next instruction segment..."
                                    rows={1}
                                    className="flex-1 min-h-[48px] max-h-48 bg-transparent border-none py-3 text-[15px] text-white placeholder:text-white/10 focus:ring-0 focus:outline-none resize-none font-mono selection:bg-white/20"
                                />
                                <div className="flex items-center gap-3 pb-1.5 pr-1.5">
                                    <button 
                                        onClick={handleClearChat}
                                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white/10 hover:text-red-400 hover:bg-red-500/10 transition-all active:scale-90"
                                        title="Clear Memory"
                                    >
                                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                    </button>
                                    <button
                                        onClick={handleSend}
                                        disabled={!input.trim() || isTyping}
                                        className="w-10 h-10 rounded-xl bg-white text-black flex items-center justify-center hover:bg-white/90 hover:shadow-[0_0_20px_rgba(255,255,255,0.3)] transition-all disabled:opacity-10 active:scale-90"
                                    >
                                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <style>{`
                    @keyframes chat-in-right { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: translateX(0); } }
                    @keyframes chat-in-left { from { opacity: 0; transform: translateX(-40px); } to { opacity: 1; transform: translateX(0); } }
                    @keyframes chat-in-mobile { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                    .animate-chat-in-right { animation: chat-in-right 0.5s cubic-bezier(0.16, 1, 0.3, 1) both; }
                    .animate-chat-in-left { animation: chat-in-left 0.5s cubic-bezier(0.16, 1, 0.3, 1) both; }
                    .animate-chat-in-mobile { animation: chat-in-mobile 0.5s cubic-bezier(0.16, 1, 0.3, 1) both; }
                    .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                    .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.08); border-radius: 10px; }
                    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.15); }
                    ::selection { background: rgba(255, 255, 255, 0.1); color: white; }
                `}</style>
            </div>
        </div>
    );
};

export default BotChat;
