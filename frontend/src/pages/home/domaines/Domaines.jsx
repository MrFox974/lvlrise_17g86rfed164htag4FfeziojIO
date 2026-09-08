import { useState, useCallback, useEffect } from 'react';
import { useLoaderData, useRevalidator } from 'react-router-dom';
import { useDemoMode } from '../../../hooks/useDemoMode';
import DemoBlockModal from '../../../components/DemoBlockModal';
import {
  DndContext,
  closestCenter,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  fetchDomains,
  createDomain,
  updateDomain,
  deleteDomain,
  reorderDomains,
  DAY_LABELS,
  DAYS,
  DEFAULT_MINUTES,
} from '../../../utils/domainApi';
import {
  fetchDemoDomains,
  createDemoDomain,
  updateDemoDomain,
  deleteDemoDomain,
  reorderDemoDomains,
} from '../../../utils/demoApi';

function DomainMinutesForm({ minutes, onChange, disabled }) {
  const [displayByDay, setDisplayByDay] = useState({});

  const getValue = useCallback(
    (day) => {
      if (displayByDay[day] !== undefined) return displayByDay[day];
      return String(minutes[day] ?? 0);
    },
    [minutes, displayByDay]
  );

  const handleChange = useCallback((day, raw) => {
    setDisplayByDay((prev) => ({ ...prev, [day]: raw }));
  }, []);

  const handleBlur = useCallback(
    (day) => {
      const raw = displayByDay[day] !== undefined ? displayByDay[day] : String(minutes[day] ?? 0);
      const val = raw === '' ? 0 : parseInt(raw, 10);
      const clamped = Number.isNaN(val) || val < 0 ? 0 : Math.min(1440, val);
      setDisplayByDay((prev) => {
        const next = { ...prev };
        delete next[day];
        return next;
      });
      if (clamped !== (minutes[day] ?? 0)) {
        onChange({ ...minutes, [day]: clamped });
      }
    },
    [minutes, onChange, displayByDay]
  );

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {DAYS.map((day) => (
        <div key={day} className="flex flex-col gap-0.5">
          <label className="text-xs text-[var(--om-muted)]">
            {DAY_LABELS[day]}
          </label>
          <input
            type="number"
            min="0"
            max="1440"
            value={getValue(day)}
            onChange={(e) => handleChange(day, e.target.value)}
            onBlur={() => handleBlur(day)}
            disabled={disabled}
            className="w-full px-2 py-1.5 rounded-[10px] border border-[var(--om-line)] text-sm text-[var(--om-text)] bg-[var(--om-surface)] disabled:bg-[var(--om-surface-2)] disabled:cursor-not-allowed"
          />
        </div>
      ))}
    </div>
  );
}

