import React from "react";
import Inspector from "../Inspector";

interface RightInspectorRailProps {
    open: boolean;
    onOpen: () => void;
    onClose: () => void;
}

const RightInspectorRail: React.FC<RightInspectorRailProps> = ({ open, onOpen, onClose }) => {
    return (
        <>
            {open && (
                <div className="w-64 flex-shrink-0 border-l border-[var(--ide-border)] bg-[var(--ide-bg-sidebar)] overflow-hidden">
                    <Inspector onClose={onClose} />
                </div>
            )}

            {!open && (
                <button
                    onClick={onOpen}
                    className="fixed right-4 top-1/2 -translate-y-1/2 z-30 p-2 rounded-lg bg-[var(--ide-bg-sidebar)] border border-[var(--ide-border)] shadow-lg hover:bg-[var(--ide-bg-elevated)] transition-colors"
                    title="Open right panel"
                >
                    <svg className="w-4 h-4 text-[var(--ide-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                    </svg>
                </button>
            )}
        </>
    );
};

export default RightInspectorRail;
