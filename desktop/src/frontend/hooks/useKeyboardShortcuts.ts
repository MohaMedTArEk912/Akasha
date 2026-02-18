/**
 * Global Keyboard Shortcuts Hook
 * 
 * Centralizes all IDE keyboard shortcuts. Attach once at the App level.
 * 
 * Shortcuts:
 *   Ctrl+S          — Save / Sync to disk
 *   Ctrl+G          — Generate all code
 *   Ctrl+1..5       — Switch tabs (Canvas, Logic, API, ERD, Variables)
 *   Ctrl+\          — Toggle sidebar
 *   Delete/Backspace — Delete selected block (when not in an input)
 *   Escape          — Deselect block
 */

import { useEffect } from "react";
import {
    syncToDisk,
    generateFrontend,
    generateBackend,
    generateDatabase,
    setActivePage,
    archiveBlock,
    selectBlock,
} from "../stores/projectStore";
import type { FeaturePage } from "../stores/projectStore";
import { useProjectStore } from "./useProjectStore";

const PAGES: FeaturePage[] = ["ui", "usecases", "apis", "database", "diagrams", "code", "git"];

export function useKeyboardShortcuts() {
    const { selectedBlockId, project } = useProjectStore();

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            const ctrl = e.ctrlKey || e.metaKey;
            const target = e.target as HTMLElement;
            const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable;

            // Ctrl+S — Save
            if (ctrl && e.key === "s") {
                e.preventDefault();
                if (project) {
                    syncToDisk().catch(console.error);
                }
                return;
            }

            // Ctrl+G — Generate
            if (ctrl && e.key === "g") {
                e.preventDefault();
                if (project) {
                    Promise.all([generateFrontend(), generateBackend(), generateDatabase()]).catch(console.error);
                }
                return;
            }

            // Ctrl+\ — Toggle sidebar (dispatches custom event)
            if (ctrl && e.key === "\\") {
                e.preventDefault();
                window.dispatchEvent(new CustomEvent("akasha:toggle-sidebar"));
                return;
            }

            // Ctrl+0 — Dashboard
            if (ctrl && e.key === "0") {
                e.preventDefault();
                setActivePage("dashboard");
                return;
            }

            // Ctrl+1..7 — Switch feature pages
            if (ctrl && e.key >= "1" && e.key <= "7") {
                e.preventDefault();
                const idx = parseInt(e.key) - 1;
                if (idx < PAGES.length) {
                    setActivePage(PAGES[idx]);
                }
                return;
            }

            // Escape — Deselect
            if (e.key === "Escape" && !isInput) {
                selectBlock(null);
                return;
            }

            // Delete — Delete selected block
            if ((e.key === "Delete" || e.key === "Backspace") && !isInput && selectedBlockId) {
                e.preventDefault();
                archiveBlock(selectedBlockId).catch(console.error);
                return;
            }
        };

        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [selectedBlockId, project]);
}
