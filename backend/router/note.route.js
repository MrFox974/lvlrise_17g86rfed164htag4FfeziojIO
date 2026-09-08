const express = require('express');
const route = express.Router();
const controller = require('../controllers/note.controller');
const { authMiddlewares } = require('../middlewares/authMiddlewares');

route.get('/notes/by-todo/:todoId', authMiddlewares, controller.getByTodo);
route.get('/notes', authMiddlewares, controller.getAll);
route.get('/notes/:id', authMiddlewares, controller.getById);
route.post('/notes', authMiddlewares, controller.create);
route.put('/notes/:id', authMiddlewares, controller.update);
route.patch('/notes/:id/unlink-todo', authMiddlewares, controller.unlinkFromTodo);
route.delete('/notes/:id', authMiddlewares, controller.delete);

module.exports = route;
