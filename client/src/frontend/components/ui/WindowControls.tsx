import React, { useState } from "react";


interface WindowControlsProps {
    className?: string;
}

/**
 * Premium Window Controls - macOS Traffic Light Style
 * 
 * Optimized for Tauri v2 with proper permissions.
 */
const WindowControls: React.FC<WindowControlsProps> = ({ className = "" }) => {
    const [isMaximized] = useState(false);
    const [isHovering, setIsHovering] = useState(false);
    // Removed Tauri window event listeners

    const handleMinimize = async () => {
        console.warn("Window controls not available in web mode");
    };

    const handleToggleMaximize = async () => {
        console.warn("Window controls not available in web mode");
    };

    const handleClose = async () => {
        console.warn("Window controls not available in web mode");
    };

    return (
        <div
            className={`flex items-center gap-2.5 px-2 ${className}`}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
        >
            {/* Close Button - Red */}
            <button
                onClick={handleClose}
                className="group relative w-3.5 h-3.5 rounded-full bg-[#ff5f57] flex items-center justify-center transition-all hover:bg-[#ff3b30] active:scale-90 shadow-sm border border-black/10"
                title="Close"
                aria-label="Close window"
            >
                <svg
                    className={`w-2 h-2 text-[#4a0002] transition-opacity duration-150 ${isHovering ? 'opacity-100' : 'opacity-0'}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth="4"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>

            {/* Minimize Button - Yellow */}
            <button
                onClick={handleMinimize}
                className="group relative w-3.5 h-3.5 rounded-full bg-[#febc2e] flex items-center justify-center transition-all hover:bg-[#f5a623] active:scale-90 shadow-sm border border-black/10"
                title="Minimize"
                aria-label="Minimize window"
            >
                <svg
                    className={`w-2 h-2 text-[#995700] transition-opacity duration-150 ${isHovering ? 'opacity-100' : 'opacity-0'}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth="4"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
                </svg>
            </button>

            {/* Maximize/Restore Button - Green */}
            <button
                onClick={handleToggleMaximize}
                className="group relative w-3.5 h-3.5 rounded-full bg-[#28c840] flex items-center justify-center transition-all hover:bg-[#1db954] active:scale-90 shadow-sm border border-black/10"
                title={isMaximized ? "Restore" : "Maximize"}
                aria-label={isMaximized ? "Restore window" : "Maximize window"}
            >
                {isMaximized ? (
                    /* Restore Icon - Double Square */
                    <svg
                        className={`w-2 h-2 text-[#006500] transition-opacity duration-150 ${isHovering ? 'opacity-100' : 'opacity-0'}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        strokeWidth="4"
                    >
                        <rect x="4" y="8" width="12" height="12" rx="1" />
                        <path d="M8 8V4a1 1 0 011-1h12a1 1 0 011 1v12a1 1 0 01-1 1h-4" opacity="0.6" />
                    </svg>
                ) : (
                    /* Maximize/Plus Icon */
                    <svg
                        className={`w-2 h-2 text-[#006500] transition-opacity duration-150 ${isHovering ? 'opacity-100' : 'opacity-0'}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        strokeWidth="5"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                )}
            </button>
        </div>
    );
};

export default WindowControls;
