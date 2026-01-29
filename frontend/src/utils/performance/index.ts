/**
 * Performance Utilities Index
 * Re-exports all performance optimization modules
 */

export { VirtualizedCanvas, IntersectionVisibilityTracker } from './virtualizedCanvas';
export { WorkerManager, WORKER_SCRIPT_TEMPLATE } from './workerManager';
export { LazyBlockLoader, blockLoader, createBlockLoaders } from './lazyBlockLoader';
export {
    MemoryCache,
    SessionCache,
    PersistentCache,
    TieredCache,
    memoryCache,
    sessionCache,
    persistentCache,
    tieredCache,
} from './cache';
export { AssetManager, assetManager, useLazyImage } from './assetManager';
export type { CDNConfig } from './assetManager';
