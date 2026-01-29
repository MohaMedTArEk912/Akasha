import React from 'react';
import { Store } from 'lucide-react';

export const MarketplacePanel: React.FC = () => {
    return (
        <div className="p-4 text-slate-200">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Store size={18} />
                    Templates
                </h3>
            </div>
            <div className="text-slate-400 text-sm">
                No templates available yet. Create templates from projects to publish here.
            </div>
        </div>
    );
};
