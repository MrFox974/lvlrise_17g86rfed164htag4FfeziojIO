/**
 * Priorités des tâches — source unique de vérité.
 *
 * Nocturne tient sur une seule famille chromatique : les priorités sont donc
 * une rampe tonale de violet, du plus soutenu au plus effacé. Seule « urgence
 * absolue » sort de la famille, parce qu'une urgence doit se lire d'un coup
 * d'œil et non se deviner par nuance.
 */
export const TAG_COLOR = {
  absolue: 'var(--om-tag-absolue)',
  important: 'var(--om-tag-important)',
  'à faire': 'var(--om-tag-afaire)',
  projet: 'var(--om-tag-projet)',
  idée: 'var(--om-tag-idee)',
};

export const TAG_LABEL = {
  absolue: 'Urgence absolue',
  important: 'Très important',
  'à faire': 'À faire en priorité',
  projet: 'Projet en cours',
  'idée': 'Idée à explorer',
};

export const TAG_ORDER = ['absolue', 'important', 'à faire', 'projet', 'idée'];

export function getTagColor(tagId) {
  return TAG_COLOR[tagId] ?? 'var(--om-tag-afaire)';
}

export function getTagLabel(tagId) {
  return TAG_LABEL[tagId] ?? tagId;
}
