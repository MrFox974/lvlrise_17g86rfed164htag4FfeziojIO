import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useLoaderData, useRevalidator } from 'react-router-dom';
import Timer from '../../../components/Timer';
import CalendarGauges from '../../../components/CalendarGauges';
import {
  recordLearningTime,
  fetchDomains,
  createDomain,
  updateDomain,
  deleteDomain,
  DAYS,
  DAY_LABELS,
} from '../../../utils/domainApi';
import {
  recordDemoLearningTime,
  fetchDemoDomains,
  createDemoDomain,
  updateDemoDomain,
  deleteDemoDomain,
} from '../../../utils/demoApi';
import { useDemoMode } from '../../../hooks/useDemoMode';
import { useUpgradeModal, isPlanLimitError } from '../../../hooks/useUpgradeModal';
import UpgradeModal from '../../../components/UpgradeModal';
import { Celebration, CelebrationLive } from '../../../components/Celebration';
import { useCelebration } from '../../../hooks/useCelebration';

const MINUTES_PER_SESSION = 5;
// Fenêtre pendant laquelle on ne remplace pas une jauge par les données serveur (évite rollback si réponse lente)
const PENDING_UPDATE_MS = 6000;
const REVALIDATE_DELAY_MS = 2000; // Revalidation après écriture pour laisser BDD + réseau à jour
const MAX_DOMAINS = { perso: 5, pro: 3 };
const DEFAULT_NEW_MINUTES = 30;

function getTodayDateStr() {
  return new Date().toISOString().slice(0, 10);
}

function formatMinutes(minutes) {
  const total = Math.max(0, Math.round(minutes || 0));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h > 0 && m > 0) return `${h}h${String(m).padStart(2, '0')}`;
  if (h > 0) return `${h}h`;
  return `${m} min`;
}

/** Grille des sept jours : le même contrôle sert à créer et à modifier une jauge. */
function WeekMinutesFields({ minutes, onChange, disabled }) {
  const [draft, setDraft] = useState({});

  const valueFor = (day) => (draft[day] !== undefined ? draft[day] : String(minutes[day] ?? 0));

  const commit = (day) => {
    const raw = draft[day] !== undefined ? draft[day] : String(minutes[day] ?? 0);
    const parsed = raw === '' ? 0 : parseInt(raw, 10);
    const clamped = Number.isNaN(parsed) || parsed < 0 ? 0 : Math.min(1440, parsed);
    setDraft((prev) => {
      const next = { ...prev };
      delete next[day];
      return next;
    });
    if (clamped !== (minutes[day] ?? 0)) onChange({ ...minutes, [day]: clamped });
  };

  const applyToAll = () => {
    const reference = minutes[DAYS[0]] ?? 0;
    onChange(Object.fromEntries(DAYS.map((d) => [d, reference])));
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <span className="om-label">Minutes par jour</span>
        <button
          type="button"
          onClick={applyToAll}
          disabled={disabled}
          className="text-[11px] text-[var(--om-accent)] hover:underline disabled:opacity-50"
        >
          Appliquer lundi partout
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {DAYS.map((day) => (
          <label key={day} className="flex flex-col gap-1">
            <span className="text-[11px] text-[var(--om-muted)]">{DAY_LABELS[day]}</span>
            <input
              type="number"
              min="0"
              max="1440"
              inputMode="numeric"
              value={valueFor(day)}
              onChange={(e) => setDraft((prev) => ({ ...prev, [day]: e.target.value }))}
              onBlur={() => commit(day)}
              disabled={disabled}
              className="om-input tabular-nums px-2.5 py-2 text-[13px] disabled:opacity-50"
            />
          </label>
        ))}
      </div>
    </div>
  );
}

/**
 * Contrôle d'une jauge, en deux vues.
 *  · minutes  : le geste courant, −5 / +5 sur la journée.
 *  · réglages : l'objectif des sept jours, et la suppression.
 * On ferme en cliquant à côté : pas de bouton de validation pour les minutes,
 * qui sont enregistrées à chaque pas.
 */
