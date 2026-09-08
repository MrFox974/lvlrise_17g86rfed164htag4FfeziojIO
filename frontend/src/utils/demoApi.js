import { getDemoData, saveDemoData, initDemoData } from '../hooks/useDemoMode';

/**
 * Simule un délai réseau pour la démo
 */
function delay(ms = 300) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Charge de révision de la période, calculée de façon synchrone pour que le
 * cadran réagisse au clic Jour/Semaine sans attendre le fetch.
 */
export function getDemoFlashcardsSync(period) {
  const data = getDemoData();
  return buildFlashcardsStats(data, period || 'day');
}

/** Fenêtre [début, fin] de la période, en heure locale. */
function getPeriodRange(period) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (period === 'week') {
    const day = start.getDay();
    start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
  }
  const end = new Date(start);
  end.setDate(start.getDate() + (period === 'week' ? 6 : 0));
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/**
 * Cartes révisées sur la période et cartes encore dues, par collection.
 * Une carte jamais programmée (next_review_at absent) est neuve : elle est due.
 */
function buildFlashcardsStats(data, period) {
  const decks = data.flashcardDecks || [];
  const { start, end } = getPeriodRange(period);
  const now = new Date();

  const deckGauges = decks.map((deck) => {
    const cards = getFlashcardCards(data, deck.id);
    const reviewedCards = cards.filter((c) => {
      if (!c.last_reviewed_at) return false;
      const at = new Date(c.last_reviewed_at);
      return at >= start && at <= end;
    });
    const reviewedIds = new Set(reviewedCards.map((c) => c.id));
    const dueCards = cards.filter(
      (c) => !reviewedIds.has(c.id) && (!c.next_review_at || new Date(c.next_review_at) <= now)
    );
    const reviewed = reviewedCards.length;
    const due = dueCards.length;
    const target = reviewed + due;
    return {
      id: deck.id,
      name: deck.name,
      reviewed,
      due,
      target,
      percent: target > 0 ? Math.min(100, (reviewed / target) * 100) : 0,
      totalCards: cards.length,
    };
  });

  const reviewed = deckGauges.reduce((acc, d) => acc + d.reviewed, 0);
  const due = deckGauges.reduce((acc, d) => acc + d.due, 0);
  const target = reviewed + due;

  return {
    reviewed,
    due,
    target,
    percent: target > 0 ? Math.min(100, Math.round((reviewed / target) * 100)) : 0,
    totalCards: deckGauges.reduce((acc, d) => acc + d.totalCards, 0),
    deckGauges,
  };
}

/**
 * Récupère les statistiques en mode démo. Le bloc flashcards est recalculé à
 * chaque appel depuis les cartes stockées, pour refléter les révisions faites
 * pendant la démo.
 */
export const fetchDemoStats = async (options = {}) => {
  await delay();
  const data = getDemoData();
  const period = options.period || 'day';
  const stored = data.stats?.[period] || data.stats?.day || {};

  return {
    ...stored,
    flashcards: buildFlashcardsStats(data, period),
    routines: stored.routines ?? { done: 0, total: 0 },
  };
};

/**
 * Récupère les todos en mode démo depuis localStorage
 */
export const fetchDemoTodos = async () => {
  await delay();
  const data = getDemoData();
  return data.todos || { active: [] };
};

/**
 * Crée un todo en mode démo
 */
export const createDemoTodo = async (name, tag, groupName) => {
  await delay();
  const data = getDemoData();
  const newTodo = {
    id: Date.now(),
    name,
    tag: tag || 'idée',
    progress: 0,
    group_name: typeof groupName === 'string' && groupName.trim() ? groupName.trim() : 'Main',
  };
  if (!data.todos) {
    data.todos = { active: [] };
  }
  data.todos.active.push(newTodo);
  saveDemoData(data);
  return newTodo;
};

/**
 * Met à jour la progression d'un todo en mode démo.
 * Si progress >= 100, déplace le todo de active vers historique (avec completed_at).
 */
export const updateDemoTodoProgress = async (id, progress) => {
  await delay();
  const data = getDemoData();
  if (!data.todos) data.todos = { active: [], historique: [] };
  if (!data.todos.historique) data.todos.historique = [];
  const inActive = data.todos.active.find((t) => t.id === id);
  if (inActive) {
    if (progress >= 100) {
      data.todos.active = data.todos.active.filter((t) => t.id !== id);
      const completed = { ...inActive, progress: 100, completed_at: new Date().toISOString() };
      data.todos.historique.unshift(completed);
      saveDemoData(data);
      return completed;
    }
    inActive.progress = progress;
    saveDemoData(data);
    return inActive;
  }
  const inHistorique = data.todos.historique.find((t) => t.id === id);
  if (inHistorique) {
    inHistorique.progress = progress;
    saveDemoData(data);
    return inHistorique;
  }
  throw new Error('Todo introuvable');
};

