import React, { useState } from "react";
import { useProjectStore } from "../../../../hooks/useProjectStore";
import type { CraftBlockProps } from "../hooks/craft/serialization";
import { BINDING_TYPES, BLOCK_EVENTS } from "../hooks/inspector/types";

interface EventsPanelProps {
    eventHandlers: Array<{ event: string; logic_flow_id: string }>;
    bindings: Record<string, { type: string; value: unknown }>;
    properties: Record<string, unknown>;
    setProp: (updater: (props: CraftBlockProps) => void) => void;
}

const EventsPanel: React.FC<EventsPanelProps> = ({ eventHandlers, bindings, properties, setProp }) => {
    const { project } = useProjectStore();
    const [newEvent, setNewEvent] = useState("");
    const [newBindingProp, setNewBindingProp] = useState("");

    const logicFlows = project?.logic_flows.filter((lf) => !lf.archived) || [];
    const variables = project?.variables.filter((v) => !v.archived) || [];

    const usedEvents = eventHandlers.map((h) => h.event);
    const availableEvents = BLOCK_EVENTS.filter((e) => !usedEvents.includes(e));

    const handleAddEvent = (eventName: string) => {
        if (!eventName) return;
        setProp((p: CraftBlockProps) => {
            p.eventHandlers = [...(p.eventHandlers || []), { event: eventName, logic_flow_id: "" }];
        });
        setNewEvent("");
    };

    const handleRemoveEvent = (eventName: string) => {
        setProp((p: CraftBlockProps) => {
            p.eventHandlers = (p.eventHandlers || []).filter((h) => h.event !== eventName);
        });
    };

    const handleEventFlowChange = (eventName: string, flowId: string) => {
        setProp((p: CraftBlockProps) => {
            p.eventHandlers = (p.eventHandlers || []).map((h) =>
                h.event === eventName ? { ...h, logic_flow_id: flowId } : h,
            );
        });
    };

    const handleAddBinding = (propName: string) => {
        if (!propName) return;
        setProp((p: CraftBlockProps) => {
            p.bindings = { ...p.bindings, [propName]: { type: "variable", value: "" } };
        });
        setNewBindingProp("");
    };

    const handleRemoveBinding = (propName: string) => {
        setProp((p: CraftBlockProps) => {
            const next = { ...p.bindings };
            delete next[propName];
            p.bindings = next;
        });
    };

    const handleBindingChange = (propName: string, type: string, value: unknown) => {
        setProp((p: CraftBlockProps) => {
            p.bindings = { ...p.bindings, [propName]: { type, value } };
        });
    };

    const blockProps = Object.keys(properties || {});
    const unboundProps = blockProps.filter((p) => !bindings[p]);

    return (
        <div className="p-4 space-y-6">
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--ide-text-secondary)]">
                        Event Handlers
                    </h3>
                </div>
                {eventHandlers.length === 0 && (
                    <p className="text-[10px] text-[var(--ide-text-muted)] italic mb-2">
                        No event handlers configured
                    </p>
                )}
                {eventHandlers.map((handler) => (
                    <div key={handler.event} className="mb-2 p-2 bg-[var(--ide-bg-elevated)] rounded border border-[var(--ide-border)] group">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-mono text-indigo-400">{handler.event}</span>
                            <button
                                onClick={() => handleRemoveEvent(handler.event)}
                                className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 text-xs transition-opacity"
                            >
                                &times;
                            </button>
                        </div>
                        <select
                            value={handler.logic_flow_id || ""}
                            onChange={(e) => handleEventFlowChange(handler.event, e.target.value)}
                            className="w-full px-2 py-1 text-xs bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded text-[var(--ide-text)] focus:outline-none focus:border-[var(--ide-primary)]"
                        >
                            <option value="">-- Select logic flow --</option>
                            {logicFlows.map((lf) => (
                                <option key={lf.id} value={lf.id}>{lf.name}</option>
                            ))}
                        </select>
                    </div>
                ))}
                {availableEvents.length > 0 && (
                    <div className="flex gap-1 mt-2">
                        <select
                            value={newEvent}
                            onChange={(e) => setNewEvent(e.target.value)}
                            className="flex-1 px-2 py-1 text-xs bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded text-[var(--ide-text-muted)] focus:outline-none"
                        >
                            <option value="">+ Add event...</option>
                            {availableEvents.map((e) => (
                                <option key={e} value={e}>{e}</option>
                            ))}
                        </select>
                        {newEvent && (
                            <button
                                onClick={() => handleAddEvent(newEvent)}
                                className="px-2 py-1 text-xs bg-[var(--ide-primary)] text-white rounded hover:bg-[var(--ide-primary-hover)]"
                            >
                                Add
                            </button>
                        )}
                    </div>
                )}
            </div>

            <div>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--ide-text-secondary)]">
                        Data Bindings
                    </h3>
                </div>
                {Object.keys(bindings).length === 0 && (
                    <p className="text-[10px] text-[var(--ide-text-muted)] italic mb-2">
                        No data bindings configured
                    </p>
                )}
                {Object.entries(bindings).map(([propName, binding]) => (
                    <div key={propName} className="mb-2 p-2 bg-[var(--ide-bg-elevated)] rounded border border-[var(--ide-border)] group">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-mono text-green-400">{propName}</span>
                            <button
                                onClick={() => handleRemoveBinding(propName)}
                                className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 text-xs transition-opacity"
                            >
                                &times;
                            </button>
                        </div>
                        <div className="flex gap-1">
                            <select
                                value={binding.type}
                                onChange={(e) => handleBindingChange(propName, e.target.value, binding.value)}
                                className="w-20 px-1 py-1 text-[10px] bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded text-[var(--ide-text-muted)] focus:outline-none"
                            >
                                {BINDING_TYPES.map((t) => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                            {binding.type === "variable" ? (
                                <select
                                    value={String(binding.value || "")}
                                    onChange={(e) => handleBindingChange(propName, binding.type, e.target.value)}
                                    className="flex-1 px-2 py-1 text-xs bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded text-[var(--ide-text)] focus:outline-none"
                                >
                                    <option value="">-- Select variable --</option>
                                    {variables.map((v) => (
                                        <option key={v.id} value={v.id}>{v.name}</option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    value={String(binding.value || "")}
                                    onChange={(e) => handleBindingChange(propName, binding.type, e.target.value)}
                                    placeholder="value / path"
                                    className="flex-1 px-2 py-1 text-xs bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded text-[var(--ide-text)] focus:outline-none focus:border-[var(--ide-primary)]"
                                />
                            )}
                        </div>
                    </div>
                ))}
                {unboundProps.length > 0 && (
                    <div className="flex gap-1 mt-2">
                        <select
                            value={newBindingProp}
                            onChange={(e) => setNewBindingProp(e.target.value)}
                            className="flex-1 px-2 py-1 text-xs bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded text-[var(--ide-text-muted)] focus:outline-none"
                        >
                            <option value="">+ Bind property...</option>
                            {unboundProps.map((p) => (
                                <option key={p} value={p}>{p}</option>
                            ))}
                        </select>
                        {newBindingProp && (
                            <button
                                onClick={() => handleAddBinding(newBindingProp)}
                                className="px-2 py-1 text-xs bg-[var(--ide-primary)] text-white rounded hover:bg-[var(--ide-primary-hover)]"
                            >
                                Bind
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default EventsPanel;
