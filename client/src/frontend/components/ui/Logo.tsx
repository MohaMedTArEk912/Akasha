import React from "react";

interface LogoProps {
    className?: string;
    size?: number;
}

export const Logo: React.FC<LogoProps> = ({ className = "", size = 24 }) => {
    return (
        <span
            style={{ fontSize: `${Math.max(12, size * 0.7)}px` }}
            className={`font-black tracking-widest text-[var(--ide-accent)] select-none inline-flex items-center justify-center font-mono ${className}`}
        >
            AKASHA
        </span>
    );
};
