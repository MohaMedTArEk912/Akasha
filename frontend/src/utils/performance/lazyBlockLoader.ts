/**
 * Lazy Block Loading System
 * Dynamically loads block components and resources on demand
 */

interface BlockModule {
    component: React.ComponentType;
    styles?: string;
    dependencies?: string[];
}

type BlockLoader = () => Promise<BlockModule>;

interface LoadedBlock {
    module: BlockModule;
    loadedAt: number;
    usageCount: number;
}

export class LazyBlockLoader {
    private registry: Map<string, BlockLoader> = new Map();
    private loaded: Map<string, LoadedBlock> = new Map();
    private loading: Map<string, Promise<BlockModule>> = new Map();
    private maxCacheSize: number;
    private cacheTimeout: number; // ms

    constructor(options?: { maxCacheSize?: number; cacheTimeout?: number }) {
        this.maxCacheSize = options?.maxCacheSize || 50;
        this.cacheTimeout = options?.cacheTimeout || 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Register a block type with its loader function
     */
    register(blockType: string, loader: BlockLoader): void {
        this.registry.set(blockType, loader);
    }

    /**
     * Register multiple blocks at once
     */
    registerAll(blocks: Record<string, BlockLoader>): void {
        Object.entries(blocks).forEach(([type, loader]) => {
            this.register(type, loader);
        });
    }

    /**
     * Load a block by type (returns cached if available)
     */
    async load(blockType: string): Promise<BlockModule> {
        // Check cache first
        const cached = this.loaded.get(blockType);
        if (cached) {
            cached.usageCount++;
            return cached.module;
        }

        // Check if already loading
        const pending = this.loading.get(blockType);
        if (pending) {
            return pending;
        }

        // Get loader
        const loader = this.registry.get(blockType);
        if (!loader) {
            throw new Error(`Block type not registered: ${blockType}`);
        }

        // Start loading
        const loadPromise = loader().then((module) => {
            this.loading.delete(blockType);
            this.loaded.set(blockType, {
                module,
                loadedAt: Date.now(),
                usageCount: 1,
            });
            this.enforceCache();
            return module;
        });

        this.loading.set(blockType, loadPromise);
        return loadPromise;
    }

    /**
     * Preload multiple blocks
     */
    async preload(blockTypes: string[]): Promise<void> {
        await Promise.all(blockTypes.map((type) => this.load(type).catch(() => null)));
    }

    /**
     * Check if a block is loaded
     */
    isLoaded(blockType: string): boolean {
        return this.loaded.has(blockType);
    }

    /**
     * Get a loaded block synchronously (returns undefined if not loaded)
     */
    getSync(blockType: string): BlockModule | undefined {
        return this.loaded.get(blockType)?.module;
    }

    /**
     * Enforce cache size and timeout limits
     */
    private enforceCache(): void {
        const now = Date.now();

        // Remove expired entries
        this.loaded.forEach((block, type) => {
            if (now - block.loadedAt > this.cacheTimeout) {
                this.loaded.delete(type);
            }
        });

        // Enforce size limit (remove least used)
        if (this.loaded.size > this.maxCacheSize) {
            const entries = Array.from(this.loaded.entries())
                .sort((a, b) => a[1].usageCount - b[1].usageCount);

            const toRemove = entries.slice(0, this.loaded.size - this.maxCacheSize);
            toRemove.forEach(([type]) => this.loaded.delete(type));
        }
    }

    /**
     * Clear the cache
     */
    clearCache(): void {
        this.loaded.clear();
    }

    /**
     * Get cache stats
     */
    getStats(): { registered: number; loaded: number; loading: number } {
        return {
            registered: this.registry.size,
            loaded: this.loaded.size,
            loading: this.loading.size,
        };
    }
}

/**
 * Default block loaders using dynamic imports
 */
export const createBlockLoaders = (): Record<string, BlockLoader> => ({
    // Basic blocks
    'text': () => import('../../components/blocks/TextBlock').then((m) => ({ component: m.default })),
    'image': () => import('../../components/blocks/ImageBlock').then((m) => ({ component: m.default })),
    'button': () => import('../../components/blocks/ButtonBlock').then((m) => ({ component: m.default })),

    // Layout blocks
    'container': () => import('../../components/blocks/ContainerBlock').then((m) => ({ component: m.default })),
    'grid': () => import('../../components/blocks/GridBlock').then((m) => ({ component: m.default })),

    // Form blocks
    'form': () => import('../../components/blocks/FormBlock').then((m) => ({ component: m.default })),
    'input': () => import('../../components/blocks/InputBlock').then((m) => ({ component: m.default })),
});

// Singleton instance
export const blockLoader = new LazyBlockLoader();
