import { useEffect } from 'react';

const BRAIN_ICON = <i className="ph ph-brain text-[26px]" aria-hidden />;

const MODAL_ITEMS = [
  { id: 'flashcard', label: 'FlashCards', icon: 'ph-cards-three' },
  { id: 'routines', label: 'Routines', icon: 'ph-repeat' },
  { id: 'todo', label: 'To Do List', icon: 'ph-check-square-offset' },
];

/**
 * Feuille d'accès rapide, ouverte depuis le cerveau du dock.
 * Deux colonnes : la liste tient sans scroll même sur petit écran.
 */
function BrainModal({ isOpen, onClose, onSelect, showAdminButton }) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleSelect = (id) => {
    onSelect?.(id);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end md:items-center justify-center p-4 md:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Menu assistant"
    >
      <div className="om-scrim fixed inset-0 animate-brain-backdrop" onClick={handleBackdropClick} />

      <div
        className="om-card relative z-10 w-full max-w-md p-5 mb-24 md:mb-0 animate-om-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <span className="om-kicker">Accès rapide</span>
          <button type="button" onClick={onClose} className="om-icon-btn w-8 h-8" aria-label="Fermer">
            <i className="ph ph-x text-[15px]" aria-hidden />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {MODAL_ITEMS.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelect(item.id)}
              className="brain-modal-btn flex flex-col items-start gap-3 p-4 rounded-2xl bg-[var(--om-surface-2)] text-[var(--om-text)] text-sm font-medium hover:bg-[var(--om-accent-soft)] transition-colors text-left"
              style={{ animationDelay: `${60 + index * 45}ms` }}
            >
              <i className={`ph ${item.icon} text-[22px] text-[var(--om-accent)]`} aria-hidden />
              {item.label}
            </button>
          ))}
        </div>

        {showAdminButton && (
          <button
            type="button"
            onClick={() => handleSelect('admin')}
            className="om-btn om-btn-ghost brain-modal-btn w-full mt-3"
            style={{ animationDelay: `${60 + MODAL_ITEMS.length * 45}ms` }}
          >
            <i className="ph ph-shield-check text-[17px]" aria-hidden />
            Panel administrateur
          </button>
        )}
      </div>
    </div>
  );
}

export { BrainModal, BRAIN_ICON };
