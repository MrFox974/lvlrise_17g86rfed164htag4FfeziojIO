const Routine = require('../models/Routine');
const RoutineCompletion = require('../models/RoutineCompletion');
const TodoItem = require('../models/TodoItem');
const Flashcard = require('../models/Flashcard');
const FlashcardDeck = require('../models/FlashcardDeck');
const { Op } = require('sequelize');


const TAG_PRIORITY = { absolue: 0, important: 1, 'à faire': 2, idée: 3, projet: 4 };

function getTodayDayOfWeek() {
  return (new Date().getDay() + 6) % 7;
}

function getTodayDateStr() {
  return new Date().toISOString().slice(0, 10);
}

function getWeekDates() {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  const start = new Date(monday);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

exports.getStats = async (req, res) => {
  try {
    const userId = req.user_id;
    if (!userId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const period = (req.query.period || 'day').toLowerCase();
    const isDay = period === 'day';

    const todayDay = getTodayDayOfWeek();
    const todayStr = getTodayDateStr();
    const { start: startWeek, end: endWeek } = getWeekDates();
    const startWeekStr = startWeek.toISOString().slice(0, 10);
    const endWeekStr = endWeek.toISOString().slice(0, 10);

    const [routinesAll, topTodos, decks] = await Promise.all([
      Routine.findAll({
        where: { user_id: userId },
        attributes: ['id', 'done', 'day_of_week'],
      }),
      TodoItem.findAll({
        where: { user_id: userId, completed_at: null },
        attributes: ['id', 'name', 'tag', 'progress', 'position'],
        order: [['position', 'ASC']],
      }),
      FlashcardDeck.findAll({
        where: { user_id: userId },
        order: [['position', 'ASC']],
        attributes: ['id', 'name'],
      }),
    ]);

    // Cartes de l'utilisateur, via ses collections : la table flashcard ne porte
    // pas de user_id, la propriété passe par le deck.
    const deckIds = decks.map((d) => d.id);
    const cards = deckIds.length > 0
      ? await Flashcard.findAll({
          where: { deck_id: deckIds },
          attributes: ['id', 'deck_id', 'next_review_at', 'last_reviewed_at'],
        })
      : [];

    const routinesToday = routinesAll.filter((r) => r.day_of_week === todayDay);
    const routinesTotalToday = routinesToday.length;
    let routinesDoneToday = routinesToday.filter((r) => r.done).length;
    
    // Pour la semaine : compter la somme des routines pour chaque jour de la semaine
    // Exemple : 6 routines lundi + 6 mardi + ... + 7 samedi + 5 dimanche = 42 routines total
    // On groupe par day_of_week et on compte le nombre de routines pour chaque jour
    const routinesByDay = {};
    routinesAll.forEach((r) => {
      const day = r.day_of_week;
      if (!routinesByDay[day]) {
        routinesByDay[day] = 0;
      }
      routinesByDay[day]++;
    });
    // Somme de toutes les routines pour tous les jours de la semaine
    const routinesTotalWeek = Object.values(routinesByDay).reduce((sum, count) => sum + count, 0);

    const todayRoutineIds = routinesToday.map((r) => r.id);
    const completionsToday = todayRoutineIds.length > 0
      ? await RoutineCompletion.findAll({
          where: { user_id: userId, routine_id: todayRoutineIds, date: todayStr, done: true },
          attributes: ['routine_id'],
        })
      : [];

    let routinesDoneWeek = 0;
    if (!isDay) {
      const completionsWeek = await RoutineCompletion.count({
        where: {
          user_id: userId,
          date: { [Op.between]: [startWeekStr, endWeekStr] },
          done: true,
        },
      });
      routinesDoneWeek = completionsWeek;
    }

    if (completionsToday.length > 0) {
      routinesDoneToday = completionsToday.length;
    }

    // Fenêtre de la période, pour dater les révisions.
    const periodStart = isDay
      ? new Date(`${todayStr}T00:00:00.000Z`)
      : new Date(`${startWeekStr}T00:00:00.000Z`);
    const periodEnd = isDay
      ? new Date(`${todayStr}T23:59:59.999Z`)
      : new Date(`${endWeekStr}T23:59:59.999Z`);
    const now = new Date();

    const isReviewedInPeriod = (card) => {
      if (!card.last_reviewed_at) return false;
      const at = new Date(card.last_reviewed_at);
      return at >= periodStart && at <= periodEnd;
    };
    // Une carte jamais programmée (next_review_at null) est neuve : elle est due.
    const isDue = (card) =>
      card.next_review_at == null || new Date(card.next_review_at) <= now;

    const deckGauges = decks.map((deck) => {
      const deckCards = cards.filter((c) => c.deck_id === deck.id);
      const reviewed = deckCards.filter(isReviewedInPeriod).length;
      const due = deckCards.filter((c) => !isReviewedInPeriod(c) && isDue(c)).length;
      const target = reviewed + due;
      return {
        id: deck.id,
        name: deck.name,
        reviewed,
        due,
        target,
        percent: target > 0 ? Math.min(100, (reviewed / target) * 100) : 0,
        totalCards: deckCards.length,
      };
    });

    const reviewed = deckGauges.reduce((acc, d) => acc + d.reviewed, 0);
    const due = deckGauges.reduce((acc, d) => acc + d.due, 0);
    // La charge de la période : ce qui a été révisé + ce qui reste à réviser.
    const target = reviewed + due;

    const topTodosSorted = topTodos
      .sort((a, b) => (TAG_PRIORITY[a.tag] ?? 5) - (TAG_PRIORITY[b.tag] ?? 5))
      .slice(0, 3)
      .map((t) => ({ id: t.id, name: t.name, tag: t.tag }));

    const routinesDone = isDay ? routinesDoneToday : routinesDoneWeek;
    const routinesTotal = isDay ? routinesTotalToday : routinesTotalWeek;

    res.json({
      period: isDay ? 'day' : 'week',
      flashcards: {
        reviewed,
        due,
        target,
        percent: target > 0 ? Math.min(100, Math.round((reviewed / target) * 100)) : 0,
        totalCards: cards.length,
        deckGauges,
      },
      routines: {
        done: routinesDone,
        total: routinesTotal,
      },
      topTodos: topTodosSorted,
      periodDates: isDay
        ? { label: todayStr }
        : { weekStart: startWeekStr, weekEnd: endWeekStr },
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des stats:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      details: error.message,
    });
  }
};
