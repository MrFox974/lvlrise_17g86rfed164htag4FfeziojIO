import { useState, useCallback, useMemo, useEffect } from 'react';
import { useLoaderData, useNavigate, useSearchParams } from 'react-router-dom';
import { marked } from 'marked';
import MarkdownReadingView from '../../../../components/MarkdownReadingView';
import {
  fetchDomains,
  createDomain,
  createChapter,
  updateChapter,
  deleteChapter,
  createSection,
  updateSection,
  deleteSection,
  fetchSections,
} from '../../../../utils/markdownApi';

const FILTER_SORT_OPTIONS = [
  { value: 'created_at', label: 'Date de création' },
  { value: 'updated_at', label: 'Dernière modification' },
  { value: 'title', label: 'Titre' },
];

function DomainList({ domains, selectedId, onSelect, onCreate, onRefresh }) {
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = useCallback(async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await createDomain(name, description);
      setName('');
      setDescription('');
      setShowCreate(false);
      onRefresh();
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [name, description, onRefresh]);

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <h3 className="font-medium text-[var(--om-text)]">Domaines</h3>
        <button
          type="button"
          onClick={() => setShowCreate(!showCreate)}
          className="text-sm text-[var(--om-accent)] hover:underline"
        >
          {showCreate ? 'Annuler' : '+ Nouveau'}
        </button>
      </div>
      {showCreate && (
        <div className="rounded-2xl border border-[var(--om-line)] p-3 mb-3">
          <input
            type="text"
            placeholder="Nom du domaine"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-2 py-1.5 rounded-[10px] border border-[var(--om-line)] text-sm mb-2"
          />
          <textarea
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full px-2 py-1.5 rounded-[10px] border border-[var(--om-line)] text-sm mb-2 resize-none"
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={loading}
            className="px-3 py-1.5 rounded-[10px] bg-[var(--om-accent)] text-[var(--om-on-accent)] text-sm disabled:opacity-60"
          >
            Créer
          </button>
        </div>
      )}
      {domains.map((d) => (
        <button
          key={d.id}
          type="button"
          onClick={() => onSelect(d)}
          className={`w-full text-left px-3 py-2 rounded-2xl text-sm font-medium transition-colors ${
            selectedId === d.id
              ? 'bg-[var(--om-accent)] text-[var(--om-on-accent)]'
              : 'bg-[var(--om-surface-2)] text-[var(--om-text)] hover:bg-[var(--om-line)]'
          }`}
        >
          {d.name}
        </button>
      ))}
    </div>
  );
}

function formatChapterTitle(raw, index) {
  const t = raw.trim();
  if (/^Chap\s*\d+\s*[.:]/.test(t)) return t;
  return `Chap ${index}. ${t}`;
}

function formatSectionTitle(raw, sectionsInChapter) {
  const t = raw.trim();
  if (/^Part\s*\d+\s*[.:]/.test(t)) return t;
  return `Part ${(sectionsInChapter?.length ?? 0) + 1}. ${t}`;
}

function ChapterList({ chapters, domainId, selectedId, onSelect, onCreate, onRefresh }) {
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = useCallback(async () => {
    if (!title.trim() || !domainId) return;
    const chapterNum = (chapters?.length ?? 0) + 1;
    const formattedTitle = formatChapterTitle(title, chapterNum);
    setLoading(true);
    try {
      await createChapter(domainId, formattedTitle);
      setTitle('');
      setShowCreate(false);
      onRefresh();
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [title, domainId, chapters?.length, onRefresh]);

  if (!domainId) return null;

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <h3 className="font-medium text-[var(--om-text)]">Chapitres</h3>
        <button
          type="button"
          onClick={() => setShowCreate(!showCreate)}
          className="text-sm text-[var(--om-accent)] hover:underline"
        >
          {showCreate ? 'Annuler' : '+ Nouveau'}
        </button>
      </div>
      {showCreate && (
        <div className="rounded-2xl border border-[var(--om-line)] p-3 mb-3">
          <input
            type="text"
            placeholder="ex: Chap 1. Les Fondements"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-2 py-1.5 rounded-[10px] border border-[var(--om-line)] text-sm mb-2"
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={loading}
            className="px-3 py-1.5 rounded-[10px] bg-[var(--om-accent)] text-[var(--om-on-accent)] text-sm disabled:opacity-60"
          >
            Créer
          </button>
        </div>
      )}
      {(chapters || []).map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onSelect(c)}
          className={`w-full text-left px-3 py-2 rounded-2xl text-sm font-medium transition-colors ${
            selectedId === c.id
              ? 'bg-[var(--om-accent)] text-[var(--om-on-accent)]'
              : 'bg-[var(--om-surface-2)] text-[var(--om-text)] hover:bg-[var(--om-line)]'
          }`}
        >
          {c.title}
        </button>
      ))}
    </div>
  );
}

/** Éditeur de document (chapitre ou section) : titre + zone Markdown + aperçu */
function DocumentEditor({
  title: initialTitle,
  content: initialContent,
  onSave,
  onDelete,
  onBack,
  saveLabel = 'Enregistrer',
  deleteLabel = 'Supprimer',
  titlePlaceholder = 'Titre',
  showDelete = false,
}) {
  const [title, setTitle] = useState(initialTitle || '');
  const [content, setContent] = useState(initialContent || '');
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  useEffect(() => {
    setTitle(initialTitle || '');
    setContent(initialContent || '');
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

  const htmlContent = useMemo(() => {
    try {
      const parsed = marked.parse(content || '', { async: false });
      return typeof parsed === 'string' ? parsed : String(parsed);
    } catch {
      return content;
    }
  }, [content]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-4">
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
            onClick={() => setShowPreview(!showPreview)}
            className="px-3 py-2 rounded-[10px] border border-[var(--om-line)] text-sm text-[var(--om-muted)] hover:bg-[var(--om-surface-2)]"
          >
            {showPreview ? 'Masquer aperçu' : 'Aperçu'}
          </button>
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
      <div className={showPreview ? 'grid grid-cols-1 lg:grid-cols-2 gap-6' : ''}>
        <textarea
          placeholder="Contenu Markdown… (## titres, **gras**, listes, code, etc.)"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={20}
          className="w-full px-4 py-3 rounded-2xl border border-[var(--om-line)] text-[var(--om-text)] font-mono text-sm resize-y min-h-[320px] focus:border-[var(--om-accent)] focus:outline-none"
        />
        {showPreview && (
          <div
            className="rounded-2xl border border-[var(--om-line)] p-5 bg-[var(--om-surface)] text-[var(--om-text)] text-sm leading-relaxed [&_h1]:text-xl [&_h2]:text-lg [&_h3]:text-base [&_p]:text-[var(--om-muted)] [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-6 [&_ol]:pl-6 [&_a]:text-[var(--om-accent)] [&_code]:bg-[var(--om-surface-2)] [&_code]:px-1 [&_code]:rounded [&_pre]:bg-[var(--om-surface-2)] [&_pre]:p-3 [&_pre]:rounded-[10px]"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
        )}
      </div>
    </div>
  );
}

function Markdown() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const loaderData = useLoaderData();
  const { domains = [], sections = [], filters = {} } = loaderData;

  const [selectedDomain, setSelectedDomain] = useState(null);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [selectedSection, setSelectedSection] = useState(null);
  const [isCreatingSection, setIsCreatingSection] = useState(false);
  const [editingChapter, setEditingChapter] = useState(false);
  const [editingSection, setEditingSection] = useState(false);
  const [localDomains, setLocalDomains] = useState(domains);
  const [localSections, setLocalSections] = useState(sections);
  const [filterSort, setFilterSort] = useState(filters.sort || 'created_at');
  const [filterOrder, setFilterOrder] = useState(filters.order || 'desc');

  const chapters = selectedDomain?.chapters || [];

  useEffect(() => {
    if (!selectedChapter?.id) {
      setLocalSections([]);
      return;
    }
    fetchSections({
      chapter_id: selectedChapter.id,
      sort: filterSort,
      order: filterOrder,
    })
      .then(setLocalSections)
      .catch(() => setLocalSections([]));
  }, [selectedChapter?.id, filterSort, filterOrder]);

  const handleRefresh = useCallback(async () => {
    try {
      const newDomains = await fetchDomains();
      setLocalDomains(newDomains);
      if (selectedDomain) {
        const updated = newDomains.find((d) => d.id === selectedDomain.id);
        if (updated) setSelectedDomain(updated);
      }
      if (selectedChapter?.id) {
        const newSections = await fetchSections({
          chapter_id: selectedChapter.id,
          sort: filterSort,
          order: filterOrder,
        });
        setLocalSections(newSections);
      }
    } catch {
      // ignore
    }
  }, [selectedDomain, selectedChapter?.id, filterSort, filterOrder]);

  const handleFilterChange = useCallback(
    (sort, order) => {
      setFilterSort(sort);
      setFilterOrder(order);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('sort', sort);
        next.set('order', order);
        if (selectedDomain?.id) next.set('domain_id', selectedDomain.id);
        if (selectedChapter?.id) next.set('chapter_id', selectedChapter.id);
        return next;
      });
      fetchSections({
        domain_id: selectedDomain?.id,
        chapter_id: selectedChapter?.id,
        sort,
        order,
      })
        .then(setLocalSections)
        .catch(() => {});
    },
    [selectedDomain?.id, selectedChapter?.id, setSearchParams]
  );

  const handleBackContent = useCallback(() => {
    setSelectedSection(null);
    setIsCreatingSection(false);
    setEditingChapter(false);
    setEditingSection(false);
    handleRefresh();
  }, [handleRefresh]);

  const handleSaveChapter = useCallback(
    async ({ title, content }) => {
      const chapterIndex =
        chapters.findIndex((c) => c.id === selectedChapter.id) + 1 || 1;
      const formattedTitle = formatChapterTitle(title, chapterIndex);
      await updateChapter(selectedDomain.id, selectedChapter.id, {
        title: formattedTitle,
        content,
      });
      handleRefresh();
    },
    [selectedDomain?.id, selectedChapter?.id, chapters, handleRefresh]
  );

  const handleSaveSection = useCallback(
    async ({ title, content }) => {
      if (selectedSection) {
        const sectionIndex =
          (localSections?.findIndex((s) => s.id === selectedSection.id) ?? -1) + 1 || 1;
        const formattedTitle = formatSectionTitle(title, localSections?.slice(0, sectionIndex - 1));
        await updateSection(
          selectedDomain.id,
          selectedChapter.id,
          selectedSection.id,
          { title: formattedTitle, content }
        );
      } else {
        const formattedTitle = formatSectionTitle(title, localSections);
        await createSection(selectedDomain.id, selectedChapter.id, formattedTitle, content);
      }
      handleRefresh();
    },
    [
      selectedDomain?.id,
      selectedChapter?.id,
      selectedSection,
      localSections,
      handleRefresh,
    ]
  );

  const handleDeleteSection = useCallback(async () => {
    if (!selectedSection || !window.confirm('Supprimer cette section ?')) return;
    await deleteSection(selectedDomain.id, selectedChapter.id, selectedSection.id);
    handleBackContent();
  }, [selectedDomain?.id, selectedChapter?.id, selectedSection?.id, handleBackContent]);

  const currentChapterFromDomains = useMemo(() => {
    if (!selectedDomain || !selectedChapter) return null;
    const ch = localDomains
      .find((d) => d.id === selectedDomain.id)
      ?.chapters?.find((c) => c.id === selectedChapter.id);
    return ch || selectedChapter;
  }, [localDomains, selectedDomain, selectedChapter]);

  return (
    <div className="px-4 md:px-6 lg:px-8 pt-1 pb-6 max-w-6xl mx-auto">
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
        Bibliothèque
      </h1>

      {/* Édition chapitre */}
      {editingChapter && selectedChapter && selectedDomain && (
        <DocumentEditor
          title={currentChapterFromDomains?.title}
          content={currentChapterFromDomains?.content ?? ''}
          onSave={handleSaveChapter}
          onBack={handleBackContent}
          saveLabel="Enregistrer le chapitre"
          titlePlaceholder="ex: Chap 1. Les Fondements"
          showDelete={false}
        />
      )}

      {/* Édition section (ou nouvelle section) */}
      {(editingSection || isCreatingSection) && selectedDomain && selectedChapter && (
        <DocumentEditor
          title={selectedSection?.title}
          content={selectedSection?.content ?? ''}
          onSave={handleSaveSection}
          onDelete={selectedSection ? handleDeleteSection : undefined}
          onBack={handleBackContent}
          saveLabel={selectedSection ? 'Enregistrer la section' : 'Créer la section'}
          deleteLabel="Supprimer la section"
          titlePlaceholder="ex: Part 1. Introduction"
          showDelete={!!selectedSection}
        />
      )}

      {/* Vue lecture section */}
      {selectedSection && !editingSection && !isCreatingSection && !editingChapter && (
        <div className="space-y-6">
          <div className="flex justify-between items-start">
            <button
              type="button"
              onClick={() => setSelectedSection(null)}
              className="text-[var(--om-accent)] hover:underline font-medium"
            >
              ← Retour aux sections
            </button>
          </div>
          <div className="om-card p-6 md:p-10">
            <MarkdownReadingView
              title={selectedSection.title}
              content={selectedSection.content}
              onEdit={() => setEditingSection(true)}
              editLabel="Modifier cette section"
            />
          </div>
        </div>
      )}

      {/* Vue principale : liste domaines / chapitres + contenu chapitre (lecture) ou liste sections */}
      {!selectedSection && !editingSection && !isCreatingSection && !editingChapter && (
        <div className="flex flex-col lg:flex-row gap-6">
          <aside className="lg:w-56 flex-shrink-0 space-y-6">
            <DomainList
              domains={localDomains}
              selectedId={selectedDomain?.id}
              onSelect={(d) => {
                setSelectedDomain(d);
                setSelectedChapter(null);
              }}
              onCreate={() => {}}
              onRefresh={handleRefresh}
            />
            {selectedDomain && (
              <ChapterList
                chapters={chapters}
                domainId={selectedDomain.id}
                selectedId={selectedChapter?.id}
                onSelect={(c) => setSelectedChapter(c)}
                onCreate={() => {}}
                onRefresh={handleRefresh}
              />
            )}
          </aside>
          <main className="flex-1 min-w-0">
            {!selectedChapter ? (
              <p className="text-[var(--om-muted)] py-12 text-center">
                Sélectionnez un domaine puis un chapitre pour lire ou éditer le contenu.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
                  <div className="flex gap-2 items-center">
                    <span className="text-sm text-[var(--om-muted)]">Filtrer :</span>
                    <select
                      value={filterSort}
                      onChange={(e) => handleFilterChange(e.target.value, filterOrder)}
                      className="px-3 py-2 rounded-[10px] border border-[var(--om-line)] text-sm text-[var(--om-text)] bg-[var(--om-surface)]"
                    >
                      {FILTER_SORT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() =>
                        handleFilterChange(filterSort, filterOrder === 'asc' ? 'desc' : 'asc')
                      }
                      className="px-3 py-2 rounded-[10px] border border-[var(--om-line)] text-sm text-[var(--om-text)] bg-[var(--om-surface)] hover:bg-[var(--om-surface-2)]"
                      title={filterOrder === 'asc' ? 'Croissant' : 'Décroissant'}
                    >
                      {filterOrder === 'asc' ? '↑' : '↓'}
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingChapter(true)}
                      className="px-4 py-2 rounded-2xl border border-[var(--om-accent)] text-[var(--om-accent)] text-sm font-medium hover:bg-[var(--om-accent)]/10"
                    >
                      Modifier le chapitre
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCreatingSection(true)}
                      className="px-4 py-2 rounded-2xl bg-[var(--om-accent)] text-[var(--om-on-accent)] text-sm font-medium hover:bg-[var(--om-accent-hover)]"
                    >
                      + Nouvelle section
                    </button>
                  </div>
                </div>

                {/* Contenu du chapitre en lecture + liste des sections */}
                <div className="om-card p-6 md:p-10 mb-8">
                  <MarkdownReadingView
                    title={currentChapterFromDomains?.title}
                    content={currentChapterFromDomains?.content ?? ''}
                    onEdit={() => setEditingChapter(true)}
                    editLabel="Modifier le chapitre"
                  />
                </div>

                <h3 className="text-lg font-medium text-[var(--om-text)] mb-3">
                  Sous-parties (sections)
                </h3>
                {localSections.length === 0 ? (
                  <p className="text-[var(--om-muted)] py-6">
                    Aucune section. Créez-en une avec « + Nouvelle section ».
                  </p>
                ) : (
                  <div className="space-y-2">
                    {localSections.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSelectedSection(s)}
                        className="w-full text-left rounded-2xl border border-[var(--om-line)] bg-[var(--om-surface)] p-4 shadow-[var(--om-shadow)] hover:border-[var(--om-accent)]/50 hover:bg-[var(--om-accent)]/5 transition-all"
                      >
                        <h4 className="font-medium text-[var(--om-text)]">{s.title}</h4>
                        <p className="text-sm text-[var(--om-muted)] truncate mt-0.5">
                          {s.content?.slice(0, 100) || 'Vide'}
                          {s.content && s.content.length > 100 ? '…' : ''}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      )}
    </div>
  );
}

export default Markdown;
