import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { createCheckoutSession } from '../../utils/paymentApi';

const BILLING_MODES = {
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
};

const PAYMENT_PLANS = {
  free: { id: 'free', name: 'Découverte' },
  pro: { id: 'pro', name: 'Croissance' },
  premium: { id: 'premium', name: 'Maîtrise' },
};

function usePlanContext() {
  const { planId } = useParams();
  const [searchParams] = useSearchParams();
  const billingParam = searchParams.get('mode');
  const billingMode =
    billingParam === BILLING_MODES.MONTHLY || billingParam === BILLING_MODES.YEARLY
      ? billingParam
      : BILLING_MODES.YEARLY;
  const plan = PAYMENT_PLANS[planId] || null;
  return { planId, plan, billingMode };
}

function PaymentHeader({ plan, billingMode }) {
  if (!plan) {
    return (
      <header className="text-center mb-6">
        <h1 className="text-2xl font-medium text-[var(--om-text)] mb-2">Plan introuvable</h1>
        <p className="text-sm text-[var(--om-muted)]">
          Le plan sélectionné n&apos;existe pas ou n&apos;est plus disponible.
        </p>
      </header>
    );
  }
  const isYearly = billingMode === BILLING_MODES.YEARLY;
  return (
    <header className="text-center mb-6">
      <p className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium bg-[var(--om-surface-2)] text-[var(--om-accent)] mb-3 border border-[var(--om-accent)]/20">
        <span className="text-base">★</span>
        <span>{plan.name}</span>
      </p>
      <h1 className="text-2xl font-medium text-[var(--om-text)] mb-2">
        Finalisez votre {isYearly ? 'abonnement annuel' : 'abonnement mensuel'}
      </h1>
      <p className="text-sm text-[var(--om-muted)] max-w-2xl mx-auto">
        Vous serez redirigé vers Stripe pour un paiement sécurisé. Vous pourrez modifier ou annuler
        votre abonnement à tout moment depuis les paramètres.
      </p>
    </header>
  );
}

function PlanPayment() {
  const location = useLocation();
  const navigate = useNavigate();
  const { planId, plan, billingMode } = usePlanContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [location.pathname]);

  useEffect(() => {
    if (!planId || !plan || planId === 'free') return;

    let isCancelled = false;

    const goToCheckout = async () => {
      try {
        setLoading(true);
        setError(null);
        const { url } = await createCheckoutSession(planId, billingMode);
        if (isCancelled) return;
        if (url) {
          window.location.href = url;
          return;
        }
        setError('Impossible de préparer le paiement.');
      } catch (e) {
        if (isCancelled) return;
        console.error('Erreur Checkout Stripe:', e);
        if (e.response?.status === 401) {
          setError('Vous devez être connecté pour souscrire à un plan.');
        } else {
          setError(e.response?.data?.error || 'Une erreur est survenue. Réessayez.');
        }
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    goToCheckout();
    return () => { isCancelled = true; };
  }, [planId, plan, billingMode]);

  const handleBack = () => navigate('/plan', { replace: false });
  const showContent = !!plan && planId !== 'free';

  return (
    <div className="px-4 md:px-6 lg:px-8 pt-1 pb-6 max-w-3xl mx-auto">
      <button
        type="button"
        onClick={handleBack}
        className="mb-4 inline-flex items-center gap-2 text-xs text-[var(--om-muted)] hover:text-[var(--om-text)]"
      >
        <span className="inline-block w-4 h-4 border-l border-b border-[var(--om-muted)] rotate-45" />
        <span>Retour aux plans</span>
      </button>

      <PaymentHeader plan={plan} billingMode={billingMode} />

      {!showContent && (
        <p className="text-center text-sm text-[var(--om-muted)] mt-4">
          Sélectionnez un plan payant depuis la page des plans pour accéder au paiement.
        </p>
      )}

      {error && (
        <p className="mt-4 text-sm text-[var(--om-danger)] text-center">{error}</p>
      )}

      {showContent && loading && (
        <div className="mt-6 flex flex-col items-center gap-3">
          <div className="w-8 h-8 border border-[var(--om-accent)] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[var(--om-muted)]">Redirection vers Stripe...</p>
        </div>
      )}
    </div>
  );
}

export default PlanPayment;
