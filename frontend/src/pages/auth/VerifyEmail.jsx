import { useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import AuthIllustration from '../../components/AuthIllustration';

function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get('token');
  const emailFromUrl = searchParams.get('email');

  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const { verifyEmail, resendVerificationEmail } = useAuth();
  const navigate = useNavigate();

  const handleVerify = useCallback(async () => {
    if (!tokenFromUrl) return;
    setError(null);
    setVerifying(true);
    try {
      await verifyEmail(tokenFromUrl);
      setSuccess(true);
      setTimeout(() => {
        navigate('/onboarding', { replace: true });
      }, 800);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Erreur lors de la vérification.');
    } finally {
      setVerifying(false);
    }
  }, [tokenFromUrl, verifyEmail, navigate]);

  const handleResend = useCallback(async () => {
    if (!emailFromUrl) {
      setError('Adresse email manquante.');
      return;
    }
    setError(null);
    setResending(true);
    try {
      await resendVerificationEmail(emailFromUrl);
      setSuccess(true);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Erreur lors de l\'envoi.');
    } finally {
      setResending(false);
    }
  }, [emailFromUrl, resendVerificationEmail]);


  const hasToken = !!tokenFromUrl;
  const displayEmail = emailFromUrl || 'votre adresse';

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[var(--om-bg)]">
      <AuthIllustration />
      <div className="relative z-10 flex-1 flex items-start justify-center px-5 pt-4 pb-8 -mt-10 rounded-t-[1.5rem] bg-[var(--om-surface)] border-t border-x border-[var(--om-line)] shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.08)] md:z-auto md:border-0 md:shadow-none md:items-center md:mt-0 md:rounded-none md:bg-transparent md:pt-0 md:pb-0 md:px-8 md:py-10 overflow-auto">
        <div className="relative w-full max-w-md md:max-w-sm md:bg-[var(--om-surface)] md:rounded-2xl md:shadow-[var(--om-shadow)] md:border md:border-[var(--om-line)] md:p-6 md:py-8 md:max-w-[22rem]">
          <div className="text-center mb-5 md:mb-6 mt-5 md:mt-0">
            <h1 className="text-[1.15rem] md:text-lg font-medium text-[var(--om-text)] mb-1">
              {hasToken ? 'Vérifier votre adresse email' : 'Email envoyé'}
            </h1>
            <p className="text-sm text-[var(--om-muted)]">
              {hasToken
                ? 'Cliquez sur le bouton ci-dessous pour activer votre compte et accéder à l\'onboarding.'
                : `Nous avons envoyé un email à ${displayEmail}. Cliquez sur le lien dans l'email pour activer votre compte.`}
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-[10px] bg-[var(--om-danger-soft)] border border-[var(--om-danger)] text-[var(--om-danger)] text-sm mb-4">
              {error}
            </div>
          )}

          {success && !hasToken && (
            <div className="p-3 rounded-[10px] bg-[var(--om-success-soft)]/80 border border-[var(--om-success)] text-[var(--om-success)] text-sm mb-4">
              Un nouvel email a été envoyé.
            </div>
          )}

          {hasToken ? (
            <div className="space-y-4">
              {success ? (
                <p className="text-center text-[var(--om-accent)] font-medium">
                  ✓ Adresse vérifiée ! Redirection vers l&apos;onboarding...
                </p>
              ) : (
                <button
                  type="button"
                  onClick={handleVerify}
                  disabled={verifying}
                  className="om-btn om-btn-solid w-full"
                >
                  {verifying ? 'Vérification...' : 'Vérifier l\'adresse mail'}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-[var(--om-muted)]">
                Vous n&apos;avez pas reçu l&apos;email ? Vérifiez vos spams ou renvoyez-le.
              </p>
              <button
                type="button"
                onClick={handleResend}
                disabled={resending || !emailFromUrl}
                className="w-full py-3 px-3 rounded-[10px] border border-[var(--om-accent)] text-[var(--om-accent)] text-sm font-medium hover:bg-[var(--om-accent)]/5 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {resending ? 'Envoi...' : 'Renvoyer l\'email'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default VerifyEmail;
