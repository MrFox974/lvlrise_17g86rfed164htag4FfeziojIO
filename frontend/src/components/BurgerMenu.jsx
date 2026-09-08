import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme';

const MENU_ITEMS = [
  { to: '/home', label: "Vue d'ensemble", icon: 'ph-squares-four' },
  { to: '/home/apprentissage', label: 'Apprentissage', icon: 'ph-target' },
  { to: '/home/productivite/carte-mentale', label: 'FlashCards', icon: 'ph-cards-three' },
  { to: '/home/productivite/markdown', label: 'Bibliothèque', icon: 'ph-books' },
  { to: '/home/productivite/notes', label: 'Notes', icon: 'ph-note-pencil' },
  { to: '/home/productivite/debat', label: 'Débat', icon: 'ph-scales' },
  { to: '/home/routines', label: 'Routines', icon: 'ph-repeat' },
  { to: '/home/todos', label: 'To do list', icon: 'ph-check-square-offset' },
  { to: '/home/domaines', label: 'Domaines', icon: 'ph-compass' },
  { to: '/plan', label: 'Plan', icon: 'ph-sparkle' },
  { to: '/settings', label: 'Paramètres', icon: 'ph-gear-six' },
];

const DEMO_MENU_ITEMS = [
  { to: '/demo/home', label: "Vue d'ensemble", icon: 'ph-squares-four' },
  { to: '/demo/home/apprentissage', label: 'Apprentissage', icon: 'ph-target' },
  { to: '/demo/home/productivite/carte-mentale', label: 'FlashCards', icon: 'ph-cards-three' },
  { to: '/demo/home/productivite/markdown', label: 'Bibliothèque', icon: 'ph-books' },
  { to: '/demo/home/productivite/notes', label: 'Notes', icon: 'ph-note-pencil' },
  { to: '/demo/home/productivite/debat', label: 'Débat', icon: 'ph-scales' },
  { to: '/demo/home/routines', label: 'Routines', icon: 'ph-repeat' },
  { to: '/demo/home/todos', label: 'To do list', icon: 'ph-check-square-offset' },
  { to: '/demo/home/domaines', label: 'Domaines', icon: 'ph-compass' },
  { to: '/demo/plan', label: 'Plan', icon: 'ph-sparkle' },
];

function BurgerButton({ isOpen, onClick, ariaLabel }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-expanded={isOpen}
      className="relative z-[100] w-10 h-10 flex items-center justify-center rounded-full text-[var(--om-muted)] hover:text-[var(--om-text)] hover:bg-[var(--om-surface)] transition-colors"
    >
      <i className={`ph ${isOpen ? 'ph-x' : 'ph-list'} text-[22px]`} aria-hidden />
    </button>
  );
}

function ThemeSwitch() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="flex flex-col gap-2.5">
      <span className="om-kicker">Thème</span>
      <div className="om-segment-quiet">
        <button
          type="button"
          onClick={() => setTheme('light')}
          className="om-segment-item flex-1 flex items-center justify-center gap-2"
          data-active={theme === 'light'}
        >
          <i className="ph ph-sun text-[16px]" aria-hidden /> Clair
        </button>
        <button
          type="button"
          onClick={() => setTheme('dark')}
          className="om-segment-item flex-1 flex items-center justify-center gap-2"
          data-active={theme === 'dark'}
        >
          <i className="ph ph-moon text-[16px]" aria-hidden /> Sombre
        </button>
      </div>
    </div>
  );
}

