/**
 * Editor Settings Store
 * 
 * Manages user preferences for the code editor including:
 * - Font size and zoom level
 * - Theme selection
 * - Minimap and word wrap toggles
 * - Tab size and other editor options
 * 
 * Settings are persisted to localStorage for consistency across sessions.
 */

export interface EditorSettings {
    // Display settings
    fontSize: number;
    zoomLevel: number;
    fontFamily: string;
    lineHeight: number;

    // Editor behavior
    tabSize: number;
    insertSpaces: boolean;
    wordWrap: "on" | "off" | "wordWrapColumn" | "bounded";
    autoSave: boolean;
    autoSaveDelay: number;

    // UI toggles
    minimap: boolean;
    lineNumbers: "on" | "off" | "relative";
    folding: boolean;
    bracketPairColorization: boolean;
    stickyScroll: boolean;

    // Theme
    theme: "vs-dark" | "vs-light" | "hc-black";
}

const DEFAULT_SETTINGS: EditorSettings = {
    fontSize: 13,
    zoomLevel: 100,
    fontFamily: "'Consolas', 'Courier New', monospace",  // Simpler font for better performance
    lineHeight: 1.5,  // Reduced from 1.6
    tabSize: 4,
    insertSpaces: true,
    wordWrap: "on",
    autoSave: true,
    autoSaveDelay: 1000,  // Increased from 700ms to reduce saves
    minimap: false,
    lineNumbers: "on",
    folding: true,
    bracketPairColorization: false,  // Disabled for performance
    stickyScroll: false,  // Disabled for performance
    theme: "vs-dark",
};

const STORAGE_KEY = "akasha-editor-settings";

// Load settings from localStorage
function loadSettings(): EditorSettings {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
        }
    } catch (err) {
        console.warn("Failed to load editor settings:", err);
    }
    return { ...DEFAULT_SETTINGS };
}

// Save settings to localStorage
function saveSettings(settings: EditorSettings): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (err) {
        console.warn("Failed to save editor settings:", err);
    }
}

// Internal state
let state: EditorSettings = loadSettings();
let listeners: Set<() => void> = new Set();

/**
 * Subscribe to settings changes
 */
export function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

/**
 * Get current settings
 */
export function getSnapshot() {
    return state;
}

/**
 * Update settings
 */
function updateSettings(updater: (prev: EditorSettings) => Partial<EditorSettings>) {
    state = { ...state, ...updater(state) };
    saveSettings(state);
    listeners.forEach(l => l());
}

// Actions
export function setFontSize(fontSize: number): void {
    updateSettings(() => ({ fontSize: Math.max(10, Math.min(24, fontSize)) }));
}

export function setZoomLevel(zoomLevel: number): void {
    updateSettings(() => ({ zoomLevel: Math.max(50, Math.min(200, zoomLevel)) }));
}

export function zoomIn(): void {
    updateSettings((prev) => ({ zoomLevel: Math.min(200, prev.zoomLevel + 10) }));
}

export function zoomOut(): void {
    updateSettings((prev) => ({ zoomLevel: Math.max(50, prev.zoomLevel - 10) }));
}

export function resetZoom(): void {
    updateSettings(() => ({ zoomLevel: 100 }));
}

export function setFontFamily(fontFamily: string): void {
    updateSettings(() => ({ fontFamily }));
}

export function setLineHeight(lineHeight: number): void {
    updateSettings(() => ({ lineHeight: Math.max(1.0, Math.min(2.0, lineHeight)) }));
}

export function setTabSize(tabSize: number): void {
    updateSettings(() => ({ tabSize: [2, 4, 8].includes(tabSize) ? tabSize : 4 }));
}

export function setInsertSpaces(insertSpaces: boolean): void {
    updateSettings(() => ({ insertSpaces }));
}

export function setWordWrap(wordWrap: EditorSettings["wordWrap"]): void {
    updateSettings(() => ({ wordWrap }));
}

export function toggleWordWrap(): void {
    updateSettings((prev) => ({ wordWrap: prev.wordWrap === "on" ? "off" : "on" }));
}

export function setAutoSave(autoSave: boolean): void {
    updateSettings(() => ({ autoSave }));
}

export function setAutoSaveDelay(autoSaveDelay: number): void {
    updateSettings(() => ({ autoSaveDelay: Math.max(300, Math.min(5000, autoSaveDelay)) }));
}

export function toggleMinimap(): void {
    updateSettings((prev) => ({ minimap: !prev.minimap }));
}

export function setLineNumbers(lineNumbers: EditorSettings["lineNumbers"]): void {
    updateSettings(() => ({ lineNumbers }));
}

export function toggleFolding(): void {
    updateSettings((prev) => ({ folding: !prev.folding }));
}

export function toggleBracketPairColorization(): void {
    updateSettings((prev) => ({ bracketPairColorization: !prev.bracketPairColorization }));
}

export function toggleStickyScroll(): void {
    updateSettings((prev) => ({ stickyScroll: !prev.stickyScroll }));
}

export function setTheme(theme: EditorSettings["theme"]): void {
    updateSettings(() => ({ theme }));
}

export function resetToDefaults(): void {
    state = { ...DEFAULT_SETTINGS };
    saveSettings(state);
    listeners.forEach(l => l());
}