/**
 * Supprime un todo en mode démo (active ou historique)
 */
export const deleteDemoTodo = async (id) => {
  await delay();
  const data = getDemoData();
  if (data.todos?.active) {
    data.todos.active = data.todos.active.filter((t) => t.id !== id);
  }
  if (data.todos?.historique) {
    data.todos.historique = data.todos.historique.filter((t) => t.id !== id);
  }
  saveDemoData(data);
};

/**
 * Routines démo : par jour de la semaine (0 = Lundi, 6 = Dimanche) et validations par date
 */
function getRoutinesByDay(data) {
  const byDay = data.routinesByDay || {};
  for (let d = 0; d <= 6; d++) if (!byDay[d]) byDay[d] = [];
  return byDay;
}

function getRoutineDoneByDate(data) {
  return data.routineDoneByDate || {};
}

export const fetchDemoRoutines = async (dayOfWeek, options = {}) => {
  await delay();
  const data = getDemoData();
  const byDay = getRoutinesByDay(data);
  const doneByDate = getRoutineDoneByDate(data);
  const dateStr = options.date;
  const list = byDay[dayOfWeek] || [];
  const doneIds = dateStr ? doneByDate[dateStr] || [] : [];
  return list.map((r) => ({
    ...r,
    done: Array.isArray(doneIds) ? doneIds.includes(r.id) : false,
  }));
};

/**
 * Détermine de façon déterministe si une date passée doit apparaître « validée »
 * (90 % des cas) ou « presque » (10 %) dans le calendrier des routines de démo.
 */
function isDateValidatedForDemo(dateStr) {
  let h = 0;
  for (let i = 0; i < dateStr.length; i++) h = (h * 31 + dateStr.charCodeAt(i)) % 100;
  return h < 90;
}

export const fetchDemoRoutinesCalendar = async (start, end) => {
  await delay();
  const data = getDemoData();
  const byDay = getRoutinesByDay(data);
  const doneByDate = getRoutineDoneByDate(data);
  const today = new Date().toISOString().slice(0, 10);
  const snapshots = data.calendarSnapshotByDate || {};
  const byDate = {};
  const startD = new Date(start + 'T12:00:00');
  const endD = new Date(end + 'T12:00:00');
  let needsSave = false;
  for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);
    if (dateStr < today) {
      if (snapshots[dateStr]) {
        byDate[dateStr] = snapshots[dateStr];
      } else {
        const dayOfWeek = (d.getDay() + 6) % 7;
        const routines = byDay[dayOfWeek] || [];
        const validated = isDateValidatedForDemo(dateStr);
        const doneCount = validated ? routines.length : Math.max(0, Math.floor(routines.length * 0.85));
        const total = routines.length;
        byDate[dateStr] = { total, done: doneCount };
        snapshots[dateStr] = { total, done: doneCount };
        needsSave = true;
      }
    } else {
      const dayOfWeek = (d.getDay() + 6) % 7;
      const routines = byDay[dayOfWeek] || [];
      const doneIds = doneByDate[dateStr] || [];
      const doneCount = Array.isArray(doneIds) ? routines.filter((r) => doneIds.includes(r.id)).length : 0;
      byDate[dateStr] = { total: routines.length, done: doneCount };
    }
  }
  if (needsSave) {
    data.calendarSnapshotByDate = snapshots;
    saveDemoData(data);
  }
  return byDate;
};

export const toggleDemoRoutine = async (id, done, date) => {
  await delay();
  const data = getDemoData();
  if (!data.routineDoneByDate) data.routineDoneByDate = {};
  let ids = data.routineDoneByDate[date] || [];
  if (!Array.isArray(ids)) ids = [];
  if (done) {
    if (!ids.includes(id)) ids = [...ids, id];
  } else {
    ids = ids.filter((x) => x !== id);
  }
  data.routineDoneByDate[date] = ids;

  const today = new Date().toISOString().slice(0, 10);
  if (date < today) {
    if (!data.calendarSnapshotByDate) data.calendarSnapshotByDate = {};
    const dayOfWeek = (new Date(date + 'T12:00:00').getDay() + 6) % 7;
    const byDay = getRoutinesByDay(data);
    const routines = byDay[dayOfWeek] || [];
    const doneCount = Array.isArray(ids) ? routines.filter((r) => ids.includes(r.id)).length : 0;
    data.calendarSnapshotByDate[date] = { total: routines.length, done: doneCount };
  }

  saveDemoData(data);
  return { id, done };
};

