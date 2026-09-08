import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import PasswordInput from '../../components/PasswordInput';
import { changePassword, deleteAccount, unsubscribe } from '../../utils/authApi';
import { isPasswordValid } from '../../utils/passwordValidation';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';

const CONFIRMATION_PHRASE = 'Je confirme';
const PLAN_LABELS = { free: 'Découverte', pro: 'Croissance', premium: 'Maîtrise' };

function DeleteAccountModal({ isOpen, onClose, onSuccess }) {
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (confirmation !== CONFIRMATION_PHRASE || loading) return;
      setLoading(true);
      setError('');
      try {
        await deleteAccount(confirmation);
        onSuccess?.();
      } catch (err) {
        setError(err.response?.data?.error || 'Erreur lors de la suppression du compte.');
      } finally {
        setLoading(false);
      }
    },
    [confirmation, loading, onSuccess]
  );

  const handleClose = useCallback(() => {
    setConfirmation('');
    setError('');
    onClose?.();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-modal-title"
    >
      <div
        className="om-scrim"
        onClick={handleClose}
      />
      <div
        className="om-card relative z-10 w-full max-w-md p-6 shadow-[var(--om-shadow-lg)] animate-om-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="delete-modal-title" className="text-lg font-medium text-[var(--om-danger)] mb-4">
          Supprimer définitivement mon compte
        </h2>
        <p className="text-sm text-[var(--om-muted)] mb-4">
          Cette action est irréversible. Toutes vos données seront définitivement supprimées :
          collections de cartes, routines, tâches et notes.
        </p>
        <p className="text-sm text-[var(--om-muted)] mb-4">
          Si vous avez un abonnement payant, il sera automatiquement résilié.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="delete-confirmation" className="block text-sm font-medium text-[var(--om-text)] mb-2">
              Pour confirmer, tapez exactement : <strong>&quot;{CONFIRMATION_PHRASE}&quot;</strong>
            </label>
            <input
              id="delete-confirmation"
              type="text"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder={CONFIRMATION_PHRASE}
              className="w-full px-4 py-3 rounded-2xl border border-[var(--om-line)] text-[var(--om-text)] focus:border-[var(--om-danger)] focus:outline-none"
              autoComplete="off"
            />
          </div>
          {error && <p className="text-sm text-[var(--om-danger)]">{error}</p>}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="om-btn om-btn-ghost flex-1"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={confirmation !== CONFIRMATION_PHRASE || loading}
              className="flex-1 py-2.5 rounded-2xl bg-[var(--om-danger-strong)] text-[var(--om-on-accent)] font-medium hover:bg-[var(--om-danger-strong)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Suppression...' : 'Supprimer mon compte'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function UnsubscribeModal({ isOpen, onClose, onSuccess, currentPlan }) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (loading) return;
      setLoading(true);
      setError('');
      try {
        await unsubscribe(reason.trim() || undefined);
        onSuccess?.();
        onClose?.();
      } catch (err) {
        setError(err.response?.data?.error || 'Erreur lors du désabonnement.');
      } finally {
        setLoading(false);
      }
    },
    [reason, loading, onSuccess, onClose]
  );

  const handleClose = useCallback(() => {
    setReason('');
    setError('');
    onClose?.();
  }, [onClose]);

  if (!isOpen) return null;

  const planLabel = PLAN_LABELS[currentPlan] || currentPlan;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="unsubscribe-modal-title"
    >
      <div className="om-scrim" onClick={handleClose} />
      <div
        className="om-card relative z-10 w-full max-w-md p-6 shadow-[var(--om-shadow-lg)] animate-om-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="unsubscribe-modal-title" className="text-lg font-medium text-[var(--om-text)] mb-4">
          Annuler mon abonnement
        </h2>
        <p className="text-sm text-[var(--om-muted)] mb-4">
          Vous repasserez sur le plan <strong>Découverte</strong> (gratuit). Vous perdrez les avantages du plan{' '}
          {planLabel}.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="unsubscribe-reason" className="block text-sm font-medium text-[var(--om-text)] mb-2">
              Raison du désabonnement (optionnel)
            </label>
            <textarea
              id="unsubscribe-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: trop cher, pas assez utilisé..."
              rows={3}
              className="w-full px-4 py-3 rounded-2xl border border-[var(--om-line)] text-[var(--om-text)] focus:border-[var(--om-accent)] focus:outline-none resize-none"
            />
          </div>
          {error && <p className="text-sm text-[var(--om-danger)]">{error}</p>}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="om-btn om-btn-ghost flex-1"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="om-btn om-btn-solid flex-1" style={{ background: 'var(--om-warning)' }}
            >
              {loading ? 'Résiliation...' : 'Me désabonner'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Apparence : le même choix que dans le menu mobile, accessible sur desktop. */
function AppearanceCard() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="om-card p-6">
      <h2 className="text-lg font-medium text-[var(--om-text)] mb-1">Apparence</h2>
      <p className="text-sm text-[var(--om-muted)] mb-4">
        Le thème est mémorisé sur cet appareil.
      </p>
      <div className="om-segment-quiet max-w-xs">
        <button
          type="button"
          onClick={() => setTheme('light')}
          className="om-segment-item flex-1 flex items-center justify-center gap-2"
          data-active={theme === 'light'}
        >
          <i className="ph ph-sun text-[16px]" aria-hidden /> Clair
        </button>
        <button
          type="button"
          onClick={() => setTheme('dark')}
          className="om-segment-item flex-1 flex items-center justify-center gap-2"
          data-active={theme === 'dark'}
        >
          <i className="ph ph-moon text-[16px]" aria-hidden /> Sombre
        </button>
      </div>
    </div>
  );
}

