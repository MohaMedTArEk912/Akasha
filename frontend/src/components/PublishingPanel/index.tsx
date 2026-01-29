import React, { useCallback, useEffect, useState } from 'react';
import { Cloud, Link as LinkIcon, Save, X, UploadCloud, CalendarClock } from 'lucide-react';
import { GrapesEditor } from '../../types/grapes';
import { useProject } from '../../context/ProjectContext';

interface PublishingPanelProps {
    editor: GrapesEditor | null;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const PublishingPanel: React.FC<PublishingPanelProps> = ({ editor }) => {
    const { currentProject } = useProject();
    const [customDomain, setCustomDomain] = useState('');
    const [message, setMessage] = useState<string | null>(null);
    const [deployUrl, setDeployUrl] = useState<string | null>(null);
    const [deploying, setDeploying] = useState(false);
    const [netlifyDeploying, setNetlifyDeploying] = useState(false);
    const [scheduleAt, setScheduleAt] = useState('');
    const [schedules, setSchedules] = useState<Array<{ _id: string; scheduledAt: string; status: string; resultUrl?: string; errorMessage?: string }>>([]);

    useEffect(() => {
        setCustomDomain(localStorage.getItem('publish_custom_domain') || '');
    }, []);

    const handleSave = () => {
        localStorage.setItem('publish_custom_domain', customDomain);
        setMessage('Publishing settings saved.');
    };

    const getAuthHeaders = (): HeadersInit => {
        const userStr = localStorage.getItem('grapes_user');
        const user = userStr ? JSON.parse(userStr) : null;
        const token = user?.token;

        return {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };
    };

    const loadSchedules = useCallback(async () => {
        if (!currentProject?._id) return;
        const response = await fetch(`${API_URL}/publish/schedules/${currentProject._id}`, {
            headers: getAuthHeaders(),
        });
        if (response.ok) {
            const data = await response.json();
            setSchedules(data || []);
        }
    }, [currentProject?._id]);

    useEffect(() => {
        loadSchedules();
    }, [loadSchedules]);

    const handleDeploy = async () => {
        if (!editor || !currentProject?._id) return;
        try {
            setDeploying(true);
            const html = editor.getHtml() || '';
            const css = editor.getCss() || '';
            const response = await fetch(`${API_URL}/publish/vercel`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    name: currentProject.name?.toLowerCase().replace(/\s+/g, '-') || 'grapes-site',
                    html,
                    css,
                }),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data?.message || 'Deploy failed');
            }
            setDeployUrl(`https://${data.url}`);
            setMessage('Deployment created successfully.');
            await loadSchedules();
        } catch (err: any) {
            setMessage(err.message || 'Deploy failed');
        } finally {
            setDeploying(false);
        }
    };

    const handleDeployNetlify = async () => {
        if (!editor || !currentProject?._id) return;
        try {
            setNetlifyDeploying(true);
            const html = editor.getHtml() || '';
            const css = editor.getCss() || '';
            const response = await fetch(`${API_URL}/publish/netlify`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    name: currentProject.name?.toLowerCase().replace(/\s+/g, '-') || 'grapes-site',
                    html,
                    css,
                }),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data?.message || 'Netlify deploy failed');
            }
            setDeployUrl(data.url || data.siteUrl || null);
            setMessage('Netlify deployment created successfully.');
            await loadSchedules();
        } catch (err: any) {
            setMessage(err.message || 'Netlify deploy failed');
        } finally {
            setNetlifyDeploying(false);
        }
    };

    const handleSchedule = async () => {
        if (!editor || !currentProject?._id || !scheduleAt) return;
        try {
            const html = editor.getHtml() || '';
            const css = editor.getCss() || '';
            const response = await fetch(`${API_URL}/publish/vercel/schedule`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    projectId: currentProject._id,
                    name: currentProject.name?.toLowerCase().replace(/\s+/g, '-') || 'grapes-site',
                    html,
                    css,
                    scheduledAt: scheduleAt,
                }),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data?.message || 'Schedule failed');
            }
            setMessage('Vercel deployment scheduled.');
            setScheduleAt('');
            await loadSchedules();
        } catch (err: any) {
            setMessage(err.message || 'Schedule failed');
        }
    };

    return (
        <div className="p-4 text-slate-200">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Cloud size={18} />
                    Publishing
                </h3>
                <button
                    onClick={handleSave}
                    className="p-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 transition-colors"
                    aria-label="Save publishing settings"
                >
                    <Save size={16} />
                </button>
            </div>

            {message && (
                <div className="mb-3 p-2 bg-green-500/20 text-green-300 rounded text-sm flex items-center justify-between">
                    <span>{message}</span>
                    <button onClick={() => setMessage(null)} className="text-green-300">
                        <X size={14} />
                    </button>
                </div>
            )}

            <div className="space-y-3">
                <div className="text-xs text-slate-400">
                    Vercel deployments use server-side token from VERCEL_TOKEN.
                </div>
                <div>
                    <label className="block text-xs text-slate-400 mb-1">Custom domain</label>
                    <div className="flex items-center gap-2">
                        <LinkIcon size={14} className="text-slate-500" />
                        <input
                            value={customDomain}
                            onChange={(e) => setCustomDomain(e.target.value)}
                            className="w-full bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1 text-sm text-white"
                            placeholder="example.com"
                        />
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={handleDeploy}
                        disabled={!editor || deploying}
                        className="flex items-center gap-2 px-3 py-2 text-xs bg-indigo-500 text-white rounded hover:bg-indigo-600 disabled:opacity-50"
                    >
                        <UploadCloud size={14} />
                        {deploying ? 'Deploying...' : 'Deploy to Vercel'}
                    </button>
                    <button
                        onClick={handleDeployNetlify}
                        disabled={!editor || netlifyDeploying}
                        className="flex items-center gap-2 px-3 py-2 text-xs bg-emerald-500 text-white rounded hover:bg-emerald-600 disabled:opacity-50"
                    >
                        <UploadCloud size={14} />
                        {netlifyDeploying ? 'Deploying...' : 'Deploy to Netlify'}
                    </button>
                    {deployUrl && (
                        <a
                            href={deployUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-indigo-300 hover:text-indigo-200"
                        >
                            {deployUrl}
                        </a>
                    )}
                </div>
                <div className="mt-4 border-t border-[#2a2a4a] pt-3">
                    <div className="text-xs text-slate-400 mb-2 flex items-center gap-2">
                        <CalendarClock size={14} />
                        Schedule Vercel deploy
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="datetime-local"
                            value={scheduleAt}
                            onChange={(e) => setScheduleAt(e.target.value)}
                            className="bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1 text-xs text-white"
                        />
                        <button
                            onClick={handleSchedule}
                            disabled={!scheduleAt || !editor}
                            className="px-3 py-1 text-xs bg-indigo-500 text-white rounded hover:bg-indigo-600 disabled:opacity-50"
                        >
                            Schedule
                        </button>
                    </div>
                </div>
                <div className="mt-4">
                    <div className="text-xs text-slate-400 mb-2">Scheduled deployments</div>
                    <div className="space-y-2 max-h-40 overflow-auto">
                        {schedules.length === 0 && (
                            <div className="text-xs text-slate-500">No schedules yet.</div>
                        )}
                        {schedules.map((schedule) => (
                            <div key={schedule._id} className="text-xs text-slate-300 flex items-center justify-between bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1">
                                <span>{new Date(schedule.scheduledAt).toLocaleString()}</span>
                                <span className="text-slate-400">{schedule.status}</span>
                                {schedule.resultUrl && (
                                    <a className="text-indigo-300" href={schedule.resultUrl} target="_blank" rel="noreferrer">Link</a>
                                )}
                                {schedule.errorMessage && (
                                    <span className="text-red-300">{schedule.errorMessage}</span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
