import React from "react";

interface LogoProps {
    className?: string;
    size?: number;
}

export const Logo: React.FC<LogoProps> = ({ className = "", size = 24 }) => {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
        >
            {/* Rocket / Code Bracket A shape */}
            <path
                d="M12 3L4 18H8L10 14H14L16 18H20L12 3Z"
                fill="#3b82f6" // Electric blue fill
                fillOpacity="0.1"
                stroke="#3b82f6" // Electric blue stroke
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            {/* Inner Rocket Core */}
            <path
                d="M12 6L9 12H15L12 6Z"
                fill="#374151" // Dark grey
            />
            {/* Propulsion / Bracket base */}
            <path
                d="M7 21L12 18L17 21"
                stroke="#60a5fa" // Lighter blue accent
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
};
