import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { trackPageVisit } from '../../utils/adminApi';

const FEATURES = [
  {
    id: 'flashcards',
    title: 'FlashCards',
    description: 'Créez vos collections de cartes et révisez-les en répétition espacée (algorithme SM-2). Chaque carte revient au bon moment, ni trop tôt ni trop tard.',
    icon: (
      <svg className="w-8 h-8 md:w-10 md:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    color: 'var(--om-perso)',
  },
  {
    id: 'routines',
    title: 'Routines',
    description: 'Créez des routines quotidiennes et suivez votre taux d\'accomplissement. Jour après jour, construisez des habitudes durables.',
    icon: (
      <svg className="w-8 h-8 md:w-10 md:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    color: 'var(--om-accent)',
  },
  {
    id: 'todo',
    title: 'To-do list',
    description: 'Priorisez vos tâches avec des tags (urgence, important, projet, idée). Suivez l\'avancement et gardez le cap sur vos objectifs.',
    icon: (
      <svg className="w-8 h-8 md:w-10 md:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    color: 'var(--om-pro-strong)',
  },
];

const STEPS = [
  {
    step: 1,
    title: 'Constituez vos collections',
    text: 'Créez vos cartes à la main, importez-les depuis un texte, ou laissez l\'IA générer une collection sur le sujet de votre choix.',
    image: '/landing/step-1-definir.png',
    imageAlt: 'Définir : cible et checklist pour fixer vos objectifs',
  },
  {
    step: 2,
    title: 'Routines et suivi quotidien',
    text: 'Routines et to-do list vous aident à rester régulier ; la vue d\'ensemble montre votre progression en un coup d\'œil.',
    image: '/landing/step-2-routines.png',
    imageAlt: 'Routines et suivi : calendrier et horloge pour suivre vos habitudes',
  },
  {
    step: 3,
    title: 'Réviser et ancrer',
    text: 'La répétition espacée ramène chaque carte au bon moment : vous révisez moins longtemps et vous retenez plus.',
    image: '/landing/step-3-reviser.png',
    imageAlt: 'Réviser et ancrer : livre et carnets pour consolider vos connaissances',
  },
];

const TESTIMONIALS = [
  {
    quote: 'Enfin une app qui lie routines, tâches et révision. Je ne perds plus le fil.',
    author: 'Marie L.',
    role: 'Autodidacte',
  },
  {
    quote: 'Les flashcards et le suivi des routines m\'aident à rester constant. Simple et efficace.',
    author: 'Thomas D.',
    role: 'Étudiant',
  },
  {
    quote: 'Les rappels et la vue d\'ensemble me gardent motivé. Je recommande.',
    author: 'Sophie M.',
    role: 'Professionnelle en reconversion',
  },
];

const PLANS_TEASER = [
  { name: 'Découverte', price: '0 €', period: 'Pour toujours', cta: 'Commencer gratuitement', highlight: false },
  { name: 'Croissance', price: '4,99 €', period: '/mois', cta: 'Essai gratuit 7 jours', highlight: true },
  { name: 'Maîtrise', price: '9,99 €', period: '/mois', cta: 'Essai gratuit 7 jours', highlight: false },
];

function LandingPage() {
  useEffect(() => {
    try {
      const url = window.location.href;
      const params = new URLSearchParams(window.location.search || '');
      const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
      const utmPairs = utmKeys
        .map((k) => {
          const v = params.get(k);
          return v ? `${k}=${v}` : null;
        })
        .filter(Boolean);

      const existing = sessionStorage.getItem('landingVisitId');
      const visitId = existing || (crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()));
      if (!existing) sessionStorage.setItem('landingVisitId', visitId);

      trackPageVisit('/', {
        visitId,
        url,
        utm: utmPairs.length ? utmPairs.join('&') : undefined,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: navigator.language,
        platform: navigator.platform,
        screen: `${window.screen?.width || 'N/A'}x${window.screen?.height || 'N/A'}`,
      });
    } catch (e) {
      // silencieux
    }
  }, []);

  return (
    <div className="overflow-x-hidden">
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-[var(--om-bg)]">
        <div className="absolute inset-0 onboarding-gradient opacity-80" aria-hidden />
        <div className="container mx-auto px-4 md:px-6 pt-12 md:pt-16 pb-16 md:pb-24 lg:px-0 lg:pt-0 lg:pb-0 relative flex flex-col lg:flex-row lg:items-center lg:justify-center lg:min-h-[calc(100vh-4.5rem)]">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-center gap-10 lg:gap-24 xl:gap-28 lg:-translate-y-10">
            <div className="max-w-2xl lg:max-w-[30rem] mx-auto lg:mx-0 flex-shrink-0 text-center lg:text-left">
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-medium text-[var(--om-text)] leading-tight mb-5 md:mb-7 animate-fade-in">
                Réviser, s&apos;organiser, tenir le rythme.
              </h1>
              <p className="text-xl md:text-2xl text-[var(--om-muted)] mb-9 md:mb-11 max-w-2xl mx-auto lg:mx-0 animate-fade-in" style={{ animationDelay: '0.1s' }}>
                De l&apos;intention à la pratique régulière. Objectifs, routines, flashcards et assistant IA — tout en un.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start items-center animate-fade-in" style={{ animationDelay: '0.2s' }}>
                <Link
                  to="/register"
                  className="w-full sm:w-auto inline-flex items-center justify-center px-7 py-4 md:px-9 md:py-5 rounded-2xl text-lg md:text-xl font-medium bg-[var(--om-accent)] text-[var(--om-on-accent)] hover:bg-[var(--om-accent-hover)] transition-colors shadow-[var(--om-shadow)] hover:shadow-[var(--om-shadow-lg)]"
                >
                  Essayer maintenant
                </Link>
                <Link
                  to="/demo/home"
                  className="w-full sm:w-auto inline-flex items-center justify-center px-7 py-4 md:px-9 md:py-5 rounded-2xl text-lg md:text-xl font-medium border border-[var(--om-line)] text-[var(--om-muted)] hover:bg-[var(--om-surface-2)] transition-colors"
                >
                  Voir comment ça marche
                </Link>
              </div>
              <p className="mt-5 md:mt-6 text-base text-[var(--om-muted)]">
                Sans carte bancaire · Essai gratuit 7 jours sur les formules payantes
              </p>
            </div>
            <div className="max-w-xl lg:max-w-md xl:max-w-lg mx-auto w-full flex items-center justify-center flex-shrink-0 lg:flex-1 lg:max-w-md">
              <img
                src="/landing/hero.png"
                alt="Illustration d'apprentissage et de productivité : personne concentrée sur son ordinateur avec graphiques de progression, calendrier et objectifs"
                className="w-full h-auto rounded-2xl shadow-[var(--om-shadow)] object-contain"
                width={800}
                height={600}
                loading="eager"
                fetchPriority="high"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Comment ça marche */}
      <section id="comment-ca-marche" className="py-18 md:py-22 lg:py-26 bg-[var(--om-surface)] border-y border-[var(--om-line)]">
        <div className="container mx-auto px-4 md:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-medium text-[var(--om-text)] text-center mb-4 md:mb-5">
            Comment ça marche
          </h2>
          <p className="text-[var(--om-muted)] text-center max-w-2xl mx-auto text-lg md:text-xl mb-16 md:mb-18">
            Trois étapes pour passer d&apos;une simple intention à une pratique régulière.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8 lg:gap-10 max-w-5xl mx-auto">
            {STEPS.map(({ step, title, text, image, imageAlt }) => (
              <div
                key={step}
                className="flex flex-col items-center text-center"
              >
                {/* Conteneur fixe : même taille pour les 3 images (242×194 px - 1.1x) */}
                <div className="w-[242px] h-[194px] mx-auto mb-7 md:mb-8 flex items-center justify-center flex-shrink-0 bg-[var(--om-bg)]/50 rounded-2xl border border-[var(--om-line)]/60">
                  <img
                    src={image}
                    alt={imageAlt}
                    className="max-w-[90%] max-h-[90%] w-auto h-auto object-contain"
                    width={242}
                    height={194}
                    loading="lazy"
                  />
                </div>
                <h3 className="text-xl md:text-2xl font-medium text-[var(--om-text)] mb-4 md:mb-5 leading-snug">
                  {title}
                </h3>
                <p className="text-base md:text-lg text-[var(--om-muted)] max-w-[280px] md:max-w-none leading-relaxed">
                  {text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Fonctionnalités */}
      <section id="fonctionnalites" className="py-16 md:py-22 lg:py-26 bg-[var(--om-bg)]">
        <div className="container mx-auto px-4 md:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-medium text-[var(--om-text)] text-center mb-5 md:mb-7">
            Tout ce dont vous avez besoin
          </h2>
          <p className="text-[var(--om-muted)] text-center max-w-2xl mx-auto mb-11 md:mb-13 text-lg md:text-xl">
            Une seule plateforme pour planifier, suivre et réviser. Plus besoin d&apos;éparpiller vos outils.
          </p>
          <div className="flex justify-center mb-12 md:mb-16">
            <div className="w-full max-w-[280px] sm:max-w-[320px] md:max-w-[360px]">
              <img
                src="/landing/features-app.png"
                alt="Aperçu de l'application LvlRise : Développement perso avec barres de progression, calendrier et onglets Perso, Pro, Apprentissage"
                className="w-full h-auto rounded-2xl shadow-[var(--om-shadow-lg)] object-contain"
                width={360}
                height={720}
                loading="lazy"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {FEATURES.map(({ id, title, description, icon, color }) => (
              <article
                key={id}
                className="rounded-2xl border border-[var(--om-line)] bg-[var(--om-surface)] p-7 md:p-9 shadow-[var(--om-shadow)] hover:shadow-[var(--om-shadow)] hover:border-[var(--om-accent)]/30 transition-all duration-300"
              >
                <div
                  className="w-16 h-16 md:w-18 md:h-18 rounded-2xl flex items-center justify-center mb-5 md:mb-6 text-[var(--om-on-accent)]"
                  style={{ backgroundColor: color }}
                  aria-hidden
                >
                  {icon}
                </div>
                <h3 className="text-xl md:text-2xl font-medium text-[var(--om-text)] mb-3 md:mb-4">
                  {title}
                </h3>
                <p className="text-base md:text-lg text-[var(--om-muted)] leading-relaxed">
                  {description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Vidéo explicative */}
      <section id="video" className="py-16 md:py-22 lg:py-26 bg-[var(--om-surface)] border-y border-[var(--om-line)]">
        <div className="container mx-auto px-4 md:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-medium text-[var(--om-text)] text-center mb-5 md:mb-7">
            Découvrez LvlRise en 2 minutes
          </h2>
          <p className="text-[var(--om-muted)] text-center max-w-2xl mx-auto mb-11 md:mb-13 text-lg md:text-xl">
            Une démo rapide pour voir l&apos;app en action : objectifs, routines, flashcards et plus.
          </p>
          <div className="max-w-4xl mx-auto rounded-2xl overflow-hidden border border-[var(--om-line)] bg-[var(--om-surface-2)] aspect-video flex items-center justify-center">
            {/* Placeholder : remplacer par une iframe YouTube/Vimeo quand la vidéo est prête */}
            <div className="text-center p-8 md:p-12">
              <div
                className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-[var(--om-accent)]/20 flex items-center justify-center mx-auto mb-4"
                aria-hidden
              >
                <svg className="w-8 h-8 md:w-10 md:h-10 text-[var(--om-accent)]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <p className="text-[var(--om-muted)] text-sm md:text-base mb-2">
                Vidéo de démonstration à venir
              </p>
              <p className="text-[var(--om-muted)]/80 text-xs md:text-sm">
                En attendant, créez un compte gratuit pour explorer l&apos;application.
              </p>
              <Link
                to="/register"
                className="inline-flex items-center justify-center mt-4 px-5 py-2.5 rounded-[10px] text-sm font-medium bg-[var(--om-accent)] text-[var(--om-on-accent)] hover:bg-[var(--om-accent-hover)]"
              >
                Essayer maintenant
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Témoignages */}
      <section id="temoignages" className="py-16 md:py-22 lg:py-26 bg-[var(--om-bg)]">
        <div className="container mx-auto px-4 md:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-medium text-[var(--om-text)] text-center mb-5 md:mb-7">
            Ils tiennent déjà le rythme
          </h2>
          <p className="text-[var(--om-muted)] text-center max-w-2xl mx-auto mb-13 md:mb-18 text-lg md:text-xl">
            Rejoignez les apprenants qui ont choisi la régularité.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-7 md:gap-9">
            {TESTIMONIALS.map(({ quote, author, role }) => (
              <blockquote
                key={author}
                className="rounded-2xl border border-[var(--om-line)] bg-[var(--om-surface)] p-7 md:p-9 shadow-[var(--om-shadow)]"
              >
                <p className="text-[var(--om-text)] text-base md:text-lg leading-relaxed mb-5 md:mb-6">
                  &ldquo;{quote}&rdquo;
                </p>
                <footer className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-[var(--om-accent)]/20 flex items-center justify-center text-[var(--om-accent)] font-medium text-base">
                    {author.charAt(0)}
                  </div>
                  <div>
                    <cite className="not-italic font-medium text-[var(--om-text)] text-base md:text-lg">
                      {author}
                    </cite>
                    <p className="text-sm md:text-base text-[var(--om-muted)]">{role}</p>
                  </div>
                </footer>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      {/* Tarifs teaser */}
      <section id="tarifs" className="py-16 md:py-22 lg:py-26 bg-[var(--om-surface)] border-y border-[var(--om-line)]">
        <div className="container mx-auto px-4 md:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-medium text-[var(--om-text)] text-center mb-5 md:mb-7">
            Choisissez votre rythme
          </h2>
          <p className="text-[var(--om-muted)] text-center max-w-2xl mx-auto mb-13 md:mb-18 text-lg md:text-xl">
            À partir de 0 €. Sans engagement. Annulation en 1 clic.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 max-w-5xl mx-auto">
            {PLANS_TEASER.map(({ name, price, period, cta, highlight }) => (
              <div
                key={name}
                className={`rounded-2xl border p-7 md:p-9 flex flex-col ${
                  highlight
                    ? 'border-[var(--om-accent)] bg-[var(--om-accent)]/5 shadow-[var(--om-shadow)]'
                    : 'border-[var(--om-line)] bg-[var(--om-surface)] shadow-[var(--om-shadow)]'
                }`}
              >
                {highlight && (
                  <span className="inline-block w-fit px-4 py-1.5 rounded-full bg-[var(--om-accent)] text-[var(--om-on-accent)] text-sm font-medium mb-5">
                    Populaire
                  </span>
                )}
                <h3 className="text-xl md:text-2xl font-medium text-[var(--om-text)] mb-3">
                  {name}
                </h3>
                <p className="text-3xl md:text-4xl font-medium text-[var(--om-text)] mb-2">
                  {price}
                  <span className="text-base md:text-lg font-medium text-[var(--om-muted)]">{period}</span>
                </p>
                <div className="flex-1 min-h-[2rem]" />
                <Link
                  to="/register"
                  className={`mt-5 w-full inline-flex items-center justify-center py-3.5 rounded-2xl text-base font-medium transition-colors ${
                    highlight
                      ? 'bg-[var(--om-accent)] text-[var(--om-on-accent)] hover:bg-[var(--om-accent-hover)]'
                      : 'border border-[var(--om-accent)] text-[var(--om-accent)] hover:bg-[var(--om-accent)]/5'
                  }`}
                >
                  {cta}
                </Link>
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-[var(--om-muted)] mt-8">
            Détail des offres et comparaison des fonctionnalités après inscription.
          </p>
        </div>
      </section>

      {/* À propos */}
      <section id="a-propos" className="py-14 md:py-20 lg:py-24 bg-[var(--om-bg)]">
        <div className="container mx-auto px-4 md:px-6 lg:px-8">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-medium text-[var(--om-text)] text-center mb-8 md:mb-10">
            À propos de LvlRise
          </h2>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-center gap-10 lg:gap-14 xl:gap-16 max-w-5xl mx-auto">
            <div className="flex-1 max-w-3xl mx-auto lg:mx-0 order-2 lg:order-1">
              <p className="text-[var(--om-muted)] text-base md:text-lg leading-relaxed mb-6">
                LvlRise est né d&apos;un constat simple : on nous demande d&apos;apprendre toute notre vie, mais peu d&apos;outils nous aident à structurer cette pratique au quotidien. Entre les bonnes intentions et la régularité, il manquait une plateforme qui lie objectifs, suivi et révision.
              </p>
              <p className="text-[var(--om-muted)] text-base md:text-lg leading-relaxed mb-6">
                Nous avons conçu LvlRise pour les autodidactes, les étudiants et les professionnels en formation : une seule app pour réviser avec des flashcards en répétition espacée, tenir ses routines et garder ses tâches sous contrôle. Trois outils, pas trente.
              </p>
              <p className="text-[var(--om-text)] font-medium text-base md:text-lg">
                De l&apos;intention à la pratique régulière — c&apos;est notre promesse.
              </p>
            </div>
            <div className="flex-1 max-w-md lg:max-w-sm xl:max-w-md mx-auto w-full order-1 lg:order-2 flex justify-center lg:justify-end">
              <img
                src="/landing/about-mission.png"
                alt="Parcours d'apprentissage : livre, idée, objectif atteint — de la connaissance à la réussite"
                className="w-full h-auto rounded-2xl object-contain"
                width={500}
                height={400}
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section id="cta-final" className="py-14 md:py-20 lg:py-24 bg-[var(--om-accent)] text-[var(--om-on-accent)]">
        <div className="container mx-auto px-4 md:px-6 lg:px-8 text-center">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-medium mb-4 md:mb-6">
            Prêt à tenir le rythme ?
          </h2>
          <p className="text-[var(--om-on-accent)]/90 text-base md:text-lg max-w-xl mx-auto mb-8 md:mb-10">
            Créez un compte gratuit en quelques secondes. Aucune carte bancaire requise.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              to="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 rounded-2xl text-lg font-medium border border-[var(--om-on-accent)]/80 text-[var(--om-on-accent)] hover:bg-[var(--om-surface)]/10 transition-colors"
            >
              J&apos;ai déjà un compte
            </Link>
          </div>
        </div>
      </section>
    </>
    </div>
  );
}

export default LandingPage;
