import React, { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

interface WindowControlsProps {
    className?: string;
}

/**
 * Premium Window Controls - macOS Traffic Light Style
 * 
 * Optimized for Tauri v2 with proper permissions.
 */
const WindowControls: React.FC<WindowControlsProps> = ({ className = "" }) => {
    const [isMaximized, setIsMaximized] = useState(false);
    const [isHovering, setIsHovering] = useState(false);
    const [isTauri, setIsTauri] = useState(false);

    useEffect(() => {
        let unlistenRes: (() => void) | undefined;
        let unlistenMove: (() => void) | undefined;

        // Detect if we are running in Tauri
        const checkTauri = async () => {
            try {
                const win = getCurrentWindow();
                const maximized = await win.isMaximized();
                const fullscreen = await win.isFullscreen();
                setIsMaximized(maximized || fullscreen);
                setIsTauri(true);

                // Listen for window scale/resize/move to update state robustly
                unlistenRes = await win.onResized(async () => {
                    const m = await win.isMaximized();
                    const f = await win.isFullscreen();
                    setIsMaximized(m || f);
                });

                unlistenMove = await win.onMoved(async () => {
                    const m = await win.isMaximized();
                    const f = await win.isFullscreen();
                    setIsMaximized(m || f);
                });
            } catch (e) {
                console.warn("WindowControls: Not running in Tauri environment");
                setIsTauri(false);
            }
        };

        void checkTauri();

        return () => {
            if (unlistenRes) unlistenRes();
            if (unlistenMove) unlistenMove();
        };
    }, []);

    const handleMinimize = async () => {
        if (!isTauri) return;
        try {
            await getCurrentWindow().minimize();
        } catch (err) {
            console.error("WindowControls: Failed to minimize:", err);
        }
    };

    const handleToggleMaximize = async () => {
        if (!isTauri) return;
        try {
            const win = getCurrentWindow();
            const maximized = await win.isMaximized();
            const fullscreen = await win.isFullscreen();

            if (maximized || fullscreen) {
                // To be safe, we disable fullscreen and unmaximize
                await win.setFullscreen(false);
                await win.unmaximize();
                setIsMaximized(false);
            } else {
                await win.maximize();
                setIsMaximized(true);
            }

            // Deferred re-sync to catch OS-level changes
            setTimeout(async () => {
                const nowMaximized = await win.isMaximized();
                const nowFullscreen = await win.isFullscreen();
                setIsMaximized(nowMaximized || nowFullscreen);
            }, 200);
        } catch (err) {
            console.error("WindowControls: Failed to toggle maximize:", err);
            // Fallback to simple toggle if granular calls fail
            try {
                const win = getCurrentWindow();
                await win.toggleMaximize();
            } catch (e) {
                console.error("WindowControls: Fallback toggle also failed", e);
            }
        }
    };

    const handleClose = async () => {
        if (!isTauri) {
            window.close();
            return;
        }
        try {
            await getCurrentWindow().close();
        } catch (err) {
            console.error("WindowControls: Failed to close:", err);
            window.close();
        }
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
