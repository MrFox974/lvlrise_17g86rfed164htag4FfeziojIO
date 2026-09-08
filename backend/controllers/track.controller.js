const adminService = require('../services/admin.service');
const telegramService = require('../services/telegram.service');
let geoip;

function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) {
    // "client, proxy1, proxy2" -> client
    return xff.split(',')[0].trim();
  }
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) return realIp.trim();
  return req.ip || req.connection?.remoteAddress || null;
}

function safeLookupGeo(ip) {
  try {
    if (!ip) return null;
    geoip = geoip || require('geoip-lite');
    return geoip.lookup(ip) || null;
  } catch (e) {
    return null;
  }
}

/**
 * POST /api/track/page
 * Enregistre une visite de page (utilisateur authentifié ou non).
 */
exports.trackPage = async (req, res) => {
  try {
    const { path, client } = req.body || {};
    const userId = req.user_id || null;

    const normalizedPath = typeof path === 'string' ? path.trim() || '/' : '/';

    // Envoyer Telegram pour la landing AVANT la DB : en prod si la DB échoue, le message part quand même.
    if (normalizedPath === '/') {
      console.log('[Track] Landing visit (path=/) — envoi notification Telegram');
      const payload = {
        timestamp: new Date().toISOString(),
        userAgent: req.headers['user-agent'],
        acceptLanguage: req.headers['accept-language'],
        client: typeof client === 'object' && client ? client : undefined,
      };
      const sent = await telegramService.notifyLandingVisit(payload).catch((err) => {
        console.error('[Track] Telegram landing visit:', err);
        return false;
      });
      if (!sent) {
        console.warn('[Track] Telegram landing: message non envoyé (vérifier TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID en prod)');
      }
    }

    await adminService.trackPageVisit(normalizedPath, userId);
    res.json({ ok: true });
  } catch (error) {
    console.error('Erreur lors du tracking:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};
