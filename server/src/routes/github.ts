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
router.get('/repos/:owner/:repo/commits', ctrl.getCommits);
router.get('/repos/:owner/:repo/branches', ctrl.getBranches);

export default router;
