import React, { useState } from "react";


interface WindowControlsProps {
    className?: string;
}

/**
 * Decorative header controls styled like macOS traffic lights.
 * The buttons stay inert in the web app.
 */
const WindowControls: React.FC<WindowControlsProps> = ({ className = "" }) => {
    const [isMaximized] = useState(false);
    const [isHovering, setIsHovering] = useState(false);

    const handleMinimize = async () => {
        console.warn("Window controls are not available in the web app");
    };

    const handleToggleMaximize = async () => {
        console.warn("Window controls are not available in the web app");
    };

    const handleClose = async () => {
        console.warn("Window controls are not available in the web app");
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
                className="group relative w-3.5 h-3.5 rounded-full bg-[#ff5f57] flex items-center justify-center transition-all hover:bg-[#ff3b30] active:scale-90 shadow-sm border border-black/10 leading-none"
                title="Close"
                aria-label="Close window"
            >
                <span className={`text-[8px] font-black text-[#4a0002] transition-opacity duration-150 select-none ${isHovering ? 'opacity-100' : 'opacity-0'}`}>✕</span>
            </button>

            {/* Minimize Button - Yellow */}
            <button
                onClick={handleMinimize}
                className="group relative w-3.5 h-3.5 rounded-full bg-[#febc2e] flex items-center justify-center transition-all hover:bg-[#f5a623] active:scale-90 shadow-sm border border-black/10 leading-none"
                title="Minimize"
                aria-label="Minimize window"
            >
                <span className={`text-[9px] font-black text-[#995700] transition-opacity duration-150 select-none ${isHovering ? 'opacity-100' : 'opacity-0'}`}>-</span>
            </button>

            {/* Maximize/Restore Button - Green */}
            <button
                onClick={handleToggleMaximize}
                className="group relative w-3.5 h-3.5 rounded-full bg-[#28c840] flex items-center justify-center transition-all hover:bg-[#1db954] active:scale-90 shadow-sm border border-black/10 leading-none"
                title={isMaximized ? "Restore" : "Maximize"}
                aria-label={isMaximized ? "Restore window" : "Maximize window"}
            >
                <span className={`text-[8px] font-black text-[#006500] transition-opacity duration-150 select-none ${isHovering ? 'opacity-100' : 'opacity-0'}`}>+</span>
            </button>
        </div>
    );
};

export default WindowControls;
