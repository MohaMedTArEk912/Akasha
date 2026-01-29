import React, { useEffect, useState } from 'react';
import { SymbolService, SymbolData } from '../../services/symbolService';
import { Package, Plus, Trash2, Edit2, X } from 'lucide-react';

interface SymbolPanelProps {
    editor: any;
}

export const SymbolPanel: React.FC<SymbolPanelProps> = ({ editor }) => {
    const [symbols, setSymbols] = useState<SymbolData[]>([]);
    const [loading, setLoading] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newSymbolName, setNewSymbolName] = useState('');

    useEffect(() => {
        loadSymbols();
    }, []);

    const loadSymbols = async () => {
        setLoading(true);
        try {
            const data = await SymbolService.getAllSymbols();
            setSymbols(data);
        } catch (err) {
            console.error('Failed to load symbols:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateSymbol = async () => {
        if (!editor || !newSymbolName.trim()) return;

        const selected = editor.getSelected();
        if (!selected) {
            alert('Please select a component to save as a symbol');
            return;
        }

        try {
            const content = selected.toJSON();
            // Get styles for the selected component
            const css = editor.getCss({ component: selected });

            const symbolData: SymbolData = {
                name: newSymbolName,
                content,
                styles: css || '',
            };

            await SymbolService.saveSymbol(symbolData);
            setNewSymbolName('');
            setShowCreateModal(false);
            loadSymbols();
            alert('Symbol created successfully!');
        } catch (err) {
            alert('Failed to create symbol');
        }
    };

    const handleInsertSymbol = (symbol: SymbolData) => {
        if (!editor) return;

        // Add the symbol content to the canvas
        const wrapper = editor.getWrapper();
        const newComponent = wrapper.append(symbol.content)[0];

        // Add the symbol styles if not already present
        if (symbol.styles) {
            const existingCss = editor.getCss();
            if (!existingCss.includes(symbol.styles)) {
                editor.setStyle(existingCss + '\n' + symbol.styles);
            }
        }

        // Select the new component
        editor.select(newComponent);
    };

    const handleDeleteSymbol = async (id: string) => {
        if (!confirm('Delete this symbol?')) return;
        try {
            await SymbolService.deleteSymbol(id);
            loadSymbols();
        } catch (err) {
            alert('Failed to delete symbol');
        }
    };

    return (
        <div className="p-4">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Package size={20} />
                    Symbols
                </h3>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="p-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 transition-colors"
                    title="Create Symbol from Selection"
                >
                    <Plus size={16} />
                </button>
            </div>

            {loading ? (
                <div className="text-center py-4 text-gray-400">Loading...</div>
            ) : symbols.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                    <Package size={48} className="mx-auto mb-2 opacity-50" />
                    <p>No symbols yet</p>
                    <p className="text-sm">Select a component and click + to create</p>
                </div>
            ) : (
                <div className="grid gap-2">
                    {symbols.map((symbol) => (
                        <div
                            key={symbol._id}
                            className="group bg-gray-700 rounded-lg p-3 cursor-pointer hover:bg-gray-600 transition-colors"
                            onClick={() => handleInsertSymbol(symbol)}
                        >
                            <div className="flex items-center justify-between">
                                <span className="font-medium">{symbol.name}</span>
                                <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteSymbol(symbol._id!);
                                        }}
                                        className="p-1 text-red-400 hover:text-red-300"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                            {symbol.description && (
                                <p className="text-xs text-gray-400 mt-1">{symbol.description}</p>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Create Symbol Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
                    <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-lg font-semibold">Create Symbol</h4>
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="text-gray-400 hover:text-white"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <input
                            type="text"
                            value={newSymbolName}
                            onChange={(e) => setNewSymbolName(e.target.value)}
                            placeholder="Symbol name"
                            className="w-full bg-gray-700 border border-gray-600 rounded p-2 mb-4 focus:ring-2 focus:ring-indigo-500 outline-none"
                            autoFocus
                        />
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="px-4 py-2 text-gray-400 hover:text-white"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateSymbol}
                                className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600"
                            >
                                Create
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
