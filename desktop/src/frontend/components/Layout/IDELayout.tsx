/**
 * IDE Layout Component
 * 
 * Main layout structure for the IDE with panels:
 * - Toolbar (top)
 * - FileTree (left sidebar)
 * - Canvas/Logic/ERD (center)
 * - Inspector (right panel)
 * - StatusBar (bottom)
 */

import { Component, JSX, createSignal, Show } from "solid-js";
import { projectState, setActiveTab } from "../../stores/projectStore";
import { useToast } from "../../context/ToastContext";

interface IDELayoutProps {
    toolbar: JSX.Element;
    fileTree: JSX.Element;
    canvas: JSX.Element;
    inspector: JSX.Element;
}

const IDELayout: Component<IDELayoutProps> = (props) => {
    const [sidebarWidth, _setSidebarWidth] = createSignal(250);
    const [inspectorWidth, _setInspectorWidth] = createSignal(300);
    const [sidebarCollapsed, setSidebarCollapsed] = createSignal(false);
    const [inspectorCollapsed, setInspectorCollapsed] = createSignal(false);
    const toast = useToast();

    return (
        <div class="h-screen w-screen flex flex-col bg-ide-bg text-ide-text overflow-hidden selection:bg-indigo-500/30">
            {/* Toolbar */}
            <header class="h-12 bg-ide-sidebar border-b border-ide-border flex-shrink-0 z-50">
                {props.toolbar}
            </header>

            {/* Main Content Area */}
            <div class="flex-1 flex overflow-hidden">
                {/* Left Sidebar - FileTree */}
                <aside
                    class="bg-ide-sidebar border-r border-ide-border flex-shrink-0 overflow-hidden flex flex-col transition-all duration-300 ease-in-out z-40"
                    style={{ width: sidebarCollapsed() ? "0px" : `${sidebarWidth()}px`, opacity: sidebarCollapsed() ? 0 : 1 }}
                >
                    {/* Sidebar Header */}
                    <div class="h-10 px-4 flex items-center justify-between border-b border-ide-border bg-black/20">
                        <span class="text-[10px] font-bold uppercase text-ide-text-muted tracking-[0.2em]">
                            Explorer
                        </span>
                        <div class="flex items-center gap-1">
                            <button
                                class="p-1 hover:bg-white/5 rounded-md text-ide-text-muted hover:text-white transition-all"
                                onClick={() => setSidebarCollapsed(true)}
                                title="Collapse Sidebar"
                            >
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* FileTree Content */}
                    <div class="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
                        {props.fileTree}
                    </div>
                </aside>

                {/* Vertical Activity Bar (Always visible) */}
                <div class="w-12 bg-ide-sidebar border-r border-ide-border flex flex-col items-center py-4 gap-4 z-40">
                    <ActivityIcon
                        active={!sidebarCollapsed()}
                        onClick={() => setSidebarCollapsed(!sidebarCollapsed())}
                        icon="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                        label="Explorer"
                    />
                    <div class="flex-1" />
                    <ActivityIcon
                        active={false}
                        onClick={() => toast.info("Settings coming soon")}
                        icon="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                        label="Settings"
                    />
                </div>

                {/* Center - Canvas Area */}
                <main class="flex-1 flex flex-col overflow-hidden bg-ide-bg relative">
                    {/* Tab Bar */}
                    <div class="h-10 bg-ide-sidebar border-b border-ide-border flex items-center px-4 gap-1 z-30">
                        <TabButton
                            active={projectState.activeTab === "canvas"}
                            onClick={() => setActiveTab("canvas")}
                            icon="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
                        >
                            Canvas
                        </TabButton>
                        <TabButton
                            active={projectState.activeTab === "logic"}
                            onClick={() => setActiveTab("logic")}
                            icon="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                        >
                            Logic
                        </TabButton>
                        <TabButton
                            active={projectState.activeTab === "api"}
                            onClick={() => setActiveTab("api")}
                            icon="M13 10V3L4 14h7v7l9-11h-7z"
                        >
                            API
                        </TabButton>
                        <TabButton
                            active={projectState.activeTab === "erd"}
                            onClick={() => setActiveTab("erd")}
                            icon="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
                        >
                            Database
                        </TabButton>
                    </div>

                    {/* Canvas Content */}
                    <div class="flex-1 overflow-auto canvas-grid selection:bg-indigo-500/20">
                        {props.canvas}
                    </div>
                </main>

                {/* Right Panel - Inspector */}
                <aside
                    class="bg-ide-sidebar border-l border-ide-border flex-shrink-0 overflow-hidden flex flex-col transition-all duration-300 ease-in-out z-40"
                    style={{ width: inspectorCollapsed() ? "0px" : `${inspectorWidth()}px`, opacity: inspectorCollapsed() ? 0 : 1 }}
                >
                    {/* Inspector Header */}
                    <div class="h-10 px-4 flex items-center justify-between border-b border-ide-border bg-black/20">
                        <span class="text-[10px] font-bold uppercase text-ide-text-muted tracking-[0.2em]">
                            Inspector
                        </span>
                        <button
                            class="p-1 hover:bg-white/5 rounded-md text-ide-text-muted hover:text-white transition-all"
                            onClick={() => setInspectorCollapsed(true)}
                        >
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>

                    {/* Inspector Content */}
                    <div class="flex-1 overflow-y-auto">
                        {props.inspector}
                    </div>
                </aside>

                {/* Vertical Activity Bar Right (Always visible) */}
                <div class="w-12 bg-ide-sidebar border-l border-ide-border flex flex-col items-center py-4 gap-4 z-40">
                    <ActivityIcon
                        active={!inspectorCollapsed()}
                        onClick={() => setInspectorCollapsed(!inspectorCollapsed())}
                        icon="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                        label="Inspector"
                    />
                </div>
            </div>

            {/* Status Bar */}
            <footer class="h-6 bg-ide-accent/5 border-t border-ide-border flex items-center px-4 text-[10px] text-ide-text-muted select-none z-50">
                <Show when={projectState.project}>
                    <div class="flex items-center gap-4">
                        <span class="flex items-center gap-1.5">
                            <span class="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                            <span class="font-medium text-ide-text/80">{projectState.project?.name}</span>
                        </span>
                        <span class="opacity-30">|</span>
                        <span class="hover:text-ide-text cursor-default transition-colors">
                            {projectState.project?.blocks.filter(b => !b.archived).length} blocks
                        </span>
                        <span class="hover:text-ide-text cursor-default transition-colors">
                            {projectState.project?.pages.filter(p => !p.archived).length} pages
                        </span>
                    </div>
                </Show>
                <Show when={!projectState.project}>
                    <span class="font-medium opacity-50 italic">No Active Project</span>
                </Show>
                <div class="ml-auto flex items-center gap-4">
                    <span class="hover:text-ide-text cursor-default transition-colors">UTF-8</span>
                    <span class="font-bold text-indigo-400">Grapes v0.1.0</span>
                </div>
            </footer>
        </div>
    );
};

