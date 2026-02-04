/**
 * BlockPalette Component
 * 
 * Draggable palette of block types that can be dropped on the canvas.
 */

import { Component, For, createSignal, Show } from "solid-js";
import { addBlock } from "../../stores/projectStore";
import PromptModal from "../UI/PromptModal";
import { useToast } from "../../context/ToastContext";

interface BlockCategory {
    name: string;
    blocks: BlockItem[];
}

interface BlockItem {
    type: string;
    name: string;
    icon: string;
    description: string;
}

const blockCategories: BlockCategory[] = [
    {
        name: "Layout",
        blocks: [
            { type: "container", name: "Container", icon: "M4 5a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5z", description: "Basic container" },
            { type: "section", name: "Section", icon: "M4 6h16M4 12h16m-7 6h7", description: "Page section" },
            { type: "columns", name: "Columns", icon: "M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2", description: "Multi-column layout" },
            { type: "flex", name: "Flex", icon: "M4 6h16M4 10h16M4 14h16M4 18h16", description: "Flexbox container" },
            { type: "grid", name: "Grid", icon: "M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z", description: "CSS Grid" },
        ],
    },
    {
        name: "Typography",
        blocks: [
            { type: "heading", name: "Heading", icon: "M4 6h16M4 12h8m-8 6h16", description: "H1-H6 heading" },
            { type: "paragraph", name: "Paragraph", icon: "M4 6h16M4 12h16M4 18h7", description: "Text paragraph" },
            { type: "text", name: "Text", icon: "M12 6v6m0 0v6m0-6h6m-6 0H6", description: "Inline text" },
            { type: "link", name: "Link", icon: "M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1", description: "Hyperlink" },
        ],
    },
    {
        name: "Media",
        blocks: [
            { type: "image", name: "Image", icon: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z", description: "Image" },
            { type: "video", name: "Video", icon: "M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z", description: "Video player" },
            { type: "icon", name: "Icon", icon: "M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z", description: "Icon" },
        ],
    },
    {
        name: "Form",
        blocks: [
            { type: "form", name: "Form", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z", description: "Form container" },
            { type: "input", name: "Input", icon: "M4 6h16v4H4zM4 14h16v4H4z", description: "Text input" },
            { type: "textarea", name: "Textarea", icon: "M4 5h16a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1z", description: "Multi-line input" },
            { type: "select", name: "Select", icon: "M8 9l4-4 4 4m0 6l-4 4-4-4", description: "Dropdown select" },
            { type: "checkbox", name: "Checkbox", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z", description: "Checkbox" },
            { type: "button", name: "Button", icon: "M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122", description: "Button" },
        ],
    },
    {
        name: "Components",
        blocks: [
            { type: "card", name: "Card", icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10", description: "Content card" },
            { type: "modal", name: "Modal", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z", description: "Modal dialog" },
            { type: "tabs", name: "Tabs", icon: "M4 6h4v2H4V6zm6 0h4v2h-4V6zm6 0h4v2h-4V6zM4 12h16v8H4v-8z", description: "Tab container" },
            { type: "accordion", name: "Accordion", icon: "M4 6h16M4 12h16M4 18h16", description: "Collapsible sections" },
            { type: "table", name: "Table", icon: "M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z", description: "Data table" },
        ],
    },
];

const BlockPalette: Component = () => {
    const [expandedCategory, setExpandedCategory] = createSignal<string | null>("Layout");
    const [promptState, setPromptState] = createSignal<{ blockType: string; blockName: string } | null>(null);
    const toast = useToast();

    const handleAddBlock = async (blockType: string, blockName: string) => {
        setPromptState({ blockType, blockName });
    };

    return (
        <div class="h-full overflow-auto bg-ide-sidebar">
            <div class="p-3 border-b border-ide-border">
                <h3 class="text-xs font-semibold uppercase tracking-wider text-ide-text-muted">
                    Block Palette
                </h3>
            </div>

            <Show when={promptState()}>
                <PromptModal
                    isOpen={!!promptState()}
                    title={`Add ${promptState()!.blockName} block`}
                    confirmText="Add"
                    fields={[
                        {
                            name: "name",
                            label: "Block name",
                            placeholder: promptState()!.blockName,
                            value: promptState()!.blockName,
                            required: true,
                        },
                    ]}
                    onClose={() => setPromptState(null)}
                    onSubmit={async (values) => {
                        try {
                            const name = values.name.trim();
                            await addBlock(promptState()!.blockType, name);
                            toast.success(`${promptState()!.blockName} "${name}" added`);
                        } catch (err) {
                            toast.error(`Failed to add block: ${err}`);
                        }
                    }}
                />
            </Show>

            <div class="p-2">
                <For each={blockCategories}>
                    {(category) => (
                        <div class="mb-2">
                            {/* Category Header */}
                            <button
                                class="w-full text-left px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-ide-text-muted hover:text-ide-text flex items-center gap-2 transition-colors"
                                onClick={() => setExpandedCategory(expandedCategory() === category.name ? null : category.name)}
                            >
                                <svg
                                    class={`w-3 h-3 transition-transform ${expandedCategory() === category.name ? "rotate-90" : ""}`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                                </svg>
                                {category.name}
                            </button>

                            {/* Block Items */}
                            {expandedCategory() === category.name && (
                                <div class="grid grid-cols-2 gap-1 mt-1">
                                    <For each={category.blocks}>
                                        {(block) => (
                                            <button
                                                class="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-ide-panel text-ide-text-muted hover:text-ide-text transition-colors group cursor-grab active:cursor-grabbing"
                                                onClick={() => handleAddBlock(block.type, block.name)}
                                                title={block.description}
                                                draggable="true"
                                                onDragStart={(e) => {
                                                    e.dataTransfer?.setData("application/grapes-block", block.type);
                                                    e.dataTransfer!.effectAllowed = "copy";
                                                }}
                                            >
                                                <div class="w-10 h-10 rounded-lg bg-ide-accent/10 group-hover:bg-ide-accent/20 flex items-center justify-center transition-colors">
                                                    <svg class="w-5 h-5 text-ide-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d={block.icon} />
                                                    </svg>
                                                </div>
                                                <span class="text-[10px] font-medium">{block.name}</span>
                                            </button>
                                        )}
                                    </For>
                                </div>
                            )}
                        </div>
                    )}
                </For>
            </div>
        </div>
    );
};

export default BlockPalette;
