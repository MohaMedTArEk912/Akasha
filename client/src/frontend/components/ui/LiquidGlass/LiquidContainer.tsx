import React, { useRef, useEffect, useState, ReactNode } from "react";
import { VERTEX_SHADER, FRAGMENT_SHADER } from "./LiquidShader";

export type LiquidShape = "rounded" | "pill" | "circle";
export type LiquidTint = "clear" | "light" | "azure" | "mint" | "frosted" | "tinted";

export interface LiquidContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  shape?: LiquidShape;
  tint?: LiquidTint;
  borderRadius?: number;
  elevation?: "none" | "sm" | "md" | "lg" | "floating";
  interactive?: boolean;
  enableShader?: boolean;
  className?: string;
  glow?: boolean;
}

const TINT_COLORS: Record<LiquidTint, [number, number, number, number]> = {
  clear: [1.0, 1.0, 1.0, 0.05],
  light: [0.98, 0.99, 1.0, 0.45],
  azure: [0.0, 0.48, 1.0, 0.12],
  mint: [0.19, 0.82, 0.35, 0.12],
  frosted: [1.0, 1.0, 1.0, 0.65],
  tinted: [0.0, 0.45, 0.9, 0.08],
};

export const LiquidContainer: React.FC<LiquidContainerProps> = ({
  children,
  shape = "rounded",
  tint = "light",
  borderRadius = 20,
  elevation = "md",
  interactive = true,
  enableShader = false,
  className = "",
  glow = false,
  style,
  onMouseMove,
  ...rest
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });
  const [isHovered, setIsHovered] = useState(false);

  // Shape class & styling
  const shapeClass =
    shape === "pill"
      ? "rounded-full"
      : shape === "circle"
      ? "rounded-full aspect-square flex items-center justify-center"
      : "rounded-2xl";

  const elevationClass = {
    none: "",
    sm: "shadow-[0_4px_16px_rgba(0,0,0,0.03)]",
    md: "shadow-[0_10px_30px_-10px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]",
    lg: "shadow-[0_20px_45px_-12px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.04)]",
    floating: "shadow-[0_28px_60px_-15px_rgba(0,0,0,0.12),0_4px_12px_rgba(0,0,0,0.05)]",
  }[elevation];

  // Tint styles
  const tintClass = {
    clear: "bg-white/[0.05] dark:bg-black/[0.2]",
    light: "bg-white/80 dark:bg-[#0c0d16]/80",
    azure: "bg-white/80 dark:bg-[#0c0d16]/80",
    mint: "bg-white/80 dark:bg-[#0c0d16]/80",
    frosted: "bg-white/90 dark:bg-[#0c0d16]/90",
    tinted: "bg-white/80 dark:bg-[#0c0d16]/80",
  }[tint];

  // Optional WebGL refraction shader initialization
  useEffect(() => {
    if (!enableShader || !canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;
    const gl = canvas.getContext("webgl", { alpha: true, preserveDrawingBuffer: false });
    if (!gl) return;

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };

    const vs = compile(gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);

    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    // Quad geometry
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        -1, -1, 0, 0,
         1, -1, 1, 0,
        -1,  1, 0, 1,
        -1,  1, 0, 1,
         1, -1, 1, 0,
         1,  1, 1, 1,
      ]),
      gl.STATIC_DRAW
    );

    const posAttr = gl.getAttribLocation(prog, "a_position");
    const texAttr = gl.getAttribLocation(prog, "a_texcoord");
    gl.enableVertexAttribArray(posAttr);
    gl.vertexAttribPointer(posAttr, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(texAttr);
    gl.vertexAttribPointer(texAttr, 2, gl.FLOAT, false, 16, 8);

    const resLoc = gl.getUniformLocation(prog, "u_resolution");
    const radLoc = gl.getUniformLocation(prog, "u_borderRadius");
    const shapeLoc = gl.getUniformLocation(prog, "u_shapeType");
    const edgeLoc = gl.getUniformLocation(prog, "u_edgeIntensity");
    const rimLoc = gl.getUniformLocation(prog, "u_rimIntensity");
    const caLoc = gl.getUniformLocation(prog, "u_chromaticAberration");
    const tintLoc = gl.getUniformLocation(prog, "u_tintColor");
    const tintOpLoc = gl.getUniformLocation(prog, "u_tintOpacity");
    const specLoc = gl.getUniformLocation(prog, "u_specularIntensity");

    let animId: number = 0;
    const render = () => {
      if (!containerRef.current || !canvas) return;
      const rect = containerRef.current.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.round(rect.width * dpr);
      const h = Math.round(rect.height * dpr);

      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }

      gl.uniform2f(resLoc, w, h);
      gl.uniform1f(radLoc, shape === "pill" ? h * 0.5 : shape === "circle" ? Math.min(w, h) * 0.5 : borderRadius * dpr);
      gl.uniform1i(shapeLoc, shape === "pill" ? 1 : shape === "circle" ? 2 : 0);
      gl.uniform1f(edgeLoc, 0.015);
      gl.uniform1f(rimLoc, 0.08);
      gl.uniform1f(caLoc, 0.02);
      const rgba = TINT_COLORS[tint];
      gl.uniform4f(tintLoc, rgba[0], rgba[1], rgba[2], rgba[3]);
      gl.uniform1f(tintOpLoc, rgba[3]);
      gl.uniform1f(specLoc, isHovered ? 0.35 : 0.2);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    render();
    return () => {
      cancelAnimationFrame(animId);
    };
  }, [enableShader, shape, tint, borderRadius, isHovered]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (interactive && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setMousePos({ x, y });
    }
    if (onMouseMove) onMouseMove(e);
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        borderRadius: shape === "pill" ? "9999px" : shape === "circle" ? "9999px" : `${borderRadius}px`,
        ...style,
      }}
      className={`
        liquid-glass-surface relative overflow-hidden
        backdrop-blur-[24px] saturate-[180%]
        border border-black/[0.08] dark:border-white/[0.12]
        ${tintClass}
        ${shapeClass}
        ${elevationClass}
        ${glow ? "ring-1 ring-white/10" : ""}
        ${interactive ? "transition-all duration-200" : ""}
        ${className}
      `}
      {...rest}
    >
      {/* Specular Rim & Dynamic Light Reflection */}
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-300 z-0"
        style={{
          borderRadius: "inherit",
          background: isHovered
            ? `radial-gradient(circle at ${mousePos.x}% ${mousePos.y}%, rgba(255, 255, 255, 0.08) 0%, transparent 60%), linear-gradient(180deg, rgba(255,255,255,0.06) 0%, transparent 100%)`
            : `linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, transparent 100%)`,
          boxShadow: `inset 0 1px 1px 0 rgba(255, 255, 255, 0.1)`,
        }}
      />

      {/* WebGL Shader Canvas if enabled */}
      {enableShader && (
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 w-full h-full -z-10"
          style={{ borderRadius: "inherit" }}
        />
      )}

      {/* Content Slot */}
      <div className="relative z-10 w-full h-full flex items-center">{children}</div>
    </div>
  );
};

export default LiquidContainer;
