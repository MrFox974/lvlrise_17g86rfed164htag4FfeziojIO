import { getDemoData, saveDemoData, initDemoData } from '../hooks/useDemoMode';

/**
 * Simule un délai réseau pour la démo
 */
function delay(ms = 300) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/**
 * Construit l'objet apprentissage (perso/pro progress et target) depuis les domaines, comme en mode connecté.
 * Jour : expectedMinutes = minutes_per_day[jour actuel] pour chaque domaine, actualMinutes depuis les gauges.
 * Semaine : expectedMinutes = somme sur 7 jours de minutes_per_day pour chaque domaine, actualMinutes = 7× jour.
 */
function buildApprentissageFromDomains(domains, domainGauges, period) {
  if (!Array.isArray(domains) || domains.length === 0) {
    return {
      persoMinutesProgress: 0,
      persoMinutesTarget: 0,
      proMinutesProgress: 0,
      proMinutesTarget: 0,
      totalMinutesProgress: 0,
      totalMinutesTarget: 0,
      domainGauges: [],
    };
  }
  
  const todayDay = new Date().getDay();
  const todayDayName = DAY_NAMES[todayDay];
  
  // Créer un map des gauges par id pour récupérer actualMinutes rapidement
  const gaugesById = {};
  if (Array.isArray(domainGauges)) {
    domainGauges.forEach((g) => {
      gaugesById[String(g.id)] = g;
    });
  }
  
  let persoMinutesProgress = 0;
  let persoMinutesTarget = 0;
  let proMinutesProgress = 0;
  let proMinutesTarget = 0;
  const gaugesForPeriod = [];
  
  const WEEKEND_DAYS = new Set(['saturday', 'sunday']);
  const WEEKEND_RATIO = 0.6;

  domains.forEach((domain) => {
    const mins = domain.minutes_per_day || {};
    const domainType = domain.type != null && String(domain.type).toLowerCase() === 'pro' ? 'pro' : 'perso';
    const gauge = gaugesById[String(domain.id)];
    const todayExpected = mins[todayDayName] || 0;
    const rawWeekExpected = DAY_NAMES.reduce((acc, day) => acc + (mins[day] || 0), 0);
    // Si objectifs uniformes (rawWeekExpected ≈ 7 × todayExpected), appliquer ratio week-end
    // pour que jour vs semaine produise des % différents (stroke-dasharray qui bouge)
    const isUniform = todayExpected > 0 && Math.abs(rawWeekExpected - 7 * todayExpected) < 1;
    const expectedMinutes = period === 'week'
      ? isUniform
        ? Math.round(5 * todayExpected + 2 * todayExpected * WEEKEND_RATIO)
        : rawWeekExpected
      : todayExpected;
    
    // actualMinutes : depuis les gauges (représentent "aujourd'hui")
    const actualMinutes = gauge?.actualMinutes ?? 0;
    const actualMinutesForPeriod = period === 'week' ? actualMinutes * 7 : actualMinutes;
    
    if (domainType === 'pro') {
      proMinutesProgress += actualMinutesForPeriod;
      proMinutesTarget += expectedMinutes;
    } else {
      persoMinutesProgress += actualMinutesForPeriod;
      persoMinutesTarget += expectedMinutes;
    }
    
    gaugesForPeriod.push({
      id: domain.id,
      name: domain.name,
      type: domainType,
      expectedMinutes,
      actualMinutes: actualMinutesForPeriod,
      percent: expectedMinutes > 0
        ? Math.min(100, (actualMinutesForPeriod / expectedMinutes) * 100)
        : (actualMinutesForPeriod > 0 ? 100 : 0),
    });
  });
  
  const totalMinutesProgress = persoMinutesProgress + proMinutesProgress;
  const totalMinutesTarget = persoMinutesTarget + proMinutesTarget;
  
  return {
    persoMinutesProgress,
    persoMinutesTarget,
    proMinutesProgress,
    proMinutesTarget,
    totalMinutesProgress,
    totalMinutesTarget,
    domainGauges: gaugesForPeriod,
  };
}

/**
 * Calcule apprentissage de façon synchrone (pour mise à jour immédiate du stroke-dasharray).
 */
export function getDemoApprentissageSync(period) {
  const data = getDemoData();
  const domains = data.domains || [];
  const gauges = data.stats?.day?.apprentissage?.domainGauges || [];
  return buildApprentissageFromDomains(domains, gauges, period || 'day');
}

/**
 * Récupère les statistiques en mode démo. Les cercles perso/pro sont calculés depuis les domaines,
 * comme en mode connecté : jour = somme des minutes_per_day[jour actuel], semaine = somme sur 7 jours.
 */
