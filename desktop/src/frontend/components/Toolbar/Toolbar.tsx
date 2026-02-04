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
    downloadProjectZip,
    setViewport,
} from "../../stores/projectStore";
import CodePreviewModal from "../Modals/CodePreviewModal";
import { useToast } from "../../context/ToastContext";
import PromptModal, { PromptField } from "../UI/PromptModal";

const Toolbar: Component = () => {
    const [showNewMenu, setShowNewMenu] = createSignal(false);
    const [showExportMenu, setShowExportMenu] = createSignal(false);
    const toast = useToast();

    type PromptConfig = {
        title: string;
        fields: PromptField[];
        confirmText?: string;
        onSubmit: (values: Record<string, string>) => Promise<void> | void;
    };

    const [promptConfig, setPromptConfig] = createSignal<PromptConfig | null>(null);
    const closePrompt = () => setPromptConfig(null);

    // Generation State
    const [previewData, setPreviewData] = createSignal<{ title: string; files: { path: string; content: string }[] } | null>(null);

    const handleNewProject = async () => {
        setPromptConfig({
            title: "New Project",
            confirmText: "Create",
            fields: [
                {
                    name: "name",
                    label: "Project name",
                    placeholder: "My Grapes App",
                    required: true,
                },
            ],
            onSubmit: async (values) => {
                try {
                    await createProject(values.name.trim());
                    toast.success(`Project "${values.name.trim()}" created`);
                } catch (err) {
                    toast.error(`Failed to create project: ${err}`);
                }
            },
        });
    };

    const handleGenerate = async (type: 'frontend' | 'backend' | 'database') => {
        try {
            let files;
            let title;
            toast.info(`Generating ${type} code...`);
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
            toast.success(`${title} ready for preview`);
        } catch (err) {
            console.error("Generation failed:", err);
            toast.error("Generation failed: " + err);
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
            toast.success("Project JSON exported");
        } catch (err) {
            console.error("Export failed:", err);
            toast.error("Export failed: " + err);
        }
    };

    const handleExportZip = async () => {
        try {
            toast.info("Preparing project ZIP...");
            await downloadProjectZip();
            toast.success("Project ZIP downloaded!");
            setShowExportMenu(false);
        } catch (err) {
            toast.error("Failed to download ZIP: " + err);
        }
    };

    const handleDeployVercel = () => {
        toast.info("To deploy to Vercel:");
        toast.info("1. Download Source Code (ZIP)");
        toast.info("2. Unzip and run 'npm install'");
        toast.info("3. Run 'vercel deploy'");
        window.open("https://vercel.com/docs/cli/deploying-from-cli", "_blank");
    };

    const handleAddBlock = async (blockType: string) => {
        setShowNewMenu(false);
        setPromptConfig({
            title: `Add ${blockType} block`,
            confirmText: "Add",
            fields: [
                {
                    name: "name",
                    label: "Block name",
                    placeholder: `${blockType} block`,
                    value: blockType,
                    required: true,
                },
            ],
            onSubmit: async (values) => {
                try {
                    const name = values.name.trim();
                    await addBlock(blockType, name);
                    toast.success(`${blockType} "${name}" added`);
                } catch (err) {
                    toast.error(`Failed to add block: ${err}`);
                }
            },
        });
    };

    const handleAddPage = async () => {
        setShowNewMenu(false);
        setPromptConfig({
            title: "New Page",
            confirmText: "Create",
            fields: [
                {
                    name: "name",
                    label: "Page name",
                    placeholder: "Home",
                    required: true,
                },
                {
                    name: "path",
                    label: "Page path",
                    placeholder: "/home",
                    required: true,
                },
            ],
            onSubmit: async (values) => {
                try {
                    const name = values.name.trim();
                    const path = values.path.trim() || `/${name.toLowerCase()}`;
                    await addPage(name, path);
                    toast.success(`Page "${name}" created`);
                } catch (err) {
                    toast.error(`Failed to create page: ${err}`);
                }
            },
        });
    };

    const handleAddModel = async () => {
        setShowNewMenu(false);
        setPromptConfig({
            title: "New Data Model",
            confirmText: "Create",
            fields: [
                {
                    name: "name",
                    label: "Model name",
                    placeholder: "User",
                    helperText: "Use PascalCase (e.g., User, BlogPost)",
                    required: true,
                },
            ],
            onSubmit: async (values) => {
                try {
                    const name = values.name.trim();
                    await addDataModel(name);
                    toast.success(`Model "${name}" created`);
                } catch (err) {
                    toast.error(`Failed to create model: ${err}`);
                }
            },
        });
    };

    const handleAddApi = async () => {
        setShowNewMenu(false);
        setPromptConfig({
            title: "New API Endpoint",
            confirmText: "Create",
            fields: [
                {
                    name: "method",
                    label: "HTTP method",
                    placeholder: "GET",
                    value: "GET",
                    required: true,
                },
                {
                    name: "path",
                    label: "Path",
                    placeholder: "/",
                    value: "/",
                    required: true,
                },
                {
                    name: "name",
                    label: "Endpoint name",
                    placeholder: "ListUsers",
                    required: true,
                },
            ],
            onSubmit: async (values) => {
                try {
                    const method = values.method.trim().toUpperCase();
                    const path = values.path.trim();
                    const name = values.name.trim();
                    await addApi(method, path, name);
                    toast.success(`API "${name}" created`);
                } catch (err) {
                    toast.error(`Failed to create API: ${err}`);
                }
            },
        });
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

            {/* Viewport Controls */}
            <div class="flex items-center gap-1 bg-black/20 p-0.5 rounded-lg border border-white/5 mx-4 hidden md:flex">
                <button
                    class={`btn-ghost !p-1.5 hover:text-white ${projectState.viewport === 'desktop' ? 'bg-white/10 text-white shadow-sm' : 'text-ide-text-muted'}`}
                    onClick={() => setViewport('desktop')}
                    title="Desktop View (100%)"
                >
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                </button>
                <button
                    class={`btn-ghost !p-1.5 hover:text-white ${projectState.viewport === 'tablet' ? 'bg-white/10 text-white shadow-sm' : 'text-ide-text-muted'}`}
                    onClick={() => setViewport('tablet')}
                    title="Tablet View (768px)"
                >
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                </button>
                <button
                    class={`btn-ghost !p-1.5 hover:text-white ${projectState.viewport === 'mobile' ? 'bg-white/10 text-white shadow-sm' : 'text-ide-text-muted'}`}
                    onClick={() => setViewport('mobile')}
                    title="Mobile View (375px)"
                >
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                </button>
            </div>

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
                            <MenuButton onClick={handleExportZip} icon="package">
                                <span class="text-white font-bold">Download Source Code (ZIP)</span>
                            </MenuButton>
                            <MenuButton onClick={handleDeployVercel} icon="zap">
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

            <Show when={promptConfig()}>
                <PromptModal
                    isOpen={!!promptConfig()}
                    title={promptConfig()!.title}
                    fields={promptConfig()!.fields}
                    confirmText={promptConfig()!.confirmText}
                    onClose={closePrompt}
                    onSubmit={promptConfig()!.onSubmit}
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
