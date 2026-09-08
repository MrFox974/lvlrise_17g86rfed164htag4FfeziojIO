import { Link, useLocation } from 'react-router-dom';

/**
 * Dock de navigation mobile.
 *
 * La vue d'ensemble et les trois modules de l'application encadrent le bouton
 * cerveau, qui sert d'accès rapide.
 * Sur desktop la navigation reste dans l'en-tête : le dock est masqué.
 */
function dockItems(base) {
  return [
    { to: `${base}/home`, label: 'Vue', icon: 'squares-four', exact: true },
    { to: `${base}/home/flashcards`, label: 'Cartes', icon: 'cards-three' },
    // ph-repeat : la même icône désigne les routines dans l'en-tête desktop,
    // le menu et l'accès rapide — le dock ne fait pas exception.
    { to: `${base}/home/routines`, label: 'Routines', icon: 'repeat' },
    { to: `${base}/home/todos`, label: 'To do', icon: 'check-square-offset' },
  ];
}

function DockLink({ item, active }) {
  return (
    <Link
      to={item.to}
      className="om-dock-item"
      data-active={active}
      aria-current={active ? 'page' : undefined}
    >
      <i
        className={`${active ? 'ph-fill' : 'ph'} ph-${item.icon}`}
        style={{ fontSize: 21 }}
        aria-hidden
      />
      <span>{item.label}</span>
    </Link>
  );
}

function AppDock({ onBrainOpen, isDemo = false }) {
  const location = useLocation();
  const base = isDemo ? '/demo' : '';
  const items = dockItems(base);

  const isActive = (item) =>
    item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to);

  const [left, right] = [items.slice(0, 2), items.slice(2)];

  return (
    <div className="md:hidden">
      <div className="om-dock-fade" aria-hidden />
      <nav className="om-dock" aria-label="Navigation principale">
        {left.map((item) => (
          <DockLink key={item.to} item={item} active={isActive(item)} />
        ))}
        <button
          type="button"
          onClick={onBrainOpen}
          className="om-dock-center"
          aria-label="Ouvrir le menu assistant"
        >
          <i className="ph ph-brain" style={{ fontSize: 24 }} aria-hidden />
        </button>
        {right.map((item) => (
          <DockLink key={item.to} item={item} active={isActive(item)} />
        ))}
      </nav>
    </div>
  );
}

export default AppDock;
