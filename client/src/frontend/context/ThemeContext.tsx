import React, { createContext, useContext, useEffect, useCallback, useState, ReactNode } from "react";

export type Theme = "light" | "dark";
export type GlassMode = "clean" | "bubble";

export interface ThemeContextValue {
    theme: Theme;
    toggleTheme: () => void;
    setTheme: (theme: Theme) => void;
    glassMode: GlassMode;
    toggleGlassMode: () => void;
    setGlassMode: (mode: GlassMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const THEME_STORAGE_KEY = "akasha-theme-v2";
const GLASS_STORAGE_KEY = "akasha-surface-mode";

function readInitialTheme(): Theme {
    try {
        const stored = localStorage.getItem(THEME_STORAGE_KEY);
        if (stored === "light" || stored === "dark") {
            return stored;
        }
    } catch {
        // ignore storage errors
    }
    return "light";
}

interface ThemeProviderProps {
    children: ReactNode;
}

/**
 * ThemeProvider — Light-First Architectural Studio Palette with Optional Dark Mode
 *
 * Defaults to a crisp, airy daylight palette while letting any user toggle smoothly
 * between Light and Dark studio modes in the top bar or Settings.
 */
export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
    const [theme, setThemeState] = useState<Theme>(readInitialTheme);
    const [glassMode, setGlassModeState] = useState<GlassMode>("clean");

    useEffect(() => {
        const root = document.documentElement;
        if (theme === "dark") {
            root.classList.add("dark");
            root.classList.remove("light");
        } else {
            root.classList.add("light");
            root.classList.remove("dark");
        }
        root.setAttribute("data-theme", theme);
        root.setAttribute("data-glass-mode", glassMode);
        const themeColorMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]:not([media])')
            || (() => {
                const m = document.createElement("meta");
                m.name = "theme-color";
                document.head.appendChild(m);
                return m;
            })();
        themeColorMeta.content = theme === "dark" ? "#0E1117" : "#E7EAEF";
        try {
            localStorage.setItem(THEME_STORAGE_KEY, theme);
            localStorage.setItem(GLASS_STORAGE_KEY, glassMode);
        } catch {
            // ignore storage errors
        }
    }, [theme, glassMode]);

    const setTheme = useCallback((nextTheme: Theme) => {
        setThemeState(nextTheme);
    }, []);

    const toggleTheme = useCallback(() => {
        setThemeState((prev) => (prev === "light" ? "dark" : "light"));
    }, []);

    const setGlassMode = useCallback((mode: GlassMode) => {
        setGlassModeState(mode);
    }, []);

    const toggleGlassMode = useCallback(() => {
        setGlassModeState((prev) => (prev === "clean" ? "bubble" : "clean"));
    }, []);

    return (
        <ThemeContext.Provider
            value={{
                theme,
                toggleTheme,
                setTheme,
                glassMode,
                toggleGlassMode,
                setGlassMode,
            }}
        >
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
