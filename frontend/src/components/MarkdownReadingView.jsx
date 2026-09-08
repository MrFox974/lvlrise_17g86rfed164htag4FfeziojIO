import { useMemo } from 'react';
import { marked } from 'marked';

/** Retourne true si la chaîne ressemble à du HTML (contenu issu de l’éditeur riche). */
function looksLikeHtml(str) {
  if (!str || !str.trim()) return false;
  const t = str.trim();
  return t.startsWith('<') && (t.includes('</') || t.endsWith('>'));
}

/**
 * Vue lecture : affiche le contenu (HTML ou Markdown) en brut sur la page, sans carte.
 * Typographie lisible, largeur limitée pour le confort de lecture.
 */
function MarkdownReadingView({ title, content, onEdit, editLabel = 'Modifier' }) {
  const htmlContent = useMemo(() => {
    if (!content || !content.trim()) return '';
    try {
      if (looksLikeHtml(content)) return content.trim();
      const parsed = marked.parse(content, { async: false });
      return typeof parsed === 'string' ? parsed : String(parsed);
    } catch {
      return content;
    }
  }, [content]);

  return (
    <article className="w-full">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <h1 className="text-2xl md:text-3xl font-medium text-[var(--om-text)] leading-tight max-w-3xl">
          {title || 'Sans titre'}
        </h1>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="px-4 py-2.5 rounded-2xl bg-[var(--om-accent)] text-[var(--om-on-accent)] font-medium text-sm hover:bg-[var(--om-accent-hover)] transition-colors shrink-0"
          >
            {editLabel}
          </button>
        )}
      </div>
      <div
        className="max-w-3xl text-[var(--om-text)] text-base leading-[1.75] prose-custom [&_h1]:text-2xl [&_h1]:font-medium [&_h1]:mt-8 [&_h1]:mb-4 [&_h2]:text-xl [&_h2]:font-medium [&_h2]:mt-8 [&_h2]:mb-3 [&_h3]:text-lg [&_h3]:font-medium [&_h3]:mt-6 [&_h3]:mb-2 [&_p]:text-[var(--om-muted)] [&_p]:my-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-4 [&_li]:my-1 [&_a]:text-[var(--om-accent)] [&_a]:underline [&_a]:hover:no-underline [&_code]:bg-[var(--om-surface-2)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_pre]:bg-[var(--om-surface-2)] [&_pre]:p-4 [&_pre]:rounded-2xl [&_pre]:overflow-x-auto [&_pre]:my-4 [&_pre[data-type=code-box]]:border [&_pre[data-type=code-box]]:border-[var(--om-accent)] [&_blockquote]:border-l [&_blockquote]:border-[var(--om-accent)] [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-[var(--om-muted)] [&_blockquote]:my-4 [&_blockquote[data-type=note]]:bg-[var(--om-accent-soft)] [&_blockquote[data-type=note]]:border-[var(--om-accent)] [&_blockquote[data-type=note]]:rounded-r-2xl [&_blockquote[data-type=note]]:py-2 [&_blockquote[data-type=note]]:font-normal [&_blockquote[data-type=quote]]:bg-[var(--om-surface-2)] [&_blockquote[data-type=quote]]:border [&_blockquote[data-type=quote]]:border-[var(--om-accent)] [&_blockquote[data-type=quote]]:rounded-2xl [&_blockquote[data-type=quote]]:p-4 [&_mark]:bg-[var(--om-warning-soft)] [&_mark]:px-0.5 [&_mark]:rounded [&_mark]:font-medium"
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
      {(!content || !content.trim()) && onEdit && (
        <p className="max-w-3xl mt-6 text-[var(--om-muted)] italic">
          Aucun contenu pour le moment. Cliquez sur « {editLabel} » pour rédiger.
        </p>
      )}
    </article>
  );
}

export default MarkdownReadingView;
