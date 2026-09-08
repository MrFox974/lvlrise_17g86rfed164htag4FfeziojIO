import { useLocation } from 'react-router-dom';
import { useMemo } from 'react';

/**
 * Hook pour détecter si on est en mode démo (URL commence par /demo)
 */
export function useDemoMode() {
  const location = useLocation();
  const isDemo = useMemo(() => location.pathname.startsWith('/demo'), [location.pathname]);
  return isDemo;
}

/**
 * Base path pour les routes home selon le mode (démo ou authentifié).
 * À utiliser pour tous les liens et navigate() dans les pages partagées démo/home.
 */
export function useDemoBasePath() {
  const isDemo = useDemoMode();
  return useMemo(() => (isDemo ? '/demo/home' : '/home'), [isDemo]);
}

/**
 * Clé localStorage pour les données démo
 */
const DEMO_STORAGE_KEY = 'demo_data';

/**
 * Récupère les données démo depuis localStorage
 */
export function getDemoData() {
  try {
    const stored = localStorage.getItem(DEMO_STORAGE_KEY);
    return stored ? JSON.parse(stored) : getDefaultDemoData();
  } catch {
    return getDefaultDemoData();
  }
}

/**
 * Sauvegarde les données démo dans localStorage
 */
export function saveDemoData(data) {
  try {
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Erreur lors de la sauvegarde des données démo:', error);
  }
}

/** 5 jauges perso + 3 jauges pro préconfigurées pour la démo */
/**
 * Retourne les données par défaut pour la démo
 */
function getDefaultDemoData() {
  return {
    stats: {
      day: { routines: { done: 3, total: 5 } },
      week: { routines: { done: 18, total: 35 } },
    },
    todos: {
      active: [
        {
          id: 1,
          name: 'Réviser les flashcards JavaScript',
          tag: 'absolue',
          progress: 60,
        },
        {
          id: 2,
          name: 'Compléter le chapitre React',
          tag: 'important',
          progress: 40,
        },
        {
          id: 3,
          name: 'Créer une nouvelle routine matinale',
          tag: 'à faire',
          progress: 0,
        },
      ],
      historique: [],
    },
    routinesByDay: {
      0: [
        { id: 301, label: 'Réveil 7h' },
        { id: 302, label: 'Sport 20 min' },
        { id: 303, label: 'Lecture 15 min' },
        { id: 311, label: 'Planifier la semaine' },
      ],
      1: [
        { id: 304, label: 'Méditation 5 min' },
        { id: 305, label: 'Révision flashcards' },
        { id: 312, label: 'Réveil 6h30' },
        { id: 313, label: 'Lecture 20 min' },
      ],
      2: [
        { id: 306, label: 'Étude 1h' },
        { id: 314, label: 'Réveil 7h' },
        { id: 315, label: 'Sport 25 min' },
      ],
      3: [
        { id: 307, label: 'Lecture 30 min' },
        { id: 316, label: 'Méditation 10 min' },
        { id: 317, label: 'Révision flashcards' },
      ],
      4: [
        { id: 308, label: 'Sport 30 min' },
        { id: 318, label: 'Réveil 7h' },
        { id: 319, label: 'Étude 45 min' },
      ],
      5: [
        { id: 309, label: 'Réveil 8h' },
        { id: 320, label: 'Lecture 20 min' },
        { id: 321, label: 'Repos / balade' },
      ],
      6: [
        { id: 310, label: 'Repos' },
        { id: 322, label: 'Réveil 9h' },
        { id: 323, label: 'Lecture 30 min' },
      ],
    },
    routineDoneByDate: {},
    /** Snapshots (total, done) par date pour les jours passés ; conservés même si on supprime/modifie les routines */
    calendarSnapshotByDate: {},
    flashcardDecks: getDefaultFlashcardDecks(),
    flashcardChapters: getDefaultFlashcardChapters(),
    flashcardCards: getDefaultFlashcardCards(),
  };
}

/**
 * Collection de démonstration, pour montrer l'outil sans partir d'une page vide.
 */
function getDefaultFlashcardDecks() {
  return [
    {
      id: 1,
      name: 'Histoire du monde',
      description: 'Collection sur l\'histoire des civilisations antiques',
      position: 0,
    },
  ];
}

/**
 * Retourne les groupes (chapters) de flashcards par défaut pour la démo
 */
function getDefaultFlashcardChapters() {
  return {
    1: [
      {
        id: 1,
        deck_id: 1,
        title: 'Civilisations antiques',
        position: 0,
      },
      {
        id: 2,
        deck_id: 1,
        title: 'Nouveau groupe',
        position: 1,
      },
    ],
  };
}

/**
 * Retourne les cartes de flashcards par défaut pour la démo
 */
function getDefaultFlashcardCards() {
  return {
    1: [
      {
        id: 1,
        deck_id: 1,
        chapter_id: 1,
        front: 'Quand l\'écriture cunéiforme a-t-elle été inventée ?',
        back: 'Vers 3500 avant notre ère en Mésopotamie. Première forme d\'écriture connue, utilisée pour la comptabilité puis les langues sumérienne et akkadienne.'.slice(0, 123),
        ease_factor: 2.5,
        interval_days: 0,
        repetitions: 0,
        next_review_at: null,
        position: 0,
        lapses: 0,
        tags: null,
        notes: null,
        source: null,
      },
      {
        id: 2,
        deck_id: 1,
        chapter_id: 1,
        front: 'Qui était Hammurabi et quel est son héritage ?',
        back: 'Roi de Babylone au XVIIIe siècle av. J.-C. Il a unifié la Mésopotamie et promulgué un code de lois écrit, posant le principe de la loi écrite comme référence.'.slice(0, 123),
        ease_factor: 2.5,
        interval_days: 0,
        repetitions: 0,
        next_review_at: null,
        position: 1,
        lapses: 0,
        tags: null,
        notes: null,
        source: null,
      },
      {
        id: 3,
        deck_id: 1,
        chapter_id: 1,
        front: 'Qu\'est-ce que la maât dans l\'Égypte pharaonique ?',
        back: 'Concept central de la religion égyptienne représentant l\'ordre, la vérité et la justice. Le pharaon était le garant de la maât, assurant l\'équilibre cosmique.'.slice(0, 123),
        ease_factor: 2.5,
        interval_days: 0,
        repetitions: 0,
        next_review_at: null,
        position: 2,
        lapses: 0,
        tags: null,
        notes: null,
        source: null,
      },
      {
        id: 4,
        deck_id: 1,
        chapter_id: 1,
        front: 'Quelle innovation majeure la Grèce antique a-t-elle apportée à la politique ?',
        back: 'La démocratie athénienne où les citoyens participaient directement aux décisions. Athènes a développé l\'idée de citoyenneté, de débat public et un foisonnement culturel.'.slice(0, 123),
        ease_factor: 2.5,
        interval_days: 0,
        repetitions: 0,
        next_review_at: null,
        position: 3,
        lapses: 0,
        tags: null,
        notes: null,
        source: null,
      },
      {
        id: 5,
        deck_id: 1,
        chapter_id: 1,
        front: 'Quel est l\'héritage principal de l\'Empire romain ?',
        back: 'Un droit écrit (lois et jurisprudence), des infrastructures (routes, aqueducs, ponts), et le latin qui donnera naissance aux langues romanes. La synthèse gréco-romaine fonde la culture occidentale.'.slice(0, 123),
        ease_factor: 2.5,
        interval_days: 0,
        repetitions: 0,
        next_review_at: null,
        position: 4,
        lapses: 0,
        tags: null,
        notes: null,
        source: null,
      },
    ],
  };
}

/**
 * Initialise les données démo si elles n'existent pas (ou complète les collections de flashcards)
 */
export function initDemoData() {
  const current = getDemoData();
  const defaultData = getDefaultDemoData();
  let needsSave = false;
  if (!current.stats || !current.todos) {
    saveDemoData(defaultData);
    return;
  }
  if (!current.routinesByDay || typeof current.routinesByDay !== 'object') {
    current.routinesByDay = defaultData.routinesByDay;
    needsSave = true;
  } else {
    // Compléter uniquement les jours jamais initialisés (pas les tableaux vides : l'utilisateur peut avoir 0 routine)
    const defaultByDay = defaultData.routinesByDay || {};
    for (let d = 0; d <= 6; d++) {
      const defaultList = defaultByDay[d];
      const currentList = current.routinesByDay[d];
      if (defaultList?.length && (currentList === undefined || currentList === null)) {
        current.routinesByDay[d] = [...defaultList];
        needsSave = true;
      }
    }
  }
  if (!current.routineDoneByDate || typeof current.routineDoneByDate !== 'object') {
    current.routineDoneByDate = defaultData.routineDoneByDate || {};
    needsSave = true;
  }
  if (!current.calendarSnapshotByDate || typeof current.calendarSnapshotByDate !== 'object') {
    current.calendarSnapshotByDate = defaultData.calendarSnapshotByDate || {};
    needsSave = true;
  }
  const defaultFlashcardDecks = getDefaultFlashcardDecks();
  const defaultFlashcardChapters = getDefaultFlashcardChapters();
  const defaultFlashcardCards = getDefaultFlashcardCards();

  const currentDecks = Array.isArray(current.flashcardDecks) ? current.flashcardDecks : [];
  const currentDeck1 = currentDecks.find((d) => String(d?.id) === '1');
  const currentCardsDeck1 = Array.isArray(current.flashcardCards?.[1]) ? current.flashcardCards[1] : [];
  const currentChaptersDeck1 = Array.isArray(current.flashcardChapters?.[1]) ? current.flashcardChapters[1] : [];
  const hasHistoryWorldDeck =
    currentDecks.length === 1 &&
    currentDeck1?.name === 'Histoire du monde' &&
    currentChaptersDeck1.length === 2 &&
    currentCardsDeck1.filter((c) => String(c?.chapter_id) === '1').length === 5;

  // Migration: si une ancienne démo est déjà en localStorage, on remplace le template flashcards
  // pour garantir le contenu "Histoire du monde" (1 deck, 2 groupes, 5 cartes + 1 groupe vide).
  if (
    !current.flashcardDecks ||
    !Array.isArray(current.flashcardDecks) ||
    current.flashcardDecks.length === 0 ||
    !current.flashcardChapters ||
    typeof current.flashcardChapters !== 'object' ||
    !current.flashcardCards ||
    typeof current.flashcardCards !== 'object' ||
    !hasHistoryWorldDeck
  ) {
    current.flashcardDecks = defaultFlashcardDecks;
    current.flashcardChapters = defaultFlashcardChapters;
    current.flashcardCards = defaultFlashcardCards;
    needsSave = true;
  }
  if (needsSave) saveDemoData(current);
}
