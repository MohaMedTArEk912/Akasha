/**
 * Use Cases Page
 *
 * Full-page manager for project use cases:
 * - Card grid with badges for priority & status
 * - Filter bar: search, status, priority, actor/role
 * - Create / Edit modal with all fields
 * - Delete confirmation modal
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import useApi from "../../hooks/useApi";
import type { UseCaseSchema, UseCaseStep } from "../../types/api";

/* ━━━ Constants ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const PRIORITIES = ["low", "medium", "high", "critical"] as const;
const STATUSES = ["draft", "active", "completed", "archived"] as const;

const PRIORITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    low: { bg: "rgba(100,200,120,0.10)", text: "#6ee7b7", border: "rgba(100,200,120,0.25)" },
    medium: { bg: "rgba(250,200,60,0.10)", text: "#fbbf24", border: "rgba(250,200,60,0.25)" },
    high: { bg: "rgba(250,130,60,0.10)", text: "#fb923c", border: "rgba(250,130,60,0.25)" },
    critical: { bg: "rgba(240,70,70,0.10)", text: "#f87171", border: "rgba(240,70,70,0.25)" },
};

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    draft: { bg: "rgba(160,160,180,0.10)", text: "#a1a1aa", border: "rgba(160,160,180,0.25)" },
    active: { bg: "rgba(96,165,250,0.10)", text: "#60a5fa", border: "rgba(96,165,250,0.25)" },
    completed: { bg: "rgba(52,211,153,0.10)", text: "#34d399", border: "rgba(52,211,153,0.25)" },
    archived: { bg: "rgba(120,113,108,0.10)", text: "#78716c", border: "rgba(120,113,108,0.25)" },
};

/* ━━━ Badge ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const Badge: React.FC<{ label: string; colors: { bg: string; text: string; border: string } }> = ({ label, colors }) => (
    <span
        style={{
            background: colors.bg,
            color: colors.text,
            border: `1px solid ${colors.border}`,
            padding: "2px 10px",
            borderRadius: 20,
            fontSize: 10,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            whiteSpace: "nowrap",
        }}
    >
        {label}
    </span>
);

/* ━━━ Toast ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const Toast: React.FC<{ message: string | null; type?: "error" | "success"; onDismiss: () => void }> = ({ message, type = "error", onDismiss }) => {
    useEffect(() => {
        if (message) { const t = setTimeout(onDismiss, 4000); return () => clearTimeout(t); }
    }, [message, onDismiss]);

    if (!message) return null;
    return (
        <div
            className={`fixed bottom-6 right-6 z-[300] max-w-md px-5 py-3 rounded-xl shadow-2xl border text-sm font-medium flex items-center gap-3 ${type === "error" ? "bg-red-500/10 border-red-500/30 text-red-400" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"}`}
            style={{ animation: "uc-slideUp 0.3s ease-out" }}
        >
            <span className="flex-1">{message}</span>
            <button onClick={onDismiss} className="opacity-60 hover:opacity-100">✕</button>
        </div>
    );
};

/* ━━━ Confirm Delete Modal ━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const ConfirmDeleteModal: React.FC<{
    isOpen: boolean;
    name: string;
    onConfirm: () => void;
    onCancel: () => void;
}> = ({ isOpen, name, onConfirm, onCancel }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
            <div className="relative w-full max-w-sm bg-[var(--ide-bg-panel)] border border-[var(--ide-border-strong)] rounded-2xl shadow-2xl p-6 space-y-4" style={{ animation: "uc-scaleUp 0.2s ease-out" }}>
                <h3 className="text-lg font-bold text-[var(--ide-text)]">Delete Use Case?</h3>
                <p className="text-sm text-[var(--ide-text-secondary)]">
                    Are you sure you want to delete <strong className="text-[var(--ide-text)]">"{name}"</strong>? This cannot be undone.
                </p>
                <div className="flex gap-3 pt-1">
                    <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-[var(--ide-border)] text-[var(--ide-text-secondary)] font-semibold text-xs uppercase tracking-wider hover:bg-[var(--ide-bg-elevated)] transition-all">Cancel</button>
                    <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold text-xs uppercase tracking-wider transition-all">Delete</button>
                </div>
            </div>
        </div>
    );
};

/* ━━━ Create/Edit Modal ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

interface FormData {
    name: string;
    description: string;
    actors: string[];
    preconditions: string;
    postconditions: string;
    steps: UseCaseStep[];
    priority: string;
    status: string;
    category: string;
}

const EMPTY_FORM: FormData = {
    name: "",
    description: "",
    actors: [],
    preconditions: "",
    postconditions: "",
    steps: [{ order: 1, description: "" }],
    priority: "medium",
    status: "draft",
    category: "",
};

const UseCaseFormModal: React.FC<{
    isOpen: boolean;
    editingUseCase: UseCaseSchema | null;
    onSave: (data: FormData) => void;
    onCancel: () => void;
}> = ({ isOpen, editingUseCase, onSave, onCancel }) => {
    const [form, setForm] = useState<FormData>(EMPTY_FORM);
    const [actorInput, setActorInput] = useState("");
    const nameRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            if (editingUseCase) {
                setForm({
                    name: editingUseCase.name,
                    description: editingUseCase.description,
                    actors: editingUseCase.actors || [],
                    preconditions: editingUseCase.preconditions,
                    postconditions: editingUseCase.postconditions,
                    steps: editingUseCase.steps.length > 0 ? editingUseCase.steps : [{ order: 1, description: "" }],
                    priority: editingUseCase.priority,
                    status: editingUseCase.status,
                    category: editingUseCase.category,
                });
            } else {
                setForm(EMPTY_FORM);
            }
            setActorInput("");
            setTimeout(() => nameRef.current?.focus(), 120);
        }
    }, [isOpen, editingUseCase]);

    if (!isOpen) return null;

    const set = (key: keyof FormData, value: any) => setForm(prev => ({ ...prev, [key]: value }));

    const addActor = () => {
        const trimmed = actorInput.trim();
        if (trimmed && !form.actors.includes(trimmed)) {
            set("actors", [...form.actors, trimmed]);
        }
        setActorInput("");
    };

    const removeActor = (actor: string) => set("actors", form.actors.filter(a => a !== actor));

    const addStep = () => set("steps", [...form.steps, { order: form.steps.length + 1, description: "" }]);

    const updateStep = (index: number, desc: string) => {
        const updated = [...form.steps];
        updated[index] = { ...updated[index], description: desc };
        set("steps", updated);
    };

    const removeStep = (index: number) => {
        const updated = form.steps.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i + 1 }));
        set("steps", updated.length > 0 ? updated : [{ order: 1, description: "" }]);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim()) return;
        onSave({
            ...form,
            name: form.name.trim(),
            steps: form.steps.filter(s => s.description.trim()),
        });
    };

    const labelCls = "text-xs font-semibold text-[var(--ide-text-muted)] uppercase tracking-wide mb-1.5 block";
    const inputCls = "w-full bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] rounded-xl px-4 py-2.5 text-sm text-[var(--ide-text)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all placeholder:text-[var(--ide-text-muted)]/50";
    const selectCls = "bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] rounded-xl px-3 py-2.5 text-sm text-[var(--ide-text)] focus:outline-none focus:border-indigo-500/50 transition-all cursor-pointer";

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/65 backdrop-blur-md" onClick={onCancel} />
            <div
                className="relative w-full max-w-2xl bg-[var(--ide-bg-panel)] border border-[var(--ide-border-strong)] rounded-3xl shadow-2xl overflow-hidden flex flex-col"
                style={{ animation: "uc-scaleUp 0.25s cubic-bezier(0.34,1.56,0.64,1)", maxHeight: "85vh" }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-5 flex items-center justify-between border-b border-[var(--ide-border)] shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                            <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-bold text-[var(--ide-text)]">
                            {editingUseCase ? "Edit Use Case" : "New Use Case"}
                        </h3>
                    </div>
                    <button onClick={onCancel} className="w-9 h-9 flex items-center justify-center hover:bg-[var(--ide-bg-sidebar)] rounded-lg text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-all">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="p-6 space-y-5">
                        {/* Row: Name + Category */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="col-span-2">
                                <label className={labelCls}>Name *</label>
                                <input ref={nameRef} className={inputCls} value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. User Registration" required />
                            </div>
                            <div>
                                <label className={labelCls}>Category</label>
                                <input className={inputCls} value={form.category} onChange={e => set("category", e.target.value)} placeholder="e.g. Auth" />
                            </div>
                        </div>

                        {/* Description */}
                        <div>
                            <label className={labelCls}>Description</label>
                            <textarea className={inputCls + " resize-none"} rows={2} value={form.description} onChange={e => set("description", e.target.value)} placeholder="Brief description of this use case..." />
                        </div>

                        {/* Row: Priority + Status */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={labelCls}>Priority</label>
                                <select className={selectCls + " w-full"} value={form.priority} onChange={e => set("priority", e.target.value)}>
                                    {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={labelCls}>Status</label>
                                <select className={selectCls + " w-full"} value={form.status} onChange={e => set("status", e.target.value)}>
                                    {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Actors/Roles */}
                        <div>
                            <label className={labelCls}>Actors / Roles</label>
                            <div className="flex gap-2 mb-2 flex-wrap">
                                {form.actors.map(actor => (
                                    <span key={actor} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/25 text-indigo-300 text-xs font-medium">
                                        {actor}
                                        <button type="button" onClick={() => removeActor(actor)} className="hover:text-red-400 transition-colors">✕</button>
                                    </span>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <input
                                    className={inputCls + " flex-1"}
                                    value={actorInput}
                                    onChange={e => setActorInput(e.target.value)}
                                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addActor(); } }}
                                    placeholder="Type a role and press Enter..."
                                />
                                <button type="button" onClick={addActor} className="px-4 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 text-xs font-semibold hover:bg-indigo-600/30 transition-all">Add</button>
                            </div>
                        </div>

                        {/* Preconditions + Postconditions */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={labelCls}>Preconditions</label>
                                <textarea className={inputCls + " resize-none"} rows={2} value={form.preconditions} onChange={e => set("preconditions", e.target.value)} placeholder="What must be true before..." />
                            </div>
                            <div>
                                <label className={labelCls}>Postconditions</label>
                                <textarea className={inputCls + " resize-none"} rows={2} value={form.postconditions} onChange={e => set("postconditions", e.target.value)} placeholder="What will be true after..." />
                            </div>
                        </div>

                        {/* Steps */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className={labelCls + " mb-0"}>Steps</label>
                                <button type="button" onClick={addStep} className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold transition-colors">+ Add Step</button>
                            </div>
                            <div className="space-y-2">
                                {form.steps.map((step, i) => (
                                    <div key={i} className="flex items-start gap-2">
                                        <span className="w-7 h-9 flex items-center justify-center text-xs font-bold text-[var(--ide-text-muted)] shrink-0">{i + 1}.</span>
                                        <input
                                            className={inputCls + " flex-1"}
                                            value={step.description}
                                            onChange={e => updateStep(i, e.target.value)}
                                            placeholder={`Step ${i + 1} description...`}
                                        />
                                        {form.steps.length > 1 && (
                                            <button type="button" onClick={() => removeStep(i)} className="w-9 h-9 flex items-center justify-center text-[var(--ide-text-muted)] hover:text-red-400 transition-colors shrink-0">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="sticky bottom-0 px-6 py-4 bg-[var(--ide-bg-panel)] border-t border-[var(--ide-border)] flex items-center justify-end gap-3 shrink-0">
                        <button type="button" onClick={onCancel} className="px-5 py-2.5 text-xs font-semibold text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] transition-all">Cancel</button>
                        <button
                            type="submit"
                            disabled={!form.name.trim()}
                            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-40"
                        >
                            {editingUseCase ? "Save Changes" : "Create Use Case"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

/* ━━━ Main Page ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const UseCasesPage: React.FC = () => {
    const api = useApi();
    const [useCases, setUseCases] = useState<UseCaseSchema[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [searchQuery, setSearchQuery] = useState("");
    const [filterStatus, setFilterStatus] = useState<string>("all");
    const [filterPriority, setFilterPriority] = useState<string>("all");
    const [filterActor, setFilterActor] = useState<string>("all");

    // Modals
    const [showFormModal, setShowFormModal] = useState(false);
    const [editingUseCase, setEditingUseCase] = useState<UseCaseSchema | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<UseCaseSchema | null>(null);

    // Toast
    const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);
    const showToast = (message: string, type: "error" | "success" = "error") => setToast({ message, type });

    const loadUseCases = useCallback(async () => {
        setLoading(true);
        try {
            const list = await api.listUseCases();
            setUseCases(list);
        } catch (err) {
            console.error("Failed to load use cases:", err);
        } finally {
            setLoading(false);
        }
    }, [api]);

    useEffect(() => { loadUseCases(); }, []);

    // All unique actors across use cases
    const allActors = useMemo(() => {
        const set = new Set<string>();
        useCases.forEach(uc => (uc.actors || []).forEach(a => set.add(a)));
        return Array.from(set).sort();
    }, [useCases]);

    // Filtered list
    const filtered = useMemo(() => {
        return useCases.filter(uc => {
            if (searchQuery && !uc.name.toLowerCase().includes(searchQuery.toLowerCase()) && !uc.description.toLowerCase().includes(searchQuery.toLowerCase())) return false;
            if (filterStatus !== "all" && uc.status !== filterStatus) return false;
            if (filterPriority !== "all" && uc.priority !== filterPriority) return false;
            if (filterActor !== "all" && !(uc.actors || []).includes(filterActor)) return false;
            return true;
        });
    }, [useCases, searchQuery, filterStatus, filterPriority, filterActor]);

    const handleCreate = () => {
        setEditingUseCase(null);
        setShowFormModal(true);
    };

    const handleEdit = (uc: UseCaseSchema) => {
        setEditingUseCase(uc);
        setShowFormModal(true);
    };

    const handleFormSave = async (data: FormData) => {
        try {
            if (editingUseCase) {
                await api.updateUseCase(editingUseCase.id, data);
                showToast(`Updated "${data.name}"`, "success");
            } else {
                await api.createUseCase(data);
                showToast(`Created "${data.name}"`, "success");
            }
            setShowFormModal(false);
            setEditingUseCase(null);
            await loadUseCases();
        } catch (err) {
            showToast(`Failed: ${err}`);
        }
    };

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        try {
            await api.deleteUseCase(deleteTarget.id);
            showToast(`Deleted "${deleteTarget.name}"`, "success");
            setDeleteTarget(null);
            await loadUseCases();
        } catch (err) {
            showToast(`Failed to delete: ${err}`);
        }
    };

    const selectCls = "bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] rounded-lg px-3 py-1.5 text-xs text-[var(--ide-text)] focus:outline-none focus:border-indigo-500/50 transition-all cursor-pointer";

    return (
        <div className="flex flex-col flex-1 overflow-hidden h-full bg-[var(--ide-bg)] page-enter">
            {/* ─── Header ─────────────────────────────── */}
            <div className="shrink-0 px-6 py-4 border-b border-[var(--ide-border)] bg-[var(--ide-chrome)] animate-slide-down">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
                            <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="text-base font-bold text-[var(--ide-text)]">Use Cases</h1>
                            <p className="text-xs text-[var(--ide-text-muted)]">{useCases.length} total · {filtered.length} shown</p>
                        </div>
                    </div>
                    <button
                        onClick={handleCreate}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-indigo-500/20"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                        New Use Case
                    </button>
                </div>

                {/* Filter Bar */}
                <div className="flex items-center gap-3 flex-wrap">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[200px] max-w-sm">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--ide-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" strokeWidth="2" /><path strokeLinecap="round" strokeWidth="2" d="m21 21-4.35-4.35" /></svg>
                        <input
                            className="w-full bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] rounded-lg pl-9 pr-3 py-1.5 text-xs text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)]/50 focus:outline-none focus:border-indigo-500/50 transition-all"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search use cases..."
                        />
                    </div>

                    {/* Status filter */}
                    <select className={selectCls} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                        <option value="all">All Statuses</option>
                        {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                    </select>

                    {/* Priority filter */}
                    <select className={selectCls} value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
                        <option value="all">All Priorities</option>
                        {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                    </select>

                    {/* Actor filter */}
                    {allActors.length > 0 && (
                        <select className={selectCls} value={filterActor} onChange={e => setFilterActor(e.target.value)}>
                            <option value="all">All Actors</option>
                            {allActors.map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                    )}

                    {/* Reset filters */}
                    {(searchQuery || filterStatus !== "all" || filterPriority !== "all" || filterActor !== "all") && (
                        <button
                            onClick={() => { setSearchQuery(""); setFilterStatus("all"); setFilterPriority("all"); setFilterActor("all"); }}
                            className="text-xs text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-colors"
                        >
                            ✕ Clear
                        </button>
                    )}
                </div>
            </div>

            {/* ─── Content ────────────────────────────── */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                {loading ? (
                    <div className="flex items-center justify-center h-full text-[var(--ide-text-muted)]">
                        <span className="animate-pulse text-sm">Loading use cases...</span>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-[var(--ide-text-muted)]">
                        <svg className="w-16 h-16 mb-4 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        {useCases.length === 0 ? (
                            <>
                                <p className="text-sm font-medium mb-1">No use cases yet</p>
                                <p className="text-xs mb-4">Click the button above to create your first use case</p>
                                <button onClick={handleCreate} className="px-5 py-2 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 text-xs font-semibold hover:bg-indigo-600/30 transition-all">
                                    + New Use Case
                                </button>
                            </>
                        ) : (
                            <p className="text-sm">No use cases match your filters</p>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {filtered.map(uc => (
                            <UseCaseCard
                                key={uc.id}
                                useCase={uc}
                                onEdit={() => handleEdit(uc)}
                                onDelete={() => setDeleteTarget(uc)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* ─── Modals ─────────────────────────────── */}
            <UseCaseFormModal
                isOpen={showFormModal}
                editingUseCase={editingUseCase}
                onSave={handleFormSave}
                onCancel={() => { setShowFormModal(false); setEditingUseCase(null); }}
            />

            <ConfirmDeleteModal
                isOpen={!!deleteTarget}
                name={deleteTarget?.name || ""}
                onConfirm={handleDeleteConfirm}
                onCancel={() => setDeleteTarget(null)}
            />

            <Toast
                message={toast?.message || null}
                type={toast?.type}
                onDismiss={() => setToast(null)}
            />

            {/* Scoped animations */}
            <style>{`
                @keyframes uc-scaleUp {
                    from { opacity: 0; transform: scale(0.95) translateY(8px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
                @keyframes uc-slideUp {
                    from { opacity: 0; transform: translateY(12px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
};

/* ━━━ Use Case Card ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const UseCaseCard: React.FC<{
    useCase: UseCaseSchema;
    onEdit: () => void;
    onDelete: () => void;
}> = ({ useCase, onEdit, onDelete }) => {
    const stepCount = (useCase.steps || []).filter(s => s.description).length;

    return (
        <div
            onClick={onEdit}
            className="group relative bg-[var(--ide-bg-panel)] border border-[var(--ide-border)] rounded-2xl p-5 cursor-pointer hover:border-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/5 transition-all duration-200 hover-lift hover-glow animate-scale-in"
            style={{ animation: "uc-scaleUp 0.25s ease-out" }}
        >
            {/* Top row: badges */}
            <div className="flex items-center gap-2 mb-3">
                <Badge label={useCase.priority} colors={PRIORITY_COLORS[useCase.priority] || PRIORITY_COLORS.medium} />
                <Badge label={useCase.status} colors={STATUS_COLORS[useCase.status] || STATUS_COLORS.draft} />
                {useCase.category && (
                    <span className="text-[10px] font-medium text-[var(--ide-text-muted)] bg-[var(--ide-bg-elevated)] px-2 py-0.5 rounded-full border border-[var(--ide-border)]">
                        {useCase.category}
                    </span>
                )}
                <div className="flex-1" />
                <button
                    onClick={e => { e.stopPropagation(); onDelete(); }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/10 text-[var(--ide-text-muted)] hover:text-red-400 transition-all"
                    title="Delete"
                >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
            </div>

            {/* Title */}
            <h3 className="text-sm font-bold text-[var(--ide-text)] mb-1 truncate">{useCase.name}</h3>

            {/* Description */}
            {useCase.description && (
                <p className="text-xs text-[var(--ide-text-secondary)] mb-3 line-clamp-2">{useCase.description}</p>
            )}

            {/* Actors */}
            {useCase.actors && useCase.actors.length > 0 && (
                <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                    <svg className="w-3 h-3 text-[var(--ide-text-muted)] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    {useCase.actors.map(actor => (
                        <span key={actor} className="text-[10px] font-medium text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full">
                            {actor}
                        </span>
                    ))}
                </div>
            )}

            {/* Footer: steps count + date */}
            <div className="flex items-center justify-between text-[10px] text-[var(--ide-text-muted)] pt-2 border-t border-[var(--ide-border)]/50">
                <span>{stepCount > 0 ? `${stepCount} step${stepCount !== 1 ? 's' : ''}` : 'No steps'}</span>
                <span>{new Date(useCase.updated_at).toLocaleDateString()}</span>
            </div>
        </div>
    );
};

export default UseCasesPage;
