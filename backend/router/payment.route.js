const express = require('express');
const route = express.Router();
const paymentController = require('../controllers/payment.controller');
const { authMiddlewares } = require('../middlewares/authMiddlewares');

route.get('/payment/plans', paymentController.getPlans);
route.post('/payment/create-intent', paymentController.createPaymentIntent);
route.post('/payment/checkout-session', authMiddlewares, paymentController.createCheckoutSession);

module.exports = route;

