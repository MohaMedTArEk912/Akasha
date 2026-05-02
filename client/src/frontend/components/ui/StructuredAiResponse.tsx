import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { StructuredAiResponse } from '../../utils/aiResponse';

interface StructuredAiResponseProps {
    response: StructuredAiResponse;
    compact?: boolean;
}

function renderList(title: string, items: string[], tone: 'info' | 'action' | 'warn') {
    if (items.length === 0) return null;

    const tones = {
        info: 'border-white/5 bg-white/[0.02] text-white/60',
        action: 'border-white/15 bg-white/[0.04] text-white/90',
        warn: 'border-white/30 bg-white/[0.06] text-white font-semibold',
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
        <div className="space-y-3 text-[13px] leading-relaxed text-[var(--ide-text)]">
            {response.summary && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 shadow-sm">
                    <div className="text-[10px] font-black uppercase tracking-widest text-white/45">Summary</div>
                    <div className="mt-2 prose prose-invert prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-strong:text-white prose-headings:text-white prose-a:text-white/60 hover:prose-a:text-white transition-colors">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {response.summary}
                        </ReactMarkdown>
                    </div>
                </div>
            )}

            {response.answer_markdown && (
                <div className="rounded-2xl border border-white/5 bg-black/15 px-4 py-3 shadow-sm">
                    <div className="prose prose-invert prose-sm max-w-none text-inherit prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-strong:text-white prose-headings:text-white prose-a:text-white/60 hover:prose-a:text-white transition-colors prose-code:text-white/80 prose-code:bg-white/5 prose-code:px-1 prose-code:py-0.5 prose-code:rounded-md prose-pre:bg-black/40 prose-pre:border prose-pre:border-white/10 prose-pre:rounded-xl">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {response.answer_markdown}
                        </ReactMarkdown>
                    </div>
                </div>
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
