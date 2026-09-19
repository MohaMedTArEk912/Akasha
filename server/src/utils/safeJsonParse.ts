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
