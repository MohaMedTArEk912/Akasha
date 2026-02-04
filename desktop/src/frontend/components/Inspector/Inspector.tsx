/**
 * Inspector Component
 * 
 * Properties panel for the selected block/entity.
 */

import { Component, Show, createMemo } from "solid-js";
import {
    getSelectedBlock,
    updateBlockProperty,
    updateBlockStyle,
    archiveBlock,
} from "../../stores/projectStore";
import { BlockSchema } from "../../hooks/useTauri";

const Inspector: Component = () => {
    const selectedBlock = createMemo(() => getSelectedBlock());

    return (
        <div class="p-4">
            <Show
                when={selectedBlock()}
                fallback={<NoSelection />}
            >
                {(block) => (
                    <>
                        {/* Block Info Header */}
                        <div class="mb-4">
                            <div class="flex items-center justify-between">
                                <span class="text-xs uppercase tracking-wider text-ide-text-muted">
                                    {block().block_type}
                                </span>
                                <button
                                    class="text-ide-error hover:bg-ide-error/20 p-1 rounded transition-colors"
                                    onClick={() => archiveBlock(block().id)}
                                    aria-label="Delete block"
                                >
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                            </div>
                            <h3 class="text-lg font-semibold text-ide-text mt-1">
                                {block().name}
                            </h3>
                        </div>

                        {/* Sections */}
                        <InspectorSection title="Properties">
                            <PropertyEditor block={block()} />
                        </InspectorSection>

                        <InspectorSection title="Layout">
                            <LayoutEditor block={block()} />
                        </InspectorSection>

                        <InspectorSection title="Typography">
                            <TypographyEditor block={block()} />
                        </InspectorSection>

                        <InspectorSection title="Spacing">
                            <SpacingEditor block={block()} />
                        </InspectorSection>
                    </>
                )}
            </Show>
        </div>
    );
};

// No Selection Placeholder
const NoSelection: Component = () => {
    return (
        <div class="flex flex-col items-center justify-center h-64 text-center text-ide-text-muted">
            <svg class="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
            </svg>
            <p class="text-sm">Select a block to edit</p>
            <p class="text-xs mt-1">Click on any element in the canvas</p>
        </div>
    );
};

// Inspector Section Component
interface InspectorSectionProps {
    title: string;
    children: any;
}

const InspectorSection: Component<InspectorSectionProps> = (props) => {
    return (
        <div class="mb-4 border-t border-ide-border pt-4">
            <h4 class="text-xs font-semibold uppercase tracking-wider text-ide-text-muted mb-3">
                {props.title}
            </h4>
            {props.children}
        </div>
    );
};

// Property Editor
interface EditorProps {
    block: BlockSchema;
}

const PropertyEditor: Component<EditorProps> = (props) => {
    const handleTextChange = async (value: string) => {
        await updateBlockProperty(props.block.id, "text", value);
    };

    return (
        <div class="space-y-3">
            {/* Name/Label */}
            <div>
                <label class="block text-xs text-ide-text-muted mb-1">Name</label>
                <input
                    type="text"
                    value={props.block.name}
                    class="input w-full text-sm"
                    disabled
                />
            </div>

            {/* Text Content (for text-based blocks) */}
            <Show when={["text", "paragraph", "heading", "button"].includes(props.block.block_type)}>
                <div>
                    <label class="block text-xs text-ide-text-muted mb-1">Text Content</label>
                    <textarea
                        value={(props.block.properties.text as string) || ""}
                        onBlur={(e) => handleTextChange(e.currentTarget.value)}
                        class="input w-full text-sm resize-none"
                        rows="3"
                    />
                </div>
            </Show>

            {/* Placeholder (for inputs) */}
            <Show when={props.block.block_type === "input"}>
                <div>
                    <label class="block text-xs text-ide-text-muted mb-1">Placeholder</label>
                    <input
                        type="text"
                        value={(props.block.properties.placeholder as string) || ""}
                        class="input w-full text-sm"
                    />
                </div>
            </Show>
        </div>
    );
};

