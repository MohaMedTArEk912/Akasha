/**
 * useCraftSync — debounced backend sync for craft.js state.
 *
 * Subscribes to craft.js node changes and saves to the Rust backend
 * via Tauri IPC after an 800ms debounce. This prevents spamming the
 * backend on every pixel drag or keystroke.
 */

import { useEffect, useRef, useCallback } from "react";
import { useEditor } from "@craftjs/core";
import { useProjectStore } from "../../../hooks/useProjectStore";
import { serializedNodesToBlocks } from "./serialization";
import { api } from "../../../hooks/useApi";
import { BlockSchema } from "../../../types/api";

const DEBOUNCE_MS = 800;

export function useCraftSync(): void {
    const { query, store } = useEditor();
    const { selectedPageId, project } = useProjectStore();
    // const api = useApi(); // Static import
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastJsonRef = useRef<string>("");

    const page = project?.pages.find((p) => p.id === selectedPageId && !p.archived);
    const rootBlockId = page?.root_block_id;

    const save = useCallback(async () => {
        if (!selectedPageId || !rootBlockId) return;

        try {
            const serialized = query.getSerializedNodes();
            const json = JSON.stringify(serialized);

            // Skip if nothing changed
            if (json === lastJsonRef.current) return;
            lastJsonRef.current = json;

            const blocks = serializedNodesToBlocks(serialized, selectedPageId, rootBlockId);

            // Call unified API to bulk-update all blocks for this page
            await api.bulkSyncPageBlocks(
                project?.id || '', // ProjectID (optional for Tauri, used for HTTP if needed but backend handles it)
                selectedPageId,
                blocks as BlockSchema[] // Cast to shared type
            ).catch(async () => {
                // Fallback handled by API or here
                console.warn("[CraftSync] Sync failed");
            });
        } catch (err) {
            console.error("[CraftSync] save failed:", err);
        }
    }, [query, selectedPageId, rootBlockId]);

    // Subscribe to craft.js changes via store.subscribe with debounce
    useEffect(() => {
        const unsubscribe = (store as any).subscribe(
            (state: any) => state.nodes,
            () => {
                // Clear previous timer
                if (timerRef.current) clearTimeout(timerRef.current);

                // Set new debounced save
                timerRef.current = setTimeout(() => {
                    save();
                }, DEBOUNCE_MS);
            },
        );

        return () => {
            unsubscribe?.();
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [store, save]);

    // Save immediately when page changes (flush pending)
    useEffect(() => {
        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                // Flush on unmount / page change
                save();
            }
        };
    }, [selectedPageId, save]);
}

export default useCraftSync;
