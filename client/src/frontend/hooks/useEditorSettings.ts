/**
 * Hook to use editor settings in React components
 */

import { useSyncExternalStore } from "react";
import * as EditorSettingsStore from "../stores/editorSettingsStore";
import type { EditorSettings } from "../stores/editorSettingsStore";

export function useEditorSettings(): EditorSettings {
    return useSyncExternalStore(
        EditorSettingsStore.subscribe,
        EditorSettingsStore.getSnapshot
    );
}
