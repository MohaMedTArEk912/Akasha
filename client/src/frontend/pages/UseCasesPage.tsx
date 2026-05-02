import { useState, useMemo, useEffect } from "react";
import { useApi } from "../hooks/useApi";
import { useProjectStore } from "../hooks/useProjectStore";
import type { UseCaseSchema } from "../types/api";

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

// ─── Data Source ─────────────────────────────────────────────────────────────
const SEED: UseCase[] = [];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const uid = () => `uc-${Math.random().toString(36).slice(2, 8)}`;

const PRIORITY_META: Record<Priority, { label: string; color: string; bg: string; dot: string }> = {
  critical: { label: "Critical", color: "#ffffff", bg: "rgba(255,255,255,0.1)", dot: "#ffffff" },
  high:     { label: "High",     color: "#e5e7eb", bg: "rgba(255,255,255,0.08)", dot: "#e5e7eb" },
  medium:   { label: "Medium",   color: "#9ca3af", bg: "rgba(255,255,255,0.06)", dot: "#9ca3af" },
  low:      { label: "Low",      color: "#4b5563", bg: "rgba(255,255,255,0.04)", dot: "#4b5563" },
};

const STATUS_META: Record<Status, { label: string; color: string; bg: string }> = {
  active:    { label: "Active",    color: "#ffffff", bg: "rgba(255,255,255,0.1)"  },
  draft:     { label: "Draft",     color: "#9ca3af", bg: "rgba(255,255,255,0.05)" },
  completed: { label: "Completed", color: "#e5e7eb", bg: "rgba(255,255,255,0.08)" },
  archived:  { label: "Archived",  color: "#6b7280", bg: "rgba(255,255,255,0.03)"  },
};

// ─── Sub-Components ────────────────────────────────────────────────────────────

const Badge = ({ text, color, bg }: { text: string; color: string; bg: string }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", gap: 5,
    padding: "3px 10px", borderRadius: 20, fontSize: 11,
    fontFamily: "'Space Mono', monospace", letterSpacing: "0.04em",
    color, background: bg, border: `1px solid ${color}33`,
    fontWeight: 500, textTransform: "uppercase",
  }}>
    <span style={{ width: 5, height: 5, borderRadius: "50%", background: color, flexShrink: 0 }} />
    {text}
  </span>
);

const IconSearch = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
  </svg>
);

const IconPlus = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const IconClose = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

const IconEdit = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const IconTrash = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
);

const IconUsers = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const IconSteps = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);

