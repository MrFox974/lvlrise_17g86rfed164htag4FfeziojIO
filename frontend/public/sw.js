/* eslint-env serviceworker */
/**
 * Service worker LvlRise.
 *
 * Trois rôles :
 *  1. rendre l'app installable (un handler `fetch` est exigé par Chrome, et
 *     l'installation sur l'écran d'accueil est la condition du Web Push iOS) ;
 *  2. recevoir les notifications push envoyées par la Lambda ;
 *  3. ouvrir la bonne page au clic sur une notification.
 *
 * Volontairement écrit à la main, sans Workbox : on ne met en cache que la
 * coquille de navigation. Aucune réponse d'API n'est stockée — les données
 * seraient périmées et masqueraient les erreurs réseau.
 */

// `__BUILD_ID__` est remplacé à la compilation par l'empreinte du bundle
// (voir le plugin `lvlrise-sw-build-id` dans vite.config.js). Sans ça le nom du
// cache ne changeait jamais : `activate` ne purgeait rien, et la coquille d'un
// déploiement précédent survivait en réclamant des assets déjà supprimés.
const CACHE_VERSION = 'lvlrise-__BUILD_ID__';
const APP_SHELL = '/index.html';
const OFFLINE_ASSETS = ['/index.html', '/manifest.webmanifest', '/icons/icon-192.png'];

const DEFAULT_ICON = '/icons/icon-192.png';
const DEFAULT_BADGE = '/icons/icon-192.png';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(OFFLINE_ASSETS))
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/**
 * Navigation : réseau d'abord, coquille en cache seulement si le réseau est
 * indisponible. Tout le reste (assets, API) passe directement au réseau.
 *
 * Servir la coquille en cache n'est pas anodin : elle réclame les bundles d'un
 * déploiement passé, que le serveur a supprimés depuis. L'application démarre
 * quand même — le bundle d'entrée, marqué immuable, survit dans le cache HTTP —
 * mais chaque page encore jamais ouverte échoue à se charger. C'est un dernier
 * recours pour le mode avion, pas une réponse acceptable quand le réseau est
 * simplement lent à se réveiller.
 *
 * Or le lancement à froid depuis l'écran d'accueil est exactement ce cas : la
 * radio n'est pas encore prête, la première requête échoue en quelques
 * millisecondes. D'où la seconde tentative avant de se rabattre — elle coûte un
 * aller-retour et évite de figer l'app dans une version d'hier.
 */
const NAVIGATION_RETRY_DELAY_MS = 700;

function cacheShell(response) {
  // On ne remplace la coquille que par une réponse saine : `fetch` ne
  // rejette que sur panne réseau, un 404 ou un 502 arrive ici comme un
  // succès et deviendrait la page servie hors ligne, définitivement.
  if (!response.ok || response.type !== 'basic') return;
  const copy = response.clone();
  caches.open(CACHE_VERSION).then((cache) => cache.put(APP_SHELL, copy)).catch(() => undefined);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || request.mode !== 'navigate') return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        cacheShell(response);
        return response;
      })
      .catch(() => new Promise((resolve) => { setTimeout(resolve, NAVIGATION_RETRY_DELAY_MS); })
        .then(() => fetch(request))
        .then((response) => {
          cacheShell(response);
          return response;
        }))
      .catch(() => caches.match(APP_SHELL).then((cached) => cached || Response.error()))
  );
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'LvlRise';
  const options = {
    body: payload.body || '',
    icon: payload.icon || DEFAULT_ICON,
    badge: payload.badge || DEFAULT_BADGE,
    // Un tag identique remplace la notification précédente au lieu d'empiler.
    tag: payload.tag || 'lvlrise',
    renotify: !!payload.tag,
    lang: 'fr-FR',
    timestamp: Date.now(),
    data: { url: payload.url || '/home' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/home';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Si l'app est déjà ouverte, on la ramène au premier plan et on navigue.
      for (const client of clients) {
        if ('focus' in client) {
          if ('navigate' in client) client.navigate(target).catch(() => undefined);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});

/**
 * Le navigateur peut faire tourner les clés d'un abonnement : sans ce handler,
 * l'appareil cesserait silencieusement de recevoir les notifications.
 * On ne peut pas rejouer l'appel authentifié ici (pas de token) : on prévient
 * les onglets ouverts, qui referont l'abonnement au prochain chargement.
 */
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      clients.forEach((client) => client.postMessage({ type: 'PUSH_SUBSCRIPTION_CHANGED' }));
    })
  );
});
