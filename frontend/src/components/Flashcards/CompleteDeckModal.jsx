import { useState, useCallback, useEffect, useRef } from 'react';
import {
  startDeckCompletion,
  fetchGenerationJob,
  fetchGenerationJobs,
  cancelGenerationJob,
} from '../../utils/flashcardApi';

const POLL_INTERVAL_MS = 3000;
const CARDS_PER_GROUP = [3, 5, 8, 12];

/**
 * Complément d'une collection par l'IA.
 *
 * À la différence de « Nouvelles cartes », aucun sujet n'est demandé : celui de
 * la collection est repris côté serveur, et chaque groupe est étoffé à partir de
 * son propre thème et des cartes qu'il contient déjà. L'utilisateur n'a que deux
 * décisions à prendre — quels groupes, et une consigne facultative pour orienter
 * la demande.
 *
 * Comme les autres générations, le travail se poursuit côté serveur : la fenêtre
 * peut être fermée, une notification push avertit à la fin.
 */
function CompleteDeckModal({ isOpen, onClose, onCompleted, deck, chapters = [] }) {
  const [scope, setScope] = useState('all');
  const [cardsPerGroup, setCardsPerGroup] = useState(5);
  const [useRefine, setUseRefine] = useState(false);
  const [refinePrompt, setRefinePrompt] = useState('');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [job, setJob] = useState(null);
  const pollRef = useRef(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const trackJob = useCallback((jobId) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const fresh = await fetchGenerationJob(jobId);
        setJob(fresh);
        if (['ready', 'error', 'canceled'].includes(fresh.status)) stopPolling();
      } catch {
        // Perte de réseau : le travail continue côté serveur, on retentera.
      }
    }, POLL_INTERVAL_MS);
  }, [stopPolling]);

  // À l'ouverture, on récupère un complément laissé en cours sur cette collection.
  useEffect(() => {
    if (!isOpen || !deck) return undefined;
    let canceled = false;
    fetchGenerationJobs().then((jobs) => {
      if (canceled) return;
      const running = jobs.find(
        (j) =>
          (j.status === 'queued' || j.status === 'running')
          && j.mode === 'complete'
          && String(j.deck_id) === String(deck.id)
      );
      if (running) {
        setJob(running);
        trackJob(running.id);
      }
    }).catch(() => {});
    return () => { canceled = true; };
  }, [isOpen, deck, trackJob]);

  useEffect(() => stopPolling, [stopPolling]);

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const reset = useCallback(() => {
    setScope('all');
    setCardsPerGroup(5);
    setUseRefine(false);
    setRefinePrompt('');
    setError('');
    setJob(null);
    stopPolling();
  }, [stopPolling]);

  const handleClose = useCallback(() => {
    // La fenêtre se ferme même pendant le travail : il continue côté serveur.
    stopPolling();
    onClose();
  }, [onClose, stopPolling]);

  const handleStart = useCallback(async () => {
    if (starting || !deck) return;
    setStarting(true);
    setError('');
    try {
      const data = await startDeckCompletion(deck.id, {
        scope,
        cardsPerGroup,
        refinePrompt: useRefine ? refinePrompt.trim() : '',
      });
      setJob(data.job);
      trackJob(data.job.id);
    } catch (err) {
      const other = err.response?.data?.job;
      // 409 : si c'est le complément de cette collection, on bascule sur son suivi.
      if (other && other.mode === 'complete' && String(other.deck_id) === String(deck.id)) {
        setJob(other);
        trackJob(other.id);
      } else {
        setError(err.response?.data?.error || 'Le lancement a échoué. Réessayez.');
      }
    } finally {
      setStarting(false);
    }
  }, [deck, scope, cardsPerGroup, useRefine, refinePrompt, starting, trackJob]);

  const handleCancel = useCallback(async () => {
    if (!job) return;
    try {
      setJob(await cancelGenerationJob(job.id));
    } catch { /* ignore */ }
    stopPolling();
  }, [job, stopPolling]);

  if (!isOpen) return null;

  const running = job && (job.status === 'queued' || job.status === 'running');
  const finished = job && job.status === 'ready';
  const failed = job && (job.status === 'error' || job.status === 'canceled');
  const targetCount = scope === 'all' ? chapters.length : 1;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="complete-modal-title"
    >
      <div className="om-scrim" onClick={handleClose} />
      <div
        className="relative z-10 om-card shadow-[var(--om-shadow-lg)] p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {finished ? (
          <>
            <h3 id="complete-modal-title" className="text-lg font-medium text-[var(--om-text)] mb-1">
              Collection complétée
            </h3>
            <p className="text-sm text-[var(--om-muted)] mb-4">
              {job.cards_created} carte{job.cards_created > 1 ? 's' : ''} ajoutée
              {job.cards_created > 1 ? 's' : ''} dans « {deck?.name} ».
            </p>
            {job.stats?.failedGroups?.length > 0 && (
              <p className="text-xs text-[var(--om-muted)] bg-[var(--om-surface-2)] rounded-[10px] p-3 mb-4">
                Groupe(s) non complété(s) : {job.stats.failedGroups.join(', ')}.
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { reset(); onCompleted?.(); }}
                className="px-4 py-2 rounded-2xl bg-[var(--om-accent)] text-[var(--om-on-accent)] text-sm font-medium hover:bg-[var(--om-accent-hover)]"
              >
                Voir les cartes
              </button>
              <button
                type="button"
                onClick={() => { reset(); handleClose(); }}
                className="px-4 py-2 rounded-2xl border border-[var(--om-line)] text-[var(--om-muted)] text-sm font-medium hover:bg-[var(--om-surface-2)]"
              >
                Fermer
              </button>
            </div>
          </>
        ) : running ? (
          <>
            <h3 id="complete-modal-title" className="text-lg font-medium text-[var(--om-text)] mb-1">
              Complément en cours
            </h3>
            <p className="text-sm text-[var(--om-muted)] mb-4">« {deck?.name} »</p>

            <div className="h-2 rounded-full bg-[var(--om-track)] overflow-hidden mb-2">
              <div
                className="h-full bg-[var(--om-accent)] transition-all duration-500 ease-out"
                style={{ width: `${Math.max(3, job.progress)}%` }}
              />
            </div>
            <p className="text-sm text-[var(--om-muted)] mb-1" role="status">{job.step}</p>
            {job.cards_created > 0 && (
              <p className="text-xs text-[var(--om-muted)] mb-4">
                {job.cards_created} carte{job.cards_created > 1 ? 's' : ''} déjà enregistrée
                {job.cards_created > 1 ? 's' : ''}.
              </p>
            )}

            <p className="text-xs text-[var(--om-muted)] bg-[var(--om-surface-2)] rounded-[10px] p-3 mb-4">
              Vous pouvez fermer cette fenêtre et même quitter l&apos;application : le
              complément se termine sur le serveur et vous recevrez une notification.
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 rounded-2xl bg-[var(--om-accent)] text-[var(--om-on-accent)] text-sm font-medium hover:bg-[var(--om-accent-hover)]"
              >
                Continuer en arrière-plan
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 rounded-2xl border border-[var(--om-line)] text-[var(--om-muted)] text-sm font-medium hover:bg-[var(--om-surface-2)]"
              >
                Annuler
              </button>
            </div>
          </>
        ) : (
          <>
            <h3 id="complete-modal-title" className="text-lg font-medium text-[var(--om-text)] mb-1 flex items-center gap-2">
              <i className="ph ph-sparkle text-[var(--om-accent)]" aria-hidden />
              Compléter la collection
            </h3>
            <p className="text-sm text-[var(--om-muted)] mb-4">
              L&apos;IA reprend le sujet de « {deck?.name} » et étoffe chaque groupe
              choisi à partir de son thème et des cartes qu&apos;il contient déjà.
            </p>

            {failed && (
              <p className="text-sm text-[var(--om-danger)] bg-[var(--om-danger-soft)] rounded-[10px] p-3 mb-4">
                {job.error || 'Le complément a été interrompu.'}
              </p>
            )}
            {error && (
              <p className="text-sm text-[var(--om-danger)] bg-[var(--om-danger-soft)] rounded-[10px] p-3 mb-4">
                {error}
              </p>
            )}

            <label htmlFor="complete-scope" className="block text-sm font-medium text-[var(--om-text)] mb-1.5">
              Groupes à compléter
            </label>
            <select
              id="complete-scope"
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              className="w-full px-3 py-2 rounded-[10px] border border-[var(--om-line)] text-[var(--om-text)] mb-4 bg-[var(--om-surface)]"
            >
              <option value="all">
                Tous les groupes ({chapters.length})
              </option>
              {chapters.map((chapter) => (
                <option key={chapter.id} value={String(chapter.id)}>
                  {chapter.title}
                </option>
              ))}
            </select>

            <span className="block text-sm font-medium text-[var(--om-text)] mb-1.5">
              Cartes par groupe
            </span>
            <div className="flex flex-wrap gap-2 mb-1.5">
              {CARDS_PER_GROUP.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCardsPerGroup(n)}
                  className="om-chip"
                  data-active={cardsPerGroup === n}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="text-xs text-[var(--om-muted)] mb-4">
              Soit {cardsPerGroup * targetCount} carte(s) au maximum
              {scope === 'all' ? ` sur ${chapters.length} groupe(s)` : ''}.
            </p>

            <div className="flex items-start gap-2 mb-2">
              <input
                id="complete-use-refine"
                type="checkbox"
                checked={useRefine}
                onChange={(e) => setUseRefine(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded border-[var(--om-line)] text-[var(--om-accent)] focus:ring-[var(--om-accent)]"
              />
              <label htmlFor="complete-use-refine" className="text-sm text-[var(--om-text)]">
                Ajouter une consigne de précision
              </label>
            </div>
            {useRefine && (
              <textarea
                value={refinePrompt}
                onChange={(e) => setRefinePrompt(e.target.value)}
                rows={3}
                placeholder="Ex. : insiste sur les dates clés, évite les définitions, cible les cas pratiques…"
                className="w-full px-3 py-2 rounded-[10px] border border-[var(--om-line)] text-[var(--om-text)] mb-4 resize-none"
              />
            )}

            <div className="flex gap-2 justify-end mt-6 pt-4 border-t border-[var(--om-line)]">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 rounded-2xl text-sm text-[var(--om-muted)] hover:bg-[var(--om-surface-2)] transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleStart}
                disabled={starting || chapters.length === 0}
                className="px-4 py-2 rounded-2xl bg-[var(--om-accent)] text-[var(--om-on-accent)] text-sm font-medium hover:bg-[var(--om-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {starting ? 'Lancement…' : 'Compléter'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default CompleteDeckModal;
