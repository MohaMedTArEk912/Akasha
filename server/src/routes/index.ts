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
];

/**
 * Registers all API routes onto the Express application with dual-prefix support
 * (/api/* and /api/akasha/*)
 */
export function registerApiRoutes(app: Application): void {
    for (const { path: subpath, router } of routeMounts) {
        app.use([`/api${subpath}`, `/api/akasha${subpath}`], router);
    }
}