// Activity Icon Component
interface ActivityIconProps {
    active: boolean;
    onClick: () => void;
    icon: string;
    label: string;
}

const ActivityIcon: Component<ActivityIconProps> = (props) => {
    return (
        <button
            class={`w-12 h-12 flex items-center justify-center transition-all group relative ${props.active
                ? "text-white"
                : "text-ide-text-muted hover:text-white"
                }`}
            onClick={props.onClick}
            title={props.label}
        >
            <Show when={props.active}>
                <div class="absolute left-0 w-[2px] h-6 bg-indigo-500 rounded-r-full shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
            </Show>
            <svg class={`w-6 h-6 transition-transform group-active:scale-90 ${props.active ? "accent-glow" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d={props.icon} />
            </svg>
        </button>
    );
};

// Tab Button Component
interface TabButtonProps {
    active: boolean;
    onClick: () => void;
    icon: string;
    children: JSX.Element;
}

const TabButton: Component<TabButtonProps> = (props) => {
    return (
        <button
            class={`px-3 py-1.5 text-sm rounded-md flex items-center gap-2 transition-colors ${props.active
                ? "bg-ide-accent text-white"
                : "text-ide-text-muted hover:bg-ide-panel hover:text-ide-text"
                }`}
            onClick={props.onClick}
        >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={props.icon} />
            </svg>
            {props.children}
        </button>
    );
};

export default IDELayout;
