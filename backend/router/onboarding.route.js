const express = require('express');
const route = express.Router();
const controller = require('../controllers/onboarding.controller');
const { authMiddlewares } = require('../middlewares/authMiddlewares');

route.post('/onboarding/quick-start', authMiddlewares, controller.quickStart);
route.get('/onboarding/status', authMiddlewares, controller.getStatus);
route.get('/onboarding/ai-session', authMiddlewares, controller.getAiSession);
route.post('/onboarding/ai-step', authMiddlewares, controller.postAiStep);
route.post('/onboarding/ai-complete', authMiddlewares, controller.postAiComplete);
route.get('/onboarding/generation-status', authMiddlewares, controller.getGenerationStatus);
route.post('/onboarding/cancel-generation', authMiddlewares, controller.cancelGeneration);
route.post('/onboarding/resume-generation', authMiddlewares, controller.resumeGeneration);

module.exports = route;
