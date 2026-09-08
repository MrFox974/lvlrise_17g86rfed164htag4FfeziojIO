const express = require('express');
const route = express.Router();
const controller = require('../controllers/domain.controller');
const { authMiddlewares } = require('../middlewares/authMiddlewares');

route.get('/domains', authMiddlewares, controller.getAll);
route.post('/domains', authMiddlewares, controller.create);
route.put('/domains/reorder', authMiddlewares, controller.reorder);
route.put('/domains/:id', authMiddlewares, controller.update);
route.delete('/domains/:id', authMiddlewares, controller.delete);

module.exports = route;
