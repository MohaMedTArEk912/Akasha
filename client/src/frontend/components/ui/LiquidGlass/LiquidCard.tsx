import React, { HTMLAttributes, ReactNode, useState, useRef } from "react";

export interface LiquidCardProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  variant?: "glass" | "tinted" | "elevated" | "bubble";
  interactive?: boolean;
  className?: string;
}

/**
 * LiquidCard — VisionOS 3D Bubble Glass Material
 * 
 * Features:
 * - 3D Bubble Curvature with multi-layer caustic refraction & internal dome glow
 * - Dynamic 3D perspective tilt tracking cursor position
 * - Specular crest arc + lower caustic pool reflection (cyan/violet iridescent dispersion)
 * - Deep smoky obsidian core for high-contrast, razor-sharp typography
 */
export const LiquidCard: React.FC<LiquidCardProps> = ({
  children,
  variant: _variant,
  interactive = true,
  className = "",
  style,
  onMouseMove,
  onMouseEnter,
  onMouseLeave,
  ...rest
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (interactive && cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
      setMousePos({ x, y });
    }
    if (onMouseMove) onMouseMove(e);
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsHovered(true);
    if (onMouseEnter) onMouseEnter(e);
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsHovered(false);
    setMousePos({ x: 50, y: 50 });
    if (onMouseLeave) onMouseLeave(e);
  };

  // Subtle 3D perspective tilt
  const tiltX = interactive && isHovered ? -((mousePos.y - 50) * 0.12) : 0;
  const tiltY = interactive && isHovered ? (mousePos.x - 50) * 0.12 : 0;
  const translateZ = interactive && isHovered ? 8 : 0;

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        ...style,
        transform: interactive
          ? `perspective(900px) rotateX(${tiltX.toFixed(2)}deg) rotateY(${tiltY.toFixed(2)}deg) translateZ(${translateZ}px)`
          : undefined,
        boxShadow: isHovered
          ? `0 24px 50px -12px rgba(0, 0, 0, 0.75),
             inset 0 1px 1px 0 rgba(255, 255, 255, 0.14)`
          : `0 16px 40px -12px rgba(0, 0, 0, 0.6),
             inset 0 1px 1px 0 rgba(255, 255, 255, 0.08)`,
      }}
      className={`
        group relative rounded-3xl overflow-hidden
        bg-white/85 dark:bg-[#0c0d16]/85 backdrop-blur-[28px] saturate-[180%]
        border border-black/[0.08] dark:border-white/[0.12] hover:border-black/15 dark:hover:border-white/22
        transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
        ${interactive ? "cursor-pointer" : ""}
        ${className}
      `}
      {...rest}
    >
      {/* Specular Ambient Glint (Tracks Mouse) */}
      <div
        className="pointer-events-none absolute inset-0 rounded-3xl transition-opacity duration-300 z-0"
        style={{
          background: isHovered
            ? `radial-gradient(circle 280px at ${mousePos.x}% ${mousePos.y}%, rgba(255, 255, 255, 0.07) 0%, transparent 70%),
               linear-gradient(180deg, rgba(255, 255, 255, 0.05) 0%, transparent 100%)`
            : `linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, transparent 100%)`,
        }}
      />

      <div className="relative z-10">{children}</div>
    </div>
  );
};

export default LiquidCard;
