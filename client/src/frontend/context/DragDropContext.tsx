/**
 * DragDropContext – Custom pointer-based drag-and-drop system
 *
 * This replaces the unreliable HTML5 Drag-and-Drop API which doesn't work
 * properly in Tauri's WebView2 on Windows. Uses mousedown/mousemove/mouseup
 * events which are universally supported.
 */

import React, {
    createContext,
    useContext,
    useState,
    useCallback,
    useRef,
    useEffect,
} from "react";

/* ═══════════════════  Types  ═══════════════════════ */

export interface DragPayload {
    /** Block type to create (e.g. "container", "heading", "button") */
    type: string;
    /** Component ID for instances */
    componentId?: string;
    /** If moving an existing block, its ID */
    moveId?: string;
    /** Display label for the ghost */
    label: string;
}

interface DragDropState {
    /** Whether a drag is actively in progress (mouse moved past threshold) */
    isDragging: boolean;
    /** Current drag payload */
    payload: DragPayload | null;
    /** Current mouse position */
    mouseX: number;
    mouseY: number;
    /** Whether the drag actually moved (vs was just a click) */
    didMove: boolean;
}

interface DragDropContextValue extends DragDropState {
    /**
     * Prepare a drag. Call from onMouseDown.
     * The drag doesn't become "active" until the mouse moves past a threshold.
     * Returns false if the drag was consumed as a click on mouseup.
     */
    prepareDrag: (payload: DragPayload, e: React.MouseEvent) => void;
    /** Cancel the drag */
    cancelDrag: () => void;
}

const DragDropCtx = createContext<DragDropContextValue>({
    isDragging: false,
    payload: null,
    mouseX: 0,
    mouseY: 0,
    didMove: false,
    prepareDrag: () => {},
    cancelDrag: () => {},
});

export const useDragDrop = () => useContext(DragDropCtx);

/* ═══════════════════  Provider  ════════════════════ */

const DRAG_THRESHOLD = 6; // pixels before a mousedown becomes a drag

export const DragDropProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, setState] = useState<DragDropState>({
        isDragging: false,
        payload: null,
        mouseX: 0,
        mouseY: 0,
        didMove: false,
    });

    const stateRef = useRef(state);
    stateRef.current = state;

    // Track the pending drag (mousedown but not yet past threshold)
    const pendingRef = useRef<{
        payload: DragPayload;
        startX: number;
        startY: number;
    } | null>(null);

    const prepareDrag = useCallback((payload: DragPayload, e: React.MouseEvent) => {
        // Don't prevent default here — allow text selection etc. initially
        pendingRef.current = {
            payload,
            startX: e.clientX,
            startY: e.clientY,
        };
    }, []);

    const cancelDrag = useCallback(() => {
        pendingRef.current = null;
        setState({
            isDragging: false,
            payload: null,
            mouseX: 0,
            mouseY: 0,
            didMove: false,
        });
    }, []);

    // Global mouse listeners for tracking + dropping
    useEffect(() => {
        const onMouseMove = (e: MouseEvent) => {
            // If we have a pending drag that hasn't activated yet, check threshold
            if (pendingRef.current && !stateRef.current.isDragging) {
                const dx = e.clientX - pendingRef.current.startX;
                const dy = e.clientY - pendingRef.current.startY;
                if (Math.abs(dx) + Math.abs(dy) >= DRAG_THRESHOLD) {
                    // Activate the drag!
                    setState({
                        isDragging: true,
                        payload: pendingRef.current.payload,
                        mouseX: e.clientX,
                        mouseY: e.clientY,
                        didMove: true,
                    });
                }
                return;
            }

            // Active drag: track mouse
            if (stateRef.current.isDragging) {
                setState(prev => ({ ...prev, mouseX: e.clientX, mouseY: e.clientY }));
            }
        };

        const onMouseUp = (e: MouseEvent) => {
            // If we had a pending drag that never activated (click, not drag)
            if (pendingRef.current && !stateRef.current.isDragging) {
                // This was a click — fire a custom "palette-click" event
                const evt = new CustomEvent("akasha-palette-click", {
                    detail: { payload: pendingRef.current.payload },
                });
                document.dispatchEvent(evt);
                pendingRef.current = null;
                return;
            }

            if (!stateRef.current.isDragging) return;

            // Active drag → fire drop event
            const evt = new CustomEvent("akasha-pointer-drop", {
                detail: {
                    payload: stateRef.current.payload,
                    x: e.clientX,
                    y: e.clientY,
                },
            });
            document.dispatchEvent(evt);

            pendingRef.current = null;
            setState({
                isDragging: false,
                payload: null,
                mouseX: 0,
                mouseY: 0,
                didMove: false,
            });
        };

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                pendingRef.current = null;
                if (stateRef.current.isDragging) {
                    cancelDrag();
                }
            }
        };

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [cancelDrag]);

    return (
        <DragDropCtx.Provider value={{ ...state, prepareDrag, cancelDrag }}>
            {children}

            {/* ── Floating ghost label ── */}
            {state.isDragging && state.payload && (
                <div
                    className="px-3 py-1.5 rounded-lg text-xs font-bold shadow-2xl text-white"
                    style={{
                        position: "fixed",
                        left: state.mouseX + 12,
                        top: state.mouseY - 10,
                        zIndex: 99999,
                        pointerEvents: "none",
                        background: "linear-gradient(135deg, #6366f1, #818cf8)",
                    }}
                >
                    {state.payload.label}
                </div>
            )}
        </DragDropCtx.Provider>
    );
};
