import { useState, useCallback, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';

// Inject custom breakpoint styles once
const STYLE_ID = 'lvlrise-nav-custom';
function injectNavStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.innerHTML = `
    @media (min-width: 768px) and (max-width: 919px) {
      .nav-tarifs, .nav-apropos { display: none; }
    }
    @media (min-width: 1260px) {
      .nav-inner { padding-left: 3rem; padding-right: 3rem; }
    }
  `;
  document.head.appendChild(style);
}

function LandingLayout({ children }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const isLanding = location.pathname === '/' || location.pathname === '/landingpage';

  useEffect(() => { injectNavStyles(); }, []);

  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), []);

  const scrollToSection = (id) => {
    if (!isLanding) return;
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
    closeMobileMenu();
  };

  const navLinks = [
    { id: 'fonctionnalites', label: 'Fonctionnalités', className: '' },
    { id: 'comment-ca-marche', label: 'Comment ça marche', className: '' },
    { id: 'tarifs', label: 'Tarifs', className: 'nav-tarifs' },
    { id: 'temoignages', label: 'Témoignages', className: '' },
    { id: 'a-propos', label: 'À propos', className: 'nav-apropos' },
  ];

  const hNav = isLanding ? 'h-16 md:h-[4.5rem]' : 'h-14 md:h-16';
  const logoSize = isLanding ? 'h-10 md:h-12' : 'h-9 md:h-11';
  const navText = isLanding ? 'text-[15px]' : 'text-sm';
  const ctaBtn = isLanding
    ? 'px-5 py-2.5 rounded-2xl text-[15px] font-medium'
    : 'px-4 py-2 rounded-[10px] text-sm font-medium';
  const ctaBtnMobile = isLanding
    ? 'px-4 py-2.5 rounded-2xl text-sm font-medium'
    : 'px-3 py-2 rounded-[10px] text-xs font-medium';

  return (
    <div className="min-h-screen flex flex-col bg-[var(--om-bg)]">
      <header className="sticky top-0 z-50 bg-[var(--om-surface)]/95 backdrop-blur-sm border-b border-[var(--om-line)] shadow-[var(--om-shadow)] flex-shrink-0">
        <nav className={`nav-inner w-full xl:max-w-screen-xl xl:mx-auto px-4 md:px-6 flex items-center ${hNav} justify-between`}>
          
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link to="/" className="flex items-center gap-2" aria-label="LvlRise - Accueil">
              <img src="/lvlrise-logo.png" alt="LvlRise" className={`${logoSize} w-auto object-contain`} />
            </Link>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-4 lg:gap-8">
            {navLinks.map(({ id, label, className }) => (
              <button
                key={id}
                type="button"
                onClick={() => scrollToSection(id)}
                className={`${className} ${navText} text-[var(--om-muted)] hover:text-[var(--om-accent)] font-medium transition-colors whitespace-nowrap`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-3 flex-shrink-0">
            <Link
              to="/login"
              className={`${navText} font-medium text-[var(--om-muted)] hover:text-[var(--om-text)] transition-colors whitespace-nowrap`}
            >
              Connexion
            </Link>
            <Link
              to="/demo/home"
              className={`inline-flex items-center justify-center bg-[var(--om-accent)] text-[var(--om-on-accent)] hover:bg-[var(--om-accent-hover)] transition-colors whitespace-nowrap ${ctaBtn}`}
            >
              Essayer maintenant
            </Link>
          </div>

          {/* Mobile */}
          <div className="flex md:hidden items-center gap-2">
            <Link
              to="/demo/home"
              className={`inline-flex items-center justify-center bg-[var(--om-accent)] text-[var(--om-on-accent)] hover:bg-[var(--om-accent-hover)] whitespace-nowrap ${ctaBtnMobile}`}
            >
              Essayer maintenant
            </Link>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((o) => !o)}
              className={`rounded-[10px] text-[var(--om-text)] hover:bg-[var(--om-surface-2)] ${isLanding ? 'p-2.5' : 'p-2'}`}
              aria-label="Menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </nav>

        {/* Mobile menu panel */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[var(--om-line)] bg-[var(--om-surface)]">
            <div className={`container mx-auto px-4 flex flex-col gap-3 ${isLanding ? 'py-5' : 'py-4'}`}>
              {navLinks.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => scrollToSection(id)}
                  className={`text-left py-2 font-medium text-[var(--om-text)] hover:text-[var(--om-accent)] ${isLanding ? 'text-[15px]' : 'text-sm'}`}
                >
                  {label}
                </button>
              ))}
              <Link to="/login" onClick={closeMobileMenu} className={`py-2 font-medium text-[var(--om-muted)] ${isLanding ? 'text-[15px]' : 'text-sm'}`}>
                Connexion
              </Link>
              <Link to="/register" onClick={closeMobileMenu} className={`py-2 font-medium text-[var(--om-muted)] ${isLanding ? 'text-[15px]' : 'text-sm'}`}>
                Inscription
              </Link>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">
        {children || <Outlet />}
      </main>

      <footer className="border-t border-[var(--om-line)] bg-[var(--om-surface-2)] flex-shrink-0">
        <div className={`container mx-auto px-4 md:px-6 lg:px-8 ${isLanding ? 'py-10 md:py-12' : 'py-8 md:py-10'}`}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex flex-col gap-2">
              <Link to="/" className="inline-flex">
                <img src="/lvlrise-logo.png" alt="LvlRise" className={`w-auto opacity-90 ${isLanding ? 'h-9' : 'h-8'}`} />
              </Link>
              <p className={`text-[var(--om-muted)] max-w-xs ${isLanding ? 'text-[15px]' : 'text-sm'}`}>
                Réviser, s&apos;organiser, tenir le rythme. De l&apos;intention à la pratique régulière.
              </p>
            </div>
            <div className={`flex flex-wrap gap-6 md:gap-8 ${isLanding ? 'text-[15px]' : 'text-sm'}`}>
              <button type="button" onClick={() => scrollToSection('fonctionnalites')} className="text-[var(--om-muted)] hover:text-[var(--om-accent)]">Fonctionnalités</button>
              <button type="button" onClick={() => scrollToSection('tarifs')} className="text-[var(--om-muted)] hover:text-[var(--om-accent)]">Tarifs</button>
              <Link to="/login" className="text-[var(--om-muted)] hover:text-[var(--om-accent)]">Connexion</Link>
              <Link to="/register" className="font-medium text-[var(--om-accent)] hover:underline">S&apos;inscrire</Link>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-[var(--om-line)] text-center md:text-left">
            <p className={`text-[var(--om-muted)] ${isLanding ? 'text-sm' : 'text-xs'}`}>© {new Date().getFullYear()} LvlRise. Tous droits réservés.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingLayout;