import { useState, useCallback, useEffect, useRef } from 'react';
import { Outlet, useNavigate, Link, useLocation, useNavigation } from 'react-router-dom';
import { BrainModal } from './BrainModal';
import BurgerMenu from './BurgerMenu';
import AppDock from './AppDock';
import NavigationSkeleton from './skeletons/NavigationSkeleton';
import { initDemoData } from '../hooks/useDemoMode';

const APP_VERSION = 'v-1.0-demo';
const DEMO_ONBOARDING_SEEN_KEY = 'demo_onboarding_seen';

const DESKTOP_NAV_ITEMS = [
  { to: '/demo/home/apprentissage', label: 'Apprentissage', icon: 'target' },
  { to: '/demo/home/productivite/carte-mentale', label: 'FlashCards', icon: 'cards-three' },
  { to: '/demo/home/productivite/markdown', label: 'Bibliothèque', icon: 'books' },
  { to: '/demo/home/routines', label: 'Routines', icon: 'repeat' },
  { to: '/demo/home/todos', label: 'To do list', icon: 'check-square-offset' },
  { to: '/demo/plan', label: 'Plan', icon: 'sparkle' },
];

function DemoLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const navigation = useNavigation();
  const [brainModalOpen, setBrainModalOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(true);
  const userMenuRef = useRef(null);
  const isLoading = navigation.state === 'loading';

  const demoUser = { username: 'Démo', email: 'demo@example.com' };
  const userInitial = 'D';

  useEffect(() => {
    initDemoData();
    const seen = localStorage.getItem(DEMO_ONBOARDING_SEEN_KEY);
    if (seen === '1') setShowOnboarding(false);
  }, []);

  const handleOnboardingDismiss = useCallback(() => {
    localStorage.setItem(DEMO_ONBOARDING_SEEN_KEY, '1');
    setShowOnboarding(false);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    if (userMenuOpen) document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [userMenuOpen]);

  const handleBrainOpen = useCallback(() => setBrainModalOpen(true), []);
  const handleBrainClose = useCallback(() => setBrainModalOpen(false), []);
  const handleBrainSelect = useCallback(
    (id) => {
      if (id === 'apprentissages') navigate('/demo/home/apprentissage');
      else if (id === 'bibliotheque') navigate('/demo/home/productivite/markdown');
      else if (id === 'flashcard') navigate('/demo/home/productivite/carte-mentale');
      else if (id === 'routines') navigate('/demo/home/routines');
      else if (id === 'todo') navigate('/demo/home/todos');
      else if (id === 'note') navigate('/demo/home/productivite/notes');
      else if (id === 'debat') navigate('/demo/home/productivite/debat');
    },
    [navigate]
  );

  const handleLogout = useCallback(() => {
    navigate('/landingpage', { replace: true });
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--om-bg)]">
      <header className="sticky top-0 z-50 bg-[var(--om-bg)]/85 backdrop-blur-md px-4 md:px-6 py-3">
        <nav className="container mx-auto flex items-center justify-between gap-4">
          <Link
            to="/demo/home"
            className="md:hidden flex items-center gap-3 min-w-0 flex-1"
            aria-label="Retour à l'accueil (Démo)"
          >
            <span className="relative w-10 h-10 flex-shrink-0">
              <span className="absolute inset-0 rounded-full border border-[var(--om-accent)]" />
              <span className="absolute inset-[3px] rounded-full bg-[var(--om-surface-2)] flex items-center justify-center text-sm font-medium text-[var(--om-accent)]">
                {userInitial}
              </span>
            </span>
            <span className="flex flex-col min-w-0">
              <span className="text-[15px] font-medium tracking-[-0.01em] text-[var(--om-text)] truncate">
                Bienvenue
              </span>
              <span className="om-kicker truncate">Mode démo</span>
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-8 flex-shrink-0">
            <Link to="/demo/home" className="flex-shrink-0 -ml-1" aria-label="LvlRise - Accueil démo">
              <img src="/lvlrise-logo.png" alt="LvlRise" className="h-12 w-auto object-contain" />
            </Link>
            <Link
              to="/demo/home"
              className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-medium transition-colors ${
                location.pathname === '/demo/home'
                  ? 'text-[var(--om-on-accent)] bg-[var(--om-accent)]'
                  : 'text-[var(--om-muted)] hover:bg-[var(--om-surface)] hover:text-[var(--om-text)]'
              }`}
            >
              <i className="ph ph-squares-four text-[17px]" aria-hidden />
              Vue d&apos;ensemble
            </Link>
          </div>

          <div className="hidden md:flex items-center gap-1 flex-wrap">
            {DESKTOP_NAV_ITEMS.map((item) => {
              const isActive = location.pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-[var(--om-on-accent)] bg-[var(--om-accent)]'
                      : 'text-[var(--om-muted)] hover:bg-[var(--om-surface)] hover:text-[var(--om-text)]'
                  }`}
                >
                  <i
                    className={`${isActive ? 'ph-fill' : 'ph'} ph-${item.icon} text-[17px]`}
                    aria-hidden
                  />
                  {item.label}
                </Link>
              );
            })}
          </div>

          <div className="hidden md:block relative flex-shrink-0" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setUserMenuOpen((o) => !o)}
              className="w-10 h-10 rounded-full border border-[var(--om-accent)] bg-[var(--om-surface-2)] text-[var(--om-accent)] text-sm font-medium flex items-center justify-center hover:bg-[var(--om-accent-soft)] transition-colors"
              aria-label="Menu utilisateur"
              aria-expanded={userMenuOpen}
            >
              {userInitial}
            </button>
            {userMenuOpen && (
              <div className="om-card absolute right-0 top-full mt-2 w-60 p-2 z-50 animate-om-pop">
                <div className="px-3 py-2 om-kicker">Mode démo</div>
                <Link
                  to="/demo/home/domaines"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-sm font-medium text-[var(--om-text)] hover:bg-[var(--om-surface-2)] transition-colors"
                >
                  <i className="ph ph-compass text-[18px]" aria-hidden />
                  Domaines
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen(false);
                    handleLogout();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-sm font-medium text-[var(--om-danger)] hover:bg-[var(--om-danger-soft)] transition-colors text-left"
                >
                  <i className="ph ph-sign-out text-[18px]" aria-hidden />
                  Quitter la démo
                </button>
                <div className="px-3 py-2 mt-1 om-sep flex items-center justify-between gap-2">
                  <p className="text-[10px] text-[var(--om-muted)] flex-shrink-0">{APP_VERSION}</p>
                  <p className="text-xs text-[var(--om-muted)] truncate text-right" title={demoUser.email}>
                    {demoUser.email}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="md:hidden flex-shrink-0">
            <BurgerMenu user={demoUser} onLogout={handleLogout} isDemo />
          </div>
        </nav>
      </header>

      {/* Bandeau démo */}
      <div className="mx-4 md:mx-6 mb-1 px-4 py-2.5 rounded-full bg-[var(--om-accent-soft)] border border-[var(--om-accent)] text-center text-[13px] text-[var(--om-text)]">
        Vous êtes en démo —{' '}
        <Link to="/register" className="text-[var(--om-accent)] font-medium underline hover:no-underline">
          inscrivez-vous
        </Link>
      </div>

      <main className="flex-1 pb-28 md:pb-0">
        {isLoading ? <NavigationSkeleton /> : <Outlet />}
      </main>

      <AppDock onBrainOpen={handleBrainOpen} isDemo />
      <button
        type="button"
        onClick={handleBrainOpen}
        className={`hidden md:flex fixed bottom-6 right-6 w-14 h-14 rounded-full border border-[var(--om-accent)] bg-[var(--om-surface)] text-[var(--om-accent)] shadow-[var(--om-shadow-lg)] hover:bg-[var(--om-accent-soft)] active:scale-95 transition-all duration-200 items-center justify-center ${
          showOnboarding ? 'z-[170]' : 'z-[150]'
        }`}
        aria-label="Ouvrir le menu assistant"
      >
        <i className="ph ph-brain text-[26px]" aria-hidden />
      </button>
      <BrainModal
        isOpen={brainModalOpen}
        onClose={handleBrainClose}
        onSelect={handleBrainSelect}
        showAdminButton={false}
      />

      {/* Première visite : on désigne le cerveau, seul point d'entrée des outils */}
      {showOnboarding && (
        <>
          <div
            className="fixed inset-0 z-[160]"
            onClick={handleOnboardingDismiss}
            onKeyDown={(e) => e.key === 'Escape' && handleOnboardingDismiss()}
            aria-hidden
            style={{
              background: 'var(--om-scrim)',
              backdropFilter: 'blur(2px)',
            }}
          />
          <div className="om-card fixed bottom-32 md:bottom-28 left-4 right-4 md:left-auto md:right-6 z-[165] md:w-full md:max-w-sm p-5 flex flex-col gap-4">
            <p className="text-[var(--om-text)] text-[15px] leading-snug">
              Tous les outils de productivité (Bibliothèque, FlashCard, Note) se trouvent derrière le
              cerveau, au centre du dock.
            </p>
            <p className="om-kicker">Explication 1/1</p>
            <button type="button" onClick={handleOnboardingDismiss} className="om-btn om-btn-primary w-full">
              Compris
            </button>
          </div>
        </>
      )}

      <footer className="hidden md:block py-4 px-4 text-center flex-shrink-0">
        <p className="om-kicker">
          © 2025 LvlRise · <span style={{ color: 'var(--om-accent)' }}>Mode démo</span>
        </p>
      </footer>
    </div>
  );
}

export default DemoLayout;
