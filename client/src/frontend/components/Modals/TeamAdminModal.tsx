import React, { useState, useEffect } from "react";
import Modal from "../ui/Modal";
import { useToast } from "../../context/ToastContext";

interface TeamAdminModalProps {
    isOpen: boolean;
    onClose: () => void;
    teamName: string;
}

const API_BASE = "http://localhost:3001/api/ai";

const TeamAdminModal: React.FC<TeamAdminModalProps> = ({ isOpen, onClose, teamName }) => {
    const toast = useToast();
    const [pendingRequests, setPendingRequests] = useState<any[]>([]);
    const [members, setMembers] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchData = async () => {
        const sessionId = localStorage.getItem("akasha_user_session");
        if (!sessionId) return;

        try {
            const res = await fetch(`${API_BASE}/admin-data?sessionId=${sessionId}`);
            const data = await res.json();
            if (res.ok) {
                setPendingRequests(data.pendingRequests || []);
                setMembers(data.members || []);
            }
        } catch (err) {
            console.error("Failed to fetch admin data", err);
        }
    };

    useEffect(() => {
        let interval: any;
        if (isOpen) {
            fetchData();
            interval = setInterval(fetchData, 3000);
        }
        return () => clearInterval(interval);
    }, [isOpen]);

    const handleResolve = async (userSessionId: string, action: "approve" | "reject") => {
        const adminSessionId = localStorage.getItem("akasha_user_session");
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/resolve-request`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ adminSessionId, userSessionId, action })
            });
            if (res.ok) {
                toast.showToast(`Request ${action === 'approve' ? 'approved' : 'rejected'}`, "success");
                fetchData();
            } else {
                const data = await res.json();
                toast.showToast(data.error || "Action failed", "error");
            }
        } catch (err: any) {
            toast.showToast(err.message, "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Manage Team: ${teamName}`}
            size="md"
            className="bg-[#0f111a] border-indigo-500/20 shadow-[0_0_50px_rgba(99,102,241,0.1)]"
        >
            <div className="p-6 space-y-8">
                {/* Pending Requests */}
                <section>
                    <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-4">Pending Requests ({pendingRequests.length})</h3>
                    <div className="space-y-3">
                        {pendingRequests.length === 0 ? (
                            <p className="text-xs text-white/30 italic">No pending requests.</p>
                        ) : (
                            pendingRequests.map((req) => (
                                <div key={req.sessionId} className="flex items-center justify-between bg-[#161822] p-3 rounded-xl border border-white/5">
                                    <span className="text-sm font-bold text-white">{req.username}</span>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleResolve(req.sessionId, "approve")}
                                            disabled={loading}
                                            className="px-3 py-1 bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-white rounded-lg text-[10px] font-black uppercase transition-all"
                                        >
                                            Approve
                                        </button>
                                        <button
                                            onClick={() => handleResolve(req.sessionId, "reject")}
                                            disabled={loading}
                                            className="px-3 py-1 bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white rounded-lg text-[10px] font-black uppercase transition-all"
                                        >
                                            Reject
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </section>

                {/* Members List */}
                <section>
                    <h3 className="text-xs font-black text-white/40 uppercase tracking-widest mb-4">Team Members</h3>
                    <div className="space-y-2">
                        {members.map((m) => (
                            <div key={m.sessionId} className="flex items-center gap-3 text-sm">
                                <div className={`w-2 h-2 rounded-full ${m.isAdmin ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]' : 'bg-white/20'}`} />
                                <span className="text-white font-medium">{m.username}</span>
                                {m.isAdmin && <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest ml-auto">Admin</span>}
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </Modal>
    );
};

export default TeamAdminModal;
