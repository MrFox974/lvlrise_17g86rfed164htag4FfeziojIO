const LearningTime = require('../models/LearningTime');
const Domain = require('../models/Domain');
const { Op } = require('sequelize');

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/**
 * Récupère la progression quotidienne (minutes perso/pro et objectifs) pour le calendrier.
 * GET /api/learning-time/daily?start=YYYY-MM-DD&end=YYYY-MM-DD
 */
exports.getDaily = async (req, res) => {
  try {
    const userId = req.user_id;
    if (!userId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const { start, end } = req.query;
    const now = new Date();
    const startDate =
      start ||
      new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const endDate =
      end ||
      new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

    const [domains, learningTimes] = await Promise.all([
      Domain.findAll({
        where: { user_id: userId },
        attributes: ['id', 'type', 'minutes_per_day'],
      }),
      LearningTime.findAll({
        where: {
          user_id: userId,
          date: { [Op.between]: [startDate, endDate] },
        },
        attributes: ['domain_id', 'date', 'minutes'],
      }),
    ]);

    const normalizeType = (t) =>
      t != null && String(t).toLowerCase() === 'pro' ? 'pro' : 'perso';
    const domainById = {};
    domains.forEach((d) => {
      domainById[d.id] = {
        type: normalizeType(d.type),
        minutes_per_day: d.minutes_per_day || {},
      };
    });

    const byDate = {};
    const startD = new Date(startDate + 'T12:00:00');
    const endD = new Date(endDate + 'T12:00:00');
    const current = new Date(startD);
    while (current <= endD) {
      const dateStr = current.toISOString().slice(0, 10);
      const dayName = DAY_NAMES[current.getDay()];
      let persoTarget = 0;
      let proTarget = 0;
      domains.forEach((dom) => {
        const mins = dom.minutes_per_day || {};
        const val = mins[dayName] || 0;
        if (normalizeType(dom.type) === 'pro') proTarget += val;
        else persoTarget += val;
      });
      byDate[dateStr] = {
        perso: 0,
        pro: 0,
        persoTarget,
        proTarget,
        actualByDomain: {},
      };
      current.setDate(current.getDate() + 1);
    }

    learningTimes.forEach((lt) => {
      const info = domainById[lt.domain_id];
      if (!info) return;
      const dateStr = typeof lt.date === 'string' ? lt.date.slice(0, 10) : lt.date;
      if (!byDate[dateStr]) return;
      const minutes = lt.minutes || 0;
      if (info.type === 'pro') byDate[dateStr].pro += minutes;
      else byDate[dateStr].perso += minutes;
      byDate[dateStr].actualByDomain[lt.domain_id] =
        (byDate[dateStr].actualByDomain[lt.domain_id] || 0) + minutes;
    });

    Object.keys(byDate).forEach((dateStr) => {
      const dayName = DAY_NAMES[new Date(dateStr + 'T12:00:00').getDay()];
      const persoDomains = domains.filter((d) => normalizeType(d.type) === 'perso');
      const proDomains = domains.filter((d) => normalizeType(d.type) === 'pro');
      const persoTarget = byDate[dateStr].persoTarget || 0;
      const proTarget = byDate[dateStr].proTarget || 0;
      const allPersoComplete =
        persoTarget > 0 &&
        persoDomains.every(
          (d) => (byDate[dateStr].actualByDomain[d.id] || 0) >= (d.minutes_per_day[dayName] || 0)
        );
      const allProComplete =
        proTarget > 0 &&
        proDomains.every(
          (d) => (byDate[dateStr].actualByDomain[d.id] || 0) >= (d.minutes_per_day[dayName] || 0)
        );
      byDate[dateStr].persoComplete = allPersoComplete;
      byDate[dateStr].proComplete = allProComplete;
      delete byDate[dateStr].actualByDomain;
    });

    res.json({ byDate });
  } catch (error) {
    console.error('Erreur lors de la récupération de la progression quotidienne:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      details: error.message,
    });
  }
};

/**
 * Enregistre ou met à jour le temps d'apprentissage pour un domaine et une date.
 */
exports.upsert = async (req, res) => {
  try {
    const userId = req.user_id;
    if (!userId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const { domain_id, date, minutes } = req.body;

    if (!domain_id || !date) {
      return res.status(400).json({
        error: 'domain_id et date sont requis',
      });
    }

    const domain = await Domain.findOne({
      where: { id: domain_id, user_id: userId },
    });

    if (!domain) {
      return res.status(404).json({ error: 'Domaine introuvable' });
    }

    const numMinutes = Math.max(0, parseInt(minutes, 10) || 0);
    const dateStr = typeof date === 'string' ? date.slice(0, 10) : date;

    const [row, created] = await LearningTime.findOrCreate({
      where: { user_id: userId, domain_id, date: dateStr },
      defaults: { user_id: userId, domain_id, date: dateStr, minutes: numMinutes },
    });

    if (!created) {
      await row.update({ minutes: numMinutes });
    }

    res.json({ learningTime: { domain_id, date: dateStr, minutes: numMinutes } });
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement du temps:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      details: error.message,
    });
  }
};
