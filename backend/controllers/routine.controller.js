const Routine = require('../models/Routine');
const RoutineCompletion = require('../models/RoutineCompletion');
const RoutineDaySnapshot = require('../models/RoutineDaySnapshot');
const { Op } = require('sequelize');
const planRestrictionsService = require('../services/planRestrictionsService');

function getDateStr(dateParam) {
  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) return dateParam;
  return new Date().toISOString().slice(0, 10);
}

/**
 * Récupère les routines de l'utilisateur pour un jour de la semaine, avec l'état de complétion pour une date donnée.
 * Query: day (0-6), date (YYYY-MM-DD, défaut: aujourd'hui).
 */
exports.getAll = async (req, res) => {
  try {
    const userId = req.user_id;
    if (!userId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const dayOfWeek = parseInt(req.query.day, 10);
    const day = Number.isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6
      ? (new Date().getDay() + 6) % 7
      : dayOfWeek;
    const dateStr = getDateStr(req.query.date);

    const routines = await Routine.findAll({
      where: { user_id: userId, day_of_week: day },
      order: [['position', 'ASC']],
    });

    const completions = await RoutineCompletion.findAll({
      where: {
        user_id: userId,
        routine_id: routines.map((r) => r.id),
        date: dateStr,
      },
    });
    const doneByRoutineId = Object.fromEntries(completions.filter((c) => c.done).map((c) => [c.routine_id, true]));

    res.json({
      routines: routines.map((r) => ({
        id: r.id,
        label: r.label,
        position: r.position,
        done: !!doneByRoutineId[r.id],
        day_of_week: r.day_of_week,
        reminder_time: r.reminder_time || null,
        greeting: r.greeting || null,
      })),
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des routines:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      details: error.message,
    });
  }
};

/**
 * Toggle ou set done pour une routine à une date donnée.
 * Body: { done: true|false } optionnel, { date: 'YYYY-MM-DD' } optionnel (défaut: aujourd'hui).
 */
exports.toggleDone = async (req, res) => {
  try {
    const userId = req.user_id;
    if (!userId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'ID invalide' });
    }

    const routine = await Routine.findOne({
      where: { id, user_id: userId },
    });
    if (!routine) {
      return res.status(404).json({ error: 'Routine non trouvée' });
    }

    const dateStr = getDateStr(req.body?.date);
    const existing = await RoutineCompletion.findOne({
      where: { user_id: userId, routine_id: id, date: dateStr },
    });

    let newDone;
    if (typeof req.body?.done === 'boolean') {
      newDone = req.body.done;
    } else {
      newDone = !(existing?.done ?? false);
    }

    if (existing) {
      await existing.update({ done: newDone });
    } else {
      await RoutineCompletion.create({
        user_id: userId,
        routine_id: id,
        date: dateStr,
        done: newDone,
      });
    }

    const todayStr = getDateStr();
    if (dateStr < todayStr) {
      const dayOfWeek = (new Date(dateStr + 'T12:00:00').getDay() + 6) % 7;
      const routinesThatDay = await Routine.findAll({
        where: { user_id: userId, day_of_week: dayOfWeek },
        attributes: ['id'],
      });
      const total = routinesThatDay.length;
      const completionsThatDate = await RoutineCompletion.count({
        where: {
          user_id: userId,
          date: dateStr,
          done: true,
          routine_id: routinesThatDay.map((r) => r.id),
        },
      });
      await RoutineDaySnapshot.upsert({
        user_id: userId,
        date: dateStr,
        total,
        done: completionsThatDate,
      }, { conflictFields: ['user_id', 'date'] });
    }

    res.json({ routine: { id: routine.id, done: newDone } });
  } catch (error) {
    console.error('Erreur lors du toggle routine:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      details: error.message,
    });
  }
};

/**
 * Ajoute une nouvelle routine.
 */
