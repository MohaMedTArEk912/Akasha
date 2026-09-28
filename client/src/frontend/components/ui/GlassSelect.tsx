import React, { useState, useRef, useEffect } from "react";

interface GlassSelectOption {
  value: string;
  label: string;
}

interface GlassSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: GlassSelectOption[];
  className?: string;
  triggerClassName?: string;
  dropdownClassName?: string;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * GlassSelect — A custom dropdown that matches the Obsidian Dark Glass theme.
 * Replaces native <select> elements which render white/OS-native dropdowns.
 */
const GlassSelect: React.FC<GlassSelectProps> = ({
  value,
  onChange,
  options,
  className = "",
  triggerClassName = "",
  dropdownClassName = "",
  placeholder,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value);
  const selectedLabel = selectedOption?.label || placeholder || "Select...";

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen]);

  // Position the dropdown above if not enough space below
  const [dropUp, setDropUp] = useState(false);
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setDropUp(spaceBelow < 220);
    }
  }, [isOpen]);

  return (
    <div
      ref={containerRef}
      className={`relative ${isOpen ? "z-50" : "z-10"} ${className}`}
    >
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={
          triggerClassName ||
          `w-full h-8 px-3 rounded-lg bg-[#0c0d16]/90 border ${
            isOpen
              ? "border-cyan-500/60 ring-1 ring-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.15)]"
              : "border-white/15 hover:border-white/30"
          } text-xs font-semibold text-neutral-100 flex items-center justify-between gap-2 cursor-pointer transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-cyan-500/40 disabled:opacity-40 disabled:cursor-not-allowed`
        }
      >
        <span className="truncate">{selectedLabel}</span>
        <svg
          className={`w-3.5 h-3.5 text-neutral-400 transition-transform duration-200 flex-shrink-0 ${
            isOpen ? "rotate-180 text-cyan-400" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className={`absolute z-[100] left-0 right-0 min-w-full ${
            dropUp ? "bottom-full mb-1.5" : "top-full mt-1.5"
          } rounded-xl bg-[#0b0d1a] border border-white/20 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.95),0_0_0_1px_rgba(255,255,255,0.08)] overflow-hidden ${dropdownClassName}`}
        >
          <div className="p-1 max-h-[220px] overflow-y-auto scrollbar-thin flex flex-col gap-0.5">
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer flex items-center justify-between gap-2 ${
                    isSelected
                      ? "bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/35 shadow-[0_0_10px_rgba(6,182,212,0.15)]"
                      : "text-neutral-200 hover:text-white hover:bg-white/10"
                  }`}
                  style={{
                    color: isSelected ? "#67e8f9" : "#e2e8f0",
                  }}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && (
                    <svg
                      className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default GlassSelect;
