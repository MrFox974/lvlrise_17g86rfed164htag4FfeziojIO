import { useState, useCallback, useEffect, useRef } from 'react';
import { useLoaderData, useNavigate } from 'react-router-dom';
import { marked } from 'marked';
import { useDemoMode } from '../../../../hooks/useDemoMode';
import DemoBlockModal from '../../../../components/DemoBlockModal';
import UpgradeModal from '../../../../components/UpgradeModal';
import { useUpgradeModal, isPlanLimitError } from '../../../../hooks/useUpgradeModal';
import {
  fetchNotes,
  createNote,
  updateNote,
  deleteNote,
} from '../../../../utils/noteApi';
import RichTextEditor from '../../../../components/RichTextEditor';
import { TAG_COLOR } from '../../../../lib/tags';

function contentToHtml(content) {
  if (!content || !content.trim()) return '';
  const t = content.trim();
  if (t.startsWith('<') && (t.includes('</') || t.endsWith('>'))) return t;
  try {
    const parsed = marked.parse(content, { async: false });
    return typeof parsed === 'string' ? parsed : String(parsed);
  } catch {
    return `<p>${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`;
  }
}

/**
 * Typographie unique des notes : la lecture et l'édition partagent exactement
 * le même rendu, pour qu'écrire revienne à écrire sur la note elle-même.
 */
const NOTE_PROSE_CLASS =
  'prose-custom [&_h1]:text-2xl [&_h1]:font-medium [&_h1]:mt-8 [&_h1]:mb-4 [&_h2]:text-xl [&_h2]:font-medium [&_h2]:mt-8 [&_h2]:mb-3 [&_h3]:text-lg [&_h3]:font-medium [&_h3]:mt-6 [&_h3]:mb-2 [&_p]:text-[var(--om-muted)] [&_p]:my-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-4 [&_li]:my-1 [&_a]:text-[var(--om-accent)] [&_a]:underline [&_a]:hover:no-underline [&_code]:bg-[var(--om-surface-2)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_pre]:bg-[var(--om-surface-2)] [&_pre]:p-4 [&_pre]:rounded-2xl [&_pre]:overflow-x-auto [&_pre]:my-4 [&_pre[data-type=code-box]]:border [&_pre[data-type=code-box]]:border-[var(--om-accent)] [&_blockquote]:border-l [&_blockquote]:border-[var(--om-accent)] [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-[var(--om-muted)] [&_blockquote]:my-4 [&_blockquote[data-type=note]]:bg-[var(--om-accent-soft)] [&_blockquote[data-type=note]]:border-[var(--om-accent)] [&_blockquote[data-type=note]]:rounded-r-2xl [&_blockquote[data-type=note]]:py-2 [&_blockquote[data-type=note]]:font-normal [&_blockquote[data-type=quote]]:bg-[var(--om-surface-2)] [&_blockquote[data-type=quote]]:border [&_blockquote[data-type=quote]]:border-[var(--om-accent)] [&_blockquote[data-type=quote]]:rounded-2xl [&_blockquote[data-type=quote]]:p-4 [&_mark]:bg-[var(--om-warning-soft)] [&_mark]:px-0.5 [&_mark]:rounded [&_mark]:font-medium note-content';

const NOTE_READING_CLASS = `max-w-3xl text-[var(--om-text)] text-base leading-[1.75] ${NOTE_PROSE_CLASS}`;

const SORT_OPTIONS = [
  { value: 'updated_at', label: 'Dernière modification' },
  { value: 'created_at', label: 'Date de création' },
  { value: 'title', label: 'Titre' },
];

function stripHtml(html) {
  if (!html || !html.trim()) return '';
  const div = typeof document !== 'undefined' ? document.createElement('div') : null;
  if (div) {
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  }
  return html.replace(/<[^>]*>/g, '');
}

function getTagFillColor(tagId) {
  if (!tagId) return null;
  return TAG_COLOR[tagId] ?? null;
}

function NotesList({ notes, onSelect, onDeleteRequest }) {
  return (
    <div className="space-y-2">
      {notes.length === 0 ? (
        <p className="text-sm text-[var(--om-muted)] py-8 text-center">
          Aucune note. Créez-en une pour commencer.
        </p>
      ) : (
        notes.map((note) => (
          <NoteItem
            key={note.id}
            note={note}
            onSelect={onSelect}
            onDeleteRequest={onDeleteRequest}
          />
        ))
      )}
    </div>
  );
}

function NoteItem({ note, onSelect, onDeleteRequest }) {
  const [swipeX, setSwipeX] = useState(0);
  const startXRef = useRef(0);
  const isDraggingRef = useRef(false);
  const didSwipeRef = useRef(false);

  const getClientX = (e) => e.touches?.[0]?.clientX ?? e.clientX;

  const handleStart = useCallback((e) => {
    startXRef.current = getClientX(e);
    isDraggingRef.current = true;
  }, []);

  const handleMoveFix = useCallback((e) => {
    if (!isDraggingRef.current) return;
    const x = getClientX(e);
    const dx = x - startXRef.current;
    startXRef.current = x;
    if (dx < 0) setSwipeX((prev) => Math.max(-100, prev + dx));
    else setSwipeX((prev) => Math.min(0, prev + dx));
  }, []);

  const handleEnd = useCallback(() => {
    isDraggingRef.current = false;
    let shouldDelete = false;
    setSwipeX((prev) => {
      if (prev < -70) {
        shouldDelete = true;
      }
      return 0;
    });
    if (shouldDelete) {
      didSwipeRef.current = true;
      onDeleteRequest?.(note);
    } else {
      didSwipeRef.current = false;
    }
  }, [note, onDeleteRequest]);

  const preview = stripHtml(note.content || '').slice(0, 80);
  const updatedAt = note.updated_at ?? note.updatedAt;
  const lastModified = updatedAt
    ? new Date(updatedAt).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null;

  const linkedTag = note.todo?.tag;
  const linkedTagColor = getTagFillColor(linkedTag);

  return (
    <div
      className="relative overflow-hidden rounded-2xl"
      onTouchStart={handleStart}
      onTouchMove={handleMoveFix}
      onTouchEnd={handleEnd}
      onTouchCancel={handleEnd}
      onPointerDown={handleStart}
      onPointerMove={handleMoveFix}
      onPointerUp={handleEnd}
      onPointerLeave={handleEnd}
    >
      <div
        className={`absolute inset-y-0 right-0 w-20 flex items-center justify-center bg-[var(--om-danger)] text-[var(--om-on-accent)] text-sm font-medium transition-opacity duration-200 ${
          swipeX < -40 ? 'opacity-100 z-20' : 'opacity-0 z-0 pointer-events-none'
        }`}
        aria-hidden="true"
        style={{ transform: 'translateX(0)' }}
      >
        Suppr.
      </div>
      <div
        className={`relative z-10 flex items-center rounded-2xl border overflow-hidden transition-transform duration-200 border-[var(--om-line)] bg-[var(--om-surface)] ${
          swipeX < -40 ? 'border-[var(--om-danger)]/50' : ''
        }`}
        style={{ transform: `translateX(${swipeX}px)` }}
      >
        <button
          type="button"
          onClick={() => {
            if (didSwipeRef.current) {
              // Empêche l'ouverture de la note juste après un swipe de suppression
              didSwipeRef.current = false;
              return;
            }
            onSelect(note);
          }}
          className="w-full text-left bg-[var(--om-surface)] p-5 shadow-[var(--om-shadow)] hover:border-[var(--om-accent)]/50 hover:bg-[var(--om-accent)]/5 transition-all"
        >
          <div className="min-w-0">
            <h3 className="font-medium text-[var(--om-text)] truncate flex items-center gap-2">
              {note.title || 'Sans titre'}
              {linkedTagColor && (
                <span className="inline-flex items-center gap-1 text-[0.7rem] font-medium text-[var(--om-muted)] uppercase tracking-[0.1em]">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: linkedTagColor }}
                  />
                  liée à une tâche
                </span>
              )}
            </h3>
            <p className="text-base text-[var(--om-muted)] truncate mt-1">
              {preview || 'Vide'}
              {preview.length >= 80 ? '…' : ''}
            </p>
            {lastModified && (
              <p className="text-sm text-[var(--om-muted)]/80 mt-1.5">
                Modifiée le {lastModified}
              </p>
            )}
          </div>
        </button>
      </div>
    </div>
  );
}

function NoteView({ note, onEdit, onBack }) {
  const html = contentToHtml(note?.content || '');
  const updatedAt = note?.updated_at ?? note?.updatedAt;
  const lastModified = updatedAt
    ? new Date(updatedAt).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="text-[var(--om-accent)] hover:underline font-medium"
        >
          ← Retour
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="px-4 py-2 rounded-2xl bg-[var(--om-accent)] text-[var(--om-on-accent)] text-sm font-medium hover:bg-[var(--om-accent-hover)]"
        >
          Éditer
        </button>
      </div>
      <h1 className="text-[17px] md:text-[19px] font-medium tracking-[-0.01em] text-[var(--om-text)]">
        {note?.title || 'Sans titre'}
      </h1>
      {lastModified && (
        <p className="text-sm text-[var(--om-muted)]">
          Modifiée le {lastModified}
        </p>
      )}
      <div
        className={NOTE_READING_CLASS}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

function NoteEditor({ note, onSave, onDelete, onBack, showUpgradeModal }) {
  const [title, setTitle] = useState(note?.title || '');
  const [content, setContent] = useState(() => contentToHtml(note?.content || ''));

  useEffect(() => {
    setTitle(note?.title || '');
    setContent(contentToHtml(note?.content || ''));
  }, [note?.id]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = useCallback(async () => {
    if (!title.trim()) {
      setError('Le titre est requis');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const saved = note
        ? await updateNote(note.id, { title, content })
        : await createNote(title, content);
      onSave(saved);
    } catch (err) {
      const limitError = isPlanLimitError(err);
      if (limitError) {
        showUpgradeModal(limitError.restriction, limitError.featureName || 'notes');
      } else {
        setError(err.response?.data?.error || 'Erreur');
      }
    } finally {
      setLoading(false);
    }
  }, [note, title, content, onSave, showUpgradeModal]);

  const handleDelete = useCallback(async () => {
    if (!note) return;
    if (!window.confirm('Supprimer cette note ?')) return;
    setLoading(true);
    try {
      await deleteNote(note.id);
      onDelete();
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur');
    } finally {
      setLoading(false);
    }
  }, [note, onDelete]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <button
          type="button"
          onClick={onBack}
          className="text-[var(--om-accent)] hover:underline font-medium"
        >
          ← Retour
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-2 rounded-2xl bg-[var(--om-accent)] text-[var(--om-on-accent)] text-sm font-medium hover:bg-[var(--om-accent-hover)] disabled:opacity-60"
          >
            {loading ? 'Enregistrement...' : 'Enregistrer'}
          </button>
          {note && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading}
              className="px-4 py-2 rounded-2xl border border-[var(--om-danger)] text-[var(--om-danger)] text-sm font-medium hover:bg-[var(--om-danger-soft)] disabled:opacity-60"
            >
              Supprimer
            </button>
          )}
        </div>
      </div>

      <input
        type="text"
        placeholder="Titre"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full border-0 px-0 py-0 text-[var(--om-text)] text-[17px] md:text-[19px] font-medium tracking-[-0.01em] focus:outline-none placeholder:text-[var(--om-muted)]"
        // Le fond des champs est imposé globalement dans index.css : on le neutralise
        // ici pour que le titre se lise comme celui de la note, sans cadre.
        style={{ background: 'transparent' }}
      />
      <RichTextEditor
        key={note?.id ?? 'new'}
        initialHtml={contentToHtml(content)}
        onChange={setContent}
        placeholder="Rédigez ici… Citations, code, listes, blocs note."
        variant="seamless"
        contentClassName={NOTE_READING_CLASS}
      />
      {error && <p className="text-sm text-[var(--om-danger)]">{error}</p>}
    </div>
  );
}

