#!/usr/bin/env node
/**
 * Génère une paire de clés VAPID pour le Web Push.
 * Usage : npm run generate-vapid
 *
 * La clé privée ne doit JAMAIS être commitée : la placer dans les secrets
 * GitHub (VAPID_PRIVATE_KEY), d'où le workflow l'injecte dans la Lambda.
 * Changer la paire invalide tous les abonnements existants.
 */
const webpush = require('web-push');

const { publicKey, privateKey } = webpush.generateVAPIDKeys();

console.log('\nClés VAPID générées.\n');
console.log('VAPID_PUBLIC_KEY=' + publicKey);
console.log('VAPID_PRIVATE_KEY=' + privateKey);
console.log('\nÀ ajouter dans les secrets GitHub du dépôt (Settings > Secrets > Actions).');
console.log('La clé publique est servie au navigateur par GET /api/push/public-key.\n');
