/**
 * Longueurs maximales du texte d'une carte, côté saisie.
 *
 * Ces valeurs viennent de la mise en page réelle de la carte
 * (ReviewFullscreen.jsx) : au-delà, le texte déborde de la face visible.
 * Elles doivent rester identiques à backend/utils/flashcard-limits.js, qui
 * fait autorité et applique la même contrainte aux cartes générées.
 */
export const FRONT_MAX_CHARS = 120;
export const BACK_MAX_CHARS = 220;

/** Seuil à partir duquel on avertit l'utilisateur avant le dépassement. */
const WARN_RATIO = 0.85;

/**
 * État d'un champ pour l'affichage du compteur.
 * @returns {{ length: number, max: number, over: boolean, near: boolean }}
 */
export function getLengthState(value, max) {
  const length = String(value || '').trim().length;
  return {
    length,
    max,
    over: length > max,
    near: length > max * WARN_RATIO && length <= max,
  };
}
