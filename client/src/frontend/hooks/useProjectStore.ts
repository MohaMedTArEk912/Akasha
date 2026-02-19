import { useSyncExternalStore } from "react";
import { subscribe, getSnapshot } from "../stores/projectStore";

/**
 * Custom hook to use the project store in React components.
 * 
 * Provides reactive access to the project state.
 */
export function useProjectStore() {
    const state = useSyncExternalStore(subscribe, getSnapshot);
    return state;
}
