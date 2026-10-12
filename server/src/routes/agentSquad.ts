import { Router } from 'express';
import * as ctrl from '../controllers/agentSquadController.js';

const router = Router();

// Blueprint & Token Optimization
router.get('/blueprint/:projectId', ctrl.getBlueprint);
router.post('/sync-blueprint-file', ctrl.syncBlueprintFile);

// Squad Configuration (Parallel vs Series)
router.get('/config/:projectId', ctrl.getSquadConfiguration);
router.post('/config/:projectId', ctrl.updateSquadConfiguration);

// Mission Dispatch & Execution
router.post('/dispatch', ctrl.dispatchMission);
router.get('/mission/:projectId', ctrl.getMissionStatus);

// Real-Time Telemetry Bridge
router.post('/telemetry', ctrl.reportTelemetry);

export default router;
