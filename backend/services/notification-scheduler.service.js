/**
 * Planificateur des notifications quotidiennes.
 *
 * Déclenché par EventBridge toutes les 5 minutes (voir serverless.yml). À chaque
 * passage il calcule, pour chaque utilisateur abonné et **dans son fuseau**, ce
 * qui devait partir depuis le dernier passage :
 *
 *   • rappel de routine     → à l'heure choisie sur la routine
 *   • bonjour               → routine marquée greeting='morning'
 *   • rappel to-do          → juste après le bonjour, ou 8h00 s'il n'y en a pas
 *   • bilan du jour         → 45 min avant la bonne nuit
 *   • bonne nuit            → routine marquée greeting='night'
 *
 * Deux garde-fous :
 *   • une fenêtre de rattrapage (GRACE_MINUTES) pour absorber un passage manqué
 *     ou un cold start un peu long ;
 *   • la table notification_log, dont l'index unique garantit qu'une même
 *     notification ne peut pas partir deux fois dans la journée.
 */
const { Op } = require('sequelize');
const User = require('../models/User');
const Routine = require('../models/Routine');
const RoutineCompletion = require('../models/RoutineCompletion');
const TodoItem = require('../models/TodoItem');
const Flashcard = require('../models/Flashcard');
const FlashcardDeck = require('../models/FlashcardDeck');
const NotificationLog = require('../models/NotificationLog');
const pushService = require('./push.service');
const messages = require('./notification-messages.service');

const KINDS = NotificationLog.KINDS;

/** Fenêtre de rattrapage : on renvoie ce qui était dû dans les 20 dernières minutes. */
const GRACE_MINUTES = 20;
/** Décalage du rappel to-do après le message de bonjour. */
const TODO_DELAY_AFTER_MORNING = 3;
/** Heure du rappel to-do quand aucun bonjour n'est programmé ce jour-là. */
const DEFAULT_TODO_MINUTES = 8 * 60;
/** Le bilan part 45 minutes avant la bonne nuit. */
const REPORT_BEFORE_NIGHT = 45;
/** Au-delà de midi, un « bonjour » n'est plus un matin : on retombe sur 8h00. */
const MORNING_LIMIT_MINUTES = 12 * 60;

const DEFAULT_TIMEZONE = 'Europe/Paris';
const TAG_PRIORITY = { absolue: 0, important: 1, 'à faire': 2, idée: 3, projet: 4 };
const URGENT_TAGS = new Set(['absolue', 'important']);

