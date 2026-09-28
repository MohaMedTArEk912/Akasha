import React, { ReactNode } from "react";

export interface LiquidDockProps {
  children: ReactNode;
  orientation?: "horizontal" | "vertical";
  className?: string;
  size?: "sm" | "md" | "lg";
}

export const LiquidDock: React.FC<LiquidDockProps> = ({
  children,
  orientation = "horizontal",
  className = "",
  size = "md",
}) => {
  const paddingMap = {
    sm: "p-1.5 gap-1.5",
    md: "p-2 gap-2",
    lg: "p-2.5 gap-3",
  }[size];

  return (
    <nav
      className={`
        liquid-dock relative inline-flex items-center rounded-full
        backdrop-blur-2xl saturate-[190%]
        bg-white/80 dark:bg-[#0c0d16]/80
        border border-black/[0.08] dark:border-white/[0.14]
        ${orientation === "vertical" ? "flex-col" : "flex-row"}
        ${paddingMap}
        ${className}
      `}
      style={{
        boxShadow: `
          0 18px 45px -10px rgba(0, 0, 0, 0.65),
          0 1px 2px rgba(0, 0, 0, 0.4),
          inset 0 1px 1px 0 rgba(255, 255, 255, 0.1)
        `,
      }}
    >
      {/* Background specular refraction layer */}
      <div
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          background:
            "linear-gradient(180deg, rgba(255, 255, 255, 0.05) 0%, transparent 100%)",
        }}
      />
      <div className="relative z-10 flex items-center gap-inherit">{children}</div>
    </nav>
  );
};

export default LiquidDock;