export const createDemoRoutine = async (label, dayOfWeek) => {
  await delay();
  const data = getDemoData();
  const byDay = getRoutinesByDay(data);
  const newRoutine = { id: Date.now(), label };
  byDay[dayOfWeek] = [...(byDay[dayOfWeek] || []), newRoutine];
  data.routinesByDay = byDay;
  saveDemoData(data);
  return { ...newRoutine, done: false };
};

export const reorderDemoRoutines = async (ids, dayOfWeek) => {
  await delay();
  const data = getDemoData();
  const byDay = getRoutinesByDay(data);
  const list = byDay[dayOfWeek] || [];
  const byId = Object.fromEntries(list.map((r) => [r.id, r]));
  const reordered = ids.map((id) => byId[id]).filter(Boolean);
  byDay[dayOfWeek] = reordered;
  data.routinesByDay = byDay;
  saveDemoData(data);
  return reordered;
};

export const deleteDemoRoutine = async (id) => {
  await delay();
  const data = getDemoData();
  const byDay = getRoutinesByDay(data);
  const doneByDate = getRoutineDoneByDate(data);
  for (let d = 0; d <= 6; d++) {
    byDay[d] = (byDay[d] || []).filter((r) => r.id !== id);
  }
  for (const date of Object.keys(doneByDate)) {
    doneByDate[date] = (doneByDate[date] || []).filter((x) => x !== id);
  }
  data.routinesByDay = byDay;
  data.routineDoneByDate = doneByDate;
  saveDemoData(data);
};

export const fetchDemoSimilarRoutines = async (label) => {
  await delay();
  const data = getDemoData();
  const byDay = getRoutinesByDay(data);
  const routines = [];
  for (let d = 0; d <= 6; d++) {
    (byDay[d] || []).forEach((r) => {
      if (r.label && String(r.label).trim() === String(label).trim()) {
        routines.push({ id: r.id, day_of_week: d, label: r.label });
      }
    });
  }
  return routines;
};

export const createDemoRoutineForOtherDays = async (label, excludeDay) => {
  await delay();
  const data = getDemoData();
  const byDay = getRoutinesByDay(data);
  const created = [];
  for (let d = 0; d <= 6; d++) {
    if (d === excludeDay) continue;
    const newRoutine = { id: Date.now() + d, label: String(label).trim() };
    byDay[d] = [...(byDay[d] || []), newRoutine];
    created.push({ ...newRoutine, day_of_week: d });
  }
  data.routinesByDay = byDay;
  saveDemoData(data);
  return created;
};

export const deleteDemoRoutinesByLabel = async (label) => {
  await delay();
  const data = getDemoData();
  const byDay = getRoutinesByDay(data);
  const doneByDate = getRoutineDoneByDate(data);
  const labelTrim = String(label || '').trim();
  const idsToRemove = new Set();
  for (let d = 0; d <= 6; d++) {
    (byDay[d] || []).forEach((r) => {
      if (r.label && String(r.label).trim() === labelTrim) idsToRemove.add(r.id);
    });
  }
  for (let d = 0; d <= 6; d++) {
    byDay[d] = (byDay[d] || []).filter((r) => !idsToRemove.has(r.id));
  }
  for (const date of Object.keys(doneByDate)) {
    doneByDate[date] = (doneByDate[date] || []).filter((x) => !idsToRemove.has(x));
  }
  data.routinesByDay = byDay;
  data.routineDoneByDate = doneByDate;
  saveDemoData(data);
};

/**
 * Flashcards démo : collections (decks), groupes (chapters) et cartes
 */
function getFlashcardDecks(data) {
  return data.flashcardDecks || [];
}

function getFlashcardChapters(data, deckId) {
  const chapters = data.flashcardChapters?.[deckId] || [];
  return chapters.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
}

function getFlashcardCards(data, deckId) {
  const cards = data.flashcardCards?.[deckId] || [];
  return cards.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
}

