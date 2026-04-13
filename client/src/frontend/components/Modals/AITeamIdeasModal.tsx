import React, { useState, useEffect } from "react";
import Modal from "../ui/Modal";
import { useToast } from "../../context/ToastContext";

interface AITeamIdeasModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const API_BASE = "http://localhost:3001/api/ai";

const AITeamIdeasModal: React.FC<AITeamIdeasModalProps> = ({ isOpen, onClose }) => {
    const toast = useToast();
    const [ideas, setIdeas] = useState<any[]>([]);
    const [bestIdea, setBestIdea] = useState<any>(null);
    const [pipelineResult, setPipelineResult] = useState<any>(null);
    const [input, setInput] = useState("");
    const [sessionId, setSessionId] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [status, setStatus] = useState<string | null>(null);
    const [, setTeam] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            let sid = localStorage.getItem("akasha_user_session");
            if (!sid) {
                sid = "akasha_user_" + Date.now().toString();
                localStorage.setItem("akasha_user_session", sid);
            }
            setSessionId(sid);

            fetch(`${API_BASE}/status?sessionId=${sid}`)
                .then(res => res.json())
                .then(data => {
                    setTeam(data.team);
                    setStatus(data.status);

                    if (data.status === 'admin' || data.status === 'member') {
                        fetch(`${API_BASE}/register`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ username: "AkashaUser", sessionId: sid })
                        }).catch(console.error);
                    }
                })
                .catch(console.error);
        }
    }, [isOpen]);

    const fetchIdeas = async () => {
        if (!sessionId) return;
        try {
            const res = await fetch(`${API_BASE}/ideas?sessionId=${sessionId}`);
            const data = await res.json();
            setIdeas(data.reverse());
        } catch (err) { }
    };

    const fetchBest = async () => {
        if (!sessionId) return;
        try {
            const res = await fetch(`${API_BASE}/top-ideas?sessionId=${sessionId}&limit=1`);
            const data = await res.json();
            if (data && data.length > 0) {
                setBestIdea(data[0]);
                if (data[0].pipelineStatus === 'done') {
                    fetchPipelineResult(data[0].id);
                } else {
                    setPipelineResult(null);
                }
            } else {
                setBestIdea(null);
                setPipelineResult(null);
            }
        } catch (err) { }
    }

    const fetchPipelineResult = async (ideaId: string) => {
        try {
            const res = await fetch(`${API_BASE}/pipeline-result?sessionId=${sessionId}&ideaId=${ideaId}`);
            const data = await res.json();
            setPipelineResult(data);
        } catch (err) { }
    }

    useEffect(() => {
        if (!isOpen) return;
        fetchIdeas();
        fetchBest();
        const interval = setInterval(() => {
            fetchIdeas();
            fetchBest();
        }, 3000);
        return () => clearInterval(interval);
    }, [isOpen]);

    const handleSubmit = async () => {
        if (!input.trim() || !sessionId) return;
        setIsSubmitting(true);
        try {
            await fetch(`${API_BASE}/submit-idea`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ idea: input.trim(), sessionId })
            });
            setInput("");
            fetchIdeas();
        } catch (err: any) {
            toast.showToast(`Submission Error: ${err.message}`, "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleTriggerPipeline = async () => {
        if (!bestIdea || !sessionId) return;
        try {
            await fetch(`${API_BASE}/trigger-pipeline`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ideaId: bestIdea.id, sessionId })
            });
            toast.showToast("Pipeline started. It usually takes 10-20 seconds.", "success");
            fetchBest();
        } catch (err: any) {
            toast.showToast(`Pipeline Error: ${err.message}`, "error");
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Team Startup Ideas ${localStorage.getItem("akasha_team") ? `(${localStorage.getItem("akasha_team")})` : ""}`}
            size="xl"
            className="bg-[#0f111a] border-[#0ea5e9]/20 shadow-[0_0_50px_rgba(14,165,233,0.1)] h-[85vh] flex flex-col"
        >
            <div className="flex flex-1 h-full overflow-hidden absolute inset-0 pt-16">

                {/* Left Sidebar: Best Idea */}
                <div className="w-[300px] border-r border-white/5 bg-[#0b0c13] p-6 flex flex-col shrink-0 overflow-y-auto custom-scrollbar">
                    <div className="bg-gradient-to-br from-[#0ea5e9]/10 to-transparent border border-[#0ea5e9]/30 rounded-2xl p-5 mb-6">
                        <h3 className="text-xs font-black text-[#0ea5e9] uppercase tracking-widest mb-4 flex items-center gap-2">
                            🏆 Top Idea
                        </h3>
                        {!bestIdea ? (
                            <p className="text-xs text-white/30 italic">No ideas evaluated yet.</p>
                        ) : (
                            <div className="space-y-4">
                                <p className="text-sm font-medium text-white line-clamp-4 leading-relaxed">{bestIdea.idea}</p>
                                <div className="pt-4 border-t border-white/10">
                                    <div className="text-xs text-white/50 mb-1">Score</div>
                                    <div className="text-3xl font-black text-[#10b981]">{bestIdea.evaluation?.final_score || bestIdea.evaluation?.overallScore || '?'}<span className="text-lg text-white/30">/10</span></div>
                                </div>
                                <div className="pt-4">
                                    {bestIdea.pipelineStatus === 'none' && status === 'admin' && (
                                        <button
                                            onClick={handleTriggerPipeline}
                                            className="w-full py-2 bg-[#0ea5e9]/20 hover:bg-[#0ea5e9]/40 text-[#0ea5e9] border border-[#0ea5e9]/30 rounded-lg text-xs font-bold transition-all"
                                        >
                                            Generate Full Spec (AI Pipeline)
                                        </button>
                                    )}
                                    {bestIdea.pipelineStatus === 'running' && (
                                        <div className="text-xs text-[#0ea5e9] animate-pulse flex items-center gap-2 justify-center py-2 border border-[#0ea5e9]/20 rounded-lg bg-[#0ea5e9]/5">
                                            <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                            Pipeline Running...
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {pipelineResult && (
                        <div className="space-y-6 pb-6">
                            <div>
                                <h4 className="text-[10px] uppercase font-bold text-white/40 tracking-wider mb-2">Domains</h4>
                                <div className="flex flex-wrap gap-2">
                                    {(pipelineResult.result?.categories || []).map((c: string) => (
                                        <span key={c} className="px-2 py-1 bg-white/5 border border-white/10 rounded text-[10px] text-white/70">{c}</span>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <h4 className="text-[10px] uppercase font-bold text-white/40 tracking-wider mb-2">Core Features</h4>
                                <ul className="text-xs space-y-1 text-white/80 list-disc list-inside">
                                    {(pipelineResult.result?.features?.core || []).map((f: string, i: number) => <li key={`cf-${i}`}>{f}</li>)}
                                </ul>
                            </div>
                            <div>
                                <h4 className="text-[10px] uppercase font-bold text-white/40 tracking-wider mb-2">Requirements</h4>
                                <ul className="text-xs space-y-1 text-white/60 list-disc list-inside">
                                    {(pipelineResult.result?.requirements?.functional || []).slice(0, 5).map((r: string, i: number) => <li key={`rf-${i}`}>{r}</li>)}
                                </ul>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Area: Feed & Input */}
                <div className="flex-1 flex flex-col min-w-0 bg-[#0a0a0f]">
                    <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
                        {ideas.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-[50vh] text-white/30 text-sm">
                                <span className="text-3xl mb-3">💡</span>
                                No startup ideas submitted. Be the first!
                            </div>
                        ) : (
                            ideas.map((item, idx) => (
                                <div key={idx} className="bg-[#161822] border border-white/5 rounded-2xl p-6 animate-fade-in">
                                    <div className="flex justify-between items-center mb-4">
                                        <div className="flex items-center gap-2 text-sm font-bold text-white">
                                            <div className="w-6 h-6 rounded-full bg-[#0ea5e9] text-[10px] flex items-center justify-center text-black">A</div>
                                            {item.username}
                                            {bestIdea?.id === item.id && (
                                                <span className="ml-2 px-2 py-0.5 bg-[#10b981]/20 text-[#10b981] rounded text-[9px] uppercase tracking-wider border border-[#10b981]/30">Top Idea</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {item.pipelineStatus && item.pipelineStatus !== 'none' && (
                                                <div className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded 
                                                    ${item.pipelineStatus === 'done' ? 'bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/20' : 
                                                    item.pipelineStatus === 'running' ? 'bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/20 animate-pulse' : 
                                                    item.pipelineStatus === 'error' ? 'bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/20' : 
                                                    'bg-white/5 text-white/40'}`}>
                                                    Pipeline: {item.pipelineStatus}
                                                </div>
                                            )}
                                            <div className="text-[10px] text-white/30 font-black uppercase tracking-wider">
                                                {new Date(item.createdAt || item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                    </div>

                                    <p className="text-[15px] leading-relaxed text-[#e2e8f0] mb-6 whitespace-pre-wrap">{item.idea}</p>

                                    {!item.evaluation ? (
                                        <div className="bg-[#0b0c13] rounded-xl p-4 border border-white/5 flex items-center gap-3 text-xs text-white/50">
                                            <div className="w-4 h-4 border-2 border-white/10 border-t-[#0ea5e9] rounded-full animate-spin" />
                                            AI Evaluation in progress...
                                        </div>
                                    ) : (
                                        <div className="bg-[#0b0c13] border border-white/5 border-l-2 border-l-[#0ea5e9] rounded-xl p-5">
                                            <div className="text-[10px] font-black text-[#0ea5e9] uppercase tracking-widest mb-4">✦ AI Evaluator Report</div>

                                            <div className="grid grid-cols-3 gap-4 mb-5 pb-5 border-b border-white/5">
                                                <div>
                                                    <div className="text-[10px] text-white/40 uppercase tracking-widest mb-1">Feasibility</div>
                                                    <div className={`text-xl font-black ${item.evaluation.feasibility >= 8 ? "text-[#10b981]" : item.evaluation.feasibility >= 5 ? "text-[#f59e0b]" : "text-[#ef4444]"}`}>
                                                        {item.evaluation.feasibility}/10
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-[10px] text-white/40 uppercase tracking-widest mb-1">Innovation</div>
                                                    <div className={`text-xl font-black ${item.evaluation.innovation >= 8 ? "text-[#10b981]" : item.evaluation.innovation >= 5 ? "text-[#f59e0b]" : "text-[#ef4444]"}`}>
                                                        {item.evaluation.innovation}/10
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-[10px] text-white/40 uppercase tracking-widest mb-1">Market</div>
                                                    <div className={`text-xl font-black ${item.evaluation.marketPotential >= 8 ? "text-[#10b981]" : item.evaluation.marketPotential >= 5 ? "text-[#f59e0b]" : "text-[#ef4444]"}`}>
                                                        {item.evaluation.marketPotential}/10
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="text-[13px] text-white/70 leading-relaxed mb-5">{item.evaluation.summary}</div>

                                            <div className="grid grid-cols-2 gap-6 mb-5 text-[12px]">
                                                <div>
                                                    <div className="font-bold text-white mb-2">Strengths</div>
                                                    <ul className="text-white/50 space-y-1 list-disc list-inside">
                                                        {(item.evaluation.strengths || []).map((s: string, i: number) => <li key={i}>{s}</li>)}
                                                    </ul>
                                                </div>
                                                <div>
                                                    <div className="font-bold text-white mb-2">Weaknesses</div>
                                                    <ul className="text-white/50 space-y-1 list-disc list-inside">
                                                        {(item.evaluation.weaknesses || []).map((w: string, i: number) => <li key={i}>{w}</li>)}
                                                    </ul>
                                                </div>
                                            </div>

                                            <div className="text-[12px] text-white/60 bg-[#161822] p-3 rounded-lg border border-white/5">
                                                <strong className="text-white">Next Steps:</strong> {(item.evaluation.recommendedNextSteps || []).join(' → ')}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>

                    {/* Submission Box */}
                    <div className="bg-[#0b0c13] border-t border-white/5 p-6 flex gap-4">
                        {status === 'admin' || status === 'member' ? (
                            <>
                                <textarea
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder="Pitch a new startup idea to the team..."
                                    className="flex-1 bg-[#161822] border border-white/10 rounded-xl p-4 min-h-[80px] text-[14px] text-white placeholder:text-white/30 focus:outline-none focus:border-[#0ea5e9]/50 focus:ring-1 focus:ring-[#0ea5e9]/50 resize-y"
                                />
                                <button
                                    onClick={handleSubmit}
                                    disabled={!input.trim() || isSubmitting}
                                    className="px-8 bg-[#0ea5e9] hover:bg-[#0284c7] disabled:opacity-50 text-black font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-[0_4px_20px_rgba(14,165,233,0.3)]"
                                >
                                    {isSubmitting ? "Sending..." : "Submit"}
                                </button>
                            </>
                        ) : (
                            <div className="flex-1 text-center py-2">
                                <p className="text-xs text-[#0ea5e9] font-black uppercase tracking-widest">
                                    {status === 'pending' ? "Waiting for team admin approval to submit ideas..." : "You must join a team to see and share ideas."}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default AITeamIdeasModal;
