/**
 * Boutons OAuth Google et Apple pour les pages Login / Inscription.
 * S'affichent uniquement si les credentials sont configurés.
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../hooks/useAuth';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const APPLE_CLIENT_ID = import.meta.env.VITE_APPLE_CLIENT_ID || '';

function AppleSignInButton({ onSuccess, onError, disabled }) {
  const [appleReady, setAppleReady] = useState(false);

  useEffect(() => {
    if (!APPLE_CLIENT_ID) return;

    if (window.AppleID) {
      window.AppleID.auth.init({
        clientId: APPLE_CLIENT_ID,
        scope: 'name email',
        redirectURI: typeof window !== 'undefined' ? window.location.origin : '',
        usePopup: true,
      });
      setAppleReady(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';
    script.async = true;
    script.onload = () => {
      window.AppleID.auth.init({
        clientId: APPLE_CLIENT_ID,
        scope: 'name email',
        redirectURI: typeof window !== 'undefined' ? window.location.origin : '',
        usePopup: true,
      });
      setAppleReady(true);
    };
    document.head.appendChild(script);
    return () => {
      if (script.parentNode) script.parentNode.removeChild(script);
    };
  }, []);

  const handleClick = useCallback(() => {
    if (!appleReady || !window.AppleID?.auth?.signIn) return;
    window.AppleID.auth.signIn()
      .then((res) => {
        const { authorization } = res;
        if (authorization?.identityToken) {
          const fullName = res.user?.name;
          const userName = fullName ? `${fullName.firstName || ''} ${fullName.lastName || ''}`.trim() : null;
          onSuccess(authorization.identityToken, userName);
        } else {
          onError(new Error('Réponse Apple invalide'));
        }
      })
      .catch((err) => {
        if (err?.error !== 'popup_closed_by_user') {
          onError(err);
        }
      });
  }, [appleReady, onSuccess, onError]);

  if (!APPLE_CLIENT_ID) return null;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || !appleReady}
      className="flex items-center justify-center gap-3 w-full py-3 px-4 rounded-full border border-[var(--om-line)] bg-[#000] text-[var(--om-on-accent)] hover:bg-[#1a1a1a] disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 font-medium text-sm"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="flex-shrink-0" aria-hidden="true">
        <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
      </svg>
      Continuer avec Apple
    </button>
  );
}

function OAuthButtons({ onError, disabled }) {
  const { loginWithGoogle, loginWithApple } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleGoogleSuccess = useCallback(async (credentialResponse) => {
    const token = credentialResponse?.credential;
    if (!token) {
      onError?.(new Error('Token Google invalide'));
      return;
    }
    setLoading(true);
    try {
      await loginWithGoogle(token);
      navigate('/onboarding', { replace: true });
    } catch (err) {
      onError?.(err);
    } finally {
      setLoading(false);
    }
  }, [loginWithGoogle, onError, navigate]);

  const handleAppleSuccess = useCallback(async (idToken, userName) => {
    setLoading(true);
    try {
      await loginWithApple(idToken, userName);
      navigate('/onboarding', { replace: true });
    } catch (err) {
      onError?.(err);
    } finally {
      setLoading(false);
    }
  }, [loginWithApple, onError, navigate]);

  const isDisabled = disabled || loading;

  if (!GOOGLE_CLIENT_ID && !APPLE_CLIENT_ID) return null;

  return (
    <div className="space-y-3">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[var(--om-line)]" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-[var(--om-surface)] text-[var(--om-muted)]">ou continuer avec</span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {GOOGLE_CLIENT_ID && (
          <div className="relative w-full" style={{ height: '44px', overflow: 'hidden', borderRadius: '9999px' }}>
            {/* Bouton personnalisé (visible) */}
            <button
              type="button"
              disabled={isDisabled}
              className="absolute inset-0 z-0 flex items-center justify-center gap-3 w-full h-full py-3 px-4 rounded-[9999px] border border-[var(--om-line)] bg-[var(--om-surface)] text-[var(--om-text)] hover:bg-[var(--om-surface-2)] hover:border-[var(--om-line)] disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 font-medium text-sm pointer-events-none"
              aria-label="Continuer avec Google"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" className="flex-shrink-0">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continuer avec Google
            </button>
            {/* Google button invisible par-dessus pour capturer les clics — conteneur strict pour éviter tout débordement */}
            <div 
              className="absolute top-0 left-0 z-10 opacity-0"
              style={{ 
                width: '100%', 
                height: '44px',
                margin: 0,
                padding: 0,
                overflow: 'hidden',
                lineHeight: 0,
                borderRadius: '9999px',
                pointerEvents: 'auto'
              }}
            >
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => onError?.(new Error('Connexion Google annulée ou échouée'))}
                useOneTap={false}
                theme="outline"
                size="large"
                text="continue_with"
                shape="rectangular"
                width="100%"
                disabled={isDisabled}
              />
            </div>
          </div>
        )}
        <AppleSignInButton
          onSuccess={handleAppleSuccess}
          onError={onError}
          disabled={isDisabled}
        />
      </div>
    </div>
  );
}

export default OAuthButtons;
