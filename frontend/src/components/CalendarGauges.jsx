import { useEffect, useState, useMemo } from 'react';
import { fetchDomainDailyProgress } from '../utils/domainApi';
import { fetchDemoDomainDailyProgress } from '../utils/demoApi';
import { useDemoMode } from '../hooks/useDemoMode';

function DayCell({ date, dayNum, progress, maxSum, isToday, accentColor, completedColor, animated }) {
  const percent = maxSum > 0 ? Math.min(100, (progress / maxSum) * 100) : 0;
  const isCompleted = percent >= 100;
  const stroke = isCompleted ? completedColor : accentColor;
  const [displayPercent, setDisplayPercent] = useState(0);

  useEffect(() => {
    if (!animated) {
      setDisplayPercent(percent);
      return;
    }
    const t = setTimeout(() => setDisplayPercent(percent), 50);
    return () => clearTimeout(t);
  }, [percent, animated]);

  return (
    <div
      className="flex flex-col items-center justify-center rounded-2xl p-1 min-h-[48px] md:min-h-[52px]"
      style={
        isToday
          ? {
              boxShadow: 'inset 0 0 0 1.5px var(--om-accent)',
              background: 'color-mix(in oklch, var(--om-accent) 8%, transparent)',
            }
          : undefined
      }
    >
      <span className="text-[11px] font-medium tabular-nums text-[var(--om-muted)] mb-0.5">
        {dayNum || ''}
      </span>
      <div className="relative w-7 h-7 md:w-8 md:h-8 flex items-center justify-center">
        {isCompleted ? (
          <div
            className="w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center animate-om-pop"
            style={{ backgroundColor: completedColor }}
          >
            <i
              className="ph-bold ph-check text-[13px]"
              style={{ color: 'var(--om-on-accent)' }}
              aria-hidden
            />
          </div>
        ) : (
          <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
            <circle
              cx="18"
              cy="18"
              r="14"
              fill="none"
              stroke="var(--om-track)"
              strokeWidth="3"
            />
            {/* À 0 %, le linecap arrondi dessinerait un point parasite */}
            {displayPercent > 0 && (
              <circle
                cx="18"
                cy="18"
                r="14"
                fill="none"
                stroke={stroke}
                strokeWidth="3"
                className="transition-all duration-500 ease-out"
                strokeDasharray={`${displayPercent * 0.88} 88`}
                strokeLinecap="round"
              />
            )}
          </svg>
        )}
      </div>
    </div>
  );
}

function sumDomainMinutes(domainGauges, type) {
  if (!Array.isArray(domainGauges)) return 0;
  return domainGauges
    .filter((d) => (d.type || 'perso') === type)
    .reduce((acc, d) => acc + (d.actualMinutes ?? 0), 0);
}

function sumDomainTarget(domainGauges, type) {
  if (!Array.isArray(domainGauges)) return 0;
  return domainGauges
    .filter((d) => (d.type || 'perso') === type)
    .reduce((acc, d) => acc + (d.expectedMinutes ?? 0), 0);
}

function CalendarGauges({ slideIndex, domainGauges, refreshTrigger = 0 }) {
  const [byDate, setByDate] = useState({});
  const [monthOffset, setMonthOffset] = useState(0);
  const [animated, setAnimated] = useState(false);
  const isDemo = useDemoMode();
  const today = new Date().toISOString().slice(0, 10);

  const now = new Date();
  const viewDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const startDate = new Date(year, month, 1).toISOString().slice(0, 10);
  const endDate = new Date(year, month + 1, 0).toISOString().slice(0, 10);

  const isPerso = slideIndex === 0;
  const todayPerso = useMemo(() => sumDomainMinutes(domainGauges, 'perso'), [domainGauges]);
  const todayPro = useMemo(() => sumDomainMinutes(domainGauges, 'pro'), [domainGauges]);
  const todayPersoTarget = useMemo(() => sumDomainTarget(domainGauges, 'perso'), [domainGauges]);
  const todayProTarget = useMemo(() => sumDomainTarget(domainGauges, 'pro'), [domainGauges]);
  const maxSum = isPerso ? Math.max(1, todayPersoTarget) : Math.max(1, todayProTarget);
  const accentColor = isPerso ? 'var(--om-accent)' : 'var(--om-pro-strong)';
  const completedColor = isPerso ? 'var(--om-accent)' : 'var(--om-pro-strong)';

  useEffect(() => {
    const fetchFn = isDemo ? fetchDemoDomainDailyProgress : fetchDomainDailyProgress;
    fetchFn(startDate, endDate)
      .then(setByDate)
      .catch(() => setByDate({}));
    setAnimated(false);
    const t = setTimeout(() => setAnimated(true), 80);
    return () => clearTimeout(t);
  }, [startDate, endDate, refreshTrigger, isDemo]);

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = (firstDay.getDay() + 6) % 7;
  const daysInMonth = lastDay.getDate();

  const days = [];
  for (let i = 0; i < startPad; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const data = byDate[dateStr];
    const progress =
      dateStr === today
        ? isPerso ? todayPerso : todayPro
        : isPerso ? (data?.perso ?? 0) : (data?.pro ?? 0);
    const dayMax = dateStr === today ? maxSum : (isPerso ? (data?.persoTarget ?? 1) : (data?.proTarget ?? 1));
    days.push({ date: dateStr, dayNum: d, progress, maxSum: Math.max(1, dayMax) });
  }

  return (
    <section className="om-card p-4">
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => setMonthOffset((m) => m - 1)}
          className="om-icon-btn w-[30px] h-[30px]"
          aria-label="Mois précédent"
        >
          <i className="ph ph-caret-left text-[14px]" aria-hidden />
        </button>
        <h3 className="text-[13px] font-medium tracking-[0.04em] text-[var(--om-text)] capitalize">
          {new Date(year, month).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
        </h3>
        <button
          type="button"
          onClick={() => setMonthOffset((m) => m + 1)}
          className="om-icon-btn w-[30px] h-[30px]"
          aria-label="Mois suivant"
        >
          <i className="ph ph-caret-right text-[14px]" aria-hidden />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 md:gap-1.5">
        {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => (
          <div
            key={d}
            className="text-center whitespace-nowrap om-kicker pb-0.5"
          >
            {d}
          </div>
        ))}
        {days.map((cell, i) =>
          cell ? (
            <DayCell
              key={i}
              date={cell.date}
              dayNum={cell.dayNum}
              progress={cell.progress}
              maxSum={cell.maxSum}
              isToday={cell.date === today}
              accentColor={accentColor}
              completedColor={completedColor}
              animated={animated}
            />
          ) : (
            <div key={i} />
          )
        )}
      </div>
      <div className="flex items-center gap-3.5 mt-3.5 text-[11px] text-[var(--om-muted)]">
        <span className="flex items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: completedColor }}
            aria-hidden
          />
          objectif atteint
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-full border-[1.5px]"
            style={{ borderColor: 'var(--om-muted)' }}
            aria-hidden
          />
          partiel
        </span>
      </div>
    </section>
  );
}

export default CalendarGauges;
