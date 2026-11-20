import React, { ButtonHTMLAttributes, ReactNode } from "react";
import type { LiquidTint } from "./LiquidContainer";

export interface LiquidPillProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children?: ReactNode;
  icon?: ReactNode;
  variant?: "primary" | "secondary" | "subtle" | "active" | "danger";
  size?: "xs" | "sm" | "md" | "lg";
  tint?: LiquidTint;
  className?: string;
  active?: boolean;
}

export const LiquidPill: React.FC<LiquidPillProps> = ({
  children,
  icon,
  variant = "secondary",
  size = "md",
  className = "",
  active = false,
  disabled,
  ...rest
}) => {
  const sizeStyles = {
    xs: "px-2.5 py-1 text-xs gap-1.5",
    sm: "px-3.5 py-1.5 text-xs font-semibold gap-1.5",
    md: "px-4 py-2 text-sm font-semibold gap-2",
    lg: "px-5 py-2.5 text-sm font-semibold gap-2.5",
  }[size];

  const variantStyles = {
    primary:
      "bg-[#1B5BFF] hover:bg-[#1347D6] text-white border-transparent",
    secondary:
      "bg-[var(--ide-bg-elevated)] hover:bg-[var(--ide-accent-subtle)] text-[var(--ide-text)] border-[var(--ide-border)] hover:border-[var(--ide-border-strong)]",
    subtle:
      "bg-transparent hover:bg-[var(--ide-accent-subtle)] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] border-transparent",
    active:
      "bg-[#1B5BFF]/10 text-[#1B5BFF] dark:text-[#7AA3FF] border-[#1B5BFF]/30",
    danger:
      "bg-rose-50 dark:bg-rose-500/15 hover:bg-rose-100 dark:hover:bg-rose-500/25 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30",
  }[active ? "active" : variant];

  return (
    <button
      disabled={disabled}
      className={`inline-flex items-center justify-center rounded-xl border transition-colors duration-150 active:scale-[0.985] disabled:opacity-45 disabled:pointer-events-none select-none cursor-pointer ${sizeStyles} ${variantStyles} ${className}`}
      {...rest}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children && <span>{children}</span>}
    </button>
  );
};

export default LiquidPill;
