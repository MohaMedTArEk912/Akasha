export interface StructuredAiResponse {
    answer_markdown: string;
    summary: string;
    highlights: string[];
    next_actions: string[];
    warnings: string[];
}

const EMPTY_RESPONSE: StructuredAiResponse = {
    answer_markdown: '',
    summary: '',
    highlights: [],
    next_actions: [],
    warnings: [],
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function normalizeArray(value: unknown, maxItems = 5): string[] {
    if (!Array.isArray(value)) return [];
    return value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, maxItems);
}

function extractJsonObject(raw: string): string | null {
    const trimmed = raw.trim();
    const withoutFence = trimmed
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

    const start = withoutFence.indexOf('{');
    const end = withoutFence.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) return null;
    return withoutFence.slice(start, end + 1);
}

function parseJson(raw: string): Record<string, unknown> | null {
    const jsonText = extractJsonObject(raw);
    if (!jsonText) return null;
    try {
        const parsed = JSON.parse(jsonText);
        return isRecord(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

function summaryFromAnswer(answer: string): string {
    const compact = answer.replace(/\s+/g, ' ').trim();
    if (!compact) return '';
    const firstSentence = compact.split(/[.!?]/)[0]?.trim() || compact;
    return firstSentence.slice(0, 160);
}

export function normalizeAiResponse(payload: unknown): StructuredAiResponse {
    if (!isRecord(payload)) return { ...EMPTY_RESPONSE };

    let source: Record<string, unknown> | null = null;
    if (isRecord(payload.response)) {
        source = payload.response;
    } else if (typeof payload.reply === 'string') {
        source = parseJson(payload.reply);
    }

    const fallbackReply = typeof payload.reply === 'string' ? payload.reply.trim() : '';
    const answerFromSource = source && typeof source.answer_markdown === 'string'
        ? source.answer_markdown.trim()
        : source && typeof source.answer === 'string'
            ? source.answer.trim()
            : '';

    const answer_markdown = answerFromSource || fallbackReply;
    const summary = source && typeof source.summary === 'string' && source.summary.trim()
        ? source.summary.trim().slice(0, 200)
        : summaryFromAnswer(answer_markdown);

    return {
        answer_markdown,
        summary,
        highlights: normalizeArray(source?.highlights),
        next_actions: normalizeArray(source?.next_actions ?? source?.nextSteps),
        warnings: normalizeArray(source?.warnings ?? source?.risks),
    };
}