function Settings() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [unsubscribeModalOpen, setUnsubscribeModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleUnsubscribeSuccess = useCallback(() => {
    setUnsubscribeModalOpen(false);
    window.location.reload();
  }, []);

  const handleDeleteSuccess = useCallback(() => {
    setDeleteModalOpen(false);
    logout?.();
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    navigate('/login', { replace: true });
  }, [logout, navigate]);

  const passwordMatch = newPassword === confirmPassword && confirmPassword.length > 0;
  const canSubmit =
    currentPassword.length > 0 &&
    isPasswordValid(newPassword) &&
    passwordMatch &&
    !loading;

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (!canSubmit) return;
      setLoading(true);
      setError('');
      setSuccess(false);
      try {
        await changePassword(currentPassword, newPassword);
        setSuccess(true);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } catch (err) {
        setError(err.response?.data?.error || 'Erreur lors du changement de mot de passe.');
      } finally {
        setLoading(false);
      }
    },
    [currentPassword, newPassword, canSubmit]
  );

  return (
    <div className="px-4 md:px-6 pt-1 pb-6 max-w-lg md:max-w-xl mx-auto flex flex-col gap-3.5">
      <div className="flex flex-col">
        <h1 className="text-[17px] md:text-[19px] font-medium tracking-[-0.01em] text-[var(--om-text)]">
          Paramètres
        </h1>
        <span className="om-kicker">Compte et préférences</span>
      </div>

      <AppearanceCard />

      {(!user?.auth_provider || user.auth_provider === 'local') && (
      <div className="om-card p-6">
        <h2 className="text-lg font-medium text-[var(--om-text)] mb-4">
          Changer le mot de passe
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="current-password" className="block text-sm font-medium text-[var(--om-text)] mb-2">
              Mot de passe actuel
            </label>
            <PasswordInput
              id="current-password"
              value={currentPassword}
              onChange={setCurrentPassword}
              placeholder="Votre mot de passe actuel"
              showValidation={false}
            />
          </div>
          <div>
            <label htmlFor="new-password" className="block text-sm font-medium text-[var(--om-text)] mb-2">
              Nouveau mot de passe
            </label>
            <PasswordInput
              id="new-password"
              value={newPassword}
              onChange={setNewPassword}
              placeholder="Nouveau mot de passe"
              showValidation
            />
          </div>
          <div>
            <label htmlFor="confirm-password" className="block text-sm font-medium text-[var(--om-text)] mb-2">
              Confirmer le mot de passe
            </label>
            <PasswordInput
              id="confirm-password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              placeholder="Confirmez le nouveau mot de passe"
              showValidation={false}
            />
            {confirmPassword.length > 0 && !passwordMatch && (
              <p className="text-sm text-[var(--om-danger)] mt-1">Les mots de passe ne correspondent pas</p>
            )}
          </div>
          {error && (
            <p className="text-sm text-[var(--om-danger)]">{error}</p>
          )}
          {success && (
            <p className="text-sm text-[var(--om-accent)] font-medium">Mot de passe modifié avec succès.</p>
          )}
          <button
            type="submit"
            disabled={!canSubmit}
            className="om-btn om-btn-solid w-full"
          >
            {loading ? 'Modification...' : 'Modifier le mot de passe'}
          </button>
        </form>
      </div>
      )}

      {(user?.subscription_plan === 'pro' || user?.subscription_plan === 'premium') && (
        <div className="rounded-[20px] border border-[var(--om-warning)] bg-[var(--om-warning-soft)] p-6">
          <h2 className="text-lg font-medium text-[var(--om-warning)] mb-2">Mon abonnement</h2>
          <p className="text-sm text-[var(--om-muted)] mb-4">
            Vous êtes actuellement sur le plan <strong>{PLAN_LABELS[user.subscription_plan] || user.subscription_plan}</strong>.
          </p>
          {(user?.subscription_current_period_end || user?.subscription_current_period_start) && (
            <div className="rounded-2xl bg-[var(--om-surface)]/60 border border-[var(--om-warning)] p-4 mb-4 text-left space-y-2 text-sm">
              {user.subscription_current_period_end && (
                <p className="text-[var(--om-text)]">
                  <span className="font-medium text-[var(--om-warning)]">Prochain prélèvement :</span>{' '}
                  {new Date(user.subscription_current_period_end).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              )}
              {(user.subscription_current_period_start || user.subscription_current_period_end) && (
                <p className="text-[var(--om-text)]">
                  <span className="font-medium text-[var(--om-warning)]">Période couverte :</span>{' '}
                  du{' '}
                  {user.subscription_current_period_start
                    ? new Date(user.subscription_current_period_start).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })
                    : '—'}{' '}
                  au{' '}
                  {user.subscription_current_period_end
                    ? new Date(user.subscription_current_period_end).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })
                    : '—'}
                </p>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={() => setUnsubscribeModalOpen(true)}
            className="om-btn" style={{ borderColor: 'var(--om-warning)', color: 'var(--om-warning)' }}
          >
            Annuler mon abonnement
          </button>
        </div>
      )}

      <div className="rounded-[20px] border border-[var(--om-danger)] bg-[var(--om-danger-soft)] p-6">
        <h2 className="text-lg font-medium text-[var(--om-danger-strong)] mb-2">
          Zone de danger
        </h2>
        <p className="text-sm text-[var(--om-muted)] mb-4">
          La suppression de votre compte entraînera la suppression définitive de toutes vos données.
        </p>
        <button
          type="button"
          onClick={() => setDeleteModalOpen(true)}
          className="om-btn om-btn-danger"
        >
          Supprimer mon compte
        </button>
      </div>

      <DeleteAccountModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onSuccess={handleDeleteSuccess}
      />
      <UnsubscribeModal
        isOpen={unsubscribeModalOpen}
        onClose={() => setUnsubscribeModalOpen(false)}
        onSuccess={handleUnsubscribeSuccess}
        currentPlan={user?.subscription_plan}
      />
    </div>
  );
}

export default Settings;
