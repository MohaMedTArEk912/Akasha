import React, { useState } from 'react';
import { Plug, Plus, Trash2, Settings, ExternalLink, Check, X } from 'lucide-react';

interface Integration {
    id: string;
    name: string;
    type: 'rest' | 'graphql' | 'webhook';
    baseUrl: string;
    headers: Record<string, string>;
    enabled: boolean;
}

interface IntegrationsPanelProps {
    integrations: Integration[];
    onUpdate: (integrations: Integration[]) => void;
}

const defaultIntegration: Omit<Integration, 'id'> = {
    name: 'New API',
    type: 'rest',
    baseUrl: '',
    headers: {},
    enabled: true,
};

const presetIntegrations = [
    { name: 'Stripe', icon: '💳', baseUrl: 'https://api.stripe.com/v1' },
    { name: 'Mailchimp', icon: '📧', baseUrl: 'https://us1.api.mailchimp.com/3.0' },
    { name: 'Airtable', icon: '📊', baseUrl: 'https://api.airtable.com/v0' },
    { name: 'Notion', icon: '📝', baseUrl: 'https://api.notion.com/v1' },
    { name: 'Supabase', icon: '⚡', baseUrl: '' },
    { name: 'Firebase', icon: '🔥', baseUrl: '' },
];

export const IntegrationsPanel: React.FC<IntegrationsPanelProps> = ({ integrations, onUpdate }) => {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newIntegration, setNewIntegration] = useState(defaultIntegration);
    const [newHeaderKey, setNewHeaderKey] = useState('');
    const [newHeaderValue, setNewHeaderValue] = useState('');

    const handleAddIntegration = () => {
        const integration: Integration = {
            ...newIntegration,
            id: `int_${Date.now()}`,
        };
        onUpdate([...integrations, integration]);
        setNewIntegration(defaultIntegration);
        setShowAddModal(false);
    };

    const handleToggleEnabled = (id: string) => {
        onUpdate(
            integrations.map((int) =>
                int.id === id ? { ...int, enabled: !int.enabled } : int
            )
        );
    };

    const handleDelete = (id: string) => {
        if (confirm('Delete this integration?')) {
            onUpdate(integrations.filter((int) => int.id !== id));
        }
    };

    const handleAddHeader = () => {
        if (newHeaderKey.trim()) {
            setNewIntegration({
                ...newIntegration,
                headers: { ...newIntegration.headers, [newHeaderKey]: newHeaderValue },
            });
            setNewHeaderKey('');
            setNewHeaderValue('');
        }
    };

    const handleRemoveHeader = (key: string) => {
        const { [key]: _, ...rest } = newIntegration.headers;
        setNewIntegration({ ...newIntegration, headers: rest });
    };

    const handlePresetClick = (preset: typeof presetIntegrations[0]) => {
        setNewIntegration({
            ...defaultIntegration,
            name: preset.name,
            baseUrl: preset.baseUrl,
        });
        setShowAddModal(true);
    };

    return (
        <div className="p-4 text-slate-200">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Plug size={20} />
                    API Integrations
                </h3>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="p-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 transition-colors"
                >
                    <Plus size={16} />
                </button>
            </div>

            {/* Quick Add Presets */}
            <div className="mb-4">
                <p className="text-xs text-slate-400 mb-2">Quick Add</p>
                <div className="grid grid-cols-3 gap-2">
                    {presetIntegrations.map((preset) => (
                        <button
                            key={preset.name}
                            onClick={() => handlePresetClick(preset)}
                            className="p-2 bg-gray-700 rounded text-center hover:bg-gray-600 transition-colors text-sm"
                        >
                            <span className="text-lg">{preset.icon}</span>
                            <p className="text-xs mt-1">{preset.name}</p>
                        </button>
                    ))}
                </div>
            </div>

            {/* Integration List */}
            {integrations.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                    <Plug size={48} className="mx-auto mb-2 opacity-50" />
                    <p>No integrations configured</p>
                    <p className="text-sm">Click + or use Quick Add above</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {integrations.map((integration) => (
                        <div
                            key={integration.id}
                            className="bg-gray-700 rounded-lg p-3 group"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleToggleEnabled(integration.id)}
                                        className={`w-8 h-4 rounded-full transition-colors ${integration.enabled ? 'bg-green-500' : 'bg-gray-500'
                                            }`}
                                    >
                                        <div
                                            className={`w-3 h-3 bg-white rounded-full transition-transform ${integration.enabled ? 'translate-x-4' : 'translate-x-0.5'
                                                }`}
                                        />
                                    </button>
                                    <span className="font-medium">{integration.name}</span>
                                    <span className="text-xs text-gray-400 uppercase">{integration.type}</span>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => setEditingId(integration.id)}
                                        className="p-1 text-gray-400 hover:text-white"
                                    >
                                        <Settings size={14} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(integration.id)}
                                        className="p-1 text-red-400 hover:text-red-300"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                            <p className="text-xs text-gray-400 mt-1 truncate">
                                {integration.baseUrl || 'No URL configured'}
                            </p>
                        </div>
                    ))}
                </div>
            )}

            {/* Add/Edit Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
                    <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md max-h-[80vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-lg font-semibold">Add Integration</h4>
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="text-gray-400 hover:text-white"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Name</label>
                                <input
                                    type="text"
                                    value={newIntegration.name}
                                    onChange={(e) => setNewIntegration({ ...newIntegration, name: e.target.value })}
                                    className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Type</label>
                                <select
                                    value={newIntegration.type}
                                    onChange={(e) => setNewIntegration({ ...newIntegration, type: e.target.value as any })}
                                    className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                >
                                    <option value="rest">REST API</option>
                                    <option value="graphql">GraphQL</option>
                                    <option value="webhook">Webhook</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Base URL</label>
                                <input
                                    type="text"
                                    value={newIntegration.baseUrl}
                                    onChange={(e) => setNewIntegration({ ...newIntegration, baseUrl: e.target.value })}
                                    placeholder="https://api.example.com/v1"
                                    className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>

                            {/* Headers */}
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Headers</label>
                                <div className="space-y-2">
                                    {Object.entries(newIntegration.headers).map(([key, value]) => (
                                        <div key={key} className="flex items-center gap-2 bg-gray-700 p-2 rounded text-sm">
                                            <span className="font-mono text-indigo-400">{key}:</span>
                                            <span className="flex-1 truncate">{value}</span>
                                            <button
                                                onClick={() => handleRemoveHeader(key)}
                                                className="text-red-400 hover:text-red-300"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))}
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={newHeaderKey}
                                            onChange={(e) => setNewHeaderKey(e.target.value)}
                                            placeholder="Header name"
                                            className="flex-1 bg-gray-700 border border-gray-600 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                        />
                                        <input
                                            type="text"
                                            value={newHeaderValue}
                                            onChange={(e) => setNewHeaderValue(e.target.value)}
                                            placeholder="Value"
                                            className="flex-1 bg-gray-700 border border-gray-600 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                        />
                                        <button
                                            onClick={handleAddHeader}
                                            className="px-3 bg-gray-600 rounded hover:bg-gray-500"
                                        >
                                            <Plus size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 mt-6">
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="px-4 py-2 text-gray-400 hover:text-white"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddIntegration}
                                className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600"
                            >
                                Add Integration
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export const defaultIntegrations: Integration[] = [];
