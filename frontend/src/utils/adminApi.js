import api from '../../utils/api';

export const ADMIN_SUBSCRIPTION = 'admin_4188348183671877818917';

/**
 * Indique si l'utilisateur est administrateur.
 */
export const isAdmin = (user) => {
  return user?.subscription_plan === ADMIN_SUBSCRIPTION;
};

/**
 * Récupère les événements admin (logs).
 */
export const fetchAdminEvents = async (params = {}) => {
  try {
    const { data } = await api.get('/api/admin/events', { params });
    return data.events || [];
  } catch (error) {
    console.error('Erreur fetchAdminEvents:', error);
    throw error;
  }
};

/**
 * Récupère les statistiques commerciales.
 */
export const fetchAdminStats = async () => {
  try {
    const { data } = await api.get('/api/admin/stats');
    return data;
  } catch (error) {
    console.error('Erreur fetchAdminStats:', error);
    throw error;
  }
};

/**
 * Teste l'envoi d'une notification Telegram (debug).
 */
export const fetchTelegramTest = async () => {
  try {
    const { data } = await api.get('/api/admin/telegram-test');
    return data;
  } catch (error) {
    console.error('Erreur fetchTelegramTest:', error);
    throw error;
  }
};

/**
 * État des notifications push pour le compte admin : configuration serveur,
 * appareils abonnés, fuseau détecté et programme du jour.
 */
export const fetchPushDiagnostics = async () => {
  try {
    const { data } = await api.get('/api/admin/push-diagnostics');
    return data;
  } catch (error) {
    console.error('Erreur fetchPushDiagnostics:', error);
    throw error;
  }
};

/**
 * Envoie une vraie notification du type demandé sur les appareils de l'admin.
 * @param {'routine_reminder'|'morning_greeting'|'todo_reminder'|'daily_report'|'night_greeting'} kind
 */
export const sendPushTest = async (kind) => {
  try {
    const { data } = await api.post('/api/admin/push-test', { kind });
    return data;
  } catch (error) {
    console.error('Erreur sendPushTest:', error);
    throw error;
  }
};

/**
 * Enregistre une visite de page.
 */
export const trackPageVisit = async (path, client = undefined) => {
  try {
    await api.post('/api/track/page', { path, client });
  } catch (error) {
    // Silencieux : ne pas bloquer la navigation
  }
};
