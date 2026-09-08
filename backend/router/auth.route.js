const express = require('express');
const route = express.Router();
const authController = require('../controllers/auth.controller');
const { authMiddlewares } = require('../middlewares/authMiddlewares');

route.post('/auth/register', authController.register);
route.post('/auth/verify-email', authController.verifyEmail);
route.post('/auth/resend-verification', authController.resendVerificationEmail);
route.post('/auth/login', authController.login);
route.post('/auth/google', authController.loginWithGoogle);
route.post('/auth/apple', authController.loginWithApple);
route.post('/auth/refresh', authController.refresh);
route.get('/auth/me', authMiddlewares, authController.getMe);
route.post('/auth/change-password', authMiddlewares, authController.changePassword);
route.post('/auth/subscription', authMiddlewares, authController.updateSubscription);
route.post('/auth/subscription-complete', authMiddlewares, authController.subscriptionComplete);
route.post('/auth/unsubscribe', authMiddlewares, authController.unsubscribe);
route.post('/auth/delete-account', authMiddlewares, authController.deleteAccount);
route.put('/auth/home-cards-order', authMiddlewares, authController.updateHomeCardsOrder);

module.exports = route;
