import './lib/env.js';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeLLMProvider, aiConfigStorage } from './lib/llmProvider.js';
import { registerApiRoutes } from './routes/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001; // Loaded from .env

// Core Middleware
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3001'],
    credentials: true,
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../public')));

// AI configuration context from request headers or body
app.use((req, res, next) => {
    const aiConfig = {
        apiKey: (req.headers['x-ai-api-key'] as string) || req.body?.apiKey,
        model: (req.headers['x-ai-model'] as string) || req.body?.model,
        apiBaseUrl: (req.headers['x-ai-api-base-url'] as string) || req.body?.apiBaseUrl,
    };
    aiConfigStorage.run(aiConfig, next);
});

// Health check endpoint
app.get('/health', (_req, res) => {
    res.json({ status: 'healthy', version: '1.0.0' });
});

// Register all API routes
registerApiRoutes(app);

// 404 Handler for undefined API routes
app.use(['/api', '/api/akasha'], (req, res) => {
    res.status(404).json({ error: `Cannot ${req.method} ${req.path}` });
});

// Centralized error handling middleware
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(`[Server Error] ${req.method} ${req.path}:`, err);
    const statusCode = typeof err.status === 'number' && err.status >= 400 && err.status < 600 ? err.status : 500;
    res.status(statusCode).json({
        error: err.message || 'Internal Server Error',
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    });
});

// Server bootstrap
async function startServer() {
    try {
        await initializeLLMProvider();
        console.log('[LLM Provider] Initialized successfully');

        app.listen(PORT, () => {
            console.log(`✓ Server running on http://localhost:${PORT}`);
        });

        // Graceful shutdown handlers
        const shutdown = () => {
            console.log('\n[Server] Shutting down gracefully...');
            process.exit(0);
        };
        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
    } catch (error: any) {
        console.error('[Server] Failed to start:', error?.message || error);
        process.exit(1);
    }
}

startServer();
