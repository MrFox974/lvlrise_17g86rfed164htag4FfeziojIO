import { useNavigate } from 'react-router-dom';

const PLAN_LABELS = {
  free: 'Découverte',
  pro: 'Croissance',
  premium: 'Maîtrise',
};

/**
 * Modal d'invitation à upgrade lorsqu'une limite de plan est atteinte
 */
function UpgradeModal({ isOpen, onClose, restriction, featureName }) {
  const navigate = useNavigate();

  if (!isOpen || !restriction) return null;

  const planLabel = PLAN_LABELS[restriction.plan] || restriction.plan;
  const nextPlan = restriction.plan === 'free' ? 'pro' : restriction.plan === 'pro' ? 'premium' : null;
  const nextPlanLabel = nextPlan ? PLAN_LABELS[nextPlan] : null;

  const handleUpgrade = () => {
    onClose();
    navigate('/plan');
  };

  return (
    <div
      className="fixed inset-0 bg-[var(--om-scrim-solid)]/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--om-surface)] rounded-2xl p-6 max-w-md w-full shadow-[var(--om-shadow-lg)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-[var(--om-accent)]/10 flex items-center justify-center">
            <svg
              className="w-6 h-6 text-[var(--om-accent)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
          <h3 className="text-xl font-medium text-[var(--om-text)]">
            Limite atteinte
          </h3>
        </div>

        <p className="text-sm text-[var(--om-muted)] mb-4">
          {featureName ? (
            <>
              Vous avez atteint la limite de <strong>{featureName}</strong> pour votre plan{' '}
              <strong>{planLabel}</strong>.
            </>
          ) : (
            <>
              Vous avez atteint la limite pour votre plan <strong>{planLabel}</strong>.
            </>
          )}
        </p>

        <div className="bg-[var(--om-surface-2)]/50 rounded-2xl p-4 mb-4 border border-[var(--om-line)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-[var(--om-muted)]">Utilisation actuelle</span>
            <span className="text-sm font-medium text-[var(--om-text)]">
              {restriction.current} / {restriction.limit}
            </span>
          </div>
          <div className="w-full bg-[var(--om-line)] rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-[var(--om-accent)] transition-all duration-300"
              style={{ width: `${Math.min((restriction.current / restriction.limit) * 100, 100)}%` }}
            />
          </div>
        </div>

        {nextPlan && nextPlanLabel && (
          <div className="mb-4 p-4 rounded-2xl bg-[var(--om-accent)]/5 border border-[var(--om-accent)]/20">
            <p className="text-sm text-[var(--om-text)] font-medium mb-1">
              Passez au plan <strong>{nextPlanLabel}</strong>
            </p>
            <p className="text-xs text-[var(--om-muted)]">
              Débloquez des limites plus élevées et accédez à plus de fonctionnalités.
            </p>
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-2xl border border-[var(--om-line)] text-[var(--om-muted)] text-sm font-medium hover:bg-[var(--om-surface-2)] transition-colors"
          >
            Plus tard
          </button>
          <button
            type="button"
            onClick={handleUpgrade}
            className="px-4 py-2 rounded-2xl bg-[var(--om-accent)] text-[var(--om-on-accent)] text-sm font-medium hover:bg-[var(--om-accent-hover)] transition-colors"
          >
            Voir les plans
          </button>
        </div>
      </div>
    </div>
  );
}

export default UpgradeModal;