export const fetchDemoStats = async (options = {}) => {
  await delay();
  const data = getDemoData();
  const period = options.period || 'day';
  const stored = data.stats?.[period] || data.stats?.day || {};

  const domains = data.domains || [];
  const gauges = data.stats?.day?.apprentissage?.domainGauges || [];

  // Toujours calculer apprentissage depuis les domaines + gauges pour refléter les mises à jour
  // des gauges (recordDemoLearningTime) et éviter que les cercles se bloquent.
  const apprentissage = buildApprentissageFromDomains(domains, gauges, period);

  return {
    ...stored,
    apprentissage,
    routines: stored.routines ?? { done: 0, total: 0 },
  };
};

function sumMinutesByType(domainGauges, type) {
  if (!Array.isArray(domainGauges)) return 0;
  return domainGauges
    .filter((d) => (d.type || 'perso') === type)
    .reduce((acc, d) => acc + (d.actualMinutes ?? 0), 0);
}

function sumTargetsByType(domainGauges, type) {
  if (!Array.isArray(domainGauges)) return 0;
  return domainGauges
    .filter((d) => (d.type || 'perso') === type)
    .reduce((acc, d) => acc + (d.expectedMinutes ?? 0), 0);
}

function buildDailyProgressFromGauges(domainGauges) {
  const perso = sumMinutesByType(domainGauges, 'perso');
  const pro = sumMinutesByType(domainGauges, 'pro');
  const persoTarget = sumTargetsByType(domainGauges, 'perso');
  const proTarget = sumTargetsByType(domainGauges, 'pro');
  return { perso, pro, persoTarget, proTarget };
}

/**
 * Détermine de façon déterministe si une date doit être "validée" (90% des cas) ou "presque" (10%) pour la démo.
 */
function isDateValidatedForDemo(dateStr) {
  let h = 0;
  for (let i = 0; i < dateStr.length; i++) h = (h * 31 + dateStr.charCodeAt(i)) % 100;
  return h < 90;
}

const DEMO_PERSO_TARGET = 180;
const DEMO_PRO_TARGET = 195;

/**
 * Récupère la progression quotidienne (minutes perso/pro et objectifs) pour le calendrier en mode démo.
 * Pour la démo : ~90 % des jours passés affichent un diagramme validé (icône check), ~10 % presque validé.
 * Même format que fetchDomainDailyProgress.
 */
export const fetchDemoDomainDailyProgress = async (start, end) => {
  await delay();
  const data = getDemoData();
  const byDate = data.learningDailyProgressByDate || {};
  const today = new Date().toISOString().slice(0, 10);
  const gauges = data.stats?.day?.apprentissage?.domainGauges;
  const { persoTarget, proTarget } = gauges
    ? buildDailyProgressFromGauges(gauges)
    : { persoTarget: DEMO_PERSO_TARGET, proTarget: DEMO_PRO_TARGET };

  const out = {};
  const startD = new Date(start + 'T12:00:00');
  const endD = new Date(end + 'T12:00:00');
  for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);
    if (byDate[dateStr]) {
      out[dateStr] = byDate[dateStr];
    } else if (dateStr < today) {
      const validated = isDateValidatedForDemo(dateStr);
      out[dateStr] = validated
        ? { perso: persoTarget, pro: proTarget, persoTarget, proTarget }
        : {
            perso: Math.floor(persoTarget * 0.85),
            pro: Math.floor(proTarget * 0.85),
            persoTarget,
            proTarget,
          };
    }
  }
  return out;
};

/**
 * Enregistre le temps d'apprentissage en mode démo : met à jour domainGauges + stats + calendrier (localStorage).
 */
export const recordDemoLearningTime = async (domainId, date, minutes) => {
  await delay();
  const data = getDemoData();

  const idStr = String(domainId);
  const safeMinutes = Math.max(0, Number(minutes) || 0);

  const day = data.stats?.day || {};
  const week = data.stats?.week || {};
  const dayApp = day.apprentissage || {};
  const weekApp = week.apprentissage || {};

  const updateGauges = (gauges) => {
    if (!Array.isArray(gauges)) return gauges;
    return gauges.map((g) => (String(g?.id) === idStr ? { ...g, actualMinutes: safeMinutes } : g));
  };

  const dayGauges = updateGauges(dayApp.domainGauges);
  const weekGauges = updateGauges(weekApp.domainGauges);

  const updateTotals = (app, gauges) => {
    const persoMinutesProgress = sumMinutesByType(gauges, 'perso');
    const proMinutesProgress = sumMinutesByType(gauges, 'pro');
    const persoMinutesTarget = sumTargetsByType(gauges, 'perso');
    const proMinutesTarget = sumTargetsByType(gauges, 'pro');
    return {
      ...app,
      persoMinutesProgress,
      proMinutesProgress,
      totalMinutesProgress: persoMinutesProgress + proMinutesProgress,
      persoMinutesTarget,
      proMinutesTarget,
      totalMinutesTarget: persoMinutesTarget + proMinutesTarget,
      domainGauges: gauges,
    };
  };

  data.stats = data.stats || {};
  data.stats.day = { ...day, apprentissage: updateTotals(dayApp, dayGauges) };
  data.stats.week = { ...week, apprentissage: updateTotals(weekApp, weekGauges) };

  // Calendrier : on enregistre au moins la journée courante (ou la date passée)
  if (!data.learningDailyProgressByDate || typeof data.learningDailyProgressByDate !== 'object') {
    data.learningDailyProgressByDate = {};
  }
  data.learningDailyProgressByDate[date] = buildDailyProgressFromGauges(dayGauges);

  saveDemoData(data);
  return data.learningDailyProgressByDate[date];
};

