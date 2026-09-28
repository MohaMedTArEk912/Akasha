import React, { createContext, useContext, useEffect, useCallback, ReactNode } from "react";

export type Theme = "dark";
export type GlassMode = "bubble";

export interface ThemeContextValue {
    theme: Theme;
    toggleTheme: () => void;
    setTheme: (theme: Theme) => void;
    glassMode: GlassMode;
    toggleGlassMode: () => void;
    setGlassMode: (mode: GlassMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const THEME_STORAGE_KEY = "akasha-theme";
const GLASS_STORAGE_KEY = "akasha-glass-mode";

interface ThemeProviderProps {
    children: ReactNode;
}

/**
 * ThemeProvider — Dark Mode Only + 3D Liquid Bubble Glass
 * 
 * - Strictly dark mode only across all pages
 * - VisionOS 3D Bubble Glass Material Engine
 * - Persisted to localStorage and applied via data-glass-mode="bubble" on <html>
 */
export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
    // Strictly dark mode only
    const theme: Theme = "dark";
    const glassMode: GlassMode = "bubble";

    // Enforce dark mode and apply 3D bubble glass mode to <html>
    useEffect(() => {
        const root = document.documentElement;
        root.classList.add("dark");
        root.classList.remove("light");
        root.setAttribute("data-glass-mode", "bubble");
        localStorage.setItem(THEME_STORAGE_KEY, "dark");
        localStorage.setItem(GLASS_STORAGE_KEY, "bubble");
    }, []);

    const toggleGlassMode = useCallback(() => {}, []);
    const setGlassMode = useCallback((_mode: GlassMode) => {}, []);

    // Backwards-compatible dummy functions for theme
    const toggleTheme = useCallback(() => {
        // Toggle glass mode when legacy theme toggle is called
        toggleGlassMode();
    }, [toggleGlassMode]);

    const setTheme = useCallback((_newTheme: Theme) => {
        // Always dark
    }, []);

    return (
        <ThemeContext.Provider value={{
            theme,
            toggleTheme,
            setTheme,
            glassMode,
            toggleGlassMode,
            setGlassMode,
        }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = (): ThemeContextValue => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error("useTheme must be used within a ThemeProvider");
    }
    return context;
};

export default ThemeContext;
