/**
 * Canvas Component
 * 
 * The main visual editing area where blocks are displayed and manipulated.
 */

import { Component, For, Show, createMemo } from "solid-js";
import {
    projectState,
    selectBlock,
    getBlockChildren,
    getRootBlocks,
    getSelectedPage,
    addBlock,
} from "../../stores/projectStore";
import { BlockSchema } from "../../hooks/useTauri";
import { useToast } from "../../context/ToastContext";

const Canvas: Component = () => {
    const selectedPage = createMemo(() => getSelectedPage());
    const rootBlocks = createMemo(() => getRootBlocks());

    const handleDragOver = (e: DragEvent) => {
        e.preventDefault();
        e.dataTransfer!.dropEffect = "copy";
    };

    const handleDrop = async (e: DragEvent) => {
        e.preventDefault();
        const blockType = e.dataTransfer?.getData("application/grapes-block");
        if (blockType) {
            // Add block to root or selected parent
            // For dragging onto specific container, we'd need hit testing, 
            // but for now, dropping on canvas adds to root.
            const name = `New ${blockType.charAt(0).toUpperCase() + blockType.slice(1)}`;
            await addBlock(blockType, name);
        }
    };

    return (
        <div
            class="h-full bg-ide-bg flex flex-col relative overflow-auto p-2"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            <Show
                when={projectState.project}
                fallback={<WelcomeScreen />}
            >
                <Show
                    when={selectedPage()}
                    fallback={
                        <div class="flex items-center justify-center h-full text-ide-text-muted">
                            <p>Select a page from the left sidebar</p>
                        </div>
                    }
                >
                    {/* Page Container */}
                    <div
                        class="bg-white rounded-lg shadow-2xl mx-auto transition-all duration-300 ease-in-out border border-transparent flex flex-col"
                        classList={{
                            'w-full min-h-full': projectState.viewport === 'desktop',
                            'w-[768px] min-h-[800px]': projectState.viewport === 'tablet',
                            'w-[375px] min-h-[667px]': projectState.viewport === 'mobile',
                        }}
                    >
                        {/* Page Header */}
                        <div class="bg-slate-100 rounded-t-lg px-4 py-2 flex items-center gap-2 border-b">
                            <div class="flex gap-1.5">
                                <div class="w-3 h-3 rounded-full bg-red-400" />
                                <div class="w-3 h-3 rounded-full bg-yellow-400" />
                                <div class="w-3 h-3 rounded-full bg-green-400" />
                            </div>
                            <div class="flex-1 text-center">
                                <span class="text-xs text-slate-500 bg-white px-3 py-1 rounded-md">
                                    {selectedPage()?.path || "/"}
                                </span>
                            </div>
                        </div>

                        {/* Canvas Content */}
                        <div class="p-4 min-h-[500px]">
                            <Show
                                when={rootBlocks().length > 0}
                                fallback={
                                    <div class="h-[400px] border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center text-slate-400">
                                        <div class="text-center">
                                            <svg class="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                            </svg>
                                            <p>Drop blocks here to start building</p>
                                            <p class="text-sm mt-1">Use the toolbar to add new blocks</p>
                                        </div>
                                    </div>
                                }
                            >
                                <For each={rootBlocks()}>
                                    {(block) => <BlockRenderer block={block} />}
                                </For>
                            </Show>
                        </div>
                    </div>
                </Show>
            </Show>
        </div>
    );
};

// Block Renderer Component
interface BlockRendererProps {
    block: BlockSchema;
}

