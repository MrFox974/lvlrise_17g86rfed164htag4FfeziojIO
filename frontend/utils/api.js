import axios from 'axios';

// Construction de l'URL avec valeurs par défaut si les variables d'env ne sont pas définies
const protocol = import.meta.env.VITE_PROTOCOLE || 'http';
// Nettoie le host : enlève les slashes finaux et les espaces
const host = (import.meta.env.VITE_SERVER_HOST || 'localhost').replace(/\/+$/, '').trim();
// En prod (Lambda Function URL), VITE_SERVER_PORT n'est pas défini → pas de port dans l'URL
// En local, VITE_SERVER_PORT=8080 → on ajoute le port
const port = import.meta.env.VITE_SERVER_PORT;

let baseURL;

if (!port || port === '' || port === '443' || port === '80') {
  // Pas de port si non défini ou port par défaut (80/443)
  baseURL = `${protocol}://${host}`;
} else {
  // Port défini et différent de 80/443 → on l'ajoute
  baseURL = `${protocol}://${host}:${port}`;
}

console.log('API Base URL:', baseURL);
console.log('Variables d\'environnement:', {
  VITE_PROTOCOLE: import.meta.env.VITE_PROTOCOLE,
  VITE_SERVER_HOST: import.meta.env.VITE_SERVER_HOST,
  VITE_SERVER_PORT: import.meta.env.VITE_SERVER_PORT
});

const api = axios.create({
  baseURL: baseURL,
  withCredentials: true
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// INTERCEPTOR REQUEST 
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━<━━━━━━

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// INTERCEPTOR RESPONSE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

api.interceptors.response.use(
  (response) => response, // ✅ OK → retourne directement
  async (error) => {      // ❌ Erreur → traite
        
    // Y a pas d'erreur? Rejette et bye
    if (!error.response) {
      return Promise.reject(error);
    }

    const { status } = error.response;
    const { config } = error;

    // C'est pas un 401? Rejette et bye
    if (status !== 401) {
      return Promise.reject(error);
    }

    // Ne pas tenter le refresh sur login/register/OAuth : 401 = mauvais identifiants ou token invalide
    const isAuthRoute = config.url?.includes('/api/auth/login') || config.url?.includes('/api/auth/register')
      || config.url?.includes('/api/auth/google') || config.url?.includes('/api/auth/apple');
    if (isAuthRoute) {
      return Promise.reject(error);
    }

    // On a déjà essayé de refresh? Rejette et bye (évite boucle infinie)
    if (config._retry) {
      return Promise.reject(error);
    }

    // OK, on va tenter un refresh
    config._retry = true;

    try {
      const refreshURL = `${baseURL}/api/auth/refresh`;
      const refreshToken = localStorage.getItem('refreshToken');
      const response = await axios.post(
        refreshURL,
        refreshToken ? { refreshToken } : {},
        { withCredentials: true }
      );

      const { accessToken, refreshToken: newRefreshToken } = response.data;
      localStorage.setItem('accessToken', accessToken);
      if (newRefreshToken) {
        localStorage.setItem('refreshToken', newRefreshToken);
      }

      // Le met dans le header de la requête échouée
      config.headers.Authorization = `Bearer ${accessToken}`;

      // La renvoie avec le nouveau token
      return api(config);
      
    } catch (refreshError) {
      // Le refresh a échoué = on est vraiment déconnecté
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      // Ne pas rediriger vers /login si on est en mode démo
      if (!window.location.pathname.startsWith('/demo')) {
        window.location.href = '/login';
      }
      return Promise.reject(refreshError);
    }
  }
);

export default api;
