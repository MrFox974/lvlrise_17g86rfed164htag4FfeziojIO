/**
 * Une carte est « nouvelle » tant qu'elle n'a jamais été réussie, c'est-à-dire
 * tant qu'elle n'a pas reçu au moins une fois la note « Bien » (3) ou
 * « Facile » (4). C'est `learned_at`, posé au premier succès, qui le dit.
 *
 * On ne se sert pas de `repetitions` : un oubli le remet à zéro, ce qui ferait
 * réapparaître comme neuve une carte déjà vue des dizaines de fois.
 */
export function isNewCard(card) {
  return Boolean(card) && !card.learned_at;
}
