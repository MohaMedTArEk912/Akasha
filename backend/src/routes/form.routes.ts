import express from 'express';
import {
    submitForm,
    getFormSubmissions,
    getFormStats,
    deleteSubmission,
} from '../controllers/form.controller';
import { protect } from '../middleware/auth.middleware';

const router = express.Router();

// Public endpoint for form submissions (from published sites)
router.post('/:projectId/submit', submitForm);

// Protected endpoints for viewing submissions
router.get('/:projectId/submissions', protect, getFormSubmissions);
router.get('/:projectId/stats', protect, getFormStats);
router.delete('/submissions/:id', protect, deleteSubmission);

export default router;
