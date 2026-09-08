import { useNavigate } from 'react-router-dom';

/**
 * Modal affichée en mode démo lorsqu'une action nécessite un compte (créer une routine, une tâche, une carte, etc.).
 * Message : "Vous devez vous connecter pour accéder à toutes les fonctionnalités."
 */
function DemoBlockModal({ isOpen, onClose }) {
  const navigate = useNavigate();

  const handleGoToLogin = () => {
    onClose();
    navigate('/login');
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-[var(--om-scrim-solid)]/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="demo-block-modal-title"
    >
      <div
        className="bg-[var(--om-surface)] rounded-2xl p-6 max-w-md w-full shadow-[var(--om-shadow-lg)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="demo-block-modal-title" className="text-lg font-medium text-[var(--om-text)] mb-2">
          Fonctionnalité réservée aux comptes
        </h2>
        <p className="text-sm text-[var(--om-muted)] mb-6">
          Vous devez vous connecter pour accéder à toutes les fonctionnalités.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-2xl border border-[var(--om-line)] text-[var(--om-text)] text-sm font-medium hover:bg-[var(--om-surface-2)]"
          >
            Rester en démo
          </button>
          <button
            type="button"
            onClick={handleGoToLogin}
            className="px-4 py-2 rounded-2xl bg-[var(--om-accent)] text-[var(--om-on-accent)] text-sm font-medium hover:bg-[var(--om-accent-hover)]"
          >
            Se connecter
          </button>
        </div>
      </div>
    </div>
  );
}

export default DemoBlockModal;
