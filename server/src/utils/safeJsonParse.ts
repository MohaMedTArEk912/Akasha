/**
 * Safely parse a value that may already be a JS object (from MongoDB)
 * or a JSON string (from SQLite / legacy storage).
 *
 * Returns `fallback` on any error.
 */
export function safeJsonParse<T = unknown>(value: unknown, fallback: T): T {
    if (value === null || value === undefined) return fallback;
    // Already parsed (MongoDB stores objects directly)
    if (typeof value !== 'string') return value as T;
    // It's a string — try to parse it
    try {
        return JSON.parse(value) as T;
    } catch {
        return fallback;
    }
}

/**
 * Robust Self-Healing JSON Parser
 * Recovers truncated strings, unclosed objects/arrays, and markdown fences.
 */
export function safeParseOrRepairJson<T = any>(raw: string, fallback: T): T {
    if (!raw || typeof raw !== 'string') return fallback;
    let text = raw.trim();
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    // 1. Direct parse attempt
    try {
        return JSON.parse(text);
    } catch {}

    // 2. Locate starting JSON token '{' or '['
    const firstBrace = text.indexOf('{');
    const firstBracket = text.indexOf('[');
    let startIdx = -1;
    let isObject = true;

    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
        startIdx = firstBrace;
        isObject = true;
    } else if (firstBracket !== -1) {
        startIdx = firstBracket;
        isObject = false;
    }

    if (startIdx === -1) return fallback;

    let candidate = text.slice(startIdx);

    // 3. Slice to last closing bracket/brace
    const lastClose = isObject ? candidate.lastIndexOf('}') : candidate.lastIndexOf(']');
    if (lastClose !== -1) {
        const sliced = candidate.slice(0, lastClose + 1);
        try {
            return JSON.parse(sliced);
        } catch {}
    }

    // 4. Syntax Healing / Truncation Repair
    try {
        let inString = false;
        let escaped = false;
        const stack: string[] = [];

        for (let i = 0; i < candidate.length; i++) {
            const ch = candidate[i];
            if (escaped) {
                escaped = false;
                continue;
            }
            if (ch === '\\') {
                escaped = true;
                continue;
            }
            if (ch === '"') {
                inString = !inString;
            } else if (!inString) {
                if (ch === '{') stack.push('}');
                else if (ch === '[') stack.push(']');
                else if (ch === '}' || ch === ']') {
                    if (stack.length && stack[stack.length - 1] === ch) {
                        stack.pop();
                    }
                }
            }
        }

        let healed = candidate;
        if (inString) healed += '"';

        // Fix trailing colon or comma
        healed = healed.replace(/:\s*$/, ': null');
        healed = healed.replace(/,\s*$/, '');

        // Close unclosed brackets/braces in reverse order
        while (stack.length > 0) {
            healed += stack.pop();
        }

        return JSON.parse(healed);
    } catch {}

    return fallback;
}
