import { useState, useCallback, useEffect, createContext, useContext } from 'react';
import { login as apiLogin, register as apiRegister, verifyEmail as apiVerifyEmail, resendVerificationEmail as apiResendVerification, loginWithGoogle as apiLoginWithGoogle, loginWithApple as apiLoginWithApple, getMe } from '../utils/authApi';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const saveSession = useCallback((accessToken, userData, refreshToken) => {
    localStorage.setItem('accessToken', accessToken);
    if (userData) {
      localStorage.setItem('user', JSON.stringify(userData));
    }
    if (refreshToken) {
      localStorage.setItem('refreshToken', refreshToken);
    }
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    setUser(null);
  }, []);

  const login = useCallback(async (email, password) => {
    const { accessToken, user: userData, refreshToken } = await apiLogin(email, password);
    saveSession(accessToken, userData, refreshToken);
    return userData;
  }, [saveSession]);

  const register = useCallback(async (username, email, password) => {
    const result = await apiRegister(username, email, password);
    return result;
  }, []);

  const verifyEmail = useCallback(async (token) => {
    const { accessToken, user: userData, refreshToken } = await apiVerifyEmail(token);
    saveSession(accessToken, userData, refreshToken);
    return userData;
  }, [saveSession]);

  const resendVerificationEmail = useCallback(async (email) => {
    await apiResendVerification(email);
  }, []);

  const loginWithGoogle = useCallback(async (idToken) => {
    const { accessToken, user: userData, refreshToken } = await apiLoginWithGoogle(idToken);
    saveSession(accessToken, userData, refreshToken);
    return userData;
  }, [saveSession]);

  const loginWithApple = useCallback(async (idToken, userName) => {
    const { accessToken, user: userData, refreshToken } = await apiLoginWithApple(idToken, userName);
    saveSession(accessToken, userData, refreshToken);
    return userData;
  }, [saveSession]);

  // Restauration de session : si on a un token (même expiré) ou un refreshToken, on tente getMe().
  // L'interceptor api.js gère le refresh automatique en cas d'access token expiré.
  useEffect(() => {
    let cancelled = false;
    const accessToken = localStorage.getItem('accessToken');
    const refreshToken = localStorage.getItem('refreshToken');
    if (accessToken || refreshToken) {
      (async () => {
        try {
          const userData = await getMe();
          if (!cancelled) setUser(userData);
        } catch (err) {
          if (err.response?.status === 401 && !cancelled) {
            logout();
          } else {
            const stored = localStorage.getItem('user');
            const userData = stored ? JSON.parse(stored) : null;
            if (!cancelled && userData && (userData.email || userData.username)) {
              setUser(userData);
            } else if (!cancelled && accessToken) {
              try {
                const payload = JSON.parse(atob(accessToken.split('.')[1]));
                if (payload.user_id) setUser({ id: payload.user_id });
              } catch (_) {}
            }
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => { cancelled = true; };
    }
    setLoading(false);
  }, [logout]);

  const value = { user, loading, login, register, verifyEmail, resendVerificationEmail, loginWithGoogle, loginWithApple, logout };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth doit être utilisé dans un AuthProvider');
  }
  return context;
}
