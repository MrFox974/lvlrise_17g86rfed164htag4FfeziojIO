import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

/**
 * Protège une route : redirige vers /login si non connecté
 */
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

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

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

export default ProtectedRoute;
