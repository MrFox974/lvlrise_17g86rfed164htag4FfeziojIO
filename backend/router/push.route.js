const express = require('express');
const route = express.Router();
const controller = require('../controllers/push.controller');
const { authMiddlewares } = require('../middlewares/authMiddlewares');

// Clé publique : pas de token requis, elle est destinée à être publique.
route.get('/push/public-key', controller.getPublicKey);
route.get('/push/status', authMiddlewares, controller.getStatus);
route.post('/push/subscribe', authMiddlewares, controller.subscribe);
route.post('/push/test', authMiddlewares, controller.sendTest);
route.delete('/push/subscribe', authMiddlewares, controller.unsubscribe);

module.exports = route;
