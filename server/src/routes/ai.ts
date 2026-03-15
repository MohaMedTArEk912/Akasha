import { Router } from 'express';
import * as ctrl from '../controllers/aiController.js';
import * as uiBuilderCtrl from '../controllers/uiBuilderAiController.js';

const router = Router();

// Team Management
router.post('/register', ctrl.register);
router.post('/create-team', ctrl.createTeam);
router.post('/request-join', ctrl.requestJoin);
router.get('/search-teams', ctrl.searchTeams);
router.get('/teams', ctrl.listTeams);
router.get('/admin', ctrl.getAdminData);
router.post('/resolve-request', ctrl.resolveRequest);
router.get('/status', ctrl.getStatus);
router.post('/leave', ctrl.leaveTeam);

// Chat
router.post('/chat', ctrl.teamChat);
router.get('/chat-history', ctrl.getChatHistory);

// Ideas
router.get('/ideas', ctrl.getIdeas);
router.get('/best-idea', ctrl.getBestIdea);
router.post('/submit-idea', ctrl.submitIdea);

// Simple Chat (merged from server.js)
router.post('/simple-chat', ctrl.simpleChat);

// Project-Context-Aware Chat
router.post('/project-chat', ctrl.projectChat);

// UI Builder AI
router.post('/ui-builder/generate', uiBuilderCtrl.generate);
router.post('/ui-builder/analyze', uiBuilderCtrl.analyze);
router.post('/ui-builder/apply', uiBuilderCtrl.apply);
router.post('/ui-builder/stream', uiBuilderCtrl.stream);

// Idea Validation & Refinement
router.post('/analyze-idea', ctrl.analyzeIdea);
router.post('/review-idea-feature', ctrl.reviewIdeaFeature);
router.post('/refine-idea', ctrl.refineIdea);

export default router;
