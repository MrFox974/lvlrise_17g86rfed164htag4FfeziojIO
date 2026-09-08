const authService = require('../services/auth.service');
const User = require('../models/User');
const adminService = require('../services/admin.service');
const telegramService = require('../services/telegram.service');
const stripeService = require('../services/stripe.service');

const REFRESH_TOKEN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
};

/**
 * Inscription
 */
exports.register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        error: 'Le nom d\'utilisateur, l\'email et le mot de passe sont requis.',
      });
    }

    const usernameTrimmed = username.trim();
    if (usernameTrimmed.length < 3) {
      return res.status(400).json({
        error: 'Le nom d\'utilisateur doit contenir au moins 3 caractères.',
      });
    }

    const emailTrimmed = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailTrimmed)) {
      return res.status(400).json({
        error: 'Format d\'email invalide.',
      });
    }

    const passwordRules = [
      { test: (p) => p.length >= 8, error: 'Le mot de passe doit contenir au moins 8 caractères.' },
      { test: (p) => /[A-Z]/.test(p), error: 'Le mot de passe doit contenir au moins une majuscule.' },
      { test: (p) => /[a-z]/.test(p), error: 'Le mot de passe doit contenir au moins une minuscule.' },
      { test: (p) => /\d/.test(p), error: 'Le mot de passe doit contenir au moins un chiffre.' },
      { test: (p) => /[!@#$%^&*(),.?":{}|<>]/.test(p), error: 'Le mot de passe doit contenir au moins un caractère spécial (!@#$%^&*).' },
    ];
    for (const rule of passwordRules) {
      if (!rule.test(password)) {
        return res.status(400).json({ error: rule.error });
      }
    }

    const result = await authService.register(usernameTrimmed, emailTrimmed, password);

    await adminService.logEvent('user_registered', {
      username: result.username,
      email: result.email,
      pending_verification: true,
    }, null);
    await telegramService.notifyNewRegistration({ username: result.username, email: result.email }).catch((err) => {
      console.error('[Auth] Telegram inscription:', err);
    });

    res.status(201).json({
      success: true,
      email: result.email,
      message: 'Un email de vérification a été envoyé à votre adresse. Cliquez sur le lien pour activer votre compte.',
    });
  } catch (error) {
    if (error.message?.includes('existe déjà') || error.message?.includes('déjà pris')) {
      return res.status(409).json({ error: error.message });
    }
    console.error('Erreur lors de l\'inscription:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      details: error.message,
    });
  }
};

/**
 * Vérification de l'adresse email (via token reçu par email)
 */
exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Token de vérification requis.' });
    }

    const result = await authService.verifyEmail(token.trim());

    res.cookie('refreshToken', result.refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);
    res.status(200).json({
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
  } catch (error) {
    if (error.message?.includes('invalide') || error.message?.includes('expiré')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Erreur lors de la vérification email:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      details: error.message,
    });
  }
};

/**
 * Renvoi de l'email de vérification
 */
exports.resendVerificationEmail = async (req, res) => {
  try {
    const { email } = req.body;
    await authService.resendVerificationEmail(email);
    res.status(200).json({ success: true, message: 'Un nouvel email de vérification a été envoyé.' });
  } catch (error) {
    if (error.message?.includes('déjà vérifiée') || error.message?.includes('Aucun compte')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Erreur lors du renvoi email vérification:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      details: error.message,
    });
  }
};

/**
 * Connexion
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'L\'email et le mot de passe sont requis.',
      });
    }

    const result = await authService.login(email.trim().toLowerCase(), password);

    res.cookie('refreshToken', result.refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);
    res.json({
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
  } catch (error) {
    if (error.message?.includes('incorrect') || error.message?.includes('invalide')) {
      return res.status(401).json({ error: error.message });
    }
    console.error('Erreur lors de la connexion:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      details: error.message,
    });
  }
};

/**
 * Connexion via Google (idToken du SDK Google Identity)
 */
