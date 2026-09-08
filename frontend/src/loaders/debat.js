import { fetchDebates, fetchDebate } from '../utils/debateApi';

export const debatLoader = async ({ params }) => {
  try {
    const debates = await fetchDebates();
    const debateId = params.debateId;
    if (debateId) {
      const summary = debates.find((d) => String(d.id) === String(debateId));
      if (!summary) {
        return { debates, debate: null };
      }
      try {
        const debate = await fetchDebate(debateId);
        return { debates, debate };
      } catch (error) {
        console.error('Erreur lors du chargement du débat:', error);
        return { debates, debate: null };
      }
    }
    return { debates, debate: null };
  } catch (error) {
    console.error('Erreur dans debatLoader:', error);
    throw new Response('Erreur lors du chargement des débats', {
      status: error.response?.status || 500,
      statusText: error.response?.statusText || 'Internal Server Error',
    });
  }
};
