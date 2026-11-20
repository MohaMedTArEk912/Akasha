import { Sun, Moon } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

interface ThemeToggleProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "fixed";
  showLabel?: boolean;
}

/**
 * ThemeToggle — Smooth Light / Dark Studio Theme Switch
 */
export default function ThemeToggle({
  className = "",
  variant = "default",
  showLabel = false,
}: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const baseClass = variant === "fixed" ? "fixed right-5 top-5 z-30" : "";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-[var(--ide-border)] bg-[var(--ide-bg-elevated)] hover:bg-[var(--ide-accent-subtle)] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] transition-colors duration-150 cursor-pointer select-none ${baseClass} ${className}`.trim()}
    >
      {isDark ? (
        <Sun className="w-3.5 h-3.5 text-amber-400" />
      ) : (
        <Moon className="w-3.5 h-3.5 text-[#475467]" />
      )}
      {showLabel && (
        <span className="text-xs font-medium">{isDark ? "Light" : "Dark"}</span>
      )}
    </button>
  );
}

export { ThemeToggle };