exports.loginWithGoogle = async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken || typeof idToken !== 'string') {
      return res.status(400).json({ error: 'Le token Google est requis.' });
    }

    const result = await authService.loginWithGoogle(idToken);

    if (result.isNewUser) {
      await adminService.logEvent('user_registered', {
        username: result.user.username,
        email: result.user.email,
        provider: 'google',
      }, result.user.id);
      await telegramService.notifyNewRegistration(result.user).catch((err) => {
        console.error('[Auth] Telegram inscription Google:', err);
      });
    }

    res.cookie('refreshToken', result.refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);
    res.json({
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
  } catch (error) {
    if (error.message?.includes('email') || error.message?.includes('déjà utilisé')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Erreur lors de la connexion Google:', error);
    res.status(500).json({
      error: 'Erreur lors de la connexion avec Google',
      details: error.message,
    });
  }
};

/**
 * Connexion via Apple (identityToken + userName optionnel à la première connexion)
 */
exports.loginWithApple = async (req, res) => {
  try {
    const { idToken, userName } = req.body;
    if (!idToken || typeof idToken !== 'string') {
      return res.status(400).json({ error: 'Le token Apple est requis.' });
    }

    const result = await authService.loginWithApple(idToken, userName || null);

    if (result.isNewUser) {
      await adminService.logEvent('user_registered', {
        username: result.user.username,
        email: result.user.email,
        provider: 'apple',
      }, result.user.id);
      await telegramService.notifyNewRegistration(result.user).catch((err) => {
        console.error('[Auth] Telegram inscription Apple:', err);
      });
    }

    res.cookie('refreshToken', result.refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);
    res.json({
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
  } catch (error) {
    if (error.message?.includes('email') || error.message?.includes('déjà utilisé')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Erreur lors de la connexion Apple:', error);
    res.status(500).json({
      error: 'Erreur lors de la connexion avec Apple',
      details: error.message,
    });
  }
};

/**
 * Rafraîchissement du token
 */
exports.refresh = async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

    const result = await authService.refresh(refreshToken);

    if (result.refreshToken) {
      res.cookie('refreshToken', result.refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);
    }
    res.json({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken || undefined,
    });
  } catch (error) {
    if (error.message?.includes('manquant') || error.message?.includes('expiré') || error.message?.includes('invalide')) {
      return res.status(401).json({ error: error.message });
    }
    console.error('Erreur lors du refresh:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      details: error.message,
    });
  }
};

/**
 * Profil de l'utilisateur connecté (pour restauration après actualisation)
 * Retourne 401 si utilisateur introuvable (token invalide ou compte supprimé) pour que le front déconnecte.
 */
exports.getMe = async (req, res) => {
  try {
    const userId = req.user_id;
    if (!userId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }
    const user = await User.findByPk(userId, {
      attributes: [
        'id', 'username', 'email', 'subscription_plan', 'auth_provider', 'email_verified',
        'subscription_current_period_start', 'subscription_current_period_end',
        'home_cards_order',
      ],
    });
    if (!user) {
      return res.status(401).json({ error: 'Session invalide ou compte supprimé' });
    }
    res.json({ user: user.toJSON ? user.toJSON() : user });
  } catch (error) {
    console.error('Erreur lors de getMe:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

/**
 * Changement de mot de passe (utilisateur authentifié)
 */
exports.changePassword = async (req, res) => {
  try {
    const userId = req.user_id;
    if (!userId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: 'Le mot de passe actuel et le nouveau mot de passe sont requis.',
      });
    }

    await authService.changePassword(userId, currentPassword, newPassword);
    res.json({ success: true, message: 'Mot de passe modifié.' });
  } catch (error) {
    if (error.message?.includes('incorrect') || error.message?.includes('ne respecte pas')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Erreur lors du changement de mot de passe:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      details: error.message,
    });
  }
};

/**
 * Mise à jour du plan d'abonnement de l'utilisateur connecté.
 */
/**
 * Suppression définitive du compte (avec confirmation "Je confirme").
 * Résilie l'abonnement si payant, puis supprime toutes les données.
 */
exports.deleteAccount = async (req, res) => {
  try {
    const userId = req.user_id;
    if (!userId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const { confirmation } = req.body || {};

    if (confirmation !== 'Je confirme') {
      return res.status(400).json({
        error: 'Vous devez taper "Je confirme" pour valider la suppression.',
      });
    }

    await authService.deleteAccount(userId);

    res.json({ success: true, message: 'Compte supprimé avec succès.' });
  } catch (error) {
    console.error('Erreur lors de la suppression du compte:', error);
    res.status(500).json({
      error: 'Erreur serveur lors de la suppression du compte',
      details: error.message,
    });
  }
};

/**
 * Mise à jour du plan d'abonnement de l'utilisateur connecté.
 */
exports.updateSubscription = async (req, res) => {
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

    const allowedPlans = ['free', 'pro', 'premium'];
    if (!allowedPlans.includes(planId)) {
      return res.status(400).json({
        error: 'Plan d\'abonnement invalide',
      });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

    const previousPlan = user.subscription_plan || 'free';
    const isUpgrade = ['free', 'pro', 'premium'].indexOf(planId) > ['free', 'pro', 'premium'].indexOf(previousPlan) ||
      (previousPlan === 'free' && planId !== 'free');

    user.subscription_plan = planId;
    await user.save();

    await adminService.logEvent('subscription_change', {
      previous_plan: previousPlan,
      new_plan: planId,
      is_upgrade: isUpgrade,
    }, userId);

    if (planId !== 'free' && (previousPlan === 'free' || isUpgrade)) {
      const userData = await User.findByPk(userId, { attributes: ['email', 'username'] });
      await telegramService.notifySubscription({
        email: userData?.email,
        username: userData?.username,
        planId,
        billingMode: billingMode || 'yearly',
        previousPlan: previousPlan !== planId ? previousPlan : undefined,
        isUpgrade: isUpgrade && previousPlan !== 'free',
      }).catch((err) => {
        console.error('[Auth] Telegram abonnement:', err);
      });
    }

    res.json({
      success: true,
      subscription_plan: user.subscription_plan,
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour de l\'abonnement utilisateur:', error);
    res.status(500).json({
      error: 'Erreur serveur lors de la mise à jour de l\'abonnement',
      details: error.message,
    });
  }
};

/**
 * Finalise l'abonnement après redirection Stripe Checkout (session_id).
 * Récupère la session, l'abonnement Stripe, et met à jour l'utilisateur.
 */
exports.subscriptionComplete = async (req, res) => {
  try {
    const userId = req.user_id;
    if (!userId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const { session_id } = req.body || {};
    if (!session_id || typeof session_id !== 'string') {
      return res.status(400).json({ error: 'session_id requis' });
    }

    const session = await stripeService.retrieveCheckoutSession(session_id.trim());
    if (session.payment_status !== 'paid' && session.status !== 'complete') {
      return res.status(400).json({ error: 'Paiement non finalisé' });
    }

    let subscriptionId = session.subscription;
    const customerId = session.customer;
    if (!subscriptionId) {
      return res.status(400).json({ error: 'Abonnement introuvable dans la session' });
    }

    const sub = typeof subscriptionId === 'object' ? subscriptionId : null;
    const subId = typeof subscriptionId === 'string' ? subscriptionId : subscriptionId?.id;
    const planId = (sub?.metadata?.planId || session.subscription_data?.metadata?.planId) || 'pro';
    let periodStart = sub?.current_period_start ? new Date(sub.current_period_start * 1000) : null;
    let periodEnd = sub?.current_period_end ? new Date(sub.current_period_end * 1000) : null;
    if (!sub && subId) {
      const Stripe = require('stripe');
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      const subscription = await stripe.subscriptions.retrieve(subId);
      periodStart = subscription.current_period_start ? new Date(subscription.current_period_start * 1000) : null;
      periodEnd = subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : null;
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

    const previousPlan = user.subscription_plan || 'free';
    await user.update({
      subscription_plan: planId,
      stripe_customer_id: customerId || user.stripe_customer_id,
      stripe_subscription_id: subId,
      subscription_current_period_start: periodStart,
      subscription_current_period_end: periodEnd,
    });

    await adminService.logEvent('subscription_change', {
      previous_plan: previousPlan,
      new_plan: planId,
      is_upgrade: true,
      source: 'stripe_checkout',
    }, userId);

    const billingMode = (sub?.metadata?.billingMode) || 'yearly';
    const userData = await User.findByPk(userId, { attributes: ['email', 'username'] });
    await telegramService.notifySubscription({
      email: userData?.email,
      username: userData?.username,
      planId,
      billingMode,
      previousPlan: previousPlan !== planId ? previousPlan : undefined,
      isUpgrade: true,
    }).catch((err) => {
      console.error('[Auth] Telegram abonnement:', err);
    });

    res.json({
      success: true,
      subscription_plan: planId,
      subscription_current_period_start: periodStart,
      subscription_current_period_end: periodEnd,
    });
  } catch (error) {
    console.error('Erreur lors de subscriptionComplete:', error);
    res.status(500).json({
      error: 'Erreur lors de la finalisation de l\'abonnement',
      details: error.message,
    });
  }
};

/**
 * Désabonnement : annulation Stripe (fin de période) + passage au plan gratuit.
 */
exports.unsubscribe = async (req, res) => {
  try {
    const userId = req.user_id;
    if (!userId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const { reason } = req.body || {};
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

    const previousPlan = user.subscription_plan || 'free';
    if (previousPlan === 'free') {
      return res.json({ success: true, subscription_plan: 'free', message: 'Déjà sur le plan gratuit.' });
    }

    if (user.stripe_subscription_id) {
      try {
        await stripeService.cancelSubscription(user.stripe_subscription_id, true);
      } catch (err) {
        console.error('[Auth] Erreur annulation Stripe:', err);
      }
    }

    await adminService.logEvent('unsubscription', {
      previous_plan: previousPlan,
      reason: reason || null,
    }, userId);

    await user.update({
      subscription_plan: 'free',
      stripe_subscription_id: null,
      subscription_current_period_start: null,
      subscription_current_period_end: null,
    });

    const userData = await User.findByPk(userId, { attributes: ['email', 'username'] });
    await telegramService.notifyUnsubscription({
      email: userData?.email,
      username: userData?.username,
      previousPlan,
      reason: reason || undefined,
    }).catch((err) => {
      console.error('[Auth] Telegram désabonnement:', err);
    });

    res.json({
      success: true,
      subscription_plan: 'free',
      message: 'Abonnement résilié. Vous restez sur le plan jusqu\'à la fin de la période en cours, puis vous passerez au plan Découverte.',
    });
  } catch (error) {
    console.error('Erreur lors du désabonnement:', error);
    res.status(500).json({
      error: 'Erreur serveur lors du désabonnement',
      details: error.message,
    });
  }
};

/**
 * Mise à jour de l'ordre des cartes de la vue d'ensemble
 */
exports.updateHomeCardsOrder = async (req, res) => {
  try {
    const userId = req.user_id;
    if (!userId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const { order } = req.body;
    const valid = ['priorities', 'learning', 'routines'];

    if (!Array.isArray(order) || order.length !== 3 || !order.every(id => valid.includes(id))) {
      return res.status(400).json({ error: 'Ordre de cartes invalide.' });
    }

    await User.update({ home_cards_order: order }, { where: { id: userId } });

    res.json({ success: true, order });
  } catch (error) {
    console.error('Erreur lors de la mise à jour de l\'ordre des cartes:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};