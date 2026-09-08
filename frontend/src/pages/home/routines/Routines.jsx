import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  DndContext,
  closestCenter,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDemoMode, getDemoData } from '../../../hooks/useDemoMode';
import { useLocation } from 'react-router-dom';
import {
  fetchRoutines,
  fetchRoutinesCalendar,
  toggleRoutine,
  createRoutine,
  reorderRoutines,
  deleteRoutine,
  fetchSimilarRoutines,
  createRoutineForOtherDays,
  deleteRoutinesByLabel,
  fetchRoutineReminders,
  setRoutineReminder,
} from '../../../utils/routineApi';
import { ensurePushSubscription, getPushResultMessage, PUSH_RESULT } from '../../../lib/push';
import {
  fetchDemoRoutines,
  fetchDemoRoutinesCalendar,
  toggleDemoRoutine,
  createDemoRoutine,
  reorderDemoRoutines,
  deleteDemoRoutine,
  fetchDemoSimilarRoutines,
  createDemoRoutineForOtherDays,
  deleteDemoRoutinesByLabel,
} from '../../../utils/demoApi';
import DemoBlockModal from '../../../components/DemoBlockModal';
import { Celebration, CelebrationLive } from '../../../components/Celebration';
import { useCelebration } from '../../../hooks/useCelebration';

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const DAYS_FULL = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const SWIPE_THRESHOLD = 60;
const SWIPE_MAX = 80;
const DEFAULT_REMINDER_TIME = '08:00';
const TOAST_DURATION = 2000;
const GREETING_LABELS = { morning: 'Bonjour', night: 'Bonne nuit' };

/** Lundi = 0, Dimanche = 6 */
function getDayOfWeekFromDate(dateStr) {
  return (new Date(dateStr + 'T12:00:00').getDay() + 6) % 7;
}

/** Date (YYYY-MM-DD) du jour dayOfWeek dans la semaine (Lun–Dim) qui contient refDate */
function getDateOfDayInCurrentWeek(dayOfWeek, refDate = new Date()) {
  const d = new Date(refDate);
  const currentDay = (d.getDay() + 6) % 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - currentDay);
  const target = new Date(monday);
  target.setDate(monday.getDate() + dayOfWeek);
  return target.toISOString().slice(0, 10);
}

function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

function RoutineItemOverlay({ routine, onToggle }) {
  if (!routine) return null;
  return (
    <div
      className={`om-card-sm flex items-center gap-3 shadow-[var(--om-shadow-lg)] transition-none ${
        routine.done ? 'bg-[var(--om-accent-soft)]' : ''
      }`}
    >
      <span
        className={`flex-shrink-0 ml-3.5 w-[26px] h-[26px] rounded-full border-[1.5px] flex items-center justify-center ${
          routine.done
            ? 'bg-[var(--om-accent)] border-[var(--om-accent)] text-[var(--om-on-accent)]'
            : 'border-[var(--om-line)] text-transparent'
        }`}
      >
        <i className="ph-bold ph-check text-[13px]" aria-hidden />
      </span>
      <span
        className={`flex-1 py-4 pr-4 font-medium text-sm md:text-[15px] ${
          routine.done
            ? 'text-[var(--om-muted)] line-through decoration-[var(--om-accent)]'
            : 'text-[var(--om-text)]'
        }`}
      >
        {routine.label}
      </span>
      <div className="flex-shrink-0 p-2 text-[var(--om-muted)]">
        <i className="ph ph-dots-six-vertical text-[20px]" aria-hidden />
      </div>
    </div>
  );
}

/** Badge « rappel programmé » : heure + type de message porté par la routine. */
function ReminderBadge({ routine }) {
  if (!routine.reminder_time) return null;
  const icon = routine.greeting === 'morning' ? '☀️' : routine.greeting === 'night' ? '🌙' : '🔔';
  const title = routine.greeting
    ? `${GREETING_LABELS[routine.greeting]} à ${routine.reminder_time}`
    : `Rappel à ${routine.reminder_time}`;
  return (
    <span
      title={title}
      className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--om-accent)]/10 text-[var(--om-accent)] text-xs font-medium tabular-nums"
    >
      <span aria-hidden="true">{icon}</span>
      {routine.reminder_time}
    </span>
  );
}

/**
 * Ligne routine : slide vers la gauche → suppression (si !readOnly).
 * toggleOnlyReadOnly = true : seul le bouton cocher est désactivé (consultation pour cette date) ; drag et suppression restent possibles.
 */
