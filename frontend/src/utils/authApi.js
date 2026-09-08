import api from '../../utils/api';

/**
 * Inscription (envoie un email de vérification, ne retourne pas de session)
 * @param {string} username
 * @param {string} email
 * @param {string} password
 * @returns {{ success: boolean, email: string }}
 */
export const register = async (username, email, password) => {
  try {
    const { data } = await api.post('/api/auth/register', { username, email, password });
    return data;
  } catch (error) {
    console.error('Erreur lors de l\'inscription:', error);
    throw error;
  }
};

/**
 * Vérifie l'adresse email via le token reçu par email
 * @param {string} token
 * @returns {{ user, accessToken, refreshToken }}
 */
export const verifyEmail = async (token) => {
  try {
    const { data } = await api.post('/api/auth/verify-email', { token });
    return data;
  } catch (error) {
    console.error('Erreur lors de la vérification:', error);
    throw error;
  }
};

/**
 * Renvoie un email de vérification
 * @param {string} email
 */
export const resendVerificationEmail = async (email) => {
  try {
    const { data } = await api.post('/api/auth/resend-verification', { email });
    return data;
  } catch (error) {
    console.error('Erreur lors du renvoi:', error);
    throw error;
  }
};

/**
 * Connexion via Google (idToken du SDK Google Identity)
 * @param {string} idToken
 */
export const loginWithGoogle = async (idToken) => {
  try {
    const { data } = await api.post('/api/auth/google', { idToken });
    return data;
  } catch (error) {
    console.error('Erreur lors de la connexion Google:', error);
    throw error;
  }
};

/**
 * Connexion via Apple (identityToken + userName optionnel)
 * @param {string} idToken
 * @param {string} [userName]
 */
export const loginWithApple = async (idToken, userName) => {
  try {
    const { data } = await api.post('/api/auth/apple', { idToken, userName: userName || undefined });
    return data;
  } catch (error) {
    console.error('Erreur lors de la connexion Apple:', error);
    throw error;
  }
};

/**
 * Connexion
 * @param {string} email
 * @param {string} password
 */
export const login = async (email, password) => {
  try {
    const { data } = await api.post('/api/auth/login', { email, password });
    return data;
  } catch (error) {
    console.error('Erreur lors de la connexion:', error);
    throw error;
  }
};

/**
 * Profil de l'utilisateur connecté (pour restauration après actualisation)
 */
export const getMe = async () => {
  try {
    const { data } = await api.get('/api/auth/me');
    return data.user;
  } catch (error) {
    console.error('Erreur lors de getMe:', error);
    throw error;
  }
};

/**
 * @param {string} currentPassword
 * @param {string} newPassword
 */
export const changePassword = async (currentPassword, newPassword) => {
  try {
    const { data } = await api.post('/api/auth/change-password', {
      currentPassword,
      newPassword,
    });
    return data;
  } catch (error) {
    console.error('Erreur lors du changement de mot de passe:', error);
    throw error;
  }
};

/**
 * Résilie l'abonnement et repasse au plan gratuit.
 * @param {string} [reason] - Raison du désabonnement (optionnel)
 */
export const unsubscribe = async (reason) => {
  try {
    const { data } = await api.post('/api/auth/unsubscribe', { reason: reason || undefined });
    return data;
  } catch (error) {
    console.error('Erreur lors du désabonnement:', error);
    throw error;
  }
};

/**
 * Supprime définitivement le compte et toutes les données.
 * @param {string} confirmation - Doit être exactement "Je confirme"
 */
export const deleteAccount = async (confirmation) => {
  try {
    const { data } = await api.post('/api/auth/delete-account', { confirmation });
    return data;
  } catch (error) {
    console.error('Erreur lors de la suppression du compte:', error);
    throw error;
  }
};
