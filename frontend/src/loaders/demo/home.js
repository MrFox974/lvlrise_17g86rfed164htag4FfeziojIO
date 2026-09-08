import { fetchDemoStats } from '../../utils/demoApi';

export const demoHomeLoader = ({ request }) => {
  const url = new URL(request.url);
  const period = url.searchParams.get('period') || 'day';

  const statsPromise = fetchDemoStats({ period })
    .catch((error) => {
      console.error('Erreur dans demoHomeLoader:', error);
      throw new Response('Erreur lors du chargement des statistiques', {
        status: 500,
        statusText: 'Internal Server Error',
      });
    });
  return { stats: statsPromise };
};
