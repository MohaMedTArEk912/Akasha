import React, { useState } from 'react';
import { X, Copy, Check, FileCode, FileJson, Palette } from 'lucide-react';

interface CodePreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    reactCode: string;
    htmlCode: string;
    cssCode: string;
}

export const CodePreviewModal: React.FC<CodePreviewModalProps> = ({
    isOpen,
    onClose,
    reactCode,
    htmlCode,
    cssCode
}) => {
    const [activeTab, setActiveTab] = useState<'react' | 'html' | 'css'>('react');
    const [copied, setCopied] = useState(false);

    if (!isOpen) return null;

    const getActiveCode = () => {
        switch (activeTab) {
            case 'react': return reactCode;
            case 'html': return htmlCode;
            case 'css': return cssCode;
            default: return '';
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(getActiveCode());
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div
                className="bg-[#1a1a2e] border border-[#2a2a4a] rounded-xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a4a] bg-[#0a0a1a]">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <FileCode className="text-indigo-500" size={24} />
                        Code Preview
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white transition-colors p-1 hover:bg-white/10 rounded"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Tabs & Actions */}
                <div className="flex items-center justify-between px-6 py-2 border-b border-[#2a2a4a] bg-[#1a1a2e]">
                    <div className="flex bg-[#0a0a1a] rounded-lg p-1 border border-[#2a2a4a]">
                        <TabButton
                            active={activeTab === 'react'}
                            onClick={() => setActiveTab('react')}
                            label="React JSX"
                            icon={<FileCode size={16} />}
                        />
                        <TabButton
                            active={activeTab === 'html'}
                            onClick={() => setActiveTab('html')}
                            label="HTML"
                            icon={<FileJson size={16} />}
                        />
                        <TabButton
                            active={activeTab === 'css'}
                            onClick={() => setActiveTab('css')}
                            label="CSS"
                            icon={<Palette size={16} />}
                        />
                    </div>

                    <button
                        onClick={handleCopy}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${copied
                                ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                                : 'bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg hover:shadow-indigo-500/25'
                            }`}
                    >
                        {copied ? <Check size={16} /> : <Copy size={16} />}
                        <span>{copied ? 'Copied!' : 'Copy Code'}</span>
                    </button>
                </div>

                {/* Code Area */}
                <div className="flex-1 overflow-auto bg-[#0d0d15] p-6 custom-scrollbar relative">
                    <pre className="text-sm font-mono leading-relaxed text-slate-300">
                        <code>{getActiveCode()}</code>
                    </pre>
                </div>
            </div>
        </div>
    );
};

const TabButton = ({ active, onClick, label, icon }: { active: boolean, onClick: () => void, label: string, icon: React.ReactNode }) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${active
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
    >
        {icon}
        {label}
    </button>
);
