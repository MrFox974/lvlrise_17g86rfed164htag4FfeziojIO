const express = require('express');
const route = express.Router();
const controller = require('../controllers/debate.controller');
const { authMiddlewares } = require('../middlewares/authMiddlewares');

route.get('/debates', authMiddlewares, controller.getAll);
route.post('/debates', authMiddlewares, controller.create);
route.get('/debates/:id', authMiddlewares, controller.getById);
route.put('/debates/:id', authMiddlewares, controller.update);
route.delete('/debates/:id', authMiddlewares, controller.delete);

route.post('/debates/:id/nodes', authMiddlewares, controller.createNode);
route.put('/debate-nodes/:nodeId', authMiddlewares, controller.updateNode);
route.delete('/debate-nodes/:nodeId', authMiddlewares, controller.deleteNode);

route.post('/debate-nodes/:nodeId/arguments', authMiddlewares, controller.createArgument);
route.put('/debate-arguments/:argumentId', authMiddlewares, controller.updateArgument);
route.delete('/debate-arguments/:argumentId', authMiddlewares, controller.deleteArgument);

module.exports = route;
