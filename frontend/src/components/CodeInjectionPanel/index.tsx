import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Code, FileCode, Plus, Save, X } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import {
    VFSFile,
    createFile,
    getProjectFiles,
    updateFile,
} from '../../services/vfsService';

const getErrorMessage = (err: unknown, fallback: string) => {
    if (err instanceof Error) return err.message;
    return fallback;
};

type CodeFileType = 'css' | 'js' | 'inject';

export const CodeInjectionPanel: React.FC = () => {
    const { currentProject } = useProject();
    const projectId = currentProject?._id || '';

    const [files, setFiles] = useState<VFSFile[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedFileId, setSelectedFileId] = useState<string>('');
    const [content, setContent] = useState('');
    const [scope, setScope] = useState<'global' | 'page'>('global');
    const [newFileType, setNewFileType] = useState<CodeFileType>('css');
    const [newFileName, setNewFileName] = useState('');

    const codeFiles = useMemo(
        () => files.filter((file) => ['css', 'js', 'inject'].includes(file.type)),
        [files]
    );

    const loadFiles = useCallback(async () => {
        if (!projectId) return;
        try {
            setLoading(true);
            const result = await getProjectFiles(projectId, false);
            setFiles(result.files || []);
            setError(null);
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to load code files'));
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        loadFiles();
    }, [loadFiles]);

    useEffect(() => {
        const selected = codeFiles.find((file) => file._id === selectedFileId);
        if (selected?.schema && typeof selected.schema === 'object') {
            const schema = selected.schema as { content?: string; scope?: 'global' | 'page' };
            setContent(schema.content || '');
            setScope(schema.scope || 'global');
        } else {
            setContent('');
            setScope('global');
        }
    }, [selectedFileId, codeFiles]);

    const handleSave = async () => {
        if (!selectedFileId) return;
        try {
            await updateFile(selectedFileId, { schema: { content, scope } });
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to save code'));
        }
    };

    const handleCreate = async () => {
        if (!projectId || !newFileName.trim()) return;
        try {
            const result = await createFile(projectId, newFileName.trim(), newFileType, {
                content: '',
                scope: 'global',
            });
            setFiles((prev) => [result.file, ...prev]);
            setSelectedFileId(result.file._id);
            setNewFileName('');
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to create file'));
        }
    };

    if (!projectId) {
        return <div className="p-4 text-slate-400 text-sm">Select a project to manage code injection.</div>;
    }

    return (
        <div className="p-4 text-slate-200">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Code size={18} />
                    Code Injection
                </h3>
                <button
                    onClick={handleSave}
                    className="p-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 transition-colors"
                    aria-label="Save code"
                >
                    <Save size={16} />
                </button>
            </div>

            {error && (
                <div className="mb-3 p-2 bg-red-500/20 text-red-300 rounded text-sm flex items-center justify-between">
                    <span>{error}</span>
                    <button onClick={() => setError(null)} className="text-red-300">
                        <X size={14} />
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 gap-3 mb-4">
                <label className="text-xs text-slate-400">Select file</label>
                <select
                    value={selectedFileId}
                    onChange={(e) => setSelectedFileId(e.target.value)}
                    className="bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1 text-sm text-white"
                >
                    <option value="">Choose file</option>
                    {codeFiles.map((file) => (
                        <option key={file._id} value={file._id}>
                            {file.name} · {file.type}
                        </option>
                    ))}
                </select>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                    <label className="text-xs text-slate-400">Scope</label>
                    <select
                        value={scope}
                        onChange={(e) => setScope(e.target.value as 'global' | 'page')}
                        className="w-full bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1 text-sm text-white"
                    >
                        <option value="global">Global</option>
                        <option value="page">Per-page</option>
                    </select>
                </div>
                <div>
                    <label className="text-xs text-slate-400">Content</label>
                    <div className="text-[11px] text-slate-500">Stored in VFS schema</div>
                </div>
            </div>

            <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-2 text-xs text-white h-40"
                placeholder="Add CSS, JS, or head injection here"
            />

            <div className="border-t border-[#2a2a4a] mt-4 pt-3">
                <div className="text-xs text-slate-400 mb-2">Create new file</div>
                <div className="grid grid-cols-3 gap-2">
                    <input
                        value={newFileName}
                        onChange={(e) => setNewFileName(e.target.value)}
                        className="col-span-2 bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1 text-sm text-white"
                        placeholder="File name"
                    />
                    <select
                        value={newFileType}
                        onChange={(e) => setNewFileType(e.target.value as CodeFileType)}
                        className="bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1 text-sm text-white"
                    >
                        <option value="css">CSS</option>
                        <option value="js">JS</option>
                        <option value="inject">Head</option>
                    </select>
                </div>
                <div className="flex justify-end mt-2">
                    <button
                        onClick={handleCreate}
                        className="px-3 py-1 text-xs bg-indigo-500 text-white rounded hover:bg-indigo-600"
                    >
                        <Plus size={14} />
                        <span className="ml-1">Create</span>
                    </button>
                </div>
            </div>

            {loading && (
                <div className="text-xs text-slate-400 mt-2">Loading files...</div>
            )}
        </div>
    );
};
