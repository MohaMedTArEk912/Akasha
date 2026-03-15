/**
 * Qwen Process Manager
 * Handles starting and stopping the Qwen server subprocess
 */

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { checkQwenHealth, waitForQwenHealth } from './qwenHealth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let qwenProcess: ChildProcess | null = null;
const QWEN_PORT = Number(process.env.QWEN_PORT || 8000);
const QWEN_STARTUP_MAX_ATTEMPTS = Number(process.env.QWEN_STARTUP_MAX_ATTEMPTS || 120);
const QWEN_STARTUP_DELAY_MS = Number(process.env.QWEN_STARTUP_DELAY_MS || 1000);

function execAsync(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout) => {
            if (error) {
                reject(error);
                return;
            }
            resolve(stdout || '');
        });
    });
}

async function getListeningPidsOnPort(port: number): Promise<number[]> {
    try {
        if (process.platform === 'win32') {
            const output = await execAsync('netstat -ano -p tcp');
            const lines = output.split(/\r?\n/).filter((line) =>
                line.includes(`:${port}`) && line.includes('LISTENING')
            );
            const pids = lines
                .map((line) => line.trim().split(/\s+/).pop())
                .filter((pid): pid is string => Boolean(pid))
                .map((pid) => Number(pid))
                .filter((pid) => Number.isFinite(pid) && pid > 0);

            return Array.from(new Set(pids));
        }

        const output = await execAsync(`lsof -ti tcp:${port}`);
        return output
            .split(/\r?\n/)
            .map((value) => Number(value.trim()))
            .filter((pid) => Number.isFinite(pid) && pid > 0);
    } catch {
        return [];
    }
}

async function clearUnhealthyPortOccupants(port: number): Promise<void> {
    const pids = await getListeningPidsOnPort(port);
    if (pids.length === 0) {
        return;
    }

    for (const pid of pids) {
        if (pid === process.pid) {
            continue;
        }

        try {
            process.kill(pid);
            console.warn(`[Qwen] Killed stale process ${pid} on port ${port}`);
        } catch (error: any) {
            console.warn(`[Qwen] Failed to kill process ${pid} on port ${port}: ${error?.message || error}`);
        }
    }
}

export async function startQwenServer(): Promise<boolean> {
    if (process.env.QWEN_ENABLED === 'false') {
        console.log('[Qwen] Disabled via QWEN_ENABLED environment variable');
        return false;
    }

        const existingQwenHealthy = await checkQwenHealth();
    if (existingQwenHealthy) {
        console.log(`[Qwen] Existing Qwen service detected on ${process.env.QWEN_URL || 'http://localhost:8000'}, skipping new spawn`);
        return true;
    }

    await clearUnhealthyPortOccupants(QWEN_PORT);

    if (qwenProcess) {
        console.log('[Qwen] Server already running');
        return true;
    }

    try {
        const qwenDir = path.resolve(__dirname, '../../..', 'Qwen');
        console.log('[Qwen] Starting local Qwen server from:', qwenDir);

        qwenProcess = spawn('python', ['app.py'], {
            cwd: qwenDir,
            stdio: ['ignore', 'pipe', 'pipe'],
            detached: false,
            env: {
                ...process.env,
                PYTHONUTF8: '1',
            },
        });

        // Log Qwen stdout/stderr
        qwenProcess.stdout?.on('data', (data) => {
            console.log(`[Qwen stdout] ${data}`);
        });

        qwenProcess.stderr?.on('data', (data) => {
            console.log(`[Qwen stderr] ${data}`);
        });

        qwenProcess.on('error', (error) => {
            console.error('[Qwen] Process error:', error.message);
            qwenProcess = null;
        });

        qwenProcess.on('exit', (code) => {
            console.log(`[Qwen] Process exited with code ${code}`);
            qwenProcess = null;
        });

        // Wait for Qwen server to be healthy
        console.log(`[Qwen] Waiting for server health check (attempts=${QWEN_STARTUP_MAX_ATTEMPTS}, delayMs=${QWEN_STARTUP_DELAY_MS})...`);
        const healthy = await waitForQwenHealth(QWEN_STARTUP_MAX_ATTEMPTS, QWEN_STARTUP_DELAY_MS);

        if (healthy) {
            console.log(`[Qwen] ✓ Server ready on ${process.env.QWEN_URL || 'http://localhost:8000'}`);
            return true;
        } else {
            console.warn('[Qwen] ✗ Server health check failed - server may not be ready');
            // Don't kill the process, it might still be downloading the model
            // Return false to trigger OpenRouter fallback
            return false;
        }
    } catch (error: any) {
        console.error('[Qwen] Failed to start:', error.message);
        return false;
    }
}

export async function stopQwenServer(): Promise<void> {
    if (!qwenProcess) {
        return;
    }

    const processRef = qwenProcess;

    return new Promise((resolve) => {
        console.log('[Qwen] Stopping server...');
        
        // First, try graceful shutdown via API
        fetch('http://localhost:8000/shutdown', { method: 'POST' })
            .catch(() => {
                // API shutdown failed, kill the process
                if (processRef && !processRef.killed) {
                    processRef.kill();
                }
            });

        // Set timeout to force kill if not stopped gracefully
        const timeout = setTimeout(() => {
            if (processRef && !processRef.killed) {
                console.log('[Qwen] Force killing process...');
                processRef.kill('SIGKILL');
            }
            resolve();
        }, 5000);

        processRef.on('exit', () => {
            clearTimeout(timeout);
            qwenProcess = null;
            resolve();
        });
    });
}

export function isQwenRunning(): boolean {
    return qwenProcess != null && !qwenProcess.killed;
}
