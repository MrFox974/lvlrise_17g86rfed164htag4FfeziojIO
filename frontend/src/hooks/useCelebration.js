import { useCallback, useEffect, useRef, useState } from 'react';

const DURATION_MS = 1400;

/**
 * Déclenche une célébration éphémère.
 *
 * `celebrate('+5 min')` affiche la rafale et la pastille, qui s'effacent seules.
 * `{ full: true }` pour la version « objectif bouclé » : plus dense, plus large.
 */
export function useCelebration(duration = DURATION_MS) {
  const [celebration, setCelebration] = useState(null);
  const timer = useRef(null);

  const celebrate = useCallback(
    (label, { full = false } = {}) => {
      setCelebration({ at: Date.now(), label, full });
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCelebration(null), duration);
    },
    [duration]
  );

  useEffect(() => () => clearTimeout(timer.current), []);

  return { celebration, celebrate };
}
