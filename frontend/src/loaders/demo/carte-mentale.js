import { getDemoData } from '../../hooks/useDemoMode';
import { fetchDemoDecks, fetchDemoCards, fetchDemoDueCards, fetchDemoChapters } from '../../utils/demoApi';

export const demoCarteMentaleLoader = async ({ params }) => {
  const decks = await fetchDemoDecks();

  const deckId = params.deckId;
  if (deckId) {
    const deck = decks.find((d) => String(d.id) === String(deckId));
    if (!deck) {
      return { decks, deck: null, cards: [], dueCards: [], chapters: [] };
    }
    const [cards, dueCards, chapters] = await Promise.all([
      fetchDemoCards(deckId),
      fetchDemoDueCards(deckId),
      fetchDemoChapters(deckId),
    ]);
    return { decks, deck, cards, dueCards, chapters };
  }
  return { decks, deck: null, cards: [], dueCards: [], chapters: [] };
};
