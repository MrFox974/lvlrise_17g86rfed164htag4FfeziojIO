import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

/**
 * Route pour utilisateurs non connectés : redirige vers /home si connecté
 */
function GuestRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--om-bg)]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border border-[var(--om-accent)] border-t-transparent mx-auto mb-4" />
          <p className="text-[var(--om-muted)]">Chargement...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/onboarding" replace />;
  }

  return children;
}

export default GuestRoute;