exports.create = async (req, res) => {
  try {
    const userId = req.user_id;
    if (!userId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const { label } = req.body;
    if (!label || typeof label !== 'string' || !label.trim()) {
      return res.status(400).json({ error: 'Le label est requis' });
    }

    const dayOfWeek = parseInt(req.body.day_of_week, 10);
    const day = Number.isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6
      ? (new Date().getDay() + 6) % 7
      : dayOfWeek;

    // Vérification des restrictions du plan (limite par jour de la semaine, ex. 5 routines le lundi)
    const restriction = await planRestrictionsService.canCreateRoutine(userId, day);
    if (!restriction.allowed) {
      return res.status(403).json({
        error: `Limite de routines pour ce jour atteinte pour votre plan ${restriction.plan}. Vous avez déjà ${restriction.current}/${restriction.limit} routines pour ce jour de la semaine. Passez à un plan supérieur pour en ajouter plus.`,
        restriction: {
          current: restriction.current,
          limit: restriction.limit,
          plan: restriction.plan,
        },
      });
    }

    const maxPos = await Routine.max('position', {
      where: { user_id: userId, day_of_week: day },
    });
    const position = (maxPos ?? -1) + 1;

    const routine = await Routine.create({
      user_id: userId,
      label: label.trim(),
      position,
      done: false,
      day_of_week: day,
    });

    res.status(201).json({
      routine: {
        id: routine.id,
        label: routine.label,
        position: routine.position,
        done: routine.done,
        day_of_week: routine.day_of_week,
        reminder_time: null,
        greeting: null,
      },
    });
  } catch (error) {
    console.error('Erreur lors de la création de la routine:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      details: error.message,
    });
  }
};

/**
 * Réordonne les routines.
 */
exports.reorder = async (req, res) => {
  try {
    const userId = req.user_id;
    if (!userId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids doit être un tableau non vide' });
    }

    const dayOfWeek = parseInt(req.body.day_of_week, 10);
    const day = Number.isNaN(dayOfWeek) ? undefined : dayOfWeek;

    const whereClause = { user_id: userId, id: ids };
    if (day !== undefined && day >= 0 && day <= 6) {
      whereClause.day_of_week = day;
    }

    const routines = await Routine.findAll({
      where: whereClause,
    });
    if (routines.length !== ids.length) {
      return res.status(400).json({ error: 'Certaines routines sont invalides' });
    }

    await Promise.all(
      ids.map((id, position) => {
        const where = { id, user_id: userId };
        if (day !== undefined && day >= 0 && day <= 6) {
          where.day_of_week = day;
        }
        return Routine.update({ position }, { where });
      })
    );

    const fetchWhere = day !== undefined && day >= 0 && day <= 6
      ? { user_id: userId, day_of_week: day }
      : { user_id: userId };
    const updated = await Routine.findAll({
      where: fetchWhere,
      order: [['position', 'ASC']],
    });

    const todayStr = getDateStr();
    const completions = await RoutineCompletion.findAll({
      where: {
        user_id: userId,
        routine_id: updated.map((r) => r.id),
        date: todayStr,
        done: true,
      },
    });
    const doneIds = new Set(completions.map((c) => c.routine_id));

    res.json({
      routines: updated.map((r) => ({
        id: r.id,
        label: r.label,
        position: r.position,
        done: doneIds.has(r.id),
      })),
    });
  } catch (error) {
    console.error('Erreur lors du réordonnancement:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      details: error.message,
    });
  }
};

/**
 * Récupère les routines ayant le même label (pour savoir si proposer suppression semaine).
 */
exports.getSimilarByLabel = async (req, res) => {
  try {
    const userId = req.user_id;
    if (!userId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const label = typeof req.query.label === 'string' ? req.query.label.trim() : '';
    if (!label) {
      return res.status(400).json({ error: 'Le paramètre label est requis' });
    }

    const routines = await Routine.findAll({
      where: { user_id: userId, label },
      attributes: ['id', 'day_of_week', 'label'],
    });

    res.json({ routines: routines.map((r) => ({ id: r.id, day_of_week: r.day_of_week, label: r.label })) });
  } catch (error) {
    console.error('Erreur lors de la récupération des routines similaires:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      details: error.message,
    });
  }
};

/**
 * Crée une routine pour tous les autres jours de la semaine (exclut exclude_day).
 */
exports.createForOtherDays = async (req, res) => {
  try {
    const userId = req.user_id;
    if (!userId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const { label } = req.body;
    if (!label || typeof label !== 'string' || !label.trim()) {
      return res.status(400).json({ error: 'Le label est requis' });
    }

    const excludeDay = parseInt(req.body.exclude_day, 10);
    const exclude = Number.isNaN(excludeDay) || excludeDay < 0 || excludeDay > 6
      ? (new Date().getDay() + 6) % 7
      : excludeDay;

    const created = [];
    for (let day = 0; day <= 6; day++) {
      if (day === exclude) continue;

      const restriction = await planRestrictionsService.canCreateRoutine(userId, day);
      if (!restriction.allowed) {
        break;
      }

      const maxPos = await Routine.max('position', {
        where: { user_id: userId, day_of_week: day },
      });
      const position = (maxPos ?? -1) + 1;

      const routine = await Routine.create({
        user_id: userId,
        label: label.trim(),
        position,
        done: false,
        day_of_week: day,
      });
      created.push({ id: routine.id, label: routine.label, position: routine.position, day_of_week: routine.day_of_week });
    }

    res.status(201).json({ routines: created });
  } catch (error) {
    console.error('Erreur lors de la création des routines pour la semaine:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      details: error.message,
    });
  }
};