export const fetchDemoDecks = async () => {
  await delay();
  const data = getDemoData();
  const decks = getFlashcardDecks(data);
  const now = new Date();
  
  // Calculer card_count et due_count pour chaque deck
  return decks.map((deck) => {
    const cards = getFlashcardCards(data, deck.id);
    const cardCount = cards.length;
    
    // Cartes à réviser : next_review_at est null ou <= maintenant
    const dueCount = cards.filter((card) => {
      if (!card.next_review_at) return true;
      return new Date(card.next_review_at) <= now;
    }).length;
    
    return {
      ...deck,
      card_count: cardCount,
      due_count: dueCount,
    };
  });
};

export const createDemoDeck = async (name, description = '') => {
  await delay();
  const data = getDemoData();
  const decks = getFlashcardDecks(data);
  const newDeck = {
    id: Date.now(),
    name: name.trim(),
    description: description.trim() || '',
    position: decks.length,
  };
  if (!data.flashcardDecks) data.flashcardDecks = [];
  data.flashcardDecks.push(newDeck);
  if (!data.flashcardChapters) data.flashcardChapters = {};
  if (!data.flashcardCards) data.flashcardCards = {};
  data.flashcardChapters[newDeck.id] = [];
  data.flashcardCards[newDeck.id] = [];
  saveDemoData(data);
  return newDeck;
};

export const updateDemoDeck = async (id, { name, description }) => {
  await delay();
  const data = getDemoData();
  const decks = getFlashcardDecks(data);
  const deck = decks.find((d) => String(d.id) === String(id));
  if (!deck) throw new Error('Deck introuvable');
  if (name !== undefined) deck.name = name.trim();
  if (description !== undefined) deck.description = description.trim() || '';
  saveDemoData(data);
  return deck;
};

export const deleteDemoDeck = async (id) => {
  await delay();
  const data = getDemoData();
  data.flashcardDecks = (data.flashcardDecks || []).filter((d) => String(d.id) !== String(id));
  delete data.flashcardChapters?.[id];
  delete data.flashcardCards?.[id];
  saveDemoData(data);
};

export const fetchDemoChapters = async (deckId) => {
  await delay();
  const data = getDemoData();
  return getFlashcardChapters(data, deckId);
};

export const createDemoChapter = async (deckId, title) => {
  await delay();
  const data = getDemoData();
  if (!data.flashcardChapters) data.flashcardChapters = {};
  if (!data.flashcardChapters[deckId]) data.flashcardChapters[deckId] = [];
  const chapters = data.flashcardChapters[deckId];
  const newChapter = {
    id: Date.now(),
    deck_id: deckId,
    title: title.trim(),
    position: chapters.length,
  };
  chapters.push(newChapter);
  saveDemoData(data);
  return newChapter;
};

export const updateDemoChapter = async (deckId, chapterId, title) => {
  await delay();
  const data = getDemoData();
  const chapters = getFlashcardChapters(data, deckId);
  const chapter = chapters.find((c) => String(c.id) === String(chapterId));
  if (!chapter) throw new Error('Chapter introuvable');
  chapter.title = title.trim();
  saveDemoData(data);
  return chapter;
};

export const deleteDemoChapter = async (deckId, chapterId) => {
  await delay();
  const data = getDemoData();
  if (data.flashcardChapters?.[deckId]) {
    data.flashcardChapters[deckId] = data.flashcardChapters[deckId].filter(
      (c) => String(c.id) !== String(chapterId)
    );
  }
  if (data.flashcardCards?.[deckId]) {
    data.flashcardCards[deckId] = data.flashcardCards[deckId].map((card) => {
      if (String(card.chapter_id) === String(chapterId)) {
        return { ...card, chapter_id: null };
      }
      return card;
    });
  }
  saveDemoData(data);
};

export const reorderDemoChapters = async (deckId, chapterIds) => {
  await delay();
  const data = getDemoData();
  if (!data.flashcardChapters?.[deckId]) return [];
  const chapters = data.flashcardChapters[deckId];
  const byId = Object.fromEntries(chapters.map((c) => [c.id, c]));
  const reordered = chapterIds.map((id, idx) => {
    const ch = byId[id];
    if (ch) ch.position = idx;
    return ch;
  }).filter(Boolean);
  data.flashcardChapters[deckId] = reordered;
  saveDemoData(data);
  return reordered;
};

export const fetchDemoCards = async (deckId) => {
  await delay();
  const data = getDemoData();
  return getFlashcardCards(data, deckId);
};

export const fetchDemoDueCards = async (deckId) => {
  await delay();
  const data = getDemoData();
  const cards = getFlashcardCards(data, deckId);
  const now = new Date();
  return cards.filter((c) => {
    if (!c.next_review_at) return true;
    return new Date(c.next_review_at) <= now;
  });
};

