/**
 * BotChat — Chat panel anchored near the floating bot
 * 
 * Sends messages to /api/ai/project-chat with project context
 */

import React, { useState, useRef, useEffect } from "react";
import StructuredAiResponseCard from "../Shared/StructuredAiResponse";
import { normalizeAiResponse, type StructuredAiResponse } from "../../utils/aiResponse";

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

const BotChat: React.FC<BotChatProps> = ({ onClose, projectId, projectName, anchorX, anchorY }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Calculate panel position — open above/below/left/right based on bot position
    const panelWidth = 380;
    const panelHeight = 500;
    const isNearBottom = anchorY > window.innerHeight - panelHeight - 80;
    const isNearRight = anchorX > window.innerWidth - panelWidth - 40;

    const panelStyle: React.CSSProperties = {
        position: 'fixed',
        width: panelWidth,
        height: panelHeight,
        zIndex: 9998,
        left: isNearRight ? anchorX - panelWidth - 10 : anchorX + 10,
        top: isNearBottom ? anchorY - panelHeight - 10 : anchorY + 40,
    };

    // Auto scroll
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isTyping]);

    // Focus input on mount
    useEffect(() => {
        setTimeout(() => inputRef.current?.focus(), 100);
    }, []);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMsg = input.trim();
        const newMessages = [...messages, { role: "user" as const, content: userMsg }];
        setMessages(newMessages);
        setInput("");
        setIsTyping(true);

        try {
            const endpoint = projectId ? `${API_BASE}/project-chat` : `${API_BASE}/simple-chat`;
            const body = projectId
                ? { message: userMsg, projectId, history: newMessages }
                : { message: userMsg };

            const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to get response");

            const structured = normalizeAiResponse(data);
            setMessages(prev => [...prev, { role: "ai", content: structured.answer_markdown, structured }]);
        } catch (err: any) {
            setMessages(prev => [...prev, { role: "ai", content: `⚠️ ${err.message || "Connection failed"}` }]);
        } finally {
            setIsTyping(false);
        }
    };

    return (
        <div style={panelStyle} className="animate-scale-in">
            <div className="h-full flex flex-col bg-[#0c0e18] border border-white/10 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.6),0_0_30px_rgba(99,102,241,0.15)] overflow-hidden backdrop-blur-xl">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5 bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                            <div className="flex flex-col items-center">
                                <div className="flex gap-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                </div>
                                <div className="w-3 h-1 rounded-full border-b border-white/80 mt-0.5" />
                            </div>
                        </div>
                        <div>
                            <h3 className="text-xs font-bold text-white">Akasha AI</h3>
                            <p className="text-[9px] text-white/30 font-medium">
                                {projectName ? `Context: ${projectName}` : 'General Chat'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/30 hover:text-white transition-all"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                    {messages.length === 0 && !isTyping && (
                        <div className="flex flex-col items-center justify-center h-full text-center opacity-40">
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500/20 to-indigo-500/20 border border-white/5 flex items-center justify-center mb-4">
                                <div className="flex flex-col items-center">
                                    <div className="flex gap-1.5 mb-0.5">
                                        <div className="w-2 h-2 rounded-full bg-white/40" />
                                        <div className="w-2 h-2 rounded-full bg-white/40" />
                                    </div>
                                    <div className="w-4 h-1 rounded-full border-b-2 border-white/30" />
                                </div>
                            </div>
                            <p className="text-xs text-white/40 font-medium">
                                {projectName ? `Ask me anything about "${projectName}"` : "Ask me anything"}
                            </p>
                            <p className="text-[10px] text-white/20 mt-1">I have context of your project idea</p>
                        </div>
                    )}

                    {messages.map((msg, idx) => (
                        <div key={idx} className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] ${msg.role === "user"
                                    ? "bg-indigo-500 text-white"
                                    : "bg-white/5 text-cyan-400 border border-cyan-500/20"
                                }`}>
                                {msg.role === "user" ? "👤" : "🤖"}
                            </div>
                            <div className={`max-w-[85%] px-3.5 py-2.5 rounded-xl text-[13px] leading-relaxed ${msg.role === "user"
                                    ? "bg-indigo-500 text-white rounded-tr-none"
                                    : "bg-white/[0.04] text-white/85 border border-white/5 rounded-tl-none"
                                }`} style={{ whiteSpace: msg.role === "user" ? "pre-wrap" : "normal" }}>
                                {msg.role === "ai" && msg.structured ? (
                                    <StructuredAiResponseCard response={msg.structured} compact />
                                ) : (
                                    msg.content
                                )}
                            </div>
                        </div>
                    ))}

                    {isTyping && (
                        <div className="flex gap-2.5">
                            <div className="w-6 h-6 rounded-full bg-white/5 text-cyan-400 border border-cyan-500/20 flex items-center justify-center text-[10px]">🤖</div>
                            <div className="px-3.5 py-3 rounded-xl bg-white/[0.04] border border-white/5 rounded-tl-none flex items-center gap-1">
                                <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>

                {/* Input */}
                <div className="p-3 border-t border-white/5 bg-white/[0.01]">
                    <div className="flex gap-2">
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
                            placeholder="Type a message..."
                            rows={1}
                            className="flex-1 bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-cyan-500/40 resize-none"
                        />
                        <button
                            onClick={handleSend}
                            disabled={!input.trim() || isTyping}
                            className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-600 hover:opacity-90 disabled:opacity-30 flex items-center justify-center transition-all shadow-lg shadow-cyan-500/20"
                        >
                            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes scale-in { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
                .animate-scale-in { animation: scale-in 0.2s ease-out both; }
            `}</style>
        </div>
    );
};

export default BotChat;
