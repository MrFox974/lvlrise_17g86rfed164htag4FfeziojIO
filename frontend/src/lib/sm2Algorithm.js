/**
 * Logique SM-2+ pour affichage côté client (intervalle, raison, etc.)
 * Miroir léger du backend pour explications UX.
 */

export const QUALITY_LABELS = {
  1: 'Encore',
  2: 'Difficile',
  3: 'Bien',
  4: 'Facile',
};

/**
 * Description courte de la raison de la prochaine révision (pour l'UX)
 * @param {number} quality - 1 à 4
 * @param {Object} card - { repetitions, interval_days }
 * @returns {string}
 */
export function getReasonHint(quality, card) {
  if (quality === 1) {
    const interval = parseFloat(card?.interval_days) || 0;
    if (interval < 1 / (24 * 60) * 2) return 'Revoir dans 1 min';
    if (interval < 10 / (24 * 60) * 2) return 'Prochaine tentative dans 10 min';
    return 'Carte à retravailler';
  }
  const reps = card?.repetitions || 0;
  if (reps === 0) return 'Première réussite — demain';
  if (reps === 1) return 'Intervalle 6 jours';
  return `Intervalle ${Math.round(parseFloat(card?.interval_days) || 1)} jours`;
}
