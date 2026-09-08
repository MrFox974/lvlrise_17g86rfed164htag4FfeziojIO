const AdminEvent = require('../models/AdminEvent');
const PageVisit = require('../models/PageVisit');
const User = require('../models/User');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');

const ADMIN_SUBSCRIPTION = 'admin_4188348183671877818917';

function isAdminSubscription(plan) {
  return plan === ADMIN_SUBSCRIPTION;
}

/**
 * Enregistre un événement admin (log).
 * @param {string} eventType
 * @param {object} payload
 * @param {number|null} userId
 */
async function logEvent(eventType, payload = {}, userId = null) {
  try {
    await AdminEvent.create({
      event_type: eventType,
      payload: payload,
      user_id: userId,
    });
  } catch (error) {
    console.error('[AdminService] Erreur lors du log d\'événement:', error);
  }
}

/**
 * Récupère les événements en ordre chronologique décroissant.
 */
async function getEvents(limit = 100, offset = 0) {
  const events = await AdminEvent.findAll({
    order: [['created_at', 'DESC']],
    limit: Math.min(limit, 200),
    offset,
  });
  return events.map((e) => ({
    id: e.id,
    event_type: e.event_type,
    payload: e.payload,
    user_id: e.user_id,
    created_at: e.created_at,
  }));
}

/**
 * Agrège les statistiques commerciales.
 */
async function getStats() {
  const [
    totalUsers,
    subscriptionsByPlan,
    pageVisitsByPath,
    totalPageVisits,
    unsubscriptions,
  ] = await Promise.all([
    User.count(),
    User.findAll({
      attributes: [
        'subscription_plan',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      ],
      group: ['subscription_plan'],
      raw: true,
    }),
    PageVisit.findAll({
      attributes: [
        'path',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      ],
      group: ['path'],
      order: [[sequelize.literal('count'), 'DESC']],
      raw: true,
    }),
    PageVisit.count(),
    AdminEvent.findAll({
      where: { event_type: 'unsubscription' },
      order: [['created_at', 'DESC']],
      limit: 50,
      raw: true,
    }),
  ]);

  const planCounts = subscriptionsByPlan.reduce((acc, row) => {
    acc[row.subscription_plan || 'free'] = parseInt(row.count, 10);
    return acc;
  }, {});

  const pageCounts = pageVisitsByPath.map((row) => ({
    path: row.path,
    count: parseInt(row.count, 10),
  }));

  return {
    totalUsers,
    subscriptionsByPlan: planCounts,
    pageVisitsByPath: pageCounts,
    totalPageVisits,
    unsubscriptions: unsubscriptions.map((u) => ({
      id: u.id,
      user_id: u.user_id,
      payload: u.payload,
      created_at: u.created_at,
    })),
  };
}

/**
 * Enregistre une visite de page.
 */
async function trackPageVisit(path, userId = null) {
  try {
    await PageVisit.create({
      path: path || '/',
      user_id: userId,
    });
  } catch (error) {
    console.error('[AdminService] Erreur lors du tracking:', error);
  }
}

module.exports = {
  ADMIN_SUBSCRIPTION,
  isAdminSubscription,
  logEvent,
  getEvents,
  getStats,
  trackPageVisit,
};