/**
 * Supprime toutes les routines ayant le label donné.
 */
exports.deleteByLabel = async (req, res) => {
  try {
    const userId = req.user_id;
    if (!userId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const label = typeof req.query.label === 'string' ? req.query.label.trim() : '';
    if (!label) {
      return res.status(400).json({ error: 'Le paramètre label est requis' });
    }

    await Routine.destroy({
      where: { user_id: userId, label },
    });

    res.status(204).send();
  } catch (error) {
    console.error('Erreur lors de la suppression des routines par label:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      details: error.message,
    });
  }
};

/**
 * Supprime une routine.
 */
exports.deleteOne = async (req, res) => {
  try {
    const userId = req.user_id;
    if (!userId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'ID invalide' });
    }

    const deleted = await Routine.destroy({
      where: { id, user_id: userId },
    });
    if (deleted === 0) {
      return res.status(404).json({ error: 'Routine non trouvée' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Erreur lors de la suppression de la routine:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      details: error.message,
    });
  }
};

const GREETINGS = ['morning', 'night'];
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Rappels de la semaine : heure programmée et message du jour (bonjour /
 * bonne nuit) pour chaque jour. Permet à l'interface de prévenir tout de suite
 * qu'un « bonjour » existe déjà sur ce jour, sans aller-retour d'écriture.
 */
exports.getReminders = async (req, res) => {
  try {
    const userId = req.user_id;
    if (!userId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const routines = await Routine.findAll({
      where: {
        user_id: userId,
        [Op.or]: [
          { reminder_time: { [Op.ne]: null } },
          { greeting: { [Op.ne]: null } },
        ],
      },
      attributes: ['id', 'label', 'day_of_week', 'reminder_time', 'greeting'],
    });

    res.json({
      reminders: routines.map((r) => ({
        id: r.id,
        label: r.label,
        day_of_week: r.day_of_week,
        reminder_time: r.reminder_time || null,
        greeting: r.greeting || null,
      })),
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des rappels:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      details: error.message,
    });
  }
};

/**
 * Programme (ou retire) le rappel d'une routine.
 * Body: {
 *   time: 'HH:MM' | null,             heure locale du rappel
 *   greeting: 'morning'|'night'|null, message du jour porté par cette routine
 *   scope: 'day' | 'week'             appliquer à cette routine ou à toutes
 *                                     celles qui portent le même libellé
 * }
 *
 * Un seul « bonjour » et une seule « bonne nuit » par jour de la semaine :
 * les jours déjà pris sont ignorés et renvoyés dans `conflicts`, à charge de
 * l'interface de le signaler.
 */
exports.setReminder = async (req, res) => {
  try {
    const userId = req.user_id;
    if (!userId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'ID invalide' });
    }

    const routine = await Routine.findOne({ where: { id, user_id: userId } });
    if (!routine) {
      return res.status(404).json({ error: 'Routine non trouvée' });
    }

    const { time, greeting } = req.body || {};
    if (time !== null && time !== undefined && !TIME_RE.test(String(time))) {
      return res.status(400).json({ error: 'Heure invalide (format attendu HH:MM)' });
    }
    if (greeting !== null && greeting !== undefined && !GREETINGS.includes(greeting)) {
      return res.status(400).json({ error: 'Message du jour invalide' });
    }

    const reminderTime = time === null || time === undefined || time === '' ? null : String(time);
    const greetingValue = greeting === null || greeting === undefined || greeting === '' ? null : greeting;
    // Sans heure, pas de message du jour : il n'y aurait aucun moment pour l'envoyer.
    const effectiveGreeting = reminderTime ? greetingValue : null;

    const scope = req.body?.scope === 'week' ? 'week' : 'day';
    const targets = scope === 'week'
      ? await Routine.findAll({ where: { user_id: userId, label: routine.label } })
      : [routine];

    // Jours déjà pourvus d'un message du même type par une autre routine.
    const conflicts = [];
    if (effectiveGreeting) {
      const owners = await Routine.findAll({
        where: {
          user_id: userId,
          greeting: effectiveGreeting,
          id: { [Op.notIn]: targets.map((t) => t.id) },
        },
        attributes: ['day_of_week'],
      });
      const takenDays = new Set(owners.map((o) => o.day_of_week));
      for (const target of targets) {
        if (takenDays.has(target.day_of_week)) {
          conflicts.push({ day_of_week: target.day_of_week, greeting: effectiveGreeting });
        }
      }
    }

    const conflictDays = new Set(conflicts.map((c) => c.day_of_week));
    // Deux routines de même libellé peuvent exister le même jour : le message
    // n'est attribué qu'à la première, sinon le jour en aurait deux.
    const assignedDays = new Set();
    const updated = [];
    for (const target of targets) {
      const dayIsFree = !conflictDays.has(target.day_of_week) && !assignedDays.has(target.day_of_week);
      const greetingForTarget = effectiveGreeting && dayIsFree ? effectiveGreeting : null;
      if (greetingForTarget) assignedDays.add(target.day_of_week);
      await target.update({ reminder_time: reminderTime, greeting: greetingForTarget });
      updated.push({
        id: target.id,
        label: target.label,
        day_of_week: target.day_of_week,
        reminder_time: target.reminder_time || null,
        greeting: target.greeting || null,
      });
    }

    res.json({
      routines: updated,
      conflicts,
      greeting_applied: !!effectiveGreeting && conflicts.length < targets.length,
    });
  } catch (error) {
    console.error('Erreur lors de la programmation du rappel:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      details: error.message,
    });
  }
};

