/**
 * useCanvasViewport — centralized zoom and scroll state for the canvas.
 *
 * Provides zoom level, scroll tracking (for rulers), and handlers
 * for Ctrl+wheel zoom and scroll sync.
 */

import { useState, useCallback, useRef } from "react";

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.1;

export interface CanvasViewport {
    zoom: number;
    scrollLeft: number;
    scrollTop: number;
    scrollRef: React.RefObject<HTMLDivElement | null>;
    zoomIn: () => void;
    zoomOut: () => void;
    zoomReset: () => void;
    setZoom: (z: number) => void;
    onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
    onWheel: (e: React.WheelEvent<HTMLDivElement>) => void;
}

export function useCanvasViewport(): CanvasViewport {
    const [zoom, setZoomState] = useState(1);
    const [scrollLeft, setScrollLeft] = useState(0);
    const [scrollTop, setScrollTop] = useState(0);
    const scrollRef = useRef<HTMLDivElement | null>(null);

    const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

    const setZoom = useCallback((z: number) => {
        setZoomState(clampZoom(z));
    }, []);

    const zoomIn = useCallback(() => {
        setZoomState((prev) => clampZoom(prev + ZOOM_STEP));
    }, []);

    const zoomOut = useCallback(() => {
        setZoomState((prev) => clampZoom(prev - ZOOM_STEP));
    }, []);

    const zoomReset = useCallback(() => {
        setZoomState(1);
    }, []);

    const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const el = e.currentTarget;
        setScrollLeft(el.scrollLeft);
        setScrollTop(el.scrollTop);
    }, []);

    const onWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
            setZoomState((prev) => clampZoom(prev + delta));
        }
    }, []);

    return {
        zoom,
        scrollLeft,
        scrollTop,
        scrollRef,
        zoomIn,
        zoomOut,
        zoomReset,
        setZoom,
        onScroll,
        onWheel,
    };
}

export default useCanvasViewport;
