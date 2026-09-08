import { useState, useCallback, useEffect, useRef } from 'react';
import {
  startSingleCardGeneration,
  fetchGenerationJob,
  fetchGenerationJobs,
  acceptJobProposals,
  discardJobProposals,
  cancelGenerationJob,
} from '../../utils/flashcardApi';
import { FRONT_MAX_CHARS, BACK_MAX_CHARS, getLengthState } from '../../lib/flashcardLimits';
import FilePicker from '../FilePicker';
import CharCounter from './CharCounter';
import ChapterSelect from './ChapterSelect';

const LEVELS = [
  { value: 'debutant', label: 'Débutant', hint: 'la définition seule' },
  { value: 'intermediaire', label: 'Intermédiaire', hint: '+ exemple et synonymes' },
  { value: 'avance', label: 'Avancé', hint: '+ référence' },
];

const POLL_INTERVAL_MS = 3000;

/** Seuil de glissement au-delà duquel une proposition est écartée. */
const SWIPE_THRESHOLD = 80;

function StarIcon({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.5l2.4 5.6 6.1.5-4.6 4 1.4 5.9-5.3-3.2-5.3 3.2 1.4-5.9-4.6-4 6.1-.5L12 2.5z" />
    </svg>
  );
}

/** Main qui écrit : le pendant manuel de l'étoile. */
function WritingHandIcon({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.2 4.6l4.2 4.2L9.9 18.3l-5.2 1 1-5.2 9.5-9.5z" />
      <path strokeLinecap="round" d="M3 21.5h18" />
    </svg>
  );
}

