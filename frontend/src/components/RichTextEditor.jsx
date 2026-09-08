import { useCallback, useMemo, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Blockquote from '@tiptap/extension-blockquote';

/**
 * Blockquote étendu : supporte data-type="note" pour les blocs note (callout).
 */
const BlockquoteNote = Blockquote.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      'data-type': {
        default: null,
        parseHTML: (el) => el.getAttribute('data-type'),
        renderHTML: (attrs) => (attrs['data-type'] ? { 'data-type': attrs['data-type'] } : {}),
      },
    };
  },
});

function getEditorExtensions(placeholderText) {
  return [
    StarterKit.configure({
      blockquote: false,
    }),
    BlockquoteNote,
    Placeholder.configure({
      placeholder: placeholderText || 'Rédigez ici… Citations, code, listes, blocs note.',
    }),
  ];
}

function Toolbar({ editor, seamless }) {
  if (!editor) return null;

  const setNoteBlock = useCallback(() => {
    editor.chain().focus().toggleBlockquote().updateAttributes('blockquote', { 'data-type': 'note' }).run();
  }, [editor]);

  const setQuoteBlock = useCallback(() => {
    editor.chain().focus().toggleBlockquote().updateAttributes('blockquote', { 'data-type': 'quote' }).run();
  }, [editor]);

  const setCodeBlock = useCallback(() => {
    editor.chain().focus().toggleCodeBlock().run();
  }, [editor]);


  return (
    <div
      className={
        seamless
          ? 'sticky top-0 z-10 flex flex-wrap items-center gap-1 py-2 mb-2 border-b border-[var(--om-line)] bg-[var(--om-bg)]'
          : 'flex flex-wrap items-center gap-1 p-2 border-b border-[var(--om-line)] bg-[var(--om-surface-2)]'
      }
    >
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={`p-2 rounded-[10px] text-sm font-medium transition-colors ${editor.isActive('bold') ? 'bg-[var(--om-accent)] text-[var(--om-on-accent)]' : 'text-[var(--om-muted)] hover:bg-[var(--om-line)]'}`}
        title="Gras"
      >
        B
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={`p-2 rounded-[10px] text-sm italic transition-colors ${editor.isActive('italic') ? 'bg-[var(--om-accent)] text-[var(--om-on-accent)]' : 'text-[var(--om-muted)] hover:bg-[var(--om-line)]'}`}
        title="Italique"
      >
        I
      </button>
      <span className="w-px h-5 bg-[var(--om-line)] mx-0.5" />
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBlockquote().updateAttributes('blockquote', { 'data-type': null }).run()}
        className={`p-2 rounded-[10px] text-sm transition-colors ${editor.isActive('blockquote') && !editor.getAttributes('blockquote')['data-type'] ? 'bg-[var(--om-accent)] text-[var(--om-on-accent)]' : 'text-[var(--om-muted)] hover:bg-[var(--om-line)]'}`}
        title="Citation"
      >
        “
      </button>
      <button
        type="button"
        onClick={setNoteBlock}
        className={`p-2 rounded-[10px] text-sm transition-colors ${editor.isActive('blockquote') && editor.getAttributes('blockquote')['data-type'] === 'note' ? 'bg-[var(--om-accent)] text-[var(--om-on-accent)]' : 'text-[var(--om-text)] hover:bg-[var(--om-line)]'}`}
        title="Bloc note"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
      </button>
      <button
        type="button"
        onClick={setQuoteBlock}
        className={`p-2 rounded-[10px] text-sm transition-colors ${editor.isActive('blockquote') && editor.getAttributes('blockquote')['data-type'] === 'quote' ? 'bg-[var(--om-accent)] text-[var(--om-on-accent)]' : 'text-[var(--om-muted)] hover:bg-[var(--om-line)]'}`}
        title="Citation encadrée"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <rect x="3" y="4" width="18" height="16" rx="2" ry="2"/>
          <line x1="7" y1="8" x2="17" y2="8"/>
          <line x1="7" y1="12" x2="17" y2="12"/>
          <line x1="7" y1="16" x2="12" y2="16"/>
        </svg>
      </button>
      <span className="w-px h-5 bg-[var(--om-line)] mx-0.5" />
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleCode().run()}
        className={`p-2 rounded-[10px] text-sm font-mono transition-colors ${editor.isActive('code') ? 'bg-[var(--om-accent)] text-[var(--om-on-accent)]' : 'text-[var(--om-muted)] hover:bg-[var(--om-line)]'}`}
        title="Code inline"
      >
        &lt;/&gt;
      </button>
      <button
        type="button"
        onClick={setCodeBlock}
        className={`p-2 rounded-[10px] text-sm font-mono transition-colors ${editor.isActive('codeBlock') ? 'bg-[var(--om-accent)] text-[var(--om-on-accent)]' : 'text-[var(--om-muted)] hover:bg-[var(--om-line)]'}`}
        title="Bloc de code"
      >
        [&lt;/&gt;]
      </button>
      <span className="w-px h-5 bg-[var(--om-line)] mx-0.5" />
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={`p-2 rounded-[10px] text-sm transition-colors ${editor.isActive('bulletList') ? 'bg-[var(--om-accent)] text-[var(--om-on-accent)]' : 'text-[var(--om-muted)] hover:bg-[var(--om-line)]'}`}
        title="Liste à puces"
      >
        •
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={`p-2 rounded-[10px] text-sm transition-colors ${editor.isActive('orderedList') ? 'bg-[var(--om-accent)] text-[var(--om-on-accent)]' : 'text-[var(--om-muted)] hover:bg-[var(--om-line)]'}`}
        title="Liste numérotée"
      >
        1.
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={`p-2 rounded-[10px] text-sm font-medium transition-colors ${editor.isActive('heading', { level: 2 }) ? 'bg-[var(--om-accent)] text-[var(--om-on-accent)]' : 'text-[var(--om-muted)] hover:bg-[var(--om-line)]'}`}
        title="Titre 2"
      >
        H2
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={`p-2 rounded-[10px] text-sm font-medium transition-colors ${editor.isActive('heading', { level: 3 }) ? 'bg-[var(--om-accent)] text-[var(--om-on-accent)]' : 'text-[var(--om-muted)] hover:bg-[var(--om-line)]'}`}
        title="Titre 3"
      >
        H3
      </button>
    </div>
  );
}

