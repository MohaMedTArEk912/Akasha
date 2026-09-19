
import './lib/env.js';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeLLMProvider, aiConfigStorage } from './lib/llmProvider.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3001'],
    credentials: true,
}));
app.use(express.json());

app.use(express.static(path.join(__dirname, '../../public')));

// Set up AI configuration context from request headers or body
app.use((req, res, next) => {
    const aiConfig = {
        apiKey: (req.headers['x-ai-api-key'] as string) || req.body?.apiKey,
        model: (req.headers['x-ai-model'] as string) || req.body?.model,
        apiBaseUrl: (req.headers['x-ai-api-base-url'] as string) || req.body?.apiBaseUrl,
    };
    aiConfigStorage.run(aiConfig, next);
});


// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', version: '1.0.0' });
});

// Routes
import projectRouter from './routes/project.js';
import workspaceRouter from './routes/workspace.js';
import pagesRouter from './routes/pages.js';
import componentsRouter from './routes/components.js';
import gitRouter from './routes/git.js';

app.use(['/api/project', '/api/akasha/project'], projectRouter);
import blocksRouter from './routes/blocks.js';
app.use(['/api/blocks', '/api/akasha/blocks'], blocksRouter);
app.use(['/api/workspace', '/api/akasha/workspace'], workspaceRouter);
app.use(['/api/pages', '/api/akasha/pages'], pagesRouter);
import logicFlowsRouter from './routes/logicFlows.js';
app.use(['/api/logic-flows', '/api/akasha/logic-flows'], logicFlowsRouter);
import dataModelsRouter from './routes/dataModels.js';
app.use(['/api/data-models', '/api/akasha/data-models'], dataModelsRouter);
import diagramsRouter from './routes/diagrams.js';
app.use(['/api/diagrams', '/api/akasha/diagrams'], diagramsRouter);
import codegenRouter from './routes/codegen.js';
app.use(['/api/codegen', '/api/akasha/codegen'], codegenRouter);
app.use(['/api/components', '/api/akasha/components'], componentsRouter);
app.use(['/api/git', '/api/akasha/git'], gitRouter);
import usecasesRouter from './routes/usecases.js';
app.use(['/api/usecases', '/api/akasha/usecases'], usecasesRouter);
import apiProxyRouter from './routes/apiProxy.js';
app.use(['/api/proxy', '/api/akasha/proxy'], apiProxyRouter);
import apiHistoryRouter from './routes/apiHistory.js';
app.use(['/api/api-history', '/api/akasha/api-history'], apiHistoryRouter);
import aiRouter from './routes/ai.js';
app.use(['/api/ai', '/api/akasha/ai'], aiRouter);
import githubRouter from './routes/github.js';
app.use(['/api/github', '/api/akasha/github'], githubRouter);

// Initialize servers
async function startServer() {
    try {
        // Initialize LLM provider
        await initializeLLMProvider();
        console.log('[LLM Provider] Initialized successfully');

        // Start Express server
        app.listen(PORT, () => {
            console.log(`✓ Server running on http://localhost:${PORT}`);
        });

        // Handle graceful shutdown
        process.on('SIGINT', async () => {
            console.log('\n[Server] Shutting down gracefully...');
            process.exit(0);
        });

        process.on('SIGTERM', async () => {
            console.log('\n[Server] Shutting down gracefully...');
            process.exit(0);
        });
    } catch (error: any) {
        console.error('[Server] Failed to start:', error.message);
        process.exit(1);
    }
}

startServer();

