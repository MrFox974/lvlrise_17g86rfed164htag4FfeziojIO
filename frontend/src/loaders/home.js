import { fetchStats } from '../utils/statsApi';

export const homeLoader = ({ request }) => {
  const url = new URL(request.url);
  const period = url.searchParams.get('period') || 'day';

  const statsPromise = fetchStats({ period })
    .catch((error) => {
      console.error('Erreur dans homeLoader:', error);
      throw new Response('Erreur lors du chargement des statistiques', {
        status: error.response?.status || 500,
        statusText: error.response?.statusText || 'Internal Server Error',
      });
    });
  return { stats: statsPromise };
};
