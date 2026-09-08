import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useLoaderData, useNavigate, useParams, useLocation } from 'react-router-dom';
import { useDemoMode, useDemoBasePath } from '../../../../hooks/useDemoMode';
import DemoBlockModal from '../../../../components/DemoBlockModal';
import {
  fetchDecks,
  createDeck,
  deleteDeck,
  fetchCards,
  createCard,
  updateCard,
  deleteCard,
  fetchDueCards,
  fetchChapters,
  createChapter,
  deleteChapter,
  reorderChapters,
  reorderCards,
  fetchDeckGenerationContext,
} from '../../../../utils/flashcardApi';
import {
  fetchDemoDecks,
  createDemoDeck,
  deleteDemoDeck,
  fetchDemoCards,
  createDemoCard,
  updateDemoCard,
  deleteDemoCard,
  fetchDemoDueCards,
  fetchDemoChapters,
  createDemoChapter,
  deleteDemoChapter,
  reorderDemoChapters,
  reorderDemoCards,
} from '../../../../utils/demoApi';
import {
  ImportModal,
  SessionSettingsModal,
  ReviewFullscreen,
  ConfirmDelete,
  GenerateDeckModal,
  GenerateCardModal,
  CompleteDeckModal,
  NewCardDot,
  CharCounter,
} from '../../../../components/Flashcards';
import { Celebration, CelebrationLive } from '../../../../components/Celebration';
import { useCelebration } from '../../../../hooks/useCelebration';
import { FRONT_MAX_CHARS, BACK_MAX_CHARS, getLengthState } from '../../../../lib/flashcardLimits';
import { isNewCard } from '../../../../lib/flashcardStatus';
import { buildSession } from '../../../../lib/sessionOrdering';

function DeckList({
  decks,
  onCreateDeck,
  onSelectDeck,
  onSessionClick,
  onDemoBlockRequest,
  onCelebrate,
  isDemo = false,
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [swipingDeckId, setSwipingDeckId] = useState(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [confirmDeleteDeck, setConfirmDeleteDeck] = useState(null);
  const [ignoreClickDeckId, setIgnoreClickDeckId] = useState(null);
  const swipeStartX = useRef(0);
  const swipeCurrentX = useRef(0);

  const createDeckFn = isDemo ? createDemoDeck : createDeck;
  const deleteDeckFn = isDemo ? deleteDemoDeck : deleteDeck;

  const handleCreate = useCallback(async () => {
    if (!name.trim()) {
      setError('Le nom est requis');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const deck = await createDeckFn(name, description);
      onCreateDeck();
      setShowCreate(false);
      setName('');
      setDescription('');
      onCelebrate?.('Collection créée', { full: true });
      onSelectDeck(deck.id);
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la création');
    } finally {
      setLoading(false);
    }
  }, [name, description, onCreateDeck, onSelectDeck, createDeckFn, onCelebrate]);

  const handleSwipeStart = useCallback((e, deckId) => {
    swipeStartX.current = e.touches ? e.touches[0].clientX : e.clientX;
    setSwipingDeckId(deckId);
    setSwipeOffset(0);
    setIgnoreClickDeckId(null);
  }, []);

  const handleSwipeMove = useCallback(
    (e, deckId) => {
      if (swipingDeckId !== deckId) return;
      swipeCurrentX.current = e.touches ? e.touches[0].clientX : e.clientX;
      const diff = swipeStartX.current - swipeCurrentX.current;
      if (diff > 0) setSwipeOffset(Math.min(diff, 100));
    },
    [swipingDeckId]
  );

  const handleSwipeEnd = useCallback(
    (e, deckId) => {
      if (swipingDeckId === deckId && swipeOffset > 50) {
        const deck = decks.find((d) => d.id === deckId);
        if (deck) {
          setConfirmDeleteDeck(deck);
          setIgnoreClickDeckId(deckId);
        }
      }
      setSwipingDeckId(null);
      setSwipeOffset(0);
    },
    [swipingDeckId, swipeOffset, decks]
  );

  const handleDeleteDeck = useCallback(
    async (deck) => {
      setLoading(true);
      try {
        await deleteDeckFn(deck.id);
        setConfirmDeleteDeck(null);
        onCreateDeck();
      } catch (err) {
        setError(err.response?.data?.error || 'Erreur lors de la suppression');
      } finally {
        setLoading(false);
      }
    },
    [deleteDeckFn, onCreateDeck]
  );

  const totalDue = decks.reduce((acc, d) => acc + (d.due_count ?? 0), 0);
  // Le mode smart révise tout : une collection sans carte due reste révisable,
  // donc le bouton ne se ferme que s'il n'y a aucune carte du tout.
  const totalCards = decks.reduce((acc, d) => acc + (d.card_count ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2.5">
        <button
          type="button"
          onClick={onSessionClick}
          disabled={totalCards === 0}
          className="om-btn om-btn-solid"
        >
          Commencer une session ({totalDue})
        </button>
        <button
          type="button"
          onClick={() => (onDemoBlockRequest ? onDemoBlockRequest() : setShowCreate(!showCreate))}
          className="om-btn om-btn-ghost !text-[var(--om-accent)] !border-[var(--om-accent)]"
        >
          {showCreate ? 'Annuler' : '+ Nouvelle collection'}
        </button>
        <button
          type="button"
          onClick={() => (onDemoBlockRequest ? onDemoBlockRequest() : setShowGenerate(true))}
          className="om-btn om-btn-ghost border-dashed !text-[var(--om-accent)] !border-[var(--om-accent)]"
        >
          ✨ Générer une collection
        </button>
      </div>

      {showCreate && (
        <div className="om-card p-5">
          <input
            type="text"
            placeholder="Nom de la collection"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2.5 rounded-[10px] border border-[var(--om-line)] text-[var(--om-text)] mb-4"
          />
          <textarea
            placeholder="Description (optionnel)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full px-4 py-2.5 rounded-[10px] border border-[var(--om-line)] text-[var(--om-text)] mb-4 resize-none"
          />
          {error && <p className="text-base text-[var(--om-danger)] mb-2.5">{error}</p>}
          <button
            type="button"
            onClick={handleCreate}
            disabled={loading}
            className="px-5 py-2.5 rounded-2xl bg-[var(--om-accent)] text-[var(--om-on-accent)] text-base font-medium hover:bg-[var(--om-accent-hover)] disabled:opacity-60"
          >
            {loading ? 'Création...' : 'Créer'}
          </button>
        </div>
      )}

      {decks.length === 0 && !showCreate && (
        <div className="rounded-2xl border border-dashed border-[var(--om-line)] bg-[var(--om-surface-2)]/50 p-12 text-center">
          <p className="text-[var(--om-muted)] mb-2">Aucune collection.</p>
          <p className="text-base text-[var(--om-muted)] mb-4">
            Crée ta première collection pour commencer à mémoriser efficacement.
          </p>
          <button
            type="button"
            onClick={() => (onDemoBlockRequest ? onDemoBlockRequest() : setShowCreate(true))}
            className="px-5 py-2.5 rounded-2xl bg-[var(--om-accent)] text-[var(--om-on-accent)] text-base font-medium hover:bg-[var(--om-accent-hover)]"
          >
            Créer une collection
          </button>
        </div>
      )}

      {decks.length > 0 && (
        <ul className="space-y-3">
          {decks.map((deck) => {
            const total = deck.card_count ?? 0;
            const dueCount = deck.due_count ?? 0;
            const masteryPercent =
              total > 0 && dueCount !== undefined
                ? Math.round(((total - dueCount) / total) * 100)
                : 0;
            return (
              <li
                key={deck.id}
                className="relative overflow-hidden rounded-2xl"
                style={{ touchAction: 'manipulation' }}
                onTouchStart={(e) => handleSwipeStart(e, deck.id)}
                onTouchMove={(e) => handleSwipeMove(e, deck.id)}
                onTouchEnd={() => handleSwipeEnd(null, deck.id)}
                onMouseDown={(e) => handleSwipeStart(e, deck.id)}
                onMouseMove={(e) => handleSwipeMove(e, deck.id)}
                onMouseUp={() => handleSwipeEnd(null, deck.id)}
                onMouseLeave={() => handleSwipeEnd(null, deck.id)}
              >
                {/* Bouton supprimer derrière - visible au slide */}
                <div
                  className="absolute right-0 top-0 bottom-0 flex items-center justify-center bg-[var(--om-danger)] text-[var(--om-on-accent)] px-6 rounded-r-2xl cursor-pointer z-0 transition-transform duration-300 ease-out"
                  style={{
                    minWidth: '100px',
                    transform: `translateX(${swipingDeckId === deck.id && swipeOffset > 0 ? '0' : '100%'})`,
                    opacity: swipingDeckId === deck.id && swipeOffset > 0 ? 1 : 0,
                    pointerEvents: swipingDeckId === deck.id && swipeOffset > 0 ? 'auto' : 'none',
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setConfirmDeleteDeck(deck);
                    setSwipingDeckId(null);
                    setSwipeOffset(0);
                  }}
                >
                  <span className="text-base font-medium">Supprimer</span>
                </div>
                {/* Carte collection au-dessus */}
                <div
                  className="relative z-10 transition-transform duration-300 ease-out bg-[var(--om-surface)] rounded-2xl cursor-pointer"
                  style={{ transform: `translateX(-${swipingDeckId === deck.id ? swipeOffset : 0}px)` }}
                  onClick={() => {
                    if (ignoreClickDeckId === deck.id) {
                      setIgnoreClickDeckId(null);
                      return;
                    }
                    if (swipingDeckId === deck.id && swipeOffset > 0) return;
                    onSelectDeck(deck.id);
                  }}
                >
                  <div className="w-full text-left rounded-2xl border border-[var(--om-line)] bg-[var(--om-surface)] p-4 shadow-[var(--om-shadow)] hover:border-[var(--om-accent)]/50 hover:bg-[var(--om-accent)]/5 transition-all">
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
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {confirmDeleteDeck && (
        <ConfirmDelete
          isOpen
          onClose={() => setConfirmDeleteDeck(null)}
          onConfirm={() => handleDeleteDeck(confirmDeleteDeck)}
          title="Supprimer la collection ?"
          message="Toutes les cartes et groupes de cette collection seront supprimés. Cette action est irréversible."
        />
      )}

      <GenerateDeckModal
        isOpen={showGenerate}
        onClose={() => setShowGenerate(false)}
        onGenerated={(deckId) => {
          setShowGenerate(false);
          onCreateDeck();
          onSelectDeck(deckId);
        }}
      />
    </div>
  );
}

function DeckDetail({
  deck,
  cards,
  dueCards,
  chapters: initialChapters,
  onBack,
  onRefresh,
  sessionSettings: initialSessionSettings,
  isDemo = false,
  onDemoBlockRequest,
  onCelebrate,
}) {
  const [mode, setMode] = useState('list');
  const [editCard, setEditCard] = useState(null);
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [chapterId, setChapterId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [localCards, setLocalCards] = useState(cards);
  const [localDueCards, setLocalDueCards] = useState(dueCards);
  const [localChapters, setLocalChapters] = useState(initialChapters || []);
  const [showAddChapter, setShowAddChapter] = useState(false);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [loadingChapter, setLoadingChapter] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [swipingCardId, setSwipingCardId] = useState(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [expandedChapters, setExpandedChapters] = useState(new Set());
  const [confirmReviewGroup, setConfirmReviewGroup] = useState(null);
  const [showGenerateCards, setShowGenerateCards] = useState(false);
  const [showSingleCard, setShowSingleCard] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [singleCardChapterId, setSingleCardChapterId] = useState(null);
  const [generationSubject, setGenerationSubject] = useState('');
  const swipeStartX = useRef(0);
  const swipeCurrentX = useRef(0);
  const swipeOffsetRef = useRef(0);

  const fetchCardsFn = isDemo ? fetchDemoCards : fetchCards;
  const fetchDueCardsFn = isDemo ? fetchDemoDueCards : fetchDueCards;
  const fetchChaptersFn = isDemo ? fetchDemoChapters : fetchChapters;
  const createCardFn = isDemo ? createDemoCard : createCard;
  const updateCardFn = isDemo ? updateDemoCard : updateCard;
  const deleteCardFn = isDemo ? deleteDemoCard : deleteCard;
  const createChapterFn = isDemo ? createDemoChapter : createChapter;
  const deleteChapterFn = isDemo ? deleteDemoChapter : deleteChapter;
  const reorderChaptersFn = isDemo ? reorderDemoChapters : reorderChapters;
  const reorderCardsFn = isDemo ? reorderDemoCards : reorderCards;

  const toggleChapterExpand = (chapterId) => {
    setExpandedChapters((prev) => {
      if (prev.has(chapterId)) {
        const next = new Set(prev);
        next.delete(chapterId);
        return next;
      }
      return new Set([chapterId]);
    });
  };

  useEffect(() => {
    setLocalCards(cards);
    setLocalDueCards(dueCards);
    setLocalChapters(initialChapters || []);
  }, [cards, dueCards, initialChapters]);

  // Sujet ayant servi à créer la collection : c'est lui qu'on repropose pour
  // écrire de nouvelles cartes dans la même veine.
  useEffect(() => {
    if (isDemo) return undefined;
    let canceled = false;
    fetchDeckGenerationContext(deck.id).then((ctx) => {
      if (!canceled && ctx?.subject) setGenerationSubject(ctx.subject);
    });
    return () => { canceled = true; };
  }, [deck.id, isDemo]);

  // Identité stable : la fenêtre de génération s'en sert comme dépendance.
  const generationTarget = useMemo(
    () => ({ id: deck.id, name: deck.name }),
    [deck.id, deck.name]
  );

  /** Cartes d'un groupe, dans une liste donnée (cartes ou cartes à réviser). */
  const cardsOfChapter = useCallback(
    (list, chapter) =>
      list.filter((c) => c.chapter_id === chapter.id || c.chapter?.id === chapter.id),
    []
  );

  const refreshCardsAndDue = useCallback(() => {
    fetchCardsFn(deck.id).then(setLocalCards).catch(() => {});
    fetchDueCardsFn(deck.id).then(setLocalDueCards).catch(() => {});
  }, [deck.id, fetchCardsFn, fetchDueCardsFn]);

  const refreshChapters = useCallback(() => {
    fetchChaptersFn(deck.id).then(setLocalChapters).catch(() => {});
  }, [deck.id, fetchChaptersFn]);

  /**
   * Carte écrite à la main dans la fenêtre « + carte ». Les erreurs remontent
   * telles quelles : c'est la fenêtre qui les affiche, au bon endroit.
   */
  const handleCreateSingleCard = useCallback(
    async ({ front: cardFront, back: cardBack, chapterId: targetChapterId }) => {
      await createCardFn(deck.id, {
        front: cardFront,
        back: cardBack,
        chapter_id: targetChapterId ?? undefined,
      });
      refreshCardsAndDue();
      onRefresh?.();
      onCelebrate?.('Carte ajoutée');
    },
    [deck.id, createCardFn, refreshCardsAndDue, onRefresh, onCelebrate]
  );

  const handleUpdateCard = useCallback(
    async (card) => {
      if (!front.trim() || !back.trim()) {
        setError('Recto et verso requis');
        return;
      }
      setLoading(true);
      setError('');
      try {
        await updateCardFn(deck.id, card.id, {
          front,
          back,
          chapter_id: chapterId === '' ? null : chapterId,
        });
        setEditCard(null);
        setFront('');
        setBack('');
        setChapterId('');
        refreshCardsAndDue();
      } catch (err) {
        setError(err.response?.data?.error || 'Erreur');
      } finally {
        setLoading(false);
      }
    },
    [deck.id, front, back, chapterId, refreshCardsAndDue, updateCardFn]
  );

  const handleDeleteCard = useCallback(
    async (card) => {
      setLoading(true);
      try {
        await deleteCardFn(deck.id, card.id);
        setConfirmDelete(null);
        refreshCardsAndDue();
      } catch (err) {
        setError(err.response?.data?.error || 'Erreur');
      } finally {
        setLoading(false);
      }
    },
    [deck.id, refreshCardsAndDue, deleteCardFn]
  );

  const handleImport = useCallback(
    async (pairs, targetDeckId) => {
      const targetId = targetDeckId || deck.id;
      for (const p of pairs) {
        try {
          await createCardFn(targetId, { front: p.front, back: p.back });
        } catch (e) {
          console.error('Erreur import carte:', e);
        }
      }
      setShowImportModal(false);
      refreshCardsAndDue();
      onRefresh?.();
    },
    [deck.id, refreshCardsAndDue, onRefresh, createCardFn]
  );

  const [chapterError, setChapterError] = useState('');

  const handleCreateChapter = useCallback(async () => {
    if (!newChapterTitle.trim()) return;
    setLoadingChapter(true);
    setChapterError('');
    try {
      await createChapterFn(deck.id, newChapterTitle.trim());
      setNewChapterTitle('');
      setShowAddChapter(false);
      const chapters = await fetchChaptersFn(deck.id);
      setLocalChapters(chapters || []);
    } catch (err) {
      console.error('Erreur création groupe:', err);
      setChapterError(err.response?.data?.error || 'Erreur lors de la création du groupe');
    } finally {
      setLoadingChapter(false);
    }
  }, [deck.id, newChapterTitle, createChapterFn, fetchChaptersFn]);

  const handleDeleteChapter = useCallback(
    async (ch) => {
      setConfirmDelete({
        type: 'chapter',
        item: ch,
        onConfirm: async () => {
          setLoadingChapter(true);
          try {
            await deleteChapterFn(deck.id, ch.id);
            refreshChapters();
            refreshCardsAndDue();
          } catch { /* ignore */ }
          finally { setLoadingChapter(false); }
        },
      });
    },
    [deck.id, refreshChapters, refreshCardsAndDue, deleteChapterFn]
  );

  const frontLength = getLengthState(front, FRONT_MAX_CHARS);
  const backLength = getLengthState(back, BACK_MAX_CHARS);

  const startEdit = (card) => {
    setEditCard(card);
    setFront(card.front);
    setBack(card.back);
    setChapterId(card.chapter_id ? String(card.chapter_id) : '');
  };

  const SWIPE_THRESHOLD = 80;

  const handleSwipeStart = useCallback(
    (e, cardId) => {
      swipeStartX.current = e.touches ? e.touches[0].clientX : e.clientX;
      swipeOffsetRef.current = 0;
      setSwipingCardId(cardId);
      setSwipeOffset(0);
    },
    []
  );

  const handleSwipeMove = useCallback(
    (e, cardId) => {
      if (swipingCardId !== cardId) return;
      swipeCurrentX.current = e.touches ? e.touches[0].clientX : e.clientX;
      const diff = swipeStartX.current - swipeCurrentX.current;
      if (diff > 0) {
        const offset = Math.min(diff, SWIPE_THRESHOLD + 40);
        swipeOffsetRef.current = offset;
        setSwipeOffset(offset);
      }
    },
    [swipingCardId]
  );

  const resetSwipe = useCallback(() => {
    setSwipingCardId(null);
    setSwipeOffset(0);
    swipeOffsetRef.current = 0;
  }, []);

  const handleSwipeEnd = useCallback(
    (cardId, card) => {
      const currentOffset = swipeOffsetRef.current;
      if (currentOffset > SWIPE_THRESHOLD && swipingCardId === cardId) {
        resetSwipe();
        setConfirmDelete({
          type: 'card',
          item: card,
          onConfirm: () => handleDeleteCard(card),
        });
      } else {
        resetSwipe();
      }
    },
    [swipingCardId, handleDeleteCard, resetSwipe]
  );

  const handleSwipeEndForChapter = useCallback(
    (chapterIdStr, chapter) => {
      const currentOffset = swipeOffsetRef.current;
      if (currentOffset > SWIPE_THRESHOLD && swipingCardId === chapterIdStr) {
        resetSwipe();
        setConfirmDelete({
          type: 'chapter',
          item: chapter,
          onConfirm: () => handleDeleteChapter(chapter),
        });
      } else {
        resetSwipe();
      }
    },
    [swipingCardId, handleDeleteChapter, resetSwipe]
  );

  const handleRequestDeleteCard = useCallback(
    (card) => {
      resetSwipe();
      setConfirmDelete({
        type: 'card',
        item: card,
        onConfirm: () => handleDeleteCard(card),
      });
    },
    [resetSwipe, handleDeleteCard]
  );

  const startReview = useCallback(
    (settings = {}) => {
      // Le mode smart porte sur toute la collection, tous groupes confondus ;
      // le mode ratio reste cantonné aux cartes dues.
      const sessionCards = buildSession({ due: localDueCards, all: localCards }, settings);
      if (sessionCards.length === 0) return;
      setMode('review');
      setSessionCardsForReview(sessionCards);
    },
    [localDueCards, localCards]
  );

  /**
   * Révision d'un seul groupe : mêmes réglages qu'une session complète
   * (nombre de cartes, part de nouvelles, notation de sa réponse), appliqués
   * aux seules cartes du groupe.
   */
  const startReviewForGroup = useCallback(
    (chapter, settings = {}) => {
      const sessionCards = buildSession(
        {
          due: cardsOfChapter(localDueCards, chapter),
          all: cardsOfChapter(localCards, chapter),
        },
        settings
      );
      if (sessionCards.length === 0) return;
      setMode('review');
      setSessionCardsForReview(sessionCards);
      setSessionSettingsForReview(settings);
      setConfirmReviewGroup(null);
    },
    [localDueCards, localCards, cardsOfChapter]
  );

  const [sessionCardsForReview, setSessionCardsForReview] = useState([]);
  const [sessionSettingsForReview, setSessionSettingsForReview] = useState(null);

  const handleSessionStart = useCallback(
    (settings) => {
      startReview(settings);
      setSessionSettingsForReview(settings);
      setShowSessionModal(false);
    },
    [startReview]
  );

  const hasAutoStarted = useRef(false);
  useEffect(() => {
    if (hasAutoStarted.current || !initialSessionSettings) return;
    const sessionCards = buildSession({ due: dueCards, all: cards }, initialSessionSettings);
    // On ne consomme le drapeau qu'une fois la file réellement construite :
    // sinon un rendu antérieur au chargement des cartes grillerait le démarrage.
    if (sessionCards.length === 0) return;
    hasAutoStarted.current = true;
    setSessionCardsForReview(sessionCards);
    setSessionSettingsForReview(initialSessionSettings);
    setMode('review');
  }, [initialSessionSettings, dueCards, cards]);

  if (mode === 'review' && sessionCardsForReview.length > 0) {
    return (
      <>
        <ReviewFullscreen
          deckId={deck.id}
          cards={sessionCardsForReview}
          onComplete={() => {
            setMode('list');
            const reviewed = sessionCardsForReview.length;
            setSessionCardsForReview([]);
            setSessionSettingsForReview(null);
            refreshCardsAndDue();
            onRefresh?.();
            onCelebrate?.(
              reviewed > 0 ? `Révision terminée · ${reviewed} carte${reviewed > 1 ? 's' : ''}` : 'Révision terminée',
              { full: true }
            );
          }}
          onBack={() => {
            setMode('list');
            setSessionCardsForReview([]);
            setSessionSettingsForReview(null);
            refreshCardsAndDue();
            onRefresh?.();
          }}
          allowWrittenResponse={sessionSettingsForReview?.allowWrittenResponse ?? false}
        />
      </>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onBack}
          className="text-[var(--om-accent)] hover:underline font-medium"
        >
          ← Retour aux collections
        </button>
      </div>

      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-medium text-[var(--om-text)]">
            {deck.name}
          </h2>
          {deck.description && (
            <p className="text-sm text-[var(--om-muted)]">{deck.description}</p>
          )}
        </div>
        {/* Quatre actions : sur un téléphone, elles passent à la ligne plutôt
            que de déborder. */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowSessionModal(true)}
            // Le mode smart révise toute la collection : seule une collection
            // vide interdit de démarrer.
            disabled={localCards.length === 0}
            className="px-4 py-2 rounded-2xl bg-[var(--om-accent)] text-[var(--om-on-accent)] text-sm font-medium hover:bg-[var(--om-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Commencer une session ({localDueCards.length})
          </button>
          {/* Deux gestes distincts, d'où deux boutons : un lot de cartes tiré du
              sujet de la collection, ou UNE carte sur un mot précis. */}
          <button
            type="button"
            onClick={() => {
              if (onDemoBlockRequest) {
                onDemoBlockRequest();
              } else {
                setShowGenerateCards(true);
              }
            }}
            className="px-4 py-2 rounded-2xl border border-[var(--om-accent)] text-[var(--om-accent)] text-sm font-medium hover:bg-[var(--om-accent)]/10"
          >
            + Cartes
          </button>
          <button
            type="button"
            onClick={() => {
              if (onDemoBlockRequest) {
                onDemoBlockRequest();
              } else {
                setSingleCardChapterId(null);
                setShowSingleCard(true);
              }
            }}
            className="px-4 py-2 rounded-2xl border border-[var(--om-accent)] text-[var(--om-accent)] text-sm font-medium hover:bg-[var(--om-accent)]/10"
          >
            + Carte
          </button>
          {/* Compléter ne demande ni sujet ni destination : il part des groupes
              existants et de ce qu'ils contiennent déjà. Sans groupe, rien à
              étoffer — le bouton reste fermé. */}
          <button
            type="button"
            onClick={() => {
              if (onDemoBlockRequest) {
                onDemoBlockRequest();
              } else {
                setShowComplete(true);
              }
            }}
            disabled={localChapters.length === 0}
            className="px-4 py-2 rounded-2xl border border-[var(--om-accent)] text-[var(--om-accent)] text-sm font-medium hover:bg-[var(--om-accent)]/10 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
            title={
              localChapters.length === 0
                ? 'Créez d’abord un groupe de cartes'
                : 'Étoffer les groupes existants avec l’IA'
            }
          >
            <i className="ph ph-sparkle text-base" aria-hidden />
            Compléter
          </button>
          <button
            type="button"
            onClick={() => {
              if (onDemoBlockRequest) {
                onDemoBlockRequest();
              } else {
                setShowAddChapter(!showAddChapter);
              }
            }}
            className="px-4 py-2 rounded-2xl border border-[var(--om-accent)] text-[var(--om-accent)] text-sm font-medium hover:bg-[var(--om-accent)]/10"
          >
            + Groupe de cartes
          </button>
        </div>
      </div>

      {showAddChapter && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="om-scrim" onClick={() => { setShowAddChapter(false); setChapterError(''); setNewChapterTitle(''); }} />
          <div className="relative z-10 om-card shadow-[var(--om-shadow-lg)] p-6 w-full max-w-sm">
            <h3 className="font-medium text-[var(--om-text)] mb-3">Nouveau groupe</h3>
            {chapterError && <p className="text-sm text-[var(--om-danger)] mb-2">{chapterError}</p>}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Titre du groupe"
                value={newChapterTitle}
                onChange={(e) => { setNewChapterTitle(e.target.value); setChapterError(''); }}
                className="flex-1 px-3 py-2 rounded-[10px] border border-[var(--om-line)] text-sm text-[var(--om-text)]"
              />
              <button
                type="button"
                onClick={handleCreateChapter}
                disabled={loadingChapter || !newChapterTitle.trim()}
                className="px-4 py-2 rounded-2xl bg-[var(--om-accent)] text-[var(--om-on-accent)] text-sm font-medium disabled:opacity-60"
              >
                {loadingChapter ? 'Création…' : 'Créer'}
              </button>
            </div>
            <button
              type="button"
              onClick={() => { setShowAddChapter(false); setChapterError(''); setNewChapterTitle(''); }}
              className="mt-4 w-full py-2 rounded-2xl border border-[var(--om-line)] text-[var(--om-muted)] text-sm font-medium hover:bg-[var(--om-surface-2)]"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {localChapters.length > 0 && (
        <>
          <h3 className="font-medium text-[var(--om-text)] mt-4 mb-2">Groupes</h3>
          <div className="space-y-2">
            {localChapters.map((ch) => {
              const groupCards = localCards.filter((c) => c.chapter_id === ch.id || c.chapter?.id === ch.id);
              const groupDueCount = localDueCards.filter((c) => c.chapter_id === ch.id || c.chapter?.id === ch.id).length;
              const isExpanded = expandedChapters.has(ch.id);
              const chapterSwipeId = `chapter-${ch.id}`;
              return (
                <div
                  key={ch.id}
                  className="relative overflow-hidden rounded-2xl"
                  onTouchStart={(e) => handleSwipeStart(e, chapterSwipeId)}
                  onTouchMove={(e) => handleSwipeMove(e, chapterSwipeId)}
                  onTouchEnd={() => handleSwipeEndForChapter(chapterSwipeId, ch)}
                  onMouseDown={(e) => handleSwipeStart(e, chapterSwipeId)}
                  onMouseMove={(e) => handleSwipeMove(e, chapterSwipeId)}
                  onMouseUp={() => handleSwipeEndForChapter(chapterSwipeId, ch)}
                  onMouseLeave={() => handleSwipeEndForChapter(chapterSwipeId, ch)}
                >
                  {/* Bouton supprimer derrière - visible au slide */}
                  <div
                    className="absolute right-0 top-0 bottom-0 flex items-center justify-center bg-[var(--om-danger)] text-[var(--om-on-accent)] px-6 rounded-r-2xl cursor-pointer z-0 transition-transform duration-300 ease-out"
                    style={{
                      minWidth: '100px',
                      transform: `translateX(${swipingCardId === chapterSwipeId && swipeOffset > 0 ? '0' : '100%'})`,
                      opacity: swipingCardId === chapterSwipeId && swipeOffset > 0 ? 1 : 0,
                      pointerEvents: swipingCardId === chapterSwipeId && swipeOffset > 0 ? 'auto' : 'none',
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      resetSwipe();
                      setConfirmDelete({ type: 'chapter', item: ch, onConfirm: () => handleDeleteChapter(ch) });
                    }}
                  >
                    <span className="text-sm font-medium">Supprimer</span>
                  </div>
                  <div
                    className={`relative z-10 om-card transition-transform duration-200 ease-out ${isExpanded ? '' : 'cursor-pointer hover:border-[var(--om-accent)]/50 hover:bg-[var(--om-accent)]/5'}`}
                    style={{ transform: `translateX(-${swipingCardId === chapterSwipeId ? swipeOffset : 0}px)` }}
                  >
                    <div
                      className="flex items-center gap-2 p-4"
                      onClick={() => {
                        if (swipingCardId === chapterSwipeId && swipeOffset > 0) {
                          resetSwipe();
                        } else {
                          setConfirmReviewGroup(ch);
                        }
                      }}
                    >
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setConfirmReviewGroup(ch); }}
                        className="flex-1 min-w-0 text-left"
                      >
                        <p className="font-medium text-[var(--om-text)] truncate hover:text-[var(--om-accent)]">
                          {ch.title}
                        </p>
                        <p className="text-sm text-[var(--om-muted)] truncate mt-0.5">
                          {groupCards.length} carte{groupCards.length !== 1 ? 's' : ''}
                          {groupDueCount > 0 && (
                            <span className="text-[var(--om-accent)]"> · {groupDueCount} à réviser</span>
                          )}
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); toggleChapterExpand(ch.id); }}
                        className="p-2 rounded-[10px] text-[var(--om-muted)] hover:text-[var(--om-accent)] hover:bg-[var(--om-accent)]/10 flex-shrink-0"
                        aria-label={isExpanded ? 'Réduire' : 'Déplier'}
                      >
                        <svg
                          className={`w-5 h-5 transition-transform duration-300 ease-in-out ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                    <div
                      className="grid transition-all duration-300 ease-in-out"
                      style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}
                    >
                      <div className="min-h-0 overflow-hidden">
                        <div className="border-t border-[var(--om-line)] px-4 pb-4 pt-3 space-y-2 bg-[var(--om-surface-2)]/30">
                      {groupCards.map((card) => (
                        <div
                          key={card.id}
                          className="relative overflow-hidden rounded-2xl"
                          onTouchStart={(e) => { e.stopPropagation(); handleSwipeStart(e, card.id); }}
                          onTouchMove={(e) => { e.stopPropagation(); handleSwipeMove(e, card.id); }}
                          onTouchEnd={(e) => { e.stopPropagation(); handleSwipeEnd(card.id, card); }}
                          onMouseDown={(e) => { e.stopPropagation(); handleSwipeStart(e, card.id); }}
                          onMouseMove={(e) => { e.stopPropagation(); handleSwipeMove(e, card.id); }}
                          onMouseUp={(e) => { e.stopPropagation(); handleSwipeEnd(card.id, card); }}
                          onMouseLeave={(e) => { e.stopPropagation(); handleSwipeEnd(card.id, card); }}
                        >
                          <div
                            className="absolute right-0 top-0 bottom-0 flex items-center justify-center bg-[var(--om-danger)] text-[var(--om-on-accent)] px-4 rounded-r-2xl cursor-pointer z-0 text-sm font-medium"
                            style={{
                              minWidth: '80px',
                              transform: `translateX(${swipingCardId === card.id && swipeOffset > 0 ? '0' : '100%'})`,
                              opacity: swipingCardId === card.id && swipeOffset > 0 ? 1 : 0,
                              pointerEvents: swipingCardId === card.id && swipeOffset > 0 ? 'auto' : 'none',
                            }}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              resetSwipe();
                              setConfirmDelete({ type: 'card', item: card, onConfirm: () => handleDeleteCard(card) });
                            }}
                          >
                            Supprimer
                          </div>
                          <div
                            className="relative z-10 flex items-center rounded-2xl border border-[var(--om-line)] bg-[var(--om-surface)] p-3 shadow-[var(--om-shadow)] transition-transform duration-200 cursor-pointer hover:border-[var(--om-accent)]/50"
                            style={{ transform: `translateX(-${swipingCardId === card.id ? swipeOffset : 0}px)` }}
                            onClick={() => {
                              if (swipingCardId === card.id && swipeOffset > 0) resetSwipe();
                              else startEdit(card);
                            }}
                          >
                            <div className="min-w-0 flex-1 text-left">
                              <div className="flex items-start gap-2">
                                <p className="font-medium text-[var(--om-text)] truncate flex-1">{card.front}</p>
                                {isNewCard(card) && <NewCardDot className="mt-1.5" />}
                              </div>
                              <p className="text-sm text-[var(--om-muted)] truncate mt-0.5">{card.back}</p>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); startEdit(card); }}
                              className="p-2 rounded-[10px] text-[var(--om-muted)] hover:text-[var(--om-accent)] hover:bg-[var(--om-accent)]/10 flex-shrink-0 ml-2"
                              aria-label="Modifier"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                      <button
                        type="button"
                        onMouseDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onDemoBlockRequest) {
                            onDemoBlockRequest();
                          } else {
                            // Même fenêtre que « + carte », le groupe en moins à
                            // choisir : on est déjà dedans.
                            setSingleCardChapterId(String(ch.id));
                            setShowSingleCard(true);
                          }
                        }}
                        className="w-full py-3 rounded-2xl border border-dashed border-[var(--om-line)] text-sm text-[var(--om-muted)] hover:border-[var(--om-accent)] hover:bg-[var(--om-accent)]/5 hover:text-[var(--om-accent)] transition-colors"
                      >
                        + Créer une carte
                      </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {confirmReviewGroup && (
        <SessionSettingsModal
          isOpen
          title={`Réviser « ${confirmReviewGroup.title} »`}
          onClose={() => setConfirmReviewGroup(null)}
          onStart={(settings) => startReviewForGroup(confirmReviewGroup, settings)}
          dueCount={cardsOfChapter(localDueCards, confirmReviewGroup).length}
          totalCount={cardsOfChapter(localCards, confirmReviewGroup).length}
        />
      )}

      {/* Modification d'une carte existante ; la création passe par « + carte ». */}
      {editCard && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div
            className="om-scrim"
            onClick={() => {
              setEditCard(null);
              setFront('');
              setBack('');
              setChapterId('');
              setError('');
            }}
          />
          <div className="relative z-10 om-card shadow-[var(--om-shadow-lg)] p-6 w-full max-w-sm">
            <h3 className="font-medium text-[var(--om-text)] mb-3">Modifier la carte</h3>
            <input
              type="text"
              placeholder="Recto (question)"
              value={front}
              onChange={(e) => setFront(e.target.value)}
              aria-describedby="front-counter"
              className={`w-full px-3 py-2 rounded-[10px] border text-[var(--om-text)] mb-1 ${
                frontLength.over ? 'border-[var(--om-danger)]' : 'border-[var(--om-line)]'
              }`}
            />
            <CharCounter id="front-counter" state={frontLength} />
            <textarea
              placeholder="Verso (réponse)"
              value={back}
              onChange={(e) => setBack(e.target.value)}
              rows={3}
              aria-describedby="back-counter"
              className={`w-full px-3 py-2 rounded-[10px] border text-[var(--om-text)] mb-1 resize-none ${
                backLength.over ? 'border-[var(--om-danger)]' : 'border-[var(--om-line)]'
              }`}
            />
            <CharCounter id="back-counter" state={backLength} />
            <label className="block text-sm font-medium text-[var(--om-muted)] mb-1">
              Groupe (optionnel)
            </label>
            <select
              value={chapterId}
              onChange={(e) => setChapterId(e.target.value)}
              className="w-full px-3 py-2 rounded-[10px] border border-[var(--om-line)] text-[var(--om-text)] mb-3 bg-[var(--om-surface)]"
            >
              <option value="">— Aucun —</option>
              {localChapters.map((ch) => (
                <option key={ch.id} value={String(ch.id)}>
                  {ch.title}
                </option>
              ))}
            </select>
            {error && <p className="text-sm text-[var(--om-danger)] mb-2">{error}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleUpdateCard(editCard)}
                disabled={loading}
                className="px-4 py-2 rounded-2xl bg-[var(--om-accent)] text-[var(--om-on-accent)] text-sm font-medium hover:bg-[var(--om-accent-hover)] disabled:opacity-60"
              >
                {loading ? '...' : 'Enregistrer'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditCard(null);
                  setFront('');
                  setBack('');
                  setChapterId('');
                  setError('');
                }}
                className="px-4 py-2 rounded-2xl border border-[var(--om-line)] text-[var(--om-muted)] text-sm font-medium hover:bg-[var(--om-surface-2)]"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {localChapters.length > 0 && localCards.some((c) => !c.chapter_id && !c.chapter?.id) && (
          <h3 className="font-medium text-[var(--om-text)] mt-4 mb-2">Cartes sans groupe</h3>
        )}
        {localCards
          .filter((card) => !card.chapter_id && !card.chapter?.id)
          .map((card) => (
          <div
            key={card.id}
            className="relative overflow-hidden rounded-2xl"
            onTouchStart={(e) => handleSwipeStart(e, card.id)}
            onTouchMove={(e) => handleSwipeMove(e, card.id)}
            onTouchEnd={() => handleSwipeEnd(card.id, card)}
            onMouseDown={(e) => handleSwipeStart(e, card.id)}
            onMouseMove={(e) => handleSwipeMove(e, card.id)}
            onMouseUp={() => handleSwipeEnd(card.id, card)}
            onMouseLeave={() => handleSwipeEnd(card.id, card)}
          >
            <div
              className="absolute right-0 top-0 bottom-0 flex items-center justify-center bg-[var(--om-danger)] text-[var(--om-on-accent)] px-6 rounded-r-2xl cursor-pointer z-0 transition-transform duration-300 ease-out"
              style={{
                minWidth: '100px',
                transform: `translateX(${swipingCardId === card.id && swipeOffset > 0 ? '0' : '100%'})`,
                opacity: swipingCardId === card.id && swipeOffset > 0 ? 1 : 0,
                pointerEvents: swipingCardId === card.id && swipeOffset > 0 ? 'auto' : 'none',
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                resetSwipe();
                setConfirmDelete({ type: 'card', item: card, onConfirm: () => handleDeleteCard(card) });
              }}
            >
              <span className="text-base font-medium">Supprimer</span>
            </div>
            <div
              className="relative z-10 flex items-center rounded-2xl border border-[var(--om-line)] bg-[var(--om-surface)] p-4 shadow-[var(--om-shadow)] transition-transform duration-200 ease-out cursor-pointer hover:border-[var(--om-accent)]/50 hover:bg-[var(--om-accent)]/5"
              style={{ transform: `translateX(-${swipingCardId === card.id ? swipeOffset : 0}px)` }}
              onClick={() => {
                if (swipingCardId === card.id && swipeOffset > 0) {
                  resetSwipe();
                } else {
                  startEdit(card);
                }
              }}
            >
              <div className="min-w-0 flex-1 text-left">
                <div className="flex items-start gap-2">
                  <p className="font-medium text-[var(--om-text)] truncate flex-1">
                    {card.front}
                  </p>
                  {isNewCard(card) && <NewCardDot className="mt-1.5" />}
                </div>
                <p className="text-sm text-[var(--om-muted)] truncate mt-0.5">
                  {card.back}
                </p>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); startEdit(card); }}
                className="p-2 rounded-[10px] text-[var(--om-muted)] hover:text-[var(--om-accent)] hover:bg-[var(--om-accent)]/10 flex-shrink-0 ml-3"
                aria-label="Modifier"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            </div>
          </div>
        ))}
        {localChapters.length === 0 && localCards.length === 0 && (
          <p className="text-sm text-[var(--om-muted)] py-4 text-center">
            Aucune carte. Crée un groupe ou ajoute une carte.
          </p>
        )}
      </div>

      <SessionSettingsModal
        isOpen={showSessionModal}
        onClose={() => setShowSessionModal(false)}
        onStart={handleSessionStart}
        dueCount={localDueCards.length}
        totalCount={localCards.length}
      />

      <GenerateDeckModal
        isOpen={showGenerateCards}
        onClose={() => setShowGenerateCards(false)}
        targetDeck={generationTarget}
        defaultSubject={generationSubject}
        chapters={localChapters}
        onGenerated={() => {
          setShowGenerateCards(false);
          refreshCardsAndDue();
          refreshChapters();
          onRefresh?.();
        }}
      />

      {showSingleCard && (
        <GenerateCardModal
          isOpen
          onClose={() => setShowSingleCard(false)}
          deck={generationTarget}
          chapters={localChapters}
          defaultChapterId={singleCardChapterId}
          onCreateManual={handleCreateSingleCard}
          onPublished={(count) => {
            refreshCardsAndDue();
            onRefresh?.();
            onCelebrate?.(count > 1 ? `${count} cartes ajoutées` : 'Carte ajoutée');
          }}
        />
      )}

      {showComplete && (
        <CompleteDeckModal
          isOpen
          onClose={() => setShowComplete(false)}
          deck={generationTarget}
          chapters={localChapters}
          onCompleted={() => {
            setShowComplete(false);
            refreshCardsAndDue();
            refreshChapters();
            onRefresh?.();
            onCelebrate?.('Collection complétée');
          }}
        />
      )}

      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={(pairs) => handleImport(pairs, deck.id)}
        deckName={deck.name}
      />

      {confirmDelete && (
        <ConfirmDelete
          isOpen
          onClose={() => setConfirmDelete(null)}
          onConfirm={confirmDelete.onConfirm}
          title={
            confirmDelete.type === 'card'
              ? 'Supprimer cette carte ?'
              : `Supprimer le chapitre « ${confirmDelete.item?.title} » ?`
          }
          message={
            confirmDelete.type === 'chapter'
              ? 'Les cartes ne seront pas supprimées.'
              : 'Cette action est irréversible.'
          }
        />
      )}
    </div>
  );
}

function CarteMentale() {
  const navigate = useNavigate();
  const { deckId } = useParams();
  const location = useLocation();
  const loaderData = useLoaderData();
  const { decks = [], deck, cards = [], dueCards = [] } = loaderData;
  const sessionSettings = location.state?.sessionSettings;
  const isDemo = useDemoMode();
  const basePath = useDemoBasePath();

  const [localDecks, setLocalDecks] = useState(decks);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [showDemoBlockModal, setShowDemoBlockModal] = useState(false);

  const fetchDecksFn = isDemo ? fetchDemoDecks : fetchDecks;

  const handleRefresh = useCallback(async () => {
    try {
      const decksData = await fetchDecksFn();
      setLocalDecks(Array.isArray(decksData) ? decksData : (decksData?.decks ?? []));
    } catch {
      // ignore
    }
  }, [fetchDecksFn]);

  const handleSelectDeck = (deckIdParam) => {
    navigate(`${basePath}/productivite/carte-mentale/${deckIdParam}`);
  };

  const handleBack = () => {
    navigate(`${basePath}/productivite/carte-mentale`);
  };

  const handleSessionClick = useCallback(() => {
    setShowSessionModal(true);
  }, []);

  const handleSessionStartFromList = useCallback(
    (settings) => {
      // En smart, une collection sans carte due reste révisable : on vise la
      // première qui contient des cartes plutôt que la première qui en doit.
      const target =
        settings?.mode === 'smart'
          ? localDecks.find((d) => (d.card_count ?? 0) > 0)
          : localDecks.find((d) => (d.due_count ?? 0) > 0);
      if (target) {
        navigate(`${basePath}/productivite/carte-mentale/${target.id}`, {
          state: { sessionSettings: settings },
        });
      }
      setShowSessionModal(false);
    },
    [localDecks, navigate, basePath]
  );

  const totalDue = localDecks.reduce((acc, d) => acc + (d.due_count ?? 0), 0);
  const { celebration, celebrate } = useCelebration();

  return (
    <div className="px-4 md:px-6 lg:px-8 pt-1 pb-6 max-w-4xl mx-auto relative">
      <Celebration celebration={celebration} anchor="screen" />
      <CelebrationLive celebration={celebration} />
      {deckId && (
        <div className="flex items-center gap-2 mb-4">
          <button
            type="button"
            onClick={() => navigate(basePath)}
            className="text-[var(--om-muted)] hover:text-[var(--om-accent)] text-base"
          >
            ← Retour
          </button>
        </div>
      )}

      <header className="mb-3.5 flex flex-col">
        <h1 className="text-[17px] md:text-[19px] font-medium tracking-[-0.01em] text-[var(--om-text)]">
          FlashCards
        </h1>
        <p className="text-xs text-[var(--om-muted)] max-w-xl">
          Répétition espacée (SM-2+). Crée des collections, importe du texte, révise au clavier (1-4).
        </p>
      </header>

      {deckId && !deck ? (
        <div className="om-card text-center py-12">
          <p className="text-[var(--om-muted)] mb-4">Collection introuvable.</p>
          <button
            type="button"
            onClick={handleBack}
            className="om-btn om-btn-solid"
          >
            Retour aux collections
          </button>
        </div>
      ) : deckId && deck ? (
        <DeckDetail
          deck={deck}
          cards={cards}
          dueCards={dueCards}
          chapters={loaderData.chapters}
          onBack={handleBack}
          onRefresh={handleRefresh}
          sessionSettings={sessionSettings}
          isDemo={isDemo}
          onDemoBlockRequest={isDemo ? () => setShowDemoBlockModal(true) : undefined}
          onCelebrate={celebrate}
        />
      ) : (
        <>
          <section className="mb-6">
            <h2 className="om-kicker mb-3">Collections</h2>
            <DeckList
              decks={localDecks}
              onCreateDeck={handleRefresh}
              onSelectDeck={handleSelectDeck}
              onSessionClick={handleSessionClick}
              onDemoBlockRequest={isDemo ? () => setShowDemoBlockModal(true) : undefined}
              onCelebrate={celebrate}
              isDemo={isDemo}
            />
          </section>

          {showSessionModal && (
            <SessionSettingsModal
              isOpen
              onClose={() => setShowSessionModal(false)}
              onStart={handleSessionStartFromList}
              dueCount={totalDue}
              totalCount={localDecks.reduce((a, d) => a + (d.card_count ?? 0), 0)}
            />
          )}
        </>
      )}
      <DemoBlockModal isOpen={showDemoBlockModal} onClose={() => setShowDemoBlockModal(false)} />
    </div>
  );
}

export default CarteMentale;
