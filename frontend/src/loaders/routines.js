import api from '../../utils/api';

export const routinesLoader = () => {
  const routinesPromise = api
    .get('/api/routines')
    .then(({ data }) => data.routines || [])
    .catch((error) => {
      console.error('Erreur dans routinesLoader:', error);
      throw new Response('Erreur lors du chargement des routines', {
        status: error.response?.status || 500,
        statusText: error.response?.statusText || 'Internal Server Error',
      });
    });
  return { routines: routinesPromise };
};
