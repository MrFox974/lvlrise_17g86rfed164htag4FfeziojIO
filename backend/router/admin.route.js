const express = require('express');
const route = express.Router();
const adminController = require('../controllers/admin.controller');
const { authMiddlewares } = require('../middlewares/authMiddlewares');

route.get(
  '/admin/events',
  authMiddlewares,
  adminController.requireAdmin,
  adminController.getEvents
);
route.get(
  '/admin/stats',
  authMiddlewares,
  adminController.requireAdmin,
  adminController.getStats
);
route.get(
  '/admin/telegram-test',
  authMiddlewares,
  adminController.requireAdmin,
  adminController.telegramTest
);
route.get(
  '/admin/push-diagnostics',
  authMiddlewares,
  adminController.requireAdmin,
  adminController.pushDiagnostics
);
route.post(
  '/admin/push-test',
  authMiddlewares,
  adminController.requireAdmin,
  adminController.pushTest
);

module.exports = route;
