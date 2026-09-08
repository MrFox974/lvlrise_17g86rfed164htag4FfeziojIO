import { fetchDecks } from '../utils/flashcardApi';

export const productiviteLoader = async () => {
  try {
    const decks = await fetchDecks();
    return { decks };
  } catch (error) {
    console.error('Erreur dans productiviteLoader:', error);
    throw new Response('Erreur lors du chargement', {
      status: error.response?.status || 500,
      statusText: error.response?.statusText || 'Internal Server Error',
    });
  }
};
