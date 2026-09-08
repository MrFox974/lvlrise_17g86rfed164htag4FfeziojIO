const pushService = require('../services/push.service');
const User = require('../models/User');

// Liste blanche minimale : un fuseau IANA ressemble à 'Europe/Paris' ou 'UTC'.
const TIMEZONE_RE = /^[A-Za-z_]+(\/[A-Za-z0-9_+-]+){0,2}$/;

function isValidTimezone(tz) {
  if (typeof tz !== 'string' || !tz || tz.length > 64 || !TIMEZONE_RE.test(tz)) return false;
  try {
    new Intl.DateTimeFormat('fr-FR', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Clé publique VAPID : le navigateur en a besoin pour s'abonner. */
exports.getPublicKey = (req, res) => {
  const key = pushService.getPublicKey();
  if (!key) {
    return res.status(503).json({ error: 'Notifications non configurées sur le serveur' });
  }
  res.json({ publicKey: key });
};

/**
 * Enregistre l'abonnement du navigateur courant.
 * Body: { subscription: PushSubscriptionJSON, timezone?: 'Europe/Paris' }
 */
exports.subscribe = async (req, res) => {
  try {
    const userId = req.user_id;
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });

    const { subscription, timezone } = req.body || {};
    await pushService.saveSubscription(userId, subscription, req.headers['user-agent']);

    if (isValidTimezone(timezone)) {
      await User.update({ timezone }, { where: { id: userId } });
    }

    res.status(201).json({ ok: true });
  } catch (error) {
    if (error.status === 400) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Erreur lors de l\'abonnement push:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

/** Body: { endpoint }. Supprime l'abonnement de cet appareil. */
exports.unsubscribe = async (req, res) => {
  try {
    const userId = req.user_id;
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });

    await pushService.removeSubscription(userId, req.body?.endpoint);
    res.status(204).send();
  } catch (error) {
    console.error('Erreur lors du désabonnement push:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

/** État de l'abonnement côté serveur (utile pour l'écran de réglages). */
exports.getStatus = async (req, res) => {
  try {
    const userId = req.user_id;
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });

    const subscriptions = await pushService.getSubscriptions(userId);
    const user = await User.findByPk(userId, { attributes: ['timezone'] });

    res.json({
      configured: pushService.isConfigured(),
      devices: subscriptions.length,
      timezone: user?.timezone || null,
    });
  } catch (error) {
    console.error('Erreur lors de la lecture du statut push:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

/** Envoi de test sur les appareils de l'utilisateur. */
exports.sendTest = async (req, res) => {
  try {
    const userId = req.user_id;
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });

    const result = await pushService.sendToUser(userId, {
      title: 'LvlRise',
      body: 'Les notifications sont bien activées 🎉',
      tag: 'lvlrise-test',
      url: '/home/routines',
    });

    res.json(result);
  } catch (error) {
    console.error('Erreur lors de l\'envoi de test:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};