// ─── Card ─────────────────────────────────────────────────────────────────────
const UseCaseCard = ({
  uc, onEdit, onDelete,
}: { uc: UseCase; onEdit: (u: UseCase) => void; onDelete: (id: string) => void }) => {
  const [hovered, setHovered] = useState(false);
  const pm = PRIORITY_META[uc.priority];
  const sm = STATUS_META[uc.status];

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        background: hovered
          ? "rgba(255,255,255,0.06)"
          : "rgba(255,255,255,0.02)",
        border: `1px solid ${hovered ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.08)"}`,
        borderRadius: 12,
        padding: "20px 22px",
        cursor: "pointer",
        transition: "all 0.22s cubic-bezier(0.4,0,0.2,1)",
        backdropFilter: "blur(12px)",
        boxShadow: hovered
          ? "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)"
          : "0 2px 8px rgba(0,0,0,0.3)",
        transform: hovered ? "translateY(-2px)" : "none",
        overflow: "hidden",
      }}
    >
      {/* Accent line top */}
      <div style={{
        position: "absolute", top: 0, left: 22, right: 22, height: 1,
        background: hovered ? `linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)` : "transparent",
        transition: "all 0.3s ease",
      }} />

      {/* Category tag */}
      <div style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{
          fontSize: 10, fontFamily: "'Space Mono', monospace", letterSpacing: "0.08em",
          color: "rgba(255,255,255,0.4)", textTransform: "uppercase",
        }}>
          {uc.category}
        </span>
        <div style={{ display: "flex", gap: 6, opacity: hovered ? 1 : 0, transition: "opacity 0.2s" }}>
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(uc); }}
            style={{
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 6, color: "white", cursor: "pointer", padding: "4px 8px",
              display: "flex", alignItems: "center",
            }}
          ><IconEdit /></button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(uc.id); }}
            style={{
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 6, color: "rgba(255,255,255,0.6)", cursor: "pointer", padding: "4px 8px",
              display: "flex", alignItems: "center",
            }}
          ><IconTrash /></button>
        </div>
      </div>

      {/* Title */}
      <h3 style={{
        margin: "0 0 8px", fontSize: 15, fontFamily: "'Outfit', sans-serif",
        fontWeight: 600, color: "#e8f4f8", lineHeight: 1.35, letterSpacing: "-0.01em",
      }}>{uc.name}</h3>

      {/* Description */}
      <p style={{
        margin: "0 0 16px", fontSize: 12.5, color: "rgba(180,210,225,0.6)",
        lineHeight: 1.6, display: "-webkit-box", WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical", overflow: "hidden",
      }}>{uc.description}</p>

      {/* Badges */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        <Badge text={pm.label} color={pm.color} bg={pm.bg} />
        <Badge text={sm.label} color={sm.color} bg={sm.bg} />
      </div>

      {/* Footer meta */}
      <div style={{
        borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 12,
        display: "flex", gap: 16, alignItems: "center",
      }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "rgba(255,255,255,0.35)" }}>
          <IconUsers />
          <span style={{ color: "rgba(255,255,255,0.5)" }}>{uc.actors.length} actor{uc.actors.length !== 1 ? "s" : ""}</span>
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "rgba(255,255,255,0.35)" }}>
          <IconSteps />
          <span style={{ color: "rgba(255,255,255,0.5)" }}>{uc.steps.length} steps</span>
        </span>
      </div>
    </div>
  );
};

