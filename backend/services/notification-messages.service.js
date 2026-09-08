/**
 * Rédaction des notifications quotidiennes.
 *
 * Les messages sont assemblés à partir de listes de variantes tirées au sort :
 * le tirage est semé par (utilisateur, date, type) donc le texte change chaque
 * jour, mais reste stable si le scheduler rejoue la même journée. Pas d'appel
 * IA ici : le contenu doit partir en quelques millisecondes, sans coût par
 * utilisateur et sans dépendre de la disponibilité d'un service externe.
 *
 * Chaque fonction reçoit un contexte construit par notification-scheduler
 * (voir buildUserContext) et retourne { title, body, tag, url }.
 */

/** Hash déterministe 32 bits (FNV-1a) : même entrée → même tirage. */
function hashSeed(str) {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Choisit une variante pour la journée. `slot` distingue plusieurs tirages
 * dans un même message (ouverture, transition, clôture) pour qu'ils ne soient
 * pas corrélés. La veille est écartée afin d'éviter deux jours identiques.
 */
function pickDaily(list, seedKey, slot = 0) {
  if (!Array.isArray(list) || list.length === 0) return '';
  if (list.length === 1) return list[0];
  const index = hashSeed(`${seedKey}|${slot}`) % list.length;
  return list[index];
}

function pickDailyAvoidingPrevious(list, userId, dateStr, kind, slot = 0) {
  if (!Array.isArray(list) || list.length === 0) return '';
  if (list.length === 1) return list[0];
  const previousDate = new Date(`${dateStr}T12:00:00Z`);
  previousDate.setUTCDate(previousDate.getUTCDate() - 1);
  const previousStr = previousDate.toISOString().slice(0, 10);

  const index = hashSeed(`${userId}|${dateStr}|${kind}|${slot}`) % list.length;
  const previousIndex = hashSeed(`${userId}|${previousStr}|${kind}|${slot}`) % list.length;
  return list[index === previousIndex ? (index + 1) % list.length : index];
}

function formatMinutes(minutes) {
  const total = Math.max(0, Math.round(minutes || 0));
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, '0')}`;
}

function formatList(items, max = 3) {
  const list = (items || []).slice(0, max);
  if (list.length === 0) return '';
  if (list.length === 1) return list[0];
  return `${list.slice(0, -1).join(', ')} et ${list[list.length - 1]}`;
}

function percent(done, total) {
  if (!total || total <= 0) return null;
  return Math.min(100, Math.round((done / total) * 100));
}

// ─────────────────────────────────────────────────────────────────────────────
// Bonjour
// ─────────────────────────────────────────────────────────────────────────────

const MORNING_OPENERS = [
  'Bonjour {name} ☀️',
  'Debout {name} 👋',
  'Belle journée à toi {name} ✨',
  'Salut {name}, nouvelle page à écrire 📖',
  'Hello {name}, on repart 🚀',
  'Bonjour {name}, le café peut attendre ☕',
  'Coucou {name}, la journée t\'appartient 🌤️',
  'Bonjour {name}, un jour de plus pour progresser 🌱',
  'On y va {name} 💫',
  'Bonjour {name}, prêt·e à avancer ? 🎯',
  'Nouveau jour {name}, nouvelle marche 🪜',
  'Bonjour {name}, la régularité fait le reste 🔁',
];

const MORNING_BOOSTERS = [
  'Ce n\'est pas la motivation qui crée l\'habitude, c\'est l\'habitude qui crée la motivation.',
  'Un petit pas aujourd\'hui vaut mieux qu\'un grand saut “demain”.',
  'La constance bat l\'intensité, à tous les coups.',
  'Tu n\'as pas besoin d\'une journée parfaite, juste d\'une journée commencée.',
  'Chaque répétition grave un peu plus le chemin.',
  'Le plus dur, c\'est les cinq premières minutes. Le reste suit.',
  'Avance à ton rythme, mais avance.',
  'Ce que tu fais aujourd\'hui, ton toi de dans six mois te remerciera.',
  'La discipline, c\'est se souvenir de ce que l\'on veut vraiment.',
  'Mieux vaut fait qu\'attendre le moment parfait.',
  'Tu construis quelque chose, même les jours où ça ne se voit pas.',
  'La progression est rarement spectaculaire, souvent silencieuse.',
];

/**
 * `routine` est la routine qui porte le bonjour : son rappel est fondu dans ce
 * message plutôt que d'envoyer deux notifications à la même minute.
 */
function buildMorningGreeting(ctx, routine) {
  const opener = pickDailyAvoidingPrevious(MORNING_OPENERS, ctx.userId, ctx.dateStr, 'morning', 0)
    .replace('{name}', ctx.username);
  const booster = pickDailyAvoidingPrevious(MORNING_BOOSTERS, ctx.userId, ctx.dateStr, 'morning', 1);

  const parts = [];
  if (routine?.label) {
    parts.push(`On commence par « ${routine.label} ».`);
  }

  // Ce que j'apprends aujourd'hui
  const domainsToday = (ctx.learning.domains || []).filter((d) => d.expectedMinutes > 0);
  if (domainsToday.length > 0) {
    const names = formatList(domainsToday.map((d) => d.name), 2);
    const target = domainsToday.reduce((sum, d) => sum + d.expectedMinutes, 0);
    parts.push(`Au programme : ${names} (${formatMinutes(target)}).`);
  } else if ((ctx.learning.domains || []).length > 0) {
    parts.push(`Pas d'objectif d'apprentissage calé aujourd'hui — ${formatList(ctx.learning.domains.map((d) => d.name), 2)} t'attend si l'envie vient.`);
  }

  // Ce que j'ai à faire
  if (ctx.routines.total > 0) {
    parts.push(
      ctx.routines.total === 1
        ? '1 routine à cocher.'
        : `${ctx.routines.total} routines à cocher.`
    );
  }
  if (ctx.todos.total > 0) {
    parts.push(
      ctx.todos.total === 1
        ? '1 tâche en cours.'
        : `${ctx.todos.total} tâches en cours.`
    );
  }

  const body = [booster, parts.join(' ')].filter(Boolean).join(' ');

  return {
    title: opener,
    body: body || 'Belle journée à toi. Une chose à la fois.',
    tag: `lvlrise-morning-${ctx.dateStr}`,
    url: '/home',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Rappel de to-do (juste après le bonjour, ou 8h par défaut)
// ─────────────────────────────────────────────────────────────────────────────

const TODO_TITLES = [
  'Tes tâches du jour 📋',
  'Au programme aujourd\'hui 📝',
  'Ta to-do t\'attend ✅',
  'Le plan de la journée 🗂️',
  'À faire aujourd\'hui 🎯',
  'Tes priorités du jour ⭐',
];

const TODO_EMPTY = [
  'Aucune tâche en attente. Journée libre — ou le bon moment pour en poser une.',
  'Ta to-do est vide. Rare et précieux : profites-en ou remplis-la.',
  'Rien en attente aujourd\'hui. Une intention à noter ?',
  'To-do au clair. À toi de choisir la suite.',
];

function buildTodoReminder(ctx) {
  const title = pickDailyAvoidingPrevious(TODO_TITLES, ctx.userId, ctx.dateStr, 'todo', 0);

  let body;
  if (ctx.todos.total === 0) {
    body = pickDailyAvoidingPrevious(TODO_EMPTY, ctx.userId, ctx.dateStr, 'todo', 1);
  } else {
    const names = ctx.todos.top.map((t) => t.name);
    const rest = ctx.todos.total - names.length;
    body = formatList(names, 3);
    if (rest > 0) body += rest === 1 ? ' — et 1 autre.' : ` — et ${rest} autres.`;
    if (ctx.todos.urgent > 0) {
      body += ctx.todos.urgent === 1
        ? ' 1 est marquée prioritaire.'
        : ` ${ctx.todos.urgent} sont marquées prioritaires.`;
    }
  }

  return {
    title,
    body,
    tag: `lvlrise-todo-${ctx.dateStr}`,
    url: '/home/todos',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Rappel d'une routine
// ─────────────────────────────────────────────────────────────────────────────

const ROUTINE_TITLES = [
  'C\'est l\'heure ⏰',
  'Petit rappel 🔔',
  'On y va 💪',
  'Ta routine t\'attend ✨',
  'Rappel du jour 🎯',
  'Deux minutes pour toi 🌿',
];

const ROUTINE_HINTS = [
  'Une fois faite, elle n\'est plus dans ta tête.',
  'Le plus dur, c\'est de commencer.',
  'Coche-la et passe à la suite.',
  'Cinq minutes maintenant valent mieux qu\'une heure jamais.',
  'C\'est court, et ça compte.',
  'Tu sais déjà comment faire.',
];

function buildRoutineReminder(ctx, routine) {
  const slotSeed = `${routine.id}`;
  const title = pickDaily(ROUTINE_TITLES, `${ctx.userId}|${ctx.dateStr}|routine|${slotSeed}`, 0);
  const hint = pickDaily(ROUTINE_HINTS, `${ctx.userId}|${ctx.dateStr}|routine|${slotSeed}`, 1);

  return {
    title,
    body: `${routine.label} — ${hint}`,
    tag: `lvlrise-routine-${routine.id}-${ctx.dateStr}`,
    url: '/home/routines',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Bilan du soir (45 min avant la bonne nuit)
// ─────────────────────────────────────────────────────────────────────────────

const REPORT_TITLES = [
  'Ton bilan du jour 📊',
  'Où en es-tu aujourd\'hui ? 📈',
  'Le point de la journée 🧭',
  'Résumé de ta journée 📉',
  'Bilan express 🕓',
];

function buildDailyReport(ctx) {
  const title = pickDailyAvoidingPrevious(REPORT_TITLES, ctx.userId, ctx.dateStr, 'report', 0);

  const routinePercent = percent(ctx.routines.done, ctx.routines.total);
  const learningPercent = ctx.learning.percent;

  const segments = [];
  if (routinePercent !== null) {
    segments.push(`Routines ${routinePercent}% (${ctx.routines.done}/${ctx.routines.total})`);
  }
  if (learningPercent !== null) {
    segments.push(
      `apprentissage ${learningPercent}% (${formatMinutes(ctx.learning.actualMinutes)} sur ${formatMinutes(ctx.learning.expectedMinutes)})`
    );
  } else if (ctx.learning.actualMinutes > 0) {
    segments.push(`apprentissage ${formatMinutes(ctx.learning.actualMinutes)}`);
  }

  if (segments.length === 0) {
    return {
      title,
      body: 'Rien de mesuré aujourd\'hui. Il te reste un peu de temps pour cocher une routine.',
      tag: `lvlrise-report-${ctx.dateStr}`,
      url: '/home',
    };
  }

  const average = [routinePercent, learningPercent].filter((v) => v !== null);
  const globalPercent = average.length > 0
    ? Math.round(average.reduce((a, b) => a + b, 0) / average.length)
    : 0;

  let closing;
  if (globalPercent >= 100) closing = 'Journée pleine. Rien à ajouter. 🏆';
  else if (globalPercent >= 75) closing = 'Très solide. Le reste peut attendre demain.';
  else if (globalPercent >= 40) closing = 'Il reste un peu de temps si tu veux gratter quelques points.';
  else if (globalPercent > 0) closing = 'Une petite action maintenant change encore le bilan.';
  else closing = 'Tout n\'est pas perdu : une seule case cochée et la journée compte.';

  return {
    title,
    body: `${segments.join(' · ')}. ${closing}`,
    tag: `lvlrise-report-${ctx.dateStr}`,
    url: '/home',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Bonne nuit
// ─────────────────────────────────────────────────────────────────────────────

const NIGHT_OPENERS_ACTIVE = [
  'Bravo {name} 👏',
  'Beau travail {name} 🌙',
  'Chapeau {name} ⭐',
  'Bien joué {name} ✨',
  'Journée validée {name} ✅',
  'Tu peux être fier·e {name} 🌟',
];

const NIGHT_OPENERS_NEUTRAL = [
  'Bonne nuit {name} 🌙',
  'Repose-toi {name} 😴',
  'Douce nuit {name} ✨',
  'À demain {name} 🌌',
  'Bonne soirée {name} 🌒',
  'Tourne la page {name} 📘',
];

const NIGHT_PRAISE = [
  'C\'est exactement comme ça que ça se construit.',
  'Chaque journée comme celle-ci compte double sur la durée.',
  'La régularité paie, et tu viens de le prouver.',
  'Tu avances, même quand ça ne se voit pas encore.',
  'Rien de spectaculaire, juste du solide.',
  'Ce rythme-là, garde-le.',
];

const NIGHT_NEUTRAL = [
  'Une journée sans progression visible reste une journée. Demain est une nouvelle page.',
  'Pas de culpabilité : le repos fait partie du parcours. On repart demain.',
  'Certains jours servent juste à récupérer. Demain, une seule petite action suffira.',
  'Rien coché aujourd\'hui, et ce n\'est pas grave. Demain, commence par la plus facile.',
  'Le compteur repart à zéro demain matin. Une seule case, et la machine redémarre.',
  'Ce qui compte, c\'est la moyenne, pas la journée isolée. À demain.',
];

/** `routine` : la routine qui porte la bonne nuit (son rappel est fondu ici). */
function buildNightGreeting(ctx, routine) {
  const routinePercent = percent(ctx.routines.done, ctx.routines.total);
  const didSomething =
    ctx.routines.done > 0 || ctx.learning.actualMinutes > 0 || ctx.todos.completedToday > 0;

  const openers = didSomething ? NIGHT_OPENERS_ACTIVE : NIGHT_OPENERS_NEUTRAL;
  const title = pickDailyAvoidingPrevious(openers, ctx.userId, ctx.dateStr, 'night', 0)
    .replace('{name}', ctx.username);

  const routineSuffix = routine?.label && !routine.done
    ? ` Il te reste « ${routine.label} » si le cœur y est.`
    : '';

  if (!didSomething) {
    return {
      title,
      body: pickDailyAvoidingPrevious(NIGHT_NEUTRAL, ctx.userId, ctx.dateStr, 'night', 1) + routineSuffix,
      tag: `lvlrise-night-${ctx.dateStr}`,
      url: '/home',
    };
  }

  const achievements = [];
  if (ctx.routines.done > 0) {
    achievements.push(
      routinePercent !== null
        ? `${ctx.routines.done}/${ctx.routines.total} routines (${routinePercent}%)`
        : `${ctx.routines.done} routines`
    );
  }
  if (ctx.learning.actualMinutes > 0) {
    achievements.push(`${formatMinutes(ctx.learning.actualMinutes)} d'apprentissage`);
  }
  if (ctx.todos.completedToday > 0) {
    achievements.push(
      ctx.todos.completedToday === 1 ? '1 tâche terminée' : `${ctx.todos.completedToday} tâches terminées`
    );
  }

  const praise = pickDailyAvoidingPrevious(NIGHT_PRAISE, ctx.userId, ctx.dateStr, 'night', 1);

  return {
    title,
    body: `Aujourd'hui : ${formatList(achievements, 3)}. ${praise}${routineSuffix} Bonne nuit 🌙`,
    tag: `lvlrise-night-${ctx.dateStr}`,
    url: '/home',
  };
}

module.exports = {
  buildMorningGreeting,
  buildTodoReminder,
  buildRoutineReminder,
  buildDailyReport,
  buildNightGreeting,
  // exportés pour les tests / le débogage
  formatMinutes,
  formatList,
  percent,
};
