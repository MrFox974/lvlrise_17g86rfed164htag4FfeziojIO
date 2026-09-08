const LearningGauge = require('../models/LearningGauge');
const GaugeDaily = require('../models/GaugeDaily');
const { Op } = require('sequelize');

const DEFAULT_PERSO_KEYS = ['reth', 'com', 'crea', 'log', 'phys'];
const DEFAULT_PRO_KEYS = ['tech', 'lead', 'strat'];

const ensureDefaults = (values, keys) => {
  const result = { ...values };
  keys.forEach((key) => {
    if (typeof result[key] !== 'number' || result[key] < 0 || result[key] > 10) {
      result[key] = 0;
    }
  });
  return result;
};

/**
 * Récupère les jauges d'apprentissage de l'utilisateur connecté.
 */
exports.getGauges = async (req, res) => {
  try {
    const userId = req.user_id;
    if (!userId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const rows = await LearningGauge.findAll({
      where: { user_id: userId },
      order: [['category', 'ASC']],
    });

    const perso = rows.find((r) => r.category === 'developpement_perso');
    const pro = rows.find((r) => r.category === 'developpement_pro');

    const gauges = {
      developpement_perso: ensureDefaults(
        perso?.values || {},
        DEFAULT_PERSO_KEYS
      ),
      developpement_pro: ensureDefaults(pro?.values || {}, DEFAULT_PRO_KEYS),
    };

    res.json({ gauges });
  } catch (error) {
    console.error('Erreur lors de la récupération des jauges:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      details: error.message,
    });
  }
};

/**
 * Récupère les valeurs quotidiennes pour le calendrier.
 */
exports.getGaugeDaily = async (req, res) => {
  try {
    const userId = req.user_id;
    if (!userId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const { start, end } = req.query;
    const startDate = start || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const endDate = end || new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10);

    const today = new Date().toISOString().slice(0, 10);
    const rows = await GaugeDaily.findAll({
      where: {
        user_id: userId,
        date: { [Op.between]: [startDate, endDate] },
      },
      order: [['date', 'ASC']],
    });

    const gaugeRows = await LearningGauge.findAll({
      where: { user_id: userId },
    });
    const persoGauge = gaugeRows.find((r) => r.category === 'developpement_perso')?.values || {};
    const proGauge = gaugeRows.find((r) => r.category === 'developpement_pro')?.values || {};

    const byDate = {};
    rows.forEach((r) => {
      const vals = r.values || {};
      const keys = r.category === 'developpement_perso' ? DEFAULT_PERSO_KEYS : DEFAULT_PRO_KEYS;
      const sum = keys.reduce((acc, k) => acc + (vals[k] || 0), 0);
      if (!byDate[r.date]) byDate[r.date] = { perso: 0, pro: 0 };
      if (r.category === 'developpement_perso') byDate[r.date].perso = sum;
      else byDate[r.date].pro = sum;
    });

    if (!byDate[today]) {
      byDate[today] = {
        perso: DEFAULT_PERSO_KEYS.reduce((acc, k) => acc + (persoGauge[k] || 0), 0),
        pro: DEFAULT_PRO_KEYS.reduce((acc, k) => acc + (proGauge[k] || 0), 0),
      };
    }

    res.json({ byDate });
  } catch (error) {
    console.error('Erreur lors de la récupération des jauges:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      details: error.message,
    });
  }
};

/**
 * Met à jour une jauge pour une catégorie donnée.
 */
exports.updateGauge = async (req, res) => {
  try {
    const userId = req.user_id;
    if (!userId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const { category, gaugeKey, value } = req.body;

    if (!category || !gaugeKey) {
      return res.status(400).json({
        error: 'category et gaugeKey sont requis',
      });
    }

    const numValue = Math.min(10, Math.max(0, parseInt(value, 10) || 0));
    const validCategories = ['developpement_perso', 'developpement_pro'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        error: 'category invalide',
      });
    }

    const [row] = await LearningGauge.findOrCreate({
      where: { user_id: userId, category },
      defaults: { user_id: userId, category, values: {} },
    });

    const current = row.values || {};
    const keys =
      category === 'developpement_perso' ? DEFAULT_PERSO_KEYS : DEFAULT_PRO_KEYS;
    if (!keys.includes(gaugeKey)) {
      return res.status(400).json({
        error: 'gaugeKey invalide pour cette catégorie',
      });
    }

    const newValues = { ...current, [gaugeKey]: numValue };
    await row.update({ values: newValues });

    const today = new Date().toISOString().slice(0, 10);
    const [dailyRow] = await GaugeDaily.findOrCreate({
      where: { user_id: userId, category, date: today },
      defaults: { user_id: userId, category, date: today, values: {} },
    });
    await dailyRow.update({ values: newValues });

    res.json({ gauges: { [category]: newValues }, value: numValue });
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la jauge:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      details: error.message,
    });
  }
};
