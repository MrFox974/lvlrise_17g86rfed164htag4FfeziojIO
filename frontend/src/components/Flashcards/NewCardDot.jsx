/**
 * Pastille signalant une carte encore jamais réussie.
 * Elle s'éteint dès la première note « Bien » ou « Facile ».
 */
function NewCardDot({ className = '', size = 'w-2 h-2', title = 'Nouvelle carte' }) {
  return (
    <span
      className={`inline-block rounded-full bg-[var(--om-accent)] flex-shrink-0 ${size} ${className}`}
      role="img"
      aria-label={title}
      title={title}
    />
  );
}

export default NewCardDot;
