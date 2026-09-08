import { useState, useCallback, useEffect, useRef } from 'react';
import {
  startDeckGeneration,
  startDeckCardsGeneration,
  fetchGenerationJob,
  fetchGenerationJobs,
  cancelGenerationJob,
} from '../../utils/flashcardApi';
import FilePicker from '../FilePicker';
import ChapterSelect from './ChapterSelect';

const LEVELS = [
  { value: 'debutant', label: 'Débutant', hint: 'notions de base, vocabulaire' },
  { value: 'intermediaire', label: 'Intermédiaire', hint: 'mécanismes, cas concrets' },
  { value: 'avance', label: 'Avancé', hint: 'subtilités, cas limites' },
];

const CARD_COUNTS = [10, 20, 30, 50];
const POLL_INTERVAL_MS = 3000;

/**
 * Génération d'une collection, exécutée côté serveur.
 *
 * L'application ne fait que lancer le travail puis interroger son avancement :
 * l'utilisateur peut fermer la fenêtre, quitter l'application ou éteindre son
 * téléphone, la génération se poursuit et une notification push l'avertit.
 * À la réouverture, une génération encore en cours est retrouvée
 * automatiquement et le suivi reprend là où il en était.
 *
 * La même fenêtre sert à ajouter des cartes à une collection existante :
 * `targetDeck` renseigné, le sujet proposé par défaut est celui qui a servi à
 * créer la collection, et les cartes viennent s'y ajouter. Elles peuvent alors
 * être rangées dans des groupes déduits du sujet, hors groupe, ou dans un
 * groupe précis.
 *
 * Pour une carte isolée — un mot à définir, une notion à expliquer — c'est
 * GenerateCardModal qu'il faut, pas celle-ci.
 *
 * @param {{id: number|string, name: string}} [targetDeck] collection à compléter
 * @param {string} [defaultSubject] sujet pré-rempli
 * @param {Array<{id: number|string, title: string}>} [chapters] groupes existants
 */
