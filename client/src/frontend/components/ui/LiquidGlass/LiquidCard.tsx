import React, { HTMLAttributes, ReactNode } from "react";

export interface LiquidCardProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  variant?: "glass" | "tinted" | "elevated" | "bubble";
  interactive?: boolean;
  className?: string;
}

/**
 * LiquidCard — Clean Architectural Paper Card
 * Light-first crisp surface with quiet hairline borders and optional dark mode support.
 */
export const LiquidCard: React.FC<LiquidCardProps> = ({
  children,
  variant = "glass",
  interactive = true,
  className = "",
  style,
  ...rest
}) => {
  const elevation =
    variant === "elevated"
      ? "shadow-[var(--ide-shadow)]"
      : "shadow-[var(--ide-shadow-sm)]";

  return (
    <div
      style={style}
      className={`group relative rounded-2xl overflow-hidden bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] ${elevation} ${
        interactive
          ? "cursor-pointer transition-colors duration-150 hover:border-[var(--ide-border-strong)]"
          : ""
      } ${className}`}
      {...rest}
    >
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
};

export default LiquidCard;
