import { useState, useCallback, useRef, useEffect } from 'react';
import { useLoaderData, useNavigate, Link } from 'react-router-dom';
import { useDemoBasePath, useDemoMode } from '../../../../hooks/useDemoMode';
import DemoBlockModal from '../../../../components/DemoBlockModal';
import UpgradeModal from '../../../../components/UpgradeModal';
import { useUpgradeModal, isPlanLimitError } from '../../../../hooks/useUpgradeModal';
import {
  DndContext,
  closestCenter,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';

import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  fetchDomains,
  createChapter,
  createSection,
  deleteChapter,
  reorderChapters,
  reorderSections,
  updateSection,
  updateChapter,
  deleteSection,
  setDomainVisibility,
} from '../../../../utils/markdownApi';
import MarkdownReadingView from '../../../../components/MarkdownReadingView';
import MarkdownDocumentEditor from '../../../../components/MarkdownDocumentEditor';
import RichTextEditor from '../../../../components/RichTextEditor';
import { downloadContentAsPdf } from '../../../../utils/downloadPdf';

function SectionEditor({ section, domainId, currentChapterId, chapters, onSave, onBack }) {
  const [title, setTitle] = useState(section.title || '');
  const [content, setContent] = useState(section.content || '');
  const [selectedChapterId, setSelectedChapterId] = useState(currentChapterId);
  const [loading, setLoading] = useState(false);

  const handleSave = useCallback(async () => {
    if (!title.trim()) return;
    setLoading(true);
    try {
      await onSave({
        title,
        content,
        new_chapter_id: selectedChapterId !== currentChapterId ? selectedChapterId : undefined,
      });
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [title, content, selectedChapterId, currentChapterId, onSave]);

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
            {loading ? 'Enregistrement…' : 'Enregistrer le sous-chapitre'}
          </button>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-[var(--om-text)] mb-2">
          Chapitre parent
        </label>
        <select
          value={selectedChapterId || ''}
          onChange={(e) => setSelectedChapterId(parseInt(e.target.value))}
          className="w-full px-4 py-3 rounded-2xl border border-[var(--om-line)] text-[var(--om-text)] bg-[var(--om-surface)] focus:border-[var(--om-accent)] focus:outline-none"
        >
          {chapters.map((ch) => (
            <option key={ch.id} value={ch.id}>
              {ch.title}
            </option>
          ))}
        </select>
      </div>
      <input
        type="text"
        placeholder="ex: Part 1. Introduction"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full px-4 py-3 rounded-2xl border border-[var(--om-line)] text-[var(--om-text)] font-medium text-lg focus:border-[var(--om-accent)] focus:outline-none"
      />
      <div className="flex-1 min-h-0">
        <RichTextEditor
          key={`section-${section.id}`}
          initialHtml={content}
          onChange={setContent}
          placeholder="Rédigez ici…"
          className="h-full"
        />
      </div>
    </div>
  );
}

/** Liste des sous-chapitres sortables (sans DndContext : le parent gère le drag). */
function SectionDndContext({
  sections,
  chapterId,
  onSectionDeleteRequest,
  onSectionEdit,
  onCreateSection,
  creatingSectionForChapterId,
  sectionTitle,
  onSectionTitleChange,
  onSubmitCreateSection,
  onCancelCreateSection,
  domainId,
  chapters,
  activeId,
}) {
  const isCreating = creatingSectionForChapterId === chapterId;
  return (
    <SortableContext
      items={sections.map((s) => `section-${s.id}`)}
      strategy={verticalListSortingStrategy}
    >
      <ul className="space-y-2 w-full">
        {sections.map((s) => (
          <SectionItem
            key={s.id}
            section={s}
            domainId={domainId}
            chapterId={chapterId}
            onDeleteRequest={onSectionDeleteRequest}
            onEdit={onSectionEdit}
            onView={onSectionEdit}
            isDragging={activeId === `section-${s.id}`}
            chapters={chapters}
          />
        ))}
        <li className="w-full">
          {isCreating ? (
            <div className="rounded-2xl border border-[var(--om-line)] bg-[var(--om-surface)] p-3 space-y-2">
              <input
                type="text"
                placeholder="ex: Part 1. Introduction"
                value={sectionTitle}
                onChange={(e) => onSectionTitleChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onSubmitCreateSection(chapterId);
                  if (e.key === 'Escape') onCancelCreateSection();
                }}
                className="w-full px-3 py-2 rounded-[10px] border border-[var(--om-line)] text-[var(--om-text)] text-sm focus:border-[var(--om-accent)] focus:outline-none"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onSubmitCreateSection(chapterId)}
                  className="px-3 py-1.5 rounded-[10px] bg-[var(--om-accent)] text-[var(--om-on-accent)] text-sm font-medium hover:bg-[var(--om-accent-hover)]"
                >
                  Créer
                </button>
                <button
                  type="button"
                  onClick={onCancelCreateSection}
                  className="px-3 py-1.5 rounded-[10px] border border-[var(--om-line)] text-[var(--om-muted)] text-sm hover:bg-[var(--om-surface-2)]"
                >
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onCreateSection(chapterId)}
              className="w-full text-left rounded-2xl border border-dashed border-[var(--om-line)] bg-transparent p-3 text-sm text-[var(--om-muted)] hover:border-[var(--om-accent)] hover:bg-[var(--om-accent)]/5 hover:text-[var(--om-accent)] transition-all"
            >
              + Ajouter un sous-chapitre
            </button>
          )}
        </li>
      </ul>
    </SortableContext>
  );
}

/**
 * Liste de sections avec son propre DndContext : le drag des sous-parties est isolé,
 * donc "over" est toujours une section du même chapitre (plus de conflit avec les chapitres).
 */