function GenerateDeckModal({
  isOpen,
  onClose,
  onGenerated,
  targetDeck = null,
  defaultSubject = '',
  chapters = [],
}) {
  const [subject, setSubject] = useState(defaultSubject);
  const [cardCount, setCardCount] = useState(20);
  const [level, setLevel] = useState('intermediaire');
  const [chapterId, setChapterId] = useState('auto');
  const [uploads, setUploads] = useState([]);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [job, setJob] = useState(null);
  const [capped, setCapped] = useState(null);
  const pollRef = useRef(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Suivi d'une génération : on interroge le serveur jusqu'à un état terminal.
  const trackJob = useCallback((jobId) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const fresh = await fetchGenerationJob(jobId);
        setJob(fresh);
        if (['ready', 'error', 'canceled'].includes(fresh.status)) stopPolling();
      } catch {
        // Perte de réseau : on retentera au prochain battement plutôt que
        // d'abandonner un travail qui, lui, continue côté serveur.
      }
    }, POLL_INTERVAL_MS);
  }, [stopPolling]);

  // Sujet proposé par défaut : celui de la création de la collection. Il arrive
  // après l'ouverture (il est lu côté serveur), et ne doit pas écraser ce que
  // l'utilisateur a déjà tapé.
  const subjectEdited = useRef(false);
  useEffect(() => {
    if (!isOpen) {
      subjectEdited.current = false;
      return;
    }
    if (!subjectEdited.current) setSubject(defaultSubject || '');
  }, [isOpen, defaultSubject]);

  // À l'ouverture, on récupère une génération éventuellement laissée en cours.
  useEffect(() => {
    if (!isOpen) return undefined;
    let canceled = false;
    fetchGenerationJobs().then((jobs) => {
      if (canceled) return;
      const running = jobs.find((j) => {
        if (j.status !== 'queued' && j.status !== 'running') return false;
        // Une carte à l'unité se suit dans sa propre fenêtre.
        if (j.mode === 'single') return false;
        // Une génération qui vise une autre collection que celle affichée ne
        // regarde pas cette fenêtre — et une création de collection porte elle
        // aussi un deck_id une fois son plan établi, d'où le drapeau.
        const isAppend = Boolean(j.stats?.append);
        return targetDeck
          ? isAppend && String(j.deck_id) === String(targetDeck.id)
          : !isAppend;
      });
      if (running) {
        setJob(running);
        trackJob(running.id);
      }
    });
    return () => { canceled = true; };
  }, [isOpen, trackJob, targetDeck]);

  useEffect(() => stopPolling, [stopPolling]);

  const reset = useCallback(() => {
    subjectEdited.current = false;
    setSubject(defaultSubject || '');
    setCardCount(20);
    setLevel('intermediaire');
    setChapterId('auto');
    setUploads([]);
    setError('');
    setJob(null);
    setCapped(null);
    stopPolling();
  }, [stopPolling, defaultSubject]);

  const handleClose = useCallback(() => {
    // La fenêtre se ferme même pendant une génération : le travail continue.
    stopPolling();
    onClose();
  }, [onClose, stopPolling]);

  const handleStart = useCallback(async () => {
    if (!subject.trim() || starting) return;
    setStarting(true);
    setError('');
    try {
      const params = {
        subject: subject.trim(),
        cardCount,
        level,
        uploadIds: uploads.map((u) => u.id),
        chapterId,
      };
      const data = targetDeck
        ? await startDeckCardsGeneration(targetDeck.id, params)
        : await startDeckGeneration(params);
      setCapped(data.capped);
      setJob(data.job);
      trackJob(data.job.id);
    } catch (err) {
      // 409 : une génération tourne déjà. On ne bascule sur son suivi que si
      // c'est bien celle de cette fenêtre ; sinon on se contente de le dire.
      const other = err.response?.data?.job;
      const sameKind = other
        && Boolean(other.stats?.append) === Boolean(targetDeck)
        && (!targetDeck || String(other.deck_id) === String(targetDeck.id));
      const existing = sameKind ? other : null;
      if (existing) {
        setJob(existing);
        trackJob(existing.id);
      } else {
        setError(err.response?.data?.error || 'Le lancement a échoué. Réessayez.');
      }
    } finally {
      setStarting(false);
    }
  }, [subject, cardCount, level, chapterId, uploads, starting, trackJob, targetDeck]);

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

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="om-scrim" onClick={handleClose} />
      <div className="relative z-10 om-card shadow-[var(--om-shadow-lg)] p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        {finished ? (
          <>
            <h3 className="text-lg font-medium text-[var(--om-text)] mb-1">
              {targetDeck ? 'Cartes ajoutées' : 'Collection créée'}
            </h3>
            <p className="text-sm text-[var(--om-muted)] mb-4">
              {job.cards_created} carte{job.cards_created > 1 ? 's' : ''} générée
              {job.cards_created > 1 ? 's' : ''}
              {targetDeck ? ` dans « ${targetDeck.name} »` : ''}.
            </p>

            {(job.stats?.failedGroups?.length > 0 || capped) && (
              <div className="text-xs text-[var(--om-muted)] bg-[var(--om-surface-2)] rounded-[10px] p-3 mb-4 space-y-1">
                {capped && (
                  <p>{capped.generated} cartes sur les {capped.asked} demandées : limite de votre plan atteinte.</p>
                )}
                {job.stats?.failedGroups?.length > 0 && (
                  <p>Groupe(s) non généré(s) : {job.stats.failedGroups.join(', ')}.</p>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { const id = job.deck_id; reset(); onGenerated(id); }}
                className="px-4 py-2 rounded-2xl bg-[var(--om-accent)] text-[var(--om-on-accent)] text-sm font-medium hover:bg-[var(--om-accent-hover)]"
              >
                {targetDeck ? 'Voir les cartes' : 'Ouvrir la collection'}
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
            <h3 className="text-lg font-medium text-[var(--om-text)] mb-1">
              {targetDeck ? 'Cartes en cours de rédaction' : 'Génération en cours'}
            </h3>
            <p className="text-sm text-[var(--om-muted)] mb-4">« {job.subject} »</p>

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
              Vous pouvez fermer cette fenêtre et même quitter l&apos;application : la
              génération se termine sur le serveur et vous recevrez une notification.
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
            <h3 className="text-lg font-medium text-[var(--om-text)] mb-1">
              {targetDeck ? 'Nouvelles cartes' : 'Générer une collection'}
            </h3>
            <p className="text-sm text-[var(--om-muted)] mb-4">
              {targetDeck
                ? `Des cartes en plus dans « ${targetDeck.name} ». Le sujet de la collection est repris : ajustez-le pour cibler autre chose.`
                : 'Décrivez un sujet, ou joignez vos propres documents.'}
            </p>

            {failed && (
              <p className="text-sm text-[var(--om-danger)] bg-[var(--om-danger-soft)] rounded-[10px] p-3 mb-4" role="alert">
                {job.status === 'canceled' ? 'Génération annulée.' : job.error}
              </p>
            )}

            <label htmlFor="gen-subject" className="block text-sm font-medium text-[var(--om-text)] mb-1.5">
              Sujet
            </label>
            <textarea
              id="gen-subject"
              value={subject}
              onChange={(e) => {
                subjectEdited.current = true;
                setSubject(e.target.value);
                setError('');
              }}
              disabled={starting}
              rows={3}
              placeholder="Ex. : les temps du passé en espagnol, le cycle de Krebs, mon cours de la semaine…"
              className="w-full px-3 py-2 rounded-[10px] border border-[var(--om-line)] text-[var(--om-text)] mb-4 resize-none disabled:opacity-60"
            />

            <FilePicker uploads={uploads} onChange={setUploads} disabled={starting} />

            <span className="block text-sm font-medium text-[var(--om-text)] mb-1.5">Nombre de cartes</span>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {CARD_COUNTS.map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setCardCount(count)}
                  disabled={starting}
                  aria-pressed={cardCount === count}
                  className={`py-2 rounded-[10px] border text-sm font-medium transition-colors disabled:opacity-60 ${
                    cardCount === count
                      ? 'border-[var(--om-accent)] bg-[var(--om-accent)]/10 text-[var(--om-accent)]'
                      : 'border-[var(--om-line)] text-[var(--om-muted)] hover:bg-[var(--om-surface-2)]'
                  }`}
                >
                  {count}
                </button>
              ))}
            </div>
            {uploads.length > 0 && (
              // Cas typique : une liste de vocabulaire de 35 entrées avec 20
              // cartes demandées en produirait 20 et laisserait le reste.
              <p className="text-xs text-[var(--om-muted)] -mt-2 mb-4">
                Si vos documents sont une liste de termes, choisissez un nombre au moins
                égal au nombre d&apos;entrées : les cartes sont plafonnées à ce chiffre.
              </p>
            )}

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

            {/* Ranger les cartes n'a de sens que dans une collection qui existe
                déjà : à la création, les groupes naissent avec elle. */}
            {targetDeck && (
              <ChapterSelect
                value={chapterId}
                onChange={setChapterId}
                chapters={chapters}
                disabled={starting}
                allowAuto
                id="gen-deck-chapter"
              />
            )}

            {error && <p className="text-sm text-[var(--om-danger)] mb-3" role="alert">{error}</p>}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleStart}
                disabled={starting || !subject.trim()}
                className="px-4 py-2 rounded-2xl bg-[var(--om-accent)] text-[var(--om-on-accent)] text-sm font-medium hover:bg-[var(--om-accent-hover)] disabled:opacity-60"
              >
                {starting ? 'Lancement…' : 'Générer'}
              </button>
              <button
                type="button"
                onClick={handleClose}
                disabled={starting}
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

export default GenerateDeckModal;