export const createDemoCard = async (deckId, { front, back, chapter_id, tags, notes, source }) => {
  await delay();
  const data = getDemoData();
  if (!data.flashcardCards) data.flashcardCards = {};
  if (!data.flashcardCards[deckId]) data.flashcardCards[deckId] = [];
  const cards = data.flashcardCards[deckId];
  const chapterCards = chapter_id ? cards.filter((c) => String(c.chapter_id) === String(chapter_id)) : cards.filter((c) => !c.chapter_id);
  const newCard = {
    id: Date.now(),
    deck_id: deckId,
    chapter_id: chapter_id || null,
    front: front.trim(),
    back: back.trim(),
    ease_factor: 2.5,
    interval_days: 0,
    repetitions: 0,
    next_review_at: null,
    // Jamais réussie : la carte est signalée comme nouvelle jusqu'à un « Bien ».
    learned_at: null,
    position: chapterCards.length,
    lapses: 0,
    tags: tags || null,
    notes: notes || null,
    source: source || null,
  };
  cards.push(newCard);
  saveDemoData(data);
  return newCard;
};

export const updateDemoCard = async (deckId, cardId, { front, back, chapter_id, tags, notes, source }) => {
  await delay();
  const data = getDemoData();
  const cards = getFlashcardCards(data, deckId);
  const card = cards.find((c) => String(c.id) === String(cardId));
  if (!card) throw new Error('Card introuvable');
  if (front !== undefined) card.front = front.trim();
  if (back !== undefined) card.back = back.trim();
  if (chapter_id !== undefined) card.chapter_id = chapter_id === '' ? null : chapter_id;
  if (tags !== undefined) card.tags = tags;
  if (notes !== undefined) card.notes = notes;
  if (source !== undefined) card.source = source;
  saveDemoData(data);
  return card;
};

export const deleteDemoCard = async (deckId, cardId) => {
  await delay();
  const data = getDemoData();
  if (data.flashcardCards?.[deckId]) {
    data.flashcardCards[deckId] = data.flashcardCards[deckId].filter(
      (c) => String(c.id) !== String(cardId)
    );
  }
  saveDemoData(data);
};

export const reorderDemoCards = async (deckId, chapterId, cardIds) => {
  await delay();
  const data = getDemoData();
  if (!data.flashcardCards?.[deckId]) return [];
  const cards = data.flashcardCards[deckId];
  const byId = Object.fromEntries(cards.map((c) => [c.id, c]));
  const reordered = cardIds.map((id, idx) => {
    const card = byId[id];
    if (card) card.position = idx;
    return card;
  }).filter(Boolean);
  data.flashcardCards[deckId] = reordered;
  saveDemoData(data);
  return reordered;
};

export const reviewDemoCard = async (deckId, cardId, quality, responseTimeSec, mistakeReason) => {
  await delay();
  const data = getDemoData();
  const cards = getFlashcardCards(data, deckId);
  const card = cards.find((c) => String(c.id) === String(cardId));
  if (!card) throw new Error('Card introuvable');
  
  // Algorithme SM-2 simplifié
  if (quality <= 2) {
    card.lapses = (card.lapses || 0) + 1;
    card.repetitions = 0;
    card.interval_days = 0;
    card.ease_factor = Math.max(1.3, card.ease_factor - 0.2);
  } else {
    // « Bien » ou « Facile » : la carte cesse définitivement d'être neuve.
    if (!card.learned_at) card.learned_at = new Date().toISOString();
    card.repetitions = (card.repetitions || 0) + 1;
    if (card.repetitions === 1) {
      card.interval_days = 1;
    } else if (card.repetitions === 2) {
      card.interval_days = 6;
    } else {
      card.interval_days = Math.round(card.interval_days * card.ease_factor);
    }
    card.ease_factor = Math.min(2.5, card.ease_factor + (0.1 - (4 - quality) * (0.08 + (4 - quality) * 0.02)));
  }
  
  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + card.interval_days);
  card.next_review_at = nextReview.toISOString();
  card.last_reviewed_at = new Date().toISOString();
  if (responseTimeSec !== undefined) card.response_time_sec = responseTimeSec;
  if (mistakeReason !== undefined) card.mistake_reason = mistakeReason;
  
  saveDemoData(data);
  return { card, nextReview: card.next_review_at };
};

/**
 * Initialise les données démo au chargement
 */
initDemoData();
