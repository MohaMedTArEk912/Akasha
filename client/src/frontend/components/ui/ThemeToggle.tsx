import { useBackgroundLoading } from "../../context/BackgroundLoadingContext";

interface ThemeToggleProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "fixed";
}

/**
 * ThemeToggle — 3D Code Runtime Horizon Toggle Badge
 * Toggles the unobstructed 3D background view and indicates live compiler telemetry.
 */
export default function ThemeToggle({
  className = "",
  variant = "default",
}: ThemeToggleProps) {
  const { is3DFocused, setIs3DFocused, isLoading, activeTasks } = useBackgroundLoading();
  const isWorking = isLoading || activeTasks.length > 0;
  const baseClass = variant === "fixed" ? "fixed right-5 top-5 z-30" : "";

  return (
    <button
      type="button"
      onClick={() => setIs3DFocused((prev) => !prev)}
      className={`
        inline-flex items-center px-3 py-1 rounded-full
        backdrop-blur-2xl transition-all duration-300
        border cursor-pointer select-none
        ${
          is3DFocused
            ? "bg-cyan-500/25 border-cyan-400/60 shadow-[0_0_20px_rgba(6,182,212,0.4)] text-cyan-200 scale-[1.03]"
            : isWorking
            ? "bg-black/60 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.3)] text-neutral-200 hover:border-cyan-400"
            : "bg-black/60 border-white/20 shadow-[0_4px_16px_rgba(0,0,0,0.5),inset_0_1.5px_1.5px_rgba(255,255,255,0.7)] text-neutral-200 hover:border-white/40"
        }
        ${baseClass}
        ${className}
      `.trim()}
      title={is3DFocused ? "Exit 3D Focus View" : "Focus 3D Code Runtime Background"}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full mr-2 ${
          isWorking
            ? "bg-cyan-400 shadow-[0_0_8px_#38bdf8] animate-ping"
            : is3DFocused
            ? "bg-cyan-300 shadow-[0_0_8px_#67e8f9]"
            : "bg-emerald-400 shadow-[0_0_8px_#34d399]"
        }`}
      />
      <span className="text-[9px] font-mono font-black tracking-widest uppercase">
        {is3DFocused ? "EXIT 3D VIEW" : isWorking ? "3D COMPILING" : "3D RUNTIME"}
      </span>
    </button>
  );
}
export { ThemeToggle };
