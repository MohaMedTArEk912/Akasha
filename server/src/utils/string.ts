
export function pascalCase(str: string): string {
    return str
        .replace(/[^a-zA-Z0-9]+(.)/g, (_m, chr) => chr.toUpperCase())
        .replace(/^[a-z]/, (c) => c.toUpperCase());
}

export function camelCase(str: string): string {
    return str
        .replace(/[^a-zA-Z0-9]+(.)/g, (_m, chr) => chr.toUpperCase())
        .replace(/^[A-Z]/, (c) => c.toLowerCase());
}
