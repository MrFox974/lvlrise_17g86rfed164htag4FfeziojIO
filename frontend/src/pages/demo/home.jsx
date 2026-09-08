import { useLoaderData, Await, useSearchParams } from 'react-router-dom';
import { Suspense, useState, useCallback, useEffect, useMemo } from 'react';
import { fetchDemoTodos, fetchDemoStats, getDemoApprentissageSync } from '../../utils/demoApi';
import { TAG_ORDER } from '../../lib/tags';
import {
  PeriodToggle,
  GoalCard,
  PrioritiesCard,
  RoutinesCard,
} from '../../components/overview/OverviewCards';

function sortByPriority(todos) {
  return [...todos].sort((a, b) => {
    const aIndex = TAG_ORDER.indexOf(a.tag);
    const bIndex = TAG_ORDER.indexOf(b.tag);
    const safeA = aIndex === -1 ? TAG_ORDER.length : aIndex;
    const safeB = bIndex === -1 ? TAG_ORDER.length : bIndex;
    if (safeA !== safeB) return safeA - safeB;
    return (b.progress || 0) - (a.progress || 0);
  });
}

function DemoHomeStats({ initialStats }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlPeriod = searchParams.get('period') || 'day';
  const [period, setPeriod] = useState(urlPeriod);
  const [stats, setStats] = useState(initialStats);
  const [loading, setLoading] = useState(false);
  const [priorityTodos, setPriorityTodos] = useState([]);
  const [loadingTodos, setLoadingTodos] = useState(true);
  const [todosError, setTodosError] = useState('');

  useEffect(() => {
    setPeriod(urlPeriod);
  }, [urlPeriod]);

  // Retour navigateur : l'URL change sans passer par le toggle, on resynchronise.
  useEffect(() => {
    if (urlPeriod !== period) {
      setLoading(true);
      fetchDemoStats({ period: urlPeriod })
        .then((data) => setStats(data))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlPeriod]);

  useEffect(() => {
    const ac = new AbortController();
    setLoadingTodos(true);
    setTodosError('');
    fetchDemoTodos({ signal: ac.signal })
      .then((data) => {
        const active = Array.isArray(data?.active) ? data.active : [];
        setPriorityTodos(sortByPriority(active).slice(0, 3));
      })
      .catch((error) => {
        if (error?.name === 'AbortError' || error?.code === 'ERR_CANCELED') return;
        setTodosError('Impossible de charger les tâches prioritaires');
        setPriorityTodos([]);
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoadingTodos(false);
      });

    return () => ac.abort();
  }, []);

  const handlePeriodChange = useCallback(
    (newPeriod) => {
      if (newPeriod === period) return;
      setPeriod(newPeriod);
      setLoading(true);
      fetchDemoStats({ period: newPeriod })
        .then((data) => {
          setStats(data);
          setSearchParams({ period: newPeriod });
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    },
    [period, setSearchParams]
  );

  const isDay = period === 'day';

  // Calcul synchrone : le cadran réagit au clic Jour/Semaine sans attendre le fetch.
  const apprentissage = useMemo(() => getDemoApprentissageSync(period), [period]);

  return (
    <div className="px-4 md:px-6 lg:px-8 pt-1 pb-6 max-w-6xl mx-auto w-full flex flex-col gap-3.5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="om-title">Vue d&apos;ensemble</h1>
        <PeriodToggle period={period} onPeriodChange={handlePeriodChange} isLoading={loading} />
      </div>

      <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-start">
        <GoalCard
          apprentissage={apprentissage}
          isDay={isDay}
          sessionHref="/demo/home/apprentissage"
        />
        <div className="flex flex-col gap-3.5">
          <PrioritiesCard
            todos={priorityTodos}
            loading={loadingTodos}
            error={todosError}
            todosHref="/demo/home/todos"
          />
          <RoutinesCard
            routines={stats?.routines}
            isDay={isDay}
            routinesHref="/demo/home/routines"
          />
        </div>
      </div>
    </div>
  );
}

function DemoHome() {
  const { stats } = useLoaderData();

  return (
    <Suspense
      fallback={
        <div className="px-4 md:px-6 pt-1 pb-6 max-w-6xl mx-auto w-full flex flex-col gap-3.5 animate-pulse">
          <div className="h-8 w-48 rounded-full bg-[var(--om-track)]" />
          <div className="h-[420px] rounded-[20px] bg-[var(--om-track)]" />
          <div className="h-40 rounded-[20px] bg-[var(--om-track)]" />
        </div>
      }
    >
      <Await
        resolve={stats}
        errorElement={
          <div className="p-8 max-w-4xl mx-auto text-center">
            <p className="text-sm text-[var(--om-danger)]">
              Erreur lors du chargement des statistiques.
            </p>
          </div>
        }
      >
        {(resolvedStats) => <DemoHomeStats initialStats={resolvedStats} />}
      </Await>
    </Suspense>
  );
}

export default DemoHome;
