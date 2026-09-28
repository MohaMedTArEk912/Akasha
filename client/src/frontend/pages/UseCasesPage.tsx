import { useState, useMemo, useEffect } from "react";
import GlassSelect from "../components/ui/GlassSelect";
import { useApi } from "../hooks/useApi";
import { useProjectStore } from "../hooks/useProjectStore";
import { refreshCurrentProject } from "../stores/projectStore";
import type { UseCaseSchema } from "../types/api";
import { LiquidCard, LiquidPill } from "../components/ui/LiquidGlass";
import { useBackgroundLoading } from "../context/BackgroundLoadingContext";
import { useToast } from "../context/ToastContext";
import { client } from "../hooks/useHttpApi";

// ─── Types ────────────────────────────────────────────────────────────────────
type Priority = "low" | "medium" | "high" | "critical";
type Status = "draft" | "active" | "completed" | "archived";

interface UseCaseStep {
  order: number;
  description: string;
}

interface UseCase {
  id: string;
  name: string;
  description: string;
  actors: string[];
  preconditions: string;
  postconditions: string;
  steps: UseCaseStep[];
  priority: Priority;
  status: Status;
  category: string;
  createdAt: string;
}

const uid = () => `uc-${Math.random().toString(36).slice(2, 8)}`;

const PRIORITY_META: Record<Priority, { label: string; badgeClass: string }> = {
  critical: { label: "Critical", badgeClass: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30" },
  high:     { label: "High",     badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30" },
  medium:   { label: "Medium",   badgeClass: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30" },
  low:      { label: "Low",      badgeClass: "bg-neutral-500/15 text-neutral-700 dark:text-neutral-300 border-neutral-500/30" },
};

const STATUS_META: Record<Status, { label: string; badgeClass: string }> = {
  active:    { label: "Active",    badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" },
  draft:     { label: "Draft",     badgeClass: "bg-neutral-500/15 text-neutral-600 dark:text-neutral-400 border-neutral-500/30" },
  completed: { label: "Completed", badgeClass: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30" },
  archived:  { label: "Archived",  badgeClass: "bg-neutral-400/15 text-neutral-500 dark:text-neutral-400 border-neutral-400/30" },
};

// ─── Sub-Components (Pure Typography, Zero Icons) ──────────────────────────────
const TypographyBadge = ({ text, badgeClass }: { text: string; badgeClass: string }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${badgeClass}`}>
    {text}
  </span>
);

// ─── Card (Apple Liquid Glass) ────────────────────────────────────────────────
const UseCaseCard = ({
  uc, onEdit, onDelete,
}: { uc: UseCase; onEdit: (u: UseCase) => void; onDelete: (id: string) => void }) => {
  const pm = PRIORITY_META[uc.priority] || PRIORITY_META.medium;
  const sm = STATUS_META[uc.status] || STATUS_META.draft;

  return (
    <LiquidCard
      variant="glass"
      className="p-5 cursor-pointer flex flex-col justify-between group hover:scale-[1.01] transition-all duration-300 relative overflow-hidden"
    >
      {/* Category Tag & Top Actions */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400 truncate">
            {uc.category || "GENERAL"}
          </span>
          <div className="flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(uc); }}
              className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.16] text-neutral-700 dark:text-neutral-300 transition-colors"
            >
              Edit
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(uc.id); }}
              className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 transition-colors"
            >
              Del
            </button>
          </div>
        </div>

        {/* Title */}
        <h3 className="text-sm font-bold text-neutral-950 dark:text-white mb-2 line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          {uc.name}
        </h3>

        {/* Description */}
        <p className="text-xs text-neutral-600 dark:text-neutral-300 mb-4 line-clamp-2 leading-relaxed">
          {uc.description || "No description provided for this use case."}
        </p>

        {/* Badges */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <TypographyBadge text={pm.label} badgeClass={pm.badgeClass} />
          <TypographyBadge text={sm.label} badgeClass={sm.badgeClass} />
        </div>
      </div>

      {/* Footer Meta */}
      <div className="pt-3 border-t border-black/[0.06] dark:border-white/10 flex items-center justify-between text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
        <span>{uc.actors.length} {uc.actors.length === 1 ? "actor" : "actors"}</span>
        <span>{uc.steps.length} {uc.steps.length === 1 ? "step" : "steps"}</span>
      </div>
    </LiquidCard>
  );
};

// ─── Modal ────────────────────────────────────────────────────────────────────
const EMPTY: Omit<UseCase, "id" | "createdAt"> = {
  name: "", description: "", actors: [],
  preconditions: "", postconditions: "",
  steps: [{ order: 1, description: "" }],
  priority: "medium", status: "draft", category: "",
};

const Modal = ({
  initial,
  onSave,
  onClose,
}: {
  initial?: UseCase;
  onSave: (uc: UseCase) => void;
  onClose: () => void;
}) => {
  const [form, setForm] = useState<Omit<UseCase, "id" | "createdAt">>(
    initial ? { ...initial } : { ...EMPTY }
  );
  const [actorInput, setActorInput] = useState("");

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const addActor = () => {
    if (actorInput.trim()) {
      set("actors", [...form.actors, actorInput.trim()]);
      setActorInput("");
    }
  };

  const removeActor = (index: number) => {
    set("actors", form.actors.filter((_, idx) => idx !== index));
  };

  const addStep = () =>
    set("steps", [...form.steps, { order: form.steps.length + 1, description: "" }]);

  const updateStep = (i: number, val: string) => {
    const steps = [...form.steps];
    const step = steps[i];
    if (step) {
      steps[i] = { ...step, description: val };
    }
    set("steps", steps);
  };

  const removeStep = (i: number) =>
    set("steps", form.steps.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, order: idx + 1 })));

  const handleSave = () => {
    if (!form.name.trim()) return;
    onSave({
      ...form,
      id: initial?.id ?? uid(),
      createdAt: initial?.createdAt ?? new Date().toISOString().substring(0, 10),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md">
      <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white/95 dark:bg-neutral-900/95 border border-black/[0.1] dark:border-white/15 p-6 shadow-2xl space-y-5 text-neutral-900 dark:text-white">
        <div className="flex items-center justify-between pb-3 border-b border-black/[0.08] dark:border-white/10">
          <h2 className="text-base font-bold">
            {initial ? "Edit Use Case" : "New Use Case"}
          </h2>
          <button
            onClick={onClose}
            className="text-xs font-bold uppercase text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
          >
            Close
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-1">
              Title
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. User logs into portal"
              className="w-full h-9 px-3 rounded-xl bg-white dark:bg-white/[0.08] border border-black/15 dark:border-white/15 text-xs font-semibold text-neutral-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-1">
              Category
            </label>
            <input
              type="text"
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
              placeholder="e.g. Authentication, Billing, Clinical"
              className="w-full h-9 px-3 rounded-xl bg-white dark:bg-white/[0.08] border border-black/15 dark:border-white/15 text-xs font-semibold text-neutral-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-1">
                Priority
              </label>
              <GlassSelect
                value={form.priority}
                onChange={(v) => set("priority", v as Priority)}
                options={[
                  { value: "low", label: "Low" },
                  { value: "medium", label: "Medium" },
                  { value: "high", label: "High" },
                  { value: "critical", label: "Critical" },
                ]}
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-1">
                Status
              </label>
              <GlassSelect
                value={form.status}
                onChange={(v) => set("status", v as Status)}
                options={[
                  { value: "draft", label: "Draft" },
                  { value: "active", label: "Active" },
                  { value: "completed", label: "Completed" },
                  { value: "archived", label: "Archived" },
                ]}
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-1">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={3}
              placeholder="Detailed description of the workflow..."
              className="w-full p-3 rounded-xl bg-white dark:bg-white/[0.08] border border-black/15 dark:border-white/15 text-xs font-semibold text-neutral-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </div>

          {/* Actors */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-1">
              Actors
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={actorInput}
                onChange={(e) => setActorInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addActor(); } }}
                placeholder="Add actor (e.g. Doctor, Patient)..."
                className="flex-1 h-8 px-3 rounded-lg bg-white dark:bg-white/[0.08] border border-black/15 dark:border-white/15 text-xs font-semibold text-neutral-950 dark:text-white"
              />
              <LiquidPill variant="secondary" size="sm" onClick={addActor}>
                Add
              </LiquidPill>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {form.actors.map((actor, idx) => (
                <span
                  key={idx}
                  onClick={() => removeActor(idx)}
                  className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-black/[0.05] dark:bg-white/[0.1] text-neutral-800 dark:text-neutral-200 cursor-pointer hover:bg-rose-500/20 hover:text-rose-600"
                >
                  {actor} ×
                </span>
              ))}
            </div>
          </div>

          {/* Flow Steps */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400">
                Workflow Steps ({form.steps.length})
              </label>
              <button
                type="button"
                onClick={addStep}
                className="text-[10px] font-bold uppercase text-blue-600 dark:text-blue-400 hover:underline"
              >
                + Add Step
              </button>
            </div>
            <div className="space-y-2">
              {form.steps.map((step, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-neutral-500 w-5 text-center">
                    {step.order}
                  </span>
                  <input
                    type="text"
                    value={step.description}
                    onChange={(e) => updateStep(idx, e.target.value)}
                    placeholder={`Step ${step.order} description...`}
                    className="flex-1 h-8 px-3 rounded-lg bg-white dark:bg-white/[0.08] border border-black/15 dark:border-white/15 text-xs font-semibold text-neutral-950 dark:text-white"
                  />
                  {form.steps.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeStep(idx)}
                      className="text-xs text-rose-500 px-1 font-bold"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-4 border-t border-black/[0.08] dark:border-white/10">
          <LiquidPill variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </LiquidPill>
          <LiquidPill variant="primary" size="sm" onClick={handleSave}>
            {initial ? "Save Changes" : "Create Use Case"}
          </LiquidPill>
        </div>
      </div>
    </div>
  );
};

// ─── Detail Drawer ────────────────────────────────────────────────────────────
const Drawer = ({ uc, onClose, onEdit }: { uc: UseCase; onClose: () => void; onEdit: () => void }) => {
  const pm = PRIORITY_META[uc.priority] || PRIORITY_META.medium;
  const sm = STATUS_META[uc.status] || STATUS_META.draft;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md h-full overflow-y-auto bg-white/95 dark:bg-neutral-950/95 border-l border-black/[0.08] dark:border-white/10 p-6 shadow-2xl flex flex-col justify-between text-neutral-950 dark:text-white space-y-6"
      >
        <div className="space-y-5">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
                {uc.category || "GENERAL"} · {uc.id.toUpperCase()}
              </span>
              <h2 className="text-lg font-bold text-neutral-950 dark:text-white mt-1">
                {uc.name}
              </h2>
            </div>
            <div className="flex items-center gap-1.5">
              <LiquidPill variant="secondary" size="sm" onClick={onEdit}>
                Edit
              </LiquidPill>
              <button
                onClick={onClose}
                className="text-xs font-bold uppercase text-neutral-500 hover:text-neutral-900 dark:hover:text-white px-2"
              >
                Close
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <TypographyBadge text={pm.label} badgeClass={pm.badgeClass} />
            <TypographyBadge text={sm.label} badgeClass={sm.badgeClass} />
          </div>

          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1.5">
              Description
            </h4>
            <p className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed">
              {uc.description || "No description provided."}
            </p>
          </div>

          {uc.actors.length > 0 && (
            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2">
                Actors
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {uc.actors.map((actor, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-black/[0.05] dark:bg-white/[0.08] text-neutral-800 dark:text-neutral-200 border border-black/[0.08] dark:border-white/10"
                  >
                    {actor}
                  </span>
                ))}
              </div>
            </div>
          )}

          {uc.steps.length > 0 && (
            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2">
                Workflow Sequence
              </h4>
              <div className="space-y-2">
                {uc.steps.map((step, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 text-xs">
                    <span className="w-5 h-5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center text-[10px] flex-shrink-0">
                      {step.order}
                    </span>
                    <span className="text-neutral-800 dark:text-neutral-200 leading-relaxed">
                      {step.description}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-black/[0.08] dark:border-white/10 flex justify-end">
          <LiquidPill variant="secondary" size="sm" onClick={onClose}>
            Close Details
          </LiquidPill>
        </div>
      </div>
    </div>
  );
};

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function UseCasesPage() {
  const api = useApi();
  const { project } = useProjectStore();
  const [useCases, setUseCases] = useState<UseCase[]>([]);
  const [search, setSearch] = useState("");
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const toast = useToast();
  const { startTask, completeTask, failTask } = useBackgroundLoading();

  const handleSynthesizeUseCases = async () => {
    if (!project?.id) return;
    setIsSynthesizing(true);
    startTask({
      title: "Agent: Use Cases",
      step: "Synthesizing actor workflows...",
      progress: 50,
    });
    toast.showToast("Mapping actor workflows in background...", "info");
    try {
      const res = await client.post("/ai/agent/synthesize-step", {
        projectId: project.id,
        step: "usecases",
      });
      if (res.data?.success) {
        completeTask({
          resultSummary: "Workflows Ready ✓",
          step: "Mapped actor journeys and scenarios",
        });
        toast.showToast("Workflows synthesized successfully!", "success");
        await refreshCurrentProject();
        const rows = (await api.listUseCases()) as UseCaseSchema[];
        setUseCases(Array.isArray(rows) ? rows.map(fromApiUseCase) : []);
      } else {
        failTask({ error: res.data?.error || "Failed to synthesize use cases" });
        toast.showToast(`Error: ${res.data?.error}`, "error");
      }
    } catch (err: any) {
      failTask({ error: err.message });
      toast.showToast(`Failed: ${err.message}`, "error");
    } finally {
      setIsSynthesizing(false);
    }
  };
  const [filterStatus, setFilterStatus] = useState<Status | "all">("all");
  const [filterPriority, setFilterPriority] = useState<Priority | "all">("all");
  const [filterActor, setFilterActor] = useState<string>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<UseCase | undefined>();
  const [drawerTarget, setDrawerTarget] = useState<UseCase | undefined>();

  const fromApiUseCase = (uc: UseCaseSchema): UseCase => ({
    id: uc.id,
    name: uc.name,
    description: uc.description || "",
    actors: Array.isArray(uc.actors) ? uc.actors : [],
    preconditions: uc.preconditions || "",
    postconditions: uc.postconditions || "",
    steps: Array.isArray(uc.steps) ? uc.steps : [],
    priority: uc.priority,
    status: uc.status,
    category: uc.category || "",
    createdAt: (uc.created_at || "").slice(0, 10),
  });

  useEffect(() => {
    let cancelled = false;

    const loadUseCases = async () => {
      if (!project?.id) {
        setUseCases([]);
        return;
      }

      try {
        const rows = (await api.listUseCases()) as UseCaseSchema[];
        if (!cancelled) {
          setUseCases(Array.isArray(rows) ? rows.map(fromApiUseCase) : []);
        }
      } catch (err) {
        console.error("Failed to load use cases:", err);
        if (!cancelled) {
          setUseCases([]);
        }
      }
    };

    void loadUseCases();

    return () => {
      cancelled = true;
    };
  }, [api, project?.id]);

  const allActors = useMemo(() =>
    [...new Set(useCases.flatMap((uc) => uc.actors))].sort(),
    [useCases]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return useCases.filter((uc) => {
      if (q && !uc.name.toLowerCase().includes(q) && !uc.description.toLowerCase().includes(q)) return false;
      if (filterStatus !== "all" && uc.status !== filterStatus) return false;
      if (filterPriority !== "all" && uc.priority !== filterPriority) return false;
      if (filterActor !== "all" && !uc.actors.includes(filterActor)) return false;
      return true;
    });
  }, [useCases, search, filterStatus, filterPriority, filterActor]);

  const stats = useMemo(() => ({
    total: useCases.length,
    active: useCases.filter((u) => u.status === "active").length,
    critical: useCases.filter((u) => u.priority === "critical").length,
    draft: useCases.filter((u) => u.status === "draft").length,
  }), [useCases]);

  const handleSave = async (uc: UseCase) => {
    try {
      if (useCases.some((u) => u.id === uc.id)) {
        const updated = (await api.updateUseCase(uc.id, {
          name: uc.name,
          description: uc.description,
          actors: uc.actors,
          preconditions: uc.preconditions,
          postconditions: uc.postconditions,
          steps: uc.steps,
          priority: uc.priority,
          status: uc.status,
          category: uc.category,
        })) as UseCaseSchema;

        setUseCases((prev) => prev.map((u) => (u.id === uc.id ? fromApiUseCase(updated) : u)));
      } else {
        const created = (await api.createUseCase({
          name: uc.name,
          description: uc.description,
          actors: uc.actors,
          preconditions: uc.preconditions,
          postconditions: uc.postconditions,
          steps: uc.steps,
          priority: uc.priority,
          status: uc.status,
          category: uc.category,
        })) as UseCaseSchema;

        setUseCases((prev) => [fromApiUseCase(created), ...prev]);
      }

      setModalOpen(false);
      setEditTarget(undefined);
    } catch (err) {
      console.error("Failed to save use case:", err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteUseCase(id);
      setUseCases((prev) => prev.filter((u) => u.id !== id));
      if (drawerTarget?.id === id) setDrawerTarget(undefined);
    } catch (err) {
      console.error("Failed to delete use case:", err);
    }
  };

  const openEdit = (uc: UseCase) => {
    setEditTarget(uc);
    setDrawerTarget(undefined);
    setModalOpen(true);
  };

  return (
    <div className="h-full w-full overflow-y-auto relative p-6 sm:p-10 select-none">
      <div className="relative z-10 max-w-6xl mx-auto space-y-6">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-black/[0.08] dark:border-white/10">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-neutral-950 dark:text-white">
              Use Cases
            </h1>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5">
              {stats.total} total · {stats.active} active · {stats.critical} critical · {stats.draft} draft
            </p>
          </div>
          <div className="flex items-center gap-2">
            <LiquidPill
              variant="secondary"
              size="sm"
              onClick={handleSynthesizeUseCases}
              disabled={isSynthesizing}
            >
              {isSynthesizing ? "Mapping…" : "AI Map Workflows"}
            </LiquidPill>
            <LiquidPill
              variant="primary"
              size="sm"
              onClick={() => { setEditTarget(undefined); setModalOpen(true); }}
            >
              + New Use Case
            </LiquidPill>
          </div>
        </div>

        {/* ── Stat Counters (High Contrast) ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total", value: stats.total, colorClass: "text-neutral-950 dark:text-white" },
            { label: "Active", value: stats.active, colorClass: "text-emerald-700 dark:text-emerald-400" },
            { label: "Critical", value: stats.critical, colorClass: "text-rose-700 dark:text-rose-400" },
            { label: "Draft", value: stats.draft, colorClass: "text-neutral-600 dark:text-neutral-400" },
          ].map((s) => (
            <LiquidCard key={s.label} variant="glass" className="p-4 flex flex-col justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
                {s.label}
              </span>
              <span className={`text-2xl font-black mt-1 ${s.colorClass}`}>
                {s.value}
              </span>
            </LiquidCard>
          ))}
        </div>

        {/* ── Filter Bar (Compact Single-Row Horizontal Toolbar) ── */}
        <div className="relative z-20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2 px-3 rounded-xl bg-white/80 dark:bg-[#0c0d16]/70 border border-black/[0.06] dark:border-white/10 backdrop-blur-md">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500 text-xs pointer-events-none">
              ⌕
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search use cases..."
              className="w-full h-8 pl-8 pr-3 rounded-lg bg-white/90 dark:bg-[#07090f]/80 border border-black/[0.08] dark:border-white/12 text-xs font-semibold text-neutral-950 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/40 transition-all"
            />
          </div>

          {/* Filter Dropdowns on the right — Single Horizontal Line */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <GlassSelect
              value={filterStatus}
              onChange={(v) => setFilterStatus(v as Status | "all")}
              className="w-36 flex-shrink-0"
              options={[
                { value: "all", label: "All Statuses" },
                { value: "active", label: "Active" },
                { value: "draft", label: "Draft" },
                { value: "completed", label: "Completed" },
                { value: "archived", label: "Archived" },
              ]}
            />

            <GlassSelect
              value={filterPriority}
              onChange={(v) => setFilterPriority(v as Priority | "all")}
              className="w-36 flex-shrink-0"
              options={[
                { value: "all", label: "All Priorities" },
                { value: "critical", label: "Critical" },
                { value: "high", label: "High" },
                { value: "medium", label: "Medium" },
                { value: "low", label: "Low" },
              ]}
            />

            {allActors.length > 0 && (
              <GlassSelect
                value={filterActor}
                onChange={(v) => setFilterActor(v)}
                className="w-36 flex-shrink-0"
                options={[
                  { value: "all", label: "All Actors" },
                  ...allActors.map((a) => ({ value: a, label: a })),
                ]}
              />
            )}

            {(search || filterStatus !== "all" || filterPriority !== "all" || filterActor !== "all") && (
              <button
                type="button"
                onClick={() => { setSearch(""); setFilterStatus("all"); setFilterPriority("all"); setFilterActor("all"); }}
                className="h-8 px-2.5 rounded-lg text-[10px] font-bold text-neutral-500 hover:text-neutral-900 dark:hover:text-white bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] dark:hover:bg-white/[0.1] border border-black/[0.06] dark:border-white/10 transition-all cursor-pointer whitespace-nowrap"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* ── Cards Grid ── */}
        {filtered.length === 0 ? (
          <LiquidCard variant="glass" className="p-12 text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400 block mb-1">
              No Use Cases Found
            </span>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 max-w-sm mx-auto">
              Create a new use case or adjust your filters to view specifications.
            </p>
          </LiquidCard>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((uc) => (
              <div key={uc.id} onClick={() => setDrawerTarget(uc)}>
                <UseCaseCard uc={uc} onEdit={openEdit} onDelete={handleDelete} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <Modal
          initial={editTarget}
          onSave={handleSave}
          onClose={() => { setModalOpen(false); setEditTarget(undefined); }}
        />
      )}

      {/* Drawer */}
      {drawerTarget && !modalOpen && (
        <Drawer
          uc={drawerTarget}
          onClose={() => setDrawerTarget(undefined)}
          onEdit={() => openEdit(drawerTarget)}
        />
      )}
    </div>
  );
}
