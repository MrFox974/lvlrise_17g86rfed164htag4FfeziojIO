/**
 * Compteur de caractères d'un champ de carte.
 *
 * Le texte doit tenir dans la face affichée : au-delà de la limite, il déborde
 * en révision. Autant le signaler à la saisie plutôt qu'à la découverte.
 *
 * @param {{length: number, max: number, over: boolean, near: boolean}} state
 *   état renvoyé par getLengthState (lib/flashcardLimits).
 */
function CharCounter({ id, state }) {
  if (state.length === 0) return <div className="mb-3" />;
  return (
    <p
      id={id}
      className={`text-xs mb-3 text-right tabular-nums ${
        state.over
          ? 'text-[var(--om-danger)] font-medium'
          : state.near
            ? 'text-[var(--om-warning)]'
            : 'text-[var(--om-muted)]'
      }`}
    >
      {state.length}/{state.max}
      {state.over && ' — trop long, le texte débordera de la carte'}
    </p>
  );
}

export default CharCounter;
