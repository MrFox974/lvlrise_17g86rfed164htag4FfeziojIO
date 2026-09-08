import api from '../../utils/api';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const DEFAULT_MINUTES = Object.fromEntries(DAYS.map((d) => [d, 0]));

export { DAYS, DEFAULT_MINUTES };

export const DAY_LABELS = {
  monday: 'Lundi',
  tuesday: 'Mardi',
  wednesday: 'Mercredi',
  thursday: 'Jeudi',
  friday: 'Vendredi',
  saturday: 'Samedi',
  sunday: 'Dimanche',
};

export const fetchDomains = async () => {
  try {
    const { data } = await api.get('/api/domains');
    return data.domains || [];
  } catch (error) {
    console.error('Erreur lors de fetchDomains:', error);
    throw error;
  }
};

export const createDomain = async (name, minutesPerDay = DEFAULT_MINUTES, type = 'perso') => {
  try {
    const domainType = type != null && String(type).toLowerCase() === 'pro' ? 'pro' : 'perso';
    const { data } = await api.post('/api/domains', {
      name: name.trim(),
      minutes_per_day: minutesPerDay,
      type: domainType,
    });
    return data.domain;
  } catch (error) {
    console.error('Erreur lors de createDomain:', error);
    throw error;
  }
};

export const updateDomain = async (id, { name, type, minutes_per_day }) => {
  try {
    const { data } = await api.put(`/api/domains/${id}`, {
      ...(name !== undefined && { name }),
      ...(type !== undefined && { type }),
      ...(minutes_per_day !== undefined && { minutes_per_day }),
    });
    return data.domain;
  } catch (error) {
    console.error('Erreur lors de updateDomain:', error);
    throw error;
  }
};

export const deleteDomain = async (id) => {
  try {
    await api.delete(`/api/domains/${id}`);
  } catch (error) {
    console.error('Erreur lors de deleteDomain:', error);
    throw error;
  }
};

/**
 * Réordonne les domaines. domainIds = tous les domaines dans le nouvel ordre.
 * @param {number[]} domainIds - Liste ordonnée des ids
 * @returns {Promise<Object[]>} - Liste des domaines mise à jour
 */
export const reorderDomains = async (domainIds) => {
  try {
    const { data } = await api.put('/api/domains/reorder', { domainIds });
    return data.domains || [];
  } catch (error) {
    console.error('Erreur lors de reorderDomains:', error);
    throw error;
  }
};

/**
 * Récupère la progression quotidienne (minutes perso/pro et objectifs) pour le calendrier.
 * @param {string} start - YYYY-MM-DD
 * @param {string} end - YYYY-MM-DD
 * @returns {Promise<Record<string, { perso: number, pro: number, persoTarget: number, proTarget: number }>>}
 */
export const fetchDomainDailyProgress = async (start, end) => {
  try {
    const { data } = await api.get('/api/learning-time/daily', {
      params: { start, end },
    });
    return data.byDate || {};
  } catch (error) {
    console.error('Erreur lors de fetchDomainDailyProgress:', error);
    throw error;
  }
};

/**
 * Enregistre le temps d'apprentissage pour un domaine et une date.
 * @param {number} domainId
 * @param {string} date - YYYY-MM-DD
 * @param {number} minutes
 */
export const recordLearningTime = async (domainId, date, minutes) => {
  try {
    const { data } = await api.post('/api/learning-time', {
      domain_id: domainId,
      date,
      minutes,
    });
    return data;
  } catch (error) {
    console.error('Erreur lors de recordLearningTime:', error);
    throw error;
  }
};
