import React from 'react';
import { GrapesEditor } from '../../types/grapes';
import {
    Undo, Redo, Trash2, Code, Eye,
    Download, Monitor, Tablet, Smartphone,
    Save, FolderOpen, LogOut, User, FilePlus
} from 'lucide-react';
import {
    exportProjectSchema,
} from '../../utils/schema';
import { generateProjectKey } from '../../utils/generator';
import { buildReactPage } from '../../utils/generator/react-builder';
import { saveAs } from 'file-saver';
import { useLogic } from '../../context/LogicContext';
import { useAuth } from '../../context/AuthContext';
import { useProject } from '../../context/ProjectContext';
import { ProjectService, ProjectData } from '../../services/projectService';
import { ProjectListModal } from '../ProjectManager/ProjectListModal';
import { CodePreviewModal } from '../CodePreviewModal';

interface ToolbarProps {
    editor: GrapesEditor | null;
    onOpenAssetManager?: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ editor, onOpenAssetManager: _onOpenAssetManager }) => {
    const { variables, flows } = useLogic();
    const { user, logout } = useAuth();
    const { currentProject, setCurrentProject } = useProject();
    const [activeDevice, setActiveDevice] = React.useState('Desktop');
    const [isLoadModalOpen, setIsLoadModalOpen] = React.useState(false);

    // Code Preview Modal State
    const [isCodeModalOpen, setIsCodeModalOpen] = React.useState(false);
    const [previewCode, setPreviewCode] = React.useState({ react: '', html: '', css: '' });

    if (!editor) return null;

    const handleDeviceChange = (device: string) => {
        setActiveDevice(device);
        editor.setDevice(device);
    };

    const handleViewCode = () => {
        // Generate HTML/CSS
        const html = editor.getHtml() || '';
        const css = editor.getCss() || '';

        // Generate React Code
        const components = editor.getComponents().map((c: any) => c.toJSON());
        const react = buildReactPage((currentProject?.name as string || 'MyPage').replace(/\s+/g, ''), components, flows);

        setPreviewCode({ react, html, css });
        setIsCodeModalOpen(true);
    };

    const handleSaveBackend = async () => {
        const name = currentProject?.name || prompt('Enter project name:', 'My Project');
        if (!name) return;

        const components = editor.getComponents().map((c: any) => c.toJSON());
        const style = editor.getStyle();
        // @ts-ignore
        const assets = editor.AssetManager.getAll().map((a: any) => ({ src: a.get('src'), type: a.get('type') }));

        const projectData: ProjectData = {
            name,
            content: components,
            styles: JSON.stringify(style),
            assets: assets
        };

        try {
            let saved;
            if (currentProject?._id) {
                saved = await ProjectService.updateProject(currentProject._id, projectData);
            } else {
                saved = await ProjectService.saveProject(projectData);
            }
            setCurrentProject(saved);
            alert('Project saved to backend!');
        } catch (error) {
            console.error(error);
            alert('Failed to save project to backend.');
        }
    };

    const handleLoadBackend = (project: ProjectData) => {
        try {
            editor.DomComponents.clear();
            editor.CssComposer.clear();
            editor.setComponents(project.content);
            if (project.styles) {
                try {
                    const parsed = JSON.parse(project.styles);
                    editor.setStyle(parsed);
                } catch {
                    editor.setStyle(project.styles);
                }
            }
            if (project.assets) {
                editor.AssetManager.add(project.assets);
            }
            setCurrentProject(project);
            setIsLoadModalOpen(false);
            alert(`Project "${project.name}" loaded!`);
        } catch (error) {
            console.error(error);
            alert('Failed to load project into editor.');
        }
    };

    const handleExportReact = async () => {
        if (!editor) return;
        const schema = exportProjectSchema(editor, currentProject?.name || 'My Project', variables, flows);
        try {
            const blob = await generateProjectKey(schema);
            saveAs(blob, `${schema.name}-react.zip`);
        } catch (error) {
            console.error('Failed to generate code:', error);
            alert('Failed to generate code. Check console for details.');
        }
    };

    return (
        <header className="flex items-center justify-between h-[50px] px-4 bg-gradient-to-r from-[#0a0a1a] to-[#1a1a2e] border-b border-[#2a2a4a] relative z-50">
            {/* Left: Logo & Device Switcher */}
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 font-semibold text-lg text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-pink-500">
                    <svg viewBox="0 0 100 100" className="w-7 h-7">
                        <path d="M40 5l-12.9 7.4 -12.9 7.4c-1.4 0.8-2.7 2.3-3.7 3.9 -0.9 1.6-1.5 3.5-1.5 5.1v14.9 14.9c0 1.7 0.6 3.5 1.5 5.1 0.9 1.6 2.2 3.1 3.7 3.9l12.9 7.4 12.9 7.4c1.4 0.8 3.3 1.2 5.2 1.2 1.9 0 3.8-0.4 5.2-1.2l12.9-7.4 12.9-7.4c1.4-0.8 2.7-2.2 3.7-3.9 0.9-1.6 1.5-3.5 1.5-5.1v-14.9 -12.7c0-4.6-3.8-6-6.8-4.2l-28 16.2" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" className="stroke-indigo-500" />
                    </svg>
                    <span>GrapesJS React</span>
                </div>

                <div className="flex gap-1 bg-[#0a0a1a] p-1 rounded-lg border border-[#2a2a4a]">
                    <DeviceBtn
                        icon={<Monitor size={18} />}
                        active={activeDevice === 'Desktop'}
                        onClick={() => handleDeviceChange('Desktop')}
                    />
                    <DeviceBtn
                        icon={<Tablet size={18} />}
                        active={activeDevice === 'Tablet'}
                        onClick={() => handleDeviceChange('Tablet')}
                    />
                    <DeviceBtn
                        icon={<Smartphone size={18} />}
                        active={activeDevice === 'Mobile portrait'}
                        onClick={() => handleDeviceChange('Mobile portrait')}
                    />
                </div>
            </div>

            {/* Right: Actions & User Session */}
            <div className="flex items-center gap-3">
                <div className="flex gap-1">
                    <ActionBtn icon={<Undo size={16} />} onClick={() => editor.UndoManager.undo()} title="Undo" />
                    <ActionBtn icon={<Redo size={16} />} onClick={() => editor.UndoManager.redo()} title="Redo" />
                    <ActionBtn
                        icon={<Trash2 size={16} />}
                        onClick={() => {
                            const selected = editor.getSelected();
                            if (selected) {
                                editor.runCommand('core:component-delete');
                            } else {
                                if (confirm('Clear entire canvas?')) {
                                    editor.DomComponents.clear();
                                    editor.CssComposer.clear();
                                }
                            }
                        }}
                        title="Delete Selected"
                    />
                    <ActionBtn icon={<Code size={16} />} onClick={handleViewCode} title="View Source Code" />
                    <ActionBtn
                        icon={<Eye size={16} />}
                        onClick={() => {
                            editor.runCommand('core:preview');
                        }}
                        title="Preview"
                    />
                </div>

                <div className="w-px h-6 bg-[#2a2a4a]" />

                <div className="flex gap-1">
                    <ActionBtn
                        icon={<FilePlus size={16} />}
                        onClick={() => {
                            if (confirm('Start a new project? This will clear the current canvas.')) {
                                editor.DomComponents.clear();
                                editor.CssComposer.clear();
                                // Clear localStorage
                                Object.keys(localStorage).forEach(key => {
                                    if (key.startsWith('gjs-ultimate-')) {
                                        localStorage.removeItem(key);
                                    }
                                });
                                setCurrentProject(null);
                            }
                        }}
                        title="New Project"
                    />
                    <ActionBtn icon={<Save size={16} />} onClick={handleSaveBackend} title="Save Project" />
                    <ActionBtn icon={<FolderOpen size={16} />} onClick={() => setIsLoadModalOpen(true)} title="Load Project" />
                </div>

                <button
                    onClick={handleExportReact}
                    className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm font-medium transition-colors"
                >
                    <Download size={16} />
                    <span>Export</span>
                </button>

                <div className="w-px h-6 bg-[#2a2a4a]" />

                {/* User Session Info */}
                <div className="flex items-center gap-3 pl-2">
                    <div className="flex items-center gap-2 text-sm text-slate-300">
                        <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 border border-indigo-500/30">
                            <User size={16} />
                        </div>
                        <span className="hidden lg:inline">{user?.username || 'User'}</span>
                    </div>
                    <button
                        onClick={logout}
                        className="text-slate-400 hover:text-red-400 transition-colors p-1.5 hover:bg-red-500/10 rounded"
                        title="Logout"
                    >
                        <LogOut size={16} />
                    </button>
                </div>
            </div>

            {/* Modals */}
            <ProjectListModal
                isOpen={isLoadModalOpen}
                onClose={() => setIsLoadModalOpen(false)}
                onLoadProject={handleLoadBackend}
            />

            <CodePreviewModal
                isOpen={isCodeModalOpen}
                onClose={() => setIsCodeModalOpen(false)}
                reactCode={previewCode.react}
                htmlCode={previewCode.html}
                cssCode={previewCode.css}
            />
        </header>
    );
};

// Sub-components
const DeviceBtn = ({ icon, active, onClick }: { icon: React.ReactNode, active: boolean, onClick: () => void }) => (
    <button
        onClick={onClick}
        className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${active ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white hover:bg-white/10'
            }`}
    >
        {icon}
    </button>
);

const ActionBtn = ({ icon, onClick, title }: { icon: React.ReactNode, onClick: () => void, title?: string }) => (
    <button
        onClick={onClick}
        title={title}
        className="w-8 h-8 flex items-center justify-center text-slate-200 border border-transparent hover:border-[#2a2a4a] rounded hover:bg-[#1a1a2e] transition-colors"
    >
        {icon}
    </button>
);
