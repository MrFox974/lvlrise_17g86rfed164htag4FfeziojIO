import { Link } from 'react-router-dom';
import { getTagColor, getTagLabel } from '../../lib/tags';

/* -------------------------------------------------------------------------
 * Géométrie des cadrans
 * Un seul arc ouvert de 45° en bas, rempli de la droite vers la gauche.
 * ---------------------------------------------------------------------- */

const GAP_DEG = 45;
const ARC_FRACTION = 1 - GAP_DEG / 360;

function arcPath(center, radius) {
  const toRad = (d) => (d * Math.PI) / 180;
  const startDeg = 90 - GAP_DEG / 2;
  const endDeg = 90 + GAP_DEG / 2;
  const sx = center + radius * Math.cos(toRad(startDeg));
  const sy = center + radius * Math.sin(toRad(startDeg));
  const ex = center + radius * Math.cos(toRad(endDeg));
  const ey = center + radius * Math.sin(toRad(endDeg));
  return `M ${sx} ${sy} A ${radius} ${radius} 0 1 0 ${ex} ${ey}`;
}

function arcLength(radius) {
  return 2 * Math.PI * radius * ARC_FRACTION;
}

function dashFromPct(pct, length) {
  const filled = (Math.min(100, Math.max(0, pct)) / 100) * length;
  return `${filled} ${length - filled}`;
}

const ARC_TRANSITION = 'stroke-dasharray .8s cubic-bezier(.2,.8,.2,1)';