/**
 * Récupère les todos en mode démo depuis localStorage
 */
export const fetchDemoTodos = async (options = {}) => {
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
  if (responseTimeSec !== undefined) card.response_time_sec = responseTimeSec;
  if (mistakeReason !== undefined) card.mistake_reason = mistakeReason;
  
  saveDemoData(data);
  return { card, nextReview: card.next_review_at };
};

/**
 * Récupère les domaines en mode démo depuis localStorage
 */
export const fetchDemoDomains = async () => {
  await delay();
  const data = getDemoData();
  return data.domains || [];
};

/**
 * Crée un domaine en mode démo
 */
export const createDemoDomain = async (name, minutesPerDay = {}, type = 'perso') => {
  await delay();
  const data = getDemoData();
  const domainType = type != null && String(type).toLowerCase() === 'pro' ? 'pro' : 'perso';
  const newDomain = {
    id: Date.now(),
    name: name.trim(),
    minutes_per_day: minutesPerDay,
    type: domainType,
  };
  if (!data.domains) {
    data.domains = [];
  }
  data.domains.push(newDomain);
  saveDemoData(data);
  return newDomain;
};

/**
 * Met à jour un domaine en mode démo
 */
export const updateDemoDomain = async (id, { name, type, minutes_per_day }) => {
  await delay();
  const data = getDemoData();
  if (!data.domains) {
    data.domains = [];
  }
  const domain = data.domains.find((d) => String(d.id) === String(id));
  if (!domain) throw new Error('Domaine introuvable');
  if (name !== undefined) domain.name = name.trim();
  if (type !== undefined) {
    domain.type = type != null && String(type).toLowerCase() === 'pro' ? 'pro' : 'perso';
  }
  if (minutes_per_day !== undefined) domain.minutes_per_day = minutes_per_day;
  saveDemoData(data);
  return domain;
};

/**
 * Supprime un domaine en mode démo
 */
export const deleteDemoDomain = async (id) => {
  await delay();
  const data = getDemoData();
  if (data.domains) {
    data.domains = data.domains.filter((d) => String(d.id) !== String(id));
  }
  saveDemoData(data);
};

/**
 * Réordonne les domaines en mode démo
 */
