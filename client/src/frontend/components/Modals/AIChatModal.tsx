import React, { useState, useEffect, useRef } from "react";
import Modal from "../ui/Modal";
import { useToast } from "../../context/ToastContext";
import StructuredAiResponseCard from "../ui/StructuredAiResponse";
import { normalizeAiResponse, type StructuredAiResponse } from "../../utils/aiResponse";

interface AIChatModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface ChatMessage {
    role: "user" | "ai";
    content: string;
    structured?: StructuredAiResponse;
}

const API_BASE = "http://localhost:3001/api/ai";

const AIChatModal: React.FC<AIChatModalProps> = ({ isOpen, onClose }) => {
    const toast = useToast();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const [sessionId, setSessionId] = useState<string>("");
    const [status, setStatus] = useState<string | null>(null);
    const [, setTeam] = useState<string | null>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Initialize session from localStorage
    useEffect(() => {
        if (isOpen) {
            let sid = localStorage.getItem("akasha_user_session");
            if (!sid) {
                sid = "akasha_user_" + Date.now().toString();
                localStorage.setItem("akasha_user_session", sid);
            }
            setSessionId(sid);

            // Fetch team status
            fetch(`${API_BASE}/status?sessionId=${sid}`)
                .then(res => res.json())
                .then(data => {
                    setTeam(data.team);
                    setStatus(data.status);

                    if (data.status === 'admin' || data.status === 'member') {
                        // Register session quietly
                        fetch(`${API_BASE}/register`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ username: "AkashaUser", sessionId: sid })
                        }).then(() => {
                            // Fetch existing team history
                            fetch(`${API_BASE}/chat-history?sessionId=${sid}`)
                                .then(res => res.json())
                                .then(chatData => {
                                    const formatted = chatData.map((m: any) => ({
                                        role: m.role === 'user' ? 'user' : 'ai',
                                        content: m.content
                                    }));
                                    setMessages(formatted);
                                })
                                .catch(console.error);
                        });
                    }
                })
                .catch(console.error);
        }
    }, [isOpen]);

    // Auto scroll
    useEffect(() => {
        if (chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, isTyping]);

    const handleSend = async () => {
        if (!input.trim() || !sessionId) return;

        const userMsg = input.trim();
        setMessages(prev => [...prev, { role: "user", content: userMsg }]);
        setInput("");
        setIsTyping(true);

        try {
            const res = await fetch(`${API_BASE}/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: userMsg, sessionId })
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || "Failed to get response");

            const structured = normalizeAiResponse(data);
            setMessages(prev => [...prev, { role: "ai", content: structured.answer_markdown, structured }]);
        } catch (err: any) {
            toast.showToast(`AI Chat Error: ${err.message}`, "error");
            setMessages(prev => [...prev, { role: "ai", content: "⚠️ Connection to model failed." }]);
        } finally {
            setIsTyping(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Individual AI Chat ${localStorage.getItem("akasha_team") ? `(${localStorage.getItem("akasha_team")})` : ""}`}
            size="lg"
            className="bg-[#0f111a] border-indigo-500/20 shadow-[0_0_50px_rgba(99,102,241,0.1)] h-[80vh] flex flex-col"
        >
            <div className="flex-1 flex flex-col h-full overflow-hidden absolute inset-0 pt-16 pb-[80px]">

                {/* Chat History Area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                    {messages.length === 0 && !isTyping && (
                        <div className="flex flex-col items-center justify-center h-full text-[var(--ide-text-muted)] animate-fade-in opacity-50">
                            <span className="text-5xl mb-4 drop-shadow-[0_0_15px_rgba(99,102,241,0.5)]">✦</span>
                            <p className="text-sm">Ask Gemma anything</p>
                        </div>
                    )}

                    {messages.map((msg, idx) => (
                        <div key={idx} className={`flex gap-4 animate-fade-in ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs ${msg.role === "user" ? "bg-indigo-500 text-white shadow-[0_0_10px_rgba(99,102,241,0.3)]" : "bg-[#1e2130] text-indigo-400 border border-indigo-500/30"
                                }`}>
                                {msg.role === "user" ? "👤" : "✦"}
                            </div>
                            <div className={`max-w-[80%] p-4 rounded-2xl text-[14px] leading-relaxed whitespace-pre-wrap font-medium ${msg.role === "user"
                                ? "bg-indigo-500 text-white rounded-tr-none shadow-md"
                                : "bg-[#161822] text-white border border-white/5 rounded-tl-none"
                                }`}>
                                {msg.role === "ai" && msg.structured ? (
                                    <StructuredAiResponseCard response={msg.structured} compact />
                                ) : (
                                    msg.content
                                )}
                            </div>
                        </div>
                    ))}

                    {isTyping && (
                        <div className="flex gap-4 animate-fade-in flex-row">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs bg-[#1e2130] text-indigo-400 border border-indigo-500/30">✦</div>
                            <div className="p-4 rounded-2xl bg-[#161822] border border-white/5 rounded-tl-none flex items-center gap-1.5 py-5">
                                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>

                {/* Fixed Input Bottom Bar */}
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-[#0b0c13] border-t border-white/5">
                    {status === 'admin' || status === 'member' ? (
                        <div className="flex gap-3 max-w-4xl mx-auto">
                            <textarea
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
                                }}
                                placeholder="Type a message..."
                                className="flex-1 bg-[#161822] border border-white/10 rounded-xl px-4 py-3 h-[50px] resize-none focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 custom-scrollbar text-sm"
                            />
                            <button
                                onClick={handleSend}
                                disabled={!input.trim() || isTyping}
                                className="w-[50px] h-[50px] rounded-xl bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:hover:bg-indigo-500 flex items-center justify-center transition-all shadow-lg hover:shadow-indigo-500/25"
                            >
                                <svg className="w-5 h-5 text-white translate-x-px" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                            </button>
                        </div>
                    ) : (
                        <div className="max-w-4xl mx-auto text-center py-2">
                            <p className="text-xs text-amber-500 font-bold uppercase tracking-widest">
                                {status === 'pending' ? "Waiting for team admin approval..." : "You must join a team to chat."}
                            </p>
                        </div>
                    )}
                </div>

            </div>
        </Modal>
    );
};

export default AIChatModal;
