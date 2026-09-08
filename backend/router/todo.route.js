const express = require('express');
const route = express.Router();
const controller = require('../controllers/todo.controller');
const { authMiddlewares } = require('../middlewares/authMiddlewares');

route.get('/todos', authMiddlewares, controller.getAll);
route.post('/todos', authMiddlewares, controller.create);
route.patch('/todos/:id/progress', authMiddlewares, controller.updateProgress);
route.delete('/todos/:id', authMiddlewares, controller.delete);
route.get('/todos/groups', authMiddlewares, controller.getGroups);
route.post('/todos/groups', authMiddlewares, controller.createGroup);
route.patch('/todos/group/rename', authMiddlewares, controller.renameGroup);
route.patch('/todos/group/clear', authMiddlewares, controller.clearGroup);

module.exports = route;
