import { isNewCard } from './flashcardStatus';

/**
 * Construction de la file d'une session de révision.
 *
 * Deux modes :
 * - `ratio` : mix nouvelles / révisions selon un curseur, alterné une pour une,
 *   pris dans les seules cartes dues.
 * - `smart` : toutes les cartes du périmètre — dues ou non — les plus difficiles
 *   d'abord, saupoudrées de cartes faciles pour entretenir la motivation.
 *   Repasser un groupe entier doit rester possible même quand tout est acquis :
 *   c'est l'ordre qui fait le tri, pas l'échéance.
 */

/* --------------------------------------------------------------------------
 * Difficulté d'une carte
 * ------------------------------------------------------------------------ */

const MIN_EASE = 1.1;
const MAX_EASE = 2.5;
/** Même seuil que le backend : au-delà, une réponse est jugée hésitante. */
const SLOW_ANSWER_SEC = 30;
/** Un intervalle de ce niveau signale une carte pleinement acquise. */
const LONG_INTERVAL_DAYS = 30;
/**
 * Une carte neuve n'a aucun historique : on ne peut ni la dire dure ni facile.
 * On la place juste au-dessus de la médiane — elle coûte de l'attention, donc
 * elle mérite le début de session, mais pas devant les échecs répétés.
 */
const NEW_CARD_DIFFICULTY = 0.5;
/** Sans temps de réponse connu, on ne pénalise qu'à peine. */
const UNKNOWN_ANSWER_TIME = 0.35;

const clamp01 = (n) => Math.max(0, Math.min(1, n));

/**
 * Note la difficulté d'une carte entre 0 (acquise) et 1 (en souffrance).
 *
 * Quatre signaux, du plus fiable au moins fiable :
 * - `ease_factor` : le juge de paix de SM-2, il encaisse tout l'historique
 * - `lapses` : les oublis après acquisition, pondérés de façon saturante
 *   (le 1er oubli compte beaucoup plus que le 6e)
 * - `interval_days` : sur une échelle log, car passer de 1 à 2 jours en dit
 *   bien plus long que passer de 20 à 21
 * - `response_time_sec` : l'hésitation, signal faible mais réel
 *
 * @param {Object} card
 * @returns {number} 0 → 1
 */
export function scoreDifficulty(card) {
  if (!card) return 0;
  if (isNewCard(card)) return NEW_CARD_DIFFICULTY;

  const ef = parseFloat(card.ease_factor);
  const ease = Number.isFinite(ef)
    ? clamp01((MAX_EASE - ef) / (MAX_EASE - MIN_EASE))
    : 0.5;

  const lapses = Math.max(0, Number(card.lapses) || 0);
  const forgetting = lapses / (lapses + 2);

  const days = Math.max(0, parseFloat(card.interval_days) || 0);
  const spacing = 1 - clamp01(Math.log2(1 + days) / Math.log2(1 + LONG_INTERVAL_DAYS));

  const rt = Number(card.response_time_sec);
  const hesitation = Number.isFinite(rt) && rt > 0
    ? clamp01(rt / SLOW_ANSWER_SEC)
    : UNKNOWN_ANSWER_TIME;

  return clamp01(0.4 * ease + 0.25 * forgetting + 0.25 * spacing + 0.1 * hesitation);
}

/* --------------------------------------------------------------------------
 * Mode smart
 * ------------------------------------------------------------------------ */

/**
 * Part de la session consacrée aux cartes difficiles.
 *
 * 3/4 n'est pas un chiffre rond posé au hasard : l'écart entre deux respirations
 * vaut `dures / faciles`, donc 3/4 donne une facile toutes les trois dures. À
 * 60 %, le rapport tombe à 1,5 — arrondi à 1, on alterne dur/facile en
 * permanence et ce n'est plus une session « les plus dures d'abord ».
 */
const HARD_SHARE = 0.75;
/** Jamais plus de cartes dures d'affilée que ça sans une victoire. */
const MAX_HARD_STREAK = 4;

/**
 * Évite deux cartes neuves consécutives : ce sont les plus coûteuses, les
 * enchaîner épuise. On échange la seconde avec la prochaine carte déjà connue.
 */
function spreadNewCards(entries) {
  const out = [...entries];
  for (let i = 1; i < out.length; i += 1) {
    if (!isNewCard(out[i].card) || !isNewCard(out[i - 1].card)) continue;
    const swapAt = out.findIndex((entry, k) => k > i && !isNewCard(entry.card));
    if (swapAt !== -1) {
      const tmp = out[i];
      out[i] = out[swapAt];
      out[swapAt] = tmp;
    }
  }
  return out;
}

