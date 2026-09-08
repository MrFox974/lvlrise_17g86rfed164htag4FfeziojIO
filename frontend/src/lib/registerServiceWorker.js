/**
 * Enregistrement du service worker.
 *
 * Sans lui, pas d'installation sur l'écran d'accueil et pas de notifications :
 * c'est le service worker qui reçoit les push, même app fermée.
 * En développement (vite dev), on ne l'enregistre pas — un worker persistant
 * masquerait le rechargement à chaud.
 */
export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  if (import.meta.env.DEV) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((error) => {
      console.error('Service worker non enregistré:', error);
    });
  });

  // Le navigateur peut faire tourner les clés de l'abonnement push : le worker
  // nous prévient, on réenregistre l'abonnement côté serveur.
  navigator.serviceWorker.addEventListener('message', async (event) => {
    if (event.data?.type !== 'PUSH_SUBSCRIPTION_CHANGED') return;
    if (!localStorage.getItem('accessToken')) return;
    const { ensurePushSubscription } = await import('./push');
    ensurePushSubscription();
  });
}
