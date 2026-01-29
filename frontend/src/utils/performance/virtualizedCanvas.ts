/**
 * Virtualized Canvas Utilities
 * Manages viewport-based rendering for large component trees
 */

interface VirtualizedItem {
    id: string;
    top: number;
    height: number;
    visible: boolean;
}

interface ViewportState {
    scrollTop: number;
    viewportHeight: number;
    buffer: number; // Extra items to render above/below viewport
}

export class VirtualizedCanvas {
    private items: Map<string, VirtualizedItem> = new Map();
    private viewport: ViewportState = {
        scrollTop: 0,
        viewportHeight: 800,
        buffer: 200,
    };
    private onVisibilityChange?: (visibleIds: string[]) => void;

    constructor(options?: { buffer?: number; onVisibilityChange?: (ids: string[]) => void }) {
        this.viewport.buffer = options?.buffer || 200;
        this.onVisibilityChange = options?.onVisibilityChange;
    }

    /**
     * Register a component in the virtualized system
     */
    registerComponent(id: string, top: number, height: number): void {
        this.items.set(id, { id, top, height, visible: false });
        this.updateVisibility();
    }

    /**
     * Unregister a component
     */
    unregisterComponent(id: string): void {
        this.items.delete(id);
    }

    /**
     * Update viewport scroll position
     */
    updateScroll(scrollTop: number): void {
        this.viewport.scrollTop = scrollTop;
        this.updateVisibility();
    }

    /**
     * Update viewport dimensions
     */
    updateViewportSize(height: number): void {
        this.viewport.viewportHeight = height;
        this.updateVisibility();
    }

    /**
     * Calculate which items should be visible
     */
    private updateVisibility(): void {
        const { scrollTop, viewportHeight, buffer } = this.viewport;
        const visibleTop = scrollTop - buffer;
        const visibleBottom = scrollTop + viewportHeight + buffer;

        const visibleIds: string[] = [];

        this.items.forEach((item) => {
            const itemBottom = item.top + item.height;
            const isVisible = item.top < visibleBottom && itemBottom > visibleTop;

            if (isVisible !== item.visible) {
                item.visible = isVisible;
            }

            if (isVisible) {
                visibleIds.push(item.id);
            }
        });

        if (this.onVisibilityChange) {
            this.onVisibilityChange(visibleIds);
        }
    }

    /**
     * Get all currently visible item IDs
     */
    getVisibleItems(): string[] {
        return Array.from(this.items.values())
            .filter((item) => item.visible)
            .map((item) => item.id);
    }

    /**
     * Clear all registered items
     */
    clear(): void {
        this.items.clear();
    }
}

/**
 * Intersection Observer based visibility tracking
 * More performant for real DOM elements
 */
export class IntersectionVisibilityTracker {
    private observer: IntersectionObserver;
    private visibleElements: Set<string> = new Set();
    private callbacks: Map<string, (visible: boolean) => void> = new Map();

    constructor(options?: IntersectionObserverInit) {
        this.observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    const id = entry.target.getAttribute('data-component-id');
                    if (!id) return;

                    if (entry.isIntersecting) {
                        this.visibleElements.add(id);
                    } else {
                        this.visibleElements.delete(id);
                    }

                    const callback = this.callbacks.get(id);
                    if (callback) {
                        callback(entry.isIntersecting);
                    }
                });
            },
            {
                root: options?.root || null,
                rootMargin: options?.rootMargin || '100px',
                threshold: options?.threshold || 0,
            }
        );
    }

    /**
     * Start observing an element
     */
    observe(element: Element, callback?: (visible: boolean) => void): void {
        const id = element.getAttribute('data-component-id');
        if (id && callback) {
            this.callbacks.set(id, callback);
        }
        this.observer.observe(element);
    }

    /**
     * Stop observing an element
     */
    unobserve(element: Element): void {
        const id = element.getAttribute('data-component-id');
        if (id) {
            this.callbacks.delete(id);
            this.visibleElements.delete(id);
        }
        this.observer.unobserve(element);
    }

    /**
     * Get all visible element IDs
     */
    getVisibleIds(): string[] {
        return Array.from(this.visibleElements);
    }

    /**
     * Cleanup
     */
    disconnect(): void {
        this.observer.disconnect();
        this.callbacks.clear();
        this.visibleElements.clear();
    }
}
