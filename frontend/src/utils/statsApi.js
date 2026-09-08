import api from '../../utils/api';

/**
 * @param {Object} options
 * @param {string} [options.period='week'] - 'day' ou 'week'
 * @param {AbortSignal} [options.signal]
 */
export const fetchStats = async (options = {}) => {
  try {
    const params = options.period ? { period: options.period } : {};
    const { data } = await api.get('/api/stats', {
      params,
      signal: options.signal,
    });
    return data;
  } catch (error) {
    if (error?.name === 'AbortError' || error?.code === 'ERR_CANCELED') {
      throw error;
    }
    console.error('Erreur fetchStats:', error);
    throw error;
  }
};

export async function updateHomeCardsOrder(order) {
  const { data } = await api.put('/api/auth/home-cards-order', { order });
  return data;
}