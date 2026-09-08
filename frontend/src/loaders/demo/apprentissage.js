import { fetchDemoStats } from '../../utils/demoApi';

export const demoApprentissageLoader = async () => {
  const statsDayResult = await fetchDemoStats({ period: 'day' }).catch(() => ({}));
  const domainGauges = statsDayResult?.apprentissage?.domainGauges || [];

  return { domainGauges };
};
