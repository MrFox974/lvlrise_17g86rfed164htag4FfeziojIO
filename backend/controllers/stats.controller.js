const Routine = require('../models/Routine');
const RoutineCompletion = require('../models/RoutineCompletion');
const TodoItem = require('../models/TodoItem');
const Domain = require('../models/Domain');
const LearningTime = require('../models/LearningTime');
const { Op } = require('sequelize');

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

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

    const [routinesAll, topTodos, domains, learningTimes] = await Promise.all([
      Routine.findAll({
        where: { user_id: userId },
        attributes: ['id', 'done', 'day_of_week'],
      }),
      TodoItem.findAll({
        where: { user_id: userId, completed_at: null },
        attributes: ['id', 'name', 'tag', 'progress', 'position'],
        order: [['position', 'ASC']],
      }),
      Domain.findAll({
        where: { user_id: userId },
        order: [['position', 'ASC']],
        attributes: ['id', 'name', 'type', 'minutes_per_day'],
      }),
      LearningTime.findAll({
        where: {
          user_id: userId,
          date: isDay ? todayStr : { [Op.between]: [startWeekStr, endWeekStr] },
        },
        attributes: ['domain_id', 'date', 'minutes'],
      }),
    ]);

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

    const todayDayName = DAY_NAMES[new Date().getDay()];
    const domainGauges = domains.map((d) => {
      const mins = d.minutes_per_day || {};
      const expectedMinutes = isDay
        ? (mins[todayDayName] || 0)
        : DAY_NAMES.reduce((acc, day) => acc + (mins[day] || 0), 0);
      const actualMinutes = learningTimes
        .filter((lt) => lt.domain_id === d.id)
        .reduce((acc, lt) => acc + (lt.minutes || 0), 0);
      const percent = expectedMinutes > 0
        ? Math.min(100, (actualMinutes / expectedMinutes) * 100)
        : (actualMinutes > 0 ? 100 : 0);
      const domainType =
        d.type != null && String(d.type).toLowerCase() === 'pro' ? 'pro' : 'perso';
      return {
        id: d.id,
        name: d.name,
        type: domainType,
        expectedMinutes,
        actualMinutes,
        percent,
      };
    });

    let persoMinutesProgress = 0;
    let persoMinutesTarget = 0;
    let proMinutesProgress = 0;
    let proMinutesTarget = 0;
    domainGauges.forEach((dg) => {
      if (dg.type === 'pro') {
        proMinutesProgress += dg.actualMinutes;
        proMinutesTarget += dg.expectedMinutes;
      } else {
        persoMinutesProgress += dg.actualMinutes;
        persoMinutesTarget += dg.expectedMinutes;
      }
    });
    const totalMinutesProgress = persoMinutesProgress + proMinutesProgress;
    const totalMinutesTarget = persoMinutesTarget + proMinutesTarget;

    const topTodosSorted = topTodos
      .sort((a, b) => (TAG_PRIORITY[a.tag] ?? 5) - (TAG_PRIORITY[b.tag] ?? 5))
      .slice(0, 3)
      .map((t) => ({ id: t.id, name: t.name, tag: t.tag }));

    const routinesDone = isDay ? routinesDoneToday : routinesDoneWeek;
    const routinesTotal = isDay ? routinesTotalToday : routinesTotalWeek;

    res.json({
      period: isDay ? 'day' : 'week',
      apprentissage: {
        persoMinutesProgress,
        persoMinutesTarget,
        proMinutesProgress,
        proMinutesTarget,
        totalMinutesProgress,
        totalMinutesTarget,
        domainGauges,
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