const BlockRenderer: Component<BlockRendererProps> = (props) => {
    const isSelected = () => projectState.selectedBlockId === props.block.id;
    const children = createMemo(() => getBlockChildren(props.block.id));

    const handleClick = (e: MouseEvent) => {
        e.stopPropagation();
        selectBlock(props.block.id);
    };

    // Get block styles
    const getBlockClasses = (): string => {
        const base = "block-hover cursor-pointer transition-all";
        const selected = isSelected() ? "outline outline-2 outline-indigo-500 outline-offset-2" : "";
        const typeClasses = getTypeClasses(props.block.block_type);
        return `${base} ${selected} ${typeClasses}`;
    };

    const getTypeClasses = (blockType: string): string => {
        switch (blockType) {
            case "container":
                return "p-4 bg-slate-50 rounded-lg min-h-[100px]";
            case "section":
                return "p-6 bg-slate-100 rounded-lg";
            case "text":
            case "paragraph":
                return "p-2";
            case "heading":
                return "p-2 text-2xl font-bold";
            case "button":
                return "px-4 py-2 bg-indigo-600 text-white rounded-lg inline-block hover:bg-indigo-500";
            case "image":
                return "bg-slate-200 rounded-lg min-h-[100px] flex items-center justify-center";
            case "input":
                return "border border-slate-300 rounded-lg px-3 py-2 bg-white";
            case "form":
                return "p-4 bg-slate-50 rounded-lg border border-slate-200";
            case "card":
                return "p-4 bg-white rounded-lg shadow-md";
            default:
                return "p-2 bg-slate-50 rounded min-h-[40px]";
        }
    };

    // Render block content based on type
    const renderContent = () => {
        const blockType = props.block.block_type;
        const text = props.block.properties.text as string | undefined;

        switch (blockType) {
            case "text":
            case "paragraph":
                return <p class="text-slate-700">{text || "Text content..."}</p>;
            case "heading":
                return <h2 class="text-slate-900">{text || "Heading"}</h2>;
            case "button":
                return <span>{text || "Button"}</span>;
            case "image":
                return (
                    <div class="text-slate-400 text-center">
                        <svg class="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span class="text-xs">Image</span>
                    </div>
                );
            case "input":
                return (
                    <input
                        type="text"
                        placeholder={text || "Input..."}
                        class="w-full outline-none bg-transparent"
                        disabled
                    />
                );
            default:
                return null;
        }
    };

    return (
        <div
            class={getBlockClasses()}
            onClick={handleClick}
            data-block-id={props.block.id}
        >
            {/* Block Label (shown when selected) */}
            <Show when={isSelected()}>
                <div class="absolute -top-6 left-0 bg-indigo-500 text-white text-xs px-2 py-0.5 rounded">
                    {props.block.name || props.block.block_type}
                </div>
            </Show>

            {/* Block Content */}
            {renderContent()}

            {/* Render Children */}
            <Show when={children().length > 0}>
                <div class="space-y-2">
                    <For each={children()}>
                        {(child) => <BlockRenderer block={child} />}
                    </For>
                </div>
            </Show>
        </div>
    );
};

// Welcome Screen Component
const WelcomeScreen: Component = () => {
    const toast = useToast();
    return (
        <div class="h-full flex items-center justify-center p-12 bg-[#050508]">
            <div class="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center animate-fade-up">
                <div>
                    <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-bold uppercase tracking-widest mb-6">
                        <span class="relative flex h-2 w-2">
                            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                            <span class="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                        </span>
                        Beta v0.1.0 Ready
                    </div>
                    <h1 class="text-5xl font-black text-white leading-tight mb-4 tracking-tighter">
                        Build software at the <span class="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">speed of thought.</span>
                    </h1>
                    <p class="text-lg text-ide-text-muted mb-8 leading-relaxed">
                        Grapes is the visual engineering platform for high-performance React applications,
                        NestJS services, and complex database schemas.
                    </p>
                    <div class="flex flex-wrap gap-4">
                        <button
                            class="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/20 active:scale-95 flex items-center gap-2"
                            onClick={() => toast.info("Use the top-left 'New' button to start!")}
                        >
                            Get Started
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                        </button>
                        <button class="px-6 py-3 bg-white/5 hover:bg-white/10 text-white font-medium rounded-xl border border-white/10 transition-all backdrop-blur-md active:scale-95">
                            Read Docs
                        </button>
                    </div>
                </div>

                <div class="relative">
                    <div class="absolute inset-0 bg-indigo-500/20 blur-[120px] rounded-full"></div>
                    <div class="relative glass rounded-2xl border border-white/10 p-2 shadow-2xl overflow-hidden aspect-video group">
                        <div class="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent pointer-events-none"></div>
                        <div class="h-full w-full bg-[#0d0d14] rounded-xl flex flex-col p-4">
                            <div class="flex items-center gap-1.5 mb-4">
                                <div class="w-2.5 h-2.5 rounded-full bg-red-500/50"></div>
                                <div class="w-2.5 h-2.5 rounded-full bg-yellow-500/50"></div>
                                <div class="w-2.5 h-2.5 rounded-full bg-green-500/50"></div>
                            </div>
                            <div class="flex-1 flex flex-col gap-2">
                                <div class="w-2/3 h-4 bg-white/5 rounded"></div>
                                <div class="w-full h-32 bg-white/5 rounded-lg border border-white/5 flex items-center justify-center">
                                    <svg class="w-12 h-12 text-white/10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <div class="grid grid-cols-3 gap-2 mt-2">
                                    <div class="h-12 bg-white/5 rounded border border-white/5"></div>
                                    <div class="h-12 bg-white/5 rounded border border-white/5"></div>
                                    <div class="h-12 bg-white/5 rounded border border-white/5"></div>
                                </div>
                            </div>
                        </div>
                        {/* Hover Overlay */}
                        <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                            <p class="text-white font-bold text-sm bg-indigo-600 px-4 py-2 rounded-full shadow-xl">Start Building Now</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Canvas;
