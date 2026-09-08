const webpush = require('web-push');
const { Op } = require('sequelize');
const PushSubscription = require('../models/PushSubscription');

const VAPID_PUBLIC_KEY = (process.env.VAPID_PUBLIC_KEY || '').trim();
const VAPID_PRIVATE_KEY = (process.env.VAPID_PRIVATE_KEY || '').trim();
const VAPID_SUBJECT = (process.env.VAPID_SUBJECT || 'mailto:contact@lvlrise.com').trim();

// La connexion à Postgres est limitée à 1 socket (config/database.js) : on envoie
// par petits lots pour ne pas saturer la Lambda ni les serveurs de push.
const BATCH_SIZE = 25;

let configured = false;

function isConfigured() {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false;
  if (!configured) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    configured = true;
  }
  return true;
}

function getPublicKey() {
  return VAPID_PUBLIC_KEY;
}

/**
 * Enregistre (ou rafraîchit) l'abonnement d'un navigateur.
 * Un même endpoint peut changer de propriétaire si l'appareil est partagé :
 * on réattribue la ligne au dernier utilisateur connecté.
 */
async function saveSubscription(userId, subscription, userAgent) {
  const endpoint = subscription?.endpoint;
  const p256dh = subscription?.keys?.p256dh;
  const auth = subscription?.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    const error = new Error('Abonnement push incomplet');
    error.status = 400;
    throw error;
  }

  const existing = await PushSubscription.findOne({ where: { endpoint } });
  if (existing) {
    await existing.update({
      user_id: userId,
      p256dh,
      auth,
      user_agent: userAgent || existing.user_agent,
      enabled: true,
    });
    return existing;
  }

  return PushSubscription.create({
    user_id: userId,
    endpoint,
    p256dh,
    auth,
    user_agent: userAgent || null,
    enabled: true,
  });
}

async function removeSubscription(userId, endpoint) {
  if (!endpoint) return 0;
  return PushSubscription.destroy({ where: { user_id: userId, endpoint } });
}

async function getSubscriptions(userId) {
  return PushSubscription.findAll({
    where: { user_id: userId, enabled: true },
    order: [['id', 'ASC']],
  });
}

/** Identifiants des utilisateurs joignables : sert de filtre d'entrée au scheduler. */
async function getSubscribedUserIds() {
  const rows = await PushSubscription.findAll({
    where: { enabled: true },
    attributes: ['user_id'],
    group: ['user_id'],
  });
  return rows.map((r) => r.user_id);
}

function toWebPushSubscription(row) {
  return {
    endpoint: row.endpoint,
    keys: { p256dh: row.p256dh, auth: row.auth },
  };
}

/**
 * Envoie une notification à tous les appareils d'un utilisateur.
 * payload : { title, body, tag, url, ... } — lu par le service worker.
 * Retourne { sent, failed } ; les abonnements expirés (404/410) sont supprimés.
 */
async function sendToUser(userId, payload) {
  if (!isConfigured()) {
    console.warn('[push] VAPID non configuré : notification ignorée pour user', userId);
    return { sent: 0, failed: 0 };
  }

  const subscriptions = await getSubscriptions(userId);
  if (subscriptions.length === 0) return { sent: 0, failed: 0 };

  const body = JSON.stringify(payload);
  const expired = [];
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < subscriptions.length; i += BATCH_SIZE) {
    const batch = subscriptions.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((row) =>
        webpush.sendNotification(toWebPushSubscription(row), body, { TTL: 6 * 3600 })
      )
    );

    results.forEach((result, index) => {
      const row = batch[index];
      if (result.status === 'fulfilled') {
        sent += 1;
        return;
      }
      failed += 1;
      const statusCode = result.reason?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        expired.push(row.id);
      } else {
        console.error('[push] échec envoi', row.endpoint?.slice(0, 60), statusCode, result.reason?.message);
      }
    });
  }

  if (expired.length > 0) {
    await PushSubscription.destroy({ where: { id: { [Op.in]: expired } } });
  }
  if (sent > 0) {
    await PushSubscription.update(
      { last_success_at: new Date() },
      { where: { user_id: userId, enabled: true } }
    );
  }

  return { sent, failed };
}

module.exports = {
  isConfigured,
  getPublicKey,
  saveSubscription,
  removeSubscription,
  getSubscriptions,
  getSubscribedUserIds,
  sendToUser,
};
