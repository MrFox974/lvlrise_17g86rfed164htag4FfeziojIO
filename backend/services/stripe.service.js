const Stripe = require('stripe');

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

if (!STRIPE_SECRET_KEY) {
  console.warn('[StripeService] STRIPE_SECRET_KEY manquant. Les paiements ne fonctionneront pas.');
}

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

/**
 * IDs produits Stripe (dashboard Stripe) — un par plan et par fréquence.
 * Annuelle : Maîtrise = prod_Tz1y66mdry2KzQ, Croissance = prod_Tz1w2G6XdVhn7a
 * Mensuelle : Maîtrise = prod_Tz1xoULHROGghB, Croissance = prod_Tz1wWdbxmxlE6D
 */
const STRIPE_PRODUCT_IDS = {
  pro: {
    monthly: 'prod_U2L5Hxedo73B2b',
    yearly: 'prod_U2L5SSe8wTELFy',
  },
  premium: {
    monthly: 'prod_U2L50OfiU7tPkE',
    yearly: 'prod_U2L5eNxZXWMjCX',
  },
};

// Cache des price IDs (productId -> { month: price_xxx, year: price_xxx })
let priceIdCache = {};

// Définition des plans côté backend (pour affichage et fallback)
const PLANS = {
  free: {
    id: 'free',
    name: 'Découverte',
    monthlyAmount: 0,
    yearlyAmount: 0,
    currency: 'eur',
  },
  pro: {
    id: 'pro',
    name: 'Croissance',
    monthlyAmount: 699,
    yearlyAmount: 5999,
    currency: 'eur',
  },
  premium: {
    id: 'premium',
    name: 'Maîtrise',
    monthlyAmount: 999,
    yearlyAmount: 7999,
    currency: 'eur',
  },
};

/**
 * Récupère le price ID Stripe pour un plan et un mode de facturation.
 * Utilise les produits Stripe configurés et récupère le prix récurrent correspondant.
 */
async function getPriceIdForPlan(planId, billingMode) {
  const productId = STRIPE_PRODUCT_IDS[planId]?.[billingMode === 'yearly' ? 'yearly' : 'monthly'];
  if (!productId) {
    throw new Error(`Produit Stripe non configuré pour le plan ${planId} (${billingMode})`);
  }

  const cacheKey = productId;
  if (priceIdCache[cacheKey]) {
    const cached = priceIdCache[cacheKey];
    const priceId = billingMode === 'yearly' ? cached.year : cached.month;
    if (priceId) return priceId;
  }

  const { data: prices } = await stripe.prices.list({
    product: productId,
    active: true,
    type: 'recurring',
  });

  const byInterval = {};
  for (const p of prices) {
    if (p.recurring && p.recurring.interval) {
      byInterval[p.recurring.interval] = p.id;
    }
  }

  priceIdCache[cacheKey] = { month: byInterval.month || null, year: byInterval.year || null };
  const priceId = billingMode === 'yearly' ? byInterval.year : byInterval.month;
  if (!priceId) {
    throw new Error(`Aucun prix récurrent trouvé pour le produit ${productId} (${billingMode})`);
  }
  return priceId;
}

class StripeService {
  /**
   * Crée un PaymentIntent Stripe (paiement unique — conservé pour compatibilité).
   */
  async createPaymentIntent(planId, billingMode = 'monthly') {
    if (!stripe) {
      throw new Error('Stripe n\'est pas configuré côté serveur.');
    }

    const plan = PLANS[planId];
    if (!plan) {
      throw new Error('Plan invalide');
    }

    const normalizedMode = billingMode === 'yearly' ? 'yearly' : 'monthly';
    const amount =
      normalizedMode === 'yearly' ? plan.yearlyAmount : plan.monthlyAmount;

    if (!amount || amount === 0) {
      return {
        clientSecret: null,
        amount: 0,
        currency: plan.currency,
        free: true,
      };
    }

    try {
      const intent = await stripe.paymentIntents.create({
        amount,
        currency: plan.currency,
        automatic_payment_methods: { enabled: true },
        metadata: { planId: plan.id, planName: plan.name, billingMode: normalizedMode },
      });
      return {
        clientSecret: intent.client_secret,
        amount,
        currency: plan.currency,
        free: false,
      };
    } catch (error) {
      console.error('Erreur lors de la création du PaymentIntent Stripe:', error);
      throw new Error(`Impossible de créer le paiement: ${error.message}`);
    }
  }