function SectionListWithDnd({
  chapterId,
  sections,
  sensors,
  onSectionDragEnd,
  onSectionDeleteRequest,
  onSectionEdit,
  onCreateSection,
  creatingSectionForChapterId,
  sectionTitle,
  onSectionTitleChange,
  onSubmitCreateSection,
  onCancelCreateSection,
  domainId,
  chapters,
}) {
  const [activeId, setActiveId] = useState(null);

  const handleDragStart = useCallback((event) => {
    setActiveId(event.active.id);
  }, []);

  const handleDragEnd = useCallback(
    async (event) => {
      const { active, over } = event;
      setActiveId(null);
      if (!over || active.id === over.id) return;
      const activeStr = String(active.id);
      const overStr = String(over.id);
      if (!activeStr.startsWith('section-') || !overStr.startsWith('section-')) return;
      const activeSectionId = parseInt(activeStr.replace('section-', ''), 10);
      const overSectionId = parseInt(overStr.replace('section-', ''), 10);
      if (isNaN(activeSectionId) || isNaN(overSectionId)) return;
      const oldIndex = sections.findIndex((s) => String(s.id) === String(activeSectionId));
      const newIndex = sections.findIndex((s) => String(s.id) === String(overSectionId));
      if (oldIndex === -1 || newIndex === -1) return;
      const reordered = arrayMove(sections, oldIndex, newIndex);
      onSectionDragEnd(chapterId, reordered.map((s) => s.id));
    },
    [chapterId, sections, onSectionDragEnd]
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SectionDndContext
        sections={sections}
        chapterId={chapterId}
        onSectionDeleteRequest={onSectionDeleteRequest}
        onSectionEdit={onSectionEdit}
        onCreateSection={onCreateSection}
        creatingSectionForChapterId={creatingSectionForChapterId}
        sectionTitle={sectionTitle}
        onSectionTitleChange={onSectionTitleChange}
        onSubmitCreateSection={onSubmitCreateSection}
        onCancelCreateSection={onCancelCreateSection}
        domainId={domainId}
        chapters={chapters}
        activeId={activeId}
      />
    </DndContext>
  );
}

function SectionItem({
  section,
  domainId,
  chapterId,
  onDeleteRequest,
  onEdit,
  onView,
  isDragging,
  chapters,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: `section-${section.id}` });

  const [swipingSectionId, setSwipingSectionId] = useState(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const swipeStartX = useRef(0);
  const swipeCurrentX = useRef(0);
  const didSwipeRef = useRef(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition,
  };

  const handleSwipeStart = useCallback(
    (e) => {
      if (isDragging) return;
      // Ne pas démarrer le swipe si on clique sur les boutons ou le drag handle
      const target = e.target;
      if (
        target.closest('[aria-label="Réordonner"]') ||
        target.closest('button') ||
        target.closest('svg') ||
        target.closest('path') ||
        target.closest('[role="button"]') ||
        target.closest('.cursor-grab')
      ) {
        return;
      }
      swipeStartX.current = e.touches ? e.touches[0].clientX : e.clientX;
      setSwipingSectionId(section.id);
      setSwipeOffset(0);
    },
    [section.id, isDragging]
  );

  const handleSwipeMove = useCallback(
    (e) => {
      if (swipingSectionId !== section.id || isDragging) return;
      const target = e.target;
      // Ne pas continuer le swipe si on passe sur les boutons
      if (
        target.closest('[aria-label="Réordonner"]') ||
        target.closest('button') ||
        target.closest('svg') ||
        target.closest('path') ||
        target.closest('[role="button"]')
      ) {
        return;
      }
      swipeCurrentX.current = e.touches ? e.touches[0].clientX : e.clientX;
      const diff = swipeStartX.current - swipeCurrentX.current;
      if (diff > 0) {
        setSwipeOffset(Math.min(diff, 100));
      }
    },
    [swipingSectionId, section.id, isDragging]
  );

  const handleSwipeEnd = useCallback(() => {
    const shouldDelete = swipeOffset > 50 && swipingSectionId === section.id;
    setSwipingSectionId(null);
    setSwipeOffset(0);
    if (shouldDelete) {
      didSwipeRef.current = true;
      onDeleteRequest(section.id);
    } else {
      didSwipeRef.current = false;
    }
  }, [swipeOffset, swipingSectionId, section.id, onDeleteRequest]);

  return (
    <li
      ref={setNodeRef}
      style={{ ...style }}
      className="relative overflow-hidden rounded-2xl w-full"
      onTouchStart={handleSwipeStart}
      onTouchMove={handleSwipeMove}
      onTouchEnd={handleSwipeEnd}
      onMouseDown={handleSwipeStart}
      onMouseMove={handleSwipeMove}
      onMouseUp={handleSwipeEnd}
      onMouseLeave={handleSwipeEnd}
    >
      {/* Bouton supprimer derrière */}
      <div
        className="absolute right-0 top-0 bottom-0 flex items-center justify-center bg-[var(--om-danger)] text-[var(--om-on-accent)] px-6 rounded-r-2xl cursor-pointer z-0 transition-transform duration-300 ease-out"
        style={{
          minWidth: '100px',
          transform: `translateX(${swipingSectionId === section.id && swipeOffset > 0 ? '0' : '100%'})`,
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDeleteRequest(section.id);
        }}
      >
        <span className="text-sm font-medium">Supprimer</span>
      </div>

      {/* Carte sous-chapitre au-dessus */}
      <div
        className="relative z-10 transition-transform duration-300 ease-out bg-[var(--om-surface)] rounded-2xl"
        style={{ transform: `translateX(-${swipingSectionId === section.id ? swipeOffset : 0}px)` }}
      >
        <div
          className="block w-full text-left rounded-2xl border border-[var(--om-line)] bg-[var(--om-surface-2)]/40 p-3 shadow-[var(--om-shadow)] hover:border-[var(--om-accent)]/50 hover:bg-[var(--om-accent)]/5 transition-all cursor-pointer"
          onClick={(e) => {
            // Ne pas déclencher si on clique sur les boutons ou le drag handle
            if (
              e.target.closest('[aria-label="Réordonner"]') ||
              e.target.closest('button') ||
              e.target.closest('svg') ||
              e.target.closest('path')
            ) {
              return;
            }
            if (didSwipeRef.current) {
              // Empêche l'ouverture juste après un swipe de suppression
              didSwipeRef.current = false;
              return;
            }
            onView(section);
          }}
        >
          <div className="flex justify-between items-center gap-2">
            <div className="min-w-0 flex-1">
              <h4 className="font-medium text-sm text-[var(--om-text)]">{section.title}</h4>
              <p className="text-xs text-[var(--om-muted)] mt-0.5 truncate">
                {section.content?.slice(0, 60) || 'Vide'}
                {section.content && section.content.length > 60 ? '…' : ''}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onEdit(section);
                }}
                className="p-1.5 text-[var(--om-muted)] hover:text-[var(--om-accent)] transition-colors"
                aria-label="Modifier"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </button>
              <div
                {...attributes}
                {...listeners}
                className="p-1.5 cursor-grab active:cursor-grabbing text-[var(--om-muted)] hover:text-[var(--om-accent)] flex items-center"
                style={{ touchAction: 'none' }}
                aria-label="Réordonner"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                }}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 6h2v2H8V6zm0 5h2v2H8v-2zm0 5h2v2H8v-2zm5-10h2v2h-2V6zm0 5h2v2h-2v-2zm0 5h2v2h-2v-2z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}

