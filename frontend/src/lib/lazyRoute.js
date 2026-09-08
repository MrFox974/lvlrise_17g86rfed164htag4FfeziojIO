import { lazy } from 'react';

/**
 * Chargement paresseux d'une page, à l'épreuve d'une coquille périmée.
 *
 * Les morceaux de route sont demandés à la volée, longtemps après le premier
 * rendu. Si le HTML qui tourne vient d'un déploiement précédent — le service
 * worker sert sa coquille en cache quand la navigation échoue, ce qui arrive
 * volontiers au lancement à froid depuis l'écran d'accueil —, ces morceaux
 * n'existent plus sur le serveur. L'application démarre pourtant : son bundle
 * d'entrée, marqué immuable, survit dans le cache HTTP. Seules les pages encore
 * jamais ouvertes tombent, ce qui donne le symptôme trompeur d'un outil qui
 * marche et de tous les autres qui échouent.
 *
 * Un `import()` rejeté ne remonte pas comme les autres pannes : il n'atteint
 * aucun élément du document, seul l'ErrorBoundary du routeur le voit — et il
 * affiche un message d'erreur là où il faudrait recharger. On tente donc une
 * seconde fois (une coupure réseau passagère se répare toute seule), puis on
 * demande la purge de la coquille.
 *
 * @param {() => Promise<{ default: React.ComponentType }>} load
 * @returns {React.LazyExoticComponent}
 */
export default function lazyRoute(load) {
  return lazy(() =>
    load().catch(() =>
      // Un aller-retour laisse le temps à un réseau qui vacille de se reprendre ;
      // un morceau réellement supprimé, lui, échouera de nouveau.
      new Promise((resolve) => { setTimeout(resolve, 600); })
        .then(load)
        .catch((error) => {
          const recovered = window.__lvlriseRecoverShell?.('module de route introuvable');
          // Le rechargement est lancé : afficher une erreur pour la remplacer
          // aussitôt ne ferait que clignoter. On laisse le squelette en place.
          if (recovered) return new Promise(() => {});
          // Purge écartée (hors ligne, ou déjà tentée) : mieux vaut l'écran
          // d'erreur du routeur, qui au moins propose de revenir en arrière.
          throw error;
        })
    )
  );
}
