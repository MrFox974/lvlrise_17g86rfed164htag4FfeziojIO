import { fetchStats } from '../utils/statsApi';

export const apprentissageLoader = async () => {
  const statsDayResult = await fetchStats({ period: 'day' }).catch(() => ({}));
  const domainGauges = statsDayResult?.apprentissage?.domainGauges || [];

  return { domainGauges };
};
