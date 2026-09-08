const stripeService = require('../services/stripe.service');

/**
 * GET /api/payment/plans
 * Retourne la configuration des plans disponibles (montant, devise, etc.).
 */
exports.getPlans = async (req, res) => {
  try {
    const plans = stripeService.getPublicPlans();
    res.json({ plans });
  } catch (error) {
    console.error('Erreur lors de la récupération des plans Stripe:', error);
    res.status(500).json({
      error: 'Erreur serveur lors de la récupération des plans',
      details: error.message,
    });
  }
};

/**
 * POST /api/payment/create-intent
 * Body: { planId: 'pro', billingMode: 'monthly' | 'yearly' }
 * Crée un PaymentIntent Stripe et renvoie le clientSecret.
 */
exports.createPaymentIntent = async (req, res) => {
  try {
    const { planId, billingMode } = req.body || {};

    if (!planId) {
      return res.status(400).json({
        error: 'Le champ planId est requis',
      });
    }

    const intentInfo = await stripeService.createPaymentIntent(planId, billingMode);

    res.json(intentInfo);
  } catch (error) {
    console.error('Erreur lors de la création du PaymentIntent Stripe:', error);
    res.status(500).json({
      error: 'Erreur lors de la création de la demande de paiement',
      details: error.message,
    });
  }
};

/**
 * POST /api/payment/checkout-session (authentifié)
 * Body: { planId: 'pro' | 'premium', billingMode: 'monthly' | 'yearly' }
 * Crée une session Stripe Checkout en mode abonnement et renvoie l'URL de redirection.
 * Stripe redirige vers success_url avec session_id={CHECKOUT_SESSION_ID}.
 */
exports.createCheckoutSession = async (req, res) => {
  try {
    const userId = req.user_id;
    if (!userId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const { planId, billingMode } = req.body || {};

    if (!planId) {
      return res.status(400).json({
        error: 'Le champ planId est requis',
      });
    }

    const User = require('../models/User');
    const user = await User.findByPk(userId, { attributes: ['id', 'email'] });
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

    const baseFrontendUrl = (process.env.CORS_ORIGIN || 'http://localhost:5173')
      .trim()
      .replace(/\/$/, '');

    // Stripe remplace {CHECKOUT_SESSION_ID} dans l'URL de succès
    const successUrl = `${baseFrontendUrl}/plan/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseFrontendUrl}/plan?status=cancel&plan=${encodeURIComponent(planId)}`;

    const sessionInfo = await stripeService.createCheckoutSessionSubscription(
      planId,
      billingMode,
      userId,
      user.email,
      successUrl,
      cancelUrl
    );

    res.json({
      url: sessionInfo.url,
    });
  } catch (error) {
    console.error('Erreur lors de la création de la session Stripe Checkout:', error);
    res.status(500).json({
      error: 'Erreur lors de la création de la session de paiement',
      details: error.message,
    });
  }
};

