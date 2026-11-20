import { Router } from 'express';
import * as ctrl from '../controllers/codegenController.js';

const router = Router();

router.post('/sync', ctrl.syncProject);
router.post('/export', ctrl.exportProject);
router.get('/bundle/:projectId', ctrl.getGeneratedBundle);

export default router;