  /**
   * Crée une session Stripe Checkout en mode abonnement (récurrent).
   * Utilise les produits Stripe configurés (IDs produit → prix récupérés via l’API).
   * @param {string} planId - 'pro' | 'premium'
   * @param {'monthly'|'yearly'} billingMode
   * @param {string} clientReferenceId - id utilisateur (pour après redirection)
   * @param {string} customerEmail - email du client
   * @param {string} successUrl - URL de succès (Stripe ajoute ?session_id={CHECKOUT_SESSION_ID})
   * @param {string} cancelUrl - URL d’annulation
   */
  async createCheckoutSessionSubscription(planId, billingMode, clientReferenceId, customerEmail, successUrl, cancelUrl) {
    if (!stripe) {
      throw new Error('Stripe n\'est pas configuré côté serveur.');
    }

    const plan = PLANS[planId];
    if (!plan || planId === 'free') {
      throw new Error('Plan invalide ou gratuit');
    }

    const normalizedMode = billingMode === 'yearly' ? 'yearly' : 'monthly';
    const priceId = await getPriceIdForPlan(planId, normalizedMode);

    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        client_reference_id: String(clientReferenceId),
        customer_email: customerEmail || undefined,
        subscription_data: {
          metadata: {
            planId: plan.id,
            planName: plan.name,
            billingMode: normalizedMode,
          },
        },
        allow_promotion_codes: true,
      });

      return { url: session.url, sessionId: session.id };
    } catch (error) {
      console.error('Erreur lors de la création de la session Checkout (abonnement):', error);
      throw new Error(`Impossible de créer la session de paiement: ${error.message}`);
    }
  }

  /**
   * Crée une session Stripe Checkout (paiement unique — ancien comportement).
   */
  async createCheckoutSession(planId, billingMode = 'monthly', successUrl, cancelUrl) {
    if (!stripe) {
      throw new Error('Stripe n\'est pas configuré côté serveur.');
    }

    const plan = PLANS[planId];
    if (!plan) {
      throw new Error('Plan invalide');
    }

    const normalizedMode = billingMode === 'yearly' ? 'yearly' : 'monthly';
    const amount =
      normalizedMode === 'yearly' ? plan.yearlyAmount : plan.monthlyAmount;

    if (!amount || amount === 0) {
      throw new Error('Aucun paiement requis pour ce plan.');
    }

    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency: plan.currency,
              unit_amount: amount,
              product_data: {
                name: `Plan ${plan.name} (${normalizedMode === 'yearly' ? 'annuel' : 'mensuel'})`,
              },
            },
            quantity: 1,
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
      });
      return { url: session.url };
    } catch (error) {
      console.error('Erreur lors de la création de la session Stripe Checkout:', error);
      throw new Error(`Impossible de créer la session de paiement: ${error.message}`);
    }
  }

  /**
   * Récupère une session Checkout et l’abonnement associé (pour finaliser après redirection).
   */
  async retrieveCheckoutSession(sessionId) {
    if (!stripe) {
      throw new Error('Stripe n\'est pas configuré côté serveur.');
    }
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    });
    return session;
  }

  /**
   * Annule un abonnement Stripe (fin de période ou immédiat).
   * @param {string} subscriptionId - stripe_subscription_id
   * @param {boolean} atPeriodEnd - true = annuler en fin de période
   */
  async cancelSubscription(subscriptionId, atPeriodEnd = true) {
    if (!stripe) {
      throw new Error('Stripe n\'est pas configuré côté serveur.');
    }
    if (atPeriodEnd) {
      await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
      return { cancelledAtPeriodEnd: true };
    }
    await stripe.subscriptions.cancel(subscriptionId);
    return { cancelledAtPeriodEnd: false };
  }

  getPublicPlans() {
    return Object.values(PLANS).map((plan) => ({
      id: plan.id,
      name: plan.name,
      monthlyAmount: plan.monthlyAmount,
      yearlyAmount: plan.yearlyAmount,
      currency: plan.currency,
    }));
  }
}

module.exports = new StripeService();
