const Domain = require('../models/Domain');
const LearningTime = require('../models/LearningTime');
const { Op } = require('sequelize');
const planRestrictionsService = require('../services/planRestrictionsService');

const DEFAULT_MINUTES = {
  monday: 0,
  tuesday: 0,
  wednesday: 0,
  thursday: 0,
  friday: 0,
  saturday: 0,
  sunday: 0,
};

function normalizeMinutes(minutesPerDay) {
  const normalized = { ...DEFAULT_MINUTES };
  if (minutesPerDay && typeof minutesPerDay === 'object') {
    Object.keys(DEFAULT_MINUTES).forEach((day) => {
      const val = parseInt(minutesPerDay[day], 10);
      normalized[day] = Number.isNaN(val) || val < 0 ? 0 : Math.min(1440, val);
    });
  }
  return normalized;
}

function normalizeType(type) {
  if (type != null && String(type).toLowerCase() === 'pro') return 'pro';
  return 'perso';
}

/**
 * Récupère tous les domaines de l'utilisateur connecté.
 */
exports.getAll = async (req, res) => {
  try {
    const userId = req.user_id;
    if (!userId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const rows = await Domain.findAll({
      where: { user_id: userId },
      order: [['position', 'ASC'], ['id', 'ASC']],
      attributes: ['id', 'name', 'type', 'minutes_per_day', 'position'],
    });

    const domains = rows.map((d) => {
      const data = d.toJSON ? d.toJSON() : d.get();
      return { ...data, type: normalizeType(data.type) };
    });

    res.json({ domains });
  } catch (error) {
    console.error('Erreur lors de la récupération des domaines:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      details: error.message,
    });
  }
};

/**
 * Crée un nouveau domaine.
 */
exports.create = async (req, res) => {
  try {
    const userId = req.user_id;
    if (!userId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const { name, type, minutes_per_day } = req.body;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({
        error: 'Le nom du domaine est requis',
      });
    }

    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      return res.status(400).json({
        error: 'Le nom du domaine ne peut pas être vide',
      });
    }

    const domainType = normalizeType(type);

    // Vérification des restrictions du plan
    const restriction = await planRestrictionsService.canCreateDomain(userId, domainType);
    if (!restriction.allowed) {
      return res.status(403).json({
        error: `Limite de domaines ${domainType === 'pro' ? 'pro' : 'perso'} atteinte pour votre plan ${restriction.plan}. Vous avez ${restriction.current}/${restriction.limit} domaines ${domainType === 'pro' ? 'pro' : 'perso'}. Passez à un plan supérieur pour créer plus de domaines.`,
        restriction: {
          current: restriction.current,
          limit: restriction.limit,
          plan: restriction.plan,
        },
      });
    }

    const maxPosition = await Domain.max('position', {
      where: { user_id: userId },
    });
    const position = (maxPosition ?? -1) + 1;
    const domain = await Domain.create({
      user_id: userId,
      name: trimmedName,
      type: domainType,
      minutes_per_day: normalizeMinutes(minutes_per_day),
      position,
    });

    const domainData = domain.toJSON ? domain.toJSON() : domain.get();
    res.status(201).json({ domain: { ...domainData, type: normalizeType(domainData.type) } });
  } catch (error) {
    console.error('Erreur lors de la création du domaine:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      details: error.message,
    });
  }
};

/**
 * Met à jour un domaine existant.
 */
exports.update = async (req, res) => {
  try {
    const userId = req.user_id;
    if (!userId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const { id } = req.params;
    const { name, type, minutes_per_day } = req.body;

    const domain = await Domain.findOne({
      where: { id, user_id: userId },
    });

    if (!domain) {
      return res.status(404).json({ error: 'Domaine introuvable' });
    }

    if (name !== undefined) {
      const trimmedName = typeof name === 'string' ? name.trim() : '';
      if (trimmedName.length === 0) {
        return res.status(400).json({
          error: 'Le nom du domaine ne peut pas être vide',
        });
      }
      domain.name = trimmedName;
    }

    if (type !== undefined) {
      domain.type = normalizeType(type);
    }

    if (minutes_per_day !== undefined) {
      domain.minutes_per_day = normalizeMinutes(minutes_per_day);
    }

    await domain.save();

    res.json({ domain });
  } catch (error) {
    console.error('Erreur lors de la mise à jour du domaine:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      details: error.message,
    });
  }
};

/**
 * Réordonne les domaines : position = index dans le tableau domainIds.
 * domainIds doit contenir tous les domaines de l'utilisateur dans l'ordre souhaité.
 */
exports.reorder = async (req, res) => {
  try {
    const userId = req.user_id;
    if (!userId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const { domainIds } = req.body;
    if (!Array.isArray(domainIds) || domainIds.length === 0) {
      return res.status(400).json({
        error: 'domainIds doit être un tableau non vide',
      });
    }

    const userDomains = await Domain.findAll({
      where: { user_id: userId },
      attributes: ['id'],
    });
    const userDomainIds = new Set(userDomains.map((d) => d.id));

    const invalidIds = domainIds.filter((id) => !userDomainIds.has(id));
    if (invalidIds.length > 0) {
      return res.status(400).json({
        error: 'Certains identifiants ne correspondent pas à vos domaines',
      });
    }

    await Promise.all(
      domainIds.map((id, index) =>
        Domain.update({ position: index }, { where: { id, user_id: userId } })
      )
    );

    const domains = await Domain.findAll({
      where: { user_id: userId },
      order: [['position', 'ASC'], ['id', 'ASC']],
      attributes: ['id', 'name', 'type', 'minutes_per_day', 'position'],
    });

    const list = domains.map((d) => {
      const data = d.toJSON ? d.toJSON() : d.get();
      return { ...data, type: normalizeType(data.type) };
    });

    res.json({ domains: list });
  } catch (error) {
    console.error('Erreur lors du réordonnancement des domaines:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      details: error.message,
    });
  }
};

/**
 * Supprime un domaine.
 */
exports.delete = async (req, res) => {
  try {
    const userId = req.user_id;
    if (!userId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const { id } = req.params;

    const domain = await Domain.findOne({
      where: { id, user_id: userId },
    });

    if (!domain) {
      return res.status(404).json({ error: 'Domaine introuvable' });
    }

    await LearningTime.destroy({ where: { domain_id: id } });
    await domain.destroy();

    res.json({ success: true });
  } catch (error) {
    console.error('Erreur lors de la suppression du domaine:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      details: error.message,
    });
  }
};
