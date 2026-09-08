const express = require('express');
const route = express.Router();
const controller = require('../controllers/learning-gauge.controller');
const { authMiddlewares } = require('../middlewares/authMiddlewares');

route.get('/learning-gauges', authMiddlewares, controller.getGauges);
route.get('/learning-gauges/daily', authMiddlewares, controller.getGaugeDaily);
route.put('/learning-gauges', authMiddlewares, controller.updateGauge);

module.exports = route;