export const reorderDemoDomains = async (domainIds) => {
  await delay();
  const data = getDemoData();
  if (!data.domains) {
    data.domains = [];
  }
  const byId = Object.fromEntries(data.domains.map((d) => [String(d.id), d]));
  const reordered = domainIds
    .map((id) => byId[String(id)])
    .filter(Boolean);
  data.domains = reordered;
  saveDemoData(data);
  return reordered;
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DÉBATS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const findDemoDebate = (data, debateId) =>
  (data.debates || []).find((d) => String(d.id) === String(debateId));

const findDemoNode = (debate, nodeId) => {
  if (!debate) return null;
  if (String(debate.general?.id) === String(nodeId)) return debate.general;
  return (debate.subs || []).find((n) => String(n.id) === String(nodeId)) || null;
};

const findDemoDebateByNode = (data, nodeId) =>
  (data.debates || []).find((d) => findDemoNode(d, nodeId));

const findDemoArgument = (data, argumentId) => {
  for (const debate of data.debates || []) {
    const nodes = [debate.general, ...(debate.subs || [])].filter(Boolean);
    for (const node of nodes) {
      const arg = (node.arguments || []).find((a) => String(a.id) === String(argumentId));
      if (arg) return { debate, node, arg };
    }
  }
  return {};
};

export const fetchDemoDebates = async () => {
  await delay();
  const data = getDemoData();
  return data.debates || [];
};

export const fetchDemoDebate = async (debateId) => {
  await delay();
  const data = getDemoData();
  return findDemoDebate(data, debateId) || null;
};

export const createDemoDebate = async ({ title, question, desc }) => {
  await delay();
  const data = getDemoData();
  const debates = data.debates || [];
  const id = Date.now();
  const debate = {
    id,
    title: title.trim(),
    question: (question || '').trim() || 'Pour ou contre ?',
    desc: {
      termes: desc?.termes || '',
      limites: desc?.limites || '',
      tensions: desc?.tensions || '',
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    general: {
      id: id + 1,
      title: title.trim(),
      kind: 'general',
      step_done: 0,
      opinion: '',
      side: null,
      position: 0,
      arguments: [],
    },
    subs: [],
  };
  data.debates = [debate, ...debates];
  saveDemoData(data);
  return debate;
};

export const updateDemoDebate = async (debateId, { title, question, desc }) => {
  await delay();
  const data = getDemoData();
  const debate = findDemoDebate(data, debateId);
  if (!debate) throw new Error('Débat introuvable');
  if (title !== undefined) {
    debate.title = title.trim();
    if (debate.general) debate.general.title = debate.title;
  }
  if (question !== undefined) debate.question = question.trim() || 'Pour ou contre ?';
  if (desc) debate.desc = { ...debate.desc, ...desc };
  debate.updated_at = new Date().toISOString();
  saveDemoData(data);
  return debate;
};

export const deleteDemoDebate = async (debateId) => {
  await delay();
  const data = getDemoData();
  data.debates = (data.debates || []).filter((d) => String(d.id) !== String(debateId));
  saveDemoData(data);
};

export const createDemoDebateNode = async (debateId, title) => {
  await delay();
  const data = getDemoData();
  const debate = findDemoDebate(data, debateId);
  if (!debate) throw new Error('Débat introuvable');
  const node = {
    id: Date.now(),
    title: title.trim(),
    kind: 'sub',
    step_done: 0,
    opinion: '',
    side: null,
    position: (debate.subs || []).length + 1,
    arguments: [],
  };
  debate.subs = [...(debate.subs || []), node];
  debate.updated_at = new Date().toISOString();
  saveDemoData(data);
  return node;
};

export const updateDemoDebateNode = async (nodeId, { title, step_done, opinion, side }) => {
  await delay();
  const data = getDemoData();
  const debate = findDemoDebateByNode(data, nodeId);
  const node = findDemoNode(debate, nodeId);
  if (!node) throw new Error('Nœud de débat introuvable');
  if (title !== undefined && node.kind !== 'general') node.title = title.trim();
  if (step_done !== undefined) node.step_done = Math.max(node.step_done, step_done);
  if (opinion !== undefined) node.opinion = opinion;
  if (side !== undefined) node.side = side;
  if (debate) debate.updated_at = new Date().toISOString();
  saveDemoData(data);
  return node;
};

export const deleteDemoDebateNode = async (nodeId) => {
  await delay();
  const data = getDemoData();
  const debate = findDemoDebateByNode(data, nodeId);
  if (debate) {
    debate.subs = (debate.subs || []).filter((n) => String(n.id) !== String(nodeId));
    debate.updated_at = new Date().toISOString();
  }
  saveDemoData(data);
};

export const createDemoDebateArgument = async (nodeId, payload) => {
  await delay();
  const data = getDemoData();
  const debate = findDemoDebateByNode(data, nodeId);
  const node = findDemoNode(debate, nodeId);
  if (!node) throw new Error('Nœud de débat introuvable');
  const argument = {
    id: Date.now(),
    node_id: node.id,
    side: payload.side || 'pour',
    text: payload.text.trim(),
    tags: payload.tags || [],
    source: payload.source || '',
    support: payload.support || '',
    date: payload.date || '',
    verdict: payload.verdict || null,
    note: payload.note || '',
    position: (node.arguments || []).length,
  };
  node.arguments = [...(node.arguments || []), argument];
  if (node.step_done < 1) node.step_done = 1;
  if (debate) debate.updated_at = new Date().toISOString();
  saveDemoData(data);
  return argument;
};

export const updateDemoDebateArgument = async (argumentId, payload) => {
  await delay();
  const data = getDemoData();
  const { debate, arg } = findDemoArgument(data, argumentId);
  if (!arg) throw new Error('Argument introuvable');
  Object.assign(arg, payload);
  if (debate) debate.updated_at = new Date().toISOString();
  saveDemoData(data);
  return arg;
};

export const deleteDemoDebateArgument = async (argumentId) => {
  await delay();
  const data = getDemoData();
  for (const debate of data.debates || []) {
    const nodes = [debate.general, ...(debate.subs || [])].filter(Boolean);
    for (const node of nodes) {
      if ((node.arguments || []).some((a) => String(a.id) === String(argumentId))) {
        node.arguments = node.arguments.filter((a) => String(a.id) !== String(argumentId));
        debate.updated_at = new Date().toISOString();
      }
    }
  }
  saveDemoData(data);
};

/**
 * Initialise les données démo au chargement
 */
initDemoData();
