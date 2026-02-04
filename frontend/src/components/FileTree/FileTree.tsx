/**
 * FileTree Component
 * 
 * VS Code-style file tree navigation for the project's virtual files.
 */

import { Component, For, Show, createSignal } from "solid-js";
import { projectState, selectPage } from "../../stores/projectStore";

interface FileTreeItemProps {
    name: string;
    icon: string;
    entityId: string;
    isDirectory: boolean;
    children?: FileTreeItemProps[];
    depth: number;
    onClick?: () => void;
}

const FileTreeItem: Component<FileTreeItemProps> = (props) => {
    const [expanded, setExpanded] = createSignal(true);

    const handleClick = () => {
        if (props.isDirectory) {
            setExpanded(!expanded());
        } else if (props.onClick) {
            props.onClick();
        }
    };

    const isSelected = () => {
        if (props.icon === "file-text" && !props.isDirectory) {
            return projectState.selectedPageId === props.entityId;
        }
        return false;
    };

    const getIconPath = (icon: string): string => {
        switch (icon) {
            case "folder":
                return "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z";
            case "file-text":
                return "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z";
            case "box":
                return "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4";
            case "zap":
                return "M13 10V3L4 14h7v7l9-11h-7z";
            case "database":
                return "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4";
            case "git-branch":
                return "M6 3v12m0 0a3 3 0 103 3m-3-3a3 3 0 003-3h6m0 0a3 3 0 103 3m-3-3a3 3 0 00-3-3";
            default:
                return "M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z";
        }
    };

    return (
        <div class="select-none">
            <div
                class={`group flex items-center gap-2 px-3 py-1.5 cursor-pointer text-[12px] transition-all border-l-2 ${isSelected()
                    ? "bg-indigo-500/10 border-indigo-500 text-white"
                    : "border-transparent text-ide-text-muted hover:bg-white/5 hover:text-white"
                    }`}
                style={{ "padding-left": `${props.depth * 12 + 12}px` }}
                onClick={handleClick}
            >
                {/* Expand/Collapse Arrow for directories */}
                <div class="w-3 flex items-center justify-center">
                    <Show when={props.isDirectory}>
                        <svg
                            class={`w-2.5 h-2.5 transition-transform ${expanded() ? "rotate-90" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M9 5l7 7-7 7" />
                        </svg>
                    </Show>
                </div>

                {/* Icon */}
                <svg
                    class={`w-3.5 h-3.5 ${props.isDirectory ? "text-amber-400/80" : isSelected() ? "text-indigo-400" : "text-ide-text-muted/60 group-hover:text-indigo-400"}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={getIconPath(props.icon)} />
                </svg>

                {/* Name */}
                <span class={`truncate ${isSelected() ? "font-bold" : "font-medium"}`}>
                    {props.name}
                </span>
            </div>

            {/* Children */}
            <Show when={props.isDirectory && expanded() && props.children}>
                <div class="animate-fade-in">
                    <For each={props.children}>
                        {(child) => <FileTreeItem {...child} depth={props.depth + 1} />}
                    </For>
                </div>
            </Show>
        </div>
    );
};

const FileTree: Component = () => {
    // Build file tree from project state
    const getFileTree = (): FileTreeItemProps[] => {
        const project = projectState.project;
        if (!project) return [];

        const tree: FileTreeItemProps[] = [];

        // Pages folder
        const pages: FileTreeItemProps[] = project.pages
            .filter((p) => !p.archived)
            .map((page) => ({
                name: `${page.name}.page`,
                icon: "file-text",
                entityId: page.id,
                isDirectory: false,
                depth: 1,
                onClick: () => selectPage(page.id),
            }));

        tree.push({
            name: "Pages",
            icon: "folder",
            entityId: "pages",
            isDirectory: true,
            children: pages,
            depth: 0,
        });

        // Components folder
        const components: FileTreeItemProps[] = project.blocks
            .filter((b) => !b.archived && !b.parent_id)
            .map((block) => ({
                name: `${block.name}.component`,
                icon: "box",
                entityId: block.id,
                isDirectory: false,
                depth: 1,
            }));

        tree.push({
            name: "Components",
            icon: "folder",
            entityId: "components",
            isDirectory: true,
            children: components,
            depth: 0,
        });

        // API folder
        const apis: FileTreeItemProps[] = project.apis
            .filter((a) => !a.archived)
            .map((api) => ({
                name: `${api.name}.api`,
                icon: "zap",
                entityId: api.id,
                isDirectory: false,
                depth: 1,
            }));

        tree.push({
            name: "API",
            icon: "folder",
            entityId: "api",
            isDirectory: true,
            children: apis,
            depth: 0,
        });

        // Models folder
        const models: FileTreeItemProps[] = project.data_models
            .filter((m) => !m.archived)
            .map((model) => ({
                name: `${model.name}.model`,
                icon: "database",
                entityId: model.id,
                isDirectory: false,
                depth: 1,
            }));

        tree.push({
            name: "Models",
            icon: "folder",
            entityId: "models",
            isDirectory: true,
            children: models,
            depth: 0,
        });

        // Logic flows folder
        const flows: FileTreeItemProps[] = project.logic_flows
            .filter((f) => !f.archived)
            .map((flow) => ({
                name: `${flow.name}.flow`,
                icon: "git-branch",
                entityId: flow.id,
                isDirectory: false,
                depth: 1,
            }));

        tree.push({
            name: "Logic",
            icon: "folder",
            entityId: "logic",
            isDirectory: true,
            children: flows,
            depth: 0,
        });

        return tree;
    };

    return (
        <div class="py-2">
            <Show
                when={projectState.project}
                fallback={
                    <div class="px-6 py-12 text-center animate-fade-in">
                        <div class="w-12 h-12 mx-auto mb-4 rounded-xl bg-white/5 flex items-center justify-center text-ide-text-muted/40">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                            </svg>
                        </div>
                        <p class="text-[12px] font-bold text-ide-text-muted uppercase tracking-widest">No Project</p>
                        <p class="mt-2 text-[10px] text-ide-text-muted/60 leading-relaxed px-4">
                            Select or create a project to see the file tree structure.
                        </p>
                    </div>
                }
            >
                <div class="space-y-[1px]">
                    <For each={getFileTree()}>
                        {(item) => <FileTreeItem {...item} />}
                    </For>
                </div>
            </Show>
        </div>
    );
};

export default FileTree;
