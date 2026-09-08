// scheduler.js — point d'entrée Lambda du cron des notifications.
//
// Volontairement séparé de handler.js : celui-ci charge app.js, dont
// l'initialisation lance un sequelize.sync() et une série d'ALTER TABLE à
// chaque démarrage à froid. Acceptable pour l'API (rare), inutile et coûteux
// pour un cron qui tourne toutes les minutes — les tables sont créées par les
// migrations au déploiement.
//
// On ne charge donc ici que la connexion et les modèles réellement utilisés.
require('dotenv').config();

const { sequelize } = require('./config/database');

// Vérification de connexion faite une seule fois par conteneur, puis réutilisée
// par les invocations à chaud.
let connectionPromise = null;
function ensureConnection() {
  if (!connectionPromise) {
    connectionPromise = sequelize.authenticate().catch((error) => {
      // On réinitialise pour permettre une nouvelle tentative au prochain
      // passage plutôt que de garder une promesse rejetée en cache.
      connectionPromise = null;
      throw error;
    });
  }
  return connectionPromise;
}

module.exports.handler = async () => {
  try {
    await ensureConnection();
    const { runScheduler } = require('./services/notification-scheduler.service');
    const result = await runScheduler();
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (error) {
    console.error('Notification scheduler error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
