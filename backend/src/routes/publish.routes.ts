import express from 'express';
import { deployVercel, deployNetlify, scheduleVercel, getSchedules } from '../controllers/publish.controller';

const router = express.Router();

router.post('/vercel', deployVercel);
router.post('/netlify', deployNetlify);
router.post('/vercel/schedule', scheduleVercel);
router.get('/schedules/:projectId', getSchedules);

export default router;