function ChapterItem({
  chapter,
  domainId,
  onDeleteRequest,
  onEdit,
  onView,
  isDragging,
  expandedChapters,
  onToggleExpand,
  localSections,
  sensors,
  onSectionDragEnd,
  onSectionEdit,
  onSectionDeleteRequest,
  onCreateSection,
  creatingSectionForChapterId,
  sectionTitle,
  onSectionTitleChange,
  onSubmitCreateSection,
  onCancelCreateSection,
  activeId,
  chapters,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: chapter.id });

  const [swipingChapterId, setSwipingChapterId] = useState(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const swipeStartX = useRef(0);
  const swipeCurrentX = useRef(0);
  const didSwipeRef = useRef(false);

  const isExpanded = expandedChapters.has(chapter.id);
  const sections = localSections[chapter.id] || [];

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleSwipeStart = useCallback(
    (e) => {
      if (isDragging) return;
      // Ne pas démarrer le swipe si on clique sur les boutons, le drag handle, ou dans la zone des sous-chapitres
      if (
        e.target.closest('[aria-label="Réordonner"]') ||
        e.target.closest('button') ||
        e.target.closest('svg') ||
        e.target.closest('path') ||
        e.target.closest('.border-t') ||
        e.target.closest('ul.space-y-2')
      ) {
        return;
      }
      swipeStartX.current = e.touches ? e.touches[0].clientX : e.clientX;
      setSwipingChapterId(chapter.id);
      setSwipeOffset(0);
    },
    [chapter.id, isDragging]
  );

  const handleSwipeMove = useCallback(
    (e) => {
      if (swipingChapterId !== chapter.id || isDragging) return;
      // Ne pas continuer le swipe si on passe sur les sous-chapitres
      if (
        e.target.closest('.border-t') ||
        e.target.closest('ul.space-y-2')
      ) {
        return;
      }
      swipeCurrentX.current = e.touches ? e.touches[0].clientX : e.clientX;
      const diff = swipeStartX.current - swipeCurrentX.current;
      if (diff > 0) {
        setSwipeOffset(Math.min(diff, 100));
      }
    },
    [swipingChapterId, chapter.id, isDragging]
  );

  const handleSwipeEnd = useCallback(() => {
    const shouldDelete = swipeOffset > 50 && swipingChapterId === chapter.id;
    setSwipingChapterId(null);
    setSwipeOffset(0);
    if (shouldDelete) {
      didSwipeRef.current = true;
      onDeleteRequest(chapter.id);
    } else {
      didSwipeRef.current = false;
    }
  }, [swipeOffset, swipingChapterId, chapter.id, onDeleteRequest]);

  return (
    <li
      ref={setNodeRef}
      style={{ ...style, touchAction: 'manipulation' }}
      className="relative overflow-hidden rounded-2xl"
      onTouchStart={handleSwipeStart}
      onTouchMove={handleSwipeMove}
      onTouchEnd={handleSwipeEnd}
      onMouseDown={handleSwipeStart}
      onMouseMove={handleSwipeMove}
      onMouseUp={handleSwipeEnd}
      onMouseLeave={handleSwipeEnd}
    >
      {/* Bouton supprimer derrière */}
      <div
        className="absolute right-0 top-0 bottom-0 flex items-center justify-center bg-[var(--om-danger)] text-[var(--om-on-accent)] px-6 rounded-r-2xl cursor-pointer z-0 transition-transform duration-300 ease-out"
        style={{
          minWidth: '100px',
          transform: `translateX(${swipingChapterId === chapter.id && swipeOffset > 0 ? '0' : '100%'})`,
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDeleteRequest(chapter.id);
        }}
      >
        <span className="text-sm font-medium">Supprimer</span>
      </div>

      {/* Carte chapitre au-dessus */}
      <div
        className="relative z-10 transition-transform duration-300 ease-out bg-[var(--om-surface)] rounded-2xl"
        style={{ transform: `translateX(-${swipingChapterId === chapter.id ? swipeOffset : 0}px)` }}
        onClick={(e) => {
          // Ne pas déclencher le swipe si on clique sur les boutons ou dans la zone des sous-chapitres
          if (
            e.target.closest('[aria-label="Réordonner"]') ||
            e.target.closest('button') ||
            e.target.closest('svg') ||
            e.target.closest('path') ||
            e.target.closest('.border-t')
          ) {
            return;
          }
          if (didSwipeRef.current) {
            // Empêche l'ouverture juste après un swipe de suppression
            didSwipeRef.current = false;
            return;
          }
          onView(chapter);
        }}
      >
        <div className="om-card hover:border-[var(--om-accent)]/50 transition-all cursor-pointer">
          <div className="w-full text-left p-4">
            <div className="flex justify-between items-center gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="font-medium text-[var(--om-text)]">{chapter.title}</h3>
                <p className="text-xs text-[var(--om-muted)] mt-1">
                  {sections.length} sous-chapitre(s)
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onToggleExpand(chapter.id);
                  }}
                  className="p-2 text-[var(--om-accent)] hover:text-[var(--om-accent-hover)] transition-colors font-medium"
                  aria-label={isExpanded ? 'Réduire' : 'Déplier'}
                >
                  <svg
                    className={`w-6 h-6 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.5}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                <div
                  {...attributes}
                  {...listeners}
                  className="p-2 cursor-grab active:cursor-grabbing text-[var(--om-muted)] hover:text-[var(--om-accent)] touch-manipulation flex items-center"
                  style={{ touchAction: 'manipulation' }}
                  aria-label="Réordonner"
                  onClick={(e) => e.preventDefault()}
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 6h2v2H8V6zm0 5h2v2H8v-2zm0 5h2v2H8v-2zm5-10h2v2h-2V6zm0 5h2v2h-2v-2zm0 5h2v2h-2v-2z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Sous-chapitres dépliés */}
          {isExpanded && (
            <div
              className="px-4 pb-4 pt-2 border-t border-[var(--om-line)] w-full"
              onClick={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchMove={(e) => e.stopPropagation()}
              onMouseMove={(e) => e.stopPropagation()}
            >
              <SectionListWithDnd
                chapterId={chapter.id}
                sections={sections}
                sensors={sensors}
                onSectionDragEnd={onSectionDragEnd}
                onSectionDeleteRequest={onSectionDeleteRequest}
                onSectionEdit={onSectionEdit}
                onCreateSection={onCreateSection}
                creatingSectionForChapterId={creatingSectionForChapterId}
                sectionTitle={sectionTitle}
                onSectionTitleChange={onSectionTitleChange}
                onSubmitCreateSection={onSubmitCreateSection}
                onCancelCreateSection={onCancelCreateSection}
                domainId={domainId}
                chapters={chapters}
              />
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function MarkdownDomainPage() {
  const navigate = useNavigate();
  const basePath = useDemoBasePath();
  const loaderData = useLoaderData();
  const { domain } = loaderData;
  const [localChapters, setLocalChapters] = useState(domain?.chapters ?? []);
  const [localSections, setLocalSections] = useState({});
  const [expandedChapters, setExpandedChapters] = useState(new Set());
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [deleteType, setDeleteType] = useState(null); // 'chapter' ou 'section'
  const [activeId, setActiveId] = useState(null);
  const [viewingChapter, setViewingChapter] = useState(null);
  const [editingChapter, setEditingChapter] = useState(null);
  const [showDemoBlockModal, setShowDemoBlockModal] = useState(false);
  const isDemo = useDemoMode();
  const [editingSection, setEditingSection] = useState(null);
  const [viewingSection, setViewingSection] = useState(null);
  const [creatingSectionForChapterId, setCreatingSectionForChapterId] = useState(null);
  const [sectionTitle, setSectionTitle] = useState('');
  const [domainIsPublic, setDomainIsPublic] = useState(domain?.is_public ?? false);
  const [showVisibilityConfirm, setShowVisibilityConfirm] = useState(null); // true = vers public, false = vers privé
  const lastOverIdRef = useRef(null);
  const { showUpgradeModal, hideUpgradeModal, upgradeModalProps } = useUpgradeModal();

  useEffect(() => {
    setDomainIsPublic(domain?.is_public ?? false);
  }, [domain?.is_public]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 10 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Charger les sections pour chaque chapitre
  useEffect(() => {
    const sectionsMap = {};
    for (const chapter of localChapters) {
      sectionsMap[chapter.id] = chapter.sections || [];
    }
    setLocalSections(sectionsMap);
  }, [localChapters]);

  const formatChapterTitle = useCallback((raw, index) => {
    const t = raw.trim();
    if (/^Chap\s*\d+\s*[.:]/.test(t)) return t;
    return `Chap ${index}. ${t}`;
  }, []);

  const handleCreateChapter = useCallback(async () => {
    if (!title.trim() || !domain?.id) return;
    
    // En mode démo, bloquer la création de chapitres supplémentaires
    if (isDemo) {
      setShowDemoBlockModal(true);
      return;
    }
    
    const chapterNum = (localChapters?.length ?? 0) + 1;
    const formattedTitle = formatChapterTitle(title, chapterNum);
    setLoading(true);
    try {
      await createChapter(domain.id, formattedTitle);
      setTitle('');
      setShowCreate(false);
      const domains = await fetchDomains();
      const updated = domains.find((d) => String(d.id) === String(domain.id));
      setLocalChapters(updated?.chapters ?? []);
    } catch (error) {
      const limitError = isPlanLimitError(error);
      if (limitError) {
        showUpgradeModal(limitError.restriction, limitError.featureName || 'chapitres');
      }
    } finally {
      setLoading(false);
    }
  }, [domain?.id, title, localChapters?.length, formatChapterTitle, isDemo, showUpgradeModal]);

  const handleSectionTitleChange = useCallback((value) => {
    setSectionTitle(value);
  }, []);

  const handleStartCreateSection = useCallback((chapterId) => {
    setCreatingSectionForChapterId(chapterId);
    setSectionTitle('');
  }, []);

  const handleCancelCreateSection = useCallback(() => {
    setCreatingSectionForChapterId(null);
    setSectionTitle('');
  }, []);

  const handleToggleVisibility = useCallback(
    async (newIsPublic) => {
      if (!domain?.id) return;
      setLoading(true);
      try {
        await setDomainVisibility(domain.id, newIsPublic);
        setDomainIsPublic(newIsPublic);
        setShowVisibilityConfirm(null);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    },
    [domain?.id]
  );

  const formatSectionTitle = useCallback((raw, sectionsInChapter) => {
    const t = raw.trim();
    if (/^Part\s*\d+\s*[.:]/.test(t)) return t;
    return `Part ${(sectionsInChapter?.length ?? 0) + 1}. ${t}`;
  }, []);

  const handleSubmitCreateSection = useCallback(
    async (chapterId) => {
      if (!sectionTitle.trim() || !domain?.id) return;
      
      // En mode démo, bloquer la création de sous-chapitres supplémentaires
      if (isDemo) {
        setShowDemoBlockModal(true);
        return;
      }
      
      const sectionsInChapter = localSections[chapterId] ?? [];
      const formattedTitle = formatSectionTitle(sectionTitle, sectionsInChapter);
      setLoading(true);
      try {
        await createSection(domain.id, chapterId, formattedTitle);
        setCreatingSectionForChapterId(null);
        setSectionTitle('');
        const domains = await fetchDomains();
        const updated = domains.find((d) => String(d.id) === String(domain.id));
        setLocalChapters(updated?.chapters ?? []);
      } catch (error) {
        const limitError = isPlanLimitError(error);
        if (limitError) {
          showUpgradeModal(limitError.restriction, limitError.featureName || 'sous-chapitres');
        }
        // ignore
      } finally {
        setLoading(false);
      }
    },
    [domain?.id, sectionTitle, localSections, formatSectionTitle, isDemo]
  );

  const handleDeleteChapter = useCallback(async (chapterId) => {
    if (!domain?.id) return;
    setLoading(true);
    try {
      await deleteChapter(domain.id, chapterId);
      const domains = await fetchDomains();
      const updated = domains.find((d) => String(d.id) === String(domain.id));
      setLocalChapters(updated?.chapters ?? []);
      setShowDeleteConfirm(null);
      setDeleteType(null);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [domain?.id]);

  const handleDeleteSection = useCallback(
    async (sectionId) => {
      if (!domain?.id) return;
      setLoading(true);
      try {
        // Trouver le chapitre parent
        let parentChapterId = null;
        for (const chapter of localChapters) {
          const section = (chapter.sections || []).find((s) => s.id === sectionId);
          if (section) {
            parentChapterId = chapter.id;
            break;
          }
        }
        if (!parentChapterId) return;

        await deleteSection(domain.id, parentChapterId, sectionId);
        const domains = await fetchDomains();
        const updated = domains.find((d) => String(d.id) === String(domain.id));
        setLocalChapters(updated?.chapters ?? []);
        setShowDeleteConfirm(null);
        setDeleteType(null);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    },
    [domain?.id, localChapters]
  );

  const handleSectionReorder = useCallback(
    async (chapterId, sectionIds) => {
      if (!domain?.id || chapterId == null || !Array.isArray(sectionIds) || sectionIds.length === 0) return;
      const ids = sectionIds.map((id) => Number(id)).filter((n) => !isNaN(n));
      if (ids.length !== sectionIds.length) {
        console.error('handleSectionReorder: ids invalides', sectionIds);
        return;
      }
      try {
        await reorderSections(domain.id, chapterId, ids);
        const domains = await fetchDomains();
        const updated = domains.find((d) => String(d.id) === String(domain.id));
        setLocalChapters(updated?.chapters ?? []);
      } catch (error) {
        console.error('Erreur lors de la sauvegarde de l\'ordre des sous-chapitres:', error);
      }
    },
    [domain?.id]
  );

  /** Appelé par le DndContext des sections (SectionListWithDnd) après un drop. */
  const handleSectionDragEnd = useCallback(
    async (chapterId, sectionIds) => {
      const chapter = localChapters.find((ch) => String(ch.id) === String(chapterId));
      if (!chapter?.sections) return;
      const reordered = sectionIds
        .map((id) => chapter.sections.find((s) => String(s.id) === String(id)))
        .filter(Boolean);
      if (reordered.length !== sectionIds.length) return;
      setLocalChapters((prev) =>
        prev.map((ch) =>
          String(ch.id) === String(chapterId) ? { ...ch, sections: reordered } : ch
        )
      );
      await handleSectionReorder(chapterId, sectionIds);
    },
    [localChapters, handleSectionReorder]
  );

  const handleDragStart = useCallback((event) => {
    setActiveId(event.active.id);
    lastOverIdRef.current = null;
  }, []);

  const handleDragOver = useCallback((event) => {
    if (event.over?.id != null) lastOverIdRef.current = event.over.id;
  }, []);

  const handleDragEnd = useCallback(
    async (event) => {
      const { active, over } = event;
      const effectiveOverId = over?.id ?? lastOverIdRef.current;
      lastOverIdRef.current = null;
      setActiveId(null);
      if (effectiveOverId == null || active.id === effectiveOverId) return;
      // Seuls les chapitres sont gérés ici ; les sections ont leur propre DndContext (SectionListWithDnd).
      let overChapterId = effectiveOverId;
      if (String(effectiveOverId).startsWith('section-')) {
        const sectionId = parseInt(String(effectiveOverId).replace('section-', ''), 10);
        const chapterContaining = localChapters.find((ch) =>
          (ch.sections || []).some((s) => String(s.id) === String(sectionId))
        );
        overChapterId = chapterContaining?.id;
      }
      if (overChapterId == null) return;
      const oldIndex = localChapters.findIndex((ch) => String(ch.id) === String(active.id));
      const newIndex = localChapters.findIndex((ch) => String(ch.id) === String(overChapterId));
      if (oldIndex === -1 || newIndex === -1) return;
      const reordered = arrayMove(localChapters, oldIndex, newIndex);
      setLocalChapters(reordered);
      const chapterIds = reordered.map((ch) => ch.id);
      const ids = chapterIds.map((id) => Number(id)).filter((n) => !isNaN(n));
      if (ids.length !== chapterIds.length) {
        console.error('handleDragEnd (chapitres): ids invalides', chapterIds);
        return;
      }
      try {
        const updated = await reorderChapters(domain.id, ids);
        setLocalChapters(updated);
      } catch (error) {
        console.error('Erreur lors de la sauvegarde de l\'ordre des chapitres:', error);
      }
    },
    [localChapters, domain?.id]
  );

  const handleToggleExpand = useCallback((chapterId) => {
    setExpandedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(chapterId)) {
        next.delete(chapterId);
      } else {
        next.add(chapterId);
      }
      return next;
    });
  }, []);

  const handleSaveChapter = useCallback(
    async ({ title, content }) => {
      if (!editingChapter) return null;

      const savedChapter = await updateChapter(domain.id, editingChapter.id, { title, content });
      const domains = await fetchDomains();
      const updatedDomain = domains.find((d) => String(d.id) === String(domain.id));
      const updatedChapters = updatedDomain?.chapters ?? [];
      setLocalChapters(updatedChapters);

      const refreshedChapter =
        updatedChapters.find((ch) => String(ch.id) === String(savedChapter.id)) || savedChapter;

      return refreshedChapter;
    },
    [domain?.id, editingChapter]
  );

  const handleSaveSection = useCallback(
    async ({ title, content, new_chapter_id }) => {
      if (!editingSection) return null;
      let currentChapterId = null;
      for (const chapter of localChapters) {
        const section = (chapter.sections || []).find((s) => s.id === editingSection.id);
        if (section) {
          currentChapterId = chapter.id;
          break;
        }
      }
      if (!currentChapterId) return;

      const savedSection = await updateSection(domain.id, currentChapterId, editingSection.id, {
        title,
        content,
        new_chapter_id: new_chapter_id || currentChapterId,
      });
      const domains = await fetchDomains();
      const updatedDomain = domains.find((d) => String(d.id) === String(domain.id));
      const updatedChapters = updatedDomain?.chapters ?? [];
      setLocalChapters(updatedChapters);

      let refreshedSection = null;
      for (const chapter of updatedChapters) {
        const found = (chapter.sections || []).find(
          (s) => String(s.id) === String(savedSection.id)
        );
        if (found) {
          refreshedSection = found;
          break;
        }
      }

      return refreshedSection || savedSection;
    },
    [domain?.id, editingSection, localChapters]
  );

  if (!domain) {
    return (
      <div className="px-4 md:px-6 lg:px-8 pt-1 pb-6 max-w-4xl mx-auto text-center">
        <p className="text-[var(--om-muted)] mb-4">Domaine introuvable.</p>
        <Link
          to={`${basePath}/productivite/markdown`}
          className="text-[var(--om-accent)] hover:underline"
        >
          ← Retour aux domaines
        </Link>
      </div>
    );
  }

  // Si on est en train d'éditer un chapitre
  if (editingChapter && !viewingChapter && !editingSection && !viewingSection) {
    return (
      <div className="px-4 md:px-6 lg:px-8 pt-1 pb-6 max-w-4xl mx-auto">
        <MarkdownDocumentEditor
          documentKey={`chapter-${editingChapter.id}`}
          title={editingChapter.title}
          content={editingChapter.content ?? ''}
          onSave={async ({ title, content }) => {
            const updated = await handleSaveChapter({ title, content });
            if (updated) {
              setViewingChapter(updated);
            }
            setEditingChapter(null);
          }}
          onBack={() => {
            setEditingChapter(null);
            setViewingChapter(editingChapter);
          }}
          saveLabel="Enregistrer le chapitre"
          titlePlaceholder="Titre du chapitre"
          showDelete={false}
        />
      </div>
    );
  }

  // Si on est en train de visualiser un chapitre
  if (viewingChapter && !editingChapter && !editingSection && !viewingSection) {
    return (
      <div className="px-4 md:px-6 lg:px-8 pt-1 pb-6 max-w-4xl mx-auto">
        <div className="flex justify-between items-center gap-2 sm:gap-4 mb-4">
          <button
            type="button"
            onClick={() => {
              setViewingChapter(null);
              setEditingChapter(null);
            }}
            className="text-[var(--om-accent)] hover:underline font-medium flex-shrink-0"
          >
            ← Retour
          </button>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                const safeName = (viewingChapter.title || 'chapitre').replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 50);
                downloadContentAsPdf(
                  viewingChapter.title,
                  viewingChapter.content ?? '',
                  `${safeName}.pdf`
                );
              }}
              className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-2xl border border-[var(--om-line)] text-[var(--om-text)] text-sm sm:text-base font-medium hover:bg-[var(--om-surface-2)] whitespace-nowrap"
            >
              Télécharger
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingChapter(viewingChapter);
                setViewingChapter(null);
              }}
              className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-2xl bg-[var(--om-accent)] text-[var(--om-on-accent)] text-sm sm:text-base font-medium hover:bg-[var(--om-accent-hover)] whitespace-nowrap"
            >
              Modifier le chapitre
            </button>
          </div>
        </div>
        <MarkdownReadingView
          title={viewingChapter.title}
          content={viewingChapter.content ?? ''}
          onEdit={null}
          editLabel="Modifier le chapitre"
        />
      </div>
    );
  }

  // Trouver le chapitre parent pour les sections
  let currentChapterForSection = null;
  if (viewingSection || editingSection) {
    for (const chapter of localChapters) {
      const section = (chapter.sections || []).find((s) => s.id === (editingSection?.id || viewingSection?.id));
      if (section) {
        currentChapterForSection = chapter;
        break;
      }
    }
  }

  // Si on est en train d'éditer un sous-chapitre
  if (editingSection && !viewingSection) {
    return (
      <div className="px-4 md:px-6 lg:px-8 pt-1 pb-6 max-w-4xl mx-auto">
        <SectionEditor
          section={editingSection}
          domainId={domain.id}
          currentChapterId={currentChapterForSection?.id}
          chapters={localChapters}
          onSave={async ({ title, content, new_chapter_id }) => {
            const updated = await handleSaveSection({ title, content, new_chapter_id });
            if (updated) {
              setViewingSection(updated);
            }
            setEditingSection(null);
          }}
          onBack={() => {
            setEditingSection(null);
            setViewingSection(editingSection);
          }}
        />
      </div>
    );
  }

  // Si on est en train de visualiser un sous-chapitre
  if (viewingSection && !editingSection) {
    return (
      <div className="px-4 md:px-6 lg:px-8 pt-1 pb-6 max-w-4xl mx-auto">
        <div className="flex justify-between items-center gap-2 sm:gap-4 mb-4">
          <button
            type="button"
            onClick={() => {
              setViewingSection(null);
              setEditingSection(null);
            }}
            className="text-[var(--om-accent)] hover:underline font-medium flex-shrink-0"
          >
            ← Retour
          </button>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                const safeName = (viewingSection.title || 'sous-chapitre').replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 50);
                downloadContentAsPdf(
                  viewingSection.title,
                  viewingSection.content ?? '',
                  `${safeName}.pdf`
                );
              }}
              className="px-4 py-2 rounded-2xl border border-[var(--om-line)] text-[var(--om-text)] text-sm font-medium hover:bg-[var(--om-surface-2)] whitespace-nowrap"
            >
              Télécharger
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingSection(viewingSection);
                setViewingSection(null);
              }}
              className="px-4 py-2 rounded-2xl bg-[var(--om-accent)] text-[var(--om-on-accent)] text-sm font-medium hover:bg-[var(--om-accent-hover)] whitespace-nowrap"
            >
              Modifier le sous-chapitre
            </button>
          </div>
        </div>
        <MarkdownReadingView
          title={viewingSection.title}
          content={viewingSection.content ?? ''}
          onEdit={null}
          editLabel="Modifier le sous-chapitre"
        />
      </div>
    );
  }

  // Vue principale : liste des chapitres
  return (
    <div className="px-4 md:px-6 lg:px-8 pt-1 pb-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center gap-4 mb-6">
        <button
          type="button"
          onClick={() => navigate(`${basePath}/productivite/markdown`)}
          className="text-[var(--om-accent)] hover:underline font-medium"
        >
          ← Retour
        </button>
        <button
          type="button"
          onClick={() => setShowCreate(!showCreate)}
          className="px-4 py-2.5 sm:px-5 sm:py-2.5 rounded-2xl bg-[var(--om-accent)] text-[var(--om-on-accent)] text-sm sm:text-base font-medium hover:bg-[var(--om-accent-hover)] whitespace-nowrap"
        >
          {showCreate ? 'Annuler' : '+ Créer un chapitre'}
        </button>
      </div>

      <div className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
          <h1 className="text-[17px] md:text-[19px] font-medium tracking-[-0.01em] text-[var(--om-text)]">
            {(() => {
              const m = domain.name?.match(/^(.+)\s+(\(par @[^)]+\))$/);
              if (m) {
                return (
                  <>
                    {m[1]}
                    <span className="text-[var(--om-muted)] font-normal">{' '}{m[2]}</span>
                  </>
                );
              }
              return domain.name;
            })()}
          </h1>
          <div className="flex items-center gap-2 shrink-0">
            {domain.name?.includes(' (par @') ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--om-accent)]">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Importé
              </span>
            ) : (
              <>
                <span
                  className={`text-sm font-medium ${domainIsPublic ? 'text-[var(--om-accent)]' : 'text-[var(--om-muted)]'}`}
                >
                  {domainIsPublic ? 'Public' : 'Privé'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (isDemo) {
                      setShowDemoBlockModal(true);
                      return;
                    }
                    setShowVisibilityConfirm(!domainIsPublic);
                  }}
                  className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--om-accent)]/50 focus:ring-offset-2 ${
                    domainIsPublic ? 'bg-[var(--om-accent)]' : 'bg-[var(--om-line)]'
                  }`}
                  role="switch"
                  aria-checked={domainIsPublic}
                  aria-label={domainIsPublic ? 'Passer en privé' : 'Rendre public'}
                >
                  <span
                    className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-[var(--om-surface)] shadow ring-0 transition ${
                      domainIsPublic ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </button>
              </>
            )}
          </div>
        </div>
        {domain.description && (
          <p className="text-sm text-[var(--om-muted)]">{domain.description}</p>
        )}
      </div>

      {/* Pop-up de confirmation visibilité Privé/Public */}
      {showVisibilityConfirm !== null && (
        <div className="fixed inset-0 bg-[var(--om-scrim-solid)]/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--om-surface)] rounded-2xl p-6 max-w-md w-full shadow-[var(--om-shadow-lg)]">
            <h3 className="text-lg font-medium text-[var(--om-text)] mb-2">
              {showVisibilityConfirm ? 'Rendre ce domaine public ?' : 'Passer ce domaine en privé ?'}
            </h3>
            <p className="text-sm text-[var(--om-muted)] mb-6">
              {showVisibilityConfirm
                ? 'Le domaine sera visible et importable par tous les utilisateurs.'
                : 'Le domaine ne sera plus visible dans la bibliothèque partagée.'}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowVisibilityConfirm(null)}
                className="px-4 py-2 rounded-2xl border border-[var(--om-line)] text-[var(--om-muted)] text-sm font-medium hover:bg-[var(--om-surface-2)]"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => handleToggleVisibility(showVisibilityConfirm)}
                disabled={loading}
                className="px-4 py-2 rounded-2xl bg-[var(--om-accent)] text-[var(--om-on-accent)] text-sm font-medium hover:bg-[var(--om-accent-hover)] disabled:opacity-60"
              >
                {loading ? 'En cours…' : showVisibilityConfirm ? 'Rendre public' : 'Passer en privé'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="om-card p-5 mb-6">
          <input
            type="text"
            placeholder="ex: Chap 1. Les Fondements"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-3 rounded-2xl border border-[var(--om-line)] text-[var(--om-text)] mb-4 focus:border-[var(--om-accent)] focus:outline-none"
          />
          <button
            type="button"
            onClick={handleCreateChapter}
            disabled={loading}
            className="px-4 py-2 rounded-2xl bg-[var(--om-accent)] text-[var(--om-on-accent)] font-medium hover:bg-[var(--om-accent-hover)] disabled:opacity-60"
          >
            {loading ? 'Création…' : 'Créer le chapitre'}
          </button>
        </div>
      )}

      {editingChapter && (
        <div className="mb-6">
          <MarkdownDocumentEditor
            documentKey={`chapter-${editingChapter.id}`}
            title={editingChapter.title}
            content={editingChapter.content ?? ''}
            onSave={handleSaveChapter}
            onBack={() => setEditingChapter(null)}
            saveLabel="Enregistrer le chapitre"
            titlePlaceholder="Titre du chapitre"
            showDelete={false}
          />
        </div>
      )}

      <h2 className="text-lg font-medium text-[var(--om-text)] mb-3">
        Chapitres
      </h2>
      {localChapters.length === 0 && !showCreate ? (
        <p className="text-[var(--om-muted)] py-8">
          Aucun chapitre. Créez-en un pour ajouter du contenu.
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={localChapters.map((ch) => ch.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="space-y-3">
              {localChapters.map((ch) => (
                <ChapterItem
                  key={ch.id}
                  chapter={ch}
                  domainId={domain.id}
                  onDeleteRequest={(id) => {
                    setShowDeleteConfirm(id);
                    setDeleteType('chapter');
                  }}
                  onEdit={(chapter) => setEditingChapter(chapter)}
                  onView={(chapter) => setViewingChapter(chapter)}
                  isDragging={activeId === ch.id}
                  expandedChapters={expandedChapters}
                  onToggleExpand={handleToggleExpand}
                  localSections={localSections}
                  sensors={sensors}
                  onSectionDragEnd={handleSectionDragEnd}
                  onSectionEdit={(section) => {
                    setViewingSection(section);
                    setEditingSection(null);
                  }}
                  onSectionDeleteRequest={(id) => {
                    setShowDeleteConfirm(id);
                    setDeleteType('section');
                  }}
                  onCreateSection={handleStartCreateSection}
                  creatingSectionForChapterId={creatingSectionForChapterId}
                  sectionTitle={sectionTitle}
                  onSectionTitleChange={handleSectionTitleChange}
                  onSubmitCreateSection={handleSubmitCreateSection}
                  onCancelCreateSection={handleCancelCreateSection}
                  activeId={activeId}
                  chapters={localChapters}
                />
              ))}
            </ul>
          </SortableContext>
          {/* Overlay uniquement pour les chapitres : pour les sections, pas d'overlay afin que le curseur reste au-dessus des droppables (autres sections). */}
          <DragOverlay dropAnimation={{ duration: 0 }}>
            {activeId != null && !String(activeId).startsWith('section-') ? (
              <div className="w-full text-left rounded-2xl border border-[var(--om-line)] bg-[var(--om-surface)] p-4 shadow-[var(--om-shadow-lg)] opacity-90">
                <h3 className="font-medium text-[var(--om-text)]">
                  {localChapters.find((ch) => ch.id === activeId)?.title}
                </h3>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Pop-up de confirmation de suppression */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-[var(--om-scrim-solid)]/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--om-surface)] rounded-2xl p-6 max-w-md w-full shadow-[var(--om-shadow-lg)]">
            <h3 className="text-lg font-medium text-[var(--om-text)] mb-2">
              Supprimer {deleteType === 'chapter' ? 'le chapitre' : 'le sous-chapitre'} ?
            </h3>
            <p className="text-sm text-[var(--om-muted)] mb-6">
              Cette action est irréversible.
              {deleteType === 'chapter' &&
                ' Le chapitre et toutes ses sous-parties seront supprimés.'}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(null);
                  setDeleteType(null);
                }}
                className="px-4 py-2 rounded-2xl border border-[var(--om-line)] text-[var(--om-muted)] text-sm font-medium hover:bg-[var(--om-surface-2)]"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  if (deleteType === 'chapter') {
                    handleDeleteChapter(showDeleteConfirm);
                  } else {
                    handleDeleteSection(showDeleteConfirm);
                  }
                }}
                disabled={loading}
                className="px-4 py-2 rounded-2xl bg-[var(--om-danger)] text-[var(--om-on-accent)] text-sm font-medium hover:bg-[var(--om-danger-strong)] disabled:opacity-60"
              >
                {loading ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
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

export default MarkdownDomainPage;
