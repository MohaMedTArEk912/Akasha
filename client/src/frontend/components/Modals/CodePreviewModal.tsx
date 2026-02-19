import React, { useState } from "react";
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

const CodePreviewModal: React.FC<CodePreviewModalProps> = ({ title, files, onClose }) => {
    const [selectedFileIndex, setSelectedFileIndex] = useState(0);
    const currentFile = files[selectedFileIndex];
    const { success } = useToast();

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--ide-border)] bg-[var(--ide-bg-panel)]">
                    <h3 className="text-lg font-bold text-[var(--ide-text)]">{title}</h3>
                    <button onClick={onClose} className="text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Sidebar: File List */}
                    <div className="w-64 border-r border-[var(--ide-border)] overflow-y-auto bg-[var(--ide-bg-panel)]">
                        <div className="px-4 py-3 text-xs font-bold text-[var(--ide-text-muted)] uppercase tracking-wider">
                            Files
                        </div>
                        {files.map((file, index) => (
                            <button
                                key={file.path + index}
                                className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 transition-colors ${selectedFileIndex === index
                                    ? "bg-[var(--ide-primary)] text-white"
                                    : "text-[var(--ide-text-muted)] hover:bg-[var(--ide-bg-elevated)] hover:text-[var(--ide-text)]"
                                    }`}
                                onClick={() => setSelectedFileIndex(index)}
                            >
                                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                                <span className="truncate">{file.path}</span>
                            </button>
                        ))}
                    </div>

                    {/* Editor area */}
                    <div className="flex-1 flex flex-col bg-[var(--ide-bg-elevated)] overflow-hidden">
                        <div className="px-4 py-2 bg-[var(--ide-bg-panel)] text-xs text-[var(--ide-text-muted)] flex justify-between items-center">
                            <span>{currentFile?.path}</span>
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(currentFile?.content || "");
                                    success("Copied to clipboard!");
                                }}
                                className="hover:text-[var(--ide-text)] transition-colors"
                            >
                                Copy Code
                            </button>
                        </div>
                        <pre className="flex-1 overflow-auto p-6 text-sm font-mono text-[var(--ide-text-secondary)] leading-relaxed">
                            <code>{currentFile?.content}</code>
                        </pre>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-[var(--ide-border)] bg-[var(--ide-bg-panel)] text-right">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-[var(--ide-primary)] text-white rounded-lg hover:bg-[var(--ide-primary-hover)] transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CodePreviewModal;
