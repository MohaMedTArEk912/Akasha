
import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Determine operational mode (Web vs Tauri-replacement)


app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Akasha Node.js Backend is running',
        mode: 'web'
    });
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

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
