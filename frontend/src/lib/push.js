/**
 * Abonnement du navigateur aux notifications push.
 *
 * Trois contraintes dictent ce fichier :
 *  - la demande de permission doit partir d'un geste utilisateur, sinon les
 *    navigateurs la refusent durablement pour tout le domaine ;
 *  - sur iOS (16.4+), le push n'existe que si l'app a été ajoutée à l'écran
 *    d'accueil : hors de ce mode, inutile de demander quoi que ce soit ;
 *  - la clé publique VAPID est servie par l'API, ce qui évite une variable de
 *    build côté Amplify.
 */
import { fetchVapidPublicKey, subscribeToPush } from '../utils/pushApi';

/** Codes retournés par ensurePushSubscription (l'appelant choisit le message). */
export const PUSH_RESULT = {
  OK: 'ok',
  UNSUPPORTED: 'unsupported',
  IOS_NEEDS_INSTALL: 'ios-needs-install',
  DENIED: 'denied',
  DISMISSED: 'dismissed',
  NOT_CONFIGURED: 'not-configured',
  ERROR: 'error',
};

export function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function isStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

export function isIos() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isIpad = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  return /iPad|iPhone|iPod/.test(ua) || isIpad;
}

export function getPermission() {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

async function getRegistration() {
  const existing = await navigator.serviceWorker.getRegistration('/');
  if (existing) return existing;
  return navigator.serviceWorker.register('/sw.js', { scope: '/' });
}

/**
 * Demande la permission si besoin, abonne le navigateur et enregistre
 * l'abonnement côté serveur (avec le fuseau horaire local).
 * Retourne un code PUSH_RESULT ; à appeler depuis un clic utilisateur.
 */
export async function ensurePushSubscription() {
  if (!isPushSupported()) {
    // Sur iOS le push n'apparaît qu'une fois l'app installée : on distingue le
    // cas pour pouvoir expliquer « Partager → Sur l'écran d'accueil ».
    if (isIos() && !isStandalone()) return PUSH_RESULT.IOS_NEEDS_INSTALL;
    return PUSH_RESULT.UNSUPPORTED;
  }
  if (isIos() && !isStandalone()) return PUSH_RESULT.IOS_NEEDS_INSTALL;

  if (Notification.permission === 'denied') return PUSH_RESULT.DENIED;
  if (Notification.permission === 'default') {
    const permission = await Notification.requestPermission();
    if (permission === 'denied') return PUSH_RESULT.DENIED;
    if (permission !== 'granted') return PUSH_RESULT.DISMISSED;
  }

  try {
    const publicKey = await fetchVapidPublicKey().catch(() => null);
    if (!publicKey) return PUSH_RESULT.NOT_CONFIGURED;

    const registration = await getRegistration();
    await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    await subscribeToPush(subscription.toJSON(), timezone);
    return PUSH_RESULT.OK;
  } catch (error) {
    console.error('Abonnement push impossible:', error);
    return PUSH_RESULT.ERROR;
  }
}

/** Message d'explication associé à un code d'échec (null si tout va bien). */
export function getPushResultMessage(result) {
  switch (result) {
    case PUSH_RESULT.OK:
      return null;
    case PUSH_RESULT.IOS_NEEDS_INSTALL:
      return 'Sur iPhone, ajoutez d\'abord LvlRise à l\'écran d\'accueil (Partager → Sur l\'écran d\'accueil) pour recevoir les notifications.';
    case PUSH_RESULT.DENIED:
      return 'Les notifications sont bloquées dans les réglages de votre navigateur. Le rappel est enregistré et partira dès que vous les réactiverez.';
    case PUSH_RESULT.DISMISSED:
      return 'Autorisation non accordée. Le rappel est enregistré, activez les notifications pour le recevoir.';
    case PUSH_RESULT.NOT_CONFIGURED:
      return 'Les notifications ne sont pas encore activées côté serveur. Le rappel est bien enregistré.';
    case PUSH_RESULT.UNSUPPORTED:
      return 'Votre navigateur ne gère pas les notifications. Le rappel est enregistré.';
    default:
      return 'Impossible d\'activer les notifications pour le moment. Le rappel est enregistré.';
  }
}
