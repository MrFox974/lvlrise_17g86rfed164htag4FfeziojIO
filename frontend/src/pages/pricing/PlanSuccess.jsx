import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { subscriptionComplete } from '../../utils/paymentApi';

const BILLING_LABELS = {
  monthly: 'abonnement mensuel',
  yearly: 'abonnement annuel',
};

const PLAN_LABELS = {
  free: 'Découverte',
  pro: 'Croissance',
  premium: 'Maîtrise',
};

function ConfettiLayer() {
  const base = 'absolute rounded-full opacity-80 confetti-fall top-0';
  const items = [
    { style: 'w-2 h-4 bg-[var(--om-accent)] left-[10%] rotate-12', duration: 4, delay: 0 },
    { style: 'w-2 h-4 bg-[var(--om-accent)] left-[25%] -rotate-12', duration: 5, delay: 0.5 },
    { style: 'w-2 h-4 bg-[var(--om-warning)] left-[40%] rotate-6', duration: 4.5, delay: 1 },
    { style: 'w-2 h-4 bg-[var(--om-success)] left-[55%] -rotate-6', duration: 5.5, delay: 0.2 },
    { style: 'w-2 h-4 bg-[var(--om-accent)] left-[70%] rotate-3', duration: 4.2, delay: 1.2 },
    { style: 'w-2 h-4 bg-[var(--om-warning)] left-[85%] -rotate-3', duration: 5.8, delay: 0.8 },
    { style: 'w-2 h-4 bg-[var(--om-accent)] left-[15%] rotate-9', duration: 6, delay: 1.5 },
    { style: 'w-2 h-4 bg-[var(--om-accent)] left-[45%] -rotate-9', duration: 4.8, delay: 2 },
    { style: 'w-2 h-4 bg-[var(--om-success)] left-[60%] rotate-12', duration: 5.2, delay: 0.3 },
    { style: 'w-2 h-4 bg-[var(--om-warning)] left-[90%] -rotate-6', duration: 4.6, delay: 1.8 },
  ];

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {items.map((item, i) => (
        <div
          key={i}
          className={`${base} ${item.style}`}
          style={{
            animationDuration: `${item.duration}s`,
            animationDelay: `${item.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

function PlanSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const syncDoneRef = useRef(false);
  const [planId, setPlanId] = useState(searchParams.get('plan') || 'pro');
  const [mode, setMode] = useState(searchParams.get('mode') || 'yearly');
  const [error, setError] = useState(null);

  const sessionId = searchParams.get('session_id');

  const planLabel = PLAN_LABELS[planId] || 'Croissance';
  const modeLabel = BILLING_LABELS[mode] || BILLING_LABELS.yearly;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (sessionId && !syncDoneRef.current) {
      syncDoneRef.current = true;
      subscriptionComplete(sessionId)
        .then((data) => {
          if (data?.subscription_plan) setPlanId(data.subscription_plan);
        })
        .catch((err) => {
          console.error('subscriptionComplete:', err);
          setError(err.response?.data?.error || 'Erreur lors de l\'activation de l\'abonnement.');
        });
    }
  }, [sessionId]);

  const handleBackToApp = () => navigate('/home', { replace: true });
  const handleBackToPlans = () => navigate('/plan', { replace: true });

  return (
    <div className="relative min-h-[calc(100vh-80px)] flex items-center justify-center bg-[var(--om-bg)] px-4 py-10">
      <ConfettiLayer />

      <div className="relative z-10 w-full max-w-xl mx-auto">
        <div className="rounded-2xl bg-[var(--om-surface)] shadow-[var(--om-shadow-lg)] border border-[var(--om-line)] px-6 py-8 md:px-8 md:py-10 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[var(--om-success-soft)] text-[var(--om-success)] mb-4 shadow-[var(--om-shadow)]">
            <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <h1 className="text-2xl md:text-3xl font-medium text-[var(--om-text)] mb-2">
            Paiement réussi 🎉
          </h1>

          {error ? (
            <p className="text-sm text-[var(--om-danger)] mb-6">{error}</p>
          ) : (
            <p className="text-sm md:text-base text-[var(--om-muted)] mb-6 max-w-md mx-auto">
              Merci pour ta confiance. Ton {modeLabel}{' '}
              <span className="font-medium text-[var(--om-accent)]">{planLabel}</span> est maintenant
              actif.
            </p>
          )}

          <div className="rounded-2xl bg-[var(--om-surface-2)]/60 border border-[var(--om-line)] px-4 py-3 mb-6 text-left text-sm">
            <p className="text-[var(--om-muted)] mb-1">Récapitulatif</p>
            <div className="flex justify-between text-[var(--om-text)] font-medium">
              <span>Plan</span>
              <span>{planLabel}</span>
            </div>
            <div className="flex justify-between text-[var(--om-text)] mt-1">
              <span>Type</span>
              <span className="capitalize">{mode === 'yearly' ? 'Annuel' : 'Mensuel'}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              type="button"
              onClick={handleBackToApp}
              className="px-5 py-2.5 rounded-full text-sm font-medium bg-[var(--om-accent)] text-[var(--om-on-accent)] hover:bg-[var(--om-accent-hover)] transition-colors"
            >
              Continuer dans l&apos;app
            </button>
            <button
              type="button"
              onClick={handleBackToPlans}
              className="px-5 py-2.5 rounded-full text-sm font-medium border border-[var(--om-line)] text-[var(--om-text)] hover:bg-[var(--om-surface-2)] transition-colors"
            >
              Revoir les plans
            </button>
          </div>

          <p className="mt-4 text-[10px] text-[var(--om-muted)]">
            Tu pourras modifier ou annuler ton abonnement depuis la page paramètres.
          </p>
        </div>
      </div>
    </div>
  );
}

export default PlanSuccess;
