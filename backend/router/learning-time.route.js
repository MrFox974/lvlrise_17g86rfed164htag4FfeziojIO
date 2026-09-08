const express = require('express');
const route = express.Router();
const controller = require('../controllers/learning-time.controller');
const { authMiddlewares } = require('../middlewares/authMiddlewares');

route.get('/learning-time/daily', authMiddlewares, controller.getDaily);
route.post('/learning-time', authMiddlewares, controller.upsert);

module.exports = route;