/**
 * Ordonne les cartes dues de la plus dure à la moins dure, en insérant une
 * carte facile à intervalle régulier.
 *
 * L'idée : la difficulté décroît sur toute la session (on attaque au pic
 * d'attention, on finit en roue libre), et une réussite tombe au moins toutes
 * les `MAX_HARD_STREAK` cartes pour que l'effort reste récompensé.
 *
 * Quand une limite est posée, on ne garde pas simplement les N plus dures :
 * on prélève aux deux extrémités du classement, sinon il ne resterait rien de
 * facile à saupoudrer et la session deviendrait un mur.
 *
 * @param {Array} dueCards
 * @param {{ limit?: number }} [options] - sans limite, toutes les cartes dues
 * @returns {Array} cartes ordonnées
 */
export function buildSmartSession(dueCards, { limit } = {}) {
  const cards = Array.isArray(dueCards) ? dueCards.filter(Boolean) : [];
  if (cards.length === 0) return [];

  const capped = Number.isFinite(limit) && limit > 0
    ? Math.min(limit, cards.length)
    : cards.length;

  const ranked = cards
    .map((card) => ({ card, difficulty: scoreDifficulty(card) }))
    .sort((a, b) => b.difficulty - a.difficulty);

  const hardCount = Math.min(ranked.length, Math.ceil(capped * HARD_SHARE));
  const easyCount = Math.max(0, Math.min(ranked.length - hardCount, capped - hardCount));

  // Les dures de la plus dure à la moins dure ; les faciles de la plus facile
  // à la moins facile, pour que la première récompense soit la plus franche.
  const hard = ranked.slice(0, hardCount);
  const easy = easyCount > 0 ? ranked.slice(ranked.length - easyCount).reverse() : [];

  // On garde une carte facile pour la toute fin : on retient surtout le pic et
  // la dernière impression d'une session, autant qu'elle soit une réussite.
  const finale = easy.length > 1 ? easy.pop() : null;

  const gap = Math.max(1, Math.min(MAX_HARD_STREAK, Math.round(hard.length / (easy.length + 1))));

  const queue = [];
  let next = 0;
  hard.forEach((entry, i) => {
    queue.push(entry);
    if (next < easy.length && (i + 1) % gap === 0) {
      queue.push(easy[next]);
      next += 1;
    }
  });
  while (next < easy.length) {
    queue.push(easy[next]);
    next += 1;
  }
  if (finale) queue.push(finale);

  return spreadNewCards(queue).map((entry) => entry.card);
}

/* --------------------------------------------------------------------------
 * Mode ratio (historique)
 * ------------------------------------------------------------------------ */

/**
 * Mix nouvelles / révisions selon un curseur, alternées une pour une.
 *
 * @param {Array} dueCards
 * @param {{ limit: number, newRatio: number }} options
 * @returns {Array} cartes ordonnées
 */
export function buildSessionCards(dueCards, { limit, newRatio }) {
  const cards = Array.isArray(dueCards) ? dueCards.filter(Boolean) : [];
  const newCards = cards.filter((c) => (c.repetitions ?? 0) === 0);
  const reviewCards = cards.filter((c) => (c.repetitions ?? 0) > 0);
  const newCount = Math.min(Math.floor(limit * newRatio), newCards.length);
  const reviewCount = Math.min(limit - newCount, reviewCards.length);
  const pickedNew = newCards.slice(0, newCount);
  const pickedReview = reviewCards.slice(0, reviewCount);

  const mixed = [];
  let i = 0;
  let j = 0;
  while (i < pickedNew.length || j < pickedReview.length) {
    if (j < pickedReview.length) mixed.push(pickedReview[j++]);
    if (i < pickedNew.length) mixed.push(pickedNew[i++]);
  }
  return mixed;
}

/* --------------------------------------------------------------------------
 * Point d'entrée
 * ------------------------------------------------------------------------ */

/**
 * Construit la file d'une session à partir des réglages du modal.
 *
 * Les deux viviers sont fournis séparément car les modes ne piochent pas au
 * même endroit : `ratio` s'en tient aux cartes dues, `smart` prend tout le
 * périmètre (un groupe, une collection) pour permettre de le repasser en entier.
 *
 * @param {{ due?: Array, all?: Array }} pools - cartes dues et périmètre complet
 * @param {{ mode?: 'ratio'|'smart', limit?: number, newRatio?: number }} settings
 * @returns {Array} cartes ordonnées
 */
export function buildSession(pools, settings = {}) {
  const { due = [], all = [] } = pools || {};
  const { mode = 'smart', limit = 20, newRatio = 0.3 } = settings;
  return mode === 'smart'
    ? buildSmartSession(all.length > 0 ? all : due)
    : buildSessionCards(due, { limit, newRatio });
}