function RoutineItem({ routine, onToggle, onDeleteRequest, isDeleting, toggleOnlyReadOnly }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: routine.id });

  const [slideX, setSlideX] = useState(0);
  const touchStartX = useRef(0);
  const touchStartSlide = useRef(0);
  const slideXRef = useRef(0);
  slideXRef.current = slideX;

  const handleTouchStart = useCallback(
    (e) => {
      if (isDeleting) return;
      touchStartX.current = e.targetTouches[0].clientX;
      touchStartSlide.current = slideX;
    },
    [isDeleting, slideX]
  );

  const handleTouchMove = useCallback(
    (e) => {
      if (isDeleting) return;
      const x = e.targetTouches[0].clientX;
      const delta = x - touchStartX.current;
      const newX = Math.min(0, Math.max(-SWIPE_MAX, touchStartSlide.current + delta));
      setSlideX(newX);
    },
    [isDeleting]
  );

  const handleTouchEnd = useCallback(() => {
    const current = slideXRef.current;
    if (current < -SWIPE_THRESHOLD) {
      onDeleteRequest?.(routine);
    }
    setSlideX(0);
  }, [routine, onDeleteRequest]);

  const handlePointerDown = useCallback(
    (e) => {
      if (isDeleting) return;
      if (e.button !== 0) return;
      touchStartX.current = e.clientX;
      touchStartSlide.current = slideX;
    },
    [isDeleting, slideX]
  );

  const handlePointerMove = useCallback(
    (e) => {
      if (isDeleting) return;
      if (e.buttons !== 1) return;
      const delta = e.clientX - touchStartX.current;
      const newX = Math.min(0, Math.max(-SWIPE_MAX, touchStartSlide.current + delta));
      setSlideX(newX);
    },
    [isDeleting]
  );

  const handlePointerUp = useCallback(() => {
    const current = slideXRef.current;
    if (current < -SWIPE_THRESHOLD) {
      onDeleteRequest?.(routine);
    }
    setSlideX(0);
  }, [routine, onDeleteRequest]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, touchAction: 'pan-y' }}
      className={`om-card-sm transition-all duration-300 overflow-hidden ${
        routine.done ? 'bg-[var(--om-accent-soft)]' : ''
      } ${toggleOnlyReadOnly ? 'bg-[var(--om-surface-2)] shadow-none' : ''} ${isDragging ? 'opacity-0' : ''} ${isDeleting ? 'opacity-0 h-0 border-0 overflow-hidden transition-all duration-300' : ''}`}
    >
      <div
        className="flex items-center gap-3 md:gap-3 rounded-2xl transition-transform duration-300 ease-out"
        style={{ transform: `translateX(${slideX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            if (!toggleOnlyReadOnly) onToggle(routine);
          }}
          disabled={toggleOnlyReadOnly}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label={routine.done ? 'Marquer comme non fait' : 'Marquer comme fait'}
          className={`flex-shrink-0 ml-3.5 w-[26px] h-[26px] rounded-full border-[1.5px] flex items-center justify-center transition-all duration-200 ${
            routine.done
              ? 'bg-[var(--om-accent)] border-[var(--om-accent)] text-[var(--om-on-accent)]'
              : 'border-[var(--om-line)] text-transparent hover:border-[var(--om-accent)]'
          } ${toggleOnlyReadOnly ? 'cursor-default opacity-60' : ''}`}
        >
          <i className="ph-bold ph-check text-[13px]" aria-hidden />
        </button>
        <span
          className={`flex-1 min-w-0 flex items-center gap-2 py-4 pr-2 font-medium text-sm md:text-[15px] transition-all duration-300 ${
            routine.done
              ? 'text-[var(--om-muted)] line-through decoration-[var(--om-accent)]'
              : 'text-[var(--om-text)]'
          } ${toggleOnlyReadOnly ? 'text-[var(--om-muted)]' : ''}`}
        >
          <span className="truncate">{routine.label}</span>
          <ReminderBadge routine={routine} />
        </span>
        <div
          {...attributes}
          {...listeners}
          className="flex-shrink-0 p-2 cursor-grab active:cursor-grabbing text-[var(--om-muted)] hover:text-[var(--om-accent)] touch-none"
          aria-label="Réordonner"
        >
          <i className="ph ph-dots-six-vertical text-[20px]" aria-hidden />
        </div>
      </div>
    </div>
  );
}

/**
 * Cellule du calendrier : clic = afficher les routines pour cette date.
 * isSelected = date actuellement affichée dans la liste.
 */
function RoutineDayCell({ dayNum, percent, isToday, isSelected, onClick }) {
  const isCompleted = percent >= 100;
  const stroke = isCompleted ? 'var(--om-accent)' : 'var(--om-accent)';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center justify-center rounded-2xl p-1 min-h-[48px] md:min-h-[52px] transition-colors ${
        isToday ? 'bg-[var(--om-accent-soft)]' : ''
      } ${isSelected && !isToday ? 'bg-[var(--om-surface-2)]' : ''} hover:bg-[var(--om-surface-2)]`}
      style={
        isToday
          ? { boxShadow: 'inset 0 0 0 1.5px var(--om-accent)' }
          : isSelected
            ? { boxShadow: 'inset 0 0 0 1.5px var(--om-muted)' }
            : undefined
      }
    >
      <span className="text-[11px] font-medium tabular-nums text-[var(--om-muted)] mb-0.5">
        {dayNum || ''}
      </span>
      <div className="relative w-7 h-7 md:w-8 md:h-8 flex items-center justify-center">
        {isCompleted ? (
          <div className="w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center bg-[var(--om-accent)] animate-om-pop">
            <i className="ph-bold ph-check text-[13px]" style={{ color: 'var(--om-on-accent)' }} aria-hidden />
          </div>
        ) : (
          <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
            <circle cx="18" cy="18" r="14" fill="none" stroke="var(--om-track)" strokeWidth="3" />
            {/* À 0 %, le linecap arrondi dessinerait un point parasite */}
            {percent > 0 && (
              <circle
                cx="18"
                cy="18"
                r="14"
                fill="none"
                stroke={stroke}
                strokeWidth="3"
                strokeDasharray={`${Math.min(100, percent) * 0.88} 88`}
                strokeLinecap="round"
                className="transition-all duration-500 ease-out"
              />
            )}
          </svg>
        )}
      </div>
    </button>
  );
}

