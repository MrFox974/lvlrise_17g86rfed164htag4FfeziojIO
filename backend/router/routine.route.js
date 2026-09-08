const express = require('express');
const route = express.Router();
const controller = require('../controllers/routine.controller');
const { authMiddlewares } = require('../middlewares/authMiddlewares');

route.get('/routines', authMiddlewares, controller.getAll);
route.get('/routines/calendar', authMiddlewares, controller.getCalendar);
route.get('/routines/similar', authMiddlewares, controller.getSimilarByLabel);
route.get('/routines/reminders', authMiddlewares, controller.getReminders);
route.post('/routines', authMiddlewares, controller.create);
route.post('/routines/create-for-other-days', authMiddlewares, controller.createForOtherDays);
route.put('/routines/reorder', authMiddlewares, controller.reorder);
route.patch('/routines/:id/toggle', authMiddlewares, controller.toggleDone);
route.put('/routines/:id/reminder', authMiddlewares, controller.setReminder);
route.delete('/routines/by-label', authMiddlewares, controller.deleteByLabel);
route.delete('/routines/:id', authMiddlewares, controller.deleteOne);

module.exports = route;
