import { Router, type Application } from 'express';

import projectRouter from './project.js';
import blocksRouter from './blocks.js';
import workspaceRouter from './workspace.js';
import pagesRouter from './pages.js';
import logicFlowsRouter from './logicFlows.js';
import dataModelsRouter from './dataModels.js';
import diagramsRouter from './diagrams.js';
import codegenRouter from './codegen.js';
import componentsRouter from './components.js';
import gitRouter from './git.js';
import usecasesRouter from './usecases.js';
import apiProxyRouter from './apiProxy.js';
import apiHistoryRouter from './apiHistory.js';
import aiRouter from './ai.js';
import githubRouter from './github.js';
import storageRouter from './storage.js';
import agentSquadRouter from './agentSquad.js';
import mcpRouter from './mcp.js';
import playbooksRouter from './playbooks.js';
import featureSlicesRouter from './featureSlices.js';
import previewRouter from './preview.js';
import mockApiRouter from './mockApi.js';

interface RouteMount {
    path: string;
    router: Router;
}

const routeMounts: RouteMount[] = [
    { path: '/project', router: projectRouter },
    { path: '/blocks', router: blocksRouter },
    { path: '/workspace', router: workspaceRouter },
    { path: '/pages', router: pagesRouter },
    { path: '/logic-flows', router: logicFlowsRouter },
    { path: '/data-models', router: dataModelsRouter },
    { path: '/diagrams', router: diagramsRouter },
    { path: '/codegen', router: codegenRouter },
    { path: '/components', router: componentsRouter },
    { path: '/git', router: gitRouter },
    { path: '/usecases', router: usecasesRouter },
    { path: '/proxy', router: apiProxyRouter },
    { path: '/api-history', router: apiHistoryRouter },
    { path: '/ai', router: aiRouter },
    { path: '/github', router: githubRouter },
    { path: '/storage', router: storageRouter },
    { path: '/agent-squad', router: agentSquadRouter },
    { path: '/mcp', router: mcpRouter },
    { path: '/playbooks', router: playbooksRouter },
    { path: '/slices', router: featureSlicesRouter },
    { path: '/preview', router: previewRouter },
];

/**
 * Registers all API routes onto the Express application with dual-prefix support
 * (/api/* and /api/akasha/*), plus the dynamic Live Stateful Mock API at /api/mock/*
 */
export function registerApiRoutes(app: Application): void {
    for (const { path: subpath, router } of routeMounts) {
        app.use([`/api${subpath}`, `/api/akasha${subpath}`], router);
    }
    app.use('/api/mock', mockApiRouter);
}
