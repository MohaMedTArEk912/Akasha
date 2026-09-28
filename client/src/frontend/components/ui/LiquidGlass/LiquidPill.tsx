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
  tint = "light",
  className = "",
  active = false,
  disabled,
  ...rest
}) => {
  const sizeStyles = {
    xs: "px-2.5 py-1 text-xs gap-1.5",
    sm: "px-3.5 py-1.5 text-xs font-medium gap-2",
    md: "px-4 py-2 text-sm font-medium gap-2.5",
    lg: "px-6 py-2.5 text-base font-medium gap-3",
  }[size];

  const variantStyles = {
    primary:
      "bg-blue-600 hover:bg-blue-500 text-white font-semibold border-transparent shadow-[0_2px_10px_rgba(37,99,235,0.35)]",
    secondary:
      "bg-white/90 dark:bg-[#0e101c]/90 hover:bg-white dark:hover:bg-[#181a2c] text-neutral-800 dark:text-neutral-200 font-semibold border-black/[0.08] dark:border-white/[0.14] hover:border-black/15 dark:hover:border-white/25 shadow-[0_6px_20px_-6px_rgba(0,0,0,0.5)]",
    subtle:
      "bg-transparent hover:bg-black/[0.05] dark:hover:bg-white/[0.08] text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white font-medium border-transparent",
    active:
      "bg-blue-600/15 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-semibold border-blue-500/30 dark:border-blue-400/30 shadow-[0_2px_10px_rgba(37,99,235,0.15)]",
    danger:
      "bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-400 font-semibold border-rose-400/30",
  }[active ? "active" : variant];

  return (
    <button
      disabled={disabled}
      className={`
        group relative inline-flex items-center justify-center rounded-full
        backdrop-blur-[24px] saturate-[180%]
        border transition-all duration-200 ease-out
        active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none
        select-none cursor-pointer
        ${sizeStyles}
        ${variantStyles}
        ${className}
      `}
      {...rest}
    >
      {/* Specular highlight rim */}
      <span
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          boxShadow: `inset 0 1px 1px 0 rgba(255, 255, 255, 0.1)`,
        }}
      />
      {icon && <span className="flex-shrink-0 transition-transform group-hover:scale-105">{icon}</span>}
      {children && <span className="tracking-tight">{children}</span>}
    </button>
  );
};

export default LiquidPill;
