
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeLLMProvider } from './lib/llmProvider.js';
import { startQwenServer, stopQwenServer } from './lib/qwenManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Determine operational mode (Web vs Tauri-replacement)


app.use(express.static(path.join(__dirname, '../../public')));


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

app.use('/api/project', projectRouter);
import blocksRouter from './routes/blocks.js';
app.use('/api/blocks', blocksRouter);
app.use('/api/workspace', workspaceRouter);
app.use('/api/pages', pagesRouter);
import logicFlowsRouter from './routes/logicFlows.js';
app.use('/api/logic-flows', logicFlowsRouter);
import dataModelsRouter from './routes/dataModels.js';
app.use('/api/data-models', dataModelsRouter);
import variablesRouter from './routes/variables.js';
app.use('/api/variables', variablesRouter);
import diagramsRouter from './routes/diagrams.js';
app.use('/api/diagrams', diagramsRouter);
import codegenRouter from './routes/codegen.js';
app.use('/api/codegen', codegenRouter);
app.use('/api/components', componentsRouter);
app.use('/api/git', gitRouter);
import usecasesRouter from './routes/usecases.js';
app.use('/api/usecases', usecasesRouter);
import apiProxyRouter from './routes/apiProxy.js';
app.use('/api/proxy', apiProxyRouter);
import apiHistoryRouter from './routes/apiHistory.js';
app.use('/api/api-history', apiHistoryRouter);
import aiRouter from './routes/ai.js';
app.use('/api/ai', aiRouter);

// Initialize servers
async function startServer() {
    try {
        // Start Qwen if enabled
        const qwenStarted = await startQwenServer();
        if (!qwenStarted && process.env.QWEN_ENABLED !== 'false') {
            console.warn('[Server] Qwen did not start successfully. Will use OpenRouter fallback.');
        }

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
            await stopQwenServer();
            process.exit(0);
        });

        process.on('SIGTERM', async () => {
            console.log('\n[Server] Shutting down gracefully...');
            await stopQwenServer();
            process.exit(0);
        });
    } catch (error: any) {
        console.error('[Server] Failed to start:', error.message);
        process.exit(1);
    }
}

startServer();

