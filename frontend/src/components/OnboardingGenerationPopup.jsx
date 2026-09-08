import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { getGenerationStatus, getOnboardingStatus, cancelGeneration, resumeGeneration } from '../utils/onboardingApi';

/**
 * Section fixe "Configuration de votre espace en cours" affichée juste en dessous du header.
 * - S'affiche UNIQUEMENT pendant l'onboarding (une seule fois dans la vie de l'utilisateur)
 * - Affiche la progression réelle avec pourcentage et étape en cours
 * - Flèche vers le bas : déplie le log détaillé (événements, ce qui est créé, etc.)
 */
function OnboardingGenerationPopup() {
  const location = useLocation();
  const [expanded, setExpanded] = useState(false);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState(null);
  const [log, setLog] = useState([]);
  const [completed, setCompleted] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [shouldShow, setShouldShow] = useState(false); // Ne s'affiche que si l'onboarding n'est pas terminé
  const lastProgressRef = useRef(0); // Pour détecter si la progression stagne
  const stuckCheckTimeoutRef = useRef(null); // Timeout pour vérifier si bloqué
  const autoResumeInProgressRef = useRef(false); // Éviter plusieurs reprises simultanées
  const lastAutoResumeRef = useRef(0); // Dernière reprise auto (throttle)

  // Vérifier le statut de la génération d'onboarding au chargement
  useEffect(() => {
    const checkGenerationStatus = async () => {
      try {
        console.log('[OnboardingGenerationPopup] Vérification du statut de génération...');
        
        // Génération lancée à la fin de l'entretien d'onboarding.
        // Ne pas afficher si le popup de succès a déjà été affiché
        const hasShownSuccess = localStorage.getItem('onboarding_success_shown');
        if (hasShownSuccess === 'true') {
          console.log('[OnboardingGenerationPopup] Popup de succès déjà affiché, ne pas afficher');
          setShouldShow(false);
          return;
        }
        
        const status = await getOnboardingStatus();
        console.log('[OnboardingGenerationPopup] Statut onboarding reçu:', status);
        
        // Vérifier getGenerationStatus pour détecter une génération onboarding en cours
        try {
          const genStatus = await getGenerationStatus();
          console.log('[OnboardingGenerationPopup] Statut de génération onboarding détaillé:', genStatus);
          if (!genStatus.completed && (genStatus.step !== null && genStatus.step !== undefined || genStatus.progress !== null && genStatus.progress !== undefined)) {
            console.log('[OnboardingGenerationPopup] Génération onboarding en cours détectée, affichage de la section');
            setGenerating(true);
            setShouldShow(true);
            setProgress(genStatus.progress ?? 0);
            setStep(genStatus.step ?? 'starting');
            setLog(genStatus.log || []);
            return; // On a trouvé une génération onboarding en cours
          }
          if (genStatus.completed) {
            console.log('[OnboardingGenerationPopup] Génération onboarding terminée, ne pas afficher');
            setShouldShow(false);
            return;
          }
        } catch (genErr) {
          console.warn('[OnboardingGenerationPopup] Erreur lors de la vérification du statut de génération onboarding:', genErr);
        }
        
        // Ne pas afficher si l'onboarding est déjà terminé
        if (!status.needsOnboarding && !status.isGenerating) {
          console.log('[OnboardingGenerationPopup] Onboarding terminé, ne pas afficher');
          setShouldShow(false);
          return;
        }
        
        // Si isGenerating est true, afficher immédiatement la section
        if (status.isGenerating) {
          console.log('[OnboardingGenerationPopup] isGenerating=true, affichage immédiat de la section');
          setGenerating(true);
          setShouldShow(true);
          setProgress(0);
          setStep('starting');
          // Essayer de récupérer le statut détaillé en arrière-plan
          getGenerationStatus()
            .then((genStatus) => {
              console.log('[OnboardingGenerationPopup] Statut détaillé reçu:', genStatus);
              if (!genStatus.completed) {
                setProgress(genStatus.progress ?? 0);
                setStep(genStatus.step ?? 'starting');
                setLog(genStatus.log || []);
              }
            })
            .catch((genErr) => {
              console.warn('[OnboardingGenerationPopup] Erreur lors de la récupération du statut détaillé:', genErr);
            });
          return;
        }
        
        // Afficher uniquement si l'onboarding est nécessaire
        console.log('[OnboardingGenerationPopup] needsOnboarding:', status.needsOnboarding);
        setShouldShow(status.needsOnboarding);
      } catch (error) {
        console.error('[OnboardingGenerationPopup] Erreur lors de la vérification du statut:', error);
        setShouldShow(false);
      }
    };
    // Ne vérifier que sur les pages /home pour éviter les appels inutiles
    if (location.pathname.startsWith('/home')) {
      checkGenerationStatus();
    } else {
      // Si on quitte les pages /home, réinitialiser l'état et le flag de vérification
      setGenerating(false);
      setShouldShow(false);
    }
  }, [location.pathname]);

  const poll = useCallback(async () => {
    try {
      {
        const data = await getGenerationStatus();
        const currentProgress = data.progress ?? 0;
        setProgress(currentProgress);
        // Ne jamais afficher "error" ou un message négatif : garder neutre
        const hasErrorInLog = data.log?.some(entry => entry.status === 'error') || false;
        const isErrorState = hasErrorInLog || data.step === 'error';
        setStep(isErrorState ? 'En cours...' : (data.step ?? 'En cours...'));
        setLog(data.log || []);

        // Erreur ou bloqué onboarding : reprise automatique sans afficher de message
        if (isErrorState) {
          const now = Date.now();
          if (!autoResumeInProgressRef.current && now - lastAutoResumeRef.current > 15000) {
            autoResumeInProgressRef.current = true;
            lastAutoResumeRef.current = now;
            resumeGeneration().catch(() => {}).finally(() => {
              autoResumeInProgressRef.current = false;
            });
          }
          setGenerating(true);
          setShouldShow(true);
        }

        // Détection blocage (progression inchangée 30s) → reprise auto
        if (!data.completed && (data.step !== null || data.progress !== null)) {
          if (currentProgress === lastProgressRef.current && currentProgress > 0 && currentProgress < 100) {
            if (!stuckCheckTimeoutRef.current) {
              stuckCheckTimeoutRef.current = setTimeout(() => {
                if (currentProgress === lastProgressRef.current && currentProgress > 0 && currentProgress < 100) {
                  const now = Date.now();
                  if (!autoResumeInProgressRef.current && now - lastAutoResumeRef.current > 15000) {
                    autoResumeInProgressRef.current = true;
                    lastAutoResumeRef.current = now;
                    resumeGeneration().catch(() => {}).finally(() => {
                      autoResumeInProgressRef.current = false;
                    });
                  }
                }
                stuckCheckTimeoutRef.current = null;
              }, 30000);
            }
          } else {
            if (stuckCheckTimeoutRef.current) {
              clearTimeout(stuckCheckTimeoutRef.current);
              stuckCheckTimeoutRef.current = null;
            }
            lastProgressRef.current = currentProgress;
          }
        }

        if (data.completed ?? false) {
          setCompleted(true);
          setGenerating(false);
          if (generating) {
            setShowSuccessPopup(true);
          }
          return;
        }
        if (data.step !== null && data.step !== undefined || data.progress !== null && data.progress !== undefined) {
          setGenerating(true);
          setShouldShow(true);
        }
      }
    } catch (err) {
      // En cas d'erreur réseau, ne pas arrêter complètement le polling
      // La génération continue côté backend même si le frontend a une erreur temporaire
      console.warn('Erreur lors du polling (génération continue côté backend):', err);
      // Ne pas mettre completed à true pour permettre la reprise du polling
    }
  }, [generating]);

  useEffect(() => {
    // Ne pas poller si la génération est terminée
    if (!location.pathname.startsWith('/home') || completed) return;
    if (!shouldShow && !generating) return;

    poll();
    const interval = setInterval(() => {
      if (!completed && (shouldShow || generating)) {
        poll();
      }
    }, 800);

    return () => {
      clearInterval(interval);
      if (stuckCheckTimeoutRef.current) {
        clearTimeout(stuckCheckTimeoutRef.current);
      }
    };
  }, [location.pathname, completed, shouldShow, generating, poll]);
  // Pop-up "La génération est terminée" 5 secondes puis disparition
  // Ne s'affiche qu'une seule fois dans la vie de l'utilisateur (pendant l'onboarding)
  useEffect(() => {
    if (!showSuccessPopup) return;
    
    // Vérifier si on a déjà affiché ce popup (mémorisé dans localStorage)
    const hasShownSuccess = localStorage.getItem('onboarding_success_shown');
    if (hasShownSuccess === 'true') {
      setShowSuccessPopup(false);
      setShouldShow(false);
      return;
    }
    
    // Mémoriser qu'on a affiché le popup de succès
    localStorage.setItem('onboarding_success_shown', 'true');
    
    const t = setTimeout(() => {
      setShowSuccessPopup(false);
      setShouldShow(false);
    }, 5000);
    return () => clearTimeout(t);
  }, [showSuccessPopup]);

  const handleToggleExpand = useCallback(() => {
    setExpanded((e) => !e);
  }, []);

  const stepLabel = {
    flashcards: 'Flashcards',
    todos: 'Tâches',
    routines: 'Routines',
    done: 'Terminé',
    starting: 'Démarrage',
  };

  if (!shouldShow && !generating) return null;

  return (
    <>
      {/* Pop-up "La génération est terminée" pendant 5 secondes */}
      {showSuccessPopup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--om-scrim-solid)]/40"
          role="alert"
          aria-live="polite"
        >
          <div className="bg-[var(--om-surface)] rounded-2xl shadow-[var(--om-shadow-lg)] p-6 sm:p-8 max-w-sm w-full text-center animate-fade-in">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[var(--om-success-soft)] flex items-center justify-center">
              <svg className="w-8 h-8 text-[var(--om-success)]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-lg font-medium text-[var(--om-text)]">
              La génération est terminée
            </p>
            <p className="text-sm text-[var(--om-muted)] mt-2">
              Votre espace est prêt. Ce message se ferme dans quelques secondes.
            </p>
          </div>
        </div>
      )}

      {/* Section fixe juste en dessous du header */}
      <div
        className="sticky top-[64px] md:top-[80px] z-30 flex justify-center mt-2 md:mt-3"
        role="status"
        aria-live="polite"
      >
        <div className="w-full max-w-lg md:w-[50%] md:max-w-none mx-2 md:mx-auto px-2 md:px-6 py-3 md:py-3.5 bg-[var(--om-surface)] border border-[var(--om-line)] rounded-[10px]">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="flex-shrink-0 w-7 h-7 md:w-8 md:h-8 flex items-center justify-center">
              <div className="animate-spin rounded-full h-5 w-5 md:h-6 md:w-6 border border-[var(--om-accent)] border-t-transparent" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm md:text-base font-medium text-[var(--om-text)] mb-2 md:mb-2.5">
                Configuration de votre espace en cours
              </p>
              <div className="flex items-center gap-2.5 md:gap-3">
                {/* Barre de progression */}
                <div className="flex-1 h-2 md:h-2.5 bg-[var(--om-track)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--om-accent)] rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                {/* Pourcentage */}
                <div className="flex items-center gap-2 md:gap-2.5 flex-shrink-0">
                  <span className="text-xs md:text-sm font-medium text-[var(--om-text)] min-w-[3rem] md:min-w-[4rem] text-right">
                    {progress}%
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await cancelGeneration();
                    setGenerating(false);
                    setShouldShow(false);
                    setCompleted(true);
                  } catch (err) {
                    // Ne pas afficher d'erreur à l'utilisateur
                  }
                }}
                className="flex-shrink-0 w-7 h-7 md:w-8 md:h-8 rounded-[10px] flex items-center justify-center text-[var(--om-danger)] hover:bg-[var(--om-danger-soft)] transition-colors"
                aria-label="Annuler la génération"
                title="Annuler la génération"
              >
                <svg
                  className="w-4 h-4 md:w-5 md:h-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              {/* Bouton expand/collapse */}
              <button
                type="button"
                onClick={handleToggleExpand}
                className="flex-shrink-0 w-7 h-7 md:w-8 md:h-8 rounded-[10px] flex items-center justify-center text-[var(--om-muted)] hover:bg-[var(--om-surface-2)] transition-colors"
                aria-label={expanded ? 'Replier le log' : 'Déplier le log'}
                title={expanded ? 'Replier' : 'Voir le détail'}
              >
                <svg
                  className={`w-4 h-4 md:w-5 md:h-5 transition-transform ${expanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>

          {/* Zone dépliée : log des événements */}
          {expanded && (
            <div className="mt-2.5 pt-2.5 border-t border-[var(--om-line)] bg-[var(--om-surface-2)]/50 rounded-[10px] max-h-48 overflow-y-auto">
              <p className="text-xs font-medium text-[var(--om-muted)] px-3 py-2">
                Processus de réflexion
              </p>
              <ul className="py-1.5 px-3 space-y-1.5 text-xs font-mono">
                {log.length === 0 ? (
                  <li className="text-[var(--om-muted)]">En attente des premiers événements…</li>
                ) : (
                  <>
                    {/* Afficher l'étape actuelle en haut si elle existe */}
                    {step && step !== 'done' && step !== 'starting' && (
                      <li className="text-[var(--om-accent)] font-medium mb-2 pb-1.5 border-b border-[var(--om-line)]">
                        {step}
                      </li>
                    )}
                    {/* Afficher les messages du log */}
                    {log.map((entry, i) => {
                      // Formater le message avec le format demandé
                      let formattedMessage = entry.message;
                      
                      // Format: "Génération chapitre 1/3 : Titre…" → "- Chapitre 1 -> Génération de la partie 1 en cours..."
                      const chapitreMatch = formattedMessage.match(/Génération chapitre (\d+)\/(\d+)/i);
                      if (chapitreMatch) {
                        const [, num] = chapitreMatch;
                        formattedMessage = `- Chapitre ${num} -> Génération de la partie ${num} en cours...`;
                      }
                      
                      // Format: "Génération sous-chapitre 1/4 du chapitre 1…" → "- Chapitre 1 -> Génération de la partie 1 en cours..."
                      const sousChapitreMatch = formattedMessage.match(/Génération sous-chapitre (\d+)\/(\d+)\s+du chapitre (\d+)/i);
                      if (sousChapitreMatch) {
                        const [, partieNum, , chapitreNum] = sousChapitreMatch;
                        formattedMessage = `- Chapitre ${chapitreNum} -> Génération de la partie ${partieNum} en cours...`;
                      }
                      
                      // Format: "Chapitre X créé." → "- Chapitre X créé."
                      if (formattedMessage.match(/^Chapitre \d+ créé/i)) {
                        formattedMessage = `- ${formattedMessage}`;
                      }
                      
                      // Format: "Sous-chapitre X créé..." → "- Chapitre Y -> Partie X créée."
                      const sousChapitreCreeMatch = formattedMessage.match(/Sous-chapitre (\d+)\s+(?:créé|crée)/i);
                      if (sousChapitreCreeMatch && i > 0) {
                        // Chercher le dernier message de chapitre pour trouver le numéro
                        const dernierChapitre = log.slice(0, i).reverse().find(e => e.message.match(/Génération chapitre (\d+)/i));
                        if (dernierChapitre) {
                          const chMatch = dernierChapitre.message.match(/Génération chapitre (\d+)/i);
                          if (chMatch) {
                            formattedMessage = `- Chapitre ${chMatch[1]} -> Partie ${sousChapitreCreeMatch[1]} créée.`;
                          }
                        }
                      }
                      
                      // Pour les autres messages, ajouter un tiret si nécessaire
                      if (!formattedMessage.startsWith('-') && !formattedMessage.match(/^(Démarrage|Configuration|Création)/i)) {
                        formattedMessage = `- ${formattedMessage}`;
                      }
                      
                      return (
                        <li
                          key={i}
                          className={`flex items-start gap-2 ${
                            entry.status === 'running'
                              ? 'text-[var(--om-accent)]'
                              : 'text-[var(--om-text)]'
                          }`}
                        >
                          <span className="flex-shrink-0 text-[var(--om-muted)]">
                            {entry.status === 'running' ? '⟳' : '✓'}
                          </span>
                          <span>{formattedMessage}</span>
                        </li>
                      );
                    })}
                  </>
                )}
              </ul>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default OnboardingGenerationPopup;
