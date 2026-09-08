import { useState, useCallback, useEffect, useRef } from 'react';
import { Outlet, useNavigate, Link, useLocation, useNavigation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { BrainModal } from './BrainModal';
import OnboardingGenerationPopup from './OnboardingGenerationPopup';
import { isAdmin, trackPageVisit } from '../utils/adminApi';
import BurgerMenu from './BurgerMenu';
import AppDock from './AppDock';
import NavigationSkeleton from './skeletons/NavigationSkeleton';

const APP_VERSION = 'v-1.0';

const DESKTOP_NAV_ITEMS = [
  { to: '/home/flashcards', label: 'FlashCards', icon: 'cards-three' },
  { to: '/home/routines', label: 'Routines', icon: 'repeat' },
  { to: '/home/todos', label: 'To do list', icon: 'check-square-offset' },
  { to: '/plan', label: 'Plan', icon: 'sparkle' },
];

function greetingName(user) {
  const raw = user?.username || user?.email || '';
  const name = raw.includes('@') ? raw.split('@')[0] : raw;
  if (!name) return '';
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const navigation = useNavigation();
  const { user, logout } = useAuth();
  const [brainModalOpen, setBrainModalOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);
  const isLoading = navigation.state === 'loading';

  const userInitial = (user?.username || user?.email || '?')[0].toUpperCase();
  const firstName = greetingName(user);

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
      if (id === 'admin') {
        navigate('/admin');
      } else if (id === 'flashcard') {
        navigate('/home/flashcards');
      } else if (id === 'routines') {
        navigate('/home/routines');
      } else if (id === 'todo') {
        navigate('/home/todos');
      }
    },
    [navigate]
  );

  useEffect(() => {
    if (user && location.pathname) {
      trackPageVisit(location.pathname);
    }
  }, [user, location.pathname]);

  const handleLogout = useCallback(() => {
    logout?.();
    navigate('/login', { replace: true });
  }, [logout, navigate]);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--om-bg)]">
      <header className="sticky top-0 z-50 bg-[var(--om-bg)]/85 backdrop-blur-md px-4 md:px-6 py-3 flex-shrink-0">
        <nav className="container mx-auto flex items-center justify-between gap-4">
          {/* Mobile : on met en avant la personne, pas la marque */}
          {user && (
            <Link
              to="/home"
              className="md:hidden flex items-center gap-3 min-w-0 flex-1"
              aria-label="Retour à l'accueil"
            >
              <span className="relative w-10 h-10 flex-shrink-0">
                <span className="absolute inset-0 rounded-full border border-[var(--om-accent)]" />
                <span className="absolute inset-[3px] rounded-full bg-[var(--om-surface-2)] flex items-center justify-center text-sm font-medium text-[var(--om-accent)]">
                  {userInitial}
                </span>
              </span>
              <span className="flex flex-col min-w-0">
                <span className="text-[15px] font-medium tracking-[-0.01em] text-[var(--om-text)] truncate">
                  {firstName ? `Salut ${firstName}` : 'Bienvenue'}
                </span>
                <span className="om-kicker truncate">LvlRise</span>
              </span>
            </Link>
          )}

          <div className="hidden md:flex items-center gap-8 flex-shrink-0">
            <Link
              to="/home"
              className="flex-shrink-0 -ml-1"
              aria-label="LvlRise - Retour à l'accueil"
            >
              <img
                src="/lvlrise-logo.png"
                alt="LvlRise"
                className="h-12 w-auto object-contain"
              />
            </Link>
            <Link
              to="/home"
              className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-medium transition-colors ${
                location.pathname === '/home'
                  ? 'text-[var(--om-on-accent)] bg-[var(--om-accent)]'
                  : 'text-[var(--om-muted)] hover:bg-[var(--om-surface)] hover:text-[var(--om-text)]'
              }`}
            >
              <i className="ph ph-squares-four text-[17px]" aria-hidden />
              Vue d&apos;ensemble
            </Link>
          </div>

          {!user && <div className="md:hidden flex-1" />}

          {user && (
            <>
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
                    <Link
                      to="/home/routines"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-sm font-medium text-[var(--om-text)] hover:bg-[var(--om-surface-2)] transition-colors"
                    >
                      <i className="ph ph-repeat text-[18px]" aria-hidden />
                      Routines
                    </Link>
                    <Link
                      to="/home/flashcards"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-sm font-medium text-[var(--om-text)] hover:bg-[var(--om-surface-2)] transition-colors"
                    >
                      <i className="ph ph-cards-three text-[18px]" aria-hidden />
                      FlashCards
                    </Link>
                    <Link
                      to="/settings"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-sm font-medium text-[var(--om-text)] hover:bg-[var(--om-surface-2)] transition-colors"
                    >
                      <i className="ph ph-gear-six text-[18px]" aria-hidden />
                      Paramètres
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
                      Déconnexion
                    </button>
                    <div className="px-3 py-2 mt-1 om-sep flex items-center justify-between gap-2">
                      <p className="text-[10px] text-[var(--om-muted)] flex-shrink-0">{APP_VERSION}</p>
                      <p className="text-xs text-[var(--om-muted)] truncate text-right" title={user?.email}>
                        {user?.email || user?.username || 'Compte'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
              <div className="md:hidden flex-shrink-0">
                <BurgerMenu user={user} onLogout={logout} />
              </div>
            </>
          )}
        </nav>
      </header>

      <OnboardingGenerationPopup />
      {/* Sur mobile, on réserve la hauteur du dock pour que rien ne passe dessous */}
      <main className="flex-1 pb-28 md:pb-0">
        {isLoading ? <NavigationSkeleton /> : <Outlet />}
      </main>

      {user && (
        <>
          <AppDock onBrainOpen={handleBrainOpen} />
          {/* Desktop : le cerveau reste un bouton flottant */}
          <button
            type="button"
            onClick={handleBrainOpen}
            className="hidden md:flex fixed bottom-6 right-6 z-[150] w-14 h-14 rounded-full border border-[var(--om-accent)] bg-[var(--om-surface)] text-[var(--om-accent)] shadow-[var(--om-shadow-lg)] hover:bg-[var(--om-accent-soft)] active:scale-95 transition-all duration-200 items-center justify-center"
            aria-label="Ouvrir le menu assistant"
          >
            <i className="ph ph-brain text-[26px]" aria-hidden />
          </button>
          <BrainModal
            isOpen={brainModalOpen}
            onClose={handleBrainClose}
            onSelect={handleBrainSelect}
            showAdminButton={isAdmin(user)}
          />
        </>
      )}

      <footer className="hidden md:block py-4 px-4 text-center flex-shrink-0">
        <p className="om-kicker">© 2025 LvlRise</p>
      </footer>
    </div>
  );
}

export default Layout;
