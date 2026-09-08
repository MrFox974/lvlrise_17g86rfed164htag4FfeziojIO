const express = require('express');
const route = express.Router();
const controller = require('../controllers/markdown.controller');
const { authMiddlewares } = require('../middlewares/authMiddlewares');

route.get('/markdown/domains', authMiddlewares, controller.getAllDomains);
route.get('/markdown/domains/public', authMiddlewares, controller.getPublicDomains);
route.get('/markdown/domains/:id/generation-status', authMiddlewares, controller.getDomainGenerationStatus);
route.post('/markdown/domains/:id/cancel-generation', authMiddlewares, controller.cancelDomainGeneration);
route.post('/markdown/domains/:id/resume-generation', authMiddlewares, controller.resumeDomainGeneration);
route.post('/markdown/domains', authMiddlewares, controller.createDomain);
route.post('/markdown/domains/generate', authMiddlewares, controller.generateDomainWithAI);
route.put('/markdown/domains/:id/visibility', authMiddlewares, controller.setDomainVisibility);
route.post('/markdown/domains/:id/import', authMiddlewares, controller.importDomain);
route.put('/markdown/domains/:id', authMiddlewares, controller.updateDomain);
route.delete('/markdown/domains/:id', authMiddlewares, controller.deleteDomain);

route.get('/markdown/sections', authMiddlewares, controller.getAllSections);

route.post('/markdown/domains/:domainId/chapters', authMiddlewares, controller.createChapter);
route.put('/markdown/domains/:domainId/chapters/:chapterId', authMiddlewares, controller.updateChapter);
route.put('/markdown/domains/:domainId/chapters/reorder', authMiddlewares, controller.reorderChapters);
route.delete('/markdown/domains/:domainId/chapters/:chapterId', authMiddlewares, controller.deleteChapter);

route.post('/markdown/domains/:domainId/chapters/:chapterId/sections', authMiddlewares, controller.createSection);
route.put('/markdown/domains/:domainId/chapters/:chapterId/sections/reorder', authMiddlewares, controller.reorderSections);
route.put('/markdown/domains/:domainId/chapters/:chapterId/sections/:sectionId', authMiddlewares, controller.updateSection);
route.delete('/markdown/domains/:domainId/chapters/:chapterId/sections/:sectionId', authMiddlewares, controller.deleteSection);

module.exports = route;
