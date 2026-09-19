import React from "react";
import { MoonStar, SunMedium } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

interface ThemeToggleProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "fixed";
}

const sizeMap = {
  sm: "h-8 w-8",
  md: "h-9 w-9",
  lg: "h-10 w-10",
};

const iconMap = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-4 w-4",
};

export default function ThemeToggle({
  className = "",
  size = "md",
  variant = "default",
}: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  const baseClass =
    variant === "fixed"
      ? "fixed right-5 top-5 z-30"
      : "";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
      className={`theme-toggle-btn flex items-center justify-center rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white/80 transition-colors ${sizeMap[size]} ${baseClass} ${className}`.trim()}
    >
      {isDark ? (
        <SunMedium className={iconMap[size]} />
      ) : (
        <MoonStar className={iconMap[size]} />
      )}
    </button>
  );
}
