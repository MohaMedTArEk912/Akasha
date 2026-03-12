import { Router } from 'express';
import * as ctrl from '../controllers/projectController.js';

const router = Router();

router.get('/', ctrl.listProjects);
router.get('/:id', ctrl.getProject);
router.post('/', ctrl.createProject);
router.put('/:id', ctrl.updateProject);
router.put('/:id/idea', ctrl.updateProjectIdea);
router.post('/:id/generate-idea-details', ctrl.generateStructuredIdea);
router.delete('/:id', ctrl.deleteProject);

export default router;
