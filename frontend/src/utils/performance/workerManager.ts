/**
 * Web Worker Manager
 * Handles offloading heavy computations to worker threads
 */

type WorkerTask = {
    id: string;
    type: string;
    payload: unknown;
    resolve: (result: unknown) => void;
    reject: (error: Error) => void;
};

export class WorkerManager {
    private workers: Worker[] = [];
    private taskQueue: WorkerTask[] = [];
    private activeTasks: Map<string, WorkerTask> = new Map();
    private workerStates: Map<Worker, 'idle' | 'busy'> = new Map();
    private maxWorkers: number;

    constructor(workerScript: string, maxWorkers?: number) {
        this.maxWorkers = maxWorkers || navigator.hardwareConcurrency || 4;
        this.initializeWorkers(workerScript);
    }

    private initializeWorkers(script: string): void {
        for (let i = 0; i < this.maxWorkers; i++) {
            try {
                const worker = new Worker(script, { type: 'module' });
                worker.onmessage = (e) => this.handleWorkerMessage(worker, e);
                worker.onerror = (e) => this.handleWorkerError(worker, e);
                this.workers.push(worker);
                this.workerStates.set(worker, 'idle');
            } catch (error) {
                console.warn(`Failed to create worker ${i}:`, error);
            }
        }
    }

    /**
     * Execute a task in a worker thread
     */
    async execute<T>(type: string, payload: unknown): Promise<T> {
        return new Promise((resolve, reject) => {
            const task: WorkerTask = {
                id: `task_${Date.now()}_${Math.random().toString(36).slice(2)}`,
                type,
                payload,
                resolve: resolve as (result: unknown) => void,
                reject,
            };

            this.taskQueue.push(task);
            this.processQueue();
        });
    }

    private processQueue(): void {
        if (this.taskQueue.length === 0) return;

        const idleWorker = this.workers.find((w) => this.workerStates.get(w) === 'idle');
        if (!idleWorker) return;

        const task = this.taskQueue.shift();
        if (!task) return;

        this.workerStates.set(idleWorker, 'busy');
        this.activeTasks.set(task.id, task);

        idleWorker.postMessage({
            taskId: task.id,
            type: task.type,
            payload: task.payload,
        });
    }

    private handleWorkerMessage(worker: Worker, event: MessageEvent): void {
        const { taskId, result, error } = event.data;
        const task = this.activeTasks.get(taskId);

        if (task) {
            if (error) {
                task.reject(new Error(error));
            } else {
                task.resolve(result);
            }
            this.activeTasks.delete(taskId);
        }

        this.workerStates.set(worker, 'idle');
        this.processQueue();
    }

    private handleWorkerError(worker: Worker, event: ErrorEvent): void {
        console.error('Worker error:', event.message);
        this.workerStates.set(worker, 'idle');
        this.processQueue();
    }

    /**
     * Terminate all workers
     */
    terminate(): void {
        this.workers.forEach((w) => w.terminate());
        this.workers = [];
        this.workerStates.clear();
        this.activeTasks.forEach((task) => task.reject(new Error('Worker terminated')));
        this.activeTasks.clear();
        this.taskQueue = [];
    }

    /**
     * Get worker pool stats
     */
    getStats(): { total: number; idle: number; busy: number; queued: number } {
        let idle = 0;
        let busy = 0;
        this.workerStates.forEach((state) => {
            if (state === 'idle') idle++;
            else busy++;
        });

        return {
            total: this.workers.length,
            idle,
            busy,
            queued: this.taskQueue.length,
        };
    }
}

/**
 * Sample worker script content (to be used in a separate file)
 * Save this as worker.ts and build separately
 */
export const WORKER_SCRIPT_TEMPLATE = `
self.onmessage = async (event) => {
    const { taskId, type, payload } = event.data;
    
    try {
        let result;
        
        switch (type) {
            case 'PARSE_CSS':
                result = parseCss(payload);
                break;
            case 'GENERATE_CODE':
                result = generateCode(payload);
                break;
            case 'OPTIMIZE_SCHEMA':
                result = optimizeSchema(payload);
                break;
            default:
                throw new Error('Unknown task type: ' + type);
        }
        
        self.postMessage({ taskId, result });
    } catch (error) {
        self.postMessage({ taskId, error: error.message });
    }
};

function parseCss(css) {
    // Heavy CSS parsing logic
    return { parsed: true };
}

function generateCode(schema) {
    // Code generation logic
    return { code: '' };
}

function optimizeSchema(schema) {
    // Schema optimization logic
    return schema;
}
`;