// ─── Modal ─────────────────────────────────────────────────────────────────────
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
  const [activeTab, setActiveTab] = useState<"core" | "flow" | "conditions">("core");

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const addActor = () => {
    if (actorInput.trim()) {
      set("actors", [...form.actors, actorInput.trim()]);
      setActorInput("");
    }
  };

  const addStep = () =>
    set("steps", [...form.steps, { order: form.steps.length + 1, description: "" }]);

  const updateStep = (i: number, val: string) => {
    const steps = [...form.steps];
    steps[i] = { ...steps[i], description: val };
    set("steps", steps);
  };

  const removeStep = (i: number) =>
    set("steps", form.steps.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, order: idx + 1 })));

  const handleSave = () => {
    if (!form.name.trim()) return;
    onSave({
      ...form,
      id: initial?.id ?? uid(),
      createdAt: initial?.createdAt ?? new Date().toISOString().split("T")[0],
    });
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
    color: "#e8f4f8", fontSize: 13, padding: "9px 12px",
    outline: "none", fontFamily: "inherit", boxSizing: "border-box",
    transition: "border-color 0.2s",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 10.5, fontFamily: "'Space Mono', monospace",
    letterSpacing: "0.08em", color: "rgba(255,255,255,0.4)",
    textTransform: "uppercase", display: "block", marginBottom: 6,
  };

  const tabs = [
    { key: "core", label: "Core Info" },
    { key: "flow", label: "Steps & Actors" },
    { key: "conditions", label: "Conditions" },
  ] as const;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20,
    }}>
      <div style={{
        background: "#0a0a0a",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 16, width: "100%", maxWidth: 620,
        maxHeight: "90vh", display: "flex", flexDirection: "column",
        boxShadow: "0 24px 80px rgba(0,0,0,0.8)",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", marginBottom: 4 }}>
              {initial ? "EDIT USE CASE" : "NEW USE CASE"}
            </div>
            <h2 style={{ margin: 0, fontSize: 17, fontFamily: "'Outfit', sans-serif", fontWeight: 600, color: "#e8f4f8" }}>
              {initial ? initial.name : "Define Interaction"}
            </h2>
          </div>
          <button onClick={onClose} style={{
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8, color: "rgba(180,210,225,0.6)", cursor: "pointer",
            padding: "6px 8px", display: "flex", alignItems: "center",
          }}><IconClose /></button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", padding: "0 24px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              style={{
                background: "none", border: "none", cursor: "pointer",
                padding: "12px 16px 10px", fontSize: 12.5,
                fontFamily: "'Space Mono', monospace", letterSpacing: "0.03em",
                color: activeTab === t.key ? "white" : "rgba(255,255,255,0.3)",
                borderBottom: `2px solid ${activeTab === t.key ? "white" : "transparent"}`,
                transition: "all 0.2s", marginBottom: -1,
              }}
            >{t.label}</button>
          ))}
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
          {/* ── Tab: Core ── */}
          {activeTab === "core" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={labelStyle}>Name *</label>
                <input style={inputStyle} value={form.name} placeholder="e.g. Reset Password"
                  onChange={(e) => set("name", e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Description</label>
                <textarea style={{ ...inputStyle, resize: "vertical", minHeight: 80 }}
                  value={form.description} placeholder="Describe the goal of this interaction…"
                  onChange={(e) => set("description", e.target.value)} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Category</label>
                  <input style={inputStyle} value={form.category} placeholder="e.g. Auth"
                    onChange={(e) => set("category", e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>Priority</label>
                  <select style={{ ...inputStyle, cursor: "pointer" }} value={form.priority}
                    onChange={(e) => set("priority", e.target.value as Priority)}>
                    {(["critical", "high", "medium", "low"] as Priority[]).map((p) => (
                      <option key={p} value={p} style={{ background: "#0d1f31" }}>{PRIORITY_META[p].label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Status</label>
                  <select style={{ ...inputStyle, cursor: "pointer" }} value={form.status}
                    onChange={(e) => set("status", e.target.value as Status)}>
                    {(["draft", "active", "completed", "archived"] as Status[]).map((s) => (
                      <option key={s} value={s} style={{ background: "#0d1f31" }}>{STATUS_META[s].label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* ── Tab: Flow ── */}
          {activeTab === "flow" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Actors */}
              <div>
                <label style={labelStyle}>Actors</label>
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  <input style={{ ...inputStyle, flex: 1 }} value={actorInput}
                    placeholder="Add actor role…"
                    onChange={(e) => setActorInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addActor()} />
                  <button onClick={addActor} style={{
                    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: 8, color: "white", cursor: "pointer", padding: "0 14px",
                    fontSize: 18, display: "flex", alignItems: "center",
                  }}>+</button>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {form.actors.map((a, i) => (
                    <span key={i} style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 20, padding: "4px 10px", fontSize: 12, color: "white",
                    }}>
                      {a}
                      <span onClick={() => set("actors", form.actors.filter((_, j) => j !== i))}
                        style={{ cursor: "pointer", opacity: 0.6, fontSize: 14 }}>×</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Steps */}
              <div>
                <label style={labelStyle}>Sequential Steps</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {form.steps.map((s, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{
                        width: 24, height: 24, borderRadius: "50%",
                        background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 10, fontFamily: "'Space Mono', monospace",
                        color: "white", flexShrink: 0,
                      }}>{s.order}</span>
                      <input style={{ ...inputStyle, flex: 1 }} value={s.description}
                        placeholder={`Step ${s.order} description…`}
                        onChange={(e) => updateStep(i, e.target.value)} />
                      {form.steps.length > 1 && (
                        <button onClick={() => removeStep(i)} style={{
                          background: "rgba(255,69,96,0.06)", border: "1px solid rgba(255,69,96,0.15)",
                          borderRadius: 6, color: "#ff4560", cursor: "pointer", padding: "6px 8px",
                          display: "flex", alignItems: "center",
                        }}><IconTrash /></button>
                      )}
                    </div>
                  ))}
                </div>
                <button onClick={addStep} style={{
                  marginTop: 10, background: "rgba(255,255,255,0.02)",
                  border: "1px dashed rgba(255,255,255,0.1)", borderRadius: 8,
                  color: "rgba(255,255,255,0.3)", cursor: "pointer", padding: "8px 16px",
                  fontSize: 12, fontFamily: "'Space Mono', monospace", width: "100%",
                  transition: "all 0.2s",
                }}>+ Add Step</button>
              </div>
            </div>
          )}

          {/* ── Tab: Conditions ── */}
          {activeTab === "conditions" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={labelStyle}>Preconditions</label>
                <div style={{
                  fontSize: 11, color: "rgba(255,255,255,0.2)", marginBottom: 8,
                  fontFamily: "'Space Mono', monospace",
                }}>State that must be true before this interaction begins</div>
                <textarea style={{ ...inputStyle, resize: "vertical", minHeight: 100 }}
                  value={form.preconditions} placeholder="e.g. User has a verified account. Service is running."
                  onChange={(e) => set("preconditions", e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Postconditions</label>
                <div style={{
                  fontSize: 11, color: "rgba(255,255,255,0.2)", marginBottom: 8,
                  fontFamily: "'Space Mono', monospace",
                }}>Expected outcome after successful completion</div>
                <textarea style={{ ...inputStyle, resize: "vertical", minHeight: 100 }}
                  value={form.postconditions} placeholder="e.g. Session is created. User is redirected to dashboard."
                  onChange={(e) => set("postconditions", e.target.value)} />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "14px 24px", borderTop: "1px solid rgba(255,255,255,0.06)",
          display: "flex", justifyContent: "flex-end", gap: 10, flexShrink: 0,
        }}>
          <button onClick={onClose} style={{
            background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8, color: "rgba(255,255,255,0.5)", cursor: "pointer",
            padding: "9px 20px", fontSize: 13, fontFamily: "inherit",
          }}>Cancel</button>
          <button onClick={handleSave} style={{
            background: "white",
            border: "none", borderRadius: 8,
            color: "black", cursor: "pointer", padding: "9px 22px",
            fontSize: 13, fontFamily: "inherit", fontWeight: 700,
            boxShadow: "0 8px 16px rgba(0,0,0,0.4)",
          }}>
            {initial ? "Save Changes" : "Create Use Case"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Detail Drawer ─────────────────────────────────────────────────────────────
const Drawer = ({ uc, onClose, onEdit }: { uc: UseCase; onClose: () => void; onEdit: () => void }) => {
  const pm = PRIORITY_META[uc.priority];
  const sm = STATUS_META[uc.status];

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 900,
      display: "flex", justifyContent: "flex-end",
    }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 440, height: "100%", overflowY: "auto",
          background: "#050508",
          borderLeft: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "-20px 0 60px rgba(0,0,0,0.8)",
          padding: "28px 28px 40px",
          display: "flex", flexDirection: "column", gap: 20,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ flex: 1, paddingRight: 12 }}>
            <div style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: "rgba(255,255,255,0.45)", letterSpacing: "0.1em", marginBottom: 6 }}>
              {uc.category} · {uc.id.toUpperCase()}
            </div>
            <h2 style={{ margin: 0, fontSize: 18, fontFamily: "'Outfit', sans-serif", fontWeight: 600, color: "#e8f4f8", lineHeight: 1.3 }}>{uc.name}</h2>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button onClick={onEdit} style={{
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 8, color: "white", cursor: "pointer", padding: "7px 12px",
              display: "flex", alignItems: "center", gap: 6, fontSize: 12,
            }}><IconEdit /> Edit</button>
            <button onClick={onClose} style={{
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8, color: "rgba(180,210,225,0.5)", cursor: "pointer",
              padding: "7px 9px", display: "flex", alignItems: "center",
            }}><IconClose /></button>
          </div>
        </div>

        {/* Badges */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Badge text={pm.label} color={pm.color} bg={pm.bg} />
          <Badge text={sm.label} color={sm.color} bg={sm.bg} />
        </div>

        {/* Description */}
        <p style={{ margin: 0, fontSize: 13.5, color: "rgba(180,210,225,0.65)", lineHeight: 1.7 }}>{uc.description}</p>

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 4 }} />

        {/* Actors */}
        <div>
          <div style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: "rgba(255,255,255,0.45)", letterSpacing: "0.08em", marginBottom: 10 }}>ACTORS</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {uc.actors.map((a, i) => (
              <span key={i} style={{
                background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.18)",
                borderRadius: 20, padding: "4px 12px", fontSize: 12, color: "#a8d8ea",
              }}>{a}</span>
            ))}
          </div>
        </div>

        {/* Steps */}
        <div>
          <div style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: "rgba(255,255,255,0.45)", letterSpacing: "0.08em", marginBottom: 12 }}>FLOW — {uc.steps.length} STEPS</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {uc.steps.map((s, i) => (
              <div key={i} style={{ display: "flex", gap: 14 }}>
                {/* Timeline line */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: "50%",
                    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 9, fontFamily: "'Space Mono', monospace", color: "white",
                  }}>{s.order}</div>
                  {i < uc.steps.length - 1 && (
                    <div style={{ width: 1, flex: 1, minHeight: 16, background: "linear-gradient(180deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.05) 100%)", marginTop: 4 }} />
                  )}
                </div>
                <div style={{ paddingBottom: i < uc.steps.length - 1 ? 14 : 0, paddingTop: 2 }}>
                  <p style={{ margin: 0, fontSize: 13, color: "rgba(180,210,225,0.75)", lineHeight: 1.6 }}>{s.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Conditions */}
        {(uc.preconditions || uc.postconditions) && (
          <>
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 4 }} />
            {uc.preconditions && (
              <div>
                <div style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: "rgba(255,255,255,0.4)", letterSpacing: "0.08em", marginBottom: 8 }}>PRECONDITIONS</div>
                <p style={{ margin: 0, fontSize: 12.5, color: "rgba(255,255,255,0.6)", lineHeight: 1.6, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "10px 12px" }}>{uc.preconditions}</p>
              </div>
            )}
            {uc.postconditions && (
              <div>
                <div style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: "rgba(255,255,255,0.4)", letterSpacing: "0.08em", marginBottom: 8 }}>POSTCONDITIONS</div>
                <p style={{ margin: 0, fontSize: 12.5, color: "rgba(255,255,255,0.6)", lineHeight: 1.6, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "10px 12px" }}>{uc.postconditions}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function UseCasesPage() {
  const api = useApi();
  const { project } = useProjectStore();
  const [useCases, setUseCases] = useState<UseCase[]>(SEED);
  const [search, setSearch] = useState("");
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

  const selectStyle: React.CSSProperties = {
    width: "100%", background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
    color: "#e8f4f8", fontSize: 12.5, padding: "8px 12px",
    outline: "none", fontFamily: "'Space Mono', monospace",
    boxSizing: "border-box", transition: "border-color 0.2s",
    cursor: "pointer",
  };

  return (
    <div style={{
      height: "100%", overflowY: "auto", position: "relative",
      background: "var(--ide-bg)",
      color: "var(--ide-text)",
    }}>
      {/* Background grid */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none",
        backgroundImage: `
          linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)
        `,
        backgroundSize: "48px 48px",
      }} />

      <div style={{ position: "relative", maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: 32, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, animation: "fadeSlideUp 0.5s ease-out both" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{
                width: 6, height: 24, background: "linear-gradient(180deg, #ffffff, rgba(255,255,255,0.1))",
                borderRadius: 3,
              }} />
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: "-0.025em", color: "var(--ide-text)" }}>
                Use Cases
              </h1>
            </div>
            <p style={{ margin: 0, fontSize: 13.5, color: "var(--ide-text-secondary)", paddingLeft: 16, fontFamily: "'Space Mono', monospace" }}>
              {stats.total} total · {stats.active} active · {stats.critical} critical
            </p>
          </div>
          <button
            onClick={() => { setEditTarget(undefined); setModalOpen(true); }}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.06) 100%)",
              border: "1px solid rgba(255,255,255,0.25)", borderRadius: 10,
              color: "#ffffff", cursor: "pointer", padding: "10px 20px",
              fontSize: 13.5, fontFamily: "inherit", fontWeight: 600,
              boxShadow: "0 0 20px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.05)",
              transition: "all 0.2s",
            }}
          >
            <IconPlus /> New Use Case
          </button>
        </div>

        {/* ── Stats ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 28 }}>
          {[
            { label: "Total", value: stats.total, color: "#ffffff" },
            { label: "Active", value: stats.active, color: "#e5e7eb" },
            { label: "Critical", value: stats.critical, color: "#ffffff" },
            { label: "Draft", value: stats.draft, color: "#9ca3af" },
          ].map((s) => (
            <div key={s.label} style={{
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 10, padding: "14px 18px",
              borderTop: `2px solid ${s.color}33`,
            }}>
              <div style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: "var(--ide-text-secondary)", letterSpacing: "0.08em", marginBottom: 6 }}>{s.label.toUpperCase()}</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: s.color, letterSpacing: "-0.02em", fontFamily: "'Outfit', sans-serif" }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* ── Filters ── */}
        <div style={{
          display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24,
          background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 12, padding: "14px 16px",
        }}>
          {/* Search */}
          <div style={{ flex: 1, minWidth: 200, position: "relative", display: "flex", alignItems: "center" }}>
            <span style={{ position: "absolute", left: 12, color: "rgba(255,255,255,0.4)", display: "flex" }}><IconSearch /></span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search use cases…"
              style={{
                width: "100%", background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8,
                color: "#e8f4f8", fontSize: 13, padding: "8px 12px 8px 36px",
                outline: "none", fontFamily: "inherit", boxSizing: "border-box",
              }}
            />
          </div>

          <select style={selectStyle} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as Status | "all")}>
            <option value="all" style={{ background: "#0d1f31" }}>All Statuses</option>
            {(["draft", "active", "completed", "archived"] as Status[]).map((s) => (
              <option key={s} value={s} style={{ background: "#0d1f31" }}>{STATUS_META[s].label}</option>
            ))}
          </select>

          <select style={selectStyle} value={filterPriority} onChange={(e) => setFilterPriority(e.target.value as Priority | "all")}>
            <option value="all" style={{ background: "#0d1f31" }}>All Priorities</option>
            {(["critical", "high", "medium", "low"] as Priority[]).map((p) => (
              <option key={p} value={p} style={{ background: "#0d1f31" }}>{PRIORITY_META[p].label}</option>
            ))}
          </select>

          <select style={selectStyle} value={filterActor} onChange={(e) => setFilterActor(e.target.value)}>
            <option value="all" style={{ background: "#0d1f31" }}>All Actors</option>
            {allActors.map((a) => (
              <option key={a} value={a} style={{ background: "#0d1f31" }}>{a}</option>
            ))}
          </select>

          {(search || filterStatus !== "all" || filterPriority !== "all" || filterActor !== "all") && (
            <button onClick={() => { setSearch(""); setFilterStatus("all"); setFilterPriority("all"); setFilterActor("all"); }}
              style={{
                background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: 8, color: "white", cursor: "pointer", padding: "8px 14px",
                fontSize: 11.5, fontFamily: "'Space Mono', monospace",
              }}>Clear</button>
          )}
        </div>

        {/* ── Grid ── */}
        {filtered.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "80px 0",
              color: "var(--ide-text-secondary)", fontFamily: "'Space Mono', monospace", fontSize: 13,
          }}>
            <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.3 }}>◈</div>
            No use cases match your filters.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
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

      {/* Font import */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(0,212,255,0.15); border-radius: 3px; }
        input::placeholder, textarea::placeholder { color: rgba(255,255,255,0.25); }
        select option { background: #0a0a0a; color: #e8f4f8; }
      `}</style>
    </div>
  );
}
