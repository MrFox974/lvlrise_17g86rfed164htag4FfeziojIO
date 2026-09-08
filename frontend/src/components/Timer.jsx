import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const RAY_COUNT = 60;
const WAVE_SPREAD = 12;
const STORAGE_KEY = 'timer_state';
const DEFAULT_TOTAL_SECONDS = 60;

/* Molette : 5 rangées visibles, la sélection est celle centrée sous le cadre. */
const WHEEL_ITEM_H = 40;
const WHEEL_VISIBLE = 5;
const WHEEL_PAD = ((WHEEL_VISIBLE - 1) / 2) * WHEEL_ITEM_H;

function getRayLength(index, progressSecond) {
  const dist = Math.min(
    Math.abs(index - progressSecond),
    RAY_COUNT - Math.abs(index - progressSecond)
  );
  const factor = Math.max(0, 1 - dist / WAVE_SPREAD);
  return 0.4 + 0.6 * factor;
}

function loadTimerState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data;
  } catch {
    return null;
  }
}

function saveTimerState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

function formatDuration(h, m, s) {
  const parts = [];
  if (h > 0) parts.push(`${h} h`);
  if (m > 0) parts.push(`${m} min`);
  if (s > 0 || (h === 0 && m === 0)) parts.push(`${s} s`);
  return parts.join(' ');
}

/** Une colonne de la molette : défilement vertical aimanté, la valeur retenue est
 * celle qui s'arrête dans le cadre central. */
