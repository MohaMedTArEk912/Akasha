import { Component, For, createSignal } from "solid-js";
import { useToast } from "../../context/ToastContext";

interface CodeFile {
    path: string;
    content: string;
}

interface CodePreviewModalProps {
    title: string;
    files: CodeFile[];
    onClose: () => void;
}

const CodePreviewModal: Component<CodePreviewModalProps> = (props) => {
    const [selectedFileIndex, setSelectedFileIndex] = createSignal(0);
    const currentFile = () => props.files[selectedFileIndex()];
    const toast = useToast();

    return (
        <div class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div class="bg-ide-bg border border-ide-border rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div class="flex items-center justify-between px-6 py-4 border-b border-ide-border bg-ide-panel">
                    <h3 class="text-lg font-bold text-ide-text">{props.title}</h3>
                    <button onClick={props.onClose} class="text-ide-text-muted hover:text-ide-text">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div class="flex-1 flex overflow-hidden">
                    {/* Sidebar: File List */}
                    <div class="w-64 border-r border-ide-border overflow-y-auto bg-ide-panel/30">
                        <div class="px-4 py-3 text-xs font-bold text-ide-text-muted uppercase tracking-wider">
                            Files
                        </div>
                        <For each={props.files}>
                            {(file, index) => (
                                <button
                                    class={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 transition-colors ${selectedFileIndex() === index()
                                        ? "bg-ide-accent text-white"
                                        : "text-ide-text-muted hover:bg-ide-panel hover:text-ide-text"
                                        }`}
                                    onClick={() => setSelectedFileIndex(index())}
                                >
                                    <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                    <span class="truncate">{file.path}</span>
                                </button>
                            )}
                        </For>
                    </div>

                    {/* Editor area */}
                    <div class="flex-1 flex flex-col bg-[#0d1117] overflow-hidden">
                        <div class="px-4 py-2 bg-black/20 text-xs text-ide-text-muted flex justify-between items-center">
                            <span>{currentFile()?.path}</span>
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(currentFile()?.content || "");
                                    toast.success("Copied to clipboard!");
                                }}
                                class="hover:text-white transition-colors"
                            >
                                Copy Code
                            </button>
                        </div>
                        <pre class="flex-1 overflow-auto p-6 text-sm font-mono text-gray-300 leading-relaxed">
                            <code>{currentFile()?.content}</code>
                        </pre>
                    </div>
                </div>

                {/* Footer */}
                <div class="px-6 py-4 border-t border-ide-border bg-ide-panel text-right">
                    <button
                        onClick={props.onClose}
                        class="px-4 py-2 bg-ide-accent text-white rounded-lg hover:bg-ide-accent-hover transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CodePreviewModal;
