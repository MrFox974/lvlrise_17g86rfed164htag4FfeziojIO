const express = require('express');
const route = express.Router();
const controller = require('../controllers/stats.controller');
const { authMiddlewares } = require('../middlewares/authMiddlewares');

route.get('/stats', authMiddlewares, controller.getStats);

module.exports = route;
