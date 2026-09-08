import api from '../../utils/api';

export const fetchVapidPublicKey = async () => {
  const { data } = await api.get('/api/push/public-key');
  return data.publicKey;
};

export const subscribeToPush = async (subscription, timezone) => {
  const { data } = await api.post('/api/push/subscribe', { subscription, timezone });
  return data;
};

export const unsubscribeFromPush = async (endpoint) => {
  await api.delete('/api/push/subscribe', { data: { endpoint } });
};

export const fetchPushStatus = async () => {
  const { data } = await api.get('/api/push/status');
  return data;
};

export const sendTestPush = async () => {
  const { data } = await api.post('/api/push/test');
  return data;
};
