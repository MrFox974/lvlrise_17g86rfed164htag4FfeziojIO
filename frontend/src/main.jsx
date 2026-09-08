import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import '@phosphor-icons/web/regular';
import '@phosphor-icons/web/bold';
import '@phosphor-icons/web/fill';
import App from './App.jsx';
import { AuthProvider } from './hooks/useAuth';
import { ThemeProvider, initThemeBeforeRender } from './hooks/useTheme';
import { registerServiceWorker } from './lib/registerServiceWorker';

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

initThemeBeforeRender();
registerServiceWorker();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={googleClientId || 'placeholder-no-google-client'}>
      <ThemeProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </GoogleOAuthProvider>
  </StrictMode>
);
