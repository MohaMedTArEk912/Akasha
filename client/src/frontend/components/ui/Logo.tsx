import React from "react";

interface LogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
}

export const Logo: React.FC<LogoProps> = ({
  className = "",
  size = 28,
  showText = true,
}) => {
  return (
    <span className={`inline-flex items-center gap-2 select-none ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        <defs>
          <linearGradient id="logo-cobalt" x1="8" y1="4" x2="56" y2="60" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#2E6BFF" />
            <stop offset="100%" stopColor="#1347D6" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="60" height="60" rx="16" fill="url(#logo-cobalt)" />
        <path
          d="M32 14.5L17.5 48H24.6L27.55 40.6H36.45L39.4 48H46.5L32 14.5ZM29.75 34.9L32 28.95L34.25 34.9H29.75Z"
          fill="#FFFFFF"
        />
        <rect x="25.5" y="45" width="13" height="3" rx="1.5" fill="#93C5FD" />
      </svg>
      {showText && (
        <span
          style={{ fontSize: `${Math.max(14, size * 0.56)}px` }}
          className="font-extrabold tracking-tight text-[var(--ide-text)]"
        >
          Akasha
        </span>
      )}
    </span>
  );
};
