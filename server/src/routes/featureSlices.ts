import { Router } from 'express';
import * as ctrl from '../controllers/featureSlicesController.js';

const router = Router();

router.get('/readiness/:projectId', ctrl.getReadiness);
router.post('/impact/analyze', ctrl.analyzeImpact);
router.post('/impact/apply', ctrl.applyImpact);
router.post('/comments', ctrl.postComment);
router.patch('/comments/:commentId', ctrl.toggleCommentResolved);
router.post('/decisions', ctrl.postDecision);
router.get('/:projectId/build-pack/:sliceId', ctrl.getSliceBuildPack);
router.get('/:projectId', ctrl.getSlicesWorkspace);
router.post('/', ctrl.createSlice);
router.put('/:sliceId', ctrl.updateSlice);
router.delete('/:sliceId', ctrl.removeSlice);
router.post('/:sliceId/vote', ctrl.voteSlice);

export default router;
