import React from 'react';
import { BarChart3 } from 'lucide-react';

export const AnalyticsPanel: React.FC = () => {
    return (
        <div className="p-4 text-slate-200">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <BarChart3 size={18} />
                    Analytics
                </h3>
            </div>
            <div className="text-slate-400 text-sm">
                Connect tracking endpoints to populate page, form, and event analytics.
            </div>
        </div>
    );
};
