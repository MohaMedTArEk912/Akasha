import React, { useCallback, useEffect, useState } from 'react';
import { Clock, RotateCcw, Plus, X } from 'lucide-react';
import { createVersion, getVersions, restoreVersion, VFSVersion } from '../../services/vfsService';
import { useProject } from '../../context/ProjectContext';

const getErrorMessage = (err: unknown, fallback: string) => {
    if (err instanceof Error) return err.message;
    return fallback;
};

export const VersionHistoryPanel: React.FC = () => {
    const { currentProject } = useProject();
    const projectId = currentProject?._id || '';

    const [versions, setVersions] = useState<VFSVersion[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [label, setLabel] = useState('');

    const loadVersions = useCallback(async () => {
        if (!projectId) return;
        try {
            setLoading(true);
            const result = await getVersions(projectId);
            setVersions(result.versions || []);
            setError(null);
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to load versions'));
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        loadVersions();
    }, [loadVersions]);

    const handleCreate = async () => {
        if (!projectId) return;
        try {
            await createVersion(projectId, label || undefined);
            setLabel('');
            await loadVersions();
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to create version'));
        }
    };

    const handleRestore = async (versionId: string) => {
        if (!confirm('Restore this version? This will overwrite current files.')) return;
        try {
            await restoreVersion(versionId);
            await loadVersions();
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to restore version'));
        }
    };

    if (!projectId) {
        return <div className="p-4 text-slate-400 text-sm">Select a project to view versions.</div>;
    }

    return (
        <div className="p-4 text-slate-200">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Clock size={18} />
                    Versions
                </h3>
                <button
                    onClick={handleCreate}
                    className="p-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 transition-colors"
                    aria-label="Create version"
                >
                    <Plus size={16} />
                </button>
            </div>

            <div className="mb-3">
                <label className="block text-xs text-slate-400 mb-1">Version label (optional)</label>
                <input
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    className="w-full bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1 text-sm text-white"
                    placeholder="Release v1"
                />
            </div>

            {error && (
                <div className="mb-3 p-2 bg-red-500/20 text-red-300 rounded text-sm flex items-center justify-between">
                    <span>{error}</span>
                    <button onClick={() => setError(null)} className="text-red-300">
                        <X size={14} />
                    </button>
                </div>
            )}

            {loading && versions.length === 0 && (
                <div className="text-slate-400 text-sm">Loading versions...</div>
            )}

            {!loading && versions.length === 0 && (
                <div className="text-slate-400 text-sm">No versions yet.</div>
            )}

            <div className="space-y-2 max-h-[50vh] overflow-auto">
                {versions.map((version) => (
                    <div
                        key={version._id}
                        className="flex items-center justify-between p-3 rounded-lg bg-[#141428] border border-[#2a2a4a]"
                    >
                        <div className="min-w-0">
                            <div className="font-medium truncate">{version.label || 'Untitled Version'}</div>
                            <div className="text-xs text-slate-400">
                                {new Date(version.createdAt).toLocaleString()} · {version.trigger}
                            </div>
                        </div>
                        <button
                            onClick={() => handleRestore(version._id)}
                            className="text-indigo-400 hover:text-indigo-300 p-1"
                            title="Restore"
                        >
                            <RotateCcw size={16} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};
