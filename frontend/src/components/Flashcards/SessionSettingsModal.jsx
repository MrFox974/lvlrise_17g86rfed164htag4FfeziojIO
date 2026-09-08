import { useState, useCallback, useEffect } from 'react';

/** Estimation : ~30 s par carte en moyenne */
const SEC_PER_CARD = 30;

/**
 * Modal de réglages de session (nb max, mix new/review, noter sa réponse).
 * Sert aussi bien à une collection entière qu'à un seul groupe de cartes :
 * seul le titre change, les réglages sont les mêmes.
 */
function SessionSettingsModal({
  isOpen,
  onClose,
  onStart,
  dueCount,
  totalCount,
  title = 'Paramètres de session',
}) {
  const [mode, setMode] = useState('smart');
  const [limit, setLimit] = useState(20);
  const [displayLimit, setDisplayLimit] = useState(null);
  const [newRatio, setNewRatio] = useState(0.3);
  const [allowWrittenResponse, setAllowWrittenResponse] = useState(false);

  const handleStart = useCallback(() => {
    onStart({ mode, limit, newRatio, allowWrittenResponse });
    onClose();
  }, [mode, limit, newRatio, allowWrittenResponse, onStart, onClose]);

  useEffect(() => {
    if (isOpen) {
      setMode('smart');
      setLimit(Math.min(20, Math.max(5, dueCount || 20)));
      setDisplayLimit(null);
    }
  }, [isOpen, dueCount]);

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  const isSmart = mode === 'smart';
  // En mode smart, tout le périmètre y passe — cartes dues ou déjà acquises :
  // c'est l'ordre qui fait le tri, pas l'échéance ni un plafond.
  const smartCount = totalCount ?? dueCount ?? 0;
  const effectiveLimit = isSmart ? smartCount : Math.min(limit, dueCount || limit);
  const newCards = Math.floor(effectiveLimit * newRatio);
  const reviewCards = effectiveLimit - newCards;
  const canStart = isSmart ? smartCount > 0 : (dueCount ?? 0) > 0;

  const modes = [
    { id: 'smart', label: 'Smart', hint: 'Tout, les plus dures d’abord', icon: 'ph-sparkle' },
    { id: 'ratio', label: 'New / Old', hint: 'Je dose moi-même' },
  ];

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-modal-title"
    >
      <div
        className="om-scrim"
        onClick={onClose}
      />
      <div
        className="relative z-10 om-card shadow-[var(--om-shadow-lg)] p-6 w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="session-modal-title" className="text-lg font-medium text-[var(--om-text)] mb-4">
          {title}
        </h3>
        <div className="space-y-4">
          <div>
            <span className="block text-sm font-medium text-[var(--om-text)] mb-2">
              Choix des cartes
            </span>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Choix des cartes">
              {modes.map((m) => {
                const selected = mode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setMode(m.id)}
                    className={`flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-2xl border text-left transition-colors ${
                      selected
                        ? 'border-[var(--om-accent)] bg-[var(--om-accent-soft)]'
                        : 'border-[var(--om-line)] hover:bg-[var(--om-surface-2)]'
                    }`}
                  >
                    <span className={`flex items-center gap-1.5 text-sm font-medium ${
                      selected ? 'text-[var(--om-text)]' : 'text-[var(--om-muted)]'
                    }`}>
                      {m.icon && <i className={`ph ${m.icon} text-base`} aria-hidden="true" />}
                      {m.label}
                    </span>
                    <span className="text-xs text-[var(--om-muted)]">{m.hint}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {isSmart && (
            <div className="rounded-2xl bg-[var(--om-surface-2)] px-3 py-3">
              <p className="text-sm text-[var(--om-text)]">
                Les {smartCount} carte(s), de la plus difficile à la plus acquise —
                déjà révisées ou non.
              </p>
              <p className="text-xs text-[var(--om-muted)] mt-1">
                Une carte facile s’intercale toutes les 3 cartes environ, et la session
                se termine sur une réussite. Difficulté estimée d’après les oublis, le
                facteur de facilité, l’intervalle et le temps de réponse.
              </p>
              {effectiveLimit > 0 && (
                <p className="text-xs text-[var(--om-muted)] mt-1">
                  ~{Math.ceil((effectiveLimit * SEC_PER_CARD) / 60)} min estimées
                </p>
              )}
            </div>
          )}

          <div className={isSmart ? 'hidden' : undefined}>
            <label className="block text-sm font-medium text-[var(--om-text)] mb-2">
              Nombre max de cartes
            </label>
            <input
              type="number"
              min={5}
              max={100}
              value={displayLimit !== null ? displayLimit : String(limit)}
              onChange={(e) => setDisplayLimit(e.target.value)}
              onBlur={() => {
                const raw = displayLimit !== null ? displayLimit : String(limit);
                const n = raw === '' ? 5 : parseInt(raw, 10);
                setLimit(Number.isNaN(n) ? 5 : Math.max(5, Math.min(100, n)));
                setDisplayLimit(null);
              }}
              className="w-full px-3 py-2 rounded-2xl border border-[var(--om-line)] text-[var(--om-text)]"
            />
            <p className="text-xs text-[var(--om-muted)] mt-1">
              {dueCount ?? 0} carte(s) disponibles
              {effectiveLimit > 0 && (
                <span className="ml-1">
                  · ~{Math.ceil((effectiveLimit * SEC_PER_CARD) / 60)} min estimées
                </span>
              )}
            </p>
          </div>
          <div className={isSmart ? 'hidden' : undefined}>
            <label className="block text-sm font-medium text-[var(--om-text)] mb-2">
              Nouvelles cartes (~{Math.round(newRatio * 100)} %)
            </label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={newRatio}
              onChange={(e) => setNewRatio(parseFloat(e.target.value))}
              className="w-full accent-[var(--om-accent)]"
            />
            <p className="text-xs text-[var(--om-muted)] mt-1">
              ~{newCards} nouvelles, ~{reviewCards} révisions
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="allow-written-response"
              type="checkbox"
              checked={allowWrittenResponse}
              onChange={(e) => setAllowWrittenResponse(e.target.checked)}
              className="w-4 h-4 rounded border-[var(--om-line)] text-[var(--om-accent)] focus:ring-[var(--om-accent)]"
            />
            <label htmlFor="allow-written-response" className="text-sm text-[var(--om-text)]">
              Permettre de noter ma réponse avant de révéler
            </label>
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-6 pt-4 border-t border-[var(--om-line)]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-2xl text-sm text-[var(--om-muted)] hover:bg-[var(--om-surface-2)] transition-colors"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleStart}
            disabled={!canStart}
            className="px-4 py-2 rounded-2xl bg-[var(--om-accent)] text-[var(--om-on-accent)] text-sm font-medium hover:bg-[var(--om-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Commencer
          </button>
        </div>
      </div>
    </div>
  );
}

export default SessionSettingsModal;