/** Un côté de la bascule IA / manuel. */
function ModeButton({ active, onClick, label, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center justify-center gap-2 py-2 rounded-[14px] text-sm font-medium transition-colors ${
        active
          ? 'bg-[var(--om-surface)] text-[var(--om-accent)] shadow-[var(--om-shadow)]'
          : 'text-[var(--om-muted)] hover:text-[var(--om-text)]'
      }`}
    >
      {children}
      {label}
    </button>
  );
}

/**
 * Ajout d'UNE carte : par l'IA, ou à la main.
 *
 * Deux voies pour un même geste, d'où un seul bouton et une bascule plutôt que
 * deux entrées de menu. Le côté IA accepte trois formes de demande, qu'il n'est
 * pas nécessaire de déclarer :
 *   - un mot : orthographe corrigée, puis définition au niveau demandé ;
 *   - une description qui cherche son mot : plusieurs candidats proposés, dont
 *     on écarte d'un glissement ceux qui ne conviennent pas ;
 *   - une question, ou un document accompagné d'une demande d'explication.
 *
 * La réflexion a lieu sur le serveur : la fenêtre peut être fermée, et les
 * propositions attendent au retour. Rien n'entre dans la collection sans
 * validation explicite.
 *
 * @param {{id: number|string, name: string}} deck collection de destination
 * @param {Array<{id: number|string, title: string}>} chapters groupes existants
 * @param {string|number} [defaultChapterId] groupe présélectionné
 * @param {Function} onCreateManual ({front, back, chapterId}) => Promise
 * @param {Function} onPublished appelée après enregistrement des cartes générées
 */
function GenerateCardModal({
  isOpen,
  onClose,
  deck,
  chapters = [],
  defaultChapterId = null,
  onCreateManual,
  onPublished,
}) {
  const [mode, setMode] = useState('ia');
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState('intermediaire');
  const [uploads, setUploads] = useState([]);
  const [chapterId, setChapterId] = useState('none');
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [starting, setStarting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [job, setJob] = useState(null);
  const [proposals, setProposals] = useState([]);
  const [capped, setCapped] = useState(null);
  const [swipingIndex, setSwipingIndex] = useState(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const pollRef = useRef(null);
  const swipeStartX = useRef(0);
  const swipeOffsetRef = useRef(0);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const adoptJob = useCallback((fresh) => {
    setJob(fresh);
    if (fresh.status === 'ready' && Array.isArray(fresh.proposals)) {
      setProposals(fresh.proposals.map((p, i) => ({ ...p, key: `${fresh.id}-${i}` })));
    }
  }, []);

  // Suivi d'une rédaction : on interroge le serveur jusqu'à un état terminal.
  const trackJob = useCallback((jobId) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const fresh = await fetchGenerationJob(jobId);
        adoptJob(fresh);
        if (['ready', 'error', 'canceled'].includes(fresh.status)) stopPolling();
      } catch {
        // Perte de réseau : on retentera au prochain battement plutôt que
        // d'abandonner un travail qui, lui, continue côté serveur.
      }
    }, POLL_INTERVAL_MS);
  }, [stopPolling, adoptJob]);

  // À l'ouverture : groupe présélectionné, et rédaction éventuellement laissée
  // en cours — ou terminée pendant l'absence, ses propositions non encore
  // traitées.
  useEffect(() => {
    if (!isOpen) return undefined;
    setChapterId(defaultChapterId != null && defaultChapterId !== '' ? String(defaultChapterId) : 'none');

    let canceled = false;
    fetchGenerationJobs().then((jobs) => {
      if (canceled) return;
      const mine = jobs.find((j) => {
        if (j.mode !== 'single' || String(j.deck_id) !== String(deck.id)) return false;
        if (j.status === 'queued' || j.status === 'running') return true;
        return j.status === 'ready' && !j.stats?.published && j.proposals?.length > 0;
      });
      if (mine) {
        adoptJob(mine);
        setQuery(mine.subject || '');
        if (mine.level) setLevel(mine.level);
        // La destination retenue au lancement l'emporte sur le groupe d'où la
        // fenêtre a été ouverte : c'est celle que l'utilisateur a choisie pour
        // ces propositions-là.
        if (mine.chapter_id) setChapterId(String(mine.chapter_id));
        else if (mine.chapter_mode === 'none') setChapterId('none');
        if (mine.status === 'queued' || mine.status === 'running') trackJob(mine.id);
      }
    });
    return () => { canceled = true; };
  }, [isOpen, deck.id, defaultChapterId, trackJob, adoptJob]);

  useEffect(() => stopPolling, [stopPolling]);

  const reset = useCallback(() => {
    setQuery('');
    setUploads([]);
    setFront('');
    setBack('');
    setError('');
    setJob(null);
    setProposals([]);
    setCapped(null);
    stopPolling();
  }, [stopPolling]);

  const handleClose = useCallback(() => {
    // La fenêtre se ferme même pendant une rédaction : le travail continue.
    stopPolling();
    onClose();
  }, [onClose, stopPolling]);

  const handleStart = useCallback(async () => {
    if (!query.trim() || starting) return;
    setStarting(true);
    setError('');
    try {
      const data = await startSingleCardGeneration(deck.id, {
        query: query.trim(),
        level,
        uploadIds: uploads.map((u) => u.id),
        chapterId,
      });
      adoptJob(data.job);
      trackJob(data.job.id);
    } catch (err) {
      // 409 : une carte est déjà en cours de rédaction. On bascule sur son suivi
      // plutôt que d'afficher une erreur sur un travail qui avance — mais
      // seulement s'il vise cette collection : ses cartes iront là où il a été
      // lancé, pas ici.
      const other = err.response?.data?.job;
      const existing = other && String(other.deck_id) === String(deck.id) ? other : null;
      if (existing) {
        adoptJob(existing);
        trackJob(existing.id);
      } else {
        setError(err.response?.data?.error || 'Le lancement a échoué. Réessayez.');
      }
    } finally {
      setStarting(false);
    }
  }, [query, level, uploads, chapterId, starting, deck.id, trackJob, adoptJob]);

  const handleCancelJob = useCallback(async () => {
    if (!job) return;
    try {
      setJob(await cancelGenerationJob(job.id));
    } catch { /* ignore */ }
    stopPolling();
  }, [job, stopPolling]);

  const handleCreateManual = useCallback(async () => {
    if (!front.trim() || !back.trim()) {
      setError('Recto et verso requis');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onCreateManual({
        front: front.trim(),
        back: back.trim(),
        chapterId: chapterId === 'none' ? null : chapterId,
      });
      reset();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la création');
    } finally {
      setSaving(false);
    }
  }, [front, back, chapterId, onCreateManual, reset, onClose]);

  const handlePublish = useCallback(async () => {
    if (proposals.length === 0 || !job) return;
    setSaving(true);
    setError('');
    try {
      const data = await acceptJobProposals(job.id, {
        cards: proposals.map((p) => ({ front: p.front, back: p.back })),
        chapterId,
      });
      onPublished?.(data.created);
      // Quota atteint en cours de route : les cartes enregistrées le sont, mais
      // pas toutes. Le dire vaut mieux que de fermer sur un compte faux.
      if (data.capped) {
        setCapped(data.capped);
        setProposals([]);
        setSaving(false);
        return;
      }
      reset();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Enregistrement impossible. Réessayez.');
      setSaving(false);
    }
  }, [proposals, job, chapterId, reset, onPublished, onClose]);

  /**
   * Reprendre à zéro : les propositions écartées ne doivent pas revenir à la
   * prochaine ouverture, d'où l'abandon signalé au serveur. Après un
   * enregistrement partiel (quota), il n'y a plus rien à reprendre : on ferme.
   */
  const handleRestart = useCallback(() => {
    if (job && !capped) discardJobProposals(job.id);
    const previousQuery = query;
    reset();
    if (capped) {
      onClose();
      return;
    }
    // La demande reste en place : on recommence pour l'affiner, rarement pour
    // repartir d'une page blanche.
    setQuery(previousQuery);
  }, [job, capped, query, reset, onClose]);

  const removeProposal = useCallback((key) => {
    setProposals((prev) => prev.filter((p) => p.key !== key));
    setSwipingIndex(null);
    setSwipeOffset(0);
    swipeOffsetRef.current = 0;
  }, []);

  const handleSwipeStart = useCallback((e, key) => {
    swipeStartX.current = e.touches ? e.touches[0].clientX : e.clientX;
    swipeOffsetRef.current = 0;
    setSwipingIndex(key);
    setSwipeOffset(0);
  }, []);

  const handleSwipeMove = useCallback((e, key) => {
    if (swipingIndex !== key) return;
    const current = e.touches ? e.touches[0].clientX : e.clientX;
    const diff = swipeStartX.current - current;
    if (diff > 0) {
      const offset = Math.min(diff, SWIPE_THRESHOLD + 40);
      swipeOffsetRef.current = offset;
      setSwipeOffset(offset);
    }
  }, [swipingIndex]);

  const handleSwipeEnd = useCallback((key) => {
    if (swipingIndex === key && swipeOffsetRef.current > SWIPE_THRESHOLD) {
      removeProposal(key);
      return;
    }
    setSwipingIndex(null);
    setSwipeOffset(0);
    swipeOffsetRef.current = 0;
  }, [swipingIndex, removeProposal]);

  if (!isOpen) return null;

  const frontLength = getLengthState(front, FRONT_MAX_CHARS);
  const backLength = getLengthState(back, BACK_MAX_CHARS);
  const running = job && (job.status === 'queued' || job.status === 'running');
  const reviewing = job && job.status === 'ready' && !job.stats?.published;
  const failed = job && (job.status === 'error' || job.status === 'canceled');
  const correction = job?.stats?.correction;
  const notice = job?.stats?.notice;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="om-scrim" onClick={handleClose} />
      <div className="relative z-10 om-card shadow-[var(--om-shadow-lg)] p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-medium text-[var(--om-text)] mb-1">Nouvelle carte</h3>
        <p className="text-sm text-[var(--om-muted)] mb-4">
          Dans « {deck.name} ».
        </p>

        {/* Propositions à valider : la rédaction est finie, tout le reste
            (bascule, réglages) n'a plus lieu d'être affiché. */}
        {reviewing ? (
          <>
            {correction && (
              <p className="text-sm text-[var(--om-text)] bg-[var(--om-surface-2)] rounded-[10px] p-3 mb-3">
                Orthographe corrigée : {correction}
              </p>
            )}
            {notice && (
              <p className="text-sm text-[var(--om-warning)] bg-[var(--om-surface-2)] rounded-[10px] p-3 mb-3" role="note">
                {notice}
              </p>
            )}
            <p className="text-sm text-[var(--om-muted)] mb-3">
              {proposals.length > 1
                ? 'Glissez vers la gauche pour écarter ce qui ne vous intéresse pas, puis validez le reste.'
                : 'Glissez vers la gauche pour écarter la carte, ou validez-la.'}
            </p>

            <ul className="space-y-2 mb-4">
              {proposals.map((proposal) => (
                <li
                  key={proposal.key}
                  className="relative overflow-hidden rounded-2xl"
                  onTouchStart={(e) => handleSwipeStart(e, proposal.key)}
                  onTouchMove={(e) => handleSwipeMove(e, proposal.key)}
                  onTouchEnd={() => handleSwipeEnd(proposal.key)}
                  onMouseDown={(e) => handleSwipeStart(e, proposal.key)}
                  onMouseMove={(e) => handleSwipeMove(e, proposal.key)}
                  onMouseUp={() => handleSwipeEnd(proposal.key)}
                  onMouseLeave={() => handleSwipeEnd(proposal.key)}
                >
                  <div
                    className="absolute right-0 top-0 bottom-0 flex items-center justify-center bg-[var(--om-danger)] text-[var(--om-on-accent)] px-4 rounded-r-2xl cursor-pointer z-0 text-sm font-medium"
                    style={{
                      minWidth: '90px',
                      transform: `translateX(${swipingIndex === proposal.key && swipeOffset > 0 ? '0' : '100%'})`,
                      opacity: swipingIndex === proposal.key && swipeOffset > 0 ? 1 : 0,
                      pointerEvents: swipingIndex === proposal.key && swipeOffset > 0 ? 'auto' : 'none',
                    }}
                    onClick={(e) => { e.stopPropagation(); removeProposal(proposal.key); }}
                  >
                    Écarter
                  </div>
                  <div
                    className="relative z-10 rounded-2xl border border-[var(--om-line)] bg-[var(--om-surface)] p-3 shadow-[var(--om-shadow)] transition-transform duration-200"
                    style={{ transform: `translateX(-${swipingIndex === proposal.key ? swipeOffset : 0}px)` }}
                  >
                    <div className="flex items-start gap-2">
                      <p className="font-medium text-[var(--om-text)] flex-1">{proposal.front}</p>
                      <button
                        type="button"
                        onClick={() => removeProposal(proposal.key)}
                        aria-label={`Écarter « ${proposal.term || proposal.front} »`}
                        className="p-1 text-[var(--om-muted)] hover:text-[var(--om-danger)] flex-shrink-0"
                      >
                        ✕
                      </button>
                    </div>
                    {proposal.hint && (
                      <p className="text-xs text-[var(--om-accent)] mt-0.5">{proposal.hint}</p>
                    )}
                    <p className="text-sm text-[var(--om-muted)] mt-1 whitespace-pre-wrap">{proposal.back}</p>
                  </div>
                </li>
              ))}
            </ul>

            {proposals.length === 0 && !capped && (
              <p className="text-sm text-[var(--om-muted)] bg-[var(--om-surface-2)] rounded-[10px] p-3 mb-4">
                Toutes les propositions ont été écartées. Reformulez votre demande pour
                en obtenir d&apos;autres.
              </p>
            )}

            {capped && (
              <p className="text-sm text-[var(--om-warning)] bg-[var(--om-surface-2)] rounded-[10px] p-3 mb-4">
                {capped.created} carte{capped.created > 1 ? 's' : ''} sur {capped.asked} enregistrée
                {capped.created > 1 ? 's' : ''} : limite de flashcards de votre plan atteinte.
              </p>
            )}
            {error && <p className="text-sm text-[var(--om-danger)] mb-3" role="alert">{error}</p>}

            <ChapterSelect
              value={chapterId}
              onChange={setChapterId}
              chapters={chapters}
              disabled={saving}
              id="single-card-chapter-review"
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handlePublish}
                disabled={saving || proposals.length === 0}
                className="px-4 py-2 rounded-2xl bg-[var(--om-accent)] text-[var(--om-on-accent)] text-sm font-medium hover:bg-[var(--om-accent-hover)] disabled:opacity-60"
              >
                {saving
                  ? 'Enregistrement…'
                  : `Ajouter ${proposals.length > 1 ? `les ${proposals.length} cartes` : 'la carte'}`}
              </button>
              <button
                type="button"
                onClick={handleRestart}
                disabled={saving}
                className="px-4 py-2 rounded-2xl border border-[var(--om-line)] text-[var(--om-muted)] text-sm font-medium hover:bg-[var(--om-surface-2)] disabled:opacity-60"
              >
                {capped ? 'Fermer' : 'Recommencer'}
              </button>
            </div>
          </>
        ) : running ? (
          <>
            <p className="text-sm text-[var(--om-muted)] mb-4">« {job.subject} »</p>
            <div className="h-2 rounded-full bg-[var(--om-track)] overflow-hidden mb-2">
              <div
                className="h-full bg-[var(--om-accent)] transition-all duration-500 ease-out"
                style={{ width: `${Math.max(3, job.progress)}%` }}
              />
            </div>
            <p className="text-sm text-[var(--om-muted)] mb-4" role="status">{job.step}</p>

            <p className="text-xs text-[var(--om-muted)] bg-[var(--om-surface-2)] rounded-[10px] p-3 mb-4">
              Vous pouvez fermer cette fenêtre et même quitter l&apos;application : la
              rédaction se termine sur le serveur et vous recevrez une notification.
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
                onClick={handleCancelJob}
                className="px-4 py-2 rounded-2xl border border-[var(--om-line)] text-[var(--om-muted)] text-sm font-medium hover:bg-[var(--om-surface-2)]"
              >
                Annuler
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Bascule IA / manuel : un seul bouton « + carte » mène aux deux. */}
            <div
              role="group"
              aria-label="Mode de création"
              className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-[var(--om-surface-2)] mb-4"
            >
              <ModeButton
                active={mode === 'ia'}
                onClick={() => { setMode('ia'); setError(''); }}
                label="IA"
              >
                <StarIcon />
              </ModeButton>
              <ModeButton
                active={mode === 'manuel'}
                onClick={() => { setMode('manuel'); setError(''); }}
                label="Manuel"
              >
                <WritingHandIcon />
              </ModeButton>
            </div>

            {failed && (
              <p className="text-sm text-[var(--om-danger)] bg-[var(--om-danger-soft)] rounded-[10px] p-3 mb-4" role="alert">
                {job.status === 'canceled' ? 'Rédaction annulée.' : job.error}
              </p>
            )}

            {mode === 'ia' ? (
              <>
                <label htmlFor="card-query" className="block text-sm font-medium text-[var(--om-text)] mb-1.5">
                  Mot, notion ou question
                </label>
                <textarea
                  id="card-query"
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setError(''); }}
                  disabled={starting}
                  rows={3}
                  placeholder="Ex. : « cartésien », « quelqu'un de très lucide et rationnel », « explique-moi cette page »…"
                  className="w-full px-3 py-2 rounded-[10px] border border-[var(--om-line)] text-[var(--om-text)] mb-2 resize-none disabled:opacity-60"
                />
                <p className="text-xs text-[var(--om-muted)] mb-4">
                  Un mot est défini, une description donne des mots à choisir, une question
                  reçoit une explication.
                </p>

                <FilePicker uploads={uploads} onChange={setUploads} disabled={starting} />

                <span className="block text-sm font-medium text-[var(--om-text)] mb-1.5">Niveau</span>
                <div className="flex flex-col gap-2 mb-4">
                  {LEVELS.map((l) => (
                    <button
                      key={l.value}
                      type="button"
                      onClick={() => setLevel(l.value)}
                      disabled={starting}
                      aria-pressed={level === l.value}
                      className={`px-3 py-2 rounded-[10px] border text-left text-sm transition-colors disabled:opacity-60 ${
                        level === l.value
                          ? 'border-[var(--om-accent)] bg-[var(--om-accent)]/10'
                          : 'border-[var(--om-line)] hover:bg-[var(--om-surface-2)]'
                      }`}
                    >
                      <span className="font-medium text-[var(--om-text)]">{l.label}</span>
                      <span className="text-[var(--om-muted)]"> — {l.hint}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <input
                  type="text"
                  placeholder="Recto (question)"
                  value={front}
                  onChange={(e) => { setFront(e.target.value); setError(''); }}
                  aria-describedby="single-front-counter"
                  className={`w-full px-3 py-2 rounded-[10px] border text-[var(--om-text)] mb-1 ${
                    frontLength.over ? 'border-[var(--om-danger)]' : 'border-[var(--om-line)]'
                  }`}
                />
                <CharCounter id="single-front-counter" state={frontLength} />
                <textarea
                  placeholder="Verso (réponse)"
                  value={back}
                  onChange={(e) => { setBack(e.target.value); setError(''); }}
                  rows={3}
                  aria-describedby="single-back-counter"
                  className={`w-full px-3 py-2 rounded-[10px] border text-[var(--om-text)] mb-1 resize-none ${
                    backLength.over ? 'border-[var(--om-danger)]' : 'border-[var(--om-line)]'
                  }`}
                />
                <CharCounter id="single-back-counter" state={backLength} />
              </>
            )}

            <ChapterSelect
              value={chapterId}
              onChange={setChapterId}
              chapters={chapters}
              disabled={starting || saving}
              id="single-card-chapter"
            />

            {error && <p className="text-sm text-[var(--om-danger)] mb-3" role="alert">{error}</p>}

            <div className="flex gap-2">
              {mode === 'ia' ? (
                <button
                  type="button"
                  onClick={handleStart}
                  disabled={starting || !query.trim()}
                  className="px-4 py-2 rounded-2xl bg-[var(--om-accent)] text-[var(--om-on-accent)] text-sm font-medium hover:bg-[var(--om-accent-hover)] disabled:opacity-60"
                >
                  {starting ? 'Lancement…' : 'Générer'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCreateManual}
                  disabled={saving || !front.trim() || !back.trim()}
                  className="px-4 py-2 rounded-2xl bg-[var(--om-accent)] text-[var(--om-on-accent)] text-sm font-medium hover:bg-[var(--om-accent-hover)] disabled:opacity-60"
                >
                  {saving ? 'Ajout…' : 'Ajouter'}
                </button>
              )}
              <button
                type="button"
                onClick={handleClose}
                disabled={starting || saving}
                className="px-4 py-2 rounded-2xl border border-[var(--om-line)] text-[var(--om-muted)] text-sm font-medium hover:bg-[var(--om-surface-2)] disabled:opacity-60"
              >
                Annuler
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default GenerateCardModal;