/**
 * Éditeur riche (WYSIWYG) : citations, blocs de code, blocs note, listes, titres.
 * Contenu en HTML (getHTML / setContent(html)).
 *
 * `variant="seamless"` : pas de carte ni de cadre, la barre d'outils se pose
 * au-dessus du contenu et l'on écrit directement sur la surface de la page,
 * avec la typographie de la lecture passée via `contentClassName`.
 */
function RichTextEditor({
  initialHtml,
  onChange,
  placeholder,
  className = '',
  variant = 'card',
  contentClassName = '',
}) {
  const seamless = variant === 'seamless';
  const extensions = useMemo(
    () => getEditorExtensions(placeholder),
    [placeholder]
  );

  const editor = useEditor({
    extensions,
    content: initialHtml || '',
    editorProps: {
      attributes: {
        class: seamless
          ? `rte-seamless max-w-none min-h-[50vh] py-2 text-[var(--om-text)] focus:outline-none ${contentClassName}`.trim()
          : 'prose prose-sm max-w-none min-h-[280px] px-4 py-3 text-[var(--om-text)] focus:outline-none',
      },
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    if (!editor || !onChange) return;
    const handler = () => onChange(editor.getHTML());
    editor.on('update', handler);
    return () => editor.off('update', handler);
  }, [editor, onChange]);

  const memoizedToolbar = useMemo(
    () => <Toolbar editor={editor} seamless={seamless} />,
    [editor, seamless]
  );

  if (!editor) return null;

  if (seamless) {
    return (
      <div className={`text-[var(--om-text)] ${className}`.trim()}>
        {memoizedToolbar}
        <EditorContent editor={editor} />
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex flex-col h-full max-h-[calc(100vh-10rem)] rounded-2xl border border-[var(--om-line)] bg-[var(--om-surface)] text-[var(--om-text)] overflow-hidden">
        {memoizedToolbar}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}

export default RichTextEditor;
