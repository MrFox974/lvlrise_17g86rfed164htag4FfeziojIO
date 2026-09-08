import { useState, useCallback, useMemo, useEffect } from 'react';
import { marked } from 'marked';
import RichTextEditor from './RichTextEditor';

/** Retourne true si la chaîne ressemble à du HTML. */
function looksLikeHtml(str) {
  if (!str || !str.trim()) return false;
  const t = str.trim();
  return t.startsWith('<') && (t.includes('</') || t.endsWith('>'));
}

/** Convertit le contenu (Markdown ou HTML) en HTML pour l’éditeur. */
function contentToHtml(content) {
  if (!content || !content.trim()) return '';
  if (looksLikeHtml(content)) return content.trim();
  try {
    const parsed = marked.parse(content, { async: false });
    return typeof parsed === 'string' ? parsed : String(parsed);
  } catch {
    return content;
  }
}

/**
 * Éditeur de document : titre + éditeur riche (WYSIWYG).
 * Citations, blocs de code, blocs note, listes, titres. Contenu sauvegardé en HTML.
 */
function MarkdownDocumentEditor({
  title: initialTitle,
  content: initialContent,
  documentKey,
  onSave,
  onDelete,
  onBack,
  saveLabel = 'Enregistrer',
  deleteLabel = 'Supprimer',
  titlePlaceholder = 'Titre',
  showDelete = false,
}) {
  const [title, setTitle] = useState(initialTitle || '');
  const [content, setContent] = useState(() => contentToHtml(initialContent || ''));
  const [loading, setLoading] = useState(false);

  const initialHtml = useMemo(() => contentToHtml(initialContent || ''), [initialContent]);

  useEffect(() => {
    setTitle(initialTitle || '');
    setContent(contentToHtml(initialContent || ''));
  }, [initialTitle, initialContent]);

  const handleSave = useCallback(async () => {
    if (!title.trim()) return;
    setLoading(true);
    try {
      await onSave({ title, content });
      onBack();
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [title, content, onSave, onBack]);

  const handleContentChange = useCallback((html) => {
    setContent(html);
  }, []);

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <button
          type="button"
          onClick={onBack}
          className="text-[var(--om-accent)] hover:underline font-medium"
        >
          Annuler
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-2 rounded-2xl bg-[var(--om-accent)] text-[var(--om-on-accent)] text-sm font-medium hover:bg-[var(--om-accent-hover)] disabled:opacity-60"
          >
            {loading ? 'Enregistrement…' : saveLabel}
          </button>
          {showDelete && onDelete && (
            <button
              type="button"
              onClick={onDelete}
              disabled={loading}
              className="px-4 py-2 rounded-2xl border border-[var(--om-danger)] text-[var(--om-danger)] text-sm font-medium hover:bg-[var(--om-danger-soft)] disabled:opacity-60"
            >
              {deleteLabel}
            </button>
          )}
        </div>
      </div>
      <input
        type="text"
        placeholder={titlePlaceholder}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full px-4 py-3 rounded-2xl border border-[var(--om-line)] text-[var(--om-text)] font-medium text-lg focus:border-[var(--om-accent)] focus:outline-none"
      />
      <div className="flex-1 min-h-0">
        <RichTextEditor
          key={documentKey ?? initialTitle}
          initialHtml={initialHtml}
          onChange={handleContentChange}
          placeholder="Rédigez ici…"
          className="h-full"
        />
      </div>
    </div>
  );
}

export default MarkdownDocumentEditor;