function Notes() {
  const navigate = useNavigate();
  const isDemo = useDemoMode();
  const { notes = [] } = useLoaderData();
  const [localNotes, setLocalNotes] = useState(notes);
  const [selectedNote, setSelectedNote] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [sort, setSort] = useState('updated_at');
  const [order, setOrder] = useState('desc');
  const [confirmDeleteNote, setConfirmDeleteNote] = useState(null);
  const [showDemoBlockModal, setShowDemoBlockModal] = useState(false);
  const { showUpgradeModal, hideUpgradeModal, upgradeModalProps } = useUpgradeModal();

  const handleRefresh = useCallback(async () => {
    try {
      const newNotes = await fetchNotes({ sort, order });
      setLocalNotes(newNotes);
    } catch {
      // ignore
    }
  }, [sort, order]);

  const handleSelect = (note) => {
    setSelectedNote(note);
    setIsCreating(false);
    setIsEditingNote(false);
  };

  const handleCreate = () => {
    if (isDemo) {
      setShowDemoBlockModal(true);
      return;
    }
    setSelectedNote(null);
    setIsCreating(true);
    setIsEditingNote(false);
  };

  const handleBack = () => {
    setSelectedNote(null);
    setIsCreating(false);
    setIsEditingNote(false);
    handleRefresh();
  };

  const handleEditNote = () => {
    setIsEditingNote(true);
  };

  /** Après enregistrement on reste sur la note, en lecture. */
  const handleSaved = (saved) => {
    if (saved) {
      setSelectedNote(saved);
      setIsCreating(false);
      setIsEditingNote(false);
      handleRefresh();
      return;
    }
    handleBack();
  };

  const handleSortChange = useCallback(
    (e) => {
      const val = e.target.value;
      setSort(val);
      fetchNotes({ sort: val, order }).then(setLocalNotes).catch(() => {});
    },
    [order]
  );

  const handleOrderChange = useCallback(() => {
    const newOrder = order === 'asc' ? 'desc' : 'asc';
    setOrder(newOrder);
    fetchNotes({ sort, order: newOrder }).then(setLocalNotes).catch(() => {});
  }, [order, sort]);

  const handleDeleteNote = useCallback(async (noteToDelete) => {
    if (!noteToDelete) return;
    try {
      await deleteNote(noteToDelete.id);
      setConfirmDeleteNote(null);
      handleRefresh();
    } catch {
      // ignore
    }
  }, [handleRefresh]);

  // Sur une note (lecture, édition, création), la note porte déjà son propre
  // bouton retour : le retour vers l'accueil ferait doublon.
  const isOnNote = Boolean(selectedNote) || isCreating;

  return (
    <div className="px-4 md:px-6 lg:px-8 pt-1 pb-6 max-w-2xl mx-auto">
      {!isOnNote && (
        <>
          <div className="flex items-center gap-2 mb-6">
            <button
              type="button"
              onClick={() => navigate('/home')}
              className="text-[var(--om-muted)] hover:text-[var(--om-accent)]"
            >
              ← Retour
            </button>
          </div>

          <h1 className="text-[17px] md:text-[19px] font-medium tracking-[-0.01em] text-[var(--om-text)] mb-6">
            Notes
          </h1>
        </>
      )}

      {selectedNote && !isEditingNote ? (
        <NoteView
          note={selectedNote}
          onEdit={handleEditNote}
          onBack={handleBack}
        />
      ) : selectedNote || isCreating ? (
        <NoteEditor
          note={selectedNote}
          onSave={handleSaved}
          onDelete={handleBack}
          onBack={handleBack}
          showUpgradeModal={showUpgradeModal}
        />
      ) : (
        <>
          <div className="flex flex-wrap gap-4 justify-between items-center mb-4">
            <button
              type="button"
              onClick={handleCreate}
              className="px-4 py-2 rounded-2xl bg-[var(--om-accent)] text-[var(--om-on-accent)] text-sm font-medium hover:bg-[var(--om-accent-hover)]"
            >
              + Nouvelle note
            </button>
            <div className="flex gap-2 items-center">
              <select
                value={sort}
                onChange={handleSortChange}
                className="px-3 py-2 rounded-[10px] border border-[var(--om-line)] text-sm text-[var(--om-text)] bg-[var(--om-surface)]"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleOrderChange}
                className="px-3 py-2 rounded-[10px] border border-[var(--om-line)] text-sm text-[var(--om-text)] bg-[var(--om-surface)] hover:bg-[var(--om-surface-2)]"
                title={order === 'asc' ? 'Croissant' : 'Décroissant'}
              >
                {order === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>
          <NotesList
            notes={localNotes}
            onSelect={handleSelect}
            onDeleteRequest={(note) => setConfirmDeleteNote(note)}
          />
          {confirmDeleteNote && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--om-scrim-solid)]/50">
              <div className="bg-[var(--om-surface)] rounded-2xl p-6 max-w-md w-full shadow-[var(--om-shadow-lg)]">
                <h3 className="text-lg font-medium text-[var(--om-text)] mb-2">
                  Supprimer cette note ?
                </h3>
                <p className="text-sm text-[var(--om-muted)] mb-6">
                  Cette action est irréversible.
                </p>
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteNote(null)}
                    className="px-4 py-2 rounded-2xl border border-[var(--om-line)] text-[var(--om-muted)] text-sm font-medium hover:bg-[var(--om-surface-2)]"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteNote(confirmDeleteNote)}
                    className="px-4 py-2 rounded-2xl bg-[var(--om-danger)] text-[var(--om-on-accent)] text-sm font-medium hover:bg-[var(--om-danger-strong)]"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
      <DemoBlockModal isOpen={showDemoBlockModal} onClose={() => setShowDemoBlockModal(false)} />
      <UpgradeModal
        isOpen={upgradeModalProps.isOpen}
        onClose={hideUpgradeModal}
        restriction={upgradeModalProps.restriction}
        featureName={upgradeModalProps.featureName}
      />
    </div>
  );
}

export default Notes;
