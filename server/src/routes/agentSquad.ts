import { Router } from 'express';
import * as ctrl from '../controllers/agentSquadController.js';

const router = Router();

// Blueprint & Token Optimization
router.get('/blueprint/:projectId', ctrl.getBlueprint);
router.post('/sync-blueprint-file', ctrl.syncBlueprintFile);

// Squad Configuration (Parallel vs Series, Generate vs Handoff)
router.get('/config/:projectId', ctrl.getSquadConfiguration);
router.post('/config/:projectId', ctrl.updateSquadConfiguration);

// Mission Dispatch, Persisted Status & Live SSE Stream
router.post('/dispatch', ctrl.dispatchMission);
router.get('/mission/:projectId', ctrl.getMissionStatus);
router.get('/stream/:projectId', ctrl.streamMissionEvents);

// Real-Time Telemetry Bridge
router.post('/telemetry', ctrl.reportTelemetry);

// Blueprint vs. Code Drift Radar
router.post('/drift/:projectId', ctrl.runDriftCheck);
router.get('/drift/:projectId', ctrl.getDriftStatus);

export default router;
