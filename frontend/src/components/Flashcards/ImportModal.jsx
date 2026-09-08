import { useState, useCallback, useEffect } from 'react';
import { parseImportText } from '../../lib/parseImportText';

/**
 * Modal d'import : coller du texte -> suggestion Q/R
 * decks: optional, pour sélectionner le deck cible quand plusieurs
 */
function ImportModal({ isOpen, onClose, onImport, deckName, decks = [] }) {
  const [text, setText] = useState('');
  const [pairs, setPairs] = useState([]);
  const [error, setError] = useState('');
  const [targetDeckId, setTargetDeckId] = useState(decks[0]?.id ?? null);

  const parse = useCallback(() => {
    const parsed = parseImportText(text);
    setPairs(parsed);
    setError(parsed.length === 0 && text.trim() ? 'Aucune paire détectée. Formats : "Q: ... A: ..." ou "question - réponse"' : '');
  }, [text]);

  useEffect(() => {
    if (isOpen && text.trim()) {
      parse();
    } else if (isOpen && !text.trim()) {
      setPairs([]);
      setError('');
    }
  }, [isOpen, text, parse]);

  useEffect(() => {
    if (decks.length > 0 && !targetDeckId) setTargetDeckId(decks[0].id);
  }, [decks, targetDeckId]);

  const handleImport = useCallback(() => {
    if (pairs.length === 0) return;
    if (decks.length > 0 && !targetDeckId) return;
    onImport(pairs, targetDeckId);
    setText('');
    setPairs([]);
    onClose();
  }, [pairs, targetDeckId, decks.length, onImport, onClose]);

  const handleClose = useCallback(() => {
    setText('');
    setPairs([]);
    setError('');
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-modal-title"
    >
      <div
        className="om-scrim"
        onClick={handleClose}
      />
      <div
        className="relative z-10 om-card shadow-[var(--om-shadow-lg)] p-6 w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="import-modal-title" className="text-lg font-medium text-[var(--om-text)] mb-2">
          Importer des cartes
        </h3>
        <p className="text-sm text-[var(--om-muted)] mb-4">
          Colle ton texte. Formats : <code className="bg-[var(--om-surface-2)] px-1 rounded">Q: question A: réponse</code> ou <code className="bg-[var(--om-surface-2)] px-1 rounded">question - réponse</code>
        </p>
        {decks.length > 1 && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-[var(--om-text)] mb-2">
              Collection cible
            </label>
            <select
              value={targetDeckId ?? ''}
              onChange={(e) => setTargetDeckId(e.target.value ? Number(e.target.value) : null)}
              className="w-full px-3 py-2 rounded-2xl border border-[var(--om-line)] text-[var(--om-text)] bg-[var(--om-surface)]"
            >
              {decks.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Q: Capital de la France ? A: Paris&#10;React - bibliothèque JS..."
          rows={6}
          className="w-full px-3 py-2 rounded-2xl border border-[var(--om-line)] text-[var(--om-text)] resize-none focus:ring-2 focus:ring-[var(--om-accent)]/50 focus:border-[var(--om-accent)]"
        />
        {error && <p className="text-sm text-[var(--om-warning)] mt-2">{error}</p>}
        {pairs.length > 0 && (
          <div className="mt-4 flex-1 min-h-0 overflow-auto">
            <p className="text-sm font-medium text-[var(--om-text)] mb-2">
              {pairs.length} paire(s) détectée(s)
            </p>
            <ul className="space-y-2 max-h-40 overflow-y-auto">
              {pairs.slice(0, 10).map((p, i) => (
                <li key={i} className="text-xs text-[var(--om-muted)] truncate">
                  {p.front} → {p.back}
                </li>
              ))}
              {pairs.length > 10 && (
                <li className="text-xs text-[var(--om-muted)]">+ {pairs.length - 10} autres</li>
              )}
            </ul>
          </div>
        )}
        <div className="flex gap-2 justify-end mt-4 pt-4 border-t border-[var(--om-line)]">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 rounded-2xl text-sm text-[var(--om-muted)] hover:bg-[var(--om-surface-2)] transition-colors"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={pairs.length === 0 || (decks.length > 1 && !targetDeckId)}
            className="px-4 py-2 rounded-2xl bg-[var(--om-accent)] text-[var(--om-on-accent)] text-sm font-medium hover:bg-[var(--om-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Importer {pairs.length > 0 ? `(${pairs.length})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ImportModal;
