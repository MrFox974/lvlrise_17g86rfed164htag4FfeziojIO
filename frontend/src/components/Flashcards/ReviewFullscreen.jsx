import { useState, useEffect, useCallback, useRef } from 'react';
import { useReviewSession } from '../../hooks/useReviewSession';
import { isNewCard } from '../../lib/flashcardStatus';
import NewCardDot from './NewCardDot';

/**
 * UI Review plein écran : 4 zones empilées sur toute la hauteur
 * (barre / historique / carte élastique / actions), flip 3D, transition Tinder.
 *
 * La barre d'actions garde la même hauteur avant et après le retournement :
 * les deux états sont superposés dans une même cellule de grille, donc la zone
 * carte n'est jamais redimensionnée en cours de session.
 */
const SHEET_EXIT_MS = 340;

function ReviewFullscreen({ deckId, cards, onComplete, onBack, allowWrittenResponse = false }) {
  // Carte pour laquelle la réponse a été masquée à la main : dérivé plutôt que
  // synchronisé par effet, donc remis à zéro tout seul au changement de carte.
  const [hiddenAnswerKey, setHiddenAnswerKey] = useState(null);
  const [sheetMounted, setSheetMounted] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const sheetTimerRef = useRef(null);
  const textareaRef = useRef(null);

  const {
    index,
    card,
    flipped,
    loading,
    writtenResponse,
    setWrittenResponse,
    remaining,
    handleReveal,
    handleQuality,
    QUALITY_LABELS,
    lastReason,
    lastQuality,
    transitionPhase,
    history,
    historyIndex,
    goBack,
    goForward,
    canGoBack,
    canGoForward,
  } = useReviewSession({ deckId, cards, onComplete, onBack, allowWrittenResponse });

  const isHistoryView = historyIndex !== null;
  const viewedCard = isHistoryView ? history[historyIndex] : null;
  const cardKey = isHistoryView ? `h-${historyIndex}` : index;
  const showAnswer = hiddenAnswerKey !== cardKey;

  useEffect(() => () => clearTimeout(sheetTimerRef.current), []);

  const openSheet = useCallback(() => {
    setSheetMounted(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setSheetOpen(true)));
  }, []);

  const closeSheet = useCallback((then) => {
    setSheetOpen(false);
    clearTimeout(sheetTimerRef.current);
    sheetTimerRef.current = setTimeout(() => {
      setSheetMounted(false);
      then?.();
    }, SHEET_EXIT_MS);
  }, []);

  // La feuille se referme avant que la carte ne se retourne : les deux
  // mouvements s'enchaînent au lieu de se superposer.
  const validateWritten = useCallback(() => closeSheet(handleReveal), [closeSheet, handleReveal]);
  const skipWritten = useCallback(() => {
    setWrittenResponse('');
    closeSheet(handleReveal);
  }, [closeSheet, handleReveal, setWrittenResponse]);

  useEffect(() => {
    if (!sheetMounted) return undefined;
    const focusTimer = setTimeout(() => textareaRef.current?.focus(), 120);
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeSheet(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener('keydown', onKey);
    };
  }, [sheetMounted, closeSheet]);

  if (!card && !isHistoryView) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] text-center p-6">
        <p className="text-[var(--om-muted)] mb-4">Aucune carte à réviser.</p>
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 rounded-2xl bg-[var(--om-accent)] text-[var(--om-on-accent)] font-medium hover:bg-[var(--om-accent-hover)]"
        >
          Retour
        </button>
      </div>
    );
  }

  const handleCardClick = () => {
    if (isHistoryView) return;
    if (flipped) {
      setHiddenAnswerKey((k) => (k === cardKey ? null : cardKey));
    } else if (allowWrittenResponse) {
      openSheet();
    } else {
      handleReveal();
    }
  };

  const statusLabel = isHistoryView
    ? 'Carte déjà notée'
    : allowWrittenResponse
      ? 'En attente de ta réponse'
      : 'En attente de la réponse';

  const showGrades = flipped && !isHistoryView;

  return (
    <div className="fixed inset-0 z-[180] bg-[var(--om-bg)] flex flex-col overflow-hidden">
      {/* Zone 1 — barre */}
      <div className="flex items-center justify-between px-4 py-3 min-h-[52px] border-b border-[var(--om-line)] bg-[var(--om-surface)]/90 flex-shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-[var(--om-accent)] hover:underline font-medium"
        >
          ← Quitter
        </button>
        <span className="text-sm font-medium text-[var(--om-accent)] tabular-nums">
          {remaining} carte{remaining !== 1 ? 's' : ''} restante{remaining !== 1 ? 's' : ''}
        </span>
        <span className="text-sm text-[var(--om-muted)] w-16 text-right">
          {isHistoryView
            ? `${historyIndex + 1}/${history.length}`
            : `${index + 1}/${cards.length}`}
        </span>
      </div>

      {/* Zone 2 — historique, ancré en haut */}
      <div className="flex-shrink-0 h-11 flex items-center justify-center gap-2 border-b border-[var(--om-line)]">
        <button
          type="button"
          onClick={goBack}
          disabled={!canGoBack}
          className="p-1.5 rounded-[10px] text-[var(--om-muted)] hover:bg-[var(--om-surface-2)] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
          title={!canGoBack ? 'Aucune carte précédente' : undefined}
          aria-label="Carte précédente"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-sm text-[var(--om-muted)] font-medium">historique</span>
        <button
          type="button"
          onClick={goForward}
          disabled={!canGoForward}
          className="p-1.5 rounded-[10px] text-[var(--om-muted)] hover:bg-[var(--om-surface-2)] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
          title={!canGoForward ? 'Carte courante' : undefined}
          aria-label="Carte suivante"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Zone 3 — la carte, seule zone élastique */}
      <div className="flex-1 min-h-0 flex justify-center p-4 md:p-6">
        <div
          key={cardKey}
          className={`w-full max-w-xl flex flex-col min-h-0 ${
            transitionPhase === 'exiting' ? 'flashcard-slide-out' : ''
          } ${transitionPhase === 'entering' ? 'flashcard-slide-in' : ''}`}
        >
          {isHistoryView ? (
            <div className="flex-1 min-h-0 overflow-y-auto rounded-2xl border border-[var(--om-line)] bg-[var(--om-surface)] p-6 md:p-8 shadow-[var(--om-shadow)] text-left">
              <p className="text-sm font-medium text-[var(--om-muted)] mb-2">Question</p>
              <p className="text-lg text-[var(--om-text)] whitespace-pre-wrap mb-4">
                {viewedCard?.card?.front}
              </p>
              <p className="text-sm font-medium text-[var(--om-muted)] mb-2">Réponse</p>
              <p className="text-lg text-[var(--om-text)] whitespace-pre-wrap mb-4">
                {viewedCard?.card?.back}
              </p>
              <p className="text-xs text-[var(--om-accent)] font-medium">
                Revoir : {viewedCard?.reason || '—'}
              </p>
              {viewedCard?.writtenResponse && (
                <p className="text-xs text-[var(--om-muted)] mt-2 italic">
                  Ma réponse : {viewedCard.writtenResponse}
                </p>
              )}
            </div>
          ) : (
            <div
              className={`flashcard-3d relative flex-1 min-h-0 ${flipped ? 'cursor-pointer' : ''}`}
              onClick={handleCardClick}
              onKeyDown={(e) => {
                if (flipped && (e.key === ' ' || e.key === 'Enter')) {
                  e.preventDefault();
                  handleCardClick();
                }
              }}
              role={flipped ? 'button' : undefined}
              tabIndex={flipped ? 0 : undefined}
              aria-label={flipped ? 'Masquer la réponse (clic pour revoir la question)' : undefined}
            >
              {/* Hors du bloc qui pivote : la pastille reste en place au retournement. */}
              {isNewCard(card) && (
                <NewCardDot
                  className="absolute top-3.5 right-3.5 z-20"
                  size="w-2.5 h-2.5"
                  title="Nouvelle carte — jamais réussie"
                />
              )}
              <div className={`flashcard-inner flashcard-inner-full ${flipped && showAnswer ? 'flipped' : ''}`}>
                {/* Recto */}
                <button
                  type="button"
                  onClick={(e) => {
                    if (flipped) return;
                    e.stopPropagation();
                    if (allowWrittenResponse) openSheet();
                    else handleReveal();
                  }}
                  className={`flashcard-face flashcard-card-face w-full rounded-2xl border p-6 md:p-8 shadow-[var(--om-shadow)] text-left outline-none flex flex-col ${
                    flipped && showAnswer
                      ? 'border-[var(--om-accent)]/50 bg-[var(--om-surface)] cursor-default pointer-events-none'
                      : 'border-[var(--om-accent)] bg-[var(--om-surface)] hover:shadow-[var(--om-shadow-lg)] cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--om-accent)] focus-visible:ring-offset-2'
                  }`}
                  aria-label={
                    flipped && showAnswer
                      ? 'Réponse affichée'
                      : allowWrittenResponse
                        ? 'Écrire ma réponse'
                        : 'Afficher la réponse (Espace)'
                  }
                >
                  <div
                    className="flex-1 min-h-0 overflow-y-auto flex flex-col"
                    style={{ transform: 'translateZ(0)', WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale', textRendering: 'optimizeLegibility' }}
                  >
                    <p className="text-sm font-medium text-[var(--om-muted)] mb-2">Question</p>
                    <p className="text-xl text-[var(--om-text)] whitespace-pre-wrap">
                      {card.front}
                    </p>
                    <p className="text-xs text-[var(--om-muted)] mt-auto pt-4">
                      {allowWrittenResponse
                        ? 'Touche la carte pour écrire ta réponse'
                        : 'Espace ou clic pour afficher la réponse'}
                    </p>
                  </div>
                </button>

                {/* Verso */}
                <div
                  className={`flashcard-face flashcard-card-face flashcard-back-face w-full rounded-2xl border border-[var(--om-accent)]/50 p-6 md:p-8 shadow-[var(--om-shadow)] bg-[var(--om-surface)] text-left flex flex-col ${
                    flipped && showAnswer ? 'pointer-events-none' : ''
                  }`}
                >
                  <div
                    className="flex-1 min-h-0 overflow-y-auto flex flex-col"
                    style={{ transform: 'translateZ(0)', WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale', textRendering: 'optimizeLegibility' }}
                  >
                    <p className="text-xs font-medium text-[var(--om-muted)] mb-1">Question</p>
                    <p className="text-sm md:text-base text-[var(--om-text)] whitespace-pre-wrap mb-4">
                      {card.front}
                    </p>
                    <p className="text-sm font-medium text-[var(--om-accent)] mb-1">Réponse</p>
                    <p className="text-lg md:text-2xl text-[var(--om-text)] whitespace-pre-wrap">
                      {card.back}
                    </p>
                    {allowWrittenResponse && writtenResponse && (
                      <div className="mt-4 rounded-2xl bg-[var(--om-surface-2)] border-l-2 border-[var(--om-muted)] px-3 py-2">
                        <p className="om-kicker mb-1">Ma réponse</p>
                        <p className="text-sm text-[var(--om-text)] whitespace-pre-wrap">
                          {writtenResponse}
                        </p>
                      </div>
                    )}
                    <p className="text-xs text-[var(--om-muted)] mt-auto pt-4">
                      Touche la carte pour revoir la question
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Zone 4 — actions, hauteur identique dans les deux états */}
      <div
        className="flex-shrink-0 border-t border-[var(--om-line)] bg-[var(--om-surface)]/90 px-4 pt-3"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
      >
        <div className="w-full max-w-xl mx-auto grid">
          {/* État d'attente : aucun bouton, la carte seule ouvre la saisie */}
          <div
            className={`flex items-center justify-center gap-1.5 text-sm text-[var(--om-muted)] transition-opacity duration-200 ${
              showGrades ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}
            style={{ gridArea: '1 / 1' }}
            aria-hidden={showGrades}
          >
            <span>{statusLabel}</span>
            <span className="inline-flex items-end gap-1 h-3 pb-0.5" aria-hidden="true">
              <i className="review-dot w-1 h-1 rounded-full bg-[var(--om-muted)]" />
              <i className="review-dot w-1 h-1 rounded-full bg-[var(--om-muted)]" />
              <i className="review-dot w-1 h-1 rounded-full bg-[var(--om-muted)]" />
            </span>
          </div>

          {/* Les 4 notes : toujours présentes dans le flux, d'où une hauteur stable */}
          <div
            className={`grid grid-cols-2 sm:grid-cols-4 gap-2 transition-opacity duration-200 ${
              showGrades ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            style={{ gridArea: '1 / 1' }}
            aria-hidden={!showGrades}
          >
            {[1, 2, 3, 4].map((q) => {
              const showReason = lastQuality === q && lastReason;
              const numberColorClass =
                q === 1 ? 'text-[var(--om-danger-strong)]'
                : q === 2 ? 'text-[var(--om-warning)]'
                : q === 3 ? 'text-[var(--om-accent)]'
                : 'text-[var(--om-success)]';
              return (
                <button
                  key={q}
                  type="button"
                  onClick={() => handleQuality(q)}
                  disabled={loading || !showGrades}
                  tabIndex={showGrades ? 0 : -1}
                  className={`py-3 px-4 rounded-2xl text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--om-accent)] ${
                    q === 1
                      ? 'bg-[var(--om-danger-soft)] text-[var(--om-danger-strong)] hover:bg-[var(--om-danger-soft)]'
                      : q === 2
                        ? 'bg-[var(--om-warning-soft)] text-[var(--om-warning)] hover:bg-[var(--om-warning-soft)]'
                        : q === 3
                          ? 'bg-[var(--om-accent)]/20 text-[var(--om-accent)] hover:bg-[var(--om-accent)]/30'
                          : 'bg-[var(--om-success-soft)] text-[var(--om-success)] hover:bg-[var(--om-success-soft)]'
                  } disabled:opacity-60 min-h-[56px]`}
                  aria-label={`${QUALITY_LABELS[q]} (${q})`}
                >
                  {showReason ? (
                    <span className="text-xs font-medium animate-[fade-in_0.2s_ease-out]">
                      {lastReason}
                    </span>
                  ) : (
                    <>
                      <span className={`font-mono font-medium mr-1 ${numberColorClass}`}>{q}</span>
                      {QUALITY_LABELS[q]}
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Pop-up de saisie : glissé depuis le bas, la carte garde sa pleine hauteur */}
      {sheetMounted && (
        <>
          <div
            className={`review-sheet-backdrop ${sheetOpen ? 'is-open' : ''}`}
            onClick={() => closeSheet(null)}
            aria-hidden="true"
          />
          <div
            className={`review-sheet ${sheetOpen ? 'is-open' : ''} bg-[var(--om-surface)] rounded-t-3xl shadow-[var(--om-shadow-lg)] px-4 pt-3`}
            style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}
            role="dialog"
            aria-modal="true"
            aria-label="Écrire ma réponse"
          >
            <div className="w-full max-w-xl mx-auto flex flex-col gap-3">
              <div className="w-8 h-1 rounded-full bg-[var(--om-line)] mx-auto" />
              <div>
                <p className="text-sm font-medium text-[var(--om-text)]">Ma réponse</p>
                <p className="text-sm text-[var(--om-muted)] whitespace-pre-wrap line-clamp-3">
                  {card?.front}
                </p>
              </div>
              <textarea
                ref={textareaRef}
                value={writtenResponse}
                onChange={(e) => setWrittenResponse(e.target.value)}
                placeholder="Écris ta réponse avant de la comparer…"
                rows={3}
                className="w-full px-3 py-2 rounded-[10px] border border-[var(--om-line)] bg-[var(--om-surface)] text-sm text-[var(--om-text)] resize-none focus:outline-none focus:border-[var(--om-accent)] focus:ring-2 focus:ring-[var(--om-accent)]/40"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={skipWritten}
                  className="px-4 min-h-[48px] rounded-2xl border border-[var(--om-line)] text-sm font-medium text-[var(--om-muted)] hover:bg-[var(--om-surface-2)]"
                >
                  Passer
                </button>
                <button
                  type="button"
                  onClick={validateWritten}
                  className="flex-1 min-h-[48px] rounded-2xl bg-[var(--om-accent)] text-[var(--om-on-accent)] text-sm font-medium hover:bg-[var(--om-accent-hover)]"
                >
                  Valider
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default ReviewFullscreen;
