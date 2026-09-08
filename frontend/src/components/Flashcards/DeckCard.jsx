/**
 * Carte visuelle d'un deck avec stats (due today, total, mastery)
 */
function DeckCard({ deck, dueCount, onClick }) {
  const total = deck.card_count ?? 0;
  const masteryPercent = total > 0 && dueCount !== undefined
    ? Math.round(((total - dueCount) / total) * 100)
    : 0;

  return (
    <button
      type="button"
      onClick={() => onClick(deck.id)}
      className="w-full text-left rounded-2xl border border-[var(--om-line)] bg-[var(--om-surface)] p-4 shadow-[var(--om-shadow)] hover:border-[var(--om-accent)]/50 hover:bg-[var(--om-accent)]/5 transition-all"
    >
      <div className="flex justify-between items-start">
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-[var(--om-text)] truncate">
            {deck.name}
          </h3>
          {deck.description && (
            <p className="text-sm text-[var(--om-muted)] mt-0.5 line-clamp-2">
              {deck.description}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-0.5 ml-3 flex-shrink-0">
          <span
            className={`text-sm font-medium tabular-nums ${
              (dueCount ?? 0) > 0 ? 'text-[var(--om-accent)]' : 'text-[var(--om-muted)]'
            }`}
          >
            {dueCount ?? 0} à réviser
          </span>
          <span className="text-xs text-[var(--om-muted)] tabular-nums">
            {total} carte{total !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
      {total > 0 && (
        <div className="mt-2 h-1.5 rounded-full bg-[var(--om-track)] overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--om-accent)] transition-all duration-500"
            style={{ width: `${Math.min(100, masteryPercent)}%` }}
          />
        </div>
      )}
    </button>
  );
}

export default DeckCard;