function DomainMinutesDisplay({ minutes }) {
  return (
    <>
      <div className="grid grid-cols-4 gap-2 mb-1.5">
        {DAYS.slice(0, 4).map((day) => (
          <div
            key={day}
            className="flex flex-col gap-0.5 px-2 py-1.5 rounded-2xl bg-[var(--om-accent)]/5 border border-[var(--om-accent)]/30"
          >
            <span className="text-xs font-medium text-[var(--om-accent)]">
              {DAY_LABELS[day]}
            </span>
            <span className="text-sm font-medium text-[var(--om-text)]">
              {(minutes[day] ?? 0)} min
            </span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {DAYS.slice(4).map((day) => (
          <div
            key={day}
            className="flex flex-col gap-0.5 px-2 py-1.5 rounded-2xl bg-[var(--om-accent)]/5 border border-[var(--om-accent)]/30"
          >
            <span className="text-xs font-medium text-[var(--om-accent)]">
              {DAY_LABELS[day]}
            </span>
            <span className="text-sm font-medium text-[var(--om-text)]">
              {(minutes[day] ?? 0)} min
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

/**
 * Carte domaine enveloppée pour le drag-and-drop (useSortable).
 */
function SortableDomainCard({ domain, onUpdate, onDelete, isDemo }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: domain.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? 'opacity-50' : ''}>
      <DomainCard
        domain={domain}
        onUpdate={onUpdate}
        onDelete={onDelete}
        dragHandleProps={{ ...attributes, ...listeners }}
        isDemo={isDemo}
      />
    </div>
  );
}

function DomainCard({ domain, onUpdate, onDelete, dragHandleProps, isDemo }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(domain.name);
  const [editType, setEditType] = useState(domain.type || 'perso');
  const [editMinutes, setEditMinutes] = useState(domain.minutes_per_day || DEFAULT_MINUTES);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = useCallback(async () => {
    if (!editName.trim()) {
      setError('Le nom ne peut pas être vide');
      return;
    }
    setLoading(true);
    setError('');
    try {
      if (isDemo) {
        await updateDemoDomain(domain.id, {
          name: editName.trim(),
          type: editType,
          minutes_per_day: editMinutes,
        });
      } else {
        await updateDomain(domain.id, {
          name: editName.trim(),
          type: editType,
          minutes_per_day: editMinutes,
        });
      }
      onUpdate();
      setIsEditing(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la modification');
    } finally {
      setLoading(false);
    }
  }, [domain.id, editName, editType, editMinutes, onUpdate, isDemo]);

  const handleDelete = useCallback(async () => {
    if (!window.confirm(`Supprimer le domaine « ${domain.name } » ?`)) return;
    setLoading(true);
    setError('');
    try {
      if (isDemo) {
        await deleteDemoDomain(domain.id);
      } else {
        await deleteDomain(domain.id);
      }
      onDelete();
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la suppression');
    } finally {
      setLoading(false);
    }
  }, [domain.id, domain.name, onDelete, isDemo]);

  const currentMinutes = isEditing ? editMinutes : (domain.minutes_per_day || DEFAULT_MINUTES);
  const totalMinutes = DAYS.reduce((acc, d) => acc + (currentMinutes[d] || 0), 0);

  return (
    <div className="rounded-2xl md:rounded-[10px] border border-[var(--om-line)] bg-[var(--om-surface)] p-5 md:p-5 shadow-[var(--om-shadow)] h-full">
      <div className="flex items-center justify-between gap-3.5 md:gap-2.5 mb-2.5 md:mb-2.5">
        {dragHandleProps && !isEditing && (
          <button
            type="button"
            className="flex-shrink-0 p-1.5 rounded-[10px] text-[var(--om-muted)] hover:bg-[var(--om-surface-2)] cursor-grab active:cursor-grabbing touch-none"
            aria-label="Réordonner"
            {...dragHandleProps}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 6h2v2H8V6zm0 5h2v2H8v-2zm0 5h2v2H8v-2zm5-10h2v2h-2V6zm0 5h2v2h-2v-2zm0 5h2v2h-2v-2z" />
            </svg>
          </button>
        )}
        {isEditing ? (
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="Nom du domaine"
            className="flex-1 min-w-0 px-3 py-2 rounded-2xl border border-[var(--om-line)] text-[var(--om-text)] font-medium"
            autoFocus
          />
        ) : (
          <h3 className="text-base md:text-[1.05rem] font-medium text-[var(--om-text)] truncate">
            {domain.name}
          </h3>
        )}
        <div className="flex gap-2 flex-shrink-0">
          {isEditing ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setEditName(domain.name);
                  setEditType(domain.type || 'perso');
                  setEditMinutes(domain.minutes_per_day || DEFAULT_MINUTES);
                  setError('');
                }}
                className="px-3 py-1.5 rounded-[10px] text-sm text-[var(--om-muted)] hover:bg-[var(--om-surface-2)] transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={loading}
                className="px-3 py-1.5 rounded-[10px] text-sm font-medium bg-[var(--om-accent)] text-[var(--om-on-accent)] hover:bg-[var(--om-accent-hover)] disabled:opacity-50 transition-colors"
              >
                {loading ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                aria-label="Modifier"
                className="w-9 h-9 rounded-[10px] flex items-center justify-center text-[var(--om-muted)] hover:bg-[var(--om-accent)]/10 hover:text-[var(--om-accent)] transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                aria-label="Supprimer"
                className="w-9 h-9 rounded-[10px] flex items-center justify-center text-[var(--om-danger)] hover:bg-[var(--om-danger-soft)] transition-colors disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      <div>
        {isEditing && (
          <div className="mb-3">
            <p className="text-xs font-medium text-[var(--om-muted)] mb-1.5">
              Type
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditType('perso')}
                className={`px-3 py-1.5 rounded-[10px] text-sm font-medium transition-colors ${
                  editType === 'perso'
                    ? 'bg-[var(--om-accent)] text-[var(--om-on-accent)]'
                    : 'bg-[var(--om-surface-2)] text-[var(--om-muted)] hover:bg-[var(--om-line)]'
                }`}
              >
                Perso
              </button>
              <button
                type="button"
                onClick={() => setEditType('pro')}
                className={`px-3 py-1.5 rounded-[10px] text-sm font-medium transition-colors ${
                  editType === 'pro'
                    ? 'bg-[var(--om-pro-strong)] text-[var(--om-on-accent)]'
                    : 'bg-[var(--om-surface-2)] text-[var(--om-muted)] hover:bg-[var(--om-line)]'
                }`}
              >
                Pro
              </button>
            </div>
          </div>
        )}
        <p className="text-xs font-medium text-[var(--om-muted)] mb-1.5">
          Minutes de travail par jour
        </p>
        {isEditing ? (
          <DomainMinutesForm
            minutes={editMinutes}
            onChange={setEditMinutes}
            disabled={false}
          />
        ) : (
          <DomainMinutesDisplay minutes={currentMinutes} />
        )}
        <p className="text-xs text-[var(--om-muted)] mt-3">
          Total hebdomadaire : {totalMinutes} min
        </p>
      </div>

      {error && (
        <p className="text-sm text-[var(--om-danger)] mt-3">{error}</p>
      )}
    </div>
  );
}

const MAX_DOMAINS_PERSO = 5;
const MAX_DOMAINS_PRO = 3;

function AddDomainModal({ isOpen, onClose, mode, onAdded, isDemo }) {
  const [name, setName] = useState('');
  const [minutes, setMinutes] = useState({ ...DEFAULT_MINUTES });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (!name.trim()) {
        setError('Le nom du domaine est requis');
        return;
      }
      setLoading(true);
      setError('');
      try {
        const created = isDemo
          ? await createDemoDomain(name.trim(), minutes, mode)
          : await createDomain(name.trim(), minutes, mode);
        onAdded(created);
        setName('');
        setMinutes({ ...DEFAULT_MINUTES });
        onClose();
      } catch (err) {
        setError(err.response?.data?.error || err.response?.data?.details || 'Erreur lors de la création');
      } finally {
        setLoading(false);
      }
    },
    [name, minutes, mode, onAdded, onClose, isDemo]
  );

  const handleClose = useCallback(() => {
    setName('');
    setMinutes({ ...DEFAULT_MINUTES });
    setError('');
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) handleClose();
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="om-scrim"
        onClick={handleBackdrop}
      />
      <div
        className="relative z-10 om-card shadow-[var(--om-shadow-lg)] p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-medium text-[var(--om-text)] mb-5">
          Ajouter un domaine
        </h3>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="domain-name-modal" className="block text-base font-medium text-[var(--om-text)] mb-2.5">
              Nom du domaine
            </label>
            <input
              id="domain-name-modal"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex. Réthorique, React, Python..."
              className="w-full px-4 py-2.5 rounded-2xl border border-[var(--om-line)] text-[var(--om-text)]"
              autoFocus
            />
          </div>
          <div>
            <p className="text-base font-medium text-[var(--om-text)] mb-2.5">
              Minutes de travail par jour
            </p>
            <DomainMinutesForm minutes={minutes} onChange={setMinutes} disabled={false} />
          </div>
          {error && <p className="text-base text-[var(--om-danger)]">{error}</p>}
          <div className="flex gap-2.5 justify-end pt-2.5">
            <button
              type="button"
              onClick={handleClose}
              className="px-5 py-2.5 rounded-2xl text-base text-[var(--om-muted)] hover:bg-[var(--om-surface-2)] transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-2xl text-base font-medium bg-[var(--om-accent)] text-[var(--om-on-accent)] hover:bg-[var(--om-accent-hover)] disabled:opacity-50 transition-colors"
            >
              {loading ? 'Création...' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DomainesContent({ initialDomains }) {
  const isDemo = useDemoMode();
  const [domains, setDomains] = useState(initialDomains || []);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDemoBlockModal, setShowDemoBlockModal] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const revalidator = useRevalidator();
  const [mode, setMode] = useState('perso');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  const refreshDomains = useCallback(
    async (newDomain) => {
      if (newDomain != null && typeof newDomain === 'object' && 'id' in newDomain) {
        setDomains((prev) => [...prev, { ...newDomain, type: mode }]);
      } else {
        try {
          const list = isDemo ? await fetchDemoDomains() : await fetchDomains();
          setDomains(list);
        } catch {
          revalidator.revalidate();
        }
      }
    },
    [revalidator, mode, isDemo]
  );

  const handleDragEnd = useCallback(
    async (event) => {
      const { active, over } = event;
      setActiveId(null);
      if (!over || active.id === over.id) return;

      const domainsFiltered = domains.filter(
        (d) => String(d.type || 'perso').toLowerCase() === mode
      );
      const oldIndex = domainsFiltered.findIndex((d) => d.id === active.id);
      const newIndex = domainsFiltered.findIndex((d) => d.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const newFilteredOrder = arrayMove(domainsFiltered, oldIndex, newIndex);
      const orderedAll = [...domains].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      const modeIndices = orderedAll
        .map((d, i) => (String(d.type || 'perso').toLowerCase() === mode ? i : -1))
        .filter((i) => i >= 0);
      const newOrderedAll = [...orderedAll];
      modeIndices.forEach((slot, i) => {
        newOrderedAll[slot] = newFilteredOrder[i];
      });
      const domainIds = newOrderedAll.map((d) => d.id);

      try {
        const updated = isDemo ? await reorderDemoDomains(domainIds) : await reorderDomains(domainIds);
        setDomains(updated);
        revalidator.revalidate();
      } catch {
        // garde l'ordre actuel en cas d'erreur
      }
    },
    [domains, mode, revalidator]
  );

  useEffect(() => {
    setDomains(initialDomains || []);
  }, [initialDomains]);

  const domainsFiltered = domains.filter(
    (d) => String(d.type || 'perso').toLowerCase() === mode
  );
  const countPerso = domains.filter((d) => String(d.type || 'perso').toLowerCase() === 'perso').length;
  const countPro = domains.filter((d) => String(d.type || 'perso').toLowerCase() === 'pro').length;
  const maxDomains = mode === 'perso' ? MAX_DOMAINS_PERSO : MAX_DOMAINS_PRO;
  const currentCount = mode === 'perso' ? countPerso : countPro;
  const canAddDomain = currentCount < maxDomains;
  const activeDomain = activeId ? domainsFiltered.find((d) => d.id === activeId) : null;

  return (
    <div className="pt-1 pb-6 max-w-2xl md:max-w-6xl lg:max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
      <div className="flex flex-col mb-3.5">
        <h1 className="text-[17px] md:text-[19px] font-medium tracking-[-0.01em] text-[var(--om-text)]">
          Domaines d&apos;apprentissage
        </h1>
        <span className="text-xs text-[var(--om-muted)] max-w-xl">
          Ce que vous apprenez, et les minutes visées chaque jour.
        </span>
      </div>

      <div className="flex mb-3.5">
        <div className="om-segment relative w-[200px] md:w-[180px]">
          <button
            type="button"
            onClick={() => setMode('perso')}
            className={`relative z-10 flex-1 min-w-0 py-2.5 md:py-2 rounded-full text-sm md:text-xs font-medium transition-colors flex items-center justify-center ${
              mode === 'perso'
                ? 'text-[var(--om-on-accent)]'
                : 'text-[var(--om-muted)] hover:text-[var(--om-text)]'
            }`}
          >
            Perso
          </button>
          <button
            type="button"
            onClick={() => setMode('pro')}
            className={`relative z-10 flex-1 min-w-0 py-2.5 md:py-2 rounded-full text-sm md:text-xs font-medium transition-colors flex items-center justify-center ${
              mode === 'pro'
                ? 'text-[var(--om-on-accent)]'
                : 'text-[var(--om-muted)] hover:text-[var(--om-text)]'
            }`}
          >
            Pro
          </button>
          <div
            className="absolute top-1 bottom-1 rounded-full transition-all duration-300 ease-out pointer-events-none"
            style={{
              left: mode === 'perso' ? 4 : 'calc(50% + 2px)',
              width: 'calc(50% - 6px)',
              backgroundColor: mode === 'perso' ? 'var(--om-accent)' : 'var(--om-pro-strong)',
            }}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3.5 md:gap-2.5 mb-5 md:mb-4">
        <p className="text-base md:text-sm font-medium text-[var(--om-muted)]">
          {currentCount} / {maxDomains} domaine{currentCount !== 1 ? 's' : ''} {mode === 'perso' ? 'perso' : 'pro'}
        </p>
        <button
          type="button"
          onClick={() => (isDemo ? setShowDemoBlockModal(true) : setShowAddModal(true))}
          disabled={!canAddDomain}
          className={`px-4 md:px-3 py-2.5 md:py-2 rounded-2xl md:rounded-[10px] text-base md:text-sm font-medium text-[var(--om-on-accent)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2.5 ${
            mode === 'pro'
              ? 'bg-[var(--om-pro-strong)] hover:bg-[var(--om-accent-hover)]'
              : 'bg-[var(--om-accent)] hover:bg-[var(--om-accent-hover)]'
          }`}
        >
          <span className="w-7 h-7 rounded-[10px] flex items-center justify-center bg-[var(--om-surface)]/20 text-xl font-medium leading-none">
            +
          </span>
          Ajouter un domaine
        </button>
      </div>

      <AddDomainModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        mode={mode}
        onAdded={refreshDomains}
        isDemo={isDemo}
      />
      <DemoBlockModal isOpen={showDemoBlockModal} onClose={() => setShowDemoBlockModal(false)} />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={(event) => setActiveId(event.active.id)}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={domainsFiltered.map((d) => d.id)}
          strategy={rectSortingStrategy}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
            {domainsFiltered.length === 0 ? (
              <p className="text-center text-[var(--om-muted)] py-9 col-span-full">
                {mode === 'perso'
                  ? 'Aucun domaine perso. Ajoutez-en un pour commencer.'
                  : 'Aucun domaine pro. Ajoutez-en un pour commencer.'}
              </p>
            ) : (
              domainsFiltered.map((domain) => (
                <div key={domain.id} className="min-w-0">
                  <SortableDomainCard
                    domain={domain}
                    onUpdate={refreshDomains}
                    onDelete={refreshDomains}
                    isDemo={isDemo}
                  />
                </div>
              ))
            )}
          </div>
        </SortableContext>

        <DragOverlay dropAnimation={null}>
          {activeDomain ? (
            <div className="min-w-0 opacity-95 shadow-[var(--om-shadow-lg)] rounded-2xl md:rounded-[10px] border border-[var(--om-accent)]/50 bg-[var(--om-surface)] p-4 md:p-4 cursor-grabbing">
              <DomainCard
                domain={activeDomain}
                onUpdate={() => {}}
                onDelete={() => {}}
                isDemo={isDemo}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function Domaines() {
  const { domains } = useLoaderData();

  return (
    <DomainesContent initialDomains={domains} />
  );
}

export default Domaines;
