import { useState, useEffect, useCallback, useRef } from 'react';

import { useNavigate } from 'react-router-dom';
import {
  getAiSession,
  postAiStep,
  postAiGauges,
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
 * Composant de saisie des temps par jour de la semaine.
 */
function OnboardingTimeInput({ onValidated }) {
  const [times, setTimes] = useState({
    lundi: '',
    mardi: '',
    mercredi: '',
    jeudi: '',
    vendredi: '',
    samedi: '',
    dimanche: '',
  });

  const handleChange = useCallback((day, value) => {
    setTimes((prev) => ({ ...prev, [day]: value }));
  }, []);

  const handleValidate = useCallback(async () => {
    await onValidated(times);
  }, [times, onValidated]);

  const days = [
    { key: 'lundi', label: 'Lundi' },
    { key: 'mardi', label: 'Mardi' },
    { key: 'mercredi', label: 'Mercredi' },
    { key: 'jeudi', label: 'Jeudi' },
    { key: 'vendredi', label: 'Vendredi' },
    { key: 'samedi', label: 'Samedi' },
    { key: 'dimanche', label: 'Dimanche' },
  ];

  return (
    <div className="w-full min-w-0 space-y-4 animate-fade-in">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {days.map(({ key, label }) => (
          <div key={key} className="flex items-center gap-3 min-w-0">
            <label className="text-sm font-medium text-[var(--om-text)] w-20 flex-shrink-0">
              {label} :
            </label>
            <input
              type="text"
              value={times[key]}
              onChange={(e) => handleChange(key, e.target.value)}
              placeholder="ex: 30min, 1h, 1h20"
              className="flex-1 min-w-0 px-3 py-2 rounded-[10px] border border-[var(--om-line)] focus:border-[var(--om-accent)] focus:outline-none text-sm"
            />
          </div>
        ))}
      </div>
      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={handleValidate}
          className="px-6 py-2 rounded-[10px] bg-[var(--om-accent)] text-[var(--om-on-accent)] font-medium hover:bg-[var(--om-accent-hover)] transition-colors text-sm"
        >
          Valider
        </button>
      </div>
    </div>
  );
}

/**
 * Étape des gauges : 100% à distribuer. Max 3 perso (bleu) + 2 pro (orange).
 * Même taille que les gauges Apprentissage, domaine complet affiché en dessous.
 * + / − ajoutent / retirent 1% à la fois. Maintien du doigt → accélération progressive.
 */
function OnboardingGaugesStep({ domainsForGauges, domainsPersoCount, onValidated }) {
  const domainList = domainsForGauges && domainsForGauges.length > 0
    ? domainsForGauges
    : [];
  const persoCount = domainsPersoCount ?? Math.max(0, domainList.length - 1);

  const [percentAbove, setPercentAbove] = useState(100);
  const [gaugesPercent, setGaugesPercent] = useState(() => {
    const init = {};
    domainList.forEach((name) => { init[name] = 0; });
    return init;
  });

  useEffect(() => {
    if (domainList.length > 0) {
      setGaugesPercent((prev) => {
        const next = {};
        domainList.forEach((name) => { next[name] = prev[name] ?? 0; });
        return next;
      });
    }
  }, [domainList.join('|')]);

  const domainKeys = Object.keys(gaugesPercent);
  const totalInGauges = domainKeys.reduce((s, k) => s + (gaugesPercent[k] || 0), 0);
  const isValid = totalInGauges === 100 && percentAbove === 0;

  const canAddRef = useRef(() => true);
  canAddRef.current = () => percentAbove >= 1;

  const handleAdd = useCallback((key) => {
    if (percentAbove < 1) return;
    setPercentAbove((p) => Math.max(0, p - 1));
    setGaugesPercent((prev) => ({
      ...prev,
      [key]: (prev[key] || 0) + 1,
    }));
  }, [percentAbove]);

  const handleMinus = useCallback((key) => {
    const v = gaugesPercent[key] || 0;
    if (v < 1) return;
    setPercentAbove((p) => p + 1);
    setGaugesPercent((prev) => ({
      ...prev,
      [key]: Math.max(0, (prev[key] || 0) - 1),
    }));
  }, [gaugesPercent]);

  const canMinusRef = useRef(() => false);
  canMinusRef.current = (key) => (gaugesPercent[key] || 0) >= 1;

  const buildPayload = () => ({ ...gaugesPercent });

  const handleValidate = useCallback(async () => {
    if (!isValid) return;
    const payload = buildPayload();
    await onValidated(payload);
  }, [isValid, gaugesPercent, onValidated]);

  const isPro = (i) => i >= persoCount;

  if (domainList.length === 0) {
    return (
      <p className="text-center text-[var(--om-muted)] py-4">
        Aucun domaine défini. Répondez aux questions précédentes.
      </p>
    );
  }

  return (
    <div className="w-full space-y-4 animate-fade-in">
      <p className="text-sm text-[var(--om-text)] font-medium mb-2">
        Répartissez les 100% entre vos domaines :
      </p>
      <p className="text-xs text-[var(--om-muted)] mb-4">
        {percentAbove > 0 ? `${percentAbove}% restant` : 'Répartition complète ✓'}
      </p>
      <div className="flex flex-nowrap justify-center items-stretch gap-3 sm:gap-4 md:gap-5 w-full pb-2">
        {domainKeys.map((key, i) => (
          <div key={key} className="flex flex-col items-center gap-2 flex-1 min-w-0 max-w-[70px] sm:max-w-[75px] md:max-w-[80px]">
            <div
              className={`w-full min-w-[40px] sm:min-w-[44px] h-40 sm:h-44 md:h-48 min-h-[160px] rounded-full overflow-hidden flex flex-col justify-end flex-shrink-0 ${
                isPro(i) ? 'bg-[var(--om-line)]' : 'bg-[var(--om-track)]'
              }`}
            >
              <div
                className={`w-full rounded-full transition-all duration-300 ${
                  isPro(i) ? 'bg-[var(--om-pro-strong)]' : 'bg-[var(--om-accent)]'
                }`}
                style={{ height: `${gaugesPercent[key] || 0}%` }}
              />
            </div>
            <div className="flex items-center gap-1.5">
              <HoldRepeatButton
                direction="minus"
                onClick={() => handleMinus(key)}
                disabled={(gaugesPercent[key] || 0) < 1}
                canRunRef={canMinusRef}
                canRunArg={key}
                className="w-7 h-7 sm:w-7 sm:h-7 md:w-6 md:h-6 rounded-full flex items-center justify-center text-xs font-medium border border-[var(--om-line)] text-[var(--om-muted)] hover:bg-[var(--om-surface-2)] disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
              />
              <HoldRepeatButton
                direction="plus"
                onClick={() => handleAdd(key)}
                disabled={percentAbove < 1}
                canRunRef={canAddRef}
                className={`w-7 h-7 sm:w-7 sm:h-7 md:w-6 md:h-6 rounded-full flex items-center justify-center text-xs font-medium text-[var(--om-on-accent)] disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 ${
                  isPro(i) ? 'bg-[var(--om-pro-strong)] hover:opacity-90' : 'bg-[var(--om-accent)] hover:opacity-90'
                }`}
              />
            </div>
            <span
              className="text-xs sm:text-xs md:text-sm font-medium text-[var(--om-muted)] text-center max-w-[90px] sm:max-w-[95px] break-words leading-tight"
              title={key}
            >
              {key}
            </span>
          </div>
        ))}
      </div>
      {isValid && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={handleValidate}
            className="px-6 py-3 rounded-[10px] bg-[var(--om-accent)] text-[var(--om-on-accent)] font-medium hover:bg-[var(--om-accent-hover)] transition-colors"
          >
            Valider
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Interface de discussion avec l'assistant IA : fluide et animée.
 */
function OnboardingAiChat({ onBack }) {
  const [messages, setMessages] = useState([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [stepKey, setStepKey] = useState('intro');
  const [domainsForGauges, setDomainsForGauges] = useState([]);
  const [domainsPersoCount, setDomainsPersoCount] = useState(0);
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
      setDomainsForGauges(data.domainsForGauges || []);
      setDomainsPersoCount(data.domainsPersoCount ?? 0);

      if (data.stepIndex === 0 && data.message) {
        setMessages([{ role: 'assistant', content: data.message }]);
      } else {
        const hist = [];
        if (data.message) {
          hist.push({ role: 'assistant', content: data.message });
        }
        if (data.stepKey === 'gauges' && !data.message) {
          hist.push({ role: 'assistant', content: 'Parfait ! Maintenant, répartissez les 100% entre vos domaines selon leur importance pour vous.' });
        }
        // Note: Pour 'temps_semaine', le message est affiché via le rendu conditionnel ci-dessous (ligne 526-533)
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
      setDomainsForGauges(data.domainsForGauges || []);
      setDomainsPersoCount(data.domainsPersoCount ?? 0);

      if (data.message) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.message }]);
      } else if (data.stepKey === 'gauges') {
        setMessages((prev) => [...prev, { role: 'assistant', content: 'Parfait ! Maintenant, répartissez les 100% entre vos domaines selon leur importance pour vous.' }]);
      }
      // Note: Pour 'temps_semaine', le message est affiché via le rendu conditionnel ci-dessous (ligne 526-533)
    } catch (err) {
      const msg = err.response?.data?.error || 'Erreur lors de l\'envoi.';
      setError(msg);
      setMessages((prev) => [...prev, { role: 'assistant', content: msg }]);
    } finally {
      setSubmitting(false);
    }
  }, [inputValue, submitting]);

  const handleGaugesValidated = useCallback(async (domainsGaugesPercent) => {
    const displayText = Object.entries(domainsGaugesPercent)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `${k}: ${v}%`)
      .join(' · ');
    setMessages((prev) => [...prev, { role: 'user', content: displayText, isReadOnly: true }]);
    setSubmitting(true);
    setError(null);
    try {
      const data = await postAiGauges(domainsGaugesPercent);
      if (data.message) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.message }]);
      }
      setStepKey(data.stepKey || 'autre_chose');
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur');
    } finally {
      setSubmitting(false);
    }
  }, []);

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

  const isGaugesStep = stepKey === 'gauges';
  const isTimeStep = stepKey === 'temps_semaine';
  const isFinalStep = stepKey === 'autre_chose';

  const formatTimesForDisplay = useCallback((times) => {
    const labels = { lundi: 'Lundi', mardi: 'Mardi', mercredi: 'Mercredi', jeudi: 'Jeudi', vendredi: 'Vendredi', samedi: 'Samedi', dimanche: 'Dimanche' };
    return Object.entries(labels)
      .map(([k, l]) => (times[k] ? `${l}: ${times[k]}` : null))
      .filter(Boolean)
      .join(' · ') || 'Non renseigné';
  }, []);

  const handleTimeValidated = useCallback(async (times) => {
    const displayText = formatTimesForDisplay(times);
    setMessages((prev) => [...prev, { role: 'user', content: displayText, isReadOnly: true }]);
    setSubmitting(true);
    setError(null);
    try {
      const data = await postAiStep(JSON.stringify(times));
      setStepIndex(data.stepIndex);
      setStepKey(data.stepKey);
      setDomainsForGauges(data.domainsForGauges || []);
      setDomainsPersoCount(data.domainsPersoCount ?? 0);
      if (data.message) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.message }]);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur');
    } finally {
      setSubmitting(false);
    }
  }, [formatTimesForDisplay]);

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
                  {m.isTimeForm ? (
                    <div>
                      <p className="whitespace-pre-wrap text-sm md:text-base mb-4">{m.content}</p>
                      <OnboardingTimeInput onValidated={handleTimeValidated} />
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap text-sm md:text-base">{m.content}</p>
                  )}
                </div>
              </div>
            ))}

            {isTimeStep && !messages.some((m) => m.isTimeForm) && (
              <div className="flex justify-start animate-fade-in w-full">
                <div className="w-full max-w-full sm:max-w-[85%] rounded-2xl px-4 py-4 bg-[var(--om-surface)]/90 backdrop-blur-sm border border-[var(--om-line)] text-[var(--om-text)]">
                  <p className="text-sm md:text-base mb-4">Pour adapter votre planning, nous allons déterminer combien de temps vous pouvez consacrer à l&apos;apprentissage chaque jour de la semaine.</p>
                  <OnboardingTimeInput onValidated={handleTimeValidated} />
                </div>
              </div>
            )}

            {isGaugesStep && (
              <div className="flex justify-start animate-fade-in w-full">
                <div className="w-full max-w-full rounded-2xl px-4 py-4 bg-[var(--om-surface)]/90 backdrop-blur-sm border border-[var(--om-line)] text-[var(--om-text)]">
                  <OnboardingGaugesStep
                    domainsForGauges={domainsForGauges}
                    domainsPersoCount={domainsPersoCount}
                    onValidated={handleGaugesValidated}
                  />
                </div>
              </div>
            )}

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

        {!isGaugesStep && !isTimeStep && !showLoader && (
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