function BurgerMenu({ user, onLogout, isDemo = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const menuItems = isDemo ? DEMO_MENU_ITEMS : MENU_ITEMS;

  const handleClose = useCallback(() => {
    if (!isOpen) return;
    setIsClosing(true);
    setTimeout(() => {
      setIsOpen(false);
      setIsClosing(false);
      document.body.style.overflow = '';
    }, 280);
  }, [isOpen]);

  const handleToggle = useCallback(() => {
    if (isOpen) {
      handleClose();
    } else {
      setIsOpen(true);
      document.body.style.overflow = 'hidden';
    }
  }, [isOpen, handleClose]);

  const prevPathRef = useRef(location.pathname);

  useEffect(() => {
    const handleEscape = (e) => e.key === 'Escape' && handleClose();
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, handleClose]);

  useEffect(() => {
    if (prevPathRef.current !== location.pathname) {
      prevPathRef.current = location.pathname;
      if (isOpen) handleClose();
    } else {
      prevPathRef.current = location.pathname;
    }
  }, [location.pathname, isOpen, handleClose]);

  const handleLogout = () => {
    handleClose();
    onLogout?.();
    navigate(isDemo ? '/landingpage' : '/login', { replace: true });
  };

  if (!user) return null;

  const homePath = isDemo ? '/demo/home' : '/home';

  const menuOverlay = isOpen ? (
    <div
      className="fixed inset-0 z-[99999] flex"
      role="dialog"
      aria-modal="true"
      aria-label="Menu de navigation"
    >
      <div
        className={`om-scrim fixed inset-0 burger-backdrop-enter ${
          isClosing ? 'opacity-0 transition-opacity duration-300' : ''
        }`}
        onClick={handleClose}
        onKeyDown={(e) => e.key === 'Enter' && handleClose()}
        role="button"
        tabIndex={0}
        aria-label="Fermer le menu"
      />

      <nav
        className={`relative z-10 ml-auto w-full max-w-[290px] min-h-screen bg-[var(--om-surface)] border-l border-[var(--om-line)] flex flex-col ${
          isClosing
            ? 'translate-x-full transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]'
            : 'burger-panel-enter'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center px-[18px] pt-[18px] pb-3.5">
          <span className="om-kicker">Menu</span>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Fermer"
            className="om-icon-btn w-8 h-8"
          >
            <i className="ph ph-x text-[15px]" aria-hidden />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar px-3 pb-3 flex flex-col gap-0.5">
          {isDemo && (
            <div className="mx-1 mb-2 px-3 py-2 rounded-[10px] bg-[var(--om-accent-soft)]">
              <p className="om-kicker" style={{ color: 'var(--om-accent)' }}>
                Mode démo
              </p>
            </div>
          )}
          {menuItems.map((item) => {
            const isActive =
              item.to === homePath
                ? location.pathname === item.to
                : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={handleClose}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center gap-3 px-3 py-3 rounded-[10px] text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[var(--om-accent-soft)] text-[var(--om-accent)]'
                    : 'text-[var(--om-text)] hover:bg-[var(--om-surface-2)]'
                }`}
              >
                <i
                  className={`${isActive ? 'ph-fill' : 'ph'} ${item.icon} text-[19px] shrink-0`}
                  aria-hidden
                />
                {item.label}
              </Link>
            );
          })}

          <button
            type="button"
            onClick={handleLogout}
            className="mt-2 flex items-center gap-3 w-full px-3 py-3 rounded-[10px] text-sm font-medium text-[var(--om-danger)] hover:bg-[var(--om-danger-soft)] transition-colors"
          >
            <i className="ph ph-sign-out text-[19px] shrink-0" aria-hidden />
            {isDemo ? 'Quitter la démo' : 'Déconnexion'}
          </button>
        </div>

        <div className="mt-auto px-[18px] pt-4 pb-[18px] om-sep flex flex-col gap-2.5">
          <ThemeSwitch />
          <span className="text-[11.5px] text-[var(--om-muted)] truncate">
            {user?.email || user?.username || 'Compte'}
          </span>
        </div>
      </nav>
    </div>
  ) : null;

  return (
    <>
      <BurgerButton
        isOpen={isOpen}
        onClick={handleToggle}
        ariaLabel={isOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
      />
      {createPortal(menuOverlay, document.body)}
    </>
  );
}

export default BurgerMenu;
