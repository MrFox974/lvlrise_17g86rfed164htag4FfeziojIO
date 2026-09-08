import { useState, useCallback, useRef, useEffect } from 'react';
import { reviewCard } from '../utils/flashcardApi';
import { reviewDemoCard } from '../utils/demoApi';
import { useDemoMode } from './useDemoMode';

const QUALITY_LABELS = { 1: 'Encore', 2: 'Difficile', 3: 'Bien', 4: 'Facile' };
const DELAY_SLIDE_OUT = 400;
const DELAY_BEFORE_NEXT = 750;
const MAX_HISTORY = 5;

/**
 * Hook pour gérer une session de révision
 * @param {Object} options - { deckId, cards, onComplete, onBack, allowWrittenResponse? }
 */
export function useReviewSession({ deckId, cards, onComplete, onBack, allowWrittenResponse = false }) {
  const isDemo = useDemoMode();
  const reviewCardFn = isDemo ? reviewDemoCard : reviewCard;
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(false);
  const [writtenResponse, setWrittenResponse] = useState('');
  const [stats, setStats] = useState({ seen: 0, again: 0, success: 0 });
  const [lastReason, setLastReason] = useState(null);
  const [lastQuality, setLastQuality] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionPhase, setTransitionPhase] = useState('idle');
  const [historyIndex, setHistoryIndex] = useState(null);
  const [history, setHistory] = useState([]);
  const revealAtRef = useRef(null);

  const card = historyIndex !== null ? history[historyIndex]?.card : cards[index];
  const isLast = index >= cards.length - 1;
  const remaining = Math.max(0, cards.length - index);

  const handleReveal = useCallback(() => {
    if (!flipped) {
      revealAtRef.current = Date.now();
      setFlipped(true);
    }
  }, [flipped]);

  const handleQuality = useCallback(
    async (quality) => {
      if (!card || loading || historyIndex !== null) return;

      setLoading(true);
      const responseTimeSec = revealAtRef.current
        ? Math.round((Date.now() - revealAtRef.current) / 1000)
        : null;

      try {
        const data = await reviewCardFn(deckId, card.id, quality, responseTimeSec);

        const reason = data?.reason || '';
        setLastReason(reason);
        setLastQuality(quality);

        setStats((s) => ({
          seen: s.seen + 1,
          again: s.again + (quality === 1 ? 1 : 0),
          success: s.success + (quality > 1 ? 1 : 0),
        }));

        const newHistoryEntry = {
          card,
          quality,
          reason,
          writtenResponse: allowWrittenResponse ? writtenResponse : null,
        };
        setHistory((h) => [...h.slice(-(MAX_HISTORY - 1)), newHistoryEntry]);

        setIsTransitioning(true);
        setTransitionPhase('exiting');
        setTimeout(() => {
          if (isLast) {
            setLoading(false);
            setLastReason(null);
            setLastQuality(null);
            setIsTransitioning(false);
            setTransitionPhase('idle');
            onComplete?.();
          } else {
            setIndex((i) => i + 1);
            setFlipped(false);
            setWrittenResponse('');
            revealAtRef.current = null;
            setTransitionPhase('entering');
          }
        }, DELAY_SLIDE_OUT);
        setTimeout(() => {
          setLoading(false);
          setLastReason(null);
          setLastQuality(null);
          setIsTransitioning(false);
          setTransitionPhase('idle');
        }, DELAY_BEFORE_NEXT);
      } catch (err) {
        console.error('Erreur review:', err);
        setLoading(false);
      }
    },
    [deckId, card, loading, isLast, onComplete, writtenResponse, allowWrittenResponse, historyIndex, reviewCardFn]
  );

  const goBack = useCallback(() => {
    if (history.length === 0) return;
    const prev = historyIndex === null ? history.length - 1 : historyIndex - 1;
    if (prev >= 0) {
      setHistoryIndex(prev);
    }
  }, [history, historyIndex]);

  const goForward = useCallback(() => {
    if (historyIndex === null) return;
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
    } else {
      setHistoryIndex(null);
    }
  }, [history, historyIndex]);

  useEffect(() => {
    const onKey = (e) => {
      if (historyIndex !== null) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          goBack();
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          goForward();
        }
        return;
      }
      if (!flipped || loading) return;
      if (e.key >= '1' && e.key <= '4') {
        e.preventDefault();
        handleQuality(parseInt(e.key, 10));
      }
      if (e.key === ' ') {
        e.preventDefault();
        if (!flipped) handleReveal();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flipped, loading, handleQuality, handleReveal, historyIndex, goBack, goForward]);

  return {
    index,
    card,
    flipped,
    loading,
    writtenResponse,
    setWrittenResponse,
    stats,
    total: cards.length,
    remaining,
    handleReveal,
    handleQuality,
    QUALITY_LABELS,
    allowWrittenResponse,
    lastReason,
    lastQuality,
    isTransitioning,
    transitionPhase,
    history,
    historyIndex,
    goBack,
    goForward,
    canGoBack: history.length > 0 && (historyIndex === null ? true : historyIndex > 0),
    canGoForward: historyIndex !== null,
  };
}
