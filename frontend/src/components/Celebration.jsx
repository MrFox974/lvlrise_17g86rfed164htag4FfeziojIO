/**
 * Célébration d'un geste accompli : une rafale de points depuis le centre, et
 * une pastille qui monte en annonçant ce qui vient d'être gagné.
 *
 * Un seul composant pour toute l'app — jauges, routines, tâches, révisions —
 * pour que réussir quelque chose se ressente pareil partout.
 */

/** Rafale : plus dense et plus large quand un objectif est bouclé. */
function Burst({ full }) {
  const count = full ? 14 : 7;
  const radius = full ? 92 : 54;
  const size = full ? 7 : 5;

  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2;
    return (
      <span
        key={i}
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: size,
          height: size,
          borderRadius: 999,
          background: i % 3 === 0 ? 'var(--om-pro)' : 'var(--om-accent)',
          '--dx': `${Math.cos(angle) * radius}px`,
          '--dy': `${Math.sin(angle) * radius}px`,
          animation: 'om-burst 1.1s cubic-bezier(.2,.7,.3,1) forwards',
        }}
      />
    );
  });
}

/**
 * Ne capte jamais le pointeur : on peut continuer à cliquer pendant l'animation.
 *
 * `anchor="card"` (défaut) se cale sur le conteneur parent, qui doit être en
 * `position: relative` — pour une carte, où le geste vient d'avoir lieu.
 * `anchor="screen"` se cale sur la fenêtre : sur une page longue, un ancrage au
 * conteneur centrerait la rafale hors de l'écran dès qu'on a fait défiler.
 */
export function Celebration({ celebration, compact = false, anchor = 'card' }) {
  if (!celebration) return null;

  const onScreen = anchor === 'screen';

  return (
    <div
      key={celebration.at}
      aria-hidden
      style={{
        position: onScreen ? 'fixed' : 'absolute',
        inset: 0,
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        zIndex: onScreen ? 190 : 5,
      }}
    >
      <div style={{ position: 'absolute', left: '50%', top: '50%' }}>
        <Burst full={celebration.full} />
      </div>
      <div
        style={{
          position: 'absolute',
          /* Dans une carte, on passe sous la ligne d'intertitre plutôt que
             de la recouvrir le temps de l'animation. */
          top: onScreen ? '38%' : compact ? 10 : 46,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '7px 14px',
          borderRadius: 999,
          background: 'var(--om-accent-soft)',
          border: '1px solid var(--om-accent)',
          color: 'var(--om-text)',
          fontSize: 12.5,
          fontWeight: 500,
          whiteSpace: 'nowrap',
          animation: 'om-rise 1.4s ease-out forwards',
        }}
      >
        {celebration.label}
      </div>
    </div>
  );
}

/** Annonce la célébration aux lecteurs d'écran, que l'animation soit vue ou non. */
export function CelebrationLive({ celebration }) {
  return (
    <span className="sr-only" role="status" aria-live="polite">
      {celebration?.label || ''}
    </span>
  );
}
