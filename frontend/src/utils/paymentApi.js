import api from '../../utils/api';

/**
 * Récupère la liste des plans disponibles côté backend.
 */
export const fetchPlans = async () => {
  try {
    const { data } = await api.get('/api/payment/plans');
    return data.plans || [];
  } catch (error) {
    console.error('Erreur lors de fetchPlans:', error);
    throw error;
  }
};

/**
 * Crée un PaymentIntent Stripe (paiement unique — conservé pour compatibilité).
 */
export const createPaymentIntent = async (planId, billingMode) => {
  try {
    const { data } = await api.post('/api/payment/create-intent', { planId, billingMode });
    return data;
  } catch (error) {
    console.error('Erreur lors de createPaymentIntent:', error);
    throw error;
  }
};

/**
 * Crée une session Stripe Checkout en mode abonnement et renvoie l'URL de redirection.
 * L'utilisateur doit être connecté. Redirection vers Stripe puis retour avec session_id.
 * @param {string} planId - 'pro' | 'premium'
 * @param {'monthly'|'yearly'} billingMode
 * @returns {Promise<{ url: string }>}
 */
export const createCheckoutSession = async (planId, billingMode) => {
  try {
    const { data } = await api.post('/api/payment/checkout-session', { planId, billingMode });
    return data;
  } catch (error) {
    console.error('Erreur lors de createCheckoutSession:', error);
    throw error;
  }
};

/**
 * Finalise l'abonnement après redirection Stripe (session_id dans l'URL).
 * @param {string} sessionId - session_id renvoyé par Stripe dans l'URL de succès
 */
export const subscriptionComplete = async (sessionId) => {
  try {
    const { data } = await api.post('/api/auth/subscription-complete', { session_id: sessionId });
    return data;
  } catch (error) {
    console.error('Erreur lors de subscriptionComplete:', error);
    throw error;
  }
};

/**
 * Met à jour l'abonnement côté backend (sans Stripe — fallback).
 */
export const updateSubscription = async (planId, billingMode) => {
  try {
    const { data } = await api.post('/api/auth/subscription', { planId, billingMode });
    return data;
  } catch (error) {
    console.error('Erreur lors de updateSubscription:', error);
    throw error;
  }
};

