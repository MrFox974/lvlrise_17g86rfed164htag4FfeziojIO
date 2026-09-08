#!/usr/bin/env node
/**
 * Vérification des fonctions pures des notifications (aucune base requise).
 * Usage : node scripts/test-notifications.js
 */
const scheduler = require('../services/notification-scheduler.service');
const messages = require('../services/notification-messages.service');

let failures = 0;

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(`${ok ? '✓' : '✗'} ${label}${ok ? '' : `\n   attendu: ${JSON.stringify(expected)}\n   obtenu : ${JSON.stringify(actual)}`}`);
}

function assert(label, condition, detail = '') {
  if (!condition) failures += 1;
  console.log(`${condition ? '✓' : '✗'} ${label}${condition ? '' : `\n   ${detail}`}`);
}

console.log('\n— Lecture des heures —');
check('07:30 → 450 min', scheduler.parseTimeToMinutes('07:30'), 450);
check('00:00 → 0 min', scheduler.parseTimeToMinutes('00:00'), 0);
check('23:59 → 1439 min', scheduler.parseTimeToMinutes('23:59'), 1439);
check('valeur vide → null', scheduler.parseTimeToMinutes(''), null);
check('25:00 → null', scheduler.parseTimeToMinutes('25:00'), null);

console.log('\n— Heure locale par fuseau —');
// 2026-01-15T23:30:00Z : encore le 15 à New York, déjà le 16 à Paris et Tokyo.
const instant = new Date('2026-01-15T23:30:00Z');
const paris = scheduler.getLocalNow(instant, 'Europe/Paris');
const tokyo = scheduler.getLocalNow(instant, 'Asia/Tokyo');
const newYork = scheduler.getLocalNow(instant, 'America/New_York');
check('Paris : date (00:30 le lendemain)', paris.dateStr, '2026-01-16');
check('Paris : minutes (00:30 +1)', paris.minutes, 30);
check('Tokyo : date', tokyo.dateStr, '2026-01-16');
check('Tokyo : minutes (08:30 +9)', tokyo.minutes, 510);
check('New York : date (18:30 la veille)', newYork.dateStr, '2026-01-15');
check('New York : minutes (18:30 -5)', newYork.minutes, 18 * 60 + 30);
check('Vendredi 16/01/2026 → lundi=0 donc 4', paris.dayOfWeek, 4);
check('Jeudi 15/01/2026 à New York → 3', newYork.dayOfWeek, 3);
check('Fuseau invalide → repli Paris', scheduler.getLocalNow(instant, 'Nope/Nope').dateStr, paris.dateStr);

console.log('\n— Programme de la journée —');
const routines = [
  { id: 1, label: 'Réveil', reminder_time: '07:00', greeting: 'morning' },
  { id: 2, label: 'Sport', reminder_time: '18:00', greeting: null },
  { id: 3, label: 'Lecture', reminder_time: '22:30', greeting: 'night' },
  { id: 4, label: 'Sans rappel', reminder_time: null, greeting: null },
];
const schedule = scheduler.buildSchedule(routines);
check(
  'ordre et heures',
  schedule.map((e) => `${e.kind}@${e.minutes}`),
  [
    'morning_greeting@420',   // 07:00
    'todo_reminder@423',      // bonjour + 3 min
    'routine_reminder@1080',  // 18:00
    'daily_report@1305',      // 22:30 - 45 min
    'night_greeting@1350',    // 22:30
  ]
);
check(
  'la routine porteuse du bonjour ne déclenche pas de rappel séparé',
  schedule.filter((e) => e.routineId === 1).map((e) => e.kind),
  ['morning_greeting']
);

const withoutMorning = scheduler.buildSchedule([
  { id: 2, label: 'Sport', reminder_time: '18:00', greeting: null },
]);
check(
  'sans bonjour : rappel to-do à 8h00',
  withoutMorning.filter((e) => e.kind === 'todo_reminder').map((e) => e.minutes),
  [480]
);

