import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import PasswordInput from '../../components/PasswordInput';
import AuthIllustration from '../../components/AuthIllustration';
import OAuthButtons from '../../components/OAuthButtons';
import { isPasswordValid } from '../../utils/passwordValidation';

function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const passwordMatch = password === confirmPassword && confirmPassword.length > 0;
  const canSubmit = username.trim().length >= 3 && email.trim().length > 0 && isPasswordValid(password) && passwordMatch;

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setError(null);
      if (!canSubmit) return;

      setLoading(true);

      try {
        const result = await register(username.trim(), email.trim(), password);
        navigate(`/verify-email?email=${encodeURIComponent(result?.email || email.trim())}`, { replace: true });
      } catch (err) {
        const msg = err.response?.data?.error || err.message || 'Erreur lors de l\'inscription';
        setError(msg);
      } finally {
        setLoading(false);
      }
    },
    [username, email, password, canSubmit, register, navigate]
  );

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[var(--om-bg)]">
      <AuthIllustration />
      {/* Mobile : formulaire en haut de la section blanche */}
      <div className="relative z-10 flex-1 flex items-start justify-center px-5 pt-4 pb-8 -mt-10 rounded-t-[1.5rem] bg-[var(--om-surface)] border-t border-x border-[var(--om-line)] shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.08)] md:z-auto md:border-0 md:shadow-none md:items-center md:mt-0 md:rounded-none md:bg-transparent md:pt-0 md:pb-0 md:px-8 md:py-10 overflow-auto">
        <div className="relative w-full max-w-md md:max-w-sm md:bg-[var(--om-surface)] md:rounded-2xl md:shadow-[var(--om-shadow)] md:border md:border-[var(--om-line)] md:p-6 md:py-8 md:max-w-[22rem]">
          <div className="text-center mb-5 md:mb-6 mt-5 md:mt-0">
            <h1 className="text-[1.15rem] md:text-lg font-medium text-[var(--om-text)] mb-1">
              Créer un compte
            </h1>
            <p className="text-sm text-[var(--om-muted)]">
              Rejoignez-nous pour gérer vos apprentissages
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-[10px] bg-[var(--om-danger-soft)] border border-[var(--om-danger)] text-[var(--om-danger)] text-sm">
                {error}
              </div>
            )}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-[var(--om-text)] mb-1.5">
                Nom d&apos;utilisateur
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Votre pseudo"
                required
                minLength={3}
                autoComplete="username"
                className="w-full px-3.5 py-2.5 md:py-2 rounded-[10px] border border-[var(--om-line)] focus:outline-none focus:ring-2 focus:ring-[var(--om-accent)]/40 focus:border-[var(--om-accent)] placeholder:text-[var(--om-muted)]/60 text-[var(--om-text)] text-sm"
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[var(--om-text)] mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@exemple.com"
                required
                autoComplete="email"
                className="w-full px-3.5 py-2.5 md:py-2 rounded-[10px] border border-[var(--om-line)] focus:outline-none focus:ring-2 focus:ring-[var(--om-accent)]/40 focus:border-[var(--om-accent)] placeholder:text-[var(--om-muted)]/60 text-[var(--om-text)] text-sm"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[var(--om-text)] mb-1.5">
                Mot de passe
              </label>
              <PasswordInput
                id="password"
                value={password}
                onChange={setPassword}
                placeholder="Créez un mot de passe"
                showValidation
                error={null}
                className="[&_input]:py-2.5 [&_input]:text-sm md:[&_input]:py-2"
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-[var(--om-text)] mb-1.5">
                Confirmer le mot de passe
              </label>
              <PasswordInput
                id="confirmPassword"
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="Confirmez le mot de passe"
                showValidation={false}
                error={
                  confirmPassword.length > 0 && !passwordMatch
                    ? 'Les mots de passe ne correspondent pas'
                    : null
                }
                className="[&_input]:py-2.5 [&_input]:text-sm md:[&_input]:py-2"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !canSubmit}
              className="om-btn om-btn-solid w-full"
            >
              {loading ? 'Inscription...' : 'S\'inscrire'}
            </button>

            <OAuthButtons onError={(err) => setError(err.response?.data?.error || err.message)} disabled={loading} />
          </form>

          <p className="mt-5 text-center text-sm text-[var(--om-muted)]">
            Déjà un compte ?{' '}
            <Link to="/login" className="text-[var(--om-accent)] font-medium hover:underline">
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Register;
