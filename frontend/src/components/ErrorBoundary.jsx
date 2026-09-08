/**
 * ============================================================================
 * ERROR BOUNDARY - React Router v7
 * ============================================================================
 * 
 * Ce composant est affiché automatiquement par React Router v7 quand :
 * - Une erreur est throw dans un loader
 * - Une erreur survient lors du rendu d'un composant de route
 * - Une erreur 404 (route non trouvée)
 * 
 * FONCTIONNALITÉ V7 : useRouteError()
 * 
 * useRouteError() est un hook qui permet d'accéder à l'erreur qui a déclenché
 * l'affichage de l'errorElement.
 * 
 * TYPES D'ERREURS :
 * 
 * 1. Response Error (depuis un loader)
 *    - Status code HTTP (404, 500, etc.)
 *    - Message d'erreur
 * 
 * 2. Error Object (erreur JavaScript)
 *    - message : Description de l'erreur
 *    - stack : Stack trace (en développement)
 * 
 * 3. 404 Not Found
 *    - Quand une route n'existe pas
 * 
 * AVANTAGES :
 * - Gestion centralisée des erreurs
 * - Interface utilisateur cohérente en cas d'erreur
 * - Pas besoin de try/catch dans chaque composant
 */

import { useRouteError, Link, isRouteErrorResponse } from 'react-router-dom';

function ErrorBoundary() {
  /**
   * useRouteError() - Hook React Router v7
   * 
   * Récupère l'erreur qui a déclenché l'affichage de ce composant.
   * Peut être :
   * - Une Response (si throw depuis un loader)
   * - Une Error (erreur JavaScript)
   * - Un objet avec status/statusText (404, etc.)
   */
  const error = useRouteError();
  
  /**
   * isRouteErrorResponse() - Fonction utilitaire React Router v7
   * 
   * Vérifie si l'erreur est une Response Error (depuis un loader).
   * Permet de différencier les erreurs HTTP des erreurs JavaScript.
   */
  const isResponseError = isRouteErrorResponse(error);
  
  // Détermine le message et le code d'erreur à afficher
  let errorMessage = 'Une erreur est survenue';
  let errorStatus = null;
  
  if (isResponseError) {
    // Erreur HTTP (404, 500, etc.) depuis un loader
    errorStatus = error.status;
    errorMessage = error.statusText || errorMessage;
    
    // Messages personnalisés selon le code d'erreur
    if (error.status === 404) {
      errorMessage = 'Page non trouvée';
    } else if (error.status === 500) {
      errorMessage = 'Erreur serveur';
    }
  } else if (error instanceof Error) {
    // Erreur JavaScript classique
    errorMessage = error.message;
  }
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--om-surface-2)]">
      <div className="text-center p-8 bg-[var(--om-surface)] rounded-[10px] shadow-[var(--om-shadow)] max-w-md">
        {/* Icône d'erreur */}
        <div className="text-6xl mb-4">⚠️</div>
        
        {/* Code d'erreur (si disponible) */}
        {errorStatus && (
          <h1 className="text-4xl font-medium text-[var(--om-danger)] mb-2">
            {errorStatus}
          </h1>
        )}
        
        {/* Message d'erreur */}
        <h2 className="text-2xl font-medium mb-4 text-[var(--om-text)]">
          {errorMessage}
        </h2>
        
        {/* Détails de l'erreur (en développement seulement) */}
        {process.env.NODE_ENV === 'development' && (
          <details className="mt-4 text-left">
            <summary className="cursor-pointer text-[var(--om-muted)] mb-2">
              Détails techniques
            </summary>
            <pre className="bg-[var(--om-surface-2)] p-4 rounded text-xs overflow-auto">
              {JSON.stringify(error, null, 2)}
            </pre>
          </details>
        )}
        
        {/* Bouton pour retourner à l'accueil */}
        <Link
          to="/home"
          className="inline-block mt-6 px-6 py-3 bg-[var(--om-accent)] text-[var(--om-on-accent)] rounded-[10px] hover:bg-[var(--om-accent-hover)] transition-colors"
        >
          Retour à l'accueil
        </Link>
      </div>
    </div>
  );
}

export default ErrorBoundary;