import { fetchDomains } from '../utils/domainApi';

export const domainesLoader = async () => {
  try {
    const domains = await fetchDomains();
    return { domains };
  } catch (error) {
    console.error('Erreur dans domainesLoader:', error);
    throw new Response('Erreur lors du chargement des domaines', {
      status: error.response?.status || 500,
      statusText: error.response?.statusText || 'Internal Server Error',
    });
  }
};
