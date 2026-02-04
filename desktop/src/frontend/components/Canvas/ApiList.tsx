/**
 * ApiList Component
 * 
 * Displays and manages API endpoints in a list view.
 */

import { Component, For, Show, createSignal, createMemo } from "solid-js";
import { projectState, addApi } from "../../stores/projectStore";
import PromptModal from "../UI/PromptModal";
import { useToast } from "../../context/ToastContext";

const ApiList: Component = () => {
    const [selectedApiId, setSelectedApiId] = createSignal<string | null>(null);
    const [promptOpen, setPromptOpen] = createSignal(false);
    const toast = useToast();

    const apis = createMemo(() =>
        projectState.project?.apis.filter(a => !a.archived) || []
    );

    const selectedApi = createMemo(() =>
        apis().find(a => a.id === selectedApiId())
    );

    const handleAddApi = async () => {
        setPromptOpen(true);
    };

    const getMethodColor = (method: string): string => {
        switch (method.toUpperCase()) {
            case "GET":
                return "bg-green-500/20 text-green-400 border-green-500/50";
            case "POST":
                return "bg-blue-500/20 text-blue-400 border-blue-500/50";
            case "PUT":
                return "bg-yellow-500/20 text-yellow-400 border-yellow-500/50";
            case "PATCH":
                return "bg-orange-500/20 text-orange-400 border-orange-500/50";
            case "DELETE":
                return "bg-red-500/20 text-red-400 border-red-500/50";
            default:
                return "bg-gray-500/20 text-gray-400 border-gray-500/50";
        }
    };

    return (
        <div class="h-full flex">
            {/* API List */}
            <div class="w-80 bg-ide-sidebar border-r border-ide-border flex flex-col flex-shrink-0">
                {/* Header */}
                <div class="h-10 px-4 flex items-center justify-between border-b border-ide-border">
                    <span class="text-xs font-semibold uppercase tracking-wider text-ide-text-muted">
                        API Endpoints
                    </span>
                    <button
                        class="p-1 hover:bg-ide-panel rounded text-ide-text-muted hover:text-ide-accent transition-colors"
                        onClick={handleAddApi}
                        aria-label="Add endpoint"
                    >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                    </button>
                </div>

                {/* List */}
                <div class="flex-1 overflow-auto">
                    <Show
                        when={apis().length > 0}
                        fallback={
                            <div class="p-4 text-center text-ide-text-muted text-sm">
                                <p>No API endpoints yet</p>
                                <button
                                    class="mt-2 text-ide-accent hover:underline"
                                    onClick={handleAddApi}
                                >
                                    Create your first endpoint
                                </button>
                            </div>
                        }
                    >
                        <div class="p-2 space-y-1">
                            <For each={apis()}>
                                {(api) => (
                                    <button
                                        class={`w-full text-left p-3 rounded-lg transition-colors ${selectedApiId() === api.id
                                            ? "bg-ide-accent/20 border border-ide-accent/50"
                                            : "hover:bg-ide-panel border border-transparent"
                                            }`}
                                        onClick={() => setSelectedApiId(api.id)}
                                    >
                                        <div class="flex items-center gap-2 mb-1">
                                            <span class={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${getMethodColor(api.method)}`}>
                                                {api.method}
                                            </span>
                                            <span class="text-sm font-mono text-ide-text truncate">
                                                {api.path}
                                            </span>
                                        </div>
                                        <span class="text-xs text-ide-text-muted">{api.name}</span>
                                    </button>
                                )}
                            </For>
                        </div>
                    </Show>
                </div>
            </div>

            <PromptModal
                isOpen={promptOpen()}
                title="New API Endpoint"
                confirmText="Create"
                fields={[
                    { name: "method", label: "HTTP method", placeholder: "GET", value: "GET", required: true },
                    { name: "path", label: "API path", placeholder: "/api/", value: "/api/", required: true },
                    { name: "name", label: "Endpoint name", placeholder: "ListUsers", required: true },
                ]}
                onClose={() => setPromptOpen(false)}
                onSubmit={async (values) => {
                    try {
                        const method = values.method.trim().toUpperCase();
                        const path = values.path.trim();
                        const name = values.name.trim();
                        await addApi(method, path, name);
                        toast.success(`API "${name}" created`);
                    } catch (err) {
                        toast.error(`Failed to create API: ${err}`);
                    }
                }}
            />

            {/* API Detail Panel */}
            <div class="flex-1 overflow-auto bg-ide-bg">
                <Show
                    when={selectedApi()}
                    fallback={
                        <div class="h-full flex items-center justify-center text-ide-text-muted">
                            <div class="text-center">
                                <svg class="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                <p class="text-sm">Select an endpoint to view details</p>
                            </div>
                        </div>
                    }
                >
                    {(api) => (
                        <div class="p-6">
                            {/* Endpoint Header */}
                            <div class="flex items-center gap-3 mb-6">
                                <span class={`text-sm font-mono px-2 py-1 rounded border ${getMethodColor(api().method)}`}>
                                    {api().method}
                                </span>
                                <span class="text-xl font-mono text-ide-text">{api().path}</span>
                            </div>

                            {/* Endpoint Name */}
                            <div class="mb-6">
                                <h2 class="text-2xl font-bold text-ide-text">{api().name}</h2>
                                <Show when={api().description}>
                                    <p class="mt-2 text-ide-text-muted">{api().description}</p>
                                </Show>
                            </div>

                            {/* Sections */}
                            <div class="space-y-6">
                                {/* Request */}
                                <div class="bg-ide-panel rounded-lg p-4 border border-ide-border">
                                    <h3 class="text-sm font-semibold text-ide-text mb-3">Request</h3>
                                    <div class="bg-ide-bg rounded p-3 font-mono text-sm text-ide-text-muted">
                                        <span class="text-green-400">{api().method}</span>{" "}
                                        <span class="text-ide-text">{api().path}</span>
                                    </div>
                                </div>

                                {/* Response */}
                                <div class="bg-ide-panel rounded-lg p-4 border border-ide-border">
                                    <h3 class="text-sm font-semibold text-ide-text mb-3">Response</h3>
                                    <div class="bg-ide-bg rounded p-3 font-mono text-sm text-ide-text-muted">
                                        <pre>{`{
  "success": true,
  "data": {}
}`}</pre>
                                    </div>
                                </div>

                                {/* Logic Flow */}
                                <div class="bg-ide-panel rounded-lg p-4 border border-ide-border">
                                    <h3 class="text-sm font-semibold text-ide-text mb-3">Handler Logic</h3>
                                    <Show
                                        when={api().logic_flow_id}
                                        fallback={
                                            <button class="w-full py-3 border-2 border-dashed border-ide-border rounded-lg text-ide-text-muted hover:border-ide-accent hover:text-ide-accent transition-colors">
                                                + Create Logic Flow
                                            </button>
                                        }
                                    >
                                        <p class="text-sm text-ide-text-muted">
                                            Connected to logic flow: {api().logic_flow_id}
                                        </p>
                                    </Show>
                                </div>

                                {/* Permissions */}
                                <div class="bg-ide-panel rounded-lg p-4 border border-ide-border">
                                    <h3 class="text-sm font-semibold text-ide-text mb-3">Permissions</h3>
                                    <Show
                                        when={api().permissions.length > 0}
                                        fallback={
                                            <span class="text-sm text-ide-text-muted">Public (no authentication required)</span>
                                        }
                                    >
                                        <div class="flex flex-wrap gap-2">
                                            <For each={api().permissions}>
                                                {(perm) => (
                                                    <span class="px-2 py-1 text-xs rounded bg-purple-500/20 text-purple-400">
                                                        {perm}
                                                    </span>
                                                )}
                                            </For>
                                        </div>
                                    </Show>
                                </div>
                            </div>
                        </div>
                    )}
                </Show>
            </div>
        </div>
    );
};

export default ApiList;