/** minutes depuis minuit → 'HH:MM'. */
function minutesToTime(minutes) {
  const safe = Math.max(0, Math.min(24 * 60 - 1, Math.round(minutes)));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

/** 'HH:MM' → minutes depuis minuit, ou null si invalide. */
function parseTimeToMinutes(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** Date locale (YYYY-MM-DD), minutes depuis minuit et jour de semaine (lundi = 0). */
function getLocalNow(date, timeZone) {
  let parts;
  try {
    parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);
  } catch {
    return getLocalNow(date, DEFAULT_TIMEZONE);
  }

  const map = {};
  for (const part of parts) map[part.type] = part.value;

  const dateStr = `${map.year}-${map.month}-${map.day}`;
  const minutes = Number(map.hour) * 60 + Number(map.minute);
  const dayOfWeek = (new Date(`${dateStr}T12:00:00Z`).getUTCDay() + 6) % 7;
  return { dateStr, minutes, dayOfWeek };
}

/** Date locale d'un instant, pour comparer un timestamp à « aujourd'hui ». */
function getLocalDateStr(date, timeZone) {
  return getLocalNow(date, timeZone).dateStr;
}

/**
 * Rassemble les chiffres du jour (routines, to-do, apprentissage) utilisés par
 * la rédaction des messages. Une seule construction par utilisateur et par run.
 */
async function buildUserContext(user, local) {
  const { dateStr, dayOfWeek } = local;
  const timezone = user.timezone || DEFAULT_TIMEZONE;

  const routinesToday = await Routine.findAll({
    where: { user_id: user.id, day_of_week: dayOfWeek },
    order: [['position', 'ASC']],
  });

  const completions = routinesToday.length > 0
    ? await RoutineCompletion.findAll({
        where: {
          user_id: user.id,
          routine_id: routinesToday.map((r) => r.id),
          date: dateStr,
          done: true,
        },
        attributes: ['routine_id'],
      })
    : [];
  const doneIds = new Set(completions.map((c) => c.routine_id));

  const activeTodos = await TodoItem.findAll({
    where: { user_id: user.id, completed_at: null },
    attributes: ['id', 'name', 'tag', 'position'],
    order: [['position', 'ASC']],
  });

  // Les to-do terminées portent un timestamp : on repasse par le fuseau de
  // l'utilisateur pour ne compter que celles bouclées dans SA journée.
  const since = new Date(Date.now() - 48 * 3600 * 1000);
  const recentlyCompleted = await TodoItem.findAll({
    where: { user_id: user.id, completed_at: { [Op.gte]: since } },
    attributes: ['id', 'completed_at'],
  });
  const completedToday = recentlyCompleted.filter(
    (t) => t.completed_at && getLocalDateStr(new Date(t.completed_at), timezone) === dateStr
  ).length;

  // Flashcards : ce qui a été révisé dans la journée de l'utilisateur, et ce
  // qu'il lui reste à réviser. La table flashcard n'a pas de user_id : on passe
  // par ses collections.
  const decks = await FlashcardDeck.findAll({
    where: { user_id: user.id },
    order: [['position', 'ASC']],
    attributes: ['id', 'name'],
  });
  const deckIds = decks.map((d) => d.id);
  const cards = deckIds.length > 0
    ? await Flashcard.findAll({
        where: { deck_id: deckIds },
        attributes: ['id', 'deck_id', 'next_review_at', 'last_reviewed_at'],
      })
    : [];

  const now = new Date();
  const reviewedToday = cards.filter(
    (c) => c.last_reviewed_at && getLocalDateStr(new Date(c.last_reviewed_at), timezone) === dateStr
  );
  const reviewedIds = new Set(reviewedToday.map((c) => c.id));
  // Une carte jamais programmée (next_review_at null) est neuve : elle est due.
  const dueCards = cards.filter(
    (c) => !reviewedIds.has(c.id) && (c.next_review_at == null || new Date(c.next_review_at) <= now)
  );

  const deckStats = decks
    .map((d) => ({
      id: d.id,
      name: d.name,
      reviewed: reviewedToday.filter((c) => c.deck_id === d.id).length,
      due: dueCards.filter((c) => c.deck_id === d.id).length,
    }))
    .filter((d) => d.reviewed > 0 || d.due > 0);

  const reviewedCount = reviewedToday.length;
  const dueCount = dueCards.length;

  const sortedTodos = [...activeTodos].sort(
    (a, b) => (TAG_PRIORITY[a.tag] ?? 5) - (TAG_PRIORITY[b.tag] ?? 5)
  );

  return {
    userId: user.id,
    username: user.username || 'toi',
    dateStr,
    dayOfWeek,
    timezone,
    routinesToday: routinesToday.map((r) => ({
      id: r.id,
      label: r.label,
      reminder_time: r.reminder_time,
      greeting: r.greeting,
      done: doneIds.has(r.id),
    })),
    routines: {
      total: routinesToday.length,
      done: doneIds.size,
    },
    todos: {
      total: activeTodos.length,
      urgent: activeTodos.filter((t) => URGENT_TAGS.has(t.tag)).length,
      top: sortedTodos.slice(0, 3).map((t) => ({ name: t.name, tag: t.tag })),
      completedToday,
    },
    flashcards: {
      decks: deckStats,
      reviewed: reviewedCount,
      due: dueCount,
      // Charge du jour : révisé + restant. Null quand il n'y a rien à réviser.
      percent: reviewedCount + dueCount > 0
        ? Math.min(100, Math.round((reviewedCount / (reviewedCount + dueCount)) * 100))
        : null,
    },
  };
}

/**
 * Construit le programme de la journée pour un utilisateur, à partir des
 * routines qui portent une heure de rappel.
 * Retourne [{ kind, minutes, routineId }] trié par heure.
 */
function buildSchedule(routines) {
  const entries = [];
  const morning = routines.find((r) => r.greeting === 'morning' && parseTimeToMinutes(r.reminder_time) !== null);
  const night = routines.find((r) => r.greeting === 'night' && parseTimeToMinutes(r.reminder_time) !== null);

  for (const routine of routines) {
    const minutes = parseTimeToMinutes(routine.reminder_time);
    if (minutes === null) continue;
    // Une routine qui porte le bonjour ou la bonne nuit ne déclenche pas de
    // rappel séparé : son libellé est intégré au message de la journée.
    if (routine.greeting === 'morning' || routine.greeting === 'night') continue;
    entries.push({ kind: KINDS.ROUTINE_REMINDER, minutes, routineId: routine.id });
  }

  const morningMinutes = morning ? parseTimeToMinutes(morning.reminder_time) : null;
  if (morning) {
    entries.push({ kind: KINDS.MORNING_GREETING, minutes: morningMinutes, routineId: morning.id });
  }

  // Rappel des tâches : juste après le bonjour, sinon 8h00.
  const todoMinutes = morningMinutes !== null && morningMinutes < MORNING_LIMIT_MINUTES
    ? Math.min(morningMinutes + TODO_DELAY_AFTER_MORNING, 23 * 60 + 59)
    : DEFAULT_TODO_MINUTES;
  entries.push({ kind: KINDS.TODO_REMINDER, minutes: todoMinutes, routineId: 0 });

  if (night) {
    const nightMinutes = parseTimeToMinutes(night.reminder_time);
    entries.push({ kind: KINDS.NIGHT_GREETING, minutes: nightMinutes, routineId: night.id });
    const reportMinutes = nightMinutes - REPORT_BEFORE_NIGHT;
    if (reportMinutes >= 0) {
      entries.push({ kind: KINDS.DAILY_REPORT, minutes: reportMinutes, routineId: 0 });
    }
  }

  return entries.sort((a, b) => a.minutes - b.minutes);
}

/**
 * Réserve l'envoi : l'index unique de notification_log fait office de verrou.
 * Retourne false si la notification est déjà partie aujourd'hui.
 */
async function claim(userId, kind, dateStr, routineId) {
  try {
    await NotificationLog.create({
      user_id: userId,
      kind,
      ref_date: dateStr,
      routine_id: routineId || 0,
      sent_at: new Date(),
    });
    return true;
  } catch (error) {
    if (error?.name === 'SequelizeUniqueConstraintError') return false;
    throw error;
  }
}

function buildPayload(kind, ctx, routine) {
  switch (kind) {
    case KINDS.MORNING_GREETING:
      return messages.buildMorningGreeting(ctx, routine);
    case KINDS.NIGHT_GREETING:
      return messages.buildNightGreeting(ctx, routine);
    case KINDS.TODO_REMINDER:
      return messages.buildTodoReminder(ctx);
    case KINDS.DAILY_REPORT:
      return messages.buildDailyReport(ctx);
    case KINDS.ROUTINE_REMINDER:
      return routine ? messages.buildRoutineReminder(ctx, routine) : null;
    default:
      return null;
  }
}

/**
 * Traite un utilisateur. Retourne le nombre de notifications envoyées.
 * `userRoutines` contient toutes ses routines porteuses d'un rappel (tous jours
 * confondus) : elles sont chargées en une seule requête pour l'ensemble des
 * utilisateurs, le filtrage par jour se fait ici en mémoire.
 */
async function processUser(user, now, userRoutines) {
  const timezone = user.timezone || DEFAULT_TIMEZONE;
  const local = getLocalNow(now, timezone);
  const windowStart = Math.max(0, local.minutes - GRACE_MINUTES);

  const routines = userRoutines.filter((r) => r.day_of_week === local.dayOfWeek);

  const schedule = buildSchedule(routines).filter(
    (entry) => entry.minutes <= local.minutes && entry.minutes >= windowStart
  );
  if (schedule.length === 0) return 0;

  const ctx = await buildUserContext(user, local);
  let sentCount = 0;

  for (const entry of schedule) {
    const routine = entry.routineId
      ? ctx.routinesToday.find((r) => r.id === entry.routineId)
      : null;

    // Un rappel de routine déjà cochée n'a plus d'objet.
    if (entry.kind === KINDS.ROUTINE_REMINDER && (!routine || routine.done)) continue;

    const payload = buildPayload(entry.kind, ctx, routine);
    if (!payload) continue;

    // On réserve AVANT d'envoyer : deux exécutions concurrentes ne peuvent pas
    // envoyer deux fois la même notification.
    const reserved = await claim(user.id, entry.kind, ctx.dateStr, entry.routineId);
    if (!reserved) continue;

    const result = await pushService.sendToUser(user.id, payload);
    sentCount += result.sent;

    // Échec total (réseau, service de push indisponible) : on relâche la
    // réservation pour retenter au prochain passage, tant qu'on est dans la
    // fenêtre de rattrapage.
    if (result.sent === 0 && result.failed > 0) {
      await NotificationLog.destroy({
        where: {
          user_id: user.id,
          kind: entry.kind,
          ref_date: ctx.dateStr,
          routine_id: entry.routineId || 0,
        },
      });
    }
  }

  return sentCount;
}

/** Rétention du journal anti-doublon (jours). */
const LOG_RETENTION_DAYS = 30;

/**
 * Purge quotidienne du journal : sans elle, la table grossit indéfiniment
 * (environ 5 lignes par utilisateur et par jour). Déclenchée une fois par jour,
 * à la première minute de 3h UTC.
 */
async function purgeOldLogs(now) {
  if (now.getUTCHours() !== 3 || now.getUTCMinutes() !== 0) return;
  const cutoff = new Date(now.getTime() - LOG_RETENTION_DAYS * 24 * 3600 * 1000);
  const deleted = await NotificationLog.destroy({
    where: { ref_date: { [Op.lt]: cutoff.toISOString().slice(0, 10) } },
  });
  if (deleted > 0) console.log(`[scheduler] purge du journal : ${deleted} ligne(s) supprimée(s).`);
}

/**
 * Purge quotidienne des fichiers joints arrivés à expiration (7 jours).
 * La règle de cycle de vie du bucket supprime déjà les objets ; ceci nettoie les
 * lignes en base et rattrape ce qu'elle n'aurait pas encore traité.
 */
async function purgeExpiredUploads(now) {
  if (now.getUTCHours() !== 3 || now.getUTCMinutes() !== 5) return;
  try {
    const uploadService = require('./upload.service');
    const deleted = await uploadService.purgeExpired(now);
    if (deleted > 0) console.log(`[scheduler] purge des fichiers : ${deleted} supprimé(s).`);
  } catch (error) {
    console.error('[scheduler] purge des fichiers impossible :', error.message);
  }
}

/**
 * Point d'entrée du cron. Parcourt les utilisateurs ayant au moins un appareil
 * abonné ; une erreur sur un utilisateur n'interrompt pas les autres.
 */
async function runScheduler(now = new Date()) {
  // Le ménage d'abord, et sans condition : la suppression des fichiers à 7 jours
  // ne doit dépendre ni de la configuration des notifications, ni de l'existence
  // d'un abonné.
  await purgeOldLogs(now);
  await purgeExpiredUploads(now);

  if (!pushService.isConfigured()) {
    console.warn('[scheduler] VAPID non configuré : aucun envoi.');
    return { users: 0, sent: 0 };
  }

  const userIds = await pushService.getSubscribedUserIds();
  if (userIds.length === 0) return { users: 0, sent: 0 };

  const users = await User.findAll({
    where: { id: { [Op.in]: userIds } },
    attributes: ['id', 'username', 'timezone'],
  });

  // Une seule requête pour toutes les routines à rappeler : le cron tourne
  // chaque minute et la plupart des passages n'ont rien à envoyer, il ne faut
  // pas payer une requête par utilisateur à chaque fois.
  const allRoutines = await Routine.findAll({
    where: {
      user_id: { [Op.in]: userIds },
      reminder_time: { [Op.ne]: null },
    },
    order: [['position', 'ASC']],
    attributes: ['id', 'user_id', 'label', 'day_of_week', 'reminder_time', 'greeting', 'position'],
  });
  const routinesByUser = new Map();
  for (const routine of allRoutines) {
    const list = routinesByUser.get(routine.user_id);
    if (list) list.push(routine);
    else routinesByUser.set(routine.user_id, [routine]);
  }

  let sent = 0;
  let processed = 0;
  for (const user of users) {
    try {
      sent += await processUser(user, now, routinesByUser.get(user.id) || []);
      processed += 1;
    } catch (error) {
      console.error('[scheduler] erreur pour user', user.id, error.message);
    }
  }

  // Le cron tourne chaque minute : on ne journalise que les passages utiles,
  // sinon CloudWatch se remplit de 1440 lignes vides par jour.
  if (sent > 0) {
    console.log(`[scheduler] ${processed} utilisateur(s) traité(s), ${sent} notification(s) envoyée(s).`);
  }

  return { users: processed, sent };
}

/**
 * Programme du jour tel que le scheduler le voit pour cet utilisateur.
 * Sert au panel admin : permet de vérifier ce qui partira, à quelle heure et
 * dans quel fuseau, sans attendre l'heure dite.
 */
async function getDailyPlan(userId, now = new Date()) {
  const user = await User.findByPk(userId, { attributes: ['id', 'username', 'timezone'] });
  if (!user) return null;

  const timezone = user.timezone || DEFAULT_TIMEZONE;
  const local = getLocalNow(now, timezone);

  const routines = await Routine.findAll({
    where: {
      user_id: userId,
      day_of_week: local.dayOfWeek,
      reminder_time: { [Op.ne]: null },
    },
    order: [['position', 'ASC']],
    attributes: ['id', 'label', 'reminder_time', 'greeting', 'position'],
  });

  const sentToday = await NotificationLog.findAll({
    where: { user_id: userId, ref_date: local.dateStr },
    attributes: ['kind', 'routine_id'],
  });
  const alreadySent = new Set(sentToday.map((row) => `${row.kind}|${row.routine_id}`));

  return {
    timezone,
    local_date: local.dateStr,
    local_time: minutesToTime(local.minutes),
    day_of_week: local.dayOfWeek,
    devices: await pushService.getSubscriptions(userId).then((rows) => rows.length),
    configured: pushService.isConfigured(),
    schedule: buildSchedule(routines).map((entry) => ({
      kind: entry.kind,
      time: minutesToTime(entry.minutes),
      routine: routines.find((r) => r.id === entry.routineId)?.label || null,
      passed: entry.minutes <= local.minutes,
      sent: alreadySent.has(`${entry.kind}|${entry.routineId || 0}`),
    })),
  };
}

/**
 * Construit une notification réelle (avec les données du compte) sans passer
 * par le journal anti-doublon : uniquement pour les tests du panel admin.
 */
async function previewNotification(userId, kind, now = new Date()) {
  const user = await User.findByPk(userId, { attributes: ['id', 'username', 'timezone'] });
  if (!user) return null;

  const local = getLocalNow(now, user.timezone || DEFAULT_TIMEZONE);
  const ctx = await buildUserContext(user, local);

  let routine = null;
  if (kind === KINDS.MORNING_GREETING) {
    routine = ctx.routinesToday.find((r) => r.greeting === 'morning') || null;
  } else if (kind === KINDS.NIGHT_GREETING) {
    routine = ctx.routinesToday.find((r) => r.greeting === 'night') || null;
  } else if (kind === KINDS.ROUTINE_REMINDER) {
    // À défaut de routine programmée aujourd'hui, on illustre avec un exemple.
    routine = ctx.routinesToday.find((r) => r.reminder_time)
      || ctx.routinesToday[0]
      || { id: 0, label: 'Ma routine', done: false };
  }

  return buildPayload(kind, ctx, routine);
}

module.exports = {
  runScheduler,
  getDailyPlan,
  previewNotification,
  KINDS,
  // exportés pour les tests
  parseTimeToMinutes,
  minutesToTime,
  getLocalNow,
  buildSchedule,
  buildUserContext,
};