function CalendarRoutines({ byDate, selectedDate, onSelectDate, monthOffset, setMonthOffset }) {
  const now = new Date();
  const viewDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = (firstDay.getDay() + 6) % 7;
  const daysInMonth = lastDay.getDate();
  const today = new Date().toISOString().slice(0, 10);

  const cells = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const data = byDate[dateStr] || { total: 0, done: 0 };
    const percent = data.total > 0 ? (data.done / data.total) * 100 : 0;
    cells.push({
      date: dateStr,
      dayNum: d,
      percent,
      isToday: dateStr === today,
      isSelected: selectedDate === dateStr,
    });
  }

  return (
    <section className="w-full rounded-2xl bg-[var(--om-surface)]/90 border border-[var(--om-line)] shadow-[var(--om-shadow)] p-3 md:p-3.5 lg:p-4 mt-0">
      <div className="flex items-center justify-between mb-2 md:mb-2 lg:mb-2.5">
        <button
          type="button"
          onClick={() => setMonthOffset((m) => m - 1)}
          className="w-8 h-8 md:w-8 md:h-8 lg:w-9 lg:h-9 rounded-full bg-[var(--om-surface-2)] text-[var(--om-text)] hover:bg-[var(--om-accent)]/10 flex items-center justify-center transition-colors md:text-sm lg:text-base"
          aria-label="Mois précédent"
        >
          ‹
        </button>
        <h3 className="text-sm md:text-sm lg:text-base font-medium text-[var(--om-text)] capitalize">
          {new Date(year, month).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
        </h3>
        <button
          type="button"
          onClick={() => setMonthOffset((m) => m + 1)}
          className="w-8 h-8 md:w-8 md:h-8 lg:w-9 lg:h-9 rounded-full bg-[var(--om-surface-2)] text-[var(--om-text)] hover:bg-[var(--om-accent)]/10 flex items-center justify-center transition-colors md:text-sm lg:text-base"
          aria-label="Mois suivant"
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 md:gap-1 lg:gap-1.5">
        {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => (
          <div key={d} className="text-center whitespace-nowrap text-[13px] md:text-[13px] lg:text-sm text-[var(--om-muted)] py-1 md:py-1">
            {d}
          </div>
        ))}
        {cells.map((cell, i) =>
          cell ? (
            <RoutineDayCell
              key={i}
              dayNum={cell.dayNum}
              percent={cell.percent}
              isToday={cell.isToday}
              isSelected={cell.isSelected}
              onClick={() => onSelectDate(cell.date)}
            />
          ) : (
            <div key={i} />
          )
        )}
      </div>
    </section>
  );
}