const lateMorning = scheduler.buildSchedule([
  { id: 5, label: 'Sieste', reminder_time: '15:00', greeting: 'morning' },
]);
check(
  'bonjour programmé l\'après-midi : la to-do reste au matin',
  lateMorning.filter((e) => e.kind === 'todo_reminder').map((e) => e.minutes),
  [480]
);

const earlyNight = scheduler.buildSchedule([
  { id: 6, label: 'Dodo', reminder_time: '00:15', greeting: 'night' },
]);
check(
  'bonne nuit avant 00:45 : pas de bilan (il tomberait la veille)',
  earlyNight.filter((e) => e.kind === 'daily_report').length,
  0
);

console.log('\n— Rédaction des messages —');
const baseCtx = {
  userId: 42,
  username: 'Lucas',
  dateStr: '2026-01-15',
  routines: { total: 5, done: 3 },
  todos: { total: 4, urgent: 2, top: [{ name: 'Réviser SQL' }, { name: 'Appeler la banque' }], completedToday: 1 },
  learning: {
    domains: [{ name: 'Anglais', expectedMinutes: 30, actualMinutes: 20 }],
    expectedMinutes: 30,
    actualMinutes: 20,
    percent: 67,
  },
};

const morning = messages.buildMorningGreeting(baseCtx, { label: 'Réveil' });
assert('bonjour : le prénom apparaît', morning.title.includes('Lucas'), morning.title);
assert('bonjour : le domaine appris apparaît', morning.body.includes('Anglais'), morning.body);
assert('bonjour : la routine porteuse est citée', morning.body.includes('Réveil'), morning.body);

const night = messages.buildNightGreeting(baseCtx, null);
assert('bonne nuit : félicite quand il y a eu de l\'activité', /Aujourd'hui/.test(night.body), night.body);

const idleCtx = {
  ...baseCtx,
  routines: { total: 5, done: 0 },
  todos: { ...baseCtx.todos, completedToday: 0 },
  learning: { ...baseCtx.learning, actualMinutes: 0, percent: 0 },
};
const idleNight = messages.buildNightGreeting(idleCtx, null);
assert(
  'bonne nuit : ton neutre et encourageant si journée vide',
  !idleNight.body.includes('Aujourd\'hui :') && idleNight.body.length > 20,
  idleNight.body
);

const report = messages.buildDailyReport(baseCtx);
assert('bilan : pourcentage routines', report.body.includes('60%'), report.body);
assert('bilan : pourcentage apprentissage', report.body.includes('67%'), report.body);

const todo = messages.buildTodoReminder(baseCtx);
assert('to-do : liste les tâches', todo.body.includes('Réviser SQL'), todo.body);
assert('to-do : signale les prioritaires', todo.body.includes('prioritaires'), todo.body);

console.log('\n— Variation quotidienne —');
const bodies = new Set();
for (let day = 1; day <= 14; day++) {
  const dateStr = `2026-01-${String(day).padStart(2, '0')}`;
  bodies.add(messages.buildMorningGreeting({ ...baseCtx, dateStr }, null).title);
}
assert(`14 jours → ${bodies.size} ouvertures différentes`, bodies.size >= 6, `seulement ${bodies.size}`);

let sameAsPrevious = 0;
for (let day = 2; day <= 28; day++) {
  const today = `2026-01-${String(day).padStart(2, '0')}`;
  const yesterday = `2026-01-${String(day - 1).padStart(2, '0')}`;
  if (
    messages.buildMorningGreeting({ ...baseCtx, dateStr: today }, null).title ===
    messages.buildMorningGreeting({ ...baseCtx, dateStr: yesterday }, null).title
  ) {
    sameAsPrevious += 1;
  }
}
check('jamais deux jours consécutifs identiques', sameAsPrevious, 0);

console.log(`\n${failures === 0 ? 'Tout est bon.' : `${failures} vérification(s) en échec.`}\n`);
process.exitCode = failures === 0 ? 0 : 1;
