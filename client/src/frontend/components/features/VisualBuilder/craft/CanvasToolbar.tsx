/**
 * CanvasToolbar — undo/redo controls + zoom for the craft.js canvas.
 *
 * Sits in the viewport bar area and provides:
 * - Undo / Redo buttons (using craft.js history)
 * - Zoom in / out / reset controls
 */

import React from "react";
import { useEditor } from "@craftjs/core";

interface CanvasToolbarProps {
    zoom: number;
    onZoomChange: (zoom: number) => void;
}

export const CanvasToolbar: React.FC<CanvasToolbarProps> = ({ zoom, onZoomChange }) => {
    const { actions, canUndo, canRedo } = useEditor((_state, query) => ({
        canUndo: query.history.canUndo(),
        canRedo: query.history.canRedo(),
    }));

    const zoomIn = () => onZoomChange(Math.min(zoom + 0.1, 3));
    const zoomOut = () => onZoomChange(Math.max(zoom - 0.1, 0.25));
    const zoomReset = () => onZoomChange(1);

    return (
        <div className="flex items-center gap-1 bg-black/10 rounded-lg p-1 border border-white/5">
            {/* Undo */}
            <button
                disabled={!canUndo}
                onClick={() => actions.history.undo()}
                className={`p-1 rounded-md transition-all ${canUndo
                        ? "text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-white/10 hover:shadow-sm"
                        : "text-[var(--ide-text-muted)] opacity-30 cursor-not-allowed"
                    }`}
                title="Undo (Ctrl+Z)"
            >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
            </button>

            {/* Redo */}
            <button
                disabled={!canRedo}
                onClick={() => actions.history.redo()}
                className={`p-1 rounded-md transition-all ${canRedo
                        ? "text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-white/10 hover:shadow-sm"
                        : "text-[var(--ide-text-muted)] opacity-30 cursor-not-allowed"
                    }`}
                title="Redo (Ctrl+Y)"
            >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 10H11a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
                </svg>
            </button>

            {/* Separator */}
            <div className="w-px h-3.5 bg-white/10 mx-1" />

            {/* Zoom Out */}
            <button
                onClick={zoomOut}
                className="p-1 text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-white/10 rounded-md transition-all"
                title="Zoom Out"
            >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" />
                </svg>
            </button>

            {/* Zoom Level */}
            <button
                onClick={zoomReset}
                className="px-2 py-0.5 min-w-[3rem] text-center text-[10px] font-bold text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-white/10 rounded-md transition-all tabular-nums"
                title="Reset Zoom"
            >
                {Math.round(zoom * 100)}%
            </button>

            {/* Zoom In */}
            <button
                onClick={zoomIn}
                className="p-1 text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-white/10 rounded-md transition-all"
                title="Zoom In"
            >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
            </button>
        </div>
    );
};

export default CanvasToolbar;
