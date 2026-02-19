/**
 * LogicCanvas - Node-based visual logic flow editor
 *
 * Three-panel layout:
 *   Left   – flow list (create / select / delete)
 *   Center – SVG + HTML canvas with draggable nodes and bezier wires
 *   Right  – node palette (drag to add) + selected-node inspector
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useProjectStore } from "../../../hooks/useProjectStore";
import { addLogicFlow, deleteLogicFlow, updateLogicFlow } from "../../../stores/projectStore";
import { LogicNode, TriggerType } from "../../../hooks/useTauri";

// ─── Node type metadata ──────────────────────────────

interface NodeMeta {
    label: string;
    color: string;       // tailwind gradient classes
    borderColor: string;  // for SVG port
    icon: string;         // SVG path
    category: string;
    hasElse?: boolean;    // shows else output port
}

const NODE_META: Record<string, NodeMeta> = {
    // Control Flow
    condition: { label: "Condition", color: "from-amber-500/15 to-orange-500/15", borderColor: "#f59e0b", icon: "M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z", category: "Control Flow", hasElse: true },
    for_each: { label: "For Each", color: "from-amber-500/15 to-orange-500/15", borderColor: "#f59e0b", icon: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15", category: "Control Flow" },
    while: { label: "While", color: "from-amber-500/15 to-orange-500/15", borderColor: "#f59e0b", icon: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15", category: "Control Flow", hasElse: true },
    delay: { label: "Delay", color: "from-amber-500/15 to-orange-500/15", borderColor: "#f59e0b", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z", category: "Control Flow" },
    try_catch: { label: "Try / Catch", color: "from-amber-500/15 to-orange-500/15", borderColor: "#f59e0b", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z", category: "Control Flow", hasElse: true },

    // Data
    set_variable: { label: "Set Variable", color: "from-violet-500/15 to-purple-500/15", borderColor: "#8b5cf6", icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z", category: "Data" },
    get_variable: { label: "Get Variable", color: "from-violet-500/15 to-purple-500/15", borderColor: "#8b5cf6", icon: "M15 12a3 3 0 11-6 0 3 3 0 016 0z", category: "Data" },
    transform: { label: "Transform", color: "from-violet-500/15 to-purple-500/15", borderColor: "#8b5cf6", icon: "M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z", category: "Data" },

    // UI Actions
    navigate: { label: "Navigate", color: "from-sky-500/15 to-blue-500/15", borderColor: "#0ea5e9", icon: "M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z", category: "UI Actions" },
    alert: { label: "Alert / Toast", color: "from-sky-500/15 to-blue-500/15", borderColor: "#0ea5e9", icon: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9", category: "UI Actions" },
    open_modal: { label: "Open Modal", color: "from-sky-500/15 to-blue-500/15", borderColor: "#0ea5e9", icon: "M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z", category: "UI Actions" },
    close_modal: { label: "Close Modal", color: "from-sky-500/15 to-blue-500/15", borderColor: "#0ea5e9", icon: "M6 18L18 6M6 6l12 12", category: "UI Actions" },
    set_property: { label: "Set Property", color: "from-sky-500/15 to-blue-500/15", borderColor: "#0ea5e9", icon: "M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01", category: "UI Actions" },

    // API / Network
    fetch_api: { label: "Fetch API", color: "from-cyan-500/15 to-teal-500/15", borderColor: "#06b6d4", icon: "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z", category: "API" },
    http_request: { label: "HTTP Request", color: "from-cyan-500/15 to-teal-500/15", borderColor: "#06b6d4", icon: "M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9", category: "API" },

    // Database
    db_create: { label: "DB Create", color: "from-emerald-500/15 to-green-500/15", borderColor: "#10b981", icon: "M12 4v16m8-8H4", category: "Database" },
    db_read: { label: "DB Read", color: "from-emerald-500/15 to-green-500/15", borderColor: "#10b981", icon: "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4", category: "Database" },
    db_update: { label: "DB Update", color: "from-emerald-500/15 to-green-500/15", borderColor: "#10b981", icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z", category: "Database" },
    db_delete: { label: "DB Delete", color: "from-emerald-500/15 to-green-500/15", borderColor: "#10b981", icon: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16", category: "Database" },

    // Response
    return: { label: "Return", color: "from-rose-500/15 to-red-500/15", borderColor: "#f43f5e", icon: "M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z", category: "Response" },
    throw_error: { label: "Throw Error", color: "from-rose-500/15 to-red-500/15", borderColor: "#f43f5e", icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z", category: "Response" },

    // Custom
    custom_code: { label: "Custom Code", color: "from-slate-500/15 to-zinc-500/15", borderColor: "#64748b", icon: "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4", category: "Custom" },

    // Integration
    send_email: { label: "Send Email", color: "from-pink-500/15 to-fuchsia-500/15", borderColor: "#ec4899", icon: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z", category: "Integration" },
};

const getMeta = (type: string): NodeMeta =>
    NODE_META[type] || { label: type, color: "from-slate-500/15 to-zinc-500/15", borderColor: "#64748b", icon: "M13 10V3L4 14h7v7l9-11h-7z", category: "Other" };

// ─── Palette categories ──────────────────────────────

const PALETTE_CATEGORIES = [
    {
        name: "Control Flow",
        types: ["condition", "for_each", "while", "delay", "try_catch"],
    },
    {
        name: "Data",
        types: ["set_variable", "get_variable", "transform"],
    },
    {
        name: "UI Actions",
        types: ["navigate", "alert", "open_modal", "close_modal", "set_property"],
    },
    {
        name: "API",
        types: ["fetch_api", "http_request"],
    },
    {
        name: "Database",
        types: ["db_create", "db_read", "db_update", "db_delete"],
    },
    {
        name: "Response",
        types: ["return", "throw_error"],
    },
    {
        name: "Custom",
        types: ["custom_code", "send_email"],
    },
];

// ─── Constants ───────────────────────────────────────

const NODE_W = 200;
const NODE_H = 56;
const PORT_R = 6;
const GRID_SIZE = 20;
const DEFAULT_EVENT_NAME = "onClick";
const FRONTEND_TRIGGER_TYPES: TriggerType["type"][] = ["manual", "event", "mount"];
const BACKEND_TRIGGER_TYPES: TriggerType["type"][] = ["manual", "api", "schedule"];

function snapToGrid(v: number): number {
    return Math.round(v / GRID_SIZE) * GRID_SIZE;
}

// Port positions relative to node origin
function inPortPos(node: LogicNode) {
    return { x: node.position.x, y: node.position.y + NODE_H / 2 };
}
function outPortPos(node: LogicNode) {
    return { x: node.position.x + NODE_W, y: node.position.y + NODE_H / 2 - (getMeta(node.node_type).hasElse ? 8 : 0) };
}
function elsePortPos(node: LogicNode) {
    return { x: node.position.x + NODE_W, y: node.position.y + NODE_H / 2 + 8 };
}

// Bezier curve between two points
function bezierPath(x1: number, y1: number, x2: number, y2: number): string {
    const dx = Math.abs(x2 - x1);
    const cpOffset = Math.max(50, dx * 0.4);
    return `M${x1},${y1} C${x1 + cpOffset},${y1} ${x2 - cpOffset},${y2} ${x2},${y2}`;
}

// ─── Drag state types ────────────────────────────────

interface NodeDrag {
    kind: "node";
    nodeId: string;
    offsetX: number;
    offsetY: number;
}

interface WireDrag {
    kind: "wire";
    fromNodeId: string;
    fromPort: "next" | "else";
    mouseX: number;
    mouseY: number;
}

type CanvasDrag = NodeDrag | WireDrag | null;

// ─── Main Component ──────────────────────────────────

const LogicCanvas: React.FC = () => {
    const { project } = useProjectStore();
    const flows = project?.logic_flows.filter((f) => !f.archived) || [];

    const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [drag, setDrag] = useState<CanvasDrag>(null);
    const [paletteDragOver, setPaletteDragOver] = useState(false);
    const [triggerDraft, setTriggerDraft] = useState<TriggerType | null>(null);
    const [triggerDirty, setTriggerDirty] = useState(false);
    const [triggerSaving, setTriggerSaving] = useState(false);
    const [triggerError, setTriggerError] = useState<string | null>(null);

    const canvasRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);

    const selectedFlow = flows.find((f) => f.id === selectedFlowId) || null;

    // Auto-select first flow
    useEffect(() => {
        if (!selectedFlowId && flows.length > 0) {
            setSelectedFlowId(flows[0].id);
        }
    }, [flows.length]);

    useEffect(() => {
        if (!selectedFlow) {
            setTriggerDraft(null);
            setTriggerDirty(false);
            setTriggerError(null);
            return;
        }
        setTriggerDraft(selectedFlow.trigger as TriggerType);
        setTriggerDirty(false);
        setTriggerError(null);
    }, [
        selectedFlow?.id,
        selectedFlow?.trigger?.type,
        (selectedFlow?.trigger as TriggerType | undefined)?.component_id,
        (selectedFlow?.trigger as TriggerType | undefined)?.event,
        (selectedFlow?.trigger as TriggerType | undefined)?.api_id,
        (selectedFlow?.trigger as TriggerType | undefined)?.cron,
    ]);

    const availableApis = useMemo(
        () => (project?.apis || []).filter((api) => !api.archived),
        [project],
    );

    const componentTargetOptions = useMemo(() => {
        if (!project) return [] as Array<{ id: string; label: string }>;
        const options = new Map<string, string>();

        for (const page of project.pages) {
            if (!page.archived) {
                options.set(page.id, `Page: ${page.name}`);
            }
        }
        for (const component of project.components) {
            if (!component.archived) {
                options.set(component.id, `Component: ${component.name}`);
            }
        }
        for (const block of project.blocks) {
            if (!block.archived) {
                options.set(block.id, `Block: ${block.name}`);
            }
        }

        return Array.from(options.entries()).map(([id, label]) => ({ id, label }));
    }, [project]);

    const allowedTriggerTypes =
        selectedFlow?.context === "backend" ? BACKEND_TRIGGER_TYPES : FRONTEND_TRIGGER_TYPES;

    const updateTriggerDraft = (next: TriggerType) => {
        setTriggerDraft(next);
        setTriggerDirty(true);
        setTriggerError(null);
    };

    const setTriggerType = (type: TriggerType["type"]) => {
        const current = triggerDraft;
        if (type === "event") {
            updateTriggerDraft({
                type,
                component_id: current?.component_id || "",
                event: current?.event || DEFAULT_EVENT_NAME,
            });
            return;
        }
        if (type === "api") {
            const fallbackApiId = availableApis[0]?.id || "";
            updateTriggerDraft({
                type,
                api_id: current?.api_id || fallbackApiId,
            });
            return;
        }
        if (type === "mount") {
            updateTriggerDraft({
                type,
                component_id: current?.component_id || "",
            });
            return;
        }
        if (type === "schedule") {
            updateTriggerDraft({
                type,
                cron: current?.cron || "*/5 * * * *",
            });
            return;
        }
        updateTriggerDraft({ type: "manual" });
    };

    const validateTrigger = (trigger: TriggerType): string | null => {
        if (trigger.type === "event") {
            if (!trigger.component_id?.trim()) return "Event trigger requires a component/page/block ID.";
            if (!trigger.event?.trim()) return "Event trigger requires an event name.";
        } else if (trigger.type === "api") {
            if (!trigger.api_id?.trim()) return "API trigger requires an API ID.";
        } else if (trigger.type === "mount") {
            if (!trigger.component_id?.trim()) return "Mount trigger requires a component/page/block ID.";
        } else if (trigger.type === "schedule") {
            if (!trigger.cron?.trim()) return "Schedule trigger requires a cron expression.";
        }
        return null;
    };

    const normalizeTrigger = (trigger: TriggerType): TriggerType => {
        if (trigger.type === "event") {
            return {
                type: "event",
                component_id: trigger.component_id?.trim(),
                event: trigger.event?.trim(),
            };
        }
        if (trigger.type === "api") {
            return {
                type: "api",
                api_id: trigger.api_id?.trim(),
            };
        }
        if (trigger.type === "mount") {
            return {
                type: "mount",
                component_id: trigger.component_id?.trim(),
            };
        }
        if (trigger.type === "schedule") {
            return {
                type: "schedule",
                cron: trigger.cron?.trim(),
            };
        }
        return { type: "manual" };
    };

    const handleSaveTrigger = async () => {
        if (!selectedFlow || !triggerDraft) return;
        const error = validateTrigger(triggerDraft);
        if (error) {
            setTriggerError(error);
            return;
        }

        const normalized = normalizeTrigger(triggerDraft);
        setTriggerSaving(true);
        try {
            await updateLogicFlow(selectedFlow.id, { trigger: normalized });
            setTriggerDraft(normalized);
            setTriggerDirty(false);
            setTriggerError(null);
        } catch (err) {
            setTriggerError(`Failed to update trigger: ${String(err)}`);
        } finally {
            setTriggerSaving(false);
        }
    };

    const handleResetTrigger = () => {
        if (!selectedFlow) return;
        setTriggerDraft(selectedFlow.trigger as TriggerType);
        setTriggerDirty(false);
        setTriggerError(null);
    };

    // ── Save helper (sends full nodes array to backend) ──
    const saveNodes = useCallback(
        async (nodes: LogicNode[], entryId?: string | null) => {
            if (!selectedFlow) return;
            const updates: { nodes: LogicNode[]; entry_node_id?: string | null } = { nodes };
            if (entryId !== undefined) updates.entry_node_id = entryId;
            await updateLogicFlow(selectedFlow.id, updates);
        },
        [selectedFlow],
    );

    // ── Node drag (mousedown on node header) ──
    const onNodeMouseDown = useCallback(
        (e: React.MouseEvent, nodeId: string) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            const el = (e.target as HTMLElement).closest("[data-node-id]") as HTMLElement;
            if (!el || !canvasRef.current) return;
            const cr = canvasRef.current.getBoundingClientRect();
            const nr = el.getBoundingClientRect();
            setDrag({
                kind: "node",
                nodeId,
                offsetX: e.clientX - nr.left + (nr.left - cr.left) + canvasRef.current.scrollLeft - snapToGrid(0),
                offsetY: e.clientY - nr.top + (nr.top - cr.top) + canvasRef.current.scrollTop - snapToGrid(0),
            });
            setSelectedNodeId(nodeId);
        },
        [],
    );

    // ── Wire drag (mousedown on output port) ──
    const onPortMouseDown = useCallback(
        (e: React.MouseEvent, nodeId: string, port: "next" | "else") => {
            e.stopPropagation();
            e.preventDefault();
            if (!canvasRef.current) return;
            const cr = canvasRef.current.getBoundingClientRect();
            setDrag({
                kind: "wire",
                fromNodeId: nodeId,
                fromPort: port,
                mouseX: e.clientX - cr.left + canvasRef.current.scrollLeft,
                mouseY: e.clientY - cr.top + canvasRef.current.scrollTop,
            });
        },
        [],
    );

    // ── Global mouse move / up ──
    useEffect(() => {
        if (!drag) return;

        const onMove = (e: MouseEvent) => {
            if (!canvasRef.current) return;
            const cr = canvasRef.current.getBoundingClientRect();

            if (drag.kind === "node" && selectedFlow) {
                // Live preview via DOM (we persist on mouseup)
                const el = canvasRef.current.querySelector(`[data-node-id="${drag.nodeId}"]`) as HTMLElement;
                if (el) {
                    const rawX = e.clientX - cr.left + canvasRef.current.scrollLeft - drag.offsetX;
                    const rawY = e.clientY - cr.top + canvasRef.current.scrollTop - drag.offsetY;
                    el.style.left = `${snapToGrid(Math.max(0, rawX))}px`;
                    el.style.top = `${snapToGrid(Math.max(0, rawY))}px`;
                }
            } else if (drag.kind === "wire") {
                setDrag({
                    ...drag,
                    mouseX: e.clientX - cr.left + canvasRef.current.scrollLeft,
                    mouseY: e.clientY - cr.top + canvasRef.current.scrollTop,
                });
            }
        };

        const onUp = async (e: MouseEvent) => {
            if (!canvasRef.current || !selectedFlow) {
                setDrag(null);
                return;
            }
            const cr = canvasRef.current.getBoundingClientRect();

            if (drag.kind === "node") {
                const rawX = e.clientX - cr.left + canvasRef.current.scrollLeft - drag.offsetX;
                const rawY = e.clientY - cr.top + canvasRef.current.scrollTop - drag.offsetY;
                const fx = snapToGrid(Math.max(0, rawX));
                const fy = snapToGrid(Math.max(0, rawY));
                const newNodes = selectedFlow.nodes.map((n) =>
                    n.id === drag.nodeId ? { ...n, position: { x: fx, y: fy } } : n,
                );
                await saveNodes(newNodes);
            } else if (drag.kind === "wire") {
                // Find which node the mouse is over (input port)
                const mx = e.clientX - cr.left + canvasRef.current.scrollLeft;
                const my = e.clientY - cr.top + canvasRef.current.scrollTop;
                const targetNode = selectedFlow.nodes.find((n) => {
                    if (n.id === drag.fromNodeId) return false;
                    const ip = inPortPos(n);
                    return Math.abs(mx - ip.x) < 20 && Math.abs(my - ip.y) < 20;
                });
                if (targetNode) {
                    const newNodes = selectedFlow.nodes.map((n) => {
                        if (n.id !== drag.fromNodeId) return n;
                        if (drag.fromPort === "next") {
                            const next = n.next_nodes.includes(targetNode.id)
                                ? n.next_nodes
                                : [...n.next_nodes, targetNode.id];
                            return { ...n, next_nodes: next };
                        } else {
                            const els = n.else_nodes.includes(targetNode.id)
                                ? n.else_nodes
                                : [...n.else_nodes, targetNode.id];
                            return { ...n, else_nodes: els };
                        }
                    });
                    await saveNodes(newNodes);
                }
            }
            setDrag(null);
        };

        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
        return () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
    }, [drag, selectedFlow, saveNodes]);

    // ── Flow management ──
    const handleCreateFlow = async () => {
        const name = window.prompt("Flow name:", "New Flow");
        if (!name?.trim()) return;
        await addLogicFlow(name.trim(), "frontend");
    };

    const handleDeleteFlow = async (id: string) => {
        if (!window.confirm("Delete this flow?")) return;
        await deleteLogicFlow(id);
        if (selectedFlowId === id) setSelectedFlowId(null);
    };

    // ── Add node from palette drop ──
    const handleCanvasDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setPaletteDragOver(false);
        const nodeType = e.dataTransfer.getData("application/logic-node");
        if (!nodeType || !selectedFlow || !canvasRef.current) return;

        const cr = canvasRef.current.getBoundingClientRect();
        const x = snapToGrid(e.clientX - cr.left + canvasRef.current.scrollLeft);
        const y = snapToGrid(e.clientY - cr.top + canvasRef.current.scrollTop);

        const meta = getMeta(nodeType);
        const newNode: LogicNode = {
            id: crypto.randomUUID(),
            node_type: nodeType,
            data: {},
            label: meta.label,
            next_nodes: [],
            else_nodes: [],
            position: { x, y },
        };

        const newNodes = [...selectedFlow.nodes, newNode];
        const entryId = selectedFlow.nodes.length === 0 ? newNode.id : undefined;
        await saveNodes(newNodes, entryId);
    };

    const handleCanvasDragOver = (e: React.DragEvent) => {
        if (e.dataTransfer.types.includes("application/logic-node")) {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
            setPaletteDragOver(true);
        }
    };

    // ── Delete node ──
    const handleDeleteNode = async (nodeId: string) => {
        if (!selectedFlow) return;
        const node = selectedFlow.nodes.find(n => n.id === nodeId);
        if (!confirm(`Delete node "${node?.label || nodeId}"?`)) return;
        const newNodes = selectedFlow.nodes
            .filter((n) => n.id !== nodeId)
            .map((n) => ({
                ...n,
                next_nodes: n.next_nodes.filter((id) => id !== nodeId),
                else_nodes: n.else_nodes.filter((id) => id !== nodeId),
            }));
        const entryId = selectedFlow.entry_node_id === nodeId
            ? (newNodes[0]?.id || null)
            : undefined;
        setSelectedNodeId(null);
        await saveNodes(newNodes, entryId);
    };

    // ── Delete wire ──
    const handleDeleteWire = async (fromId: string, toId: string, port: "next" | "else") => {
        if (!selectedFlow) return;
        if (!confirm("Remove this connection?")) return;
        const newNodes = selectedFlow.nodes.map((n) => {
            if (n.id !== fromId) return n;
            if (port === "next") return { ...n, next_nodes: n.next_nodes.filter((id) => id !== toId) };
            return { ...n, else_nodes: n.else_nodes.filter((id) => id !== toId) };
        });
        await saveNodes(newNodes);
    };

    // ── Render ──

    if (!project) {
        return (
            <div className="h-full flex items-center justify-center bg-[var(--ide-bg)]">
                <p className="text-sm text-[var(--ide-text-secondary)]">Open a project to use the Logic editor.</p>
            </div>
        );
    }

    // Build node map for wire drawing
    const nodeMap = new Map<string, LogicNode>();
    if (selectedFlow) selectedFlow.nodes.forEach((n) => nodeMap.set(n.id, n));

    return (
        <div className="h-full flex bg-[var(--ide-bg)]">
            {/* ═══ LEFT: Flow List ═══ */}
            <div className="w-52 bg-[var(--ide-chrome)] border-r border-[var(--ide-border)] flex flex-col flex-shrink-0">
                <div className="h-9 px-3 flex items-center justify-between border-b border-[var(--ide-border)]">
                    <span className="text-[11px] font-semibold text-[var(--ide-text-secondary)] uppercase tracking-wider">Flows</span>
                    <button
                        onClick={handleCreateFlow}
                        className="w-5 h-5 flex items-center justify-center rounded text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-bg-elevated)] transition-colors"
                        title="New Flow"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                        </svg>
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
                    {flows.map((flow) => {
                        const active = flow.id === selectedFlowId;
                        return (
                            <div
                                key={flow.id}
                                className={[
                                    "group flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs cursor-pointer transition-colors",
                                    active
                                        ? "bg-[var(--ide-accent-subtle)] text-[var(--ide-text)]"
                                        : "text-[var(--ide-text-secondary)] hover:bg-[var(--ide-bg-elevated)] hover:text-[var(--ide-text)]",
                                ].join(" ")}
                                onClick={() => { setSelectedFlowId(flow.id); setSelectedNodeId(null); }}
                            >
                                <svg className="w-3.5 h-3.5 shrink-0 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                <span className="flex-1 truncate">{flow.name}</span>
                                <span className="text-[9px] uppercase opacity-40 tracking-wider">{flow.context === "frontend" ? "FE" : "BE"}</span>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDeleteFlow(flow.id); }}
                                    className="hidden group-hover:flex w-4 h-4 items-center justify-center rounded text-[var(--ide-text-muted)] hover:text-red-400 transition-colors"
                                    title="Delete"
                                >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        );
                    })}
                    {flows.length === 0 && (
                        <p className="text-[11px] text-[var(--ide-text-muted)] px-2 py-4 text-center">
                            No flows yet. Click + to create one.
                        </p>
                    )}
                </div>
            </div>

            {/* ═══ CENTER: Canvas ═══ */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Toolbar */}
                {selectedFlow && (
                    <>
                        <div className="h-9 bg-[var(--ide-chrome)] border-b border-[var(--ide-border)] flex items-center px-4 gap-3 flex-shrink-0">
                            <span className="text-xs font-medium text-[var(--ide-text)]">{selectedFlow.name}</span>
                            <span className="text-[10px] text-[var(--ide-text-muted)]">{selectedFlow.nodes.length} nodes</span>
                            <div className="flex-1" />
                            {selectedNodeId && (
                                <button
                                    onClick={() => handleDeleteNode(selectedNodeId)}
                                    className="h-6 px-2 text-[10px] rounded border border-red-400/30 text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-1"
                                >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                    Delete Node
                                </button>
                            )}
                        </div>
                        <div className="px-4 py-2 bg-[var(--ide-chrome)] border-b border-[var(--ide-border)] flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] uppercase tracking-wider text-[var(--ide-text-muted)]">Trigger</span>
                            <select
                                value={triggerDraft?.type || "manual"}
                                onChange={(e) => setTriggerType(e.target.value as TriggerType["type"])}
                                className="h-7 px-2 text-xs bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] rounded text-[var(--ide-text)] focus:outline-none focus:border-[var(--ide-primary)]"
                            >
                                {allowedTriggerTypes.map((type) => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </select>

                            {(triggerDraft?.type === "event" || triggerDraft?.type === "mount") && (
                                <>
                                    <input
                                        list="logic-trigger-target-options"
                                        value={triggerDraft.component_id || ""}
                                        onChange={(e) =>
                                            updateTriggerDraft(
                                                triggerDraft.type === "event"
                                                    ? { ...triggerDraft, component_id: e.target.value }
                                                    : { type: "mount", component_id: e.target.value }
                                            )
                                        }
                                        className="h-7 min-w-[200px] px-2 text-xs bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] rounded text-[var(--ide-text)] focus:outline-none focus:border-[var(--ide-primary)]"
                                        placeholder="component/page/block ID"
                                    />
                                    <datalist id="logic-trigger-target-options">
                                        {componentTargetOptions.map((target) => (
                                            <option key={target.id} value={target.id}>
                                                {target.label}
                                            </option>
                                        ))}
                                    </datalist>
                                </>
                            )}

                            {triggerDraft?.type === "event" && (
                                <input
                                    value={triggerDraft.event || ""}
                                    onChange={(e) =>
                                        updateTriggerDraft({
                                            ...triggerDraft,
                                            event: e.target.value,
                                        })
                                    }
                                    className="h-7 min-w-[140px] px-2 text-xs bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] rounded text-[var(--ide-text)] focus:outline-none focus:border-[var(--ide-primary)]"
                                    placeholder="event name (e.g. onClick)"
                                />
                            )}

                            {triggerDraft?.type === "api" && (
                                <select
                                    value={triggerDraft.api_id || ""}
                                    onChange={(e) =>
                                        updateTriggerDraft({
                                            type: "api",
                                            api_id: e.target.value,
                                        })
                                    }
                                    className="h-7 min-w-[220px] px-2 text-xs bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] rounded text-[var(--ide-text)] focus:outline-none focus:border-[var(--ide-primary)]"
                                >
                                    <option value="">Select API endpoint ID</option>
                                    {availableApis.map((api) => (
                                        <option key={api.id} value={api.id}>
                                            {api.method} {api.path}
                                        </option>
                                    ))}
                                </select>
                            )}

                            {triggerDraft?.type === "schedule" && (
                                <input
                                    value={triggerDraft.cron || ""}
                                    onChange={(e) =>
                                        updateTriggerDraft({
                                            type: "schedule",
                                            cron: e.target.value,
                                        })
                                    }
                                    className="h-7 min-w-[180px] px-2 text-xs bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] rounded text-[var(--ide-text)] focus:outline-none focus:border-[var(--ide-primary)] font-mono"
                                    placeholder="cron expression"
                                />
                            )}

                            <div className="flex-1" />
                            <button
                                onClick={handleResetTrigger}
                                disabled={!triggerDirty || triggerSaving}
                                className="h-7 px-2 text-[10px] rounded border border-[var(--ide-border)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Reset
                            </button>
                            <button
                                onClick={handleSaveTrigger}
                                disabled={!triggerDirty || triggerSaving}
                                className="h-7 px-3 text-[10px] rounded bg-[var(--ide-primary)] text-white hover:bg-[var(--ide-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {triggerSaving ? "Saving..." : "Save Trigger"}
                            </button>
                            {triggerError && (
                                <span className="w-full text-[10px] text-red-400">{triggerError}</span>
                            )}
                        </div>
                    </>
                )}

                {/* Canvas area */}
                {selectedFlow ? (
                    <div
                        ref={canvasRef}
                        className={`flex-1 overflow-auto relative ${paletteDragOver ? "bg-indigo-500/[0.03]" : ""}`}
                        style={{ cursor: drag?.kind === "wire" ? "crosshair" : undefined }}
                        onClick={() => setSelectedNodeId(null)}
                        onDrop={handleCanvasDrop}
                        onDragOver={handleCanvasDragOver}
                        onDragLeave={() => setPaletteDragOver(false)}
                    >
                        {/* Grid background */}
                        <div
                            className="absolute inset-0 pointer-events-none"
                            style={{
                                backgroundImage: `radial-gradient(circle, var(--ide-canvas-grid, rgba(255,255,255,0.04)) 1px, transparent 1px)`,
                                backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
                            }}
                        />

                        {/* Surface (large scrollable area) */}
                        <div className="relative" style={{ width: 4000, height: 3000 }}>
                            {/* SVG wires layer */}
                            <svg
                                ref={svgRef}
                                className="absolute inset-0 pointer-events-none"
                                style={{ width: 4000, height: 3000, zIndex: 1 }}
                            >
                                {/* Existing connections */}
                                {selectedFlow.nodes.map((node) => {
                                    const from = outPortPos(node);
                                    return (
                                        <React.Fragment key={`wires-${node.id}`}>
                                            {node.next_nodes.map((tid) => {
                                                const target = nodeMap.get(tid);
                                                if (!target) return null;
                                                const to = inPortPos(target);
                                                return (
                                                    <g key={`w-${node.id}-${tid}`} className="pointer-events-auto cursor-pointer" onClick={(e) => { e.stopPropagation(); handleDeleteWire(node.id, tid, "next"); }}>
                                                        <path d={bezierPath(from.x, from.y, to.x, to.y)} fill="none" stroke="transparent" strokeWidth="12" />
                                                        <path d={bezierPath(from.x, from.y, to.x, to.y)} fill="none" stroke={getMeta(node.node_type).borderColor} strokeWidth="2" strokeOpacity="0.5" />
                                                    </g>
                                                );
                                            })}
                                            {node.else_nodes.map((tid) => {
                                                const target = nodeMap.get(tid);
                                                if (!target) return null;
                                                const ep = elsePortPos(node);
                                                const to = inPortPos(target);
                                                return (
                                                    <g key={`we-${node.id}-${tid}`} className="pointer-events-auto cursor-pointer" onClick={(e) => { e.stopPropagation(); handleDeleteWire(node.id, tid, "else"); }}>
                                                        <path d={bezierPath(ep.x, ep.y, to.x, to.y)} fill="none" stroke="transparent" strokeWidth="12" />
                                                        <path d={bezierPath(ep.x, ep.y, to.x, to.y)} fill="none" stroke="#f43f5e" strokeWidth="2" strokeOpacity="0.4" strokeDasharray="6 3" />
                                                    </g>
                                                );
                                            })}
                                        </React.Fragment>
                                    );
                                })}

                                {/* Dragging wire preview */}
                                {drag?.kind === "wire" && (() => {
                                    const fromNode = nodeMap.get(drag.fromNodeId);
                                    if (!fromNode) return null;
                                    const from = drag.fromPort === "next" ? outPortPos(fromNode) : elsePortPos(fromNode);
                                    return (
                                        <path
                                            d={bezierPath(from.x, from.y, drag.mouseX, drag.mouseY)}
                                            fill="none"
                                            stroke={drag.fromPort === "next" ? "#818cf8" : "#f43f5e"}
                                            strokeWidth="2"
                                            strokeOpacity="0.6"
                                            strokeDasharray="6 3"
                                        />
                                    );
                                })()}
                            </svg>

                            {/* Nodes layer */}
                            {selectedFlow.nodes.map((node) => {
                                const meta = getMeta(node.node_type);
                                const isSelected = selectedNodeId === node.id;
                                const isEntry = selectedFlow.entry_node_id === node.id;

                                return (
                                    <div
                                        key={node.id}
                                        data-node-id={node.id}
                                        className={[
                                            "absolute select-none transition-shadow duration-100",
                                            isSelected
                                                ? "ring-2 ring-[var(--ide-primary)] shadow-lg shadow-indigo-500/20 z-20"
                                                : "hover:shadow-md z-10",
                                        ].join(" ")}
                                        style={{
                                            left: node.position.x,
                                            top: node.position.y,
                                            width: NODE_W,
                                            height: NODE_H,
                                            zIndex: isSelected ? 20 : 10,
                                        }}
                                        onClick={(e) => { e.stopPropagation(); setSelectedNodeId(node.id); }}
                                        onMouseDown={(e) => onNodeMouseDown(e, node.id)}
                                    >
                                        {/* Node body */}
                                        <div className={`w-full h-full rounded-lg border bg-gradient-to-br ${meta.color} border-[${meta.borderColor}]/30 backdrop-blur-sm`}>
                                            <div className="flex items-center gap-2 px-3 py-2 h-full">
                                                <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: meta.borderColor + "20" }}>
                                                    <svg className="w-4 h-4" style={{ color: meta.borderColor }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={meta.icon} />
                                                    </svg>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-semibold text-[var(--ide-text)] truncate">{node.label || meta.label}</p>
                                                    <p className="text-[10px] text-[var(--ide-text-muted)] truncate">{meta.category}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Entry badge */}
                                        {isEntry && (
                                            <div className="absolute -top-2.5 left-3 px-1.5 py-0 text-[8px] font-bold uppercase tracking-wider bg-[var(--ide-primary)] text-white rounded-sm">
                                                Entry
                                            </div>
                                        )}

                                        {/* Input port (left) */}
                                        <div
                                            className="absolute w-3 h-3 rounded-full border-2 border-[var(--ide-bg)] cursor-crosshair"
                                            style={{
                                                left: -PORT_R,
                                                top: NODE_H / 2 - PORT_R,
                                                backgroundColor: meta.borderColor,
                                            }}
                                        />

                                        {/* Output port (right) - "next" */}
                                        <div
                                            className="absolute w-3 h-3 rounded-full border-2 border-[var(--ide-bg)] cursor-crosshair"
                                            style={{
                                                right: -PORT_R,
                                                top: NODE_H / 2 - PORT_R - (meta.hasElse ? 8 : 0),
                                                backgroundColor: meta.borderColor,
                                            }}
                                            onMouseDown={(e) => onPortMouseDown(e, node.id, "next")}
                                            title="Drag to connect (then)"
                                        />

                                        {/* Else port (right, lower) */}
                                        {meta.hasElse && (
                                            <div
                                                className="absolute w-3 h-3 rounded-full border-2 border-[var(--ide-bg)] cursor-crosshair"
                                                style={{
                                                    right: -PORT_R,
                                                    top: NODE_H / 2 - PORT_R + 8,
                                                    backgroundColor: "#f43f5e",
                                                }}
                                                onMouseDown={(e) => onPortMouseDown(e, node.id, "else")}
                                                title="Drag to connect (else)"
                                            />
                                        )}
                                    </div>
                                );
                            })}

                            {/* Drop hint when empty */}
                            {selectedFlow.nodes.length === 0 && !paletteDragOver && (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ width: "100%", height: "100%" }}>
                                    <div className="text-center">
                                        <svg className="w-12 h-12 mx-auto mb-3 text-[var(--ide-text-muted)] opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                        </svg>
                                        <p className="text-xs text-[var(--ide-text-muted)] opacity-50">Drag nodes from the right panel</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center">
                            <svg className="w-12 h-12 mx-auto mb-3 text-[var(--ide-text-muted)] opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            <p className="text-xs text-[var(--ide-text-muted)]">Select or create a flow to start.</p>
                        </div>
                    </div>
                )}
            </div>

            {/* ═══ RIGHT: Node Palette ═══ */}
            <div className="w-52 bg-[var(--ide-chrome)] border-l border-[var(--ide-border)] flex flex-col flex-shrink-0">
                <div className="h-9 px-3 flex items-center border-b border-[var(--ide-border)]">
                    <span className="text-[11px] font-semibold text-[var(--ide-text-secondary)] uppercase tracking-wider">Nodes</span>
                </div>
                <div className="flex-1 overflow-y-auto p-1.5">
                    {PALETTE_CATEGORIES.map((cat) => (
                        <PaletteCategory key={cat.name} name={cat.name} types={cat.types} />
                    ))}
                </div>

                {/* Selected node config */}
                {selectedNodeId && selectedFlow && (() => {
                    const node = selectedFlow.nodes.find((n) => n.id === selectedNodeId);
                    if (!node) return null;
                    const meta = getMeta(node.node_type);
                    return (
                        <div className="border-t border-[var(--ide-border)] p-3 space-y-2">
                            <p className="text-[10px] font-semibold text-[var(--ide-text-secondary)] uppercase tracking-wider">Selected Node</p>
                            <div className="flex items-center gap-2">
                                <div className="w-5 h-5 rounded flex items-center justify-center" style={{ backgroundColor: meta.borderColor + "20" }}>
                                    <svg className="w-3 h-3" style={{ color: meta.borderColor }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={meta.icon} />
                                    </svg>
                                </div>
                                <input
                                    className="flex-1 bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] rounded px-2 py-1 text-xs text-[var(--ide-text)] outline-none focus:border-[var(--ide-primary)]"
                                    value={node.label || ""}
                                    placeholder={meta.label}
                                    onChange={async (e) => {
                                        const newNodes = selectedFlow.nodes.map((n) =>
                                            n.id === node.id ? { ...n, label: e.target.value } : n,
                                        );
                                        await saveNodes(newNodes);
                                    }}
                                />
                            </div>
                            <div className="text-[10px] text-[var(--ide-text-muted)]">
                                <span className="opacity-60">Type:</span> {meta.label}
                            </div>
                            <div className="text-[10px] text-[var(--ide-text-muted)]">
                                <span className="opacity-60">Connections:</span> {node.next_nodes.length} out{meta.hasElse ? `, ${node.else_nodes.length} else` : ""}
                            </div>
                            {/* Node Data Editor */}
                            <NodeDataEditor node={node} onSave={async (data) => {
                                const newNodes = selectedFlow.nodes.map(n =>
                                    n.id === node.id ? { ...n, data } : n);
                                await saveNodes(newNodes);
                            }} />
                        </div>
                    );
                })()}
            </div>
        </div>
    );
};

