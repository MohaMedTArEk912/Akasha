import { Router } from 'express';
import * as ctrl from '../controllers/playbooksController.js';

const router = Router();

router.get('/', ctrl.listPlaybooks);
router.get('/provider-status', ctrl.getAiProviderStatus);
router.get('/:archetype', ctrl.getPlaybookDetail);
router.post('/bootstrap', ctrl.bootstrapPlaybook);

export default router;
