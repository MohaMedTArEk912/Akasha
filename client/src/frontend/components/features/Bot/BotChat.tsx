import React, { useState, useRef, useEffect, useMemo } from "react";
import StructuredAiResponseCard from "../../ui/StructuredAiResponse";
import { normalizeAiResponse, type StructuredAiResponse } from "../../../utils/aiResponse";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useProjectStore } from '../../../hooks/useProjectStore';

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

const API_BASE = "/api/akasha/ai";

export const QUICK_PROMPTS: Record<string, string[]> = {
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
                    onClick={() => copyToClipboard(code, (_fb) => { /* feedback for inline code */ })}
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

// --- Akasha Mini Avatar SVG (reusable) ---
const AkashaAvatarMini: React.FC<{ size?: number; pulse?: boolean; className?: string }> = ({ size = 40, pulse = false, className = '' }) => (
    <div className={`relative flex items-center justify-center flex-shrink-0 ${className}`} style={{ width: size, height: size }}>
        <svg viewBox="0 0 40 40" width={size} height={size}>
            <defs>
                <linearGradient id="akasha-avatar-grad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" />
                    <stop offset="100%" stopColor="#6366f1" />
                </linearGradient>
            </defs>
            <circle cx="20" cy="20" r="18" fill="url(#akasha-avatar-grad)" opacity="0.85" />
            <circle cx="20" cy="20" r="14" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="0.8" className="akasha-ring-spin" />
            <circle cx="20" cy="20" r="3" fill="white" opacity="0.95" />
        </svg>
        {pulse && <div className="absolute inset-0 rounded-full bg-cyan-400/20 animate-ping" />}
    </div>
);

const BotChat: React.FC<BotChatProps> = ({ onClose, projectId, projectName: _projectName, anchorX, anchorY: _anchorY }) => {
    const { project } = useProjectStore();
    const ideaDetails = project?.settings?.ideaDetails;

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
    const [reactions, setReactions] = useState<Record<number, 'up' | 'down' | null>>({});
    const [voiceToast, setVoiceToast] = useState(false);
    const [viewport, setViewport] = useState(() => ({
        width: typeof window !== "undefined" ? window.innerWidth : 1024,
        height: typeof window !== "undefined" ? window.innerHeight : 768,
    }));
    const chatEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const fsRef = useRef<HTMLDivElement>(null);

    // --- Dynamic Idea-Aware Quick Prompts ---
    const dynamicQuickPrompts = useMemo(() => {
        const base = QUICK_PROMPTS[currentContext] || QUICK_PROMPTS.global || [];
        if (!ideaDetails) return base;
        const extras: string[] = [];
        if (ideaDetails.product?.coreFeatures?.[0]) {
            extras.push(`✨ How should I implement ${ideaDetails.product.coreFeatures[0]}?`);
        }
        if (ideaDetails.ideaMetadata?.ideaName) {
            extras.push(`✨ Design the data model for ${ideaDetails.ideaMetadata.ideaName}`);
        }
        if (ideaDetails.solution?.coreInnovation) {
            extras.push(`✨ What APIs do I need for ${ideaDetails.solution.coreInnovation}?`);
        }
        return [...extras, ...base];
    }, [currentContext, ideaDetails]);

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
            const summaryText = summaryMatch?.[1];
            if (summaryText) {
                localStorage.setItem(`akasha_chat_summary_${projectId}_${currentContext}`, summaryText.trim());
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
                setFsSize(() => ({
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

            // --- Context Injection of ideaDetails into AI Prompts ---
            let ideaContext = "";
            if (ideaDetails) {
                const parts: string[] = [];
                if (ideaDetails.ideaMetadata?.ideaName) parts.push(`This project is called "${ideaDetails.ideaMetadata.ideaName}".`);
                if (ideaDetails.ideaMetadata?.summary) parts.push(ideaDetails.ideaMetadata.summary);
                if (ideaDetails.problem?.problemStatement) parts.push(`Problem: ${ideaDetails.problem.problemStatement}.`);
                if (ideaDetails.solution?.coreInnovation) parts.push(`Solution: ${ideaDetails.solution.coreInnovation}.`);
                if (ideaDetails.product?.coreFeatures?.length) parts.push(`Core features: ${ideaDetails.product.coreFeatures.join(', ')}.`);
                if (ideaDetails.technicalArchitecture) {
                    const ta = ideaDetails.technicalArchitecture;
                    const stack = [ta.frontend, ta.backend, ta.database].filter(Boolean).join(', ');
                    if (stack) parts.push(`Tech stack: ${stack}.`);
                }
                if (parts.length) ideaContext = `\n[PROJECT CONTEXT: ${parts.join(' ')}]`;
            }

            if (newMessages.length === 1) {
                // First request, ask for summary
                contextInstruction = `\n\n[SYSTEM INSTRUCTION: You are assisting the user on the '${contextLabel}' page. Please consider this context. Also, at the very end of your response, output a brief summary of the conversation so far enclosed in <summary> tags.]${ideaContext}`;
            } else {
                // Subsequent requests, ask for updated summary
                contextInstruction = `\n\n[SYSTEM INSTRUCTION: Remember we are focused on the '${contextLabel}' context. At the end of your response, update the <summary> of our conversation.]${ideaContext}`;
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
                const token = (localStorage.getItem("akasha_token") || localStorage.getItem("token"))?.trim();
                if (storedKey) fetchHeaders["x-ai-api-key"] = storedKey;
                if (storedModel) fetchHeaders["x-ai-model"] = storedModel;
                if (storedBase) fetchHeaders["x-ai-api-base-url"] = storedBase;
                if (token) fetchHeaders["Authorization"] = `Bearer ${token}`;
            }

            const res = await fetch(endpoint, {
                method: "POST",
                headers: fetchHeaders,
                body: JSON.stringify(body),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || data.message || "Failed to get response");

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
            {/* Resize Handle */}
            {!isMobile && !isFullscreen && !isMaximized && (
                <div
                    onMouseDown={() => setIsResizingSide(true)}
                    className={`absolute top-0 bottom-0 w-2 cursor-col-resize hover:bg-cyan-500/20 active:bg-cyan-500/40 transition-all z-50 flex items-center justify-center group ${dockToRight ? "left-0" : "right-0"}`}
                >
                    <div className="w-[2px] h-12 bg-white/10 group-hover:bg-cyan-400 group-active:bg-cyan-400 rounded-full transition-all" />
                </div>
            )}

            <div
                className={`h-full flex flex-col bg-[#0b0b14]/95 backdrop-blur-2xl border border-white/10 overflow-hidden relative shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all duration-300 ${isMobile
                        ? "rounded-none border-0"
                        : isMaximized
                            ? "rounded-2xl"
                            : isFullscreen
                                ? "rounded-3xl shadow-[0_40px_120px_-20px_rgba(0,0,0,0.8),0_0_1px_rgba(255,255,255,0.2)]"
                                : `${dockToRight ? "rounded-l-3xl border-l" : "rounded-r-3xl border-r"} border-y-0 shadow-[-20px_0_60px_-15px_rgba(0,0,0,0.8)]`
                    }`}
            >
                {/* Floating Drag Indicator at very top */}
                {isFullscreen && !isMaximized && (
                    <div onMouseDown={handleMouseDown} className="flex justify-center pt-2 cursor-grab active:cursor-grabbing">
                        <div className="w-12 h-1 bg-white/20 rounded-full hover:bg-white/40 transition-colors" />
                    </div>
                )}

                {/* High-Fidelity Header */}
                <div 
                    onMouseDown={handleMouseDown}
                    className={`h-20 px-6 border-b border-white/[0.04] flex items-center justify-between bg-gradient-to-b from-white/[0.02] to-transparent select-none ${isFullscreen && !isMaximized ? "cursor-grab active:cursor-grabbing" : "cursor-default"}`}
                >
                    <div className="flex items-center gap-3.5 min-w-0">
                        {/* Akasha Sacred Geometry Avatar */}
                        <div className="relative flex-shrink-0">
                            <div className="absolute inset-0 bg-cyan-400/20 blur-xl rounded-full opacity-40"></div>
                            <div className="relative w-10 h-10 flex items-center justify-center">
                                <svg viewBox="0 0 40 40" width="40" height="40">
                                    <defs>
                                        <linearGradient id="akasha-hdr-grad" x1="0" y1="0" x2="1" y2="1">
                                            <stop offset="0%" stopColor="#22d3ee" />
                                            <stop offset="100%" stopColor="#6366f1" />
                                        </linearGradient>
                                    </defs>
                                    <circle cx="20" cy="20" r="16" fill="url(#akasha-hdr-grad)" opacity="0.9" />
                                    <circle cx="20" cy="20" r="19" fill="none" stroke="rgba(34,211,238,0.35)" strokeWidth="1" className="akasha-ring-spin" />
                                    <circle cx="20" cy="20" r="3.5" fill="white" opacity="0.95" />
                                </svg>
                            </div>
                        </div>
                        <div className="flex flex-col gap-0.5 min-w-0">
                            <span className="text-[12px] font-black text-white tracking-[0.2em] uppercase truncate">Akasha Assistant</span>
                            <div className="flex items-center gap-1.5 min-w-0">
                                <span className={`w-1.5 h-1.5 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.4)] animate-pulse ${ideaDetails ? "bg-emerald-500/80" : "bg-amber-500/80"}`}></span>
                                <span className="text-[9px] text-white/40 font-bold tracking-widest uppercase truncate">{currentContext} node • {ideaDetails ? "sync" : "no idea"}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3 flex-shrink-0">
                        {/* Interactive Context Dropdown Selector */}
                        <div className="relative group/ctx">
                            <button className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.06] hover:border-white/20 transition-all text-[10px] font-bold text-white/70 hover:text-white focus:outline-none whitespace-nowrap flex-shrink-0">
                                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.5)]"></span>
                                <span className="uppercase tracking-widest">{CONTEXTS.find(c => c.id === currentContext)?.label || currentContext}</span>
                                <svg className="w-3.5 h-3.5 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
                            </button>
                            <div className="absolute right-0 top-full mt-2 w-48 rounded-2xl bg-[#0f0f18]/95 border border-white/10 backdrop-blur-xl shadow-2xl p-1.5 hidden group-focus-within/ctx:block group-hover/ctx:block z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                                {CONTEXTS.map((ctx) => (
                                    <button
                                        key={ctx.id}
                                        onClick={() => setCurrentContext(ctx.id)}
                                        className={`w-full text-left px-3.5 py-2 rounded-xl text-[11px] font-semibold tracking-wide transition-all flex items-center gap-2.5 ${currentContext === ctx.id ? 'bg-white/10 text-cyan-300 font-bold' : 'text-white/50 hover:text-white hover:bg-white/[0.04]'}`}
                                    >
                                        <span className={`w-1.5 h-1.5 rounded-full ${currentContext === ctx.id ? 'bg-cyan-400 shadow-[0_0_6px_#22d3ee]' : 'bg-transparent'}`}></span>
                                        {ctx.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="h-6 w-[1px] bg-white/10 mx-1" />
                        
                        <div className="flex items-center gap-1">
                            {!isMobile && (
                                <>
                                    {/* Float / Dock Chat Toggle */}
                                    <button
                                        onClick={() => { setIsFullscreen(!isFullscreen); if (isMaximized) setIsMaximized(false); }}
                                        className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all group ${isFullscreen ? "text-cyan-400 bg-cyan-500/10 border border-cyan-500/20" : "text-white/20 hover:text-white hover:bg-white/5"}`}
                                        title={isFullscreen ? "Dock Chat to Sidebar" : "Float Chat Window"}
                                    >
                                        <svg className="w-4 h-4 opacity-40 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                        </svg>
                                    </button>
                                    
                                    {/* Maximize Toggle */}
                                    <button
                                        onClick={() => { setIsMaximized(!isMaximized); if (isFullscreen) setIsFullscreen(false); }}
                                        className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all group ${isMaximized ? "text-cyan-400 bg-cyan-500/10 border border-cyan-500/20" : "text-white/20 hover:text-white hover:bg-white/5"}`}
                                        title={isMaximized ? "Restore Size" : "Maximize Screen"}
                                    >
                                        <svg className="w-4 h-4 opacity-40 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>
                                    </button>
                                </>
                            )}
                            <button
                                onClick={onClose}
                                className="w-9 h-9 rounded-xl flex items-center justify-center text-white/20 hover:text-red-400 hover:bg-red-500/5 transition-all group"
                                title="Close"
                            >
                                <svg className="w-5 h-5 opacity-40 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Main Interaction Hub */}
                <div className="flex-1 overflow-hidden relative flex flex-col">
                    <div className="flex-1 overflow-y-auto px-8 py-10 space-y-8 custom-scrollbar scroll-smooth">
                        {messages.length === 0 && !isTyping && (
                            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto py-10">
                                {ideaDetails ? (
                                    /* --- Idea-Aware Smart Welcome Card --- */
                                    <>
                                        <div className="mb-6 relative group">
                                            <div className="absolute inset-0 bg-cyan-500/15 blur-[50px] rounded-full opacity-45 group-hover:opacity-75 transition-opacity duration-1000"></div>
                                            <AkashaAvatarMini size={72} pulse />
                                        </div>
                                        <div className="w-full p-6 rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] backdrop-blur-md mb-6 text-left space-y-3 shadow-xl shadow-black/20">
                                            <div className="flex items-center gap-3">
                                                <h2 className="text-white text-[15px] font-black tracking-wide">{ideaDetails.ideaMetadata?.ideaName || 'Your Project'}</h2>
                                                {ideaDetails.ideaMetadata?.category && (
                                                    <span className="px-2 py-0.5 rounded-md bg-cyan-500/15 border border-cyan-500/20 text-[9px] font-bold text-cyan-300 tracking-wider uppercase">{ideaDetails.ideaMetadata.category}</span>
                                                )}
                                            </div>
                                            {ideaDetails.ideaMetadata?.tagline && (
                                                <p className="text-white/60 text-[11.5px] italic font-medium">{ideaDetails.ideaMetadata.tagline}</p>
                                            )}
                                            {ideaDetails.ideaMetadata?.summary && (
                                                <p className="text-white/40 text-[11px] leading-relaxed line-clamp-3 font-normal">{ideaDetails.ideaMetadata.summary}</p>
                                            )}
                                        </div>
                                        <p className="text-cyan-300/80 text-[12px] font-bold mb-6 tracking-wider uppercase">
                                            I understand your project. How can I help you build it?
                                        </p>
                                        {/* Quick prompts */}
                                        <div className="flex flex-wrap gap-2 justify-center">
                                            {dynamicQuickPrompts.map((prompt, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => { setInput(prompt.replace(/^✨ /, '')); inputRef.current?.focus(); }}
                                                    className="px-4 py-2 rounded-xl text-[11px] font-semibold bg-[#131322]/50 hover:bg-[#18182f]/80 text-white/60 hover:text-white hover:scale-[1.02] border border-white/[0.05] hover:border-cyan-500/30 transition-all duration-200 active:scale-[0.98] shadow-sm"
                                                >
                                                    {prompt}
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    /* --- Enhanced Neural Link Active (no idea) --- */
                                    <>
                                        <div className="mb-8 relative group">
                                            <div className="absolute inset-0 bg-indigo-500/15 blur-[60px] rounded-full opacity-30 group-hover:opacity-50 transition-opacity duration-1000"></div>
                                            <AkashaAvatarMini size={80} />
                                        </div>
                                        <h2 className="text-white text-[16px] font-black tracking-[0.3em] uppercase mb-3">Neural Link Active</h2>
                                        <p className="text-white/40 text-[11.5px] leading-relaxed mb-6 font-medium tracking-wide">
                                            Awaiting instructions from the developer node. Ready for code injection, architectural analysis, or UI synthesis.
                                        </p>
                                        {/* Quick prompts */}
                                        <div className="flex flex-wrap gap-2 justify-center">
                                            {dynamicQuickPrompts.map((prompt, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => { setInput(prompt); inputRef.current?.focus(); }}
                                                    className="px-4 py-2 rounded-xl text-[11px] font-semibold bg-[#131322]/50 hover:bg-[#18182f]/80 text-white/60 hover:text-white hover:scale-[1.02] border border-white/[0.05] hover:border-cyan-500/30 transition-all duration-200 active:scale-[0.98] shadow-sm"
                                                >
                                                    {prompt}
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {messages.map((msg, idx) => {
                            const displayContent = msg.content
                                .replace(/<summary>[\s\S]*?<\/summary>/g, '')
                                .replace(/\*\*Summary:\*\*[\s\S]*?$/i, '')
                                .replace(/Summary:[\s\S]*?$/i, '')
                                .trim();
                                
                            return (
                                <div key={idx} className={`flex gap-4 group animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                                    {msg.role === "user" ? (
                                        <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 text-[9px] font-bold tracking-widest border transition-all group-hover:scale-105 bg-gradient-to-tr from-cyan-400 to-indigo-500 text-white border-white/10 shadow-lg shadow-cyan-500/5">
                                            USER
                                        </div>
                                    ) : (
                                        <AkashaAvatarMini size={40} pulse={idx === messages.length - 1} className="transition-all group-hover:scale-105" />
                                    )}
                                    <div className={`flex flex-col gap-2 max-w-[85%] ${msg.role === "user" ? "items-end" : "items-start"}`}>
                                        <div className={`px-5 py-4 rounded-[1.5rem] text-[13.5px] font-normal leading-[1.65] transition-all shadow-md ${msg.role === "user" 
                                            ? "bg-gradient-to-br from-indigo-600/25 to-violet-600/15 text-white rounded-tr-sm border border-indigo-500/30 shadow-indigo-950/20" 
                                            : "bg-[#131322]/80 text-white/90 border border-white/[0.06] rounded-tl-sm prose prose-invert prose-p:leading-relaxed max-w-full"}`}>
                                            {msg.role === "ai" && msg.structured ? (
                                                <StructuredAiResponseCard response={msg.structured} compact />
                                            ) : msg.role === "ai" ? (
                                                <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ code: CodeBlock }}>{displayContent}</ReactMarkdown>
                                            ) : displayContent}
                                        </div>
                                        {msg.role === "ai" && (
                                            <div className="flex gap-4 ml-1 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-1 group-hover:translate-y-0">
                                                <button 
                                                    onClick={() => copyToClipboard(displayContent, (fb) => setCopyFeedback(p => ({ ...p, [idx]: fb })))}
                                                    className="flex items-center gap-1.5 text-[9px] font-bold text-white/40 hover:text-white transition-colors uppercase tracking-widest"
                                                >
                                                    {copyFeedback[idx] ? (
                                                        <span className="flex items-center gap-1 text-emerald-400">
                                                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                                            Copied
                                                        </span>
                                                    ) : (
                                                        <>
                                                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                                                            Copy
                                                        </>
                                                    )}
                                                </button>
                                                <button 
                                                    onClick={() => { setInput(displayContent); inputRef.current?.focus(); }}
                                                    className="flex items-center gap-1.5 text-[9px] font-bold text-white/40 hover:text-white transition-colors uppercase tracking-widest"
                                                >
                                                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 10 20 15 15 20"></polyline><path d="M4 4v7a4 4 0 0 0 4 4h12"></path></svg>
                                                    Modify
                                                </button>
                                                
                                                {/* Styled Reaction Buttons */}
                                                <div className="flex gap-1.5 items-center pl-1 border-l border-white/5">
                                                    <button
                                                        onClick={() => setReactions(p => ({ ...p, [idx]: p[idx] === 'up' ? null : 'up' }))}
                                                        className={`flex items-center justify-center w-6 h-6 rounded-md border transition-all ${reactions[idx] === 'up' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.2)]' : 'border-transparent text-white/30 hover:text-emerald-400 hover:bg-emerald-500/5'}`}
                                                        title="Like"
                                                    >
                                                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill={reactions[idx] === 'up' ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.5"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
                                                    </button>
                                                    <button
                                                        onClick={() => setReactions(p => ({ ...p, [idx]: p[idx] === 'down' ? null : 'down' }))}
                                                        className={`flex items-center justify-center w-6 h-6 rounded-md border transition-all ${reactions[idx] === 'down' ? 'border-red-500/30 bg-red-500/10 text-red-400 shadow-[0_0_8px_rgba(239,68,68,0.2)]' : 'border-transparent text-white/30 hover:text-red-400 hover:bg-red-500/5'}`}
                                                        title="Dislike"
                                                    >
                                                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill={reactions[idx] === 'down' ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.5"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"></path></svg>
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        {isTyping && (
                            <div className="flex gap-4 items-start animate-pulse">
                                <AkashaAvatarMini size={40} />
                                <div className="px-5 py-4 rounded-[1.5rem] bg-[#131322]/80 border border-white/[0.06] rounded-tl-sm flex items-center gap-3 shadow-md">
                                    <svg viewBox="0 0 24 24" className="w-4 h-4 animate-spin text-cyan-400" fill="none" stroke="currentColor" strokeWidth="3.5">
                                        <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.08)" strokeWidth="3.5" />
                                        <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeDasharray="16" />
                                    </svg>
                                    <span className="text-[11px] text-white/50 font-semibold tracking-wider">Akasha is thinking...</span>
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    {/* Command Console */}
                    <div className="px-6 py-5 bg-gradient-to-t from-[#0a0a0f] via-[#0a0a0f]/95 to-transparent border-t border-white/[0.04]">
                        <div className="relative group">
                            <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500/10 via-indigo-500/10 to-transparent rounded-[1.8rem] blur opacity-0 group-focus-within:opacity-100 transition duration-700"></div>
                            <div className="relative flex items-end gap-3 bg-[#11111a]/85 border border-white/10 rounded-[1.5rem] p-3 pl-6 shadow-2xl transition-all focus-within:border-cyan-500/30 focus-within:shadow-[0_0_25px_-5px_rgba(34,211,238,0.15)] focus-within:bg-[#11111a]">
                                <textarea
                                    ref={inputRef}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                                    placeholder="Message Akasha..."
                                    rows={1}
                                    className="flex-1 min-h-[44px] max-h-48 bg-transparent border-none py-2.5 text-[14.5px] text-white placeholder:text-white/20 focus:ring-0 focus:outline-none resize-none font-mono selection:bg-white/20 scrollbar-none"
                                />
                                <div className="flex items-center gap-2 pb-1 pr-1">
                                    <button 
                                        onClick={handleClearChat}
                                        className="w-9 h-9 rounded-xl flex items-center justify-center text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all active:scale-95"
                                        title="Clear Memory"
                                    >
                                        <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                    </button>
                                    
                                    {/* Voice Input Placeholder */}
                                    <div className="relative">
                                        <button
                                            onClick={() => { setVoiceToast(true); setTimeout(() => setVoiceToast(false), 2500); }}
                                            className="w-9 h-9 rounded-xl flex items-center justify-center text-white/20 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all active:scale-95"
                                            title="Voice Input"
                                        >
                                            <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="9" y="1" width="6" height="11" rx="3"></rect><path d="M19 10v1a7 7 0 0 1-14 0v-1"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
                                        </button>
                                        {voiceToast && (
                                            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 whitespace-nowrap px-3 py-1.5 rounded-lg bg-black/95 border border-white/10 text-[10px] text-white/70 font-semibold shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-200">
                                                🎙️ Voice input coming soon
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={handleSend}
                                        disabled={!input.trim() || isTyping}
                                        className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-indigo-500 text-white flex items-center justify-center hover:from-cyan-300 hover:to-indigo-400 hover:shadow-[0_0_15px_rgba(34,211,238,0.3)] transition-all disabled:opacity-10 active:scale-95"
                                    >
                                        <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
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
                    .animate-chat-in-right { animation: chat-in-right 0.4s cubic-bezier(0.16, 1, 0.3, 1) both; }
                    .animate-chat-in-left { animation: chat-in-left 0.4s cubic-bezier(0.16, 1, 0.3, 1) both; }
                    .animate-chat-in-mobile { animation: chat-in-mobile 0.4s cubic-bezier(0.16, 1, 0.3, 1) both; }
                    .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                    .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.08); border-radius: 10px; }
                    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.15); }
                    ::selection { background: rgba(34, 211, 238, 0.15); color: white; }
                    .scrollbar-none::-webkit-scrollbar { display: none; }

                    /* Akasha ring spin animation */
                    .akasha-ring-spin { animation: akasha-spin 8s linear infinite; transform-origin: center; }
                    @keyframes akasha-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                `}</style>
            </div>
        </div>
    );
};

export default BotChat;
