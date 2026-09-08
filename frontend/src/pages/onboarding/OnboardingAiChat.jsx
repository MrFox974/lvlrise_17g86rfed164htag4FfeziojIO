import { useState, useEffect, useCallback, useRef } from 'react';

import { useNavigate } from 'react-router-dom';
import {
  getAiSession,
  postAiStep,
  postAiComplete,
} from '../../utils/onboardingApi';
/**
 * Bouton + ou − avec maintien du doigt → répétition avec accélération progressive.
 * Délai initial ~400ms puis répétition qui s'accélère (120ms → 40ms).
 * @param canRunRef - Ref vers () => boolean ou (key) => boolean. Si canRunArg fourni, appelle avec.
 */
function HoldRepeatButton({
  direction,
  onClick,
  disabled,
  canRunRef,
  canRunArg,
  className,
}) {
  const timeoutRef = useRef(null);
  const cancelledRef = useRef(false);

  const clear = useCallback(() => {
    cancelledRef.current = true;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    const canRun = canRunRef?.current
      ? (typeof canRunRef.current === 'function' && canRunArg !== undefined
        ? canRunRef.current(canRunArg)
        : canRunRef.current())
      : true;
    if (disabled || !canRun) return;
    cancelledRef.current = false;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    onClick();

    const INITIAL_DELAY = 400;
    const MIN_INTERVAL = 40;
    const MAX_INTERVAL = 120;

    const scheduleNext = (interval) => {
      if (cancelledRef.current) return;
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        if (cancelledRef.current) return;
        const ok = canRunRef?.current
          ? (canRunArg !== undefined ? canRunRef.current(canRunArg) : canRunRef.current())
          : true;
        if (!ok) return;
        onClick();
        scheduleNext(Math.max(MIN_INTERVAL, interval - 5));
      }, interval);
    };

    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      if (cancelledRef.current) return;
      scheduleNext(MAX_INTERVAL);
    }, INITIAL_DELAY);
  }, [onClick, disabled, canRunRef, canRunArg]);

  useEffect(() => () => clear(), [clear]);

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onMouseDown={(e) => { e.preventDefault(); start(); }}
      onMouseUp={clear}
      onMouseLeave={clear}
      onTouchStart={(e) => { e.preventDefault(); start(); }}
      onTouchEnd={clear}
      onTouchCancel={clear}
      onContextMenu={(e) => e.preventDefault()}
      disabled={disabled}
      className={`select-none touch-manipulation ${className}`}
    >
      {direction === 'plus' ? '+' : '−'}
    </button>
  );
}

/**
 * Interface de discussion avec l'assistant IA : fluide et animée.
 */
function OnboardingAiChat({ onBack }) {
  const [messages, setMessages] = useState([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [stepKey, setStepKey] = useState('intro');
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [showLoader, setShowLoader] = useState(false);
  const messagesEndRef = useRef(null);
  const navigate = useNavigate();

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const loadSession = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAiSession();
      setStepIndex(data.stepIndex);
      setStepKey(data.stepKey);

      if (data.stepIndex === 0 && data.message) {
        setMessages([{ role: 'assistant', content: data.message }]);
      } else {
        const hist = [];
        if (data.message) {
          hist.push({ role: 'assistant', content: data.message });
        }
        setMessages(hist);
      }
    } catch (err) {
      console.error('getAiSession:', err);
      setError(err.response?.data?.error || 'Erreur de chargement.');
      setMessages([{ role: 'assistant', content: "Bonjour ! Je vais vous aider à configurer votre espace. Pour commencer, dites-moi ce qui vous motive dans la vie ?" }]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const handleSend = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || submitting) return;

    setSubmitting(true);
    setError(null);
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setInputValue('');

    try {
      const data = await postAiStep(text);
      setStepIndex(data.stepIndex);
      setStepKey(data.stepKey);

      if (data.message) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.message }]);
      }
    } catch (err) {
      const msg = err.response?.data?.error || 'Erreur lors de l\'envoi.';
      setError(msg);
      setMessages((prev) => [...prev, { role: 'assistant', content: msg }]);
    } finally {
      setSubmitting(false);
    }
  }, [inputValue, submitting]);

  const handleFinalAnswer = useCallback(async () => {
    const text = inputValue.trim();
    setSubmitting(true);
    setError(null);
    if (text) {
      setMessages((prev) => [...prev, { role: 'user', content: text }]);
      setInputValue('');
    }

    try {
      await postAiComplete(text);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Nous avons terminé ! Nous paramétrons actuellement votre espace afin de le personnaliser au maximum.' },
      ]);
      setShowLoader(true);
      await new Promise((r) => setTimeout(r, 3000));
      navigate('/home', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur');
    } finally {
      setSubmitting(false);
    }
  }, [inputValue, navigate]);

  const isFinalStep = stepKey === 'autre_chose';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--om-bg)]">
        <div className="animate-spin rounded-full h-12 w-12 border border-[var(--om-accent)] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--om-bg)]">
      <div className="onboarding-canvas absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
        <div className="onboarding-bg-gradient" />
        <div className="onboarding-gradient" />
        <div className="onboarding-orb onboarding-orb-1" />
        <div className="onboarding-orb onboarding-orb-2" />
        <div className="onboarding-orb onboarding-orb-3" />
      </div>

      <div className="relative flex-1 flex flex-col max-h-screen">
        <div className="flex-shrink-0 px-4 py-3 border-b border-[var(--om-line)] bg-[var(--om-surface)]/80 backdrop-blur-sm">
          <button
            type="button"
            onClick={onBack}
            className="text-[var(--om-muted)] hover:text-[var(--om-accent)] text-sm font-medium"
          >
            Retour
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 py-6">
          <div className="max-w-2xl mx-auto space-y-4 pb-8">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                    m.role === 'user'
                      ? m.isReadOnly
                        ? 'bg-[var(--om-surface-2)] border border-[var(--om-line)] text-[var(--om-text)]'
                        : 'bg-[var(--om-accent)] text-[var(--om-on-accent)]'
                      : 'bg-[var(--om-surface)]/90 backdrop-blur-sm border border-[var(--om-line)] text-[var(--om-text)]'
                  }`}
                >
                  <p className="whitespace-pre-wrap text-sm md:text-base">{m.content}</p>
                </div>
              </div>
            ))}

            {error && (
              <p className="text-sm text-[var(--om-danger)] text-center">{error}</p>
            )}

            {showLoader && (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border border-[var(--om-accent)] border-t-transparent" />
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {!showLoader && (
          <div className="flex-shrink-0 px-4 py-4 border-t border-[var(--om-line)] bg-[var(--om-surface)]/80 backdrop-blur-sm">
            <div className="max-w-2xl mx-auto flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (isFinalStep) handleFinalAnswer();
                    else handleSend();
                  }
                }}
                placeholder={isFinalStep ? 'Votre réponse (optionnel)' : 'Votre réponse...'}
                className="flex-1 px-4 py-3 rounded-2xl border border-[var(--om-line)] focus:border-[var(--om-accent)] focus:outline-none"
                disabled={submitting}
              />
              <button
                type="button"
                onClick={isFinalStep ? handleFinalAnswer : handleSend}
                disabled={(!inputValue.trim() && !isFinalStep) || submitting}
                className="px-5 py-3 rounded-2xl bg-[var(--om-accent)] text-[var(--om-on-accent)] font-medium hover:bg-[var(--om-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isFinalStep ? 'Terminer' : 'Envoyer'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default OnboardingAiChat;
