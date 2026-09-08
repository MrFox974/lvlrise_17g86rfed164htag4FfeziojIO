import api from '../../utils/api';

export const fetchDecks = async () => {
  try {
    const { data } = await api.get('/api/flashcard-decks');
    return data.decks || [];
  } catch (error) {
    console.error('Erreur lors de fetchDecks:', error);
    throw error;
  }
};

export const createDeck = async (name, description = '') => {
  try {
    const { data } = await api.post('/api/flashcard-decks', {
      name: name.trim(),
      description: description.trim() || undefined,
    });
    return data.deck;
  } catch (error) {
    console.error('Erreur lors de createDeck:', error);
    throw error;
  }
};

/**
 * Lance la génération d'une collection côté serveur.
 * Répond immédiatement : la génération se poursuit même si l'application est
 * fermée, et son avancement se suit avec fetchGenerationJob.
 * @returns {{ job, capped }}
 */
export const startDeckGeneration = async ({ subject, cardCount, level, language, uploadIds }) => {
  try {
    const { data } = await api.post('/api/flashcard-decks/generate', {
      subject,
      cardCount,
      level,
      language,
      uploadIds,
    });
    return data;
  } catch (error) {
    console.error('Erreur lors de startDeckGeneration:', error);
    throw error;
  }
};

/**
 * Lance la génération de cartes supplémentaires dans une collection existante.
 * Même suivi que la génération d'une collection (fetchGenerationJob).
 * @param {'auto'|'none'|number|string} [chapterId] destination des cartes :
 *   'auto' (groupes déduits du sujet), 'none' (hors groupe) ou un groupe existant.
 * @returns {{ job, capped }}
 */
export const startDeckCardsGeneration = async (deckId, { subject, cardCount, level, language, uploadIds, chapterId }) => {
  try {
    const { data } = await api.post(`/api/flashcard-decks/${deckId}/cards/generate`, {
      subject,
      cardCount,
      level,
      language,
      uploadIds,
      chapterId,
    });
    return data;
  } catch (error) {
    console.error('Erreur lors de startDeckCardsGeneration:', error);
    throw error;
  }
};

/**
 * Lance le complément d'une collection : chaque groupe visé est étoffé à partir
 * de son propre thème et des cartes qu'il contient déjà.
 *
 * @param {number|string} deckId
 * @param {{ scope: 'all'|string, cardsPerGroup?: number, refinePrompt?: string }} params
 */
export const startDeckCompletion = async (deckId, { scope, cardsPerGroup, refinePrompt }) => {
  try {
    const { data } = await api.post(`/api/flashcard-decks/${deckId}/complete`, {
      scope,
      cardsPerGroup,
      refinePrompt,
    });
    return data;
  } catch (error) {
    console.error('Erreur lors de startDeckCompletion:', error);
    throw error;
  }
};

/**
 * Lance la rédaction d'UNE carte à partir d'une demande libre : un mot, une
 * description qui cherche son mot, une question, avec ou sans documents.
 *
 * Comme les autres générations, elle se poursuit côté serveur : le suivi passe
 * par fetchGenerationJob. Rien n'est enregistré tant que l'utilisateur n'a pas
 * retenu ses propositions (acceptJobProposals).
 * @returns {{ job }}
 */
export const startSingleCardGeneration = async (deckId, { query, level, language, uploadIds, chapterId }) => {
  try {
    const { data } = await api.post(`/api/flashcard-decks/${deckId}/cards/generate-one`, {
      query,
      level,
      language,
      uploadIds,
      chapterId,
    });
    return data;
  } catch (error) {
    console.error('Erreur lors de startSingleCardGeneration:', error);
    throw error;
  }
};

/**
 * Enregistre les propositions retenues d'une carte à l'unité.
 * @param {Array<{front: string, back: string}>} cards propositions gardées
 * @returns {{ cards, created, capped }}
 */
export const acceptJobProposals = async (jobId, { cards, chapterId }) => {
  try {
    const { data } = await api.post(`/api/flashcard-jobs/${jobId}/accept`, { cards, chapterId });
    return data;
  } catch (error) {
    console.error('Erreur lors de acceptJobProposals:', error);
    throw error;
  }
};

/**
 * Abandonne les propositions d'une carte à l'unité sans rien enregistrer : le
 * travail est soldé, il ne sera pas represcrit à la prochaine ouverture.
 */
export const discardJobProposals = async (jobId) => {
  try {
    const { data } = await api.post(`/api/flashcard-jobs/${jobId}/accept`, { discard: true });
    return data;
  } catch (error) {
    console.error('Erreur lors de discardJobProposals:', error);
    return null;
  }
};

/**
 * Sujet et réglages ayant servi à créer la collection : ils sont reproposés
 * tels quels quand on lui ajoute des cartes.
 */
export const fetchDeckGenerationContext = async (deckId) => {
  try {
    const { data } = await api.get(`/api/flashcard-decks/${deckId}/generation-context`);
    return data.context || null;
  } catch (error) {
    console.error('Erreur lors de fetchDeckGenerationContext:', error);
    return null;
  }
};

/** État d'une génération en cours ou terminée. */
export const fetchGenerationJob = async (jobId) => {
  const { data } = await api.get(`/api/flashcard-jobs/${jobId}`);
  return data.job;
};

/** Générations récentes : permet de retrouver un travail lancé avant fermeture. */
export const fetchGenerationJobs = async () => {
  try {
    const { data } = await api.get('/api/flashcard-jobs');
    return data.jobs || [];
  } catch (error) {
    console.error('Erreur lors de fetchGenerationJobs:', error);
    return [];
  }
};

