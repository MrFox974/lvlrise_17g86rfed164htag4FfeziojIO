import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  isAdmin,
  fetchAdminEvents,
  fetchAdminStats,
  fetchTelegramTest,
  fetchPushDiagnostics,
  sendPushTest,
} from '../../utils/adminApi';
import { ensurePushSubscription, getPushResultMessage, PUSH_RESULT } from '../../lib/push';

/** Types de notifications envoyées par le scheduler, dans l'ordre de la journée. */
const PUSH_KINDS = [
  { kind: 'morning_greeting', label: '☀️ Bonjour' },
  { kind: 'todo_reminder', label: '📋 Rappel to-do' },
  { kind: 'routine_reminder', label: '🔔 Rappel de routine' },
  { kind: 'daily_report', label: '📊 Bilan du jour' },
  { kind: 'night_greeting', label: '🌙 Bonne nuit' },
];

const PUSH_KIND_LABELS = Object.fromEntries(PUSH_KINDS.map((k) => [k.kind, k.label]));

const PLAN_LABELS = {
  free: 'Découverte',
  pro: 'Croissance',
  premium: 'Maîtrise',
  admin_4188348183671877818917: 'Admin',
};

const EVENT_TYPE_LABELS = {
  user_registered: 'Inscription',
  subscription_change: 'Changement abonnement',
  unsubscription: 'Désabonnement',
  page_visit: 'Visite page',
};

function TelegramTestButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleTest = useCallback(async () => {
    setLoading(true);
    setResult(null);
    try {
      const data = await fetchTelegramTest();
      setResult(data);
    } catch (e) {
      setResult({ success: false, error: e.response?.data?.error || e.message });
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={handleTest}
        disabled={loading}
        className="px-4 py-2 rounded-2xl text-sm font-medium bg-[var(--om-accent)] text-[var(--om-on-accent)] hover:bg-[var(--om-accent-hover)] disabled:opacity-60 transition-colors"
      >
        {loading ? 'Test...' : '🧪 Tester Telegram'}
      </button>
      {result && (
        <div
          className={`text-xs p-2 rounded-[10px] max-w-xs ${
            result.success ? 'bg-[var(--om-success-soft)] text-[var(--om-success)]' : 'bg-[var(--om-danger-soft)] text-[var(--om-danger-strong)]'
          }`}
        >
          {result.success ? (
            <>✓ Message envoyé ! Vérifiez Telegram.</>
          ) : (
            <>
              ✗ Échec: {result.error || 'Inconnu'}
              {result.telegramResponse && (
                <pre className="mt-1 overflow-auto text-[10px]">
                  {JSON.stringify(result.telegramResponse, null, 2)}
                </pre>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Test des notifications push : abonne l'appareil courant si besoin, puis
 * envoie la vraie notification du type choisi (construite avec les données du
 * compte). Affiche aussi le programme du jour tel que le cron le voit.
 */
function PushTestButton() {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState(PUSH_KINDS[0].kind);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [diagnostics, setDiagnostics] = useState(null);

  const loadDiagnostics = useCallback(async () => {
    try {
      setDiagnostics(await fetchPushDiagnostics());
    } catch {
      setDiagnostics(null);
    }
  }, []);

  const handleOpen = useCallback(() => {
    setOpen((prev) => {
      if (!prev) loadDiagnostics();
      return !prev;
    });
  }, [loadDiagnostics]);

  const handleTest = useCallback(async () => {
    setLoading(true);
    setResult(null);
    try {
      // L'abonnement doit partir d'un clic : c'est le cas ici.
      const pushResult = await ensurePushSubscription();
      if (pushResult !== PUSH_RESULT.OK) {
        setResult({ success: false, error: getPushResultMessage(pushResult) });
        return;
      }
      const data = await sendPushTest(kind);
      setResult(data);
      loadDiagnostics();
    } catch (e) {
      setResult({ success: false, error: e.response?.data?.error || e.message });
    } finally {
      setLoading(false);
    }
  }, [kind, loadDiagnostics]);

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={handleOpen}
        aria-expanded={open}
        className="px-4 py-2 rounded-2xl text-sm font-medium bg-[var(--om-accent)] text-[var(--om-on-accent)] hover:bg-[var(--om-accent-hover)] transition-colors"
      >
        🔔 Tester les notifications
      </button>

      {open && (
        <div className="w-full sm:w-80 p-3 om-card flex flex-col gap-2.5">
          {diagnostics && (
            <div className="text-xs text-[var(--om-muted)] leading-relaxed">
              <div>
                Serveur :{' '}
                <span className={diagnostics.configured ? 'text-[var(--om-success)]' : 'text-[var(--om-danger-strong)]'}>
                  {diagnostics.configured ? 'clés VAPID OK' : 'clés VAPID manquantes'}
                </span>
              </div>
              <div>
                Appareils abonnés : <strong>{diagnostics.devices}</strong> · {diagnostics.timezone}
              </div>
              <div>
                Heure locale : <strong className="tabular-nums">{diagnostics.local_time}</strong> ({diagnostics.local_date})
              </div>
            </div>
          )}

          <label className="text-xs font-medium text-[var(--om-text)]" htmlFor="push-kind">
            Message à envoyer
          </label>
          <select
            id="push-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="w-full px-3 py-2 rounded-[10px] border border-[var(--om-line)] bg-[var(--om-surface-2)] text-sm text-[var(--om-text)] focus:outline-none focus:border-[var(--om-accent)]/50"
          >
            {PUSH_KINDS.map((k) => (
              <option key={k.kind} value={k.kind}>
                {k.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleTest}
            disabled={loading}
            className="w-full px-4 py-2 rounded-[10px] text-sm font-medium bg-[var(--om-accent)] text-[var(--om-on-accent)] hover:bg-[var(--om-accent-hover)] disabled:opacity-60 transition-colors"
          >
            {loading ? 'Envoi…' : 'Envoyer sur cet appareil'}
          </button>

          {result && (
            <div
              className={`text-xs p-2 rounded-[10px] ${
                result.success ? 'bg-[var(--om-success-soft)] text-[var(--om-success)]' : 'bg-[var(--om-danger-soft)] text-[var(--om-danger-strong)]'
              }`}
            >
              {result.success ? (
                <>
                  ✓ Envoyée sur {result.sent} appareil{result.sent > 1 ? 's' : ''}
                  {result.payload && (
                    <div className="mt-1.5 text-[var(--om-text)] bg-[var(--om-surface)]/70 rounded p-1.5">
                      <div className="font-medium">{result.payload.title}</div>
                      <div>{result.payload.body}</div>
                    </div>
                  )}
                </>
              ) : (
                <>✗ {result.error || 'Échec inconnu'}</>
              )}
            </div>
          )}

          {diagnostics?.schedule?.length > 0 && (
            <div className="text-xs">
              <div className="font-medium text-[var(--om-text)] mb-1">Programme d&apos;aujourd&apos;hui</div>
              <ul className="space-y-0.5 text-[var(--om-muted)]">
                {diagnostics.schedule.map((entry, i) => (
                  <li key={i} className="flex items-center gap-1.5">
                    <span className="tabular-nums font-medium">{entry.time}</span>
                    <span className="truncate">
                      {PUSH_KIND_LABELS[entry.kind] || entry.kind}
                      {entry.routine ? ` — ${entry.routine}` : ''}
                    </span>
                    {entry.sent && <span className="text-[var(--om-success)]">✓</span>}
                    {!entry.sent && entry.passed && <span className="text-[var(--om-warning)]">·</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function EventsTab({ events, loading, error }) {
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border border-[var(--om-accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-[var(--om-danger-soft)] border border-[var(--om-danger)] p-4 text-[var(--om-danger-strong)] text-sm">
        {error}
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="text-center py-12 text-[var(--om-muted)]">
        Aucun événement enregistré.
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-[60vh] overflow-y-auto no-scrollbar">
      {events.map((ev) => {
        const label = EVENT_TYPE_LABELS[ev.event_type] || ev.event_type;
        const payload = ev.payload || {};
        return (
          <div
            key={ev.id}
            className="rounded-2xl border border-[var(--om-line)] bg-[var(--om-surface)] p-4 shadow-[var(--om-shadow)]"
          >
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-xs font-medium text-[var(--om-accent)] uppercase tracking-[0.1em]">
                {label}
              </span>
              <span className="text-xs text-[var(--om-muted)]">
                {formatDate(ev.created_at)}
              </span>
              {ev.user_id && (
                <span className="text-xs text-[var(--om-muted)]">User #{ev.user_id}</span>
              )}
            </div>
            {Object.keys(payload).length > 0 && (
              <pre className="text-xs text-[var(--om-muted)] overflow-x-auto mt-2 p-2 rounded bg-[var(--om-surface-2)]">
                {JSON.stringify(payload, null, 2)}
              </pre>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StatsTab({ stats, loading, error }) {
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border border-[var(--om-accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-[var(--om-danger-soft)] border border-[var(--om-danger)] p-4 text-[var(--om-danger-strong)] text-sm">
        {error}
      </div>
    );
  }

  if (!stats) return null;

  const planCounts = stats.subscriptionsByPlan || {};
  const pageVisits = stats.pageVisitsByPath || [];
  const unsubs = stats.unsubscriptions || [];

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-sm font-medium text-[var(--om-muted)] uppercase tracking-[0.1em] mb-3">
          Utilisateurs
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-[var(--om-line)] bg-[var(--om-surface)] p-4 shadow-[var(--om-shadow)]">
            <p className="text-2xl font-medium text-[var(--om-accent)]">{stats.totalUsers ?? 0}</p>
            <p className="text-sm text-[var(--om-muted)]">Inscrits total</p>
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-medium text-[var(--om-muted)] uppercase tracking-[0.1em] mb-3">
          Abonnements par plan
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(planCounts).map(([plan, count]) => (
            <div
              key={plan}
              className="rounded-2xl border border-[var(--om-line)] bg-[var(--om-surface)] p-4 shadow-[var(--om-shadow)]"
            >
              <p className="text-xl font-medium text-[var(--om-text)]">{count}</p>
              <p className="text-sm text-[var(--om-muted)]">
                {PLAN_LABELS[plan] || plan}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-medium text-[var(--om-muted)] uppercase tracking-[0.1em] mb-3">
          Visites de pages
        </h3>
        <div className="rounded-2xl border border-[var(--om-line)] bg-[var(--om-surface)] p-4 shadow-[var(--om-shadow)]">
          <p className="text-lg font-medium text-[var(--om-accent)] mb-4">
            Total : {stats.totalPageVisits ?? 0} visites
          </p>
          <div className="max-h-48 overflow-y-auto space-y-2">
            {pageVisits.length === 0 ? (
              <p className="text-sm text-[var(--om-muted)]">Aucune donnée</p>
            ) : (
              pageVisits.map((row) => (
                <div
                  key={row.path}
                  className="flex justify-between items-center py-2 border-b border-[var(--om-line)] last:border-0"
                >
                  <span className="text-sm text-[var(--om-text)] truncate flex-1">
                    {row.path || '/'}
                  </span>
                  <span className="text-sm font-medium text-[var(--om-accent)] ml-2">
                    {row.count}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {unsubs.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-[var(--om-muted)] uppercase tracking-[0.1em] mb-3">
            Désabonnements récents (avec raisons)
          </h3>
          <div className="rounded-2xl border border-[var(--om-line)] bg-[var(--om-surface)] p-4 shadow-[var(--om-shadow)] space-y-3">
            {unsubs.slice(0, 10).map((u) => (
              <div
                key={u.id}
                className="py-2 border-b border-[var(--om-line)] last:border-0"
              >
                <p className="text-xs text-[var(--om-muted)]">{formatDate(u.created_at)}</p>
                <pre className="text-xs text-[var(--om-text)] mt-1 overflow-x-auto">
                  {JSON.stringify(u.payload || {}, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function AdminPanel() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tab, setTab] = useState('stats');
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState(null);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [eventsError, setEventsError] = useState('');
  const [statsError, setStatsError] = useState('');

  useEffect(() => {
    if (!user || !isAdmin(user)) {
      navigate('/home', { replace: true });
    }
  }, [user, navigate]);

  const loadEvents = useCallback(async () => {
    setEventsLoading(true);
    setEventsError('');
    try {
      const data = await fetchAdminEvents({ limit: 100 });
      setEvents(data);
    } catch (e) {
      setEventsError(e.response?.data?.error || 'Erreur lors du chargement des événements.');
    } finally {
      setEventsLoading(false);
    }
  }, []);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError('');
    try {
      const data = await fetchAdminStats();
      setStats(data);
    } catch (e) {
      setStatsError(e.response?.data?.error || 'Erreur lors du chargement des statistiques.');
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'events') loadEvents();
  }, [tab, loadEvents]);

  useEffect(() => {
    if (tab === 'stats') loadStats();
  }, [tab, loadStats]);

  if (!user || !isAdmin(user)) {
    return null;
  }

  return (
    <div className="px-4 md:px-6 lg:px-8 pt-1 pb-6 max-w-4xl mx-auto w-full">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-[17px] md:text-[19px] font-medium tracking-[-0.01em] text-[var(--om-text)] mb-1">
            Panel administrateur
          </h1>
          <p className="text-sm text-[var(--om-muted)]">
            Statistiques commerciales et journal des événements
          </p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-start gap-3">
          <TelegramTestButton />
          <PushTestButton />
        </div>
      </div>

      <div className="flex justify-center mb-6">
        <div className="inline-flex rounded-full border border-[var(--om-line)] bg-[var(--om-surface-2)] p-1 w-[220px]">
          <button
            type="button"
            onClick={() => setTab('stats')}
            className={`flex-1 py-2.5 rounded-full text-sm font-medium transition-all ${
              tab === 'stats'
                ? 'bg-[var(--om-accent)] text-[var(--om-on-accent)]'
                : 'text-[var(--om-muted)] hover:text-[var(--om-text)]'
            }`}
          >
            Stats
          </button>
          <button
            type="button"
            onClick={() => setTab('events')}
            className={`flex-1 py-2.5 rounded-full text-sm font-medium transition-all ${
              tab === 'events'
                ? 'bg-[var(--om-accent)] text-[var(--om-on-accent)]'
                : 'text-[var(--om-muted)] hover:text-[var(--om-text)]'
            }`}
          >
            Events
          </button>
        </div>
      </div>

      {tab === 'stats' && <StatsTab stats={stats} loading={statsLoading} error={statsError} />}
      {tab === 'events' && <EventsTab events={events} loading={eventsLoading} error={eventsError} />}
    </div>
  );
}

export default AdminPanel;
