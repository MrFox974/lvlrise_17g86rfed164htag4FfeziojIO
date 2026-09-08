const adminService = require('../services/admin.service');
const telegramService = require('../services/telegram.service');
const pushService = require('../services/push.service');
const notificationScheduler = require('../services/notification-scheduler.service');
const User = require('../models/User');

/**
 * Middleware : vérifie que l'utilisateur a l'abonnement admin.
 * À appeler après authMiddlewares.
 */
async function requireAdmin(req, res, next) {
  try {
    const userId = req.user_id;
    if (!userId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const user = await User.findByPk(userId, {
      attributes: ['subscription_plan'],
    });
    if (!user || !adminService.isAdminSubscription(user.subscription_plan)) {
      return res.status(403).json({ error: 'Accès administrateur requis' });
    }

    next();
  } catch (error) {
    console.error('Erreur requireAdmin:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
}

/**
 * GET /api/admin/events
 * Liste des événements (logs) en ordre chronologique.
 */
exports.getEvents = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 200);
    const offset = parseInt(req.query.offset, 10) || 0;

    const events = await adminService.getEvents(limit, offset);
    res.json({ events });
  } catch (error) {
    console.error('Erreur lors de la récupération des événements:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      details: error.message,
    });
  }
};

/**
 * GET /api/admin/telegram-test
 * Envoie un message de test Telegram et retourne le résultat (pour debug).
 */
exports.telegramTest = async (req, res) => {
  try {
    const result = await telegramService.sendTestMessage();
    res.json(result);
  } catch (error) {
    console.error('Erreur telegram-test:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * GET /api/admin/push-diagnostics
 * État des notifications pour le compte admin : configuration serveur,
 * appareils abonnés, fuseau détecté et programme du jour.
 */
exports.pushDiagnostics = async (req, res) => {
  try {
    const plan = await notificationScheduler.getDailyPlan(req.user_id);
    if (!plan) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }
    res.json(plan);
  } catch (error) {
    console.error('Erreur push-diagnostics:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

/**
 * POST /api/admin/push-test
 * Body: { kind } — envoie sur les appareils de l'admin la notification réelle
 * du type demandé, construite avec les données de son compte. Ne passe pas par
 * le journal anti-doublon : rejouable autant de fois que nécessaire.
 */
exports.pushTest = async (req, res) => {
  try {
    const kinds = Object.values(notificationScheduler.KINDS);
    const kind = req.body?.kind;
    if (!kinds.includes(kind)) {
      return res.status(400).json({
        success: false,
        error: `Type inconnu. Valeurs possibles : ${kinds.join(', ')}`,
      });
    }

    const payload = await notificationScheduler.previewNotification(req.user_id, kind);
    if (!payload) {
      return res.status(500).json({ success: false, error: 'Message non généré' });
    }

    const result = await pushService.sendToUser(req.user_id, payload);
    res.json({
      success: result.sent > 0,
      sent: result.sent,
      failed: result.failed,
      configured: pushService.isConfigured(),
      payload,
    });
  } catch (error) {
    console.error('Erreur push-test:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * GET /api/admin/stats
 * Statistiques commerciales.
 */
exports.getStats = async (req, res) => {
  try {
    const stats = await adminService.getStats();
    res.json(stats);
  } catch (error) {
    console.error('Erreur lors de la récupération des stats:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      details: error.message,
    });
  }
};

exports.requireAdmin = requireAdmin;
