import api from '../../utils/api';

/**
 * Crée la pré-configuration "commencer rapidement" (collection de flashcards, routines, tâches).
 * @returns {Promise<{ success: boolean }>}
 */
export const quickStart = async () => {
  try {
    const { data } = await api.post('/api/onboarding/quick-start');
    return data;
  } catch (error) {
    console.error('Erreur lors du quick start:', error);
    throw error;
  }
};

/**
 * Vérifie si l'utilisateur doit voir l'onboarding.
 * @returns {Promise<{ needsOnboarding: boolean }>}
 */
export const getOnboardingStatus = async () => {
  const { data } = await api.get('/api/onboarding/status');
  return data;
};

/**
 * Récupère ou crée la session IA onboarding.
 * @returns {Promise<{ stepIndex, stepKey, message, responses }>}
 */
export const getAiSession = async () => {
  const { data } = await api.get('/api/onboarding/ai-session');
  return data;
};

/**
 * Soumet une réponse et avance à l'étape suivante.
 * @param {string} answer
 */
export const postAiStep = async (answer) => {
  const { data } = await api.post('/api/onboarding/ai-step', { answer });
  return data;
};

/**
 * Termine la conversation et lance la génération.
 * @param {string} [answer] - Réponse à "autre chose à nous dire"
 */
export const postAiComplete = async (answer = '') => {
  const { data } = await api.post('/api/onboarding/ai-complete', { answer });
  return data;
};

/**
 * Récupère la progression de la génération.
 * @returns {Promise<{ progress: number, step: string, completed: boolean, log: Array<{message, status, at}> }>}
 */
export const getGenerationStatus = async () => {
  const { data } = await api.get('/api/onboarding/generation-status');
  return data;
};

/**
 * Annule la génération en cours. Si < 1 minute, ne compte pas dans le quota.
 * @returns {Promise<{ success: boolean, message: string, countsAsGeneration: boolean, durationMinutes: number }>}
 */
export const cancelGeneration = async () => {
  try {
    const { data } = await api.post('/api/onboarding/cancel-generation');
    return data;
  } catch (error) {
    console.error('Erreur lors de l\'annulation de la génération:', error);
    throw error;
  }
};

/**
 * Reprend la génération de l'onboarding depuis le point d'arrêt.
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export const resumeGeneration = async () => {
  try {
    const { data } = await api.post('/api/onboarding/resume-generation');
    return data;
  } catch (error) {
    console.error('Erreur lors de la reprise de la génération:', error);
    throw error;
  }
};
