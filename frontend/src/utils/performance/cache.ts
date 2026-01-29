/**
 * Multi-level Caching System
 * Provides memory, session, and persistent caching
 */

type CacheEntry<T> = {
    value: T;
    timestamp: number;
    ttl: number;
};

interface CacheOptions {
    ttl?: number; // Time to live in ms
    namespace?: string;
}

/**
 * Memory Cache - Fast, volatile
 */
export class MemoryCache<T = unknown> {
    private cache: Map<string, CacheEntry<T>> = new Map();
    private maxSize: number;
    private defaultTtl: number;

    constructor(options?: { maxSize?: number; defaultTtl?: number }) {
        this.maxSize = options?.maxSize || 1000;
        this.defaultTtl = options?.defaultTtl || 5 * 60 * 1000; // 5 minutes
    }

    set(key: string, value: T, ttl?: number): void {
        this.cache.set(key, {
            value,
            timestamp: Date.now(),
            ttl: ttl || this.defaultTtl,
        });
        this.enforceSize();
    }

    get(key: string): T | undefined {
        const entry = this.cache.get(key);
        if (!entry) return undefined;

        if (Date.now() - entry.timestamp > entry.ttl) {
            this.cache.delete(key);
            return undefined;
        }

        return entry.value;
    }

    has(key: string): boolean {
        return this.get(key) !== undefined;
    }

    delete(key: string): boolean {
        return this.cache.delete(key);
    }

    clear(): void {
        this.cache.clear();
    }

    private enforceSize(): void {
        if (this.cache.size > this.maxSize) {
            const oldest = Array.from(this.cache.entries())
                .sort((a, b) => a[1].timestamp - b[1].timestamp)
                .slice(0, this.cache.size - this.maxSize);

            oldest.forEach(([key]) => this.cache.delete(key));
        }
    }

    get size(): number {
        return this.cache.size;
    }
}

/**
 * Session Storage Cache - Persists during session
 */
export class SessionCache<T = unknown> {
    private namespace: string;
    private defaultTtl: number;

    constructor(namespace = 'editor_cache', defaultTtl = 30 * 60 * 1000) {
        this.namespace = namespace;
        this.defaultTtl = defaultTtl;
    }

    private getKey(key: string): string {
        return `${this.namespace}:${key}`;
    }

    set(key: string, value: T, ttl?: number): void {
        try {
            const entry: CacheEntry<T> = {
                value,
                timestamp: Date.now(),
                ttl: ttl || this.defaultTtl,
            };
            sessionStorage.setItem(this.getKey(key), JSON.stringify(entry));
        } catch (error) {
            console.warn('SessionCache set failed:', error);
        }
    }

    get(key: string): T | undefined {
        try {
            const data = sessionStorage.getItem(this.getKey(key));
            if (!data) return undefined;

            const entry: CacheEntry<T> = JSON.parse(data);
            if (Date.now() - entry.timestamp > entry.ttl) {
                this.delete(key);
                return undefined;
            }

            return entry.value;
        } catch (error) {
            return undefined;
        }
    }

    delete(key: string): void {
        sessionStorage.removeItem(this.getKey(key));
    }

    clear(): void {
        const keysToRemove: string[] = [];
        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key?.startsWith(this.namespace)) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach((key) => sessionStorage.removeItem(key));
    }
}

/**
 * IndexedDB Cache - Persistent, large storage
 */
export class PersistentCache<T = unknown> {
    private dbName: string;
    private storeName: string;
    private db: IDBDatabase | null = null;
    private defaultTtl: number;

    constructor(dbName = 'EditorCache', storeName = 'cache', defaultTtl = 24 * 60 * 60 * 1000) {
        this.dbName = dbName;
        this.storeName = storeName;
        this.defaultTtl = defaultTtl;
    }

    private async getDB(): Promise<IDBDatabase> {
        if (this.db) return this.db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(request.result);
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'key' });
                }
            };
        });
    }

    async set(key: string, value: T, ttl?: number): Promise<void> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.storeName, 'readwrite');
            const store = tx.objectStore(this.storeName);

            const entry = {
                key,
                value,
                timestamp: Date.now(),
                ttl: ttl || this.defaultTtl,
            };

            const request = store.put(entry);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }

    async get(key: string): Promise<T | undefined> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.storeName, 'readonly');
            const store = tx.objectStore(this.storeName);
            const request = store.get(key);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const entry = request.result;
                if (!entry) {
                    resolve(undefined);
                    return;
                }

                if (Date.now() - entry.timestamp > entry.ttl) {
                    this.delete(key);
                    resolve(undefined);
                    return;
                }

                resolve(entry.value);
            };
        });
    }

    async delete(key: string): Promise<void> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.storeName, 'readwrite');
            const store = tx.objectStore(this.storeName);
            const request = store.delete(key);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }

    async clear(): Promise<void> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.storeName, 'readwrite');
            const store = tx.objectStore(this.storeName);
            const request = store.clear();

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }
}

/**
 * Tiered Cache - Combines all cache levels
 */
export class TieredCache<T = unknown> {
    private memory: MemoryCache<T>;
    private session: SessionCache<T>;
    private persistent: PersistentCache<T>;

    constructor(namespace = 'editor') {
        this.memory = new MemoryCache<T>({ maxSize: 500 });
        this.session = new SessionCache<T>(`${namespace}_session`);
        this.persistent = new PersistentCache<T>(`${namespace}DB`);
    }

    async set(key: string, value: T, options?: { persist?: boolean; ttl?: number }): Promise<void> {
        // Always set in memory
        this.memory.set(key, value, options?.ttl);

        // Optionally persist
        if (options?.persist) {
            this.session.set(key, value, options?.ttl);
            await this.persistent.set(key, value, options?.ttl);
        }
    }

    async get(key: string): Promise<T | undefined> {
        // Try memory first (fastest)
        let value = this.memory.get(key);
        if (value !== undefined) return value;

        // Try session
        value = this.session.get(key);
        if (value !== undefined) {
            this.memory.set(key, value); // Populate memory
            return value;
        }

        // Try persistent
        value = await this.persistent.get(key);
        if (value !== undefined) {
            this.memory.set(key, value);
            this.session.set(key, value);
            return value;
        }

        return undefined;
    }

    async delete(key: string): Promise<void> {
        this.memory.delete(key);
        this.session.delete(key);
        await this.persistent.delete(key);
    }

    async clear(): Promise<void> {
        this.memory.clear();
        this.session.clear();
        await this.persistent.clear();
    }
}

// Singleton instances
export const memoryCache = new MemoryCache();
export const sessionCache = new SessionCache();
export const persistentCache = new PersistentCache();
export const tieredCache = new TieredCache();