// ─── Node Data Editor ────────────────────────────────

/** Field definitions for each node type's configurable data */
const NODE_DATA_FIELDS: Record<string, Array<{ key: string; label: string; type: "text" | "textarea" | "select" | "number" | "bool"; options?: string[] }>> = {
    condition: [{ key: "expression", label: "Expression", type: "text" }],
    for_each: [{ key: "collection", label: "Collection", type: "text" }, { key: "item_var", label: "Item Var", type: "text" }],
    while: [{ key: "expression", label: "Condition", type: "text" }],
    delay: [{ key: "ms", label: "Delay (ms)", type: "number" }],
    set_variable: [{ key: "variable", label: "Variable", type: "text" }, { key: "value", label: "Value", type: "text" }],
    get_variable: [{ key: "variable", label: "Variable", type: "text" }],
    transform: [{ key: "expression", label: "Expression", type: "textarea" }],
    navigate: [{ key: "path", label: "Path", type: "text" }],
    alert: [{ key: "message", label: "Message", type: "text" }, { key: "type", label: "Type", type: "select", options: ["info", "success", "warning", "error"] }],
    open_modal: [{ key: "modal_id", label: "Modal ID", type: "text" }],
    close_modal: [{ key: "modal_id", label: "Modal ID", type: "text" }],
    set_property: [{ key: "target", label: "Target", type: "text" }, { key: "property", label: "Property", type: "text" }, { key: "value", label: "Value", type: "text" }],
    fetch_api: [{ key: "endpoint", label: "Endpoint", type: "text" }, { key: "method", label: "Method", type: "select", options: ["GET", "POST", "PUT", "DELETE"] }, { key: "result_var", label: "Result Var", type: "text" }],
    http_request: [{ key: "url", label: "URL", type: "text" }, { key: "method", label: "Method", type: "select", options: ["GET", "POST", "PUT", "PATCH", "DELETE"] }, { key: "headers", label: "Headers (JSON)", type: "textarea" }, { key: "body", label: "Body", type: "textarea" }],
    db_create: [{ key: "model", label: "Model", type: "text" }, { key: "data", label: "Data (JSON)", type: "textarea" }],
    db_read: [{ key: "model", label: "Model", type: "text" }, { key: "where", label: "Where (JSON)", type: "textarea" }],
    db_update: [{ key: "model", label: "Model", type: "text" }, { key: "where", label: "Where (JSON)", type: "textarea" }, { key: "data", label: "Data (JSON)", type: "textarea" }],
    db_delete: [{ key: "model", label: "Model", type: "text" }, { key: "where", label: "Where (JSON)", type: "textarea" }],
    return: [{ key: "status", label: "Status Code", type: "number" }, { key: "body", label: "Body (JSON)", type: "textarea" }],
    throw_error: [{ key: "message", label: "Error Message", type: "text" }, { key: "status", label: "Status Code", type: "number" }],
    custom_code: [{ key: "code", label: "Code", type: "textarea" }],
    send_email: [{ key: "to", label: "To", type: "text" }, { key: "subject", label: "Subject", type: "text" }, { key: "body", label: "Body", type: "textarea" }],
};

