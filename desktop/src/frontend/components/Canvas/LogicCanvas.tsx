/**
 * LogicCanvas Component
 * 
 * Visual node-based editor for logic flows.
 * Allows creating and connecting logic nodes for frontend events
 * and backend API handlers.
 */

import { Component, For, Show, createSignal, createMemo } from "solid-js";
import { projectState } from "../../stores/projectStore";
import { LogicNode } from "../../hooks/useTauri";

const LogicCanvas: Component = () => {
    const [selectedNodeId, setSelectedNodeId] = createSignal<string | null>(null);
    const [selectedFlowId, setSelectedFlowId] = createSignal<string | null>(null);

    const flows = createMemo(() =>
        projectState.project?.logic_flows.filter(f => !f.archived) || []
    );

    const selectedFlow = createMemo(() =>
        flows().find(f => f.id === selectedFlowId())
    );

    return (
        <div class="h-full flex">
            {/* Flow List Sidebar */}
            <div class="w-48 bg-ide-sidebar border-r border-ide-border flex-shrink-0">
                <div class="p-3 border-b border-ide-border">
                    <h3 class="text-xs font-semibold uppercase tracking-wider text-ide-text-muted">
                        Logic Flows
                    </h3>
                </div>
                <div class="p-2">
                    <Show
                        when={flows().length > 0}
                        fallback={
                            <p class="text-xs text-ide-text-muted p-2">
                                No logic flows yet
                            </p>
                        }
                    >
                        <For each={flows()}>
                            {(flow) => (
                                <button
                                    class={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedFlowId() === flow.id
                                        ? "bg-ide-accent text-white"
                                        : "text-ide-text hover:bg-ide-panel"
                                        }`}
                                    onClick={() => setSelectedFlowId(flow.id)}
                                >
                                    <div class="flex items-center gap-2">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                        </svg>
                                        {flow.name}
                                    </div>
                                    <span class="text-xs text-ide-text-muted">
                                        {flow.context === "frontend" ? "Frontend" : "Backend"}
                                    </span>
                                </button>
                            )}
                        </For>
                    </Show>
                </div>
            </div>

            {/* Node Canvas */}
            <div class="flex-1 overflow-hidden">
                <Show
                    when={selectedFlow()}
                    fallback={<EmptyLogicState />}
                >
                    {(flow) => (
                        <div class="h-full relative">
                            {/* Canvas Header */}
                            <div class="absolute top-0 left-0 right-0 h-10 bg-ide-bg/80 backdrop-blur border-b border-ide-border flex items-center px-4 z-10">
                                <span class="text-sm font-medium text-ide-text">{flow().name}</span>
                                <span class="mx-2 text-ide-text-muted">·</span>
                                <span class="text-xs text-ide-text-muted">{flow().nodes.length} nodes</span>
                            </div>

                            {/* Nodes Area */}
                            <div class="h-full pt-10 overflow-auto p-8 canvas-grid">
                                <Show
                                    when={flow().nodes.length > 0}
                                    fallback={
                                        <div class="h-full flex items-center justify-center">
                                            <div class="text-center text-ide-text-muted">
                                                <svg class="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                                </svg>
                                                <p class="text-sm">Drop nodes to build your logic</p>
                                            </div>
                                        </div>
                                    }
                                >
                                    <For each={flow().nodes}>
                                        {(node) => (
                                            <LogicNodeCard
                                                node={node}
                                                selected={selectedNodeId() === node.id}
                                                onSelect={() => setSelectedNodeId(node.id)}
                                            />
                                        )}
                                    </For>
                                </Show>
                            </div>
                        </div>
                    )}
                </Show>
            </div>

            {/* Node Palette */}
            <div class="w-56 bg-ide-sidebar border-l border-ide-border flex-shrink-0 overflow-auto">
                <div class="p-3 border-b border-ide-border">
                    <h3 class="text-xs font-semibold uppercase tracking-wider text-ide-text-muted">
                        Node Types
                    </h3>
                </div>
                <div class="p-2 space-y-1">
                    <NodePaletteSection title="Control Flow">
                        <NodePaletteItem icon="git-branch" name="Condition" />
                        <NodePaletteItem icon="repeat" name="Loop" />
                        <NodePaletteItem icon="clock" name="Delay" />
                    </NodePaletteSection>
                    <NodePaletteSection title="Data">
                        <NodePaletteItem icon="variable" name="Set Variable" />
                        <NodePaletteItem icon="transform" name="Transform" />
                    </NodePaletteSection>
                    <NodePaletteSection title="UI Actions">
                        <NodePaletteItem icon="navigation" name="Navigate" />
                        <NodePaletteItem icon="alert" name="Alert" />
                        <NodePaletteItem icon="modal" name="Modal" />
                    </NodePaletteSection>
                    <NodePaletteSection title="Database">
                        <NodePaletteItem icon="db-read" name="DB Read" />
                        <NodePaletteItem icon="db-write" name="DB Write" />
                        <NodePaletteItem icon="db-delete" name="DB Delete" />
                    </NodePaletteSection>
                    <NodePaletteSection title="Response">
                        <NodePaletteItem icon="return" name="Return" />
                        <NodePaletteItem icon="error" name="Throw Error" />
                    </NodePaletteSection>
                </div>
            </div>
        </div>
    );
};

// Logic Node Card Component
interface LogicNodeCardProps {
    node: LogicNode;
    selected: boolean;
    onSelect: () => void;
}

const LogicNodeCard: Component<LogicNodeCardProps> = (props) => {
    const getNodeColor = (): string => {
        switch (props.node.node_type) {
            case "condition":
                return "from-yellow-500/20 to-orange-500/20 border-yellow-500/50";
            case "db_read":
            case "db_create":
            case "db_update":
            case "db_delete":
                return "from-green-500/20 to-emerald-500/20 border-green-500/50";
            case "return":
            case "throw_error":
                return "from-red-500/20 to-rose-500/20 border-red-500/50";
            case "navigate":
            case "alert":
            case "open_modal":
                return "from-blue-500/20 to-cyan-500/20 border-blue-500/50";
            default:
                return "from-purple-500/20 to-indigo-500/20 border-purple-500/50";
        }
    };

    return (
        <div
            class={`absolute w-48 rounded-lg border bg-gradient-to-br ${getNodeColor()} p-3 cursor-move transition-all hover:shadow-lg ${props.selected ? "ring-2 ring-ide-accent" : ""
                }`}
            style={{ left: `${props.node.position.x}px`, top: `${props.node.position.y}px` }}
            onClick={props.onSelect}
        >
            {/* Node Header */}
            <div class="flex items-center gap-2 mb-2">
                <div class="w-6 h-6 rounded bg-white/10 flex items-center justify-center">
                    <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                </div>
                <span class="text-sm font-medium text-white truncate">
                    {props.node.label || props.node.node_type}
                </span>
            </div>

            {/* Input Port */}
            <div class="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-ide-accent border-2 border-ide-bg" />

            {/* Output Port */}
            <div class="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-ide-success border-2 border-ide-bg" />
        </div>
    );
};

// Node Palette Section
interface NodePaletteSectionProps {
    title: string;
    children: any;
}

const NodePaletteSection: Component<NodePaletteSectionProps> = (props) => {
    return (
        <div class="mb-3">
            <h4 class="text-[10px] uppercase tracking-wider text-ide-text-muted mb-1 px-2">
                {props.title}
            </h4>
            <div class="space-y-1">
                {props.children}
            </div>
        </div>
    );
};

// Node Palette Item
interface NodePaletteItemProps {
    icon: string;
    name: string;
}

const NodePaletteItem: Component<NodePaletteItemProps> = (props) => {
    return (
        <div
            class="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-grab text-sm text-ide-text hover:bg-ide-panel transition-colors"
            draggable="true"
        >
            <div class="w-5 h-5 rounded bg-ide-accent/20 flex items-center justify-center">
                <svg class="w-3 h-3 text-ide-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
            </div>
            {props.name}
        </div>
    );
};

// Empty State
const EmptyLogicState: Component = () => {
    return (
        <div class="h-full flex items-center justify-center bg-ide-bg">
            <div class="text-center max-w-sm">
                <div class="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 flex items-center justify-center">
                    <svg class="w-10 h-10 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                </div>
                <h3 class="text-lg font-semibold text-ide-text mb-2">
                    Logic Flow Editor
                </h3>
                <p class="text-sm text-ide-text-muted mb-4">
                    Create visual logic flows for frontend events and backend API handlers
                </p>
                <button class="btn-primary">
                    Create Logic Flow
                </button>
            </div>
        </div>
    );
};

export default LogicCanvas;
