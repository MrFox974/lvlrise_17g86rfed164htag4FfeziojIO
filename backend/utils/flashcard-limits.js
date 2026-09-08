/**
 * Contraintes de taille du texte d'une carte.
 *
 * Ces valeurs ne sont pas arbitraires : elles viennent de la mise en page réelle
 * de la carte dans ReviewFullscreen.jsx — face de 280 px de haut minimum, padding
 * de 32 px, recto en text-xl (20 px) et verso en text-2xl (24 px), le tout en
 * `whitespace-pre-wrap` sans défilement ni troncature. Au-delà de ces longueurs,
 * le texte déborde visuellement de la carte.
 *
 * Le verso affiche AUSSI la question au-dessus de la réponse, d'où une marge
 * plus serrée que ne le laisserait croire la hauteur disponible.
 *
 * Toute modification ici doit être répercutée dans
 * frontend/src/lib/flashcardLimits.js (mêmes valeurs, compteur de saisie).
 */

/** Recto : une question doit tenir en 2 à 3 lignes. */
const FRONT_MAX_CHARS = 120;

/** Verso : la réponse partage la carte avec le rappel de la question. */
const BACK_MAX_CHARS = 220;

/** En deçà, la carte n'apporte rien (« oui », « 1789 » sans contexte). */
const FRONT_MIN_CHARS = 8;
const BACK_MIN_CHARS = 2;

/**
 * Ramène un texte sous la limite en préservant le sens : on coupe d'abord à une
 * fin de phrase, sinon à un mot entier. Tronquer au caractère près rendrait une
 * réponse fausse plutôt que courte.
 */
function fitText(text, maxChars) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxChars) return clean;

  // Dernière fin de phrase qui tient dans la limite.
  const window = clean.slice(0, maxChars + 1);
  const sentenceEnd = Math.max(
    window.lastIndexOf('. '),
    window.lastIndexOf('! '),
    window.lastIndexOf('? '),
    window.lastIndexOf('.\n')
  );
  if (sentenceEnd > maxChars * 0.5) return clean.slice(0, sentenceEnd + 1).trim();

  const lastSpace = clean.lastIndexOf(' ', maxChars - 1);
  const cut = lastSpace > maxChars * 0.5 ? lastSpace : maxChars - 1;
  return `${clean.slice(0, cut).trim()}…`;
}

/** Normalise une carte et signale si elle dépasse encore les limites. */
function normalizeCard(front, back) {
  const cleanFront = String(front || '').replace(/\s+/g, ' ').trim();
  const cleanBack = String(back || '').replace(/\s+/g, ' ').trim();
  return {
    front: cleanFront,
    back: cleanBack,
    frontTooLong: cleanFront.length > FRONT_MAX_CHARS,
    backTooLong: cleanBack.length > BACK_MAX_CHARS,
    tooShort: cleanFront.length < FRONT_MIN_CHARS || cleanBack.length < BACK_MIN_CHARS,
  };
}

module.exports = {
  FRONT_MAX_CHARS,
  BACK_MAX_CHARS,
  FRONT_MIN_CHARS,
  BACK_MIN_CHARS,
  fitText,
  normalizeCard,
};
