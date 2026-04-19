/**
 * CreateRepoModal — Modal for creating a new GitHub repository
 */

import React, { useState } from "react";

interface CreateRepoModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (name: string, description: string, isPrivate: boolean) => Promise<void>;
}

const CreateRepoModal: React.FC<CreateRepoModalProps> = ({ isOpen, onClose, onSubmit }) => {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [isPrivate, setIsPrivate] = useState(false);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        setCreating(true);
        setError(null);
        try {
            await onSubmit(name.trim(), description.trim(), isPrivate);
            setName("");
            setDescription("");
            setIsPrivate(false);
            onClose();
        } catch (err) {
            setError(String(err));
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />

            {/* Modal */}
            <div className="relative w-full max-w-md bg-[#111116] border border-white/[0.08] rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] animate-scale-in overflow-hidden">
                {/* Ambient glow */}
                <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-40 h-40 bg-emerald-500/10 blur-[80px] pointer-events-none" />

                {/* Header */}
                <div className="relative px-6 pt-6 pb-4 border-b border-white/[0.06]">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
                                <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-white">Create Repository</h3>
                                <p className="text-[10px] text-white/40 mt-0.5">New repo on GitHub</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="relative px-6 py-5 space-y-4">
                    {/* Repo name */}
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-white/50 block mb-2">
                            Repository Name <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value.replace(/[^a-zA-Z0-9._-]/g, '-'))}
                            placeholder="my-awesome-project"
                            className="w-full h-10 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-500/10 transition-all"
                            autoFocus
                            required
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-white/50 block mb-2">
                            Description
                        </label>
                        <input
                            type="text"
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="A short description of your repository"
                            className="w-full h-10 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/20 transition-all"
                        />
                    </div>

                    {/* Visibility */}
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-white/50 block mb-3">
                            Visibility
                        </label>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setIsPrivate(false)}
                                className={`flex-1 h-11 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                                    !isPrivate
                                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                                        : "border-white/[0.06] bg-white/[0.02] text-white/40 hover:bg-white/[0.04]"
                                }`}
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Public
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsPrivate(true)}
                                className={`flex-1 h-11 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                                    isPrivate
                                        ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                                        : "border-white/[0.06] bg-white/[0.02] text-white/40 hover:bg-white/[0.04]"
                                }`}
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                                Private
                            </button>
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-xs text-red-300">
                            {error}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 h-10 rounded-xl border border-white/[0.08] text-xs font-bold text-white/50 hover:text-white hover:bg-white/[0.04] transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!name.trim() || creating}
                            className="flex-1 h-10 rounded-xl bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {creating ? (
                                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                                </svg>
                            )}
                            {creating ? "Creating..." : "Create Repository"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateRepoModal;
