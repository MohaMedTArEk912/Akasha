import React, { useMemo } from 'react';
import { ShieldAlert, CheckCircle2 } from 'lucide-react';
import { GrapesEditor } from '../../types/grapes';

interface AccessibilityPanelProps {
    editor: GrapesEditor | null;
}

export const AccessibilityPanel: React.FC<AccessibilityPanelProps> = ({ editor }) => {
    const report = useMemo(() => {
        if (!editor) return null;
        const html = editor.getHtml() || '';
        const imgRegex = /<img\b[^>]*>/gi;
        const imgs = html.match(imgRegex) || [];
        const missingAlt = imgs.filter((img) => !/alt\s*=\s*['"][^'"]*['"]/i.test(img));
        const score = imgs.length === 0 ? 100 : Math.max(0, 100 - Math.round((missingAlt.length / imgs.length) * 100));

        return {
            totalImages: imgs.length,
            missingAlt: missingAlt.length,
            score,
        };
    }, [editor]);

    if (!editor) {
        return <div className="p-4 text-slate-400 text-sm">Editor not ready.</div>;
    }

    return (
        <div className="p-4 text-slate-200">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <ShieldAlert size={18} />
                    Accessibility
                </h3>
                {report?.score === 100 ? (
                    <CheckCircle2 size={16} className="text-green-400" />
                ) : (
                    <span className="text-xs text-slate-400">Score {report?.score}</span>
                )}
            </div>

            {report && (
                <div className="space-y-2 text-sm text-slate-300">
                    <div>Total images: {report.totalImages}</div>
                    <div>Missing alt text: {report.missingAlt}</div>
                    <div className="text-xs text-slate-500">Add alt text to improve accessibility.</div>
                </div>
            )}
        </div>
    );
};
