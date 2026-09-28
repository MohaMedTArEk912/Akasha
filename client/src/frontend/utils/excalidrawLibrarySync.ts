/**
 * excalidrawLibrarySync — Cross-tab & URL hash synchronization for Excalidraw libraries
 *
 * Handles:
 * 1. Listening to `#addLibrary=<url>` from libraries.excalidraw.com
 * 2. Fetching and normalizing `.excalidrawlib` / JSON library files
 * 3. Persisting libraries across all diagrams and sessions in localStorage
 * 4. Broadcasting across tabs via BroadcastChannel & window.opener
 * 5. Returning the user smoothly to the diagrams page
 */

import { openProject, setActivePage } from "../stores/projectStore";

export const GLOBAL_LIBRARY_STORAGE_KEY = "akasha_global_excalidraw_library";
const BROADCAST_CHANNEL_NAME = "akasha_excalidraw_library_channel";
const SESSION_PROJECT_ID_KEY = "akasha_active_project_id";

export interface NormalizedLibraryItem {
  id: string;
  status: "published" | "unpublished";
  elements: any[];
}

/**
 * Normalizes any format of Excalidraw library into standard array of items
 */
export function normalizeLibraryData(data: any): NormalizedLibraryItem[] {
  let rawItems: any[] = [];

  if (Array.isArray(data)) {
    rawItems = data;
  } else if (data && Array.isArray(data.libraryItems)) {
    rawItems = data.libraryItems;
  } else if (data && Array.isArray(data.library)) {
    rawItems = data.library;
  } else if (data && typeof data === "object") {
    // Attempt to extract any array property that contains element collections
    for (const key of Object.keys(data)) {
      if (Array.isArray(data[key]) && data[key].length > 0) {
        rawItems = data[key];
        break;
      }
    }
  }

  const normalized: NormalizedLibraryItem[] = [];

  rawItems.forEach((item, idx) => {
    const uniqueId = `imported-lib-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`;
    if (Array.isArray(item)) {
      normalized.push({
        id: uniqueId,
        status: "published",
        elements: item,
      });
    } else if (item && typeof item === "object") {
      normalized.push({
        id: item.id || uniqueId,
        status: item.status || "published",
        elements: Array.isArray(item.elements) ? item.elements : [],
      });
    }
  });

  return normalized;
}

/**
 * Loads all globally saved user library items
 */