function DomainGaugeModal({
  domain,
  tone,
  onClose,
  onMinutesChange,
  onScheduleSave,
  onDelete,
  loadSchedule,
  celebration,
}) {
  const [view, setView] = useState('minutes');
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const openSchedule = useCallback(async () => {
    setView('schedule');
    setError('');
    if (schedule) return;
    setLoading(true);
    try {
      setSchedule(await loadSchedule(domain.id));
    } catch {
      setError("Impossible de charger les objectifs de la semaine.");
    } finally {
      setLoading(false);
    }
  }, [schedule, loadSchedule, domain.id]);

  const handleSave = useCallback(async () => {
    if (!schedule) return;
    setSaving(true);
    setError('');
    try {
      await onScheduleSave(domain, schedule);
      onClose();
    } catch {
      setError("L'enregistrement a échoué.");
      setSaving(false);
    }
  }, [schedule, onScheduleSave, domain, onClose]);

  const handleDelete = useCallback(async () => {
    setSaving(true);
    setError('');
    try {
      await onDelete(domain);
      onClose();
    } catch {
      setError('La suppression a échoué.');
      setSaving(false);
    }
  }, [onDelete, domain, onClose]);

  const expectedMinutes = domain.expectedMinutes ?? 0;
  const actualMinutes = domain.actualMinutes ?? 0;
  const noLearning = expectedMinutes === 0;
  const pct = expectedMinutes > 0 ? Math.min(100, (actualMinutes / expectedMinutes) * 100) : 0;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-6"
      role="dialog"
      aria-modal="true"
      aria-label={domain.name}
    >
      <div
        className="om-scrim fixed inset-0"
        onClick={onClose}
        onKeyDown={(e) => e.key === 'Enter' && onClose()}
        role="button"
        tabIndex={-1}
        aria-label="Fermer"
      />
      <div
        className="om-card relative z-10 w-full max-w-[330px] p-[18px] animate-om-pop overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {view === 'minutes' && <Celebration celebration={celebration} compact />}
        {view === 'minutes' ? (
          <div className="flex flex-col gap-[18px]">
            <div className="flex items-start gap-2.5">
              <div className="flex-1 min-w-0 flex flex-col gap-1">
                <span className="om-kicker">Minutes du jour</span>
                <span className="text-[19px] font-medium tracking-[-0.01em] text-[var(--om-text)] truncate">
                  {domain.name}
                </span>
              </div>
              <button
                type="button"
                onClick={openSchedule}
                className="om-icon-btn w-8 h-8 border border-[var(--om-line)] bg-transparent text-[var(--om-muted)] hover:text-[var(--om-text)] flex-shrink-0"
                title="Réglages de la jauge"
                aria-label="Réglages de la jauge"
              >
                <i className="ph ph-gear-six text-[16px]" aria-hidden />
              </button>
            </div>

            {noLearning ? (
              <p className="text-sm text-[var(--om-muted)]">
                Aucun objectif aujourd&apos;hui pour ce domaine. Ouvrez les réglages pour en fixer un.
              </p>
            ) : (
              <>
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-baseline justify-center gap-1.5">
                    <span className="om-metric text-[38px] text-[var(--om-text)]">{actualMinutes}</span>
                    <span className="text-sm text-[var(--om-muted)]">/ {expectedMinutes} min</span>
                  </div>
                  <div className="om-track h-2">
                    <div className="om-fill" style={{ width: `${pct}%`, background: tone }} />
                  </div>
                </div>

                <div className="flex items-center justify-center gap-4">
                  <button
                    type="button"
                    onClick={() =>
                      onMinutesChange(domain, Math.max(0, actualMinutes - MINUTES_PER_SESSION))
                    }
                    disabled={actualMinutes <= 0}
                    className="om-icon-btn w-[46px] h-[46px] text-[22px] border border-[var(--om-line)] bg-transparent disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label="Retirer 5 minutes"
                  >
                    −
                  </button>
                  <span className="text-xs text-[var(--om-muted)] w-14 text-center">
                    par pas de 5 min
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      onMinutesChange(
                        domain,
                        Math.min(expectedMinutes, actualMinutes + MINUTES_PER_SESSION)
                      )
                    }
                    disabled={actualMinutes >= expectedMinutes}
                    className="om-icon-btn w-[46px] h-[46px] text-[22px] border border-[var(--om-accent)] disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: 'var(--om-accent-soft)', color: 'var(--om-text)' }}
                    aria-label="Ajouter 5 minutes"
                  >
                    +
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3.5">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setView('minutes');
                  setConfirmDelete(false);
                }}
                className="om-icon-btn w-[30px] h-[30px] flex-shrink-0"
                aria-label="Retour aux minutes"
              >
                <i className="ph ph-arrow-left text-[15px]" aria-hidden />
              </button>
              <div className="flex-1 min-w-0 flex flex-col">
                <span className="om-kicker">Objectif par jour</span>
                <span className="text-base font-medium text-[var(--om-text)] truncate">
                  {domain.name}
                </span>
              </div>
            </div>

            {loading && <p className="text-sm text-[var(--om-muted)]">Chargement…</p>}

            {!loading && schedule && (
              <WeekMinutesFields minutes={schedule} onChange={setSchedule} disabled={saving} />
            )}

            {error && <p className="text-sm text-[var(--om-danger)]">{error}</p>}

            {!loading && schedule && (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="om-btn om-btn-primary w-full"
              >
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            )}

            <div className="om-sep pt-3.5">
              {confirmDelete ? (
                <div className="flex flex-col gap-2.5">
                  <p className="text-sm text-[var(--om-text)]">
                    Supprimer « {domain.name} » ? Son historique de minutes sera perdu.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      disabled={saving}
                      className="om-btn om-btn-ghost flex-1"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={saving}
                      className="om-btn om-btn-danger flex-1"
                    >
                      {saving ? 'Suppression…' : 'Supprimer'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-2 text-sm text-[var(--om-danger)] hover:underline"
                >
                  <i className="ph ph-trash text-[16px]" aria-hidden />
                  Supprimer la jauge
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Création d'une jauge : nom, puis l'objectif des sept jours. */
function CreateGaugeModal({ type, onClose, onCreate }) {
  const [name, setName] = useState('');
  const [minutes, setMinutes] = useState(() =>
    Object.fromEntries(DAYS.map((d) => [d, DEFAULT_NEW_MINUTES]))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    setError('');
    try {
      await onCreate(trimmed, minutes, type);
      onClose();
    } catch (err) {
      setError(err?.uiMessage || "La création a échoué.");
      setSaving(false);
    }
  }, [name, minutes, type, onCreate, onClose, saving]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Nouvelle jauge"
    >
      <div
        className="om-scrim fixed inset-0"
        onClick={onClose}
        onKeyDown={(e) => e.key === 'Enter' && onClose()}
        role="button"
        tabIndex={-1}
        aria-label="Fermer"
      />
      <div
        className="om-card relative z-10 w-full max-w-[330px] p-[18px] animate-om-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-1">
            <span className="om-kicker">
              Nouvelle jauge · {type === 'pro' ? 'pro' : 'perso'}
            </span>
            <span className="text-[19px] font-medium tracking-[-0.01em] text-[var(--om-text)]">
              Que voulez-vous apprendre ?
            </span>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="om-label">Nom</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="Espagnol"
              autoFocus
              className="om-input"
            />
          </label>

          <WeekMinutesFields minutes={minutes} onChange={setMinutes} disabled={saving} />

          {error && <p className="text-sm text-[var(--om-danger)]">{error}</p>}

          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="om-btn om-btn-ghost flex-1">
              Annuler
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!name.trim() || saving}
              className="om-btn om-btn-primary flex-1"
            >
              {saving ? 'Création…' : 'Créer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Jauge tube : hauteur = objectif du jour, remplissage = minutes faites.
 * Clic sur le tube pour ajuster finement, « + » pour la session de 5 min.
 */
function DomainSingleGauge({ domain, onAdd5, onGaugeClick, tone }) {
  const expectedMinutes = domain.expectedMinutes ?? 0;
  const actualMinutes = domain.actualMinutes ?? 0;
  const noLearning = expectedMinutes === 0;
  const percent = expectedMinutes > 0 ? Math.min(100, (actualMinutes / expectedMinutes) * 100) : 0;
  const canAdd = expectedMinutes > 0 && actualMinutes < expectedMinutes;

  return (
    <div
      className={`flex flex-col items-center gap-2.5 flex-shrink-0 min-w-0 transition-opacity ${
        noLearning ? 'opacity-55' : ''
      }`}
    >
      <span className="text-xs tabular-nums text-[var(--om-muted)]">
        {actualMinutes}/{expectedMinutes}
      </span>
      <div
        role="button"
        tabIndex={0}
        aria-label={`Régler ${domain.name}`}
        onClick={() => onGaugeClick(domain)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onGaugeClick(domain);
          }
        }}
        className="relative w-[42px] sm:w-[46px] h-[200px] sm:h-[216px] rounded-full overflow-hidden flex flex-col justify-end bg-[var(--om-track)] cursor-pointer"
      >
        <div className="om-gauge-fill" style={{ height: `${percent}%`, '--gauge-tone': tone }} />
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (canAdd) onAdd5(domain);
        }}
        disabled={!canAdd}
        className="w-[38px] h-[38px] rounded-full border flex items-center justify-center text-[19px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
        style={{ borderColor: tone, color: tone, background: 'transparent' }}
        aria-label={`Ajouter ${MINUTES_PER_SESSION} minutes à ${domain.name}`}
      >
        +
      </button>
      <span
        className="text-xs font-medium max-w-[56px] text-center leading-[1.25] text-[var(--om-text)] truncate"
        title={domain.name}
      >
        {domain.name}
      </span>
    </div>
  );
}

function ApprentissageContent({ initialDomainGauges }) {
  const [domainGauges, setDomainGauges] = useState(initialDomainGauges || []);
  const [modalDomain, setModalDomain] = useState(null);
  const [createFor, setCreateFor] = useState(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const [mode, setMode] = useState('apprentissage');
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [calendarRefreshTrigger, setCalendarRefreshTrigger] = useState(0);
  const revalidator = useRevalidator();
  const isDemo = useDemoMode();
  const { showUpgradeModal, hideUpgradeModal, upgradeModalProps } = useUpgradeModal();
  const { celebration, celebrate } = useCelebration();
  const lastUpdatedRef = useRef([]);

  useEffect(() => {
    const server = initialDomainGauges || [];
    if (server.length === 0) {
      setDomainGauges([]);
      return;
    }
    const now = Date.now();
    const pending = (lastUpdatedRef.current || []).filter(
      (entry) => entry.at != null && now - entry.at < PENDING_UPDATE_MS
    );
    const pendingIds = new Set(pending.map((e) => String(e.domainId)));

    setDomainGauges((prev) =>
      server.map((s) => {
        const sId = String(s.id);
        const p = prev.find((d) => String(d.id) === sId);
        const isRecentlyUpdated = pendingIds.has(sId) && p != null;
        const actualMinutes = isRecentlyUpdated ? (p.actualMinutes ?? 0) : (s.actualMinutes ?? 0);
        const expectedMinutes = s.expectedMinutes ?? 0;
        const percent =
          expectedMinutes > 0
            ? Math.min(100, (actualMinutes / expectedMinutes) * 100)
            : actualMinutes > 0
              ? 100
              : 0;
        return { ...s, actualMinutes, percent };
      })
    );
  }, [initialDomainGauges]);

  const updateDomainMinutes = useCallback(
    async (domain, newMinutes) => {
      const expectedMinutes = domain.expectedMinutes ?? 0;
      const prevMinutes = domain.actualMinutes ?? 0;

      // On ne fête que la progression : retirer des minutes ne déclenche rien.
      const gained = newMinutes - prevMinutes;
      if (gained > 0) {
        const reached = expectedMinutes > 0 && newMinutes >= expectedMinutes;
        celebrate(reached ? `Objectif atteint · +${gained} min` : `+${gained} min`, {
          full: reached,
        });
      }

      const at = Date.now();
      lastUpdatedRef.current = [
        ...(lastUpdatedRef.current || []).filter(
          (e) => e.domainId !== domain.id && at - (e.at || 0) < PENDING_UPDATE_MS
        ),
        { domainId: domain.id, at },
      ].slice(-10);
      setDomainGauges((prev) =>
        prev.map((d) =>
          d.id === domain.id
            ? {
                ...d,
                actualMinutes: newMinutes,
                percent:
                  expectedMinutes > 0
                    ? Math.min(100, (newMinutes / expectedMinutes) * 100)
                    : newMinutes > 0
                      ? 100
                      : 0,
              }
            : d
        )
      );
      try {
        if (isDemo) {
          await recordDemoLearningTime(domain.id, getTodayDateStr(), newMinutes);
        } else {
          await recordLearningTime(domain.id, getTodayDateStr(), newMinutes);
        }
        setCalendarRefreshTrigger((t) => t + 1);
        setTimeout(() => revalidator.revalidate(), REVALIDATE_DELAY_MS);
      } catch {
        setDomainGauges((prev) =>
          prev.map((d) =>
            d.id === domain.id ? { ...d, actualMinutes: prevMinutes, percent: domain.percent } : d
          )
        );
      }
    },
    [revalidator, isDemo, celebrate]
  );

  const handleDomainAdd5 = useCallback(
    async (domain) => {
      const expectedMinutes = domain.expectedMinutes ?? 0;
      const actualMinutes = domain.actualMinutes ?? 0;
      const newMinutes =
        expectedMinutes > 0
          ? Math.min(actualMinutes + MINUTES_PER_SESSION, expectedMinutes)
          : actualMinutes + MINUTES_PER_SESSION;
      await updateDomainMinutes(domain, newMinutes);
    },
    [updateDomainMinutes]
  );

  /** Le payload des jauges ne porte pas les objectifs de la semaine : on va les chercher. */
  const loadSchedule = useCallback(
    async (domainId) => {
      const domains = await (isDemo ? fetchDemoDomains() : fetchDomains());
      const found = domains.find((d) => String(d.id) === String(domainId));
      const stored = found?.minutes_per_day || {};
      return Object.fromEntries(DAYS.map((d) => [d, stored[d] ?? 0]));
    },
    [isDemo]
  );

  const handleScheduleSave = useCallback(
    async (domain, minutes) => {
      const update = isDemo ? updateDemoDomain : updateDomain;
      await update(domain.id, { minutes_per_day: minutes });
      revalidator.revalidate();
      setCalendarRefreshTrigger((t) => t + 1);
    },
    [isDemo, revalidator]
  );

  const handleDelete = useCallback(
    async (domain) => {
      const remove = isDemo ? deleteDemoDomain : deleteDomain;
      await remove(domain.id);
      setDomainGauges((prev) => prev.filter((d) => d.id !== domain.id));
      revalidator.revalidate();
      setCalendarRefreshTrigger((t) => t + 1);
    },
    [isDemo, revalidator]
  );

  const handleCreate = useCallback(
    async (name, minutes, type) => {
      const create = isDemo ? createDemoDomain : createDomain;
      try {
        await create(name, minutes, type);
      } catch (error) {
        const limit = isPlanLimitError(error);
        if (limit) {
          showUpgradeModal(limit.restriction, limit.featureName || "domaines d'apprentissage");
          const wrapped = new Error('plan-limit');
          wrapped.uiMessage = 'Votre formule ne permet pas d’ajouter une jauge de plus.';
          throw wrapped;
        }
        throw error;
      }
      revalidator.revalidate();
      setCalendarRefreshTrigger((t) => t + 1);
    },
    [isDemo, revalidator, showUpgradeModal]
  );

  const handleTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };
  const handleTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };
  const pointerStartRef = useRef(null);

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const diff = touchStart - touchEnd;
    const threshold = 50;
    if (diff > threshold) setSlideIndex(1);
    else if (diff < -threshold) setSlideIndex(0);
  };

  const handlePointerDown = useCallback(
    (e) => {
      if (e.button !== 0) return;
      pointerStartRef.current = { x: e.clientX, slideIndex };
    },
    [slideIndex]
  );

  const handlePointerMove = useCallback((e) => {
    if (!pointerStartRef.current || e.buttons !== 1) return;
    const diff = pointerStartRef.current.x - e.clientX;
    const threshold = 50;
    if (diff > threshold) {
      setSlideIndex(1);
      pointerStartRef.current = null;
    } else if (diff < -threshold) {
      setSlideIndex(0);
      pointerStartRef.current = null;
    }
  }, []);

  const handlePointerUp = useCallback(() => {
    pointerStartRef.current = null;
  }, []);

  const domainPerso = domainGauges.filter((d) => (d.type || 'perso') === 'perso');
  const domainPro = domainGauges.filter((d) => d.type === 'pro');
  const isPerso = slideIndex === 0;
  const currentDomains = isPerso ? domainPerso : domainPro;

  const sectionTotals = useMemo(() => {
    const done = currentDomains.reduce((sum, d) => sum + (d.actualMinutes ?? 0), 0);
    const target = currentDomains.reduce((sum, d) => sum + (d.expectedMinutes ?? 0), 0);
    return { done, target };
  }, [currentDomains]);

  const renderGauges = (domains, type) => {
    const tone = type === 'pro' ? 'var(--om-pro-strong)' : 'var(--om-perso)';
    const canAdd = domains.length < MAX_DOMAINS[type];
    const isActive = type === (isPerso ? 'perso' : 'pro');
    return (
      <section className="om-card relative overflow-hidden p-5 md:p-[22px] h-full flex flex-col">
        <div className="flex items-center justify-between gap-2 mb-[18px] px-1">
          <span className="om-kicker">
            Développement {type === 'pro' ? 'pro' : 'perso'}
          </span>
          <div className="flex items-center gap-2.5">
            <span className="text-[13px] tabular-nums text-[var(--om-muted)]">
              {formatMinutes(domains.reduce((s, d) => s + (d.actualMinutes ?? 0), 0))} /{' '}
              {formatMinutes(domains.reduce((s, d) => s + (d.expectedMinutes ?? 0), 0))}
            </span>
            <button
              type="button"
              onClick={() => setCreateFor(type)}
              disabled={!canAdd}
              className="om-icon-btn om-icon-btn-accent w-[30px] h-[30px] disabled:opacity-40 disabled:cursor-not-allowed"
              title={
                canAdd
                  ? 'Ajouter une jauge'
                  : `Maximum ${MAX_DOMAINS[type]} jauges ${type === 'pro' ? 'pro' : 'perso'}`
              }
              aria-label="Ajouter une jauge"
            >
              <i className="ph ph-plus text-[15px]" aria-hidden />
            </button>
          </div>
        </div>
        {domains.length === 0 ? (
          <p className="text-sm text-[var(--om-muted)] text-center py-10">
            Aucune jauge {type === 'pro' ? 'pro' : 'perso'}. Touchez « + » pour en créer une.
          </p>
        ) : (
          <div className="overflow-x-auto no-scrollbar pb-0.5">
            {/* w-max + mx-auto : centré s'il y a la place, scrollable jusqu'au premier sinon */}
            <div className="flex flex-nowrap gap-3 sm:gap-4 w-max mx-auto">
              {domains.map((dg) => (
                <DomainSingleGauge
                  key={dg.id}
                  domain={dg}
                  onAdd5={handleDomainAdd5}
                  onGaugeClick={setModalDomain}
                  tone={tone}
                />
              ))}
            </div>
          </div>
        )}
        {/* Les deux sections coexistent dans le carrousel : la rafale ne se joue
            que dans celle qui est affichée, sinon elle est rendue en double. */}
        {isActive && <Celebration celebration={celebration} />}
      </section>
    );
  };

  const liveModalDomain = modalDomain
    ? domainGauges.find((d) => d.id === modalDomain.id) || modalDomain
    : null;

  return (
    <div className="px-4 md:px-6 lg:px-8 pt-1 pb-6 w-full max-w-5xl mx-auto box-border flex flex-col gap-3.5">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0 flex flex-col">
          <h1 className="text-[17px] md:text-[19px] font-medium tracking-[-0.01em] text-[var(--om-text)]">
            Apprentissage
          </h1>
          <span className="text-xs text-[var(--om-muted)]">
            {mode === 'timer'
              ? 'Session chronométrée'
              : `${formatMinutes(sectionTotals.done)} sur ${formatMinutes(sectionTotals.target)} aujourd'hui`}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setMode('apprentissage')}
          aria-pressed={mode === 'apprentissage'}
          aria-label="Mode apprentissage"
          className="w-[38px] h-[38px] rounded-full border border-[var(--om-line)] flex items-center justify-center transition-colors"
          style={
            mode === 'apprentissage'
              ? {
                  background: 'var(--om-accent-soft)',
                  borderColor: 'var(--om-accent)',
                  color: 'var(--om-text)',
                }
              : { color: 'var(--om-muted)' }
          }
        >
          <i className="ph ph-faders text-[19px]" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => setMode('timer')}
          aria-pressed={mode === 'timer'}
          aria-label="Mode timer"
          className="w-[38px] h-[38px] rounded-full border border-[var(--om-line)] flex items-center justify-center transition-colors"
          style={
            mode === 'timer'
              ? {
                  background: 'var(--om-accent-soft)',
                  borderColor: 'var(--om-accent)',
                  color: 'var(--om-text)',
                }
              : { color: 'var(--om-muted)' }
          }
        >
          <i className="ph ph-timer text-[19px]" aria-hidden />
        </button>
      </div>

      {mode === 'apprentissage' && (
        <div className="om-segment" role="tablist" aria-label="Choisir Perso ou Pro">
          <button
            type="button"
            role="tab"
            aria-selected={isPerso}
            onClick={() => setSlideIndex(0)}
            className="om-segment-item flex-1"
            data-active={isPerso}
          >
            Perso
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={!isPerso}
            onClick={() => setSlideIndex(1)}
            className="om-segment-item flex-1"
            data-active={!isPerso}
          >
            Pro
          </button>
        </div>
      )}

      {mode === 'timer' ? (
        <section className="om-card p-5 md:p-[22px]">
          <Timer />
        </section>
      ) : (
        <div className="flex flex-col md:flex-row md:items-stretch md:gap-4 w-full">
          <div
            className="flex-[1_1_55%] min-w-0 w-full overflow-hidden select-none cursor-grab active:cursor-grabbing md:flex md:flex-col"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            <div
              className="flex transition-transform duration-500 ease-out md:min-h-full"
              style={{ transform: `translateX(-${slideIndex * 50}%)`, width: '200%' }}
            >
              <div className="flex-[0_0_50%] w-[50%] pr-1.5 box-border md:flex md:flex-col">
                {renderGauges(domainPerso, 'perso')}
              </div>
              <div className="flex-[0_0_50%] w-[50%] pl-1.5 box-border md:flex md:flex-col">
                {renderGauges(domainPro, 'pro')}
              </div>
            </div>
          </div>

          <div className="flex-[0_0_auto] md:min-w-[300px] lg:min-w-[320px] mt-3.5 md:mt-0 md:sticky md:top-20 flex flex-col">
            <CalendarGauges
              slideIndex={slideIndex}
              domainGauges={domainGauges}
              refreshTrigger={calendarRefreshTrigger}
            />
          </div>
        </div>
      )}

      {liveModalDomain && (
        <DomainGaugeModal
          domain={liveModalDomain}
          tone={
            liveModalDomain.type === 'pro' ? 'var(--om-pro-strong)' : 'var(--om-accent)'
          }
          onClose={() => setModalDomain(null)}
          onMinutesChange={updateDomainMinutes}
          onScheduleSave={handleScheduleSave}
          onDelete={handleDelete}
          loadSchedule={loadSchedule}
          celebration={celebration}
        />
      )}

      {createFor && (
        <CreateGaugeModal
          type={createFor}
          onClose={() => setCreateFor(null)}
          onCreate={handleCreate}
        />
      )}

      <CelebrationLive celebration={celebration} />

      <UpgradeModal
        isOpen={upgradeModalProps.isOpen}
        onClose={hideUpgradeModal}
        restriction={upgradeModalProps.restriction}
        featureName={upgradeModalProps.featureName}
      />
    </div>
  );
}

function Apprentissage() {
  const { domainGauges } = useLoaderData();

  return <ApprentissageContent initialDomainGauges={domainGauges} />;
}

export default Apprentissage;
