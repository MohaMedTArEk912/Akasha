import React, { ButtonHTMLAttributes, ReactNode } from "react";

export interface LiquidCircleProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "default" | "primary" | "subtle" | "danger";
  active?: boolean;
  tooltip?: string;
  className?: string;
}

export const LiquidCircle: React.FC<LiquidCircleProps> = ({
  children,
  size = "md",
  variant = "default",
  active = false,
  tooltip,
  className = "",
  disabled,
  ...rest
}) => {
  const sizeMap = {
    sm: "h-8 w-8 text-xs",
    md: "h-9 w-9 text-sm",
    lg: "h-11 w-11 text-base",
    xl: "h-14 w-14 text-lg",
  }[size];

  const variantStyles = {
    default:
      "bg-black/[0.03] dark:bg-white/[0.06] hover:bg-black/[0.07] dark:hover:bg-white/[0.12] text-neutral-800 dark:text-neutral-200 border-black/[0.06] dark:border-white/12 hover:border-black/12 dark:hover:border-white/20 shadow-none",
    primary:
      "bg-blue-600 hover:bg-blue-500 text-white border-transparent shadow-[0_2px_10px_rgba(37,99,235,0.35)]",
    subtle:
      "bg-transparent hover:bg-black/[0.05] dark:hover:bg-white/[0.08] text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white border-transparent",
    danger:
      "bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-400 border-rose-400/30",
  }[variant];

  return (
    <button
      disabled={disabled}
      title={tooltip}
      aria-label={tooltip}
      className={`
        group relative inline-flex items-center justify-center rounded-full
        aspect-square flex-shrink-0
        backdrop-blur-[20px] saturate-[180%]
        border transition-all duration-200 ease-out
        active:scale-[0.93] disabled:opacity-30 disabled:pointer-events-none
        cursor-pointer
        ${sizeMap}
        ${variantStyles}
        ${active ? "ring-2 ring-blue-500/40 border-blue-400/60 !bg-blue-600/20 dark:!bg-blue-500/20 !text-blue-600 dark:!text-blue-400" : ""}
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
      <span className="relative z-10 flex items-center justify-center transition-transform group-hover:scale-105">
        {children}
      </span>
    </button>
  );
};

export default LiquidCircle;
