import api from '../../utils/api';

export const fetchGauges = async () => {
  try {
    const { data } = await api.get('/api/learning-gauges');
    return data.gauges;
  } catch (error) {
    console.error('Erreur lors de fetchGauges:', error);
    throw error;
  }
};

export const fetchGaugeDaily = async (start, end) => {
  try {
    const { data } = await api.get('/api/learning-gauges/daily', {
      params: { start, end },
    });
    return data.byDate || {};
  } catch (error) {
    console.error('Erreur lors de fetchGaugeDaily:', error);
    throw error;
  }
};

export const updateGauge = async (category, gaugeKey, value) => {
  try {
    const { data } = await api.put('/api/learning-gauges', {
      category,
      gaugeKey,
      value,
    });
    return data;
  } catch (error) {
    console.error('Erreur lors de updateGauge:', error);
    throw error;
  }
};
