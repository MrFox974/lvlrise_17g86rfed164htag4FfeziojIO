/**
 * Service d'envoi de notifications Telegram.
 * Utilise les variables d'environnement TELEGRAM_BOT_TOKEN et TELEGRAM_CHAT_ID.
 * Utilise le module https natif (plus fiable en Lambda que fetch).
 */
const https = require('https');

/** Nettoie une valeur d'env (retire espaces et retours à la ligne, fréquents quand copié depuis GitHub Secrets). */
function sanitizeEnv(value) {
  if (value == null || typeof value !== 'string') return '';
  return value.replace(/\r?\n/g, '').trim();
}

function sendTelegramMessage(text) {
  return new Promise((resolve) => {
    const token = sanitizeEnv(process.env.TELEGRAM_BOT_TOKEN);
    const chatId = sanitizeEnv(process.env.TELEGRAM_CHAT_ID);

    if (!token || !chatId) {
      console.warn('[TelegramService] TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID manquant.', {
        hasToken: !!token,
        hasChatId: !!chatId,
      });
      return resolve(false);
    }

    const payload = JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    });

    const options = {
      hostname: 'api.telegram.org',
      path: `/bot${token}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.ok) {
            console.log('[TelegramService] Message envoyé avec succès');
            resolve(true);
          } else {
            console.error('[TelegramService] Erreur API Telegram:', parsed);
            resolve(false);
          }
        } catch (e) {
          console.error('[TelegramService] Réponse invalide:', data);
          resolve(false);
        }
      });
    });

    req.on('error', (err) => {
      console.error('[TelegramService] Erreur réseau:', err);
      resolve(false);
    });

    req.setTimeout(10000, () => {
      req.destroy();
      console.error('[TelegramService] Timeout');
      resolve(false);
    });

    req.write(payload);
    req.end();
  });
}

function escapeHtml(str) {
  if (!str || typeof str !== 'string') return 'N/A';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function truncateTelegramText(text, maxLen = 3900) {
  if (typeof text !== 'string') return '';
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 20) + '\n\n…(tronqué)';
}

/** Retourne une date/heure formatée en français (ex. 12/03/2026 16:03:45). */
function formatDateTime(timestamp, timeZone = 'UTC') {
  try {
    const d = timestamp ? new Date(timestamp) : new Date();
    return d.toLocaleString('fr-FR', {
      timeZone: timeZone || 'UTC',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch (e) {
    return new Date().toISOString();
  }
}

/** Extrait un libellé court du User-Agent (ex. Chrome 121, Safari, Firefox). */
function getBrowserLabel(userAgent) {
  if (!userAgent || typeof userAgent !== 'string') return 'N/A';
  const ua = userAgent;
  const match = ua.match(/(Chrome|Firefox|Safari|Edge|Opera|OPR)[\/\s](\d+)/i)
    || ua.match(/(MSIE|Trident)/i);
  if (match) {
    const name = match[1] === 'OPR' ? 'Opera' : match[1];
    const ver = match[2] || '';
    return ver ? `${name} ${ver}` : name;
  }
  return ua.length > 60 ? ua.slice(0, 60) + '…' : ua;
}

/**
 * Notifie une nouvelle inscription.
 * @param {object} user - { username, email }
 */
async function notifyNewRegistration(user) {
  const text = `🎉 <b>Nouvelle inscription !</b>\n\n👤 ${escapeHtml(user?.username)}\n📧 ${escapeHtml(user?.email)}\n\n✨ Bienvenue à bord !`;
  return sendTelegramMessage(text);
}

/**
 * Notifie une visite sur la landing (page d'accueil).
 * Message simplifié : Visiteur + date/heure, navigateur, langue, TZ, plateforme.
 * @param {object} data - { timestamp?, userAgent?, client?: { timezone, language, platform } }
 */
async function notifyLandingVisit(data = {}) {
  const c = data.client || {};
  const tz = c.timezone || 'UTC';
  const dateTimeStr = formatDateTime(data.timestamp || Date.now(), tz);
  const browser = getBrowserLabel(data.userAgent);
  const language = c.language || data.acceptLanguage || 'N/A';
  const platform = c.platform || 'N/A';

  const lines = [];
  lines.push(`👋 <b>Visiteur…</b> ${escapeHtml(dateTimeStr)}`);
  lines.push(`🌐 Navigateur: ${escapeHtml(browser)}`);
  lines.push(`🗣️ Langue: ${escapeHtml(String(language))}`);
  lines.push(`🕰️ TZ: ${escapeHtml(String(tz))}`);
  lines.push(`💻 Plateforme: ${escapeHtml(String(platform))}`);

  const text = lines.join('\n');
  return sendTelegramMessage(text);
}

const PLAN_PRICES = {
  pro: { monthly: 6.99, yearly: 59.99 },
  premium: { monthly: 9.99, yearly: 79.99 },
};

/**
 * Notifie un nouvel abonnement ou upgrade.
 * @param {object} data - { email, username, planId, billingMode?, previousPlan?, isUpgrade }
 */
async function notifySubscription(data) {
  const { email, username, planId, billingMode, previousPlan, isUpgrade } = data;
  const planLabel = { free: 'Découverte', pro: 'Croissance', premium: 'Maîtrise' }[planId] || planId;

  let action = isUpgrade ? '🚀 <b>Upgrade d\'abonnement !</b>' : '💎 <b>Nouvel abonnement !</b>';
  let text = `${action}\n\n👤 ${escapeHtml(username)}\n📧 ${escapeHtml(email)}\n📦 Plan: ${planLabel}\n\n`;

  const prices = PLAN_PRICES[planId];
  if (prices && billingMode) {
    const amount = billingMode === 'yearly' ? prices.yearly : prices.monthly;
    const period = billingMode === 'yearly' ? '/an' : '/mois';
    text += `💵 Montant: ${amount.toFixed(2)} € ${period}\n🔥\n\n`;
  }

  text += '🎊 Super nouvelle !';
  if (isUpgrade && previousPlan) {
    const prevLabel = { free: 'Découverte', pro: 'Croissance', premium: 'Maîtrise' }[previousPlan] || previousPlan;
    text += `\n(avant: ${prevLabel} → maintenant: ${planLabel})`;
  }

  return sendTelegramMessage(text);
}

/**
 * Notifie un désabonnement.
 * @param {object} data - { email, username, previousPlan, reason? }
 */
async function notifyUnsubscription(data) {
  const { email, username, previousPlan, reason } = data;
  const planLabel = { free: 'Découverte', pro: 'Croissance', premium: 'Maîtrise' }[previousPlan] || previousPlan;
  const text = `😔 <b>Désabonnement</b>\n\n👤 ${escapeHtml(username)}\n📧 ${escapeHtml(email)}\n📦 Ancien plan: ${planLabel}${reason ? `\n💬 Raison: ${escapeHtml(reason)}` : ''}`;
  return sendTelegramMessage(text);
}

/**
 * Test d'envoi : envoie un message de test et retourne le résultat détaillé.
 * Pour debug uniquement.
 */
function sendTestMessage() {
  return new Promise((resolve) => {
    const token = sanitizeEnv(process.env.TELEGRAM_BOT_TOKEN);
    const chatId = sanitizeEnv(process.env.TELEGRAM_CHAT_ID);
    const result = { hasToken: !!token, hasChatId: !!chatId };
    if (!token || !chatId) {
      result.success = false;
      result.error = 'Variables d\'environnement manquantes';
      return resolve(result);
    }

    const payload = JSON.stringify({
      chat_id: chatId,
      text: '🧪 Test SmartLearn – Si vous voyez ce message, Telegram fonctionne !',
      parse_mode: 'HTML',
    });

    const options = {
      hostname: 'api.telegram.org',
      path: `/bot${token}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          result.telegramResponse = JSON.parse(data);
          result.success = result.telegramResponse.ok === true;
          if (!result.success) {
            result.error = result.telegramResponse.description || 'Erreur inconnue';
          }
        } catch (e) {
          result.success = false;
          result.error = 'Réponse invalide: ' + data;
        }
        resolve(result);
      });
    });

    req.on('error', (err) => {
      result.success = false;
      result.error = err.message;
      resolve(result);
    });

    req.setTimeout(10000, () => {
      req.destroy();
      result.success = false;
      result.error = 'Timeout';
      resolve(result);
    });

    req.write(payload);
    req.end();
  });
}

module.exports = {
  sendTelegramMessage,
  sendTestMessage,
  notifyNewRegistration,
  notifyLandingVisit,
  notifySubscription,
  notifyUnsubscription,
};