// Layout Editor
const LayoutEditor: Component<EditorProps> = (props) => {
    const handleDisplayChange = async (value: string) => {
        await updateBlockStyle(props.block.id, "display", value);
    };

    return (
        <div class="space-y-3">
            <div>
                <label class="block text-xs text-ide-text-muted mb-1">Display</label>
                <select
                    class="input w-full text-sm"
                    onChange={(e) => handleDisplayChange(e.currentTarget.value)}
                >
                    <option value="block">Block</option>
                    <option value="flex">Flex</option>
                    <option value="grid">Grid</option>
                    <option value="inline">Inline</option>
                    <option value="inline-block">Inline Block</option>
                    <option value="none">Hidden</option>
                </select>
            </div>

            <div class="grid grid-cols-2 gap-2">
                <div>
                    <label class="block text-xs text-ide-text-muted mb-1">Width</label>
                    <input type="text" placeholder="auto" class="input w-full text-sm" />
                </div>
                <div>
                    <label class="block text-xs text-ide-text-muted mb-1">Height</label>
                    <input type="text" placeholder="auto" class="input w-full text-sm" />
                </div>
            </div>
        </div>
    );
};

// Typography Editor
const TypographyEditor: Component<EditorProps> = (_props) => {
    return (
        <div class="space-y-3">
            <div class="grid grid-cols-2 gap-2">
                <div>
                    <label class="block text-xs text-ide-text-muted mb-1">Font Size</label>
                    <select class="input w-full text-sm">
                        <option value="12px">12px</option>
                        <option value="14px">14px</option>
                        <option value="16px" selected>16px</option>
                        <option value="18px">18px</option>
                        <option value="20px">20px</option>
                        <option value="24px">24px</option>
                        <option value="32px">32px</option>
                        <option value="48px">48px</option>
                    </select>
                </div>
                <div>
                    <label class="block text-xs text-ide-text-muted mb-1">Weight</label>
                    <select class="input w-full text-sm">
                        <option value="300">Light</option>
                        <option value="400" selected>Normal</option>
                        <option value="500">Medium</option>
                        <option value="600">Semibold</option>
                        <option value="700">Bold</option>
                    </select>
                </div>
            </div>

            <div>
                <label class="block text-xs text-ide-text-muted mb-1">Text Color</label>
                <div class="flex gap-2">
                    <input
                        type="color"
                        value="#1e293b"
                        class="w-10 h-8 rounded border border-ide-border cursor-pointer"
                    />
                    <input
                        type="text"
                        value="#1e293b"
                        class="input flex-1 text-sm font-mono"
                    />
                </div>
            </div>

            <div>
                <label class="block text-xs text-ide-text-muted mb-1">Align</label>
                <div class="flex gap-1">
                    <AlignButton icon="M4 6h16M4 12h10M4 18h16" />
                    <AlignButton icon="M4 6h16M4 12h16M4 18h16" />
                    <AlignButton icon="M4 6h16M10 12h10M4 18h16" />
                    <AlignButton icon="M4 6h16M4 12h16M4 18h16" />
                </div>
            </div>
        </div>
    );
};

// Spacing Editor
const SpacingEditor: Component<EditorProps> = (_props) => {
    return (
        <div class="space-y-3">
            <div>
                <label class="block text-xs text-ide-text-muted mb-1">Margin</label>
                <div class="grid grid-cols-4 gap-1">
                    <input type="text" placeholder="0" class="input text-sm text-center" title="Top" />
                    <input type="text" placeholder="0" class="input text-sm text-center" title="Right" />
                    <input type="text" placeholder="0" class="input text-sm text-center" title="Bottom" />
                    <input type="text" placeholder="0" class="input text-sm text-center" title="Left" />
                </div>
                <div class="grid grid-cols-4 gap-1 mt-1 text-[10px] text-ide-text-muted text-center">
                    <span>Top</span>
                    <span>Right</span>
                    <span>Bottom</span>
                    <span>Left</span>
                </div>
            </div>

            <div>
                <label class="block text-xs text-ide-text-muted mb-1">Padding</label>
                <div class="grid grid-cols-4 gap-1">
                    <input type="text" placeholder="0" class="input text-sm text-center" title="Top" />
                    <input type="text" placeholder="0" class="input text-sm text-center" title="Right" />
                    <input type="text" placeholder="0" class="input text-sm text-center" title="Bottom" />
                    <input type="text" placeholder="0" class="input text-sm text-center" title="Left" />
                </div>
                <div class="grid grid-cols-4 gap-1 mt-1 text-[10px] text-ide-text-muted text-center">
                    <span>Top</span>
                    <span>Right</span>
                    <span>Bottom</span>
                    <span>Left</span>
                </div>
            </div>
        </div>
    );
};

// Align Button Component
interface AlignButtonProps {
    icon: string;
}

const AlignButton: Component<AlignButtonProps> = (props) => {
    return (
        <button class="p-2 hover:bg-ide-panel rounded transition-colors">
            <svg class="w-4 h-4 text-ide-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={props.icon} />
            </svg>
        </button>
    );
};

export default Inspector;
