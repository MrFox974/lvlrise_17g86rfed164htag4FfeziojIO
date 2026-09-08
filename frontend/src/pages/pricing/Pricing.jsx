import { useState, useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const BILLING_MODES = {
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
};

function formatPrice(value) {
  return value.toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const PLANS = [
  {
    id: 'free',
    name: 'Découverte',
    tag: 'Gratuit',
    highlight: false,
    monthly: 0,
    yearly: 0,
    description: "Idéal pour tester l'outil et démarrer en douceur.",
    features: [
      { label: '1 génération de domaine (bibliothèque)', key: 'ai', included: true },
      { label: "Jusqu'à 3 suivis de domaines développement perso", key: 'domains-perso', included: true },
      { label: '1 suivi de domaine pro', key: 'domains-pro', included: true },
      { label: "Jusqu'à 5 routines par jour", key: 'routines', included: true },
      { label: "Jusqu'à 7 tâches (to-do list)", key: 'todo', included: true },
      { label: '1 collection (FlashCard)', key: 'collections', included: true },
      { label: '1 groupe (FlashCard)', key: 'groupes', included: true },
      { label: "Jusqu'à 50 FlashCard", key: 'flashcards', included: true },
      { label: "Jusqu'à 10 notes", key: 'notes', included: true },
      { label: '3 domaines (bibliothèque)', key: 'bibli-domains', included: true },
      { label: "Jusqu'à 5 chapitres par domaine", key: 'bibli-chapters', included: true },
      { label: "Jusqu'à 5 sous-chapitres par chapitre", key: 'bibli-sections', included: true },
    ],
    ctaLabel: 'Commencer gratuitement',
    ctaVariant: 'outline',
  },
  {
    id: 'pro',
    name: 'Croissance',
    tag: 'Populaire',
    highlight: true,
    monthly: 6.99,
    yearly: 59.99,
    description: 'Pour structurer sérieusement votre progression chaque semaine.',
    features: [
      // { label: 'Assistance vocale IA', key: 'voice-ai', included: true },
      // { label: 'Rapport vocal IA hebdomadaire', key: 'report-weekly', included: true },
      { label: '3 générations de domaine par l\'IA par mois (bibliothèque)', key: 'ai', included: true },
      { label: "Jusqu'à 5 suivis de domaines développement perso", key: 'domains-perso', included: true },
      { label: "Jusqu'à 2 suivis de domaine pro", key: 'domains-pro', included: true },
      { label: "Jusqu'à 10 routines par jour", key: 'routines', included: true },
      { label: "Jusqu'à 30 tâches (to-do list)", key: 'todo', included: true },
      { label: 'Jusqu\'à 5 collections (FlashCard)', key: 'collections', included: true },
      { label: 'Jusqu\'à 5 groupes par collection', key: 'groupes', included: true },
      { label: "Jusqu'à 200 flashcard", key: 'flashcards', included: true },
      { label: "Jusqu'à 50 notes", key: 'notes', included: true },
      { label: '10 domaines (bibliothèque)', key: 'bibli-domains', included: true },
      { label: "Jusqu'à 30 chapitres par domaine", key: 'bibli-chapters', included: true },
      { label: "Jusqu'à 50 sous-chapitres par chapitre", key: 'bibli-sections', included: true },
    ],
    ctaLabel: 'Essai gratuit 7 jours',
    ctaVariant: 'primary',
    guarantee: 'Sans engagement · Annulation en 1 clic',
  },
  {
    id: 'premium',
    name: 'Maîtrise',
    tag: null,
    highlight: false,
    monthly: 9.99,
    yearly: 79.99,
    description: 'Pour les apprenants exigeants qui veulent aller au bout de chaque domaine.',
    features: [
      // { label: 'Assistance vocale IA', key: 'voice-ai', included: true },
      // { label: 'Rapport vocal IA hebdomadaire et journalier', key: 'report-weekly-daily', included: true },
      { label: '40 générations de domaine par l\'IA par mois', key: 'ai', included: true },
      { label: "Jusqu'à 5 suivis de domaines développement perso", key: 'domains-perso', included: true },
      { label: '5 suivis de domaine pro', key: 'domains-pro', included: true },
      { label: "Jusqu'à 100 routines par jour", key: 'routines', included: true },
      { label: "Jusqu'à 500 tâches (to-do list)", key: 'todo', included: true },
      { label: '100 collections (FlashCard)', key: 'collections', included: true },
      { label: '400 groupes (FlashCard)', key: 'groupes', included: true },
      { label: "Jusqu'à 1000 FlashCard", key: 'flashcards', included: true },
      { label: "Jusqu'à 1000 notes", key: 'notes', included: true },
      { label: '100 domaines (bibliothèque)', key: 'bibli-domains', included: true },
      { label: "Jusqu'à 200 chapitres par domaine", key: 'bibli-chapters', included: true },
      { label: "Jusqu'à 500 sous-chapitres par chapitre", key: 'bibli-sections', included: true },
    ],
    ctaLabel: 'Essai gratuit 7 jours',
    ctaVariant: 'soft',
  },
];

function CheckIcon({ included }) {
  if (included) {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[var(--om-accent)]/10 text-[var(--om-accent)] mr-3 flex-shrink-0">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full border border-[var(--om-line)] text-[var(--om-muted)]/40 mr-3 flex-shrink-0">
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M6 6l12 12M6 18L18 6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function PricingToggle({ billingMode, onChange }) {
  const isYearly = billingMode === BILLING_MODES.YEARLY;

  return (
    <div className="flex justify-center mb-10 md:mb-14">
      <div className="relative inline-flex rounded-full border border-[var(--om-line)] bg-[var(--om-surface-2)] p-1.5 w-[260px] md:w-[240px]">
        <button
          type="button"
          onClick={() => onChange(BILLING_MODES.MONTHLY)}
          className={`relative z-10 flex-1 min-w-0 py-3 md:py-2.5 rounded-full text-sm font-medium transition-colors flex items-center justify-center ${
            !isYearly ? 'text-[var(--om-on-accent)]' : 'text-[var(--om-muted)] hover:text-[var(--om-text)]'
          }`}
        >
          Mensuel
        </button>
        <button
          type="button"
          onClick={() => onChange(BILLING_MODES.YEARLY)}
          className={`relative z-10 flex-1 min-w-0 py-3 md:py-2.5 rounded-full text-sm font-medium transition-colors flex items-center justify-center ${
            isYearly ? 'text-[var(--om-on-accent)]' : 'text-[var(--om-muted)] hover:text-[var(--om-text)]'
          }`}
        >
          Annuel
        </button>
        <div
          className="absolute top-1.5 bottom-1.5 rounded-full bg-[var(--om-accent)] transition-all duration-300 ease-out pointer-events-none"
          style={{
            left: isYearly ? 'calc(50% + 2px)' : 6,
            width: 'calc(50% - 8px)',
          }}
        />
      </div>
    </div>
  );
}

function PlanPrice({ plan, billingMode }) {
  const isYearly = billingMode === BILLING_MODES.YEARLY;

  const price = isYearly ? plan.yearly : plan.monthly;
  const yearlyPerMonth = plan.yearly ? plan.yearly / 12 : 0;

  if (plan.id === 'free') {
    return (
      <div className="mb-6">
        <p className="text-4xl md:text-5xl font-medium text-[var(--om-accent)]">0 €</p>
        <p className="text-sm text-[var(--om-muted)] mt-1">Pour toujours</p>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <div className="flex items-baseline gap-3">
        <p className="text-4xl md:text-5xl font-medium text-[var(--om-text)]">
          {formatPrice(isYearly ? yearlyPerMonth : price)} €
          <span className="text-base font-medium text-[var(--om-muted)]"> /mois</span>
        </p>
        {isYearly && (
          <span className="text-sm line-through text-[var(--om-muted)]/70">
            {formatPrice(plan.monthly)} €/mois
          </span>
        )}
      </div>
      {isYearly && plan.yearly && (
        <p className="text-sm text-[var(--om-accent)] mt-2">
          {`Facturé ${formatPrice(plan.yearly)} € /an · Économisez ${formatPrice(
            plan.monthly * 12 - plan.yearly,
          )} € /an`}
        </p>
      )}
      {!isYearly && plan.yearly && (
        <p className="text-sm text-[var(--om-muted)] mt-2">
          {`Ou ${formatPrice(plan.yearly)} € /an (${formatPrice(yearlyPerMonth)} €/mois)`}
        </p>
      )}
    </div>
  );
}

function PlanCard({ plan, billingMode, isFeatured, onSelect }) {
  const isFree = plan.id === 'free';
  const isPro = plan.id === 'pro';

  const containerClasses = useMemo(() => {
    const base =
      'relative flex flex-col rounded-[20px] border bg-[var(--om-surface)] p-6 md:p-7 transition-all duration-300 ease-out cursor-default h-full min-h-[480px] md:min-h-[520px]';
    const hover = 'hover:-translate-y-1 hover:shadow-[var(--om-shadow-lg)]';

    if (isFeatured) {
      return `${base} border-[var(--om-accent)] shadow-[var(--om-shadow)] scale-[1.03] ${hover}`;
    }

    return `${base} border-[var(--om-line)] shadow-[var(--om-shadow)] ${hover}`;
  }, [isFeatured]);

  const ctaClasses = useMemo(() => {
    if (plan.ctaVariant === 'primary') {
      return 'om-btn om-btn-solid mt-6 w-full';
    }
    if (plan.ctaVariant === 'soft') {
      return 'om-btn om-btn-primary mt-6 w-full';
    }
    return 'om-btn om-btn-ghost mt-6 w-full !text-[var(--om-accent)] !border-[var(--om-accent)]';
  }, [plan.ctaVariant]);

  return (
    <article className={containerClasses}>
      {plan.tag && (
        <div className="absolute -top-3 left-6 px-3.5 py-1.5 rounded-full bg-[var(--om-accent)] text-[var(--om-on-accent)] text-sm font-medium shadow-[var(--om-shadow)]">
          {plan.tag}
        </div>
      )}

      <header className="mb-4 md:mb-3">
        <h3 className="text-xl md:text-lg font-medium text-[var(--om-text)]">{plan.name}</h3>
        <p className="text-base md:text-sm text-[var(--om-muted)] mt-2">{plan.description}</p>
      </header>

      <PlanPrice plan={plan} billingMode={billingMode} />

      <ul className="space-y-2.5 text-base md:text-[15px] flex-1">
        {plan.features.map((feature) => (
          <li
            key={feature.key}
            className={`flex items-start ${
              feature.included ? 'text-[var(--om-text)]' : 'text-[var(--om-muted)]/60'
            }`}
          >
            <CheckIcon included={feature.included} />
            <span className={feature.included ? '' : 'line-through decoration-[var(--om-line)]'}>
              {feature.label}
            </span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        className={ctaClasses}
        onClick={() => onSelect?.(plan)}
      >
        {plan.ctaLabel}
      </button>

      {isPro && plan.guarantee && (
        <p className="mt-3 text-xs text-[var(--om-muted)] text-center">
          {plan.guarantee}
        </p>
      )}

      {isFree && (
        <p className="mt-3 text-xs text-[var(--om-muted)] text-center">
          Parfait pour débuter sans contrainte.
        </p>
      )}
    </article>
  );
}

function Pricing() {
  const location = useLocation();
  const navigate = useNavigate();
  const [billingMode, setBillingMode] = useState(BILLING_MODES.MONTHLY);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [location.pathname]);

  const handleSelectPlan = (plan) => {
    if (plan.id === 'free') {
      return;
    }

    const apiBillingMode =
      billingMode === BILLING_MODES.YEARLY ? 'yearly' : 'monthly';

    navigate(`/plan/payment/${plan.id}?mode=${apiBillingMode}`);
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <div className="text-center mt-6 md:mt-8 mb-6 md:mb-6">
        <h1 className="text-2xl md:text-3xl font-medium text-[var(--om-text)] mb-3 md:mb-2">
          Choisissez votre rythme d&apos;apprentissage
        </h1>
        <p className="text-lg md:text-base text-[var(--om-muted)] max-w-2xl mx-auto">
          Passez d&apos;une simple intention à une pratique régulière. Les plans s&apos;adaptent à votre niveau
          d&apos;engagement et à vos objectifs.
        </p>
      </div>

      <PricingToggle billingMode={billingMode} onChange={setBillingMode} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-6 lg:gap-8 items-stretch px-2 md:px-2 max-w-[420px] sm:max-w-[480px] md:max-w-none mx-auto mt-8 md:mt-8">
        <div className="order-2 md:order-1">
          <PlanCard
            plan={PLANS[0]}
            billingMode={billingMode}
            isFeatured={false}
            onSelect={handleSelectPlan}
          />
        </div>
        <div className="order-1 md:order-2">
          <PlanCard
            plan={PLANS[1]}
            billingMode={billingMode}
            isFeatured
            onSelect={handleSelectPlan}
          />
        </div>
        <div className="order-3 md:order-3">
          <PlanCard
            plan={PLANS[2]}
            billingMode={billingMode}
            isFeatured={false}
            onSelect={handleSelectPlan}
          />
        </div>
      </div>

      <div className="mt-8 text-center text-sm text-[var(--om-muted)]">
        <p className="mb-2">
          Rejoint par <span className="font-medium text-[var(--om-accent)]">X+ apprenants</span> motivés
          (placeholder).
        </p>
        <p>
          Note moyenne : <span className="font-medium text-[var(--om-accent)]">4,8/5</span> (à personnaliser).
        </p>
      </div>
    </div>
  );
}

export default Pricing;