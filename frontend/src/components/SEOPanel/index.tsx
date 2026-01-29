import React, { useState, useEffect } from 'react';
import { Search, Globe, Image, Link2 } from 'lucide-react';

export interface SEOData {
    title: string;
    description: string;
    keywords: string;
    ogTitle: string;
    ogDescription: string;
    ogImage: string;
    canonicalUrl: string;
    favicon: string;
}

interface SEOPanelProps {
    seoData: SEOData;
    onUpdate: (data: SEOData) => void;
}

export const SEOPanel: React.FC<SEOPanelProps> = ({ seoData, onUpdate }) => {
    const [localData, setLocalData] = useState<SEOData>(seoData);

    useEffect(() => {
        setLocalData(seoData);
    }, [seoData]);

    const handleChange = (field: keyof SEOData, value: string) => {
        const updated = { ...localData, [field]: value };
        setLocalData(updated);
        onUpdate(updated);
    };

    return (
        <div className="p-4 text-slate-200">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Search size={20} />
                SEO Settings
            </h3>

            {/* Basic SEO */}
            <div className="space-y-4 mb-6">
                <h4 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Basic</h4>

                <div>
                    <label className="block text-xs text-slate-400 mb-1">Page Title</label>
                    <input
                        type="text"
                        value={localData.title}
                        onChange={(e) => handleChange('title', e.target.value)}
                        placeholder="My Awesome Website"
                        className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <p className="text-xs text-slate-500 mt-1">{localData.title.length}/60 characters</p>
                </div>

                <div>
                    <label className="block text-xs text-slate-400 mb-1">Meta Description</label>
                    <textarea
                        value={localData.description}
                        onChange={(e) => handleChange('description', e.target.value)}
                        placeholder="A brief description of your page..."
                        rows={3}
                        className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                    />
                    <p className="text-xs text-slate-500 mt-1">{localData.description.length}/160 characters</p>
                </div>

                <div>
                    <label className="block text-xs text-slate-400 mb-1">Keywords</label>
                    <input
                        type="text"
                        value={localData.keywords}
                        onChange={(e) => handleChange('keywords', e.target.value)}
                        placeholder="website, builder, design"
                        className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                </div>
            </div>

            {/* Open Graph */}
            <div className="space-y-4 mb-6">
                <h4 className="text-sm font-medium text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <Globe size={14} />
                    Social Sharing (Open Graph)
                </h4>

                <div>
                    <label className="block text-xs text-slate-400 mb-1">OG Title</label>
                    <input
                        type="text"
                        value={localData.ogTitle}
                        onChange={(e) => handleChange('ogTitle', e.target.value)}
                        placeholder="Social media title"
                        className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                </div>

                <div>
                    <label className="block text-xs text-slate-400 mb-1">OG Description</label>
                    <textarea
                        value={localData.ogDescription}
                        onChange={(e) => handleChange('ogDescription', e.target.value)}
                        placeholder="Description for social sharing..."
                        rows={2}
                        className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                    />
                </div>

                <div>
                    <label className="block text-xs text-slate-400 mb-1 flex items-center gap-1">
                        <Image size={12} />
                        OG Image URL
                    </label>
                    <input
                        type="text"
                        value={localData.ogImage}
                        onChange={(e) => handleChange('ogImage', e.target.value)}
                        placeholder="https://example.com/og-image.jpg"
                        className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                </div>
            </div>

            {/* Advanced */}
            <div className="space-y-4">
                <h4 className="text-sm font-medium text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <Link2 size={14} />
                    Advanced
                </h4>

                <div>
                    <label className="block text-xs text-slate-400 mb-1">Canonical URL</label>
                    <input
                        type="text"
                        value={localData.canonicalUrl}
                        onChange={(e) => handleChange('canonicalUrl', e.target.value)}
                        placeholder="https://example.com/page"
                        className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                </div>

                <div>
                    <label className="block text-xs text-slate-400 mb-1">Favicon URL</label>
                    <input
                        type="text"
                        value={localData.favicon}
                        onChange={(e) => handleChange('favicon', e.target.value)}
                        placeholder="https://example.com/favicon.ico"
                        className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                </div>
            </div>

            {/* Preview */}
            <div className="mt-6 p-4 bg-gray-800 rounded-lg">
                <p className="text-xs text-slate-400 mb-2">Google Preview</p>
                <div className="text-blue-400 text-sm hover:underline cursor-pointer">
                    {localData.title || 'Page Title'}
                </div>
                <div className="text-green-400 text-xs">
                    {localData.canonicalUrl || 'https://yourwebsite.com'}
                </div>
                <div className="text-slate-400 text-xs mt-1">
                    {localData.description || 'Your meta description will appear here...'}
                </div>
            </div>
        </div>
    );
};

export const defaultSEOData: SEOData = {
    title: '',
    description: '',
    keywords: '',
    ogTitle: '',
    ogDescription: '',
    ogImage: '',
    canonicalUrl: '',
    favicon: '',
};
