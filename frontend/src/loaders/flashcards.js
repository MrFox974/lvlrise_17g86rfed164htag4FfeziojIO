import { fetchDecks, fetchCards, fetchDueCards, fetchChapters } from '../utils/flashcardApi';

export const flashcardsLoader = async ({ params }) => {
  try {
    const decks = await fetchDecks();
    const deckId = params.deckId;
    if (deckId) {
      const deck = decks.find((d) => String(d.id) === String(deckId));
      if (!deck) {
        // Deck introuvable, retourner sans les données du deck
        return { decks, deck: null, cards: [], dueCards: [], chapters: [] };
      }
      try {
        const [cards, dueCards, chapters] = await Promise.all([
          fetchCards(deckId),
          fetchDueCards(deckId),
          fetchChapters(deckId),
        ]);
        return { decks, deck, cards, dueCards, chapters };
      } catch (error) {
        console.error('Erreur lors du chargement des données du deck:', error);
        // Retourner le deck même si les données échouent
        return { decks, deck, cards: [], dueCards: [], chapters: [] };
      }
    }
    return { decks, deck: null, cards: [], dueCards: [], chapters: [] };
  } catch (error) {
    console.error('Erreur dans flashcardsLoader:', error);
    throw new Response('Erreur lors du chargement', {
      status: error.response?.status || 500,
      statusText: error.response?.statusText || 'Internal Server Error',
    });
  }
};