const NodeDataEditor: React.FC<{ node: LogicNode; onSave: (data: unknown) => Promise<void> }> = ({ node, onSave }) => {
    const fields = NODE_DATA_FIELDS[node.node_type];
    if (!fields || fields.length === 0) return null;

    const data = (node.data || {}) as Record<string, unknown>;

    const handleChange = (key: string, value: unknown) => {
        onSave({ ...data, [key]: value });
    };

    return (
        <div className="mt-2 pt-2 border-t border-[var(--ide-border)] space-y-1.5">
            <p className="text-[10px] font-semibold text-[var(--ide-text-secondary)] uppercase tracking-wider">Configuration</p>
            {fields.map(f => (
                <div key={f.key}>
                    <label className="text-[10px] text-[var(--ide-text-muted)] block mb-0.5">{f.label}</label>
                    {f.type === "textarea" ? (
                        <textarea
                            className="w-full bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] rounded px-2 py-1 text-xs text-[var(--ide-text)] outline-none focus:border-[var(--ide-primary)] resize-none font-mono"
                            rows={3}
                            value={String(data[f.key] ?? "")}
                            onChange={(e) => handleChange(f.key, e.target.value)}
                        />
                    ) : f.type === "select" ? (
                        <select
                            className="w-full bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] rounded px-2 py-1 text-xs text-[var(--ide-text)] outline-none focus:border-[var(--ide-primary)]"
                            value={String(data[f.key] ?? f.options?.[0] ?? "")}
                            onChange={(e) => handleChange(f.key, e.target.value)}
                        >
                            {f.options?.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                    ) : f.type === "number" ? (
                        <input
                            type="number"
                            className="w-full bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] rounded px-2 py-1 text-xs text-[var(--ide-text)] outline-none focus:border-[var(--ide-primary)]"
                            value={Number(data[f.key] ?? 0)}
                            onChange={(e) => handleChange(f.key, Number(e.target.value))}
                        />
                    ) : f.type === "bool" ? (
                        <label className="flex items-center gap-1.5 text-xs text-[var(--ide-text-secondary)]">
                            <input type="checkbox" checked={Boolean(data[f.key])}
                                onChange={(e) => handleChange(f.key, e.target.checked)} />
                            {f.label}
                        </label>
                    ) : (
                        <input
                            type="text"
                            className="w-full bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] rounded px-2 py-1 text-xs text-[var(--ide-text)] outline-none focus:border-[var(--ide-primary)]"
                            value={String(data[f.key] ?? "")}
                            onChange={(e) => handleChange(f.key, e.target.value)}
                        />
                    )}
                </div>
            ))}
        </div>
    );
};

// ─── Palette Category ────────────────────────────────

const PaletteCategory: React.FC<{ name: string; types: string[] }> = ({ name, types }) => {
    const [open, setOpen] = useState(true);

    return (
        <div className="mb-1">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center gap-1.5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-colors"
            >
                <svg className={`w-3 h-3 transition-transform ${open ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
                {name}
            </button>
            {open && (
                <div className="space-y-0.5 mt-0.5">
                    {types.map((type) => (
                        <PaletteItem key={type} nodeType={type} />
                    ))}
                </div>
            )}
        </div>
    );
};

// ─── Palette Item ────────────────────────────────────

const PaletteItem: React.FC<{ nodeType: string }> = ({ nodeType }) => {
    const meta = getMeta(nodeType);

    return (
        <div
            className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-grab text-[var(--ide-text-secondary)] hover:bg-[var(--ide-bg-elevated)] hover:text-[var(--ide-text)] transition-colors text-xs"
            draggable
            onDragStart={(e) => {
                e.dataTransfer.setData("application/logic-node", nodeType);
                e.dataTransfer.effectAllowed = "copy";
            }}
        >
            <div className="w-5 h-5 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: meta.borderColor + "15" }}>
                <svg className="w-3 h-3" style={{ color: meta.borderColor }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={meta.icon} />
                </svg>
            </div>
            <span className="truncate">{meta.label}</span>
        </div>
    );
};

export default LogicCanvas;
