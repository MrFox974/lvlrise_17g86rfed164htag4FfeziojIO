const express = require('express');
const route = express.Router();
const trackController = require('../controllers/track.controller');
const { authOptional } = require('../middlewares/authMiddlewares');

route.post('/track/page', authOptional, trackController.trackPage);

module.exports = route;
