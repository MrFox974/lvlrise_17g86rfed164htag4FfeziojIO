const express = require('express');
const route = express.Router();
const controller = require('../controllers/upload.controller');
const { authMiddlewares } = require('../middlewares/authMiddlewares');

route.get('/uploads/config', authMiddlewares, controller.getConfig);
route.get('/uploads', authMiddlewares, controller.list);
route.post('/uploads/presign', authMiddlewares, controller.presign);
route.post('/uploads/:id/complete', authMiddlewares, controller.complete);
route.delete('/uploads/:id', authMiddlewares, controller.remove);

module.exports = route;
