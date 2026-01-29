import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useGrapes } from '../../hooks/useGrapes';
import { Toolbar } from '../Toolbar';
import { Box, Paintbrush, Cog, Layers, EyeOff, CircuitBoard, Image, Package } from 'lucide-react';
import { StyleInspector } from '../StyleInspector';
import { LogicPanel } from '../LogicPanel';
import { PropertyEditor } from '../PropertyEditor';
import { AssetManager } from '../AssetManager';
import { AutoLayoutPanel } from '../AutoLayoutPanel';
import { SymbolPanel } from '../SymbolPanel';
import { RuntimeEngine } from '../../utils/runtime';
import { useLogic } from '../../context/LogicContext';

export const Editor = () => {
    const { editor, editorRef } = useGrapes();
    const { flows, variables, updateVariable } = useLogic();
    const runtimeRef = useRef<RuntimeEngine | null>(null);

    const [activeTab, setActiveTab] = useState<'styles' | 'traits' | 'layers' | 'logic' | 'symbols'>('styles');
    const [previewMode, setPreviewMode] = useState(false);
    const [isAssetManagerOpen, setIsAssetManagerOpen] = useState(false);

    // Handle Tab Switching
    const handleTabClick = (tab: 'styles' | 'traits' | 'layers' | 'logic' | 'symbols') => {
        setActiveTab(tab);
    };

    // Hot reload effect - update runtime when flows/variables change
    useEffect(() => {
        if (runtimeRef.current && runtimeRef.current.isActive()) {
            runtimeRef.current.hotReload(flows, variables);
        }
    }, [flows, variables]);

    // Handle Preview Mode Runtime
    useEffect(() => {
        if (!editor) return;

        const startRuntime = () => {
            console.log('Starting Runtime...');
            runtimeRef.current = new RuntimeEngine(editor, flows, variables, updateVariable);
            runtimeRef.current.start();
            setPreviewMode(true);
        };

        const stopRuntime = () => {
            console.log('Stopping Runtime...');
            if (runtimeRef.current) {
                runtimeRef.current.stop();
                runtimeRef.current = null;
            }
            setPreviewMode(false);
        };

        editor.on('run:preview', startRuntime);
        editor.on('stop:preview', stopRuntime);

        return () => {
            editor.off('run:preview', startRuntime);
            editor.off('stop:preview', stopRuntime);
            if (runtimeRef.current) runtimeRef.current.stop();
        };
    }, [editor, flows, variables, updateVariable]);

    // Listen for Preview Mode
    useEffect(() => {
        if (!editor) return;

        const togglePreview = (active: boolean) => {
            setPreviewMode(active);
        };

        const onCommandRun = (id: string) => {
            if (id === 'preview' || id === 'core:preview') togglePreview(true);
        };

        const onCommandStop = (id: string) => {
            if (id === 'preview' || id === 'core:preview') togglePreview(false);
        };

        if (editor.Commands.isActive('preview')) {
            togglePreview(true);
        }

        editor.on('run', onCommandRun);
        editor.on('stop', onCommandStop);
        editor.on('run:preview', () => togglePreview(true));
        editor.on('stop:preview', () => togglePreview(false));

        return () => {
            editor.off('run', onCommandRun);
            editor.off('stop', onCommandStop);
            editor.off('run:preview', () => togglePreview(true));
            editor.off('stop:preview', () => togglePreview(false));
        };
    }, [editor]);

    // Handle asset selection from Asset Manager
    const handleAssetSelect = useCallback((asset: { src: string }) => {
        if (!editor) return;
        const selected = editor.getSelected();
        if (selected && selected.is('image')) {
            selected.set('src', asset.src);
        }
    }, [editor]);

    return (
        <div className="h-screen w-full flex flex-col bg-[#0f0f23] text-slate-200 overflow-hidden relative">
            {/* Loading Overlay */}
            {!editor && (
                <div className="fixed inset-0 bg-[#0f0f23] z-[9999] flex flex-col items-center justify-center">
                    <div className="w-12 h-12 border-4 border-[#2a2a4a] border-t-indigo-500 rounded-full animate-spin"></div>
                    <p className="mt-4 text-slate-400 text-sm">Loading Editor...</p>
                </div>
            )}

            {!previewMode && <Toolbar editor={editor} onOpenAssetManager={() => setIsAssetManagerOpen(true)} />}

            <div className="flex-1 flex overflow-hidden">

                {/* Left Sidebar - Blocks */}
                {!previewMode && (
                    <aside className="w-[280px] bg-[#1a1a2e] border-r border-[#2a2a4a] flex flex-col transition-all duration-300">
                        <div className="p-4 text-[11px] font-semibold uppercase tracking-wider text-slate-400 border-b border-[#2a2a4a] bg-[#0a0a1a] flex items-center gap-2 sticky top-0 z-10">
                            <Box size={14} /> Components & Blocks
                        </div>
                        <div id="blocks-container" className="flex-1 overflow-y-auto p-3"></div>

                        {/* Asset Manager Button in Left Sidebar */}
                        <button
                            onClick={() => setIsAssetManagerOpen(true)}
                            className="m-3 p-3 flex items-center gap-2 text-sm text-slate-400 hover:text-white bg-[#0a0a1a] hover:bg-[#2a2a4a] border border-[#2a2a4a] rounded-lg transition-colors"
                        >
                            <Image size={16} />
                            <span>Asset Manager</span>
                        </button>
                    </aside>
                )}

                {/* Canvas */}
                <main
                    className={`flex-1 relative bg-[#0a0a1a] transition-all duration-300 ${previewMode ? 'z-[100]' : ''}`}
                    style={!previewMode ? { backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(99, 102, 241, 0.1) 1px, transparent 0)', backgroundSize: '20px 20px' } : {}}
                >
                    <div ref={editorRef} id="gjs" className="h-full border-none"></div>

                    {/* Exit Preview Button */}
                    {previewMode && (
                        <button
                            onClick={() => editor?.stopCommand('preview')}
                            className="absolute bottom-6 right-6 flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg hover:shadow-indigo-500/40 transition-all z-[9999] font-medium animate-in fade-in slide-in-from-bottom-4"
                        >
                            <EyeOff size={18} />
                            <span>Exit Preview</span>
                        </button>
                    )}
                </main>

                {/* Right Sidebar - Styles/Traits/Layers/Logic */}
                {!previewMode && (
                    <aside className="w-[300px] bg-[#1a1a2e] border-l border-[#2a2a4a] flex flex-col transition-all duration-300">
                        <div className="flex border-b border-[#2a2a4a] bg-[#0a0a1a]">
                            <TabBtn
                                active={activeTab === 'styles'}
                                icon={<Paintbrush size={14} />}
                                label="Styles"
                                onClick={() => handleTabClick('styles')}
                            />
                            <TabBtn
                                active={activeTab === 'traits'}
                                icon={<Cog size={14} />}
                                label="Settings"
                                onClick={() => handleTabClick('traits')}
                            />
                            <TabBtn
                                active={activeTab === 'layers'}
                                icon={<Layers size={14} />}
                                label="Layers"
                                onClick={() => handleTabClick('layers')}
                            />
                            <TabBtn
                                active={activeTab === 'logic'}
                                icon={<CircuitBoard size={14} />}
                                label="Logic"
                                onClick={() => handleTabClick('logic')}
                            />
                            <TabBtn
                                active={activeTab === 'symbols'}
                                icon={<Package size={14} />}
                                label="Symbols"
                                onClick={() => handleTabClick('symbols')}
                            />
                        </div>

                        <div className="flex-1 overflow-y-auto">
                            {/* Styles Tab */}
                            <div className={activeTab === 'styles' ? '' : 'hidden'}>
                                <div id="selectors-container" className="p-3"></div>
                                <AutoLayoutPanel editor={editor} />
                                <StyleInspector editor={editor} />
                            </div>

                            {/* Settings/Traits Tab - Using new PropertyEditor */}
                            <div className={activeTab === 'traits' ? 'h-full' : 'hidden'}>
                                <PropertyEditor editor={editor} />
                            </div>

                            {/* Layers Tab */}
                            <div id="layers-container" className={activeTab === 'layers' ? 'p-3' : 'hidden'}></div>

                            {/* Logic Tab */}
                            <div className={activeTab === 'logic' ? 'h-full' : 'hidden'}>
                                <LogicPanel editor={editor} />
                            </div>

                            {/* Symbols Tab */}
                            <div className={activeTab === 'symbols' ? 'h-full' : 'hidden'}>
                                <SymbolPanel editor={editor} />
                            </div>
                        </div>
                    </aside>
                )}
            </div>

            {/* Asset Manager Modal */}
            <AssetManager
                editor={editor}
                isOpen={isAssetManagerOpen}
                onClose={() => setIsAssetManagerOpen(false)}
                onSelect={handleAssetSelect}
            />
        </div>
    );
};

const TabBtn = ({ active, icon, label, onClick }: { active: boolean, icon: React.ReactNode, label: string, onClick: () => void }) => (
    <button
        onClick={onClick}
        className={`flex-1 py-3 text-xs font-medium flex items-center justify-center gap-2 border-b-2 transition-colors ${active
            ? 'text-indigo-500 border-indigo-500 bg-[#1a1a2e]'
            : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
    >
        {icon} {label}
    </button>
);