function RoutinesContent() {
  const location = useLocation();
  const isDemo = useDemoMode();
  const effectiveIsDemo = isDemo || location.pathname.startsWith('/demo');
  const todayStr = getTodayStr();
  const todayDayOfWeek = (new Date().getDay() + 6) % 7;

  const [calendarSelectedDate, setCalendarSelectedDate] = useState(null);
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState(todayDayOfWeek);
  const viewDate = calendarSelectedDate ?? getDateOfDayInCurrentWeek(selectedDayOfWeek);
  const isViewDateEditable = viewDate === todayStr;
  const viewDayOfWeek = getDayOfWeekFromDate(viewDate);

  const [routines, setRoutines] = useState([]);
  const [calendarByDate, setCalendarByDate] = useState({});
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState('');
  const [adding, setAdding] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [similarRoutines, setSimilarRoutines] = useState([]);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showAddToWeekConfirm, setShowAddToWeekConfirm] = useState(null);
  const [addToWeekLoading, setAddToWeekLoading] = useState(false);
  // Assistant en deux étapes affiché après l'ajout : « autres jours ? » puis « me prévenir ».
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardScope, setWizardScope] = useState('day');
  const [reminderTime, setReminderTime] = useState(DEFAULT_REMINDER_TIME);
  const [reminderGreeting, setReminderGreeting] = useState(null);
  const [reminderLoading, setReminderLoading] = useState(false);
  const [pushNotice, setPushNotice] = useState(null);
  const [reminders, setReminders] = useState([]);
  const [toast, setToast] = useState(null);
  const { celebration, celebrate } = useCelebration();
  const [addError, setAddError] = useState(null);
  const [calendarMonthOffset, setCalendarMonthOffset] = useState(0);
  const [calendarRefreshTrigger, setCalendarRefreshTrigger] = useState(0);
  const [showDemoBlockModal, setShowDemoBlockModal] = useState(false);

  const fetchRoutinesFn = effectiveIsDemo ? fetchDemoRoutines : fetchRoutines;
  const fetchCalendarFn = effectiveIsDemo ? fetchDemoRoutinesCalendar : fetchRoutinesCalendar;
  const toggleRoutineFn = effectiveIsDemo ? toggleDemoRoutine : toggleRoutine;
  const createRoutineFn = effectiveIsDemo ? createDemoRoutine : createRoutine;
  const reorderRoutinesFn = effectiveIsDemo ? reorderDemoRoutines : reorderRoutines;
  const deleteRoutineFn = effectiveIsDemo ? deleteDemoRoutine : deleteRoutine;

  const loadRoutinesForViewDate = useCallback(
    async (dateStr, signal) => {
      const day = getDayOfWeekFromDate(dateStr);
      const list = await fetchRoutinesFn(day, { date: dateStr, signal });
      return Array.isArray(list) ? list : [];
    },
    [fetchRoutinesFn]
  );

  const loadCalendar = useCallback(
    async (start, end) => {
      const byDate = await fetchCalendarFn(start, end);
      setCalendarByDate(byDate);
    },
    [fetchCalendarFn]
  );

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    loadRoutinesForViewDate(viewDate, ac.signal)
      .then((list) => {
        if (!ac.signal.aborted) setRoutines(list);
      })
      .catch((err) => {
        if (err?.name === 'AbortError' || err?.code === 'ERR_CANCELED') return;
        if (!ac.signal.aborted) setRoutines([]);
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, [viewDate, loadRoutinesForViewDate]);

  // Rappels de toute la semaine : sert à repérer tout de suite qu'un « bonjour »
  // ou une « bonne nuit » est déjà pris sur un jour donné.
  const loadReminders = useCallback(async () => {
    if (effectiveIsDemo) return;
    const list = await fetchRoutineReminders();
    setReminders(Array.isArray(list) ? list : []);
  }, [effectiveIsDemo]);

  useEffect(() => {
    loadReminders();
  }, [loadReminders]);

  // Le toast disparaît seul au bout de 2 s.
  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), TOAST_DURATION);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const now = new Date();
    const viewMonth = new Date(now.getFullYear(), now.getMonth() + calendarMonthOffset, 1);
    const start = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1).toISOString().slice(0, 10);
    const end = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).toISOString().slice(0, 10);
    loadCalendar(start, end);
  }, [loadCalendar, calendarMonthOffset, viewDate, calendarRefreshTrigger]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleTabClick = useCallback((dayOfWeek) => {
    setCalendarSelectedDate(null);
    setSelectedDayOfWeek(dayOfWeek);
  }, []);

  const handleCalendarSelectDate = useCallback((dateStr) => {
    setCalendarSelectedDate(dateStr);
    setSelectedDayOfWeek(getDayOfWeekFromDate(dateStr));
  }, []);

  const handleToggle = useCallback(
    async (routine) => {
      if (!isViewDateEditable) return;
      const prevDone = routine.done;
      const newDone = !prevDone;
      setRoutines((prev) =>
        prev.map((r) => (r.id === routine.id ? { ...r, done: newDone } : r))
      );
      try {
        const res = await toggleRoutineFn(routine.id, newDone, viewDate);
        const serverDone = res?.done ?? newDone;
        let allDone = false;
        setRoutines((prev) => {
          const next = prev.map((r) => (r.id === routine.id ? { ...r, done: serverDone } : r));
          allDone = next.length > 0 && next.every((r) => r.done);
          return next;
        });
        // Hors de l'updater : React peut le rejouer, un effet n'y a pas sa place.
        if (serverDone) {
          celebrate(allDone ? 'Journée bouclée' : 'Routine faite', { full: allDone });
        }
        setCalendarRefreshTrigger((t) => t + 1);
      } catch {
        setRoutines((prev) =>
          prev.map((r) => (r.id === routine.id ? { ...r, done: prevDone } : r))
        );
      }
    },
    [isViewDateEditable, viewDate, toggleRoutineFn, celebrate]
  );

  const handleDeleteRequest = useCallback((routine) => {
    setShowDeleteConfirm(routine);
    setSimilarRoutines([]);
    setSimilarLoading(true);
    const fetchSimilar = effectiveIsDemo ? fetchDemoSimilarRoutines : fetchSimilarRoutines;
    fetchSimilar(routine.label)
      .then((list) => setSimilarRoutines(Array.isArray(list) ? list : []))
      .catch(() => setSimilarRoutines([]))
      .finally(() => setSimilarLoading(false));
  }, [effectiveIsDemo]);

  const handleDeleteConfirm = useCallback(
    async (scope = 'day') => {
      if (!showDeleteConfirm) return;
      setDeleteLoading(true);
      try {
        if (scope === 'week') {
          const deleteByLabelFn = effectiveIsDemo ? deleteDemoRoutinesByLabel : deleteRoutinesByLabel;
          await deleteByLabelFn(showDeleteConfirm.label);
          setRoutines((prev) => prev.filter((r) => r.label !== showDeleteConfirm.label));
        } else {
          await deleteRoutineFn(showDeleteConfirm.id);
          setRoutines((prev) => prev.filter((r) => r.id !== showDeleteConfirm.id));
        }
        setShowDeleteConfirm(null);
        setCalendarRefreshTrigger((t) => t + 1);
      } catch {
        // keep modal open
      } finally {
        setDeleteLoading(false);
      }
    },
    [showDeleteConfirm, deleteRoutineFn, effectiveIsDemo]
  );

  const handleAdd = useCallback(async () => {
    const label = newLabel.trim();
    if (!label || adding) return;

    // En mode démo, vérifier la limite de 3 routines par jour
    if (effectiveIsDemo) {
      const demoData = getDemoData();
      const routinesByDay = demoData.routinesByDay || {};
      const routinesForDay = routinesByDay[viewDayOfWeek] || [];
      
      // Si déjà 3 routines ou plus pour ce jour, afficher le modal de connexion
      if (routinesForDay.length >= 3) {
        setShowDemoBlockModal(true);
        return;
      }
    }

    setAdding(true);
    setNewLabel('');
    setAddError(null);
    try {
      const created = effectiveIsDemo
        ? await createDemoRoutine(label, viewDayOfWeek)
        : await createRoutineFn(label, viewDayOfWeek);
      setRoutines((prev) => [...prev, created].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)));
      setCalendarRefreshTrigger((t) => t + 1);
      setWizardStep(0);
      setWizardScope('day');
      setReminderTime(DEFAULT_REMINDER_TIME);
      setReminderGreeting(null);
      setPushNotice(null);
      setShowAddToWeekConfirm({ id: created.id, label: created.label, dayOfWeek: viewDayOfWeek });
    } catch (err) {
      setNewLabel(label);
      const msg = err?.response?.data?.error || 'Impossible d\'ajouter la routine. Réessayez.';
      setAddError(msg);
    } finally {
      setAdding(false);
    }
  }, [newLabel, adding, viewDayOfWeek, createRoutineFn, effectiveIsDemo]);

  const closeWizard = useCallback(() => {
    setShowAddToWeekConfirm(null);
    setWizardStep(0);
    setPushNotice(null);
  }, []);

  /** Étape 1 : ajouter (ou non) aux autres jours, puis glisser vers « Me prévenir ». */
  const handleAddToWeekChoice = useCallback(
    async (addToAll) => {
      if (!showAddToWeekConfirm || addToWeekLoading) return;

      if (addToAll) {
        setAddToWeekLoading(true);
        try {
          const fn = effectiveIsDemo ? createDemoRoutineForOtherDays : createRoutineForOtherDays;
          await fn(showAddToWeekConfirm.label, showAddToWeekConfirm.dayOfWeek);
          setCalendarRefreshTrigger((t) => t + 1);
        } catch {
          // ignore
        } finally {
          setAddToWeekLoading(false);
        }
      }

      setWizardScope(addToAll ? 'week' : 'day');
      // Le mode démo n'a pas de notifications : on s'arrête à la première étape.
      if (effectiveIsDemo) {
        closeWizard();
        return;
      }
      setWizardStep(1);
    },
    [showAddToWeekConfirm, addToWeekLoading, effectiveIsDemo, closeWizard]
  );

  /** Jours de la semaine concernés par le rappel selon le choix de l'étape 1. */
  const wizardTargetDays = useMemo(() => {
    if (!showAddToWeekConfirm) return [];
    return wizardScope === 'week' ? [0, 1, 2, 3, 4, 5, 6] : [showAddToWeekConfirm.dayOfWeek];
  }, [showAddToWeekConfirm, wizardScope]);

  /**
   * Un seul « bonjour » et une seule « bonne nuit » par jour : si le jour visé
   * est déjà pris par une autre routine, on prévient au lieu d'activer.
   */
  const handleGreetingToggle = useCallback(
    (type) => {
      if (reminderGreeting === type) {
        setReminderGreeting(null);
        return;
      }

      const takenDays = wizardTargetDays.filter((day) =>
        reminders.some(
          (r) => r.day_of_week === day && r.greeting === type && r.id !== showAddToWeekConfirm?.id
        )
      );

      if (takenDays.length === wizardTargetDays.length && takenDays.length > 0) {
        setToast(`${GREETING_LABELS[type]}, déjà programmé`);
        return;
      }
      if (takenDays.length > 0) {
        setToast(`${GREETING_LABELS[type]}, déjà programmé sur certains jours`);
      }
      setReminderGreeting(type);
    },
    [reminderGreeting, wizardTargetDays, reminders, showAddToWeekConfirm]
  );

  /**
   * Étape 2 : on demande la permission (geste utilisateur obligatoire) puis on
   * enregistre le rappel. Un refus de permission n'annule pas l'enregistrement :
   * le rappel partira dès que les notifications seront réautorisées.
   */
  const handleSaveReminder = useCallback(async () => {
    if (!showAddToWeekConfirm || reminderLoading) return;
    setReminderLoading(true);
    setPushNotice(null);

    try {
      const pushResult = await ensurePushSubscription();
      const notice = getPushResultMessage(pushResult);

      const response = await setRoutineReminder(showAddToWeekConfirm.id, {
        time: reminderTime,
        greeting: reminderGreeting,
        scope: wizardScope,
      });

      if (reminderGreeting && response?.conflicts?.length > 0) {
        setToast(`${GREETING_LABELS[reminderGreeting]}, déjà programmé`);
      }

      await loadReminders();
      setRoutines((prev) => {
        const byId = Object.fromEntries((response?.routines || []).map((r) => [r.id, r]));
        return prev.map((r) =>
          byId[r.id]
            ? { ...r, reminder_time: byId[r.id].reminder_time, greeting: byId[r.id].greeting }
            : r
        );
      });

      if (notice && pushResult !== PUSH_RESULT.OK) {
        // On garde la fenêtre ouverte pour expliquer pourquoi rien n'arrivera.
        setPushNotice(notice);
        return;
      }
      closeWizard();
    } catch {
      setPushNotice('Le rappel n\'a pas pu être enregistré. Réessayez.');
    } finally {
      setReminderLoading(false);
    }
  }, [
    showAddToWeekConfirm,
    reminderLoading,
    reminderTime,
    reminderGreeting,
    wizardScope,
    loadReminders,
    closeWizard,
  ]);

  const handleDragStart = useCallback((event) => {
    setActiveId(event.active.id);
  }, []);

  const handleDragEnd = useCallback(
    async (event) => {
      setActiveId(null);
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const list = routines;
      const oldIndex = list.findIndex((r) => r.id === active.id);
      const newIndex = list.findIndex((r) => r.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      const reordered = arrayMove(list, oldIndex, newIndex);
      setRoutines(reordered);
      try {
        const updated = await reorderRoutinesFn(reordered.map((r) => r.id), viewDayOfWeek);
        setRoutines((prev) => {
          const byId = Object.fromEntries(prev.map((r) => [r.id, r]));
          return updated.map((r) => ({ ...r, done: byId[r.id]?.done ?? r.done }));
        });
      } catch {
        setRoutines(list);
      }
    },
    [routines, viewDayOfWeek, reorderRoutinesFn]
  );

  if (loading) {
    return (
      <div className="p-9 animate-pulse">
        <div className="h-9 bg-[var(--om-track)] rounded w-56 mx-auto mb-7" />
        <div className="space-y-3.5 max-w-2xl mx-auto">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-20 bg-[var(--om-track)] rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  const viewDateLabel = (() => {
    try {
      const d = new Date(viewDate + 'T12:00:00');
      return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    } catch {
      return viewDate;
    }
  })();

  return (
    <div className="px-4 md:px-6 lg:px-8 pt-1 pb-6 w-full max-w-xl lg:max-w-5xl mx-auto">
      <div className="flex flex-col mb-3.5">
        <h1 className="text-[17px] md:text-[19px] font-medium tracking-[-0.01em] text-[var(--om-text)]">
          Routines
        </h1>
        <span className="text-xs text-[var(--om-muted)]">
          {viewDateLabel}
          {!isViewDateEditable && ' · consultation'}
        </span>
      </div>
      <div className="flex flex-col lg:flex-row lg:items-start lg:gap-8">
        <div className="flex-1 min-w-0 lg:max-w-[720px]">
      <div
        className="flex w-full max-w-full overflow-x-auto lg:overflow-x-visible no-scrollbar gap-1.5 md:gap-2 mb-5 md:mb-4 pb-1 justify-start lg:justify-center"
        aria-label="Choisir le jour de la semaine (semaine courante)"
      >
        {DAYS.map((name, i) => {
          const tabDate = getDateOfDayInCurrentWeek(i);
          const isToday = tabDate === todayStr;
          const isSelected = selectedDayOfWeek === i && !calendarSelectedDate;
          const selectedByCalendar = calendarSelectedDate && getDayOfWeekFromDate(calendarSelectedDate) === i;
          const active = isSelected || selectedByCalendar;
          return (
            <button
              type="button"
              key={i}
              onClick={() => handleTabClick(i)}
              className={`om-chip flex-shrink-0 ${
                active && isToday
                  ? 'bg-[var(--om-accent)] text-[var(--om-on-accent)] border-[var(--om-accent)]'
                  : ''
              }`}
              data-active={active || isToday}
              title={isToday ? `Aujourd'hui — Modifier les routines` : `Routines du ${name}`}
            >
              {name}
            </button>
          );
        })}
      </div>

      <div className="mt-5 relative">
      <Celebration celebration={celebration} anchor="screen" />
      <CelebrationLive celebration={celebration} />
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={routines.map((r) => r.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3 w-full max-w-full lg:max-w-[720px] lg:mx-auto">
            {routines.map((routine) => (
              <RoutineItem
                key={routine.id}
                routine={routine}
                onToggle={handleToggle}
                onDeleteRequest={handleDeleteRequest}
                isDeleting={deletingId === routine.id}
                toggleOnlyReadOnly={!isViewDateEditable}
              />
            ))}
          </div>
        </SortableContext>
        <DragOverlay dropAnimation={null}>
          {activeId ? (
            <RoutineItemOverlay routine={routines.find((r) => r.id === activeId)} onToggle={() => {}} />
          ) : null}
        </DragOverlay>
      </DndContext>
      </div>

      <div className="mt-9 pt-7 border-t border-[var(--om-line)]">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="text"
            value={newLabel}
            onChange={(e) => {
              setNewLabel(e.target.value);
              if (addError) setAddError(null);
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="Nouvelle routine (tous les jours sélectionnés)..."
            className="flex-1 px-4 py-2.5 rounded-[10px] border border-[var(--om-line)] bg-[var(--om-surface-2)] text-base text-[var(--om-text)] placeholder:text-[var(--om-muted)] focus:border-[var(--om-accent)]/50 focus:outline-none"
            aria-invalid={!!addError}
            aria-describedby={addError ? 'add-routine-error' : undefined}
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={adding || !newLabel.trim()}
            className="px-5 py-2.5 rounded-[10px] bg-[var(--om-accent)]/80 text-[var(--om-on-accent)] text-base font-medium hover:bg-[var(--om-accent)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {adding ? '…' : 'Ajouter'}
          </button>
        </div>
        {addError && (
          <p id="add-routine-error" className="mt-2 text-sm text-[var(--om-danger)]" role="alert">
            {addError}
          </p>
        )}
      </div>

        </div>
        <div className="lg:w-[320px] lg:flex-shrink-0 lg:sticky lg:top-4 mt-8 lg:mt-[4.5rem]">
      <CalendarRoutines
        byDate={calendarByDate}
        selectedDate={viewDate}
        onSelectDate={handleCalendarSelectDate}
        monthOffset={calendarMonthOffset}
        setMonthOffset={setCalendarMonthOffset}
      />
        </div>
      </div>

      {showAddToWeekConfirm && (
        <div className="fixed inset-0 bg-[var(--om-scrim-solid)]/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--om-surface)] rounded-2xl max-w-md w-full shadow-[var(--om-shadow-lg)] overflow-hidden">
            {/* Indicateur d'étape */}
            <div className="flex items-center justify-center gap-1.5 pt-5">
              {[0, 1].map((step) => (
                <span
                  key={step}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    wizardStep === step ? 'w-6 bg-[var(--om-accent)]' : 'w-1.5 bg-[var(--om-line)]'
                  }`}
                />
              ))}
            </div>

            {/* Les deux panneaux défilent de la droite vers la gauche */}
            <div className="overflow-hidden">
              <div
                className="flex w-[200%] transition-transform duration-300 ease-out"
                style={{ transform: `translateX(${wizardStep === 1 ? '-50%' : '0%'})` }}
              >
                {/* Étape 1 — Ajouter aux autres jours ? */}
                <div className="w-1/2 flex-shrink-0 p-7" aria-hidden={wizardStep !== 0}>
                  <h3 className="text-xl font-medium text-[var(--om-text)] mb-2.5">
                    Ajouter aux autres jours ?
                  </h3>
                  <p className="text-base text-[var(--om-muted)] mb-7">
                    « {showAddToWeekConfirm.label} » est déjà ajoutée à ce jour. Souhaitez-vous l&apos;ajouter aux autres jours de la semaine ?
                  </p>
                  <div className="flex flex-col gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleAddToWeekChoice(true)}
                      disabled={addToWeekLoading}
                      tabIndex={wizardStep === 0 ? 0 : -1}
                      className="w-full px-5 py-2.5 rounded-2xl bg-[var(--om-accent)] text-[var(--om-on-accent)] text-base font-medium hover:opacity-90 disabled:opacity-60"
                    >
                      {addToWeekLoading ? 'Ajout…' : 'Oui, toute la semaine'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddToWeekChoice(false)}
                      disabled={addToWeekLoading}
                      tabIndex={wizardStep === 0 ? 0 : -1}
                      className="w-full px-5 py-2.5 rounded-2xl border border-[var(--om-line)] text-[var(--om-muted)] text-base font-medium hover:bg-[var(--om-surface-2)] disabled:opacity-60"
                    >
                      Non, ce jour uniquement
                    </button>
                  </div>
                </div>

                {/* Étape 2 — Me prévenir */}
                <div className="w-1/2 flex-shrink-0 p-7" aria-hidden={wizardStep !== 1}>
                  <h3 className="text-xl font-medium text-[var(--om-text)] mb-2.5">
                    Me prévenir
                  </h3>
                  <p className="text-sm text-[var(--om-muted)] mb-5">
                    Recevez une notification pour « {showAddToWeekConfirm.label} »{' '}
                    {wizardScope === 'week'
                      ? 'chaque jour de la semaine.'
                      : `chaque ${DAYS_FULL[showAddToWeekConfirm.dayOfWeek]}.`}
                  </p>

                  <label
                    htmlFor="reminder-time"
                    className="block text-sm font-medium text-[var(--om-text)] mb-1.5"
                  >
                    Heure du rappel
                  </label>
                  <input
                    id="reminder-time"
                    type="time"
                    value={reminderTime}
                    onChange={(e) => setReminderTime(e.target.value)}
                    tabIndex={wizardStep === 1 ? 0 : -1}
                    className="w-full px-4 py-2.5 mb-5 rounded-[10px] border border-[var(--om-line)] bg-[var(--om-surface-2)] text-base text-[var(--om-text)] tabular-nums focus:border-[var(--om-accent)]/50 focus:outline-none"
                  />

                  <span className="block text-sm font-medium text-[var(--om-text)] mb-1.5">
                    Message de la journée <span className="font-normal text-[var(--om-muted)]">(optionnel)</span>
                  </span>
                  <div className="grid grid-cols-2 gap-2.5 mb-2.5">
                    {[
                      { type: 'morning', icon: '☀️', label: 'Bonjour' },
                      { type: 'night', icon: '🌙', label: 'Bonne nuit' },
                    ].map(({ type, icon, label }) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => handleGreetingToggle(type)}
                        aria-pressed={reminderGreeting === type}
                        tabIndex={wizardStep === 1 ? 0 : -1}
                        className={`px-4 py-2.5 rounded-2xl border text-base font-medium transition-all ${
                          reminderGreeting === type
                            ? 'border-[var(--om-accent)] bg-[var(--om-accent)]/10 text-[var(--om-accent)]'
                            : 'border-[var(--om-line)] text-[var(--om-muted)] hover:bg-[var(--om-surface-2)]'
                        }`}
                      >
                        <span aria-hidden="true" className="mr-1.5">{icon}</span>
                        {label}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-[var(--om-muted)] mb-5 leading-relaxed">
                    {reminderGreeting === 'morning' && 'Un mot d\'encouragement lié à vos objectifs, suivi du rappel de vos tâches du jour.'}
                    {reminderGreeting === 'night' && 'Un bilan bienveillant de votre journée, précédé 45 min avant de vos pourcentages.'}
                    {!reminderGreeting && 'Un seul « bonjour » et une seule « bonne nuit » par jour de la semaine.'}
                  </p>

                  {pushNotice && (
                    <p className="text-sm text-[var(--om-muted)] bg-[var(--om-surface-2)] rounded-[10px] p-3 mb-5" role="status">
                      {pushNotice}
                    </p>
                  )}

                  <div className="flex flex-col gap-2.5">
                    <button
                      type="button"
                      onClick={handleSaveReminder}
                      disabled={reminderLoading || !reminderTime}
                      tabIndex={wizardStep === 1 ? 0 : -1}
                      className="w-full px-5 py-2.5 rounded-2xl bg-[var(--om-accent)] text-[var(--om-on-accent)] text-base font-medium hover:opacity-90 disabled:opacity-60"
                    >
                      {reminderLoading ? 'Activation…' : pushNotice ? 'Terminé' : 'Activer le rappel'}
                    </button>
                    <button
                      type="button"
                      onClick={closeWizard}
                      disabled={reminderLoading}
                      tabIndex={wizardStep === 1 ? 0 : -1}
                      className="w-full px-5 py-2.5 rounded-2xl border border-[var(--om-line)] text-[var(--om-muted)] text-base font-medium hover:bg-[var(--om-surface-2)] disabled:opacity-60"
                    >
                      {pushNotice ? 'Fermer' : 'Plus tard'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast léger (2 s) : « Bonjour, déjà programmé » */}
      {toast && (
        <div className="fixed inset-x-0 bottom-8 z-[60] flex justify-center px-4 pointer-events-none">
          <div
            role="status"
            className="animate-bounce-in bg-[var(--om-text)] text-[var(--om-on-accent)] text-sm font-medium px-4 py-2.5 rounded-full shadow-[var(--om-shadow)]"
          >
            {toast}
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-[var(--om-scrim-solid)]/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--om-surface)] rounded-2xl p-7 max-w-md w-full shadow-[var(--om-shadow-lg)]">
            <h3 className="text-xl font-medium text-[var(--om-text)] mb-2.5">
              Supprimer la routine ?
            </h3>
            <p className="text-base text-[var(--om-muted)] mb-7">
              « {showDeleteConfirm.label} » sera définitivement supprimée.
              {similarLoading && ' Vérification…'}
              {!similarLoading && similarRoutines.some((r) => r.id !== showDeleteConfirm.id) && (
                <> Une routine similaire existe sur d&apos;autres jours.</>
              )}
            </p>
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(null)}
                disabled={deleteLoading}
                className="w-full px-5 py-2.5 rounded-2xl border border-[var(--om-line)] text-[var(--om-muted)] text-base font-medium hover:bg-[var(--om-surface-2)] disabled:opacity-60"
              >
                Annuler
              </button>
              {!similarLoading && similarRoutines.some((r) => r.id !== showDeleteConfirm.id) ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleDeleteConfirm('day')}
                    disabled={deleteLoading}
                    className="w-full px-5 py-2.5 rounded-2xl border border-[var(--om-danger)]/50 text-[var(--om-danger)] text-base font-medium hover:bg-[var(--om-danger-soft)] disabled:opacity-60"
                  >
                    {deleteLoading ? 'Suppression…' : 'Uniquement celle-ci'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteConfirm('week')}
                    disabled={deleteLoading}
                    className="w-full px-5 py-2.5 rounded-2xl bg-[var(--om-danger)] text-[var(--om-on-accent)] text-base font-medium hover:bg-[var(--om-danger-strong)] disabled:opacity-60"
                  >
                    {deleteLoading ? 'Suppression…' : 'Toute la semaine'}
                  </button>
                </>
              ) : (
                !similarLoading && (
                  <button
                    type="button"
                    onClick={() => handleDeleteConfirm('day')}
                    disabled={deleteLoading}
                    className="w-full px-5 py-2.5 rounded-2xl bg-[var(--om-danger)] text-[var(--om-on-accent)] text-base font-medium hover:bg-[var(--om-danger-strong)] disabled:opacity-60"
                  >
                    {deleteLoading ? 'Suppression…' : 'Supprimer'}
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      )}

      <DemoBlockModal isOpen={showDemoBlockModal} onClose={() => setShowDemoBlockModal(false)} />
    </div>
  );
}

function Routines() {
  return <RoutinesContent />;
}

export default Routines;
