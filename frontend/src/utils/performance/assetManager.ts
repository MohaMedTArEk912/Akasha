/**
 * CDN and Asset Management Utilities
 * Handles asset URL transformation, caching, and optimization
 */

export interface CDNConfig {
    baseUrl: string;
    imageOptimization: boolean;
    supportedFormats: string[];
    breakpoints: number[];
    quality: number;
}

const defaultConfig: CDNConfig = {
    baseUrl: '',
    imageOptimization: true,
    supportedFormats: ['webp', 'avif', 'jpg', 'png'],
    breakpoints: [320, 640, 768, 1024, 1280, 1920],
    quality: 80,
};

export class AssetManager {
    private config: CDNConfig;
    private cache: Map<string, string> = new Map();

    constructor(config?: Partial<CDNConfig>) {
        this.config = { ...defaultConfig, ...config };
    }

    /**
     * Configure CDN settings
     */
    configure(config: Partial<CDNConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Get the CDN URL for an asset
     */
    getAssetUrl(path: string): string {
        if (!this.config.baseUrl || path.startsWith('http')) {
            return path;
        }

        const cached = this.cache.get(path);
        if (cached) return cached;

        const url = `${this.config.baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
        this.cache.set(path, url);
        return url;
    }

    /**
     * Get optimized image URL with transformations
     */
    getOptimizedImageUrl(
        src: string,
        options?: {
            width?: number;
            height?: number;
            quality?: number;
            format?: 'webp' | 'avif' | 'jpg' | 'png';
            fit?: 'cover' | 'contain' | 'fill';
        }
    ): string {
        if (!this.config.imageOptimization) {
            return this.getAssetUrl(src);
        }

        const params = new URLSearchParams();
        if (options?.width) params.set('w', options.width.toString());
        if (options?.height) params.set('h', options.height.toString());
        params.set('q', (options?.quality || this.config.quality).toString());
        if (options?.format) params.set('fm', options.format);
        if (options?.fit) params.set('fit', options.fit);

        const baseUrl = this.getAssetUrl(src);
        const separator = baseUrl.includes('?') ? '&' : '?';
        return `${baseUrl}${separator}${params.toString()}`;
    }

    /**
     * Generate srcset for responsive images
     */
    generateSrcSet(
        src: string,
        options?: { format?: 'webp' | 'avif' | 'jpg' | 'png'; quality?: number }
    ): string {
        return this.config.breakpoints
            .map((width) => {
                const url = this.getOptimizedImageUrl(src, {
                    width,
                    ...options,
                });
                return `${url} ${width}w`;
            })
            .join(', ');
    }

    /**
     * Generate sizes attribute for responsive images
     */
    generateSizes(breakpointRules?: Record<string, string>): string {
        const defaults: Record<string, string> = {
            '(max-width: 640px)': '100vw',
            '(max-width: 1024px)': '50vw',
            default: '33vw',
        };

        const rules = breakpointRules || defaults;
        return Object.entries(rules)
            .map(([condition, size]) =>
                condition === 'default' ? size : `${condition} ${size}`
            )
            .join(', ');
    }

    /**
     * Preload critical assets
     */
    preloadAssets(assets: { url: string; as: 'image' | 'script' | 'style' | 'font' }[]): void {
        assets.forEach(({ url, as }) => {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.href = this.getAssetUrl(url);
            link.as = as;

            if (as === 'font') {
                link.crossOrigin = 'anonymous';
            }

            document.head.appendChild(link);
        });
    }

    /**
     * Lazy load an image with IntersectionObserver
     */
    lazyLoadImage(
        img: HTMLImageElement,
        src: string,
        options?: { threshold?: number; rootMargin?: string }
    ): () => void {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        img.src = this.getAssetUrl(src);
                        observer.unobserve(img);
                    }
                });
            },
            {
                threshold: options?.threshold || 0,
                rootMargin: options?.rootMargin || '100px',
            }
        );

        observer.observe(img);

        // Return cleanup function
        return () => observer.disconnect();
    }

    /**
     * Get placeholder for lazy loading
     */
    getPlaceholder(width: number, height: number, color = '#e5e7eb'): string {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
            <rect width="100%" height="100%" fill="${color}"/>
        </svg>`;
        return `data:image/svg+xml,${encodeURIComponent(svg)}`;
    }

    /**
     * Get blur placeholder URL
     */
    getBlurPlaceholder(src: string): string {
        return this.getOptimizedImageUrl(src, {
            width: 20,
            quality: 20,
            format: 'webp',
        });
    }

    /**
     * Clear URL cache
     */
    clearCache(): void {
        this.cache.clear();
    }
}

// Singleton instance
export const assetManager = new AssetManager();

/**
 * React hook for lazy loading images
 */
export function useLazyImage(src: string): {
    ref: React.RefObject<HTMLImageElement>;
    isLoaded: boolean;
} {
    const ref = React.useRef<HTMLImageElement>(null);
    const [isLoaded, setIsLoaded] = React.useState(false);

    React.useEffect(() => {
        if (!ref.current) return;

        const img = ref.current;
        let cleanup: (() => void) | undefined;

        if ('loading' in HTMLImageElement.prototype) {
            // Native lazy loading
            img.loading = 'lazy';
            img.src = src;
            img.onload = () => setIsLoaded(true);
        } else {
            // Fallback with IntersectionObserver
            cleanup = assetManager.lazyLoadImage(img, src);
            img.onload = () => setIsLoaded(true);
        }

        return () => {
            if (cleanup) cleanup();
        };
    }, [src]);

    return { ref, isLoaded };
}

// Import React for the hook
import React from 'react';