/**
 * Récupère la complétion des routines par date pour le calendrier.
 * Pour les dates passées, utilise les snapshots (stats figées) pour que les chiffres
 * restent visibles même après suppression ou modification des routines.
 * Query: start (YYYY-MM-DD), end (YYYY-MM-DD).
 */
exports.getCalendar = async (req, res) => {
  try {
    const userId = req.user_id;
    if (!userId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const startDate = req.query.start || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const endDate = req.query.end || new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10);
    const todayStr = getDateStr();

    const routines = await Routine.findAll({
      where: { user_id: userId },
      attributes: ['id', 'day_of_week'],
    });
    const routineIdsByDay = {};
    for (let d = 0; d <= 6; d++) {
      routineIdsByDay[d] = routines.filter((r) => r.day_of_week === d).map((r) => r.id);
    }

    const completions = await RoutineCompletion.findAll({
      where: {
        user_id: userId,
        date: { [Op.between]: [startDate, endDate] },
        done: true,
      },
      attributes: ['routine_id', 'date'],
    });

    const pastStart = startDate < todayStr ? startDate : null;
    const pastEnd = endDate < todayStr ? endDate : null;
    let snapshots = [];
    if (pastStart && pastEnd) {
      snapshots = await RoutineDaySnapshot.findAll({
        where: {
          user_id: userId,
          date: { [Op.between]: [pastStart, pastEnd] },
        },
        attributes: ['date', 'total', 'done'],
      });
    }
    const snapshotByDate = Object.fromEntries(
      snapshots.map((s) => [s.date, { total: s.total, done: s.done }])
    );

    const byDate = {};
    const current = new Date(startDate + 'T12:00:00');
    const end = new Date(endDate + 'T12:00:00');
    const toCreate = [];
    while (current <= end) {
      const dateStr = current.toISOString().slice(0, 10);
      const dayOfWeek = (current.getDay() + 6) % 7;
      const idsForDay = routineIdsByDay[dayOfWeek] || [];
      const total = idsForDay.length;
      const done = completions.filter((c) => c.date === dateStr && idsForDay.includes(c.routine_id)).length;

      if (dateStr < todayStr) {
        if (snapshotByDate[dateStr]) {
          byDate[dateStr] = snapshotByDate[dateStr];
        } else {
          byDate[dateStr] = { total, done };
          toCreate.push({ user_id: userId, date: dateStr, total, done });
        }
      } else {
        byDate[dateStr] = { total, done };
      }
      current.setDate(current.getDate() + 1);
    }

    for (const row of toCreate) {
      await RoutineDaySnapshot.upsert(row, { conflictFields: ['user_id', 'date'] });
    }

    res.json({ byDate });
  } catch (error) {
    console.error('Erreur lors de la récupération du calendrier routines:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      details: error.message,
    });
  }
};