/** Anneau de progression compact (priorités, listes). */
export function ProgressRing({ pct, size = 34, stroke = 3, color = 'var(--om-accent)', children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const filled = (Math.min(100, Math.max(0, pct)) / 100) * c;
  return (
    <span className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--om-track)" strokeWidth={stroke} />
        {/* À 0 %, le linecap arrondi dessinerait un point parasite */}
        {filled > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${c - filled}`}
            style={{ transition: ARC_TRANSITION }}
          />
        )}
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center text-[9.5px] tabular-nums"
        style={{ color: 'var(--om-muted)' }}
      >
        {children}
      </span>
    </span>
  );
}

/** Cadran double : deux arcs concentriques, une série chacun. */
export function GoalDial({ innerPct, outerPct, size = 260 }) {
  const center = size / 2;
  const outerR = size * 0.3306;
  const innerR = size * 0.2686;
  const outerLen = arcLength(outerR);
  const innerLen = arcLength(innerR);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible" aria-hidden>
      <path d={arcPath(center, outerR)} fill="none" stroke="var(--om-track)" strokeWidth="13" strokeLinecap="round" />
      <path
        d={arcPath(center, outerR)}
        fill="none"
        stroke="var(--om-pro)"
        strokeWidth="13"
        strokeLinecap="round"
        strokeDasharray={dashFromPct(outerPct, outerLen)}
        style={{ transition: ARC_TRANSITION }}
      />
      <path d={arcPath(center, innerR)} fill="none" stroke="var(--om-track)" strokeWidth="11" strokeLinecap="round" />
      <path
        d={arcPath(center, innerR)}
        fill="none"
        stroke="var(--om-perso)"
        strokeWidth="11"
        strokeLinecap="round"
        strokeDasharray={dashFromPct(innerPct, innerLen)}
        style={{ transition: ARC_TRANSITION }}
      />
    </svg>
  );
}

/* -------------------------------------------------------------------------
 * Cartes
 * ---------------------------------------------------------------------- */

export function PeriodToggle({ period, onPeriodChange, isLoading }) {
  const isDay = period === 'day';
  return (
    <div className="flex items-center gap-2.5">
      {isLoading && (
        <span
          className="w-4 h-4 rounded-full border-2 border-[var(--om-track)] border-t-[var(--om-accent)] animate-spin"
          aria-hidden
        />
      )}
      <div className="om-segment">
        <button
          type="button"
          onClick={() => onPeriodChange('day')}
          className="om-segment-item"
          data-active={isDay}
        >
          Jour
        </button>
        <button
          type="button"
          onClick={() => onPeriodChange('week')}
          className="om-segment-item"
          data-active={!isDay}
        >
          Semaine
        </button>
      </div>
    </div>
  );
}

/**
 * Cadran des révisions : arc extérieur = cartes révisées sur la période,
 * arc intérieur = cartes encore dues. Les deux se lisent sur la charge de la
 * période (révisées + restantes), il n'y a donc pas d'objectif à régler.
 */
export function ReviewCard({ flashcards, isDay, sessionHref }) {
  const {
    reviewed = 0,
    due = 0,
    target = 0,
    totalCards = 0,
  } = flashcards || {};

  const reviewedPct = target > 0 ? (reviewed / target) * 100 : 0;
  const duePct = target > 0 ? (due / target) * 100 : 0;
  const percent = target > 0 ? Math.round((reviewed / target) * 100) : 0;

  const hasDeck = totalCards > 0;
  const cta = due > 0 ? 'Lancer une session' : 'Ouvrir mes collections';

  return (
    <section className="om-card om-halo p-5 md:p-6">
      <div className="flex flex-col items-center gap-3.5">
        <span className="om-kicker">Révisions {isDay ? '(jour)' : '(semaine)'}</span>

        {/* Le cadran grandit ; le bloc central garde ses tailles de texte et
            reste centré, donc les chiffres ne bougent pas. */}
        <div className="relative w-[260px] h-[260px] flex items-center justify-center">
          <GoalDial innerPct={duePct} outerPct={reviewedPct} />
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="om-metric text-[34px] text-[var(--om-text)]">{reviewed}</span>
            <span className="text-xs text-[var(--om-muted)] mt-1">
              {target > 0
                ? `sur ${target} carte${target > 1 ? 's' : ''}`
                : hasDeck
                  ? 'rien à réviser'
                  : 'aucune carte'}
            </span>
            <span className="om-kicker mt-2" style={{ color: 'var(--om-accent)' }}>
              {percent}%
            </span>
          </div>
        </div>

        <div className="flex gap-2 w-full">
          <div className="flex-1 flex flex-col gap-1 px-3 py-2.5 rounded-2xl bg-[var(--om-surface-2)]">
            <span className="flex items-center gap-1.5">
              <span className="w-[7px] h-[7px] rounded-full bg-[var(--om-pro)]" aria-hidden />
              <span className="om-kicker">Révisées</span>
            </span>
            <span className="text-[15px] font-medium tabular-nums text-[var(--om-text)]">
              {reviewed}
            </span>
          </div>
          <div className="flex-1 flex flex-col gap-1 px-3 py-2.5 rounded-2xl bg-[var(--om-surface-2)]">
            <span className="flex items-center gap-1.5">
              <span className="w-[7px] h-[7px] rounded-full bg-[var(--om-perso)]" aria-hidden />
              <span className="om-kicker">À réviser</span>
            </span>
            <span className="text-[15px] font-medium tabular-nums text-[var(--om-text)]">
              {due}
            </span>
          </div>
        </div>

        <Link to={sessionHref} className="om-btn om-btn-primary w-full">
          {cta}
          <i className="ph ph-arrow-right text-[16px]" aria-hidden />
        </Link>
      </div>
    </section>
  );
}

export function PrioritiesCard({ todos, loading, error, todosHref }) {
  return (
    <section className="om-card p-[18px]">
      <div className="flex items-center justify-between mb-3.5">
        <span className="om-kicker">Priorités</span>
        <Link to={todosHref} className="text-xs text-[var(--om-accent)] hover:underline">
          Tout voir
        </Link>
      </div>

      {loading && (
        <div className="flex flex-col gap-2.5 animate-pulse" aria-hidden>
          <div className="h-9 rounded-2xl bg-[var(--om-track)]" />
          <div className="h-9 rounded-2xl bg-[var(--om-track)]" />
          <div className="h-9 rounded-2xl bg-[var(--om-track)]" />
        </div>
      )}

      {!loading && error && <p className="text-sm text-[var(--om-danger)]">{error}</p>}

      {!loading && !error && todos.length === 0 && (
        <p className="text-sm text-[var(--om-muted)]">Aucune tâche prioritaire pour le moment.</p>
      )}

      {!loading && !error && todos.length > 0 && (
        <ul className="flex flex-col gap-2.5 list-none m-0 p-0">
          {todos.map((todo) => {
            const tone = getTagColor(todo.tag);
            const pct = typeof todo.progress === 'number' ? todo.progress : 0;
            return (
              <li key={todo.id}>
                <Link to={todosHref} className="flex items-center gap-3">
                  <span
                    className="w-[3px] h-[34px] rounded-full flex-shrink-0"
                    style={{ backgroundColor: tone }}
                    aria-hidden
                  />
                  <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-[var(--om-text)] truncate">{todo.name}</span>
                    <span
                      className="text-[11px] uppercase tracking-[0.04em] truncate"
                      style={{ color: 'var(--om-muted)' }}
                    >
                      {getTagLabel(todo.tag)}
                    </span>
                  </span>
                  <ProgressRing pct={pct} color={tone}>
                    {pct}
                  </ProgressRing>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function RoutinesCard({ routines, isDay, routinesHref }) {
  const done = routines?.done ?? 0;
  const total = routines?.total ?? 0;
  const pct = total > 0 ? (done / total) * 100 : 0;
  const useSegments = total > 0 && total <= 12;

  const hint =
    total === 0
      ? 'Aucune routine planifiée pour cette période.'
      : done >= total
        ? 'Toutes les routines sont bouclées. La série tient.'
        : `Encore ${total - done} routine${total - done > 1 ? 's' : ''} pour boucler ${
            isDay ? 'la journée' : 'la semaine'
          }.`;

  return (
    <section className="om-card p-[18px]">
      <div className="flex items-center justify-between mb-3.5">
        <Link to={routinesHref} className="om-kicker hover:text-[var(--om-text)] transition-colors">
          Routines {isDay ? '(jour)' : '(semaine)'}
        </Link>
        <span className="text-sm font-medium tabular-nums text-[var(--om-text)]">
          {done} / {total}
        </span>
      </div>

      {useSegments ? (
        <div className="flex gap-1.5" aria-hidden>
          {Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              className="flex-1 h-2 rounded-full transition-colors duration-300"
              style={{ background: i < done ? 'var(--om-accent)' : 'var(--om-track)' }}
            />
          ))}
        </div>
      ) : (
        <div className="om-track h-2" aria-hidden>
          <div className="om-fill" style={{ width: `${pct}%` }} />
        </div>
      )}

      <p className="mt-3 text-xs text-[var(--om-muted)]">{hint}</p>
    </section>
  );
}
