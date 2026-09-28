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
            <div className="relative w-full max-w-md bg-white/90 dark:bg-black/85 backdrop-blur-2xl border border-black/10 dark:border-white/10 rounded-3xl shadow-2xl animate-scale-in overflow-hidden">
                {/* Header */}
                <div className="relative px-6 pt-6 pb-4 border-b border-black/[0.08] dark:border-white/[0.08]">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="px-2 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/20 font-mono text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">
                                + REPO
                            </span>
                            <div>
                                <h3 className="text-sm font-black text-neutral-950 dark:text-white">Create Repository</h3>
                                <p className="text-[10px] text-neutral-500 dark:text-neutral-400 font-mono mt-0.5">New repo on GitHub</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="font-mono text-sm px-2.5 py-1 rounded-lg text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors" title="Close">
                            ✕
                        </button>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="relative px-6 py-5 space-y-4">
                    {/* Repo name */}
                    <div>
                        <label className="text-[10px] font-bold font-mono uppercase tracking-wider text-neutral-500 dark:text-neutral-400 block mb-2">
                            Repository Name <span className="text-rose-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value.replace(/[^a-zA-Z0-9._-]/g, '-'))}
                            placeholder="my-awesome-project"
                            className="w-full h-10 px-4 rounded-xl bg-neutral-100/80 dark:bg-white/[0.04] border border-black/10 dark:border-white/10 text-sm font-mono text-neutral-950 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-white/20 focus:outline-none focus:border-emerald-500 transition-all"
                            autoFocus
                            required
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="text-[10px] font-bold font-mono uppercase tracking-wider text-neutral-500 dark:text-neutral-400 block mb-2">
                            Description
                        </label>
                        <input
                            type="text"
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="A short description of your repository"
                            className="w-full h-10 px-4 rounded-xl bg-neutral-100/80 dark:bg-white/[0.04] border border-black/10 dark:border-white/10 text-sm font-mono text-neutral-950 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-white/20 focus:outline-none focus:border-neutral-400 dark:focus:border-white/20 transition-all"
                        />
                    </div>

                    {/* Visibility */}
                    <div>
                        <label className="text-[10px] font-bold font-mono uppercase tracking-wider text-neutral-500 dark:text-neutral-400 block mb-3">
                            Visibility
                        </label>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setIsPrivate(false)}
                                className={`flex-1 h-11 rounded-xl border text-xs font-mono font-bold uppercase transition-all flex items-center justify-center gap-2 ${
                                    !isPrivate
                                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                        : "border-black/[0.06] dark:border-white/[0.06] bg-neutral-100 dark:bg-white/[0.02] text-neutral-500 dark:text-white/40"
                                }`}
                            >
                                PUBLIC
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsPrivate(true)}
                                className={`flex-1 h-11 rounded-xl border text-xs font-mono font-bold uppercase transition-all flex items-center justify-center gap-2 ${
                                    isPrivate
                                        ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                        : "border-black/[0.06] dark:border-white/[0.06] bg-neutral-100 dark:bg-white/[0.02] text-neutral-500 dark:text-white/40"
                                }`}
                            >
                                PRIVATE
                            </button>
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs font-mono text-rose-600 dark:text-rose-300">
                            {error}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 h-10 rounded-xl border border-black/10 dark:border-white/[0.08] text-xs font-mono font-bold uppercase text-neutral-600 dark:text-white/60 hover:text-neutral-950 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/[0.04] transition-all"
                        >
                            CANCEL
                        </button>
                        <button
                            type="submit"
                            disabled={!name.trim() || creating}
                            className="flex-1 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-bold uppercase transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md"
                        >
                            {creating ? "CREATING..." : "CREATE REPOSITORY"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateRepoModal;
