import { marked } from 'marked';
import type { StructuredAiResponse } from '../../utils/aiResponse';

interface StructuredAiResponseProps {
    response: StructuredAiResponse;
    compact?: boolean;
}

function renderList(title: string, items: string[], tone: 'info' | 'action' | 'warn') {
    if (items.length === 0) return null;

    const tones = {
        info: 'border-cyan-500/20 bg-cyan-500/5 text-cyan-200',
        action: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-200',
        warn: 'border-amber-500/20 bg-amber-500/5 text-amber-200',
    };

    return (
        <div className={`rounded-xl border p-2.5 ${tones[tone]}`}>
            <div className="text-[10px] font-black uppercase tracking-widest opacity-80">{title}</div>
            <ul className="mt-1.5 space-y-1 text-[11px] leading-relaxed">
                {items.map((item, index) => (
                    <li key={`${title}-${index}`} className="flex items-start gap-1.5">
                        <span className="opacity-60 mt-[1px]">•</span>
                        <span>{item}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default function StructuredAiResponseCard({ response, compact = false }: StructuredAiResponseProps) {
    const hasLists = response.highlights.length > 0 || response.next_actions.length > 0 || response.warnings.length > 0;

    return (
        <div className="space-y-3">
            {response.summary && (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                    <div className="text-[10px] font-black uppercase tracking-widest text-white/50">Summary</div>
                    <p className="mt-1 text-xs text-white/80 leading-relaxed">{response.summary}</p>
                </div>
            )}

            {response.answer_markdown && (
                <div
                    className="prose prose-invert prose-sm max-w-none text-inherit"
                    dangerouslySetInnerHTML={{ __html: marked.parse(response.answer_markdown, { async: false }) as string }}
                />
            )}

            {hasLists && (
                <div className={`grid gap-2 ${compact ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-3'}`}>
                    {renderList('Highlights', response.highlights, 'info')}
                    {renderList('Next Actions', response.next_actions, 'action')}
                    {renderList('Warnings', response.warnings, 'warn')}
                </div>
            )}
        </div>
    );
}
