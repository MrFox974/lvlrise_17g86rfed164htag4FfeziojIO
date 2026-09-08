import { getDemoData, getDefaultDemoDomains } from '../../hooks/useDemoMode';

/**
 * Charge les domaines démo : 5 perso + 3 pro, mêmes ids que les jauges (stats).
 * Aligné sur le mode connecté pour que les objectifs jour/semaine correspondent aux domaines affichés.
 */
export const demoDomainesLoader = async () => {
  const data = getDemoData();
  const domains = data.domains?.length ? data.domains : getDefaultDemoDomains();
  return { domains };
};
