/**
 * Toolbar Component
 * 
 * Main toolbar with project actions, undo/redo, and export.
 */

import { Component, Show, createSignal, JSX } from "solid-js";
import {
    projectState,
    createProject,
    exportProject,
    addBlock,
    addPage,
    addDataModel,
    addApi,
    generateFrontend,
    generateBackend,
    generateDatabase,
} from "../../stores/projectStore";
import CodePreviewModal from "../Modals/CodePreviewModal";

const Toolbar: Component = () => {
    const [showNewMenu, setShowNewMenu] = createSignal(false);
    const [showExportMenu, setShowExportMenu] = createSignal(false);

    // Generation State
    const [previewData, setPreviewData] = createSignal<{ title: string; files: { path: string; content: string }[] } | null>(null);

    const handleNewProject = async () => {
        const name = prompt("Enter project name:");
        if (name) {
            await createProject(name);
        }
    };

    const handleGenerate = async (type: 'frontend' | 'backend' | 'database') => {
        try {
            let files;
            let title;
            if (type === 'frontend') {
                files = await generateFrontend();
                title = "Generated React Code";
            } else if (type === 'backend') {
                files = await generateBackend();
                title = "Generated NestJS Code";
            } else {
                files = await generateDatabase();
                title = "Generated Prisma Schema";
            }
            setPreviewData({ title, files });
            setShowExportMenu(false);
        } catch (err) {
            console.error("Generation failed:", err);
            alert("Generation failed: " + err);
        }
    };

    const handleExportJson = async () => {
        try {
            const json = await exportProject();
            const blob = new Blob([json], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${projectState.project?.name || "project"}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error("Export failed:", err);
            alert("Export failed: " + err);
        }
    };

    const handleAddBlock = async (blockType: string) => {
        const name = prompt(`Enter ${blockType} name:`);
        if (name) {
            await addBlock(blockType, name);
        }
        setShowNewMenu(false);
    };

    const handleAddPage = async () => {
        const name = prompt("Enter page name:");
        if (name) {
            const path = prompt("Enter page path:", `/${name.toLowerCase()}`);
            if (path) {
                await addPage(name, path);
            }
        }
        setShowNewMenu(false);
    };

    const handleAddModel = async () => {
        const name = prompt("Enter model name (PascalCase):");
        if (name) {
            await addDataModel(name);
        }
        setShowNewMenu(false);
    };

    const handleAddApi = async () => {
        const method = prompt("Enter HTTP method (GET, POST, PUT, DELETE):", "GET");
        if (method) {
            const path = prompt("Enter API path:", "/");
            if (path) {
                const name = prompt("Enter endpoint name:");
                if (name) {
                    await addApi(method.toUpperCase(), path, name);
                }
            }
        }
        setShowNewMenu(false);
    };

    return (
        <div class="h-full flex items-center px-4 gap-4 select-none">
            {/* Logo & Version */}
            <div class="flex items-center gap-3">
                <div class="w-7 h-7 rounded-md bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-700 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                    <span class="text-white font-black text-xs tracking-tighter">GR</span>
                </div>
                <div class="flex flex-col -gap-1">
                    <span class="text-xs font-bold text-white leading-none">Grapes IDE</span>
                    <span class="text-[8px] font-bold text-ide-text-muted uppercase tracking-widest opacity-50">Editor</span>
                </div>
            </div>

            {/* Divider */}
            <div class="w-px h-6 bg-white/5 mx-2" />

            {/* Quick Actions */}
            <div class="flex items-center gap-1">
                <button
                    class="btn-ghost !px-2.5 h-8 !text-xs font-medium bg-white/5 hover:bg-white/10"
                    onClick={handleNewProject}
                >
                    <svg class="w-3.5 h-3.5 mr-1.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    New
                </button>

                <div class="relative">
                    <button
                        class={`btn-ghost !px-2.5 h-8 !text-xs font-medium ${showNewMenu() ? 'bg-white/10 text-white' : ''}`}
                        onClick={() => setShowNewMenu(!showNewMenu())}
                        disabled={!projectState.project}
                    >
                        <svg class="w-3.5 h-3.5 mr-1.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Add
                        <svg class={`w-2.5 h-2.5 ml-1.5 transition-transform ${showNewMenu() ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>

                    <Show when={showNewMenu()}>
                        <div
                            class="absolute top-full left-0 mt-2 w-56 bg-ide-panel border border-ide-border rounded-xl shadow-2xl z-50 py-1.5 glass animate-fade-in"
                            onMouseLeave={() => setShowNewMenu(false)}
                        >
                            <div class="px-3 py-1.5 text-[10px] font-bold text-ide-text-muted uppercase tracking-widest">UI Blocks</div>
                            <MenuButton onClick={() => handleAddBlock("container")} icon="box">Container Block</MenuButton>
                            <MenuButton onClick={() => handleAddBlock("text")} icon="type">Text Block</MenuButton>
                            <MenuButton onClick={() => handleAddBlock("button")} icon="square">Button Block</MenuButton>
                            <div class="border-t border-ide-border my-1.5" />
                            <div class="px-3 py-1.5 text-[10px] font-bold text-ide-text-muted uppercase tracking-widest">Architecture</div>
                            <MenuButton onClick={handleAddPage} icon="file-text">New Page</MenuButton>
                            <MenuButton onClick={handleAddModel} icon="database">Database Model</MenuButton>
                            <MenuButton onClick={handleAddApi} icon="zap">API Endpoint</MenuButton>
                        </div>
                    </Show>
                </div>
            </div>

            {/* History Controls */}
            <div class="flex items-center gap-0.5 bg-black/20 p-0.5 rounded-lg border border-white/5">
                <button class="btn-ghost !p-1.5 hover:text-white" disabled={!projectState.project} title="Undo (Ctrl+Z)">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                    </svg>
                </button>
                <button class="btn-ghost !p-1.5 hover:text-white" disabled={!projectState.project} title="Redo (Ctrl+Y)">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
                    </svg>
                </button>
            </div>

            {/* Spacer */}
            <div class="flex-1" />

            {/* Secondary Actions */}
            <div class="flex items-center gap-2">
                <div class="relative">
                    <button
                        class={`btn-primary !h-8 !px-4 !text-xs font-bold ${showExportMenu() ? 'ring-2 ring-indigo-500/50' : ''}`}
                        onClick={() => setShowExportMenu(!showExportMenu())}
                        disabled={!projectState.project}
                    >
                        <svg class="w-3.5 h-3.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        Ship App
                        <svg class={`w-2.5 h-2.5 ml-2 transition-transform ${showExportMenu() ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>

                    <Show when={showExportMenu()}>
                        <div
                            class="absolute top-full right-0 mt-2 w-64 bg-ide-panel border border-ide-border rounded-xl shadow-2xl z-50 py-1.5 glass animate-fade-in"
                            onMouseLeave={() => setShowExportMenu(false)}
                        >
                            <div class="px-3 py-1.5 text-[10px] font-bold text-ide-text-muted uppercase tracking-widest">Local Export</div>
                            <MenuButton onClick={handleExportJson} icon="download">Download IDE JSON</MenuButton>
                            <div class="border-t border-ide-border my-1.5" />
                            <div class="px-3 py-1.5 text-[10px] font-bold text-ide-text-muted uppercase tracking-widest">Code Generation</div>
                            <MenuButton onClick={() => handleGenerate('frontend')} icon="code">React + Tailwind UI</MenuButton>
                            <MenuButton onClick={() => handleGenerate('backend')} icon="server">NestJS Runtime</MenuButton>
                            <MenuButton onClick={() => handleGenerate('database')} icon="database">Prisma Schema</MenuButton>
                            <div class="border-t border-ide-border my-1.5" />
                            <MenuButton onClick={() => alert("Deployment pipeline starting...")} icon="package">
                                <span class="text-indigo-400 font-bold">Deploy to Vercel</span>
                            </MenuButton>
                        </div>
                    </Show>
                </div>
            </div>

            {/* Code Preview Modal */}
            <Show when={previewData()}>
                <CodePreviewModal
                    title={previewData()!.title}
                    files={previewData()!.files}
                    onClose={() => setPreviewData(null)}
                />
            </Show>
        </div>
    );
};

// Menu Button Component
interface MenuButtonProps {
    onClick: () => void;
    icon: string;
    children: JSX.Element;
}

const MenuButton: Component<MenuButtonProps> = (props) => {
    const getIconPath = (icon: string): string => {
        switch (icon) {
            case "box":
                return "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4";
            case "type":
                return "M4 6h16M4 12h16m-7 6h7";
            case "square":
                return "M5 3a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2H5z";
            case "file-text":
                return "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z";
            case "database":
                return "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4";
            case "zap":
                return "M13 10V3L4 14h7v7l9-11h-7z";
            case "download":
                return "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4";
            case "code":
                return "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4";
            case "server":
                return "M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01";
            case "package":
                return "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4";
            default:
                return "M12 6v6m0 0v6m0-6h6m-6 0H6";
        }
    };

    return (
        <button
            class="w-full px-3 py-2 text-left text-xs text-ide-text hover:bg-indigo-500 hover:text-white transition-all flex items-center gap-2 rounded-lg"
            onClick={props.onClick}
        >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d={getIconPath(props.icon)}
                />
            </svg>
            {props.children}
        </button>
    );
};

export default Toolbar;
