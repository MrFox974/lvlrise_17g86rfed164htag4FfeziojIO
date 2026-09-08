/**
 * Illustration pour les pages Login / Inscription.
 * Mobile : image en haut + voile violet léger.
 * Desktop : panneau gauche avec image + voile opaque + citation.
 * Le voile est toujours sombre : le texte reste clair dans les deux thèmes.
 */
const AUTH_IMAGE = '/auth-illustration.png';
const QUOTE = 'We are asked to learn, but home has never taught us how to learn.';

const VEIL_LIGHT = 'linear-gradient(135deg, rgba(93,82,148,.35), rgba(22,24,38,.25))';
const VEIL_STRONG = 'linear-gradient(135deg, rgba(93,82,148,.92), rgba(22,24,38,.88))';

function AuthIllustration() {
  return (
    <>
      {/* Mobile : zone haute avec illustration + voile transparent */}
      <div
        className="md:hidden h-[280px] flex-shrink-0 overflow-hidden relative"
        aria-hidden
      >
        <img
          src={AUTH_IMAGE}
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-[50%_65%]"
        />
        <div className="absolute inset-0" style={{ background: VEIL_LIGHT }} aria-hidden />
      </div>
      {/* Desktop : zone gauche avec illustration + voile opaque + citation */}
      <div
        className="hidden md:flex flex-1 min-w-0 overflow-hidden bg-[var(--om-bg)] relative"
        aria-hidden
      >
        <img
          src={AUTH_IMAGE}
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0" style={{ background: VEIL_STRONG }} aria-hidden />
        <div className="relative z-10 w-full flex items-center pl-8 lg:pl-12 pr-8 lg:pr-16">
          <p
            className="max-w-2xl text-4xl lg:text-5xl xl:text-6xl font-medium uppercase leading-snug tracking-[-0.02em]"
            style={{ color: '#f3f5fe' }}
          >
            {QUOTE}
          </p>
        </div>
      </div>
    </>
  );
}

export default AuthIllustration;
