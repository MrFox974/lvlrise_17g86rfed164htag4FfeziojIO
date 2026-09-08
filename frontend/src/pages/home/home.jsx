import { useLoaderData, Await, useSearchParams } from 'react-router-dom';
import { Suspense, useState, useCallback, useEffect } from 'react';
import { fetchTodos } from '../../utils/todoApi';
import { fetchStats } from '../../utils/statsApi';
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

function HomeStats({ initialStats }) {
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

  useEffect(() => {
    const ac = new AbortController();
    setLoadingTodos(true);
    setTodosError('');
    fetchTodos({ signal: ac.signal })
      .then((data) => {
        const active = Array.isArray(data?.active) ? data.active : [];
        const mainOnly = active.filter((todo) => (todo.group_name || 'Main') === 'Main');
        setPriorityTodos(sortByPriority(mainOnly).slice(0, 3));
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
      setSearchParams({ period: newPeriod });
      setLoading(true);
      fetchStats({ period: newPeriod })
        .then((data) => {
          setStats({
            period: data.period,
            apprentissage: { ...data.apprentissage },
            routines: { ...data.routines },
            topTodos: [...(data.topTodos || [])],
            periodDates: { ...data.periodDates },
          });
        })
        .catch((error) => {
          console.error('Erreur lors du chargement des stats:', error);
        })
        .finally(() => setLoading(false));
    },
    [period, setSearchParams]
  );

  const isDay = period === 'day';

  return (
    <div className="px-4 md:px-6 lg:px-8 pt-1 pb-6 max-w-6xl mx-auto w-full flex flex-col gap-3.5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="om-title">Vue d&apos;ensemble</h1>
        <PeriodToggle period={period} onPeriodChange={handlePeriodChange} isLoading={loading} />
      </div>

      <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-start">
        <GoalCard
          apprentissage={stats?.apprentissage}
          isDay={isDay}
          sessionHref="/home/apprentissage"
        />
        <div className="flex flex-col gap-3.5">
          <PrioritiesCard
            todos={priorityTodos}
            loading={loadingTodos}
            error={todosError}
            todosHref="/home/todos"
          />
          <RoutinesCard routines={stats?.routines} isDay={isDay} routinesHref="/home/routines" />
        </div>
      </div>
    </div>
  );
}

function HomeFallback() {
  return (
    <div className="px-4 md:px-6 pt-1 pb-6 max-w-6xl mx-auto w-full flex flex-col gap-3.5 animate-pulse">
      <div className="h-8 w-48 rounded-full bg-[var(--om-track)]" />
      <div className="h-[420px] rounded-[20px] bg-[var(--om-track)]" />
      <div className="h-40 rounded-[20px] bg-[var(--om-track)]" />
    </div>
  );
}

function Home() {
  const { stats } = useLoaderData();

  return (
    <Suspense fallback={<HomeFallback />}>
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
        {(resolvedStats) => <HomeStats initialStats={resolvedStats} />}
      </Await>
    </Suspense>
  );
}

export default Home;
