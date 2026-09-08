/**
 * Groupes de to-do créés par l'utilisateur.
 *
 * Côté serveur, un groupe n'existe pas en tant qu'entité : c'est une simple
 * colonne `group_name` sur les tâches. Un groupe vide n'a donc rien à quoi se
 * raccrocher et disparaissait au rechargement. On mémorise ici les noms créés
 * pour que l'onglet reste présent tant que l'utilisateur ne le supprime pas.
 *
 * Conséquence à connaître : cette liste est locale à l'appareil. Un groupe vide
 * ne suivra pas l'utilisateur sur un autre téléphone — dès qu'il contient une
 * tâche, il réapparaît partout puisqu'il est alors déduit des tâches.
 */

const KEY = 'lvlrise-todo-groups';
const KEY_DEMO = 'lvlrise-todo-groups-demo';

const storageKey = (isDemo) => (isDemo ? KEY_DEMO : KEY);

export function readStoredGroups(isDemo) {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(storageKey(isDemo));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((g) => typeof g === 'string' && g.trim() && g !== 'Main');
  } catch {
    return [];
  }
}

function writeStoredGroups(isDemo, groups) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(isDemo), JSON.stringify(groups));
  } catch {
    /* quota ou mode privé : le groupe reste valable pour la session */
  }
}

export function rememberGroup(isDemo, name) {
  const clean = (name || '').trim();
  if (!clean || clean === 'Main') return;
  const current = readStoredGroups(isDemo);
  if (current.includes(clean)) return;
  writeStoredGroups(isDemo, [...current, clean]);
}

export function forgetGroup(isDemo, name) {
  const clean = (name || '').trim();
  if (!clean) return;
  writeStoredGroups(
    isDemo,
    readStoredGroups(isDemo).filter((g) => g !== clean)
  );
}

export function renameStoredGroup(isDemo, from, to) {
  const fromClean = (from || '').trim();
  const toClean = (to || '').trim();
  if (!fromClean || !toClean) return;
  const next = readStoredGroups(isDemo).filter((g) => g !== fromClean);
  if (toClean !== 'Main' && !next.includes(toClean)) next.push(toClean);
  writeStoredGroups(isDemo, next);
}

/** « Main » d'abord, puis les groupes déduits des tâches et ceux mémorisés. */
export function mergeGroups(isDemo, derived) {
  const ordered = ['Main'];
  for (const name of [...derived, ...readStoredGroups(isDemo)]) {
    if (typeof name === 'string' && name.trim() && !ordered.includes(name)) ordered.push(name);
  }
  return ordered;
}
