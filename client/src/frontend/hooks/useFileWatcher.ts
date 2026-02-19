import { useEffect, useRef, useCallback } from 'react';

/**
 * Hook to watch for file system changes using polling
 * This is a simple implementation that polls the filesystem at intervals
 * 
 * On a desktop app with Tauri, you could use the filesystem watcher API
 * when available, but this works cross-platform
 */
export function useFileWatcher(
    rootPath: string | undefined,
    onFileChange: () => void,
    interval: number = 2000
) {
    const intervalRef = useRef<NodeJS.Timeout>();
    const lastCheckedRef = useRef<number>(0);

    useEffect(() => {
        if (!rootPath) {
            return;
        }

        // Set up interval for watching
        intervalRef.current = setInterval(() => {
            const now = Date.now();
            // Only check if enough time has passed since last check
            if (now - lastCheckedRef.current >= interval) {
                lastCheckedRef.current = now;
                onFileChange();
            }
        }, interval);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [rootPath, onFileChange, interval]);

    // Manual trigger for immediate refresh
    const triggerRefresh = useCallback(() => {
        onFileChange();
        lastCheckedRef.current = Date.now();
    }, [onFileChange]);

    return { triggerRefresh };
}
