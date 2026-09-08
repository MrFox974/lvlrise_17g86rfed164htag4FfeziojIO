import { useEffect } from 'react';

/**
 * Confirmation douce de suppression (style design existant)
 */
function ConfirmDelete({ isOpen, onClose, onConfirm, title, message }) {
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-delete-title"
    >
      <div
        className="om-scrim"
        onClick={handleBackdrop}
      />
      <div
        className="relative z-10 om-card shadow-[var(--om-shadow-lg)] p-6 w-full max-w-sm animate-brain-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="confirm-delete-title" className="text-lg font-medium text-[var(--om-text)] mb-2">
          {title || 'Confirmer la suppression'}
        </h3>
        <p className="text-sm text-[var(--om-muted)] mb-4">
          {message || 'Cette action est irréversible.'}
        </p>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-2xl text-sm text-[var(--om-muted)] hover:bg-[var(--om-surface-2)] transition-colors"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => { onConfirm(); onClose(); }}
            className="px-4 py-2 rounded-2xl bg-[var(--om-danger-strong)] text-[var(--om-on-accent)] text-sm font-medium hover:bg-[var(--om-danger-strong)] transition-colors"
          >
            Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDelete;
