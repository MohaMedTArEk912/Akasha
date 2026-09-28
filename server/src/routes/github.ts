import { Router } from 'express';
import * as ctrl from '../controllers/githubController.js';

const router = Router();

// OAuth flow
router.get('/login', ctrl.login);
router.get('/callback', ctrl.callback);

// Status & disconnect
router.get('/status', ctrl.getStatus);
router.post('/disconnect', ctrl.disconnect);

// Repos
router.get('/repos', ctrl.listRepos);
router.post('/repos', ctrl.createRepo);

// Repo details
router.get('/repos/:owner/:repo/contents', ctrl.getContents);
router.put('/repos/:owner/:repo/contents', ctrl.commitFile);
router.post('/repos/:owner/:repo/commit-file', ctrl.commitFile);
router.get('/repos/:owner/:repo/commits', ctrl.getCommits);
router.get('/repos/:owner/:repo/branches', ctrl.getBranches);

// AI Ingestion & Commit Auto-Task Sync
router.post('/ingest', ctrl.ingestRepo);
router.post('/repos/:owner/:repo/sync-tasks', ctrl.syncTasks);
router.post('/projects/:projectId/sync-tasks', ctrl.syncProjectTasks);
router.post('/projects/:projectId/auto-sync-check', ctrl.checkProjectAutoSync);

export default router;
