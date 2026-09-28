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
        info: 'border-sky-400/15 bg-sky-400/[0.05] text-slate-300',
        action: 'border-cyan-400/20 bg-cyan-400/[0.06] text-slate-100',
        warn: 'border-amber-400/25 bg-amber-400/[0.07] text-amber-50',
    };

    return (
        <div className={`rounded-xl border p-3 ${tones[tone]}`}>
            <div className="text-[9px] font-black uppercase tracking-[0.16em] opacity-75">{title}</div>
            <ul className="mt-2 space-y-2 text-[11px] leading-[1.55]">
                {items.map((item, index) => (
                    <li key={`${title}-${index}`} className="flex items-start gap-1.5">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-55" />
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
        <div className="space-y-3.5 text-[13px] leading-relaxed text-[var(--ide-text)]">
            {response.summary && (
                <div className="rounded-xl border border-cyan-400/15 bg-gradient-to-br from-cyan-400/[0.08] to-white/[0.02] px-4 py-3 shadow-sm">
                    <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.16em] text-cyan-200/70">
                        <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_#67e8f9]" />
                        Summary
                    </div>
                    <div className="mt-2 prose prose-invert prose-sm max-w-none prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-strong:text-white prose-headings:text-white prose-a:text-cyan-300 transition-colors">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {response.summary}
                        </ReactMarkdown>
                    </div>
                </div>
            )}

            {response.answer_markdown && (
                <div className="rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 shadow-sm">
                    <div className="prose prose-invert prose-sm max-w-none text-inherit prose-p:my-2.5 prose-ul:my-2.5 prose-ol:my-2.5 prose-li:my-1 prose-strong:text-white prose-headings:text-white prose-headings:mt-4 prose-headings:mb-2 prose-a:text-cyan-300 hover:prose-a:text-cyan-200 transition-colors prose-code:text-cyan-100 prose-code:bg-cyan-400/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-pre:bg-transparent prose-pre:p-0">
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
