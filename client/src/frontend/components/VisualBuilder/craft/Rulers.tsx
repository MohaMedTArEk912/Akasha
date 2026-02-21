/**
 * Rulers — horizontal and vertical rulers around the canvas.
 *
 * Uses @scena/react-ruler to render pixel rulers that sync
 * with the canvas scroll and zoom level.
 */

import React from "react";
import Ruler from "@scena/react-ruler";

interface RulersProps {
    zoom: number;
    scrollLeft: number;
    scrollTop: number;
}

export const Rulers: React.FC<RulersProps> = ({ zoom = 1, scrollLeft = 0, scrollTop = 0 }) => (
    <>
        {/* Horizontal ruler — top edge */}
        <Ruler
            type="horizontal"
            zoom={zoom}
            scrollPos={scrollLeft}
            style={{
                position: "absolute",
                top: 0,
                left: 24,
                right: 0,
                height: 24,
                zIndex: 10,
            }}
            backgroundColor="var(--ide-chrome, #252526)"
            lineColor="rgba(99, 102, 241, 0.15)"
            textColor="var(--ide-text-muted, #6b7280)"
            unit={50}
        />

        {/* Vertical ruler — left edge */}
        <Ruler
            type="vertical"
            zoom={zoom}
            scrollPos={scrollTop}
            style={{
                position: "absolute",
                top: 24,
                left: 0,
                bottom: 0,
                width: 24,
                zIndex: 10,
            }}
            backgroundColor="var(--ide-chrome, #252526)"
            lineColor="rgba(99, 102, 241, 0.15)"
            textColor="var(--ide-text-muted, #6b7280)"
            unit={50}
        />

        {/* Corner square (top-left) */}
        <div
            style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: 24,
                height: 24,
                background: "var(--ide-chrome, #252526)",
                borderRight: "1px solid var(--ide-border, rgba(255,255,255,0.05))",
                borderBottom: "1px solid var(--ide-border, rgba(255,255,255,0.05))",
                zIndex: 11,
            }}
        />
    </>
);

export default Rulers;