function WheelColumn({ label, count, value, onChange }) {
  const scrollerRef = useRef(null);
  const frameRef = useRef(null);
  const valueRef = useRef(value);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  // Positionnement initial sur la valeur courante, sans animation.
  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = valueRef.current * WHEEL_ITEM_H;
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  const handleScroll = useCallback(() => {
    if (frameRef.current) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      const el = scrollerRef.current;
      if (!el) return;
      const index = Math.min(count - 1, Math.max(0, Math.round(el.scrollTop / WHEEL_ITEM_H)));
      if (index !== valueRef.current) onChange(index);
    });
  }, [count, onChange]);

  const pick = useCallback((index) => {
    const el = scrollerRef.current;
    if (el) el.scrollTo({ top: index * WHEEL_ITEM_H, behavior: 'smooth' });
    onChange(index);
  }, [onChange]);

  const handleKeyDown = useCallback((e) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const next = Math.min(count - 1, Math.max(0, valueRef.current + (e.key === 'ArrowDown' ? 1 : -1)));
    pick(next);
  }, [count, pick]);

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--om-muted)]">{label}</span>
      <div className="relative" style={{ height: WHEEL_VISIBLE * WHEEL_ITEM_H, width: 78 }}>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 z-10 rounded-xl border border-[var(--om-accent)] bg-[var(--om-accent-soft)]"
          style={{ height: WHEEL_ITEM_H, top: WHEEL_PAD }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-20"
          style={{ height: WHEEL_PAD, background: 'linear-gradient(var(--om-surface), transparent)' }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 z-20"
          style={{ height: WHEEL_PAD, background: 'linear-gradient(transparent, var(--om-surface))' }}
        />
        <div
          ref={scrollerRef}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          role="listbox"
          aria-label={label}
          tabIndex={0}
          className="no-scrollbar h-full overflow-y-auto rounded-xl focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--om-accent)]"
          style={{
            scrollSnapType: 'y mandatory',
            paddingTop: WHEEL_PAD,
            paddingBottom: WHEEL_PAD,
            overscrollBehavior: 'contain',
          }}
        >
          {Array.from({ length: count }, (_, i) => {
            const selected = i === value;
            return (
              <button
                key={i}
                type="button"
                role="option"
                aria-selected={selected}
                tabIndex={-1}
                onClick={() => pick(i)}
                className={`relative z-[15] w-full flex items-center justify-center bg-transparent border-0 cursor-pointer om-metric tabular-nums transition-colors ${
                  selected ? 'text-[var(--om-text)] text-xl' : 'text-[var(--om-muted)] text-lg opacity-60'
                }`}
                style={{ height: WHEEL_ITEM_H, scrollSnapAlign: 'center', fontFamily: 'inherit' }}
              >
                {String(i).padStart(2, '0')}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Pop-up de réglage : trois molettes h / min / sec, validées d'un bloc. */
function DurationPickerModal({ initialSeconds, onCancel, onConfirm }) {
  const [hours, setHours] = useState(Math.floor(initialSeconds / 3600));
  const [minutes, setMinutes] = useState(Math.floor((initialSeconds % 3600) / 60));
  const [seconds, setSeconds] = useState(initialSeconds % 60);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const total = hours * 3600 + minutes * 60 + seconds;

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-end md:items-center justify-center p-3 md:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Choisir la durée"
    >
      <div className="om-scrim fixed inset-0" onClick={onCancel} />
      <div
        className="om-card relative z-10 w-full max-w-sm p-5 flex flex-col gap-4 animate-om-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="om-kicker">Durée de la session</span>
          <button type="button" onClick={onCancel} className="om-icon-btn w-8 h-8" aria-label="Fermer">
            <i className="ph ph-x text-[14px]" aria-hidden />
          </button>
        </div>

        <div className="flex items-start justify-center gap-2 sm:gap-4">
          <WheelColumn label="Heures" count={24} value={hours} onChange={setHours} />
          <WheelColumn label="Min" count={60} value={minutes} onChange={setMinutes} />
          <WheelColumn label="Sec" count={60} value={seconds} onChange={setSeconds} />
        </div>

        <p className="text-center text-sm text-[var(--om-muted)] min-h-[1.25rem]">
          {total > 0 ? formatDuration(hours, minutes, seconds) : 'Choisis une durée supérieure à 0'}
        </p>

        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onCancel} className="om-btn om-btn-ghost">
            Annuler
          </button>
          <button
            type="button"
            onClick={() => onConfirm(total)}
            disabled={total <= 0}
            className="om-btn om-btn-primary"
          >
            Valider
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function Timer() {
  const saved = loadTimerState();
  const [totalSeconds, setTotalSeconds] = useState(saved?.totalSeconds ?? DEFAULT_TOTAL_SECONDS);
  const [remainingMsTotal, setRemainingMsTotal] = useState(
    saved?.remainingMsTotal ?? (saved?.totalSeconds ?? DEFAULT_TOTAL_SECONDS) * 1000
  );
  const [isRunning, setIsRunning] = useState(saved?.isRunning ?? false);
  const [showPicker, setShowPicker] = useState(false);
  const intervalRef = useRef(null);

  // La durée choisie est repersistée à chaque changement : elle est retrouvée
  // telle quelle à la session suivante.
  useEffect(() => {
    saveTimerState({ totalSeconds, remainingMsTotal, isRunning });
  }, [totalSeconds, remainingMsTotal, isRunning]);

  const currentElapsed = totalSeconds - remainingMsTotal / 1000;
  const progressSecond = totalSeconds > 0 ? (currentElapsed / totalSeconds) * RAY_COUNT : 0;

  useEffect(() => {
    if (isRunning && remainingMsTotal > 0) {
      intervalRef.current = setInterval(() => {
        setRemainingMsTotal((ms) => {
          const next = Math.max(0, ms - 100);
          if (next <= 0) setIsRunning(false);
          return next;
        });
      }, 100);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, remainingMsTotal]);

  const handlePlayPause = useCallback(() => {
    if (remainingMsTotal <= 0) return;
    setIsRunning((r) => !r);
  }, [remainingMsTotal]);

  const handleReset = useCallback(() => {
    setIsRunning(false);
    setRemainingMsTotal(totalSeconds * 1000);
  }, [totalSeconds]);

  const handleConfirmDuration = useCallback((total) => {
    const safe = Math.max(1, total);
    setTotalSeconds(safe);
    setRemainingMsTotal(safe * 1000);
    setIsRunning(false);
    setShowPicker(false);
  }, []);

  const displayH = Math.floor(remainingMsTotal / 3600000);
  const displayMin = Math.floor((remainingMsTotal % 3600000) / 60000);
  const displaySec = Math.floor((remainingMsTotal % 60000) / 1000);
  const displayCs = Math.floor((remainingMsTotal % 1000) / 10);
  const isConfigureMode = remainingMsTotal === totalSeconds * 1000 && !isRunning;

  const hasHours = totalSeconds >= 3600;
  const hasMinutes = totalSeconds >= 60;
  const timeDisplaySizeClass = hasHours
    ? 'text-xl sm:text-2xl'
    : hasMinutes
      ? 'text-3xl sm:text-4xl'
      : 'text-4xl sm:text-5xl';
  const separatorSizeClass = hasHours ? 'text-lg sm:text-xl' : hasMinutes ? 'text-2xl sm:text-3xl' : 'text-3xl sm:text-4xl';
  const msSizeClass = hasHours ? 'text-base sm:text-lg' : hasMinutes ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl';

  const setHours = Math.floor(totalSeconds / 3600);
  const setMinutes = Math.floor((totalSeconds % 3600) / 60);
  const setSecondsValue = totalSeconds % 60;

  return (
    <div className="flex flex-col items-center gap-[18px]">
      <span className="om-kicker">Session focus</span>
      <div className="relative w-[264px] h-[264px] sm:w-[288px] sm:h-[288px]">
        <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90 timer-rays-svg">
          <defs>
            {/* userSpaceOnUse évite une bbox dégénérée sur les barres à 0°/90°/180°/270° */}
            <linearGradient
              id="timer-ray-elapsed"
              gradientUnits="userSpaceOnUse"
              x1="0"
              y1="100"
              x2="200"
              y2="100"
            >
              <stop offset="0%" stopColor="var(--om-accent)" stopOpacity="0.95" />
              <stop offset="100%" stopColor="var(--om-pro)" stopOpacity="0.95" />
            </linearGradient>
          </defs>
          {Array.from({ length: RAY_COUNT }, (_, i) => {
            const elapsedIndex = totalSeconds > 0 ? (currentElapsed / totalSeconds) * RAY_COUNT : 0;
            const isElapsed = i < elapsedIndex;
            const lengthFactor = getRayLength(i, progressSecond);
            const innerR = 68;
            const outerR = innerR + 35 * (isElapsed ? lengthFactor : lengthFactor * 0.4);
            const rad = (i / RAY_COUNT) * 2 * Math.PI;
            const x1 = 100 + innerR * Math.cos(rad);
            const y1 = 100 + innerR * Math.sin(rad);
            const x2 = 100 + outerR * Math.cos(rad);
            const y2 = 100 + outerR * Math.sin(rad);
            return (
              <g key={i}>
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="var(--om-track)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  className="timer-ray-base"
                />
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="url(#timer-ray-elapsed)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  className="timer-ray-elapsed"
                  style={{
                    opacity: isElapsed ? 1 : 0,
                  }}
                />
              </g>
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center px-2">
          <div className={`${timeDisplaySizeClass} om-metric text-[var(--om-text)] flex flex-wrap items-baseline justify-center gap-x-0.5`}>
            {hasHours && (
              <>
                {String(displayH).padStart(2, '0')}
                <span className={`${separatorSizeClass} mx-0.5`}>:</span>
              </>
            )}
            {hasMinutes && (
              <>
                {String(displayMin).padStart(2, '0')}
                <span className={`${separatorSizeClass} mx-0.5`}>:</span>
              </>
            )}
            {String(displaySec).padStart(2, '0')}
            <>
              <span className={`${msSizeClass} mx-0.5 text-[var(--om-accent)]`}>.</span>
              {String(displayCs).padStart(2, '0')}
            </>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-1.5 mt-1.5 text-[var(--om-muted)] min-h-[1.25rem] font-medium" style={{ fontSize: hasHours ? '0.65rem' : '0.7rem' }}>
            {hasHours && <><span>h</span><span className="opacity-50">·</span></>}
            {hasMinutes && <><span>min</span><span className="opacity-50">·</span></>}
            <span>{hasMinutes ? (hasHours ? 's' : 'sec') : 'sec'}</span>
            <span className="opacity-50">·</span>
            <span>ms</span>
          </div>
        </div>
      </div>

      {isConfigureMode ? (
        <button
          type="button"
          onClick={() => setShowPicker(true)}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--om-line)] bg-[var(--om-surface-2)] px-4 py-2 text-sm font-medium text-[var(--om-text)] cursor-pointer transition-colors hover:border-[var(--om-accent)] hover:text-[var(--om-accent)]"
          aria-label="Modifier la durée de la session"
        >
          <i className="ph ph-clock text-[16px] text-[var(--om-muted)]" aria-hidden />
          <span className="tabular-nums">{formatDuration(setHours, setMinutes, setSecondsValue)}</span>
        </button>
      ) : null}

      <div className="flex items-center gap-3.5">
        <button
          type="button"
          onClick={handleReset}
          className="om-icon-btn w-[46px] h-[46px] border-[var(--om-line)] bg-transparent text-[var(--om-muted)] hover:text-[var(--om-text)]"
          aria-label="Réinitialiser"
        >
          <i className="ph ph-arrow-counter-clockwise text-[19px]" aria-hidden />
        </button>
        <button
          type="button"
          onClick={handlePlayPause}
          disabled={remainingMsTotal <= 0}
          className="om-btn om-btn-primary h-14 px-8"
        >
          <i
            className={`ph-fill ${isRunning ? 'ph-pause' : 'ph-play'} text-[18px]`}
            aria-hidden
          />
          {isRunning ? 'Pause' : isConfigureMode ? 'Démarrer' : 'Reprendre'}
        </button>
      </div>

      {showPicker ? (
        <DurationPickerModal
          initialSeconds={totalSeconds}
          onCancel={() => setShowPicker(false)}
          onConfirm={handleConfirmDuration}
        />
      ) : null}
    </div>
  );
}

export default Timer;