export function loadGlobalLibraryItems(): NormalizedLibraryItem[] {
  try {
    const raw = localStorage.getItem(GLOBAL_LIBRARY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Saves and merges items into global library storage
 */
export function saveGlobalLibraryItems(newItems: NormalizedLibraryItem[]): NormalizedLibraryItem[] {
  try {
    const existing = loadGlobalLibraryItems();
    const existingIds = new Set(existing.map((it) => it.id));
    const merged = [...existing, ...newItems.filter((it) => !existingIds.has(it.id))];
    localStorage.setItem(GLOBAL_LIBRARY_STORAGE_KEY, JSON.stringify(merged));
    return merged;
  } catch {
    return newItems;
  }
}

/**
 * Fetches an .excalidrawlib file from a URL and installs it into local storage and Excalidraw
 */
export async function installLibraryFromUrl(libraryUrl: string): Promise<NormalizedLibraryItem[]> {
  try {
    const response = await fetch(libraryUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} fetching library`);
    }

    const data = await response.json();
    const normalized = normalizeLibraryData(data);

    if (normalized.length === 0) {
      throw new Error("No library items found in file");
    }

    const merged = saveGlobalLibraryItems(normalized);

    // Broadcast to all other open tabs
    try {
      const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      channel.postMessage({
        type: "EXCALIDRAW_LIBRARY_IMPORTED",
        items: merged,
        newCount: normalized.length,
      });
      channel.close();
    } catch {}

    // Dispatch DOM event for current page listeners
    window.dispatchEvent(
      new CustomEvent("akasha:library-imported", {
        detail: { items: merged, newCount: normalized.length },
      })
    );

    return merged;
  } catch (err) {
    console.error("Failed to install Excalidraw library:", err);
    throw err;
  }
}

/**
 * Checks URL hash or search params for #addLibrary=<url>
 * Returns the library URL if present, or null.
 */
export function extractAddLibraryUrl(): string | null {
  const hash = window.location.hash || "";
  const search = window.location.search || "";

  // Check hash first: #addLibrary=https://...
  if (hash.includes("addLibrary=")) {
    const queryPart = hash.startsWith("#") ? hash.slice(1) : hash;
    const params = new URLSearchParams(queryPart);
    const url = params.get("addLibrary");
    if (url) return url;
  }

  // Check search params: ?addLibrary=https://...
  if (search.includes("addLibrary=")) {
    const params = new URLSearchParams(search);
    const url = params.get("addLibrary");
    if (url) return url;
  }

  return null;
}

/**
 * Global handler for #addLibrary= URL triggers.
 * Automatically fetches the library, notifies existing tabs or opener, and returns the user to DiagramsPage.
 */
export async function handleAddLibraryFromUrlIfPresent(): Promise<boolean> {
  const libraryUrl = extractAddLibraryUrl();
  if (!libraryUrl) return false;

  try {
    // 1. Fetch & persist library
    const merged = await installLibraryFromUrl(libraryUrl);

    // 2. Clean hash & search from URL
    try {
      const cleanUrl = window.location.pathname;
      window.history.replaceState(null, "", cleanUrl);
    } catch {}

    // 3. If opened as a popup or new tab from another window, notify opener and close
    if (window.opener && window.opener !== window) {
      try {
        window.opener.postMessage(
          {
            type: "EXCALIDRAW_LIBRARY_IMPORTED",
            items: merged,
          },
          "*"
        );
        window.opener.focus();
        window.close();
        return true;
      } catch (openerErr) {
        console.warn("Could not postMessage/close to opener:", openerErr);
      }
    }

    // 4. Return user to the Diagrams page in the current window
    const savedProjectId =
      sessionStorage.getItem(SESSION_PROJECT_ID_KEY) ||
      localStorage.getItem(SESSION_PROJECT_ID_KEY);

    if (savedProjectId) {
      await openProject(savedProjectId);
    }

    setActivePage("diagrams");
    return true;
  } catch (err) {
    console.error("Error processing addLibrary parameter:", err);
    return false;
  }
}

/**
 * Registers listeners for incoming library synchronization across tabs
 */
export function subscribeToLibrarySync(
  onLibraryReceived: (items: NormalizedLibraryItem[]) => void
): () => void {
  // 1. BroadcastChannel listener
  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    channel.onmessage = (event) => {
      if (event.data?.type === "EXCALIDRAW_LIBRARY_IMPORTED" && Array.isArray(event.data.items)) {
        onLibraryReceived(event.data.items);
      }
    };
  } catch {}

  // 2. Window postMessage listener (for opener communication)
  const onMessage = (event: MessageEvent) => {
    if (event.data?.type === "EXCALIDRAW_LIBRARY_IMPORTED" && Array.isArray(event.data.items)) {
      onLibraryReceived(event.data.items);
    }
  };
  window.addEventListener("message", onMessage);

  // 3. Custom DOM event listener
  const onCustomEvent = (event: Event) => {
    const detail = (event as CustomEvent).detail;
    if (detail?.items && Array.isArray(detail.items)) {
      onLibraryReceived(detail.items);
    }
  };
  window.addEventListener("akasha:library-imported", onCustomEvent);

  // 4. Window hashchange listener (in case user gets redirected in the same window)
  const onHashChange = () => {
    void handleAddLibraryFromUrlIfPresent();
  };
  window.addEventListener("hashchange", onHashChange);

  return () => {
    if (channel) channel.close();
    window.removeEventListener("message", onMessage);
    window.removeEventListener("akasha:library-imported", onCustomEvent);
    window.removeEventListener("hashchange", onHashChange);
  };
}