export const cancelGenerationJob = async (jobId) => {
  const { data } = await api.delete(`/api/flashcard-jobs/${jobId}`);
  return data.job;
};

export const updateDeck = async (id, { name, description }) => {
  try {
    const { data } = await api.put(`/api/flashcard-decks/${id}`, {
      ...(name !== undefined && { name: name.trim() }),
      ...(description !== undefined && { description }),
    });
    return data.deck;
  } catch (error) {
    console.error('Erreur lors de updateDeck:', error);
    throw error;
  }
};

export const deleteDeck = async (id) => {
  try {
    await api.delete(`/api/flashcard-decks/${id}`);
  } catch (error) {
    console.error('Erreur lors de deleteDeck:', error);
    throw error;
  }
};

export const fetchChapters = async (deckId) => {
  try {
    const { data } = await api.get(`/api/flashcard-decks/${deckId}/chapters`);
    return data.chapters || [];
  } catch (error) {
    console.error('Erreur lors de fetchChapters:', error);
    throw error;
  }
};

export const createChapter = async (deckId, title) => {
  try {
    const { data } = await api.post(`/api/flashcard-decks/${deckId}/chapters`, {
      title: title.trim(),
    });
    return data.chapter;
  } catch (error) {
    console.error('Erreur lors de createChapter:', error);
    throw error;
  }
};

export const updateChapter = async (deckId, chapterId, title) => {
  try {
    const { data } = await api.put(
      `/api/flashcard-decks/${deckId}/chapters/${chapterId}`,
      { title: title.trim() }
    );
    return data.chapter;
  } catch (error) {
    console.error('Erreur lors de updateChapter:', error);
    throw error;
  }
};

export const deleteChapter = async (deckId, chapterId) => {
  try {
    await api.delete(`/api/flashcard-decks/${deckId}/chapters/${chapterId}`);
  } catch (error) {
    console.error('Erreur lors de deleteChapter:', error);
    throw error;
  }
};

export const reorderChapters = async (deckId, chapterIds) => {
  try {
    const { data } = await api.put(`/api/flashcard-decks/${deckId}/chapters/reorder`, {
      chapter_ids: chapterIds,
    });
    return data.chapters || [];
  } catch (error) {
    console.error('Erreur lors de reorderChapters:', error);
    throw error;
  }
};

export const reorderCards = async (deckId, chapterId, cardIds) => {
  try {
    const chapterSegment = chapterId === null || chapterId === 'none' ? 'none' : chapterId;
    const { data } = await api.put(
      `/api/flashcard-decks/${deckId}/chapters/${chapterSegment}/cards/reorder`,
      { card_ids: cardIds }
    );
    return data.cards || [];
  } catch (error) {
    console.error('Erreur lors de reorderCards:', error);
    throw error;
  }
};

export const fetchCards = async (deckId) => {
  try {
    const { data } = await api.get(`/api/flashcard-decks/${deckId}/cards`);
    return data.cards || [];
  } catch (error) {
    console.error('Erreur lors de fetchCards:', error);
    throw error;
  }
};

export const fetchDueCards = async (deckId) => {
  try {
    const { data } = await api.get(`/api/flashcard-decks/${deckId}/due-cards`);
    return data.cards || [];
  } catch (error) {
    console.error('Erreur lors de fetchDueCards:', error);
    throw error;
  }
};

export const createCard = async (deckId, { front, back, chapter_id, tags, notes, source }) => {
  try {
    const { data } = await api.post(`/api/flashcard-decks/${deckId}/cards`, {
      front: front.trim(),
      back: back.trim(),
      ...(chapter_id != null && chapter_id !== '' && { chapter_id }),
      ...(tags != null && { tags }),
      ...(notes != null && notes !== '' && { notes }),
      ...(source != null && source !== '' && { source }),
    });
    return data.card;
  } catch (error) {
    console.error('Erreur lors de createCard:', error);
    throw error;
  }
};

export const updateCard = async (deckId, cardId, { front, back, chapter_id, tags, notes, source }) => {
  try {
    const { data } = await api.put(`/api/flashcard-decks/${deckId}/cards/${cardId}`, {
      ...(front !== undefined && { front: front.trim() }),
      ...(back !== undefined && { back: back.trim() }),
      ...(chapter_id !== undefined && { chapter_id: chapter_id === '' ? null : chapter_id }),
      ...(tags !== undefined && { tags }),
      ...(notes !== undefined && { notes }),
      ...(source !== undefined && { source }),
    });
    return data.card;
  } catch (error) {
    console.error('Erreur lors de updateCard:', error);
    throw error;
  }
};

export const deleteCard = async (deckId, cardId) => {
  try {
    await api.delete(`/api/flashcard-decks/${deckId}/cards/${cardId}`);
  } catch (error) {
    console.error('Erreur lors de deleteCard:', error);
    throw error;
  }
};

/**
 * Enregistre une révision (qualité 1 à 4 : Again, Hard, Good, Easy)
 * @param {number} quality - 1 à 4
 * @param {number} [responseTimeSec] - temps de réponse en secondes
 * @param {string} [mistakeReason] - justification si "Encore"
 */
export const reviewCard = async (deckId, cardId, quality, responseTimeSec, mistakeReason) => {
  try {
    const { data } = await api.post(
      `/api/flashcard-decks/${deckId}/cards/${cardId}/review`,
      { quality, responseTimeSec, mistakeReason }
    );
    return data;
  } catch (error) {
    console.error('Erreur lors de reviewCard:', error);
    throw error;
  }
};
