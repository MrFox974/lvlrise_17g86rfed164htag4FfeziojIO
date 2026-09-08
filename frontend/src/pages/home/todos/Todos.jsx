import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { marked } from 'marked';
import { useDemoMode } from '../../../hooks/useDemoMode';
import {
  fetchTodos,
  createTodo,
  createTodoGroup,
  updateTodoProgress,
  deleteTodo,
  renameTodoGroup,
  clearTodoGroup,
} from '../../../utils/todoApi';
import { fetchNotes, fetchNoteByTodo, createNote, updateNote, deleteNote } from '../../../utils/noteApi';
import UpgradeModal from '../../../components/UpgradeModal';
import { Celebration, CelebrationLive } from '../../../components/Celebration';
import { useCelebration } from '../../../hooks/useCelebration';
import { useUpgradeModal, isPlanLimitError } from '../../../hooks/useUpgradeModal';
import {
  fetchDemoTodos,
  createDemoTodo,
  updateDemoTodoProgress,
  deleteDemoTodo,
} from '../../../utils/demoApi';
import RichTextEditor from '../../../components/RichTextEditor';
import { getTagColor } from '../../../lib/tags';
import {
  mergeGroups,
  rememberGroup,
  forgetGroup,
  renameStoredGroup,
  readStoredGroups,
} from '../../../lib/todoGroups';

const TAGS = [
  { id: 'absolue', label: 'Absolue', color: 'bg-[var(--om-tag-absolue)]' },
  { id: 'important', label: 'Important', color: 'bg-[var(--om-tag-important)]' },
  { id: 'à faire', label: 'À faire', color: 'bg-[var(--om-tag-afaire)]' },
  { id: 'idée', label: 'Idée', color: 'bg-[var(--om-tag-idee)]' },
  { id: 'projet', label: 'Projet', color: 'bg-[var(--om-tag-projet)]' },
];

function truncateTodoName(name, maxLength = 35) {
  if (!name) return '';
  return name.length > maxLength ? `${name.slice(0, maxLength)}...` : name;
}

function truncateGroupName(name, maxLength = 10) {
  if (!name) return '';
  return name.length > maxLength ? `${name.slice(0, maxLength)}...` : name;
}

function getTagFillColor(tagId) {
  return getTagColor(tagId);
}

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

// Mapping tactile : doigt 10% → progress 0%, doigt 85% → progress 100%
const TOUCH_START_PCT = 0.1;
const TOUCH_END_PCT = 0.85;

/**
 * Reprise des groupes créés avant qu'ils n'existent côté serveur : ils étaient
 * mémorisés dans le navigateur, on les enregistre pour de bon puis on oublie la
 * copie locale. Sans quoi ils resteraient prisonniers d'un seul appareil.
 */
async function pushLocalGroupsToServer(serverGroups) {
  const stored = readStoredGroups(false).filter((name) => !serverGroups.includes(name));
  if (stored.length === 0) return serverGroups;
  let groups = serverGroups;
  for (const name of stored) {
    try {
      groups = await createTodoGroup(name);
      forgetGroup(false, name);
    } catch {
      // Réseau ou quota : le groupe reste mémorisé localement, on réessaiera.
    }
  }
  return groups;
}

function progressFromTouchX(rect, clientX) {
  const x = clientX - rect.left;
  const pct = x / rect.width;
  const mapped = (pct - TOUCH_START_PCT) / (TOUCH_END_PCT - TOUCH_START_PCT);
  const raw = Math.max(0, Math.min(1, mapped)) * 100;
  return Math.round(raw);
}

function TodoItemRow({
  item,
  onProgressChange,
  isHistorique,
  onDelete,
}) {
  const progress = item.progress;
  const tagColor = getTagFillColor(item.tag);
  const barRef = useRef(null);
  const isDraggingRef = useRef(false);
  const [liveProgress, setLiveProgress] = useState(null);

  const displayProgress = liveProgress ?? progress;

  const updateFromClientX = useCallback((clientX) => {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect) return;
    setLiveProgress(progressFromTouchX(rect, clientX));
  }, []);

  const handleBarPointerDown = useCallback(
    (e) => {
      if (isHistorique) return;
      e.preventDefault();
      if (e.target?.setPointerCapture) e.target.setPointerCapture(e.pointerId);
      isDraggingRef.current = true;
      const clientX = e.clientX ?? e.touches?.[0]?.clientX;
      updateFromClientX(clientX);
    },
    [isHistorique, updateFromClientX]
  );

  const handleBarPointerMove = useCallback(
    (e) => {
      if (isHistorique || !isDraggingRef.current) return;
      const clientX = e.clientX ?? e.touches?.[0]?.clientX;
      updateFromClientX(clientX);
    },
    [isHistorique, updateFromClientX]
  );

  const handleBarPointerUp = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    const final = liveProgress ?? progress;
    setLiveProgress(null);
    if (final !== progress) onProgressChange(item, final);
  }, [liveProgress, progress, item, onProgressChange]);

  const liveProgressRef = useRef(null);
  useEffect(() => {
    liveProgressRef.current = liveProgress;
  }, [liveProgress]);

  useEffect(() => {
    const up = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        const final = liveProgressRef.current ?? progress;
        setLiveProgress(null);
        if (final !== progress) onProgressChange(item, final);
      }
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('touchend', up);
    return () => {
      window.removeEventListener('pointerup', up);
      window.removeEventListener('touchend', up);
    };
  }, [progress, item, onProgressChange]);

  if (isHistorique) {
    return (
      <HistoriqueItemRow
        item={item}
        tagColor={tagColor}
        onDelete={onDelete}
      />
    );
  }

  return (
    <div
      data-todo-row
      className="flex items-center gap-0 rounded-full border overflow-hidden transition-all duration-300 bg-[var(--om-surface)] border-[var(--om-line)]"
    >
      <div
        className="w-2 flex-shrink-0 self-stretch rounded-l"
        style={{ backgroundColor: tagColor }}
      />
      <div
        ref={barRef}
        className="flex-1 min-w-0 py-6 relative touch-manipulation select-none cursor-pointer"
        style={{ touchAction: 'none' }}
        onPointerDown={handleBarPointerDown}
        onPointerMove={handleBarPointerMove}
        onPointerUp={handleBarPointerUp}
        onPointerLeave={handleBarPointerUp}
        onTouchStart={handleBarPointerDown}
        onTouchMove={handleBarPointerMove}
        onTouchEnd={handleBarPointerUp}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-r-full"
          style={{
            width: `${displayProgress}%`,
            backgroundColor: tagColor,
          }}
        />
        <div
          className="todo-progress-overlay todo-progress-overlay-left"
          style={{ '--progress-pct': `${displayProgress}%` }}
        >
          <div className="todo-progress-text-row">
            <span
              className={`todo-progress-text todo-progress-text--overlay ${
                displayProgress >= 100 ? 'line-through' : ''
              }`}
            >
              {truncateTodoName(item.name)}
            </span>
            <span className="todo-progress-text todo-progress-text--overlay tabular-nums">
              {displayProgress}%
            </span>
          </div>
        </div>
        <div
          className="todo-progress-overlay todo-progress-overlay-right"
          style={{ '--progress-pct': `${displayProgress}%` }}
        >
          <div className="todo-progress-text-row">
            <span
              className={`todo-progress-text ${
                displayProgress >= 100
                  ? 'line-through text-[var(--om-muted)]'
                  : 'text-[var(--om-text)]'
              }`}
            >
              {truncateTodoName(item.name)}
            </span>
            <span className="todo-progress-text tabular-nums text-[var(--om-muted)]">
              {displayProgress}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function HistoriqueItemRow({ item, tagColor, onDelete }) {
  const [swipeX, setSwipeX] = useState(0);
  const startXRef = useRef(0);
  const isDraggingRef = useRef(false);

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
    setSwipeX((prev) => {
      if (prev < -70) onDelete?.(item);
      return 0;
    });
  }, [item, onDelete]);

  return (
    <div
      className="relative overflow-hidden rounded-full"
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
        data-todo-row
        className={`relative z-10 flex items-center gap-0 rounded-full border overflow-hidden transition-transform duration-200 border-[var(--om-line)] bg-[var(--om-surface)] ${
          swipeX < -40 ? 'border-[var(--om-danger)]/50' : ''
        }`}
        style={{ transform: `translateX(${swipeX}px)` }}
      >
        <div
          className="w-2 flex-shrink-0 self-stretch rounded-l"
          style={{ backgroundColor: tagColor }}
        />
        <div className="flex-1 min-w-0 py-3 md:py-3.5 relative">
          <div
            className="absolute inset-y-0 left-0 right-0 rounded-r-full transition-all duration-200"
            style={{ width: '100%', backgroundColor: tagColor }}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 z-10 text-xs font-medium tabular-nums text-[var(--om-muted)]">
            100%
          </span>
          <span className="relative z-10 font-medium pl-3 line-through text-[var(--om-text)]/80">
            {truncateTodoName(item.name)}
          </span>
        </div>
      </div>
    </div>
  );
}

function TodosContent() {
  const { showUpgradeModal, hideUpgradeModal, upgradeModalProps } = useUpgradeModal();
  const { celebration, celebrate } = useCelebration();
  const isDemo = useDemoMode();
  const [active, setActive] = useState([]);
  const [historique, setHistorique] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newTag, setNewTag] = useState('à faire');
  const [adding, setAdding] = useState(false);
  const [completingId, setCompletingId] = useState(null);
  const [groups, setGroups] = useState(() => mergeGroups(isDemo, []));
  const [activeGroupName, setActiveGroupName] = useState('Main');
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [isEditGroupModalOpen, setIsEditGroupModalOpen] = useState(false);
  const [editGroupOriginalName, setEditGroupOriginalName] = useState('');
  const [editGroupName, setEditGroupName] = useState('');
  const [todoNotesById, setTodoNotesById] = useState({});
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [noteModalTodo, setNoteModalTodo] = useState(null);
  const [noteModalNote, setNoteModalNote] = useState(null);
  const [noteModalLoading, setNoteModalLoading] = useState(false);
  const navigate = useNavigate();
  const [isCompletionModalOpen, setIsCompletionModalOpen] = useState(false);
  const [completionModalTodo, setCompletionModalTodo] = useState(null);
  const [completionPrevProgress, setCompletionPrevProgress] = useState(0);
  const [completionNewProgress, setCompletionNewProgress] = useState(0);

  const loadTodos = useCallback(
    (signal) => {
      const fetchFn = isDemo ? fetchDemoTodos : fetchTodos;
      return fetchFn({ signal })
        .then(async (res) => {
          const a = res?.active ?? [];
          const h = res?.historique ?? [];
          if (!signal?.aborted) {
            const safeActive = Array.isArray(a) ? a : [];
            const safeHistorique = Array.isArray(h) ? h : [];
            setActive(safeActive);
            setHistorique(safeHistorique);

            // Les groupes viennent du serveur : ils survivent au fait d'être
            // vides et suivent l'utilisateur d'un appareil à l'autre. Ceux
            // déduits des tâches restent pris en compte par sécurité.
            let serverGroups = Array.isArray(res?.groups) ? res.groups : [];
            if (!isDemo) {
              serverGroups = await pushLocalGroupsToServer(serverGroups);
            }

            const uniqueGroups = new Set(['Main', ...serverGroups]);
            safeActive.forEach((item) => {
              if (item.group_name && typeof item.group_name === 'string') {
                uniqueGroups.add(item.group_name);
              }
            });
            safeHistorique.forEach((item) => {
              if (item.group_name && typeof item.group_name === 'string') {
                uniqueGroups.add(item.group_name);
              }
            });
            if (!signal?.aborted) setGroups(mergeGroups(isDemo, Array.from(uniqueGroups)));
          }
        })
        .catch((err) => {
          if (err?.name === 'AbortError' || err?.code === 'ERR_CANCELED') return;
          if (!signal?.aborted) {
            setActive([]);
            setHistorique([]);
          }
        })
        .finally(() => {
          if (!signal?.aborted) setLoading(false);
        });
    },
    [isDemo]
  );

  const loadLinkedNotes = useCallback(async () => {
    try {
      const notes = await fetchNotes();
      const map = {};
      notes.forEach((note) => {
        if (note.todo_item_id) {
          map[note.todo_item_id] = note;
        }
      });
      setTodoNotesById(map);
    } catch {
      // On ignore silencieusement les erreurs de chargement des notes pour ne pas casser la to do
    }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    loadTodos(ac.signal);
    loadLinkedNotes();
    return () => ac.abort();
  }, [loadTodos, loadLinkedNotes]);

  const updateProgress = isDemo ? updateDemoTodoProgress : updateTodoProgress;
  const deleteTodoFn = isDemo ? deleteDemoTodo : deleteTodo;
  const createTodoFn = isDemo ? createDemoTodo : createTodo;

  const handleProgressChange = useCallback(
    async (item, progress) => {
      const prev = item.progress;
      if (item.completed_at) return;

      if (progress >= 100) {
        setCompletionModalTodo(item);
        setCompletionPrevProgress(prev);
        setCompletionNewProgress(progress);
        setIsCompletionModalOpen(true);
        setActive((list) =>
          list.map((x) => (x.id === item.id ? { ...x, progress } : x))
        );
        return;
      }

      setActive((list) =>
        list.map((x) => (x.id === item.id ? { ...x, progress } : x))
      );

      try {
        await updateProgress(item.id, progress);
      } catch {
        setActive((list) =>
          list.map((x) => (x.id === item.id ? { ...x, progress: prev } : x))
        );
      }
    },
    [updateProgress]
  );

  const handleConfirmCompletion = useCallback(async () => {
    if (!completionModalTodo) return;

    const item = completionModalTodo;
    const progress = completionNewProgress || 100;
    const prev = completionPrevProgress;

    setIsCompletionModalOpen(false);
    setCompletionModalTodo(null);
    setCompletionPrevProgress(0);
    setCompletionNewProgress(0);

    setCompletingId(item.id);
    setActive((list) => list.filter((x) => x.id !== item.id));

    try {
      const res = await updateProgress(item.id, progress);
      // Le groupe de la tâche est conservé : sans lui, elle retomberait dans
      // l'historique du groupe « Main » au lieu du sien.
      setHistorique((h) => [
        {
          ...item,
          ...res,
          group_name: res.group_name || item.group_name || activeGroupName,
          completed_at: res.completed_at || new Date().toISOString(),
        },
        ...h,
      ]);
      // Une tâche bouclée est un vrai jalon : rafale large.
      celebrate(progress >= 100 ? 'Tâche terminée' : `Avancée · ${progress} %`, {
        full: progress >= 100,
      });
    } catch {
      setActive((list) => [...list, { ...item, progress: prev }]);
    } finally {
      setCompletingId(null);
    }
  }, [completionModalTodo, completionNewProgress, completionPrevProgress, updateProgress, celebrate, activeGroupName]);

  const handleCancelCompletion = useCallback(() => {
    if (!completionModalTodo) return;

    const item = completionModalTodo;
    const prev = completionPrevProgress;

    setIsCompletionModalOpen(false);
    setCompletionModalTodo(null);
    setCompletionPrevProgress(0);
    setCompletionNewProgress(0);

    setActive((list) =>
      list.map((x) => (x.id === item.id ? { ...x, progress: prev } : x))
    );
  }, [completionModalTodo, completionPrevProgress]);

  const handleDeleteHistorique = useCallback(
    async (item) => {
      setHistorique((h) => h.filter((x) => x.id !== item.id));
      try {
        await deleteTodoFn(item.id);
      } catch {
        setHistorique((h) => [{ ...item, completed_at: item.completed_at }, ...h]);
      }
    },
    [deleteTodoFn]
  );

  const handleOpenNoteModal = useCallback(
    async (todo) => {
      setNoteModalTodo(todo);
      setIsNoteModalOpen(true);

      const localExisting = todoNotesById[todo.id];
      if (localExisting) {
        setNoteModalLoading(false);
        setNoteModalNote(localExisting);
        return;
      }

      setNoteModalLoading(true);
      try {
        const existing = await fetchNoteByTodo(todo.id);
        if (existing) {
          setNoteModalNote(existing);
          setTodoNotesById((prev) => ({
            ...prev,
            [todo.id]: existing,
          }));
        } else {
          setNoteModalNote({
            id: null,
            title: todo.name,
            content: '',
            todo_item_id: todo.id,
          });
        }
      } catch {
        setNoteModalNote({
          id: null,
          title: todo.name,
          content: '',
          todo_item_id: todo.id,
        });
      } finally {
        setNoteModalLoading(false);
      }
    },
    [todoNotesById]
  );

  const handleCloseNoteModal = useCallback(() => {
    setIsNoteModalOpen(false);
    setNoteModalTodo(null);
    setNoteModalNote(null);
    setNoteModalLoading(false);
  }, []);

  const handleSaveNoteFromTodo = useCallback(
    async ({ id, title, content, todoId }) => {
      let saved;
      if (id) {
        saved = await updateNote(id, { title, content });
      } else {
        saved = await createNote(title, content, todoId);
      }
      setTodoNotesById((prev) => ({
        ...prev,
        [todoId]: saved,
      }));
      handleCloseNoteModal();
    },
    [handleCloseNoteModal]
  );

  const handleDeleteNoteFromTodo = useCallback(
    async (note) => {
      if (!note?.id) return;
      try {
        await deleteNote(note.id);
        setTodoNotesById((prev) => {
          const next = { ...prev };
          if (note.todo_item_id) {
            delete next[note.todo_item_id];
          }
          return next;
        });
        handleCloseNoteModal();
      } catch {
        // On ignore l'erreur ici pour ne pas bloquer l'UI
      }
    },
    [handleCloseNoteModal]
  );

  const handleAdd = useCallback(
    async () => {
      const name = newName.trim();
      if (!name || adding) return;
      setAdding(true);
      setNewName('');
      try {
        const created = await createTodoFn(name, newTag, activeGroupName);
        setActive((list) => [...list, created]);
        setGroups((prev) =>
          prev.includes(created.group_name || activeGroupName)
            ? prev
            : [...prev, created.group_name || activeGroupName]
        );
      } catch (error) {
        const limitError = isPlanLimitError(error);
        if (limitError) {
          showUpgradeModal(limitError.restriction, limitError.featureName || 'tâches');
        } else {
          setNewName(name);
        }
      } finally {
        setAdding(false);
      }
    },
    [newName, newTag, adding, createTodoFn, showUpgradeModal, activeGroupName]
  );

  const handleOpenGroupModal = useCallback(() => {
    setNewGroupName('');
    setIsGroupModalOpen(true);
  }, []);

  const handleCloseGroupModal = useCallback(() => {
    setIsGroupModalOpen(false);
    setNewGroupName('');
  }, []);

  const handleCreateGroup = useCallback(async () => {
    const name = newGroupName.trim();
    if (!name) return;

    setGroups((prev) => (prev.includes(name) ? prev : [...prev, name]));
    setActiveGroupName(name);
    setNewGroupName('');
    setIsGroupModalOpen(false);

    if (isDemo) {
      // Pas de serveur en démo : le groupe vit dans le navigateur.
      rememberGroup(isDemo, name);
      return;
    }

    try {
      // Le groupe existe pour lui-même : il reste visible sans aucune tâche.
      const groups = await createTodoGroup(name);
      if (groups.length) setGroups(mergeGroups(isDemo, groups));
    } catch {
      // Enregistrement impossible : on le garde localement pour ne pas perdre
      // le groupe que l'utilisateur vient de créer, et il sera repoussé au
      // prochain chargement.
      rememberGroup(isDemo, name);
    }
  }, [newGroupName, isDemo]);

  const handleOpenEditGroupModal = useCallback(
    (groupName) => {
      if (groupName === 'Main') return;
      setEditGroupOriginalName(groupName);
      setEditGroupName(groupName);
      setIsEditGroupModalOpen(true);
    },
    []
  );

  const handleCloseEditGroupModal = useCallback(() => {
    setIsEditGroupModalOpen(false);
    setEditGroupOriginalName('');
    setEditGroupName('');
  }, []);

  const handleRenameGroup = useCallback(async () => {
    const fromName = editGroupOriginalName.trim();
    const toName = editGroupName.trim();
    if (!fromName || !toName || fromName === 'Main') return;

    try {
      if (!isDemo) {
        await renameTodoGroup(fromName, toName);
      }

      setActive((list) =>
        list.map((item) =>
          (item.group_name || 'Main') === fromName
            ? { ...item, group_name: toName }
            : item
        )
      );
      setHistorique((list) =>
        list.map((item) =>
          (item.group_name || 'Main') === fromName
            ? { ...item, group_name: toName }
            : item
        )
      );
      renameStoredGroup(isDemo, fromName, toName);
      setGroups((prev) => {
        const withoutFrom = prev.filter((g) => g !== fromName);
        return withoutFrom.includes(toName) ? withoutFrom : [...withoutFrom, toName];
      });
      setActiveGroupName(toName);
      handleCloseEditGroupModal();
    } catch (error) {
      console.error('Erreur lors du renommage du groupe de tâches:', error);
    }
  }, [editGroupOriginalName, editGroupName, isDemo, handleCloseEditGroupModal]);

  const handleDeleteGroup = useCallback(async () => {
    const groupName = editGroupOriginalName.trim();
    if (!groupName || groupName === 'Main') return;

    try {
      if (!isDemo) {
        await clearTodoGroup(groupName);
      }

      setActive((list) =>
        list.map((item) =>
          (item.group_name || 'Main') === groupName
            ? { ...item, group_name: 'Main' }
            : item
        )
      );
      setHistorique((list) =>
        list.map((item) =>
          (item.group_name || 'Main') === groupName
            ? { ...item, group_name: 'Main' }
            : item
        )
      );
      forgetGroup(isDemo, groupName);
      setGroups((prev) => {
        const remaining = prev.filter((g) => g !== groupName);
        return remaining.length ? remaining : ['Main'];
      });
      setActiveGroupName('Main');
      handleCloseEditGroupModal();
    } catch (error) {
      console.error('Erreur lors de la suppression du groupe de tâches:', error);
    }
  }, [editGroupOriginalName, isDemo, handleCloseEditGroupModal]);

  const filteredActive = active.filter((item) => {
    const groupName = item.group_name || 'Main';
    return groupName === activeGroupName;
  });

  const filteredHistorique = historique.filter((item) => {
    const groupName = item.group_name || 'Main';
    return groupName === activeGroupName;
  });

  if (loading) {
    return (
      <div className="p-9 animate-pulse">
        <div className="h-9 bg-[var(--om-track)] rounded w-53 mx-auto mb-7" />
        <div className="space-y-3.5 max-w-2xl mx-auto">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-18 bg-[var(--om-track)] rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 md:px-6 lg:px-8 pt-1 pb-6 w-full max-w-2xl md:max-w-3xl mx-auto relative">
      <Celebration celebration={celebration} anchor="screen" />
      <CelebrationLive celebration={celebration} />
      <div className="flex flex-col mb-3.5">
        <h1 className="text-[17px] md:text-[19px] font-medium tracking-[-0.01em] text-[var(--om-text)]">
          To do list
        </h1>
        <span className="om-kicker">Ce qui compte, dans l&apos;ordre</span>
      </div>

      <div className="mb-6 md:mb-5 flex items-center justify-start">
        <div className="flex flex-wrap gap-2.5">
          {groups.map((groupName) => (
            <button
              key={groupName}
              type="button"
              onClick={() => {
                if (groupName === activeGroupName && groupName !== 'Main') {
                  handleOpenEditGroupModal(groupName);
                } else {
                  setActiveGroupName(groupName);
                }
              }}
              className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors max-w-[9rem] overflow-hidden ${
                activeGroupName === groupName
                  ? 'bg-[var(--om-accent)] border-[var(--om-accent)] text-[var(--om-on-accent)]'
                  : 'bg-[var(--om-surface)] border-[var(--om-line)] text-[var(--om-muted)] hover:border-[var(--om-accent)]'
              }`}
            >
              <span className="block text-ellipsis whitespace-nowrap">
                {truncateGroupName(groupName)}
              </span>
            </button>
          ))}
          <button
            type="button"
            onClick={handleOpenGroupModal}
            className="w-9 h-9 rounded-full border border-dashed border-[var(--om-line)] text-[var(--om-muted)] flex items-center justify-center text-lg hover:border-[var(--om-accent)] hover:text-[var(--om-accent)] bg-[var(--om-surface)]"
          >
            +
          </button>
        </div>
      </div>

      <div className="space-y-2.5 md:space-y-2.5 mb-7 md:mb-5">
        {filteredActive.map((item) => (
          <div
            key={item.id}
            className={`flex items-center gap-3 transition-all duration-500 ease-out ${
              completingId === item.id ? 'opacity-0 scale-95 -translate-y-4' : ''
            }`}
          >
            <div className="flex-1 min-w-0">
              <TodoItemRow
                item={item}
                onProgressChange={handleProgressChange}
                isHistorique={false}
              />
            </div>
            <button
              type="button"
              onClick={() => handleOpenNoteModal(item)}
              className="flex-shrink-0 flex items-center justify-center rounded-full w-8 h-8 bg-[var(--om-surface)] hover:bg-[var(--om-surface-2)]"
              aria-label="Ouvrir la note liée"
            >
              <span
                className={`flex items-center justify-center rounded-full w-7 h-7 text-sm font-medium ${
                  todoNotesById[item.id]
                    ? 'text-[var(--om-on-accent)]'
                    : 'text-[var(--om-muted)] border border-[var(--om-line)] bg-[var(--om-surface)]'
                }`}
                style={
                  todoNotesById[item.id]
                    ? { backgroundColor: getTagFillColor(item.tag) }
                    : undefined
                }
              >
                <svg
                  className="w-5 h-5"
                  viewBox="0 -0.5 25 25"
                  fill="currentColor"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M11.1828 7.68276C10.8899 7.97566 10.8899 8.45053 11.1828 8.74342C11.4756 9.03632 11.9505 9.03632 12.2434 8.74342L11.1828 7.68276ZM13.9851 5.94109L14.5154 6.47142V6.47142L13.9851 5.94109ZM18.5291 5.94109L17.9988 6.47142L18.5291 5.94109ZM18.5291 10.4851L17.9988 9.95476L18.5291 10.4851ZM15.7268 12.2268C15.4339 12.5197 15.4339 12.9945 15.7268 13.2874C16.0196 13.5803 16.4945 13.5803 16.7874 13.2874L15.7268 12.2268ZM13.7583 16.3185C14.0513 16.0257 14.0514 15.5508 13.7585 15.2579C13.4657 14.9649 12.9908 14.9648 12.6979 15.2576L13.7583 16.3185ZM10.9561 18.0591L11.4797 18.5961L11.4863 18.5895L10.9561 18.0591ZM6.44132 18.0309L5.91104 18.5612H5.91104L6.44132 18.0309ZM6.41208 13.5161L5.88171 12.9857L5.87499 12.9926L6.41208 13.5161ZM9.21441 11.7744C9.50731 11.4815 9.50731 11.0067 9.21441 10.7138C8.92152 10.4209 8.44665 10.4209 8.15375 10.7138L9.21441 11.7744ZM15.2744 10.2574C15.5673 9.96453 15.5673 9.48966 15.2744 9.19676C14.9815 8.90387 14.5066 8.90387 14.2138 9.19676L15.2744 10.2574ZM9.66975 13.7408C9.37686 14.0337 9.37686 14.5085 9.66975 14.8014C9.96265 15.0943 10.4375 15.0943 10.7304 14.8014L9.66975 13.7408ZM12.2434 8.74342L14.5154 6.47142L13.4548 5.41076L11.1828 7.68276L12.2434 8.74342ZM14.5154 6.47142C15.4773 5.50953 17.0369 5.50953 17.9988 6.47142L19.0594 5.41076C17.5117 3.86308 15.0024 3.86308 13.4548 5.41076L14.5154 6.47142ZM17.9988 6.47142C18.9607 7.43332 18.9607 8.99287 17.9988 9.95476L19.0594 11.0154C20.6071 9.46774 20.6071 6.95845 19.0594 5.41076L17.9988 6.47142ZM17.9988 9.95476L15.7268 12.2268L16.7874 13.2874L19.0594 11.0154L17.9988 9.95476ZM12.6979 15.2576L10.4259 17.5286L11.4863 18.5895L13.7583 16.3185L12.6979 15.2576ZM10.4325 17.5221C9.46732 18.4632 7.92491 18.4536 6.97159 17.5005L5.91104 18.5612C7.44495 20.0948 9.92671 20.1103 11.4797 18.5961L10.4325 17.5221ZM6.97159 17.5005C6.01827 16.5474 6.00828 15.0049 6.94918 14.0396L5.87499 12.9926C4.36107 14.5459 4.37714 17.0277 5.91104 18.5612L6.97159 17.5005ZM6.94241 14.0464L9.21441 11.7744L8.15375 10.7138L5.88175 12.9858L6.94241 14.0464ZM14.2138 9.19676L9.66975 13.7408L10.7304 14.8014L15.2744 10.2574L14.2138 9.19676Z" />
                </svg>
              </span>
            </button>
          </div>
        ))}
      </div>

      <div className="mt-7 md:mt-5 pt-5 md:pt-4 border-t border-[var(--om-line)]">
        <div className="flex flex-col gap-2.5">
          <div className="flex gap-2.5">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="Nouvelle tâche..."
              className="flex-1 min-w-0 px-4 py-2.5 rounded-[10px] border border-[var(--om-line)] bg-[var(--om-surface-2)] text-base"
            />
            <select
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              className="shrink-0 px-4 py-2.5 rounded-[10px] border border-[var(--om-line)] bg-[var(--om-surface)] text-base"
            >
              {TAGS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={adding || !newName.trim()}
            className="w-full px-5 py-2.5 rounded-[10px] bg-[var(--om-accent)] text-[var(--om-on-accent)] text-base font-medium disabled:opacity-50"
          >
            {adding ? '…' : 'Ajouter'}
          </button>
        </div>
      </div>

      <div className="mt-6 pt-5 border-t border-[var(--om-line)]">
        <h2 className="text-sm md:text-sm font-medium text-[var(--om-muted)] mb-2.5 md:mb-2.5">
          Historique
        </h2>
        <div className="space-y-2.5">
          {filteredHistorique.map((item) => (
            <TodoItemRow
              key={item.id}
              item={{ ...item, progress: 100 }}
              onProgressChange={() => {}}
              isHistorique
              onDelete={handleDeleteHistorique}
            />
          ))}
        </div>
      </div>
      <UpgradeModal
        isOpen={upgradeModalProps.isOpen}
        onClose={hideUpgradeModal}
        restriction={upgradeModalProps.restriction}
        featureName={upgradeModalProps.featureName}
      />

      {isCompletionModalOpen && completionModalTodo && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-[var(--om-scrim-solid)]/30 animate-brain-backdrop">
          <div className="bg-[var(--om-surface)] rounded-2xl shadow-[var(--om-shadow)] w-full max-w-sm mx-4 p-5 animate-brain-modal">
            <h2 className="text-base font-medium text-[var(--om-text)] mb-3 text-center">
              Félicitation vous avez accomplis une tâche
            </h2>
            <p className="text-xs text-[var(--om-muted)] mb-4 text-center">
              "{truncateTodoName(completionModalTodo.name, 60)}"
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCancelCompletion}
                className="px-3 py-2 text-xs font-medium text-[var(--om-muted)] rounded-[10px] hover:bg-[var(--om-surface-2)]"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmCompletion}
                className="px-4 py-2 text-xs font-medium rounded-[10px] bg-[var(--om-accent)] text-[var(--om-on-accent)]"
              >
                Continuer
              </button>
            </div>
          </div>
        </div>
      )}

      {isNoteModalOpen && (
        <TodoNoteModal
          todo={noteModalTodo}
          note={noteModalNote}
          loading={noteModalLoading}
          onClose={handleCloseNoteModal}
          onSave={handleSaveNoteFromTodo}
          onDelete={handleDeleteNoteFromTodo}
        />
      )}

      {isGroupModalOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-[var(--om-scrim-solid)]/30 animate-brain-backdrop">
          <div className="bg-[var(--om-surface)] rounded-2xl shadow-[var(--om-shadow)] w-full max-w-sm mx-4 p-5 animate-brain-modal">
            <h2 className="text-base font-medium text-[var(--om-text)] mb-3">
              Nouveau groupe de tâches
            </h2>
            <p className="text-xs text-[var(--om-muted)] mb-4">
              Donnez un nom à votre liste (par ex. &laquo;&nbsp;Travail&nbsp;&raquo;, &laquo;&nbsp;Études&nbsp;&raquo;).
            </p>
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleCreateGroup();
                }
                if (e.key === 'Escape') {
                  e.preventDefault();
                  handleCloseGroupModal();
                }
              }}
              placeholder="Nom du groupe"
              className="w-full px-3 py-2 rounded-[10px] border border-[var(--om-line)] bg-[var(--om-surface-2)] text-sm mb-4 focus-visible:outline-none focus-visible:border-[var(--om-accent)] focus-visible:ring-2 focus-visible:ring-[var(--om-accent)]/40 transition-colors"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCloseGroupModal}
                className="px-3 py-2 text-xs font-medium text-[var(--om-muted)] rounded-[10px] hover:bg-[var(--om-surface-2)]"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleCreateGroup}
                disabled={!newGroupName.trim()}
                className="px-4 py-2 text-xs font-medium rounded-[10px] bg-[var(--om-accent)] text-[var(--om-on-accent)] disabled:opacity-50"
              >
                Créer
              </button>
            </div>
          </div>
        </div>
      )}

      {isEditGroupModalOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-[var(--om-scrim-solid)]/30 animate-brain-backdrop">
          <div className="bg-[var(--om-surface)] rounded-2xl shadow-[var(--om-shadow)] w-full max-w-sm mx-4 p-5 animate-brain-modal">
            <h2 className="text-base font-medium text-[var(--om-text)] mb-3">
              Modifier le groupe
            </h2>
            <p className="text-xs text-[var(--om-muted)] mb-4">
              Renommez votre groupe ou réaffectez toutes ses tâches dans <span className="font-medium">Main</span>.
            </p>
            <input
              type="text"
              value={editGroupName}
              onChange={(e) => setEditGroupName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleRenameGroup();
                }
                if (e.key === 'Escape') {
                  e.preventDefault();
                  handleCloseEditGroupModal();
                }
              }}
              placeholder="Nom du groupe"
              className="w-full px-3 py-2 rounded-[10px] border border-[var(--om-line)] bg-[var(--om-surface-2)] text-sm mb-4 focus-visible:outline-none focus-visible:border-[var(--om-accent)] focus-visible:ring-2 focus-visible:ring-[var(--om-accent)]/40 transition-colors"
            />
            <div className="flex justify-between gap-2">
              <button
                type="button"
                onClick={handleDeleteGroup}
                className="px-3 py-2 text-xs font-medium rounded-[10px] text-[var(--om-danger)] hover:bg-[var(--om-danger-soft)]"
              >
                Supprimer le groupe
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCloseEditGroupModal}
                  className="px-3 py-2 text-xs font-medium text-[var(--om-muted)] rounded-[10px] hover:bg-[var(--om-surface-2)]"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleRenameGroup}
                  disabled={!editGroupName.trim()}
                  className="px-4 py-2 text-xs font-medium rounded-[10px] bg-[var(--om-accent)] text-[var(--om-on-accent)] disabled:opacity-50"
                >
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TodoNoteModal({ todo, note, loading, onClose, onSave, onDelete }) {
  const [title, setTitle] = useState(note?.title || todo?.name || '');
  const [content, setContent] = useState(note?.content || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [isEditingExisting, setIsEditingExisting] = useState(!note?.id);

  useEffect(() => {
    setTitle(note?.title || todo?.name || '');
    setContent(note?.content || '');
    setIsEditingExisting(!note?.id);
  }, [note?.id, todo?.id]);

  const handleSaveClick = useCallback(async () => {
    if (!title.trim()) {
      setError('Le titre est requis');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave({
        id: note?.id || null,
        title,
        content,
        todoId: todo.id,
      });
    } catch (err) {
      setError(err?.response?.data?.error || 'Erreur lors de la sauvegarde de la note');
    } finally {
      setSaving(false);
    }
  }, [note?.id, title, content, todo, onSave]);

  if (!todo) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[var(--om-scrim-solid)]/40 px-4">
      <div
        className={`bg-[var(--om-surface)] rounded-2xl shadow-[var(--om-shadow-lg)] w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden ${
          note?.id && !isEditingExisting ? 'min-h-[500px]' : 'min-h-[420px]'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--om-line)]">
          <div>
            <p className="text-xs font-medium text-[var(--om-muted)] uppercase tracking-[0.1em] mb-1">
              <span className="flex items-center gap-2">
                <span>Note liée à la tâche</span>
                <span
                  className="inline-flex w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: getTagFillColor(todo.tag) }}
                />
              </span>
            </p>
            <p className="text-sm font-medium text-[var(--om-text)]">
              {truncateTodoName(todo.name, 50)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--om-muted)] hover:text-[var(--om-text)] text-lg font-medium leading-none px-1"
            aria-label="Fermer"
          >
            ×
          </button>
        </div>
        <div className="flex-1 px-5 py-4 space-y-4">
          {loading ? (
            <div className="animate-pulse space-y-3">
              <div className="h-9 bg-[var(--om-track)] rounded-[10px]" />
              <div className="h-40 bg-[var(--om-track)] rounded-2xl" />
            </div>
          ) : (
            <>
              {note?.id && !isEditingExisting ? (
                <div className="space-y-3">
                  <h2 className="text-lg font-medium text-[var(--om-text)]">
                    {title || 'Sans titre'}
                  </h2>
                  <div className="min-h-[260px] max-h-[360px] overflow-y-auto rounded-2xl border border-[var(--om-line)] bg-[var(--om-surface-2)]/40 px-4 py-3">
                    <div
                      className="max-w-3xl text-[var(--om-text)] text-base leading-[1.75] prose-custom [&_h1]:text-2xl [&_h1]:font-medium [&_h1]:mt-4 [&_h1]:mb-3 [&_h2]:text-xl [&_h2]:font-medium [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:text-lg [&_h3]:font-medium [&_h3]:mt-3 [&_h3]:mb-1.5 [&_p]:text-[var(--om-muted)] [&_p]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-3 [&_li]:my-0.5 [&_a]:text-[var(--om-accent)] [&_a]:underline [&_a]:hover:no-underline [&_code]:bg-[var(--om-surface-2)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_pre]:bg-[var(--om-surface-2)] [&_pre]:p-3 [&_pre]:rounded-2xl [&_pre]:overflow-x-auto [&_pre]:my-3 [&_pre[data-type=code-box]]:border [&_pre[data-type=code-box]]:border-[var(--om-accent)] [&_blockquote]:border-l [&_blockquote]:border-[var(--om-accent)] [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-[var(--om-muted)] [&_blockquote]:my-3 [&_blockquote[data-type=note]]:bg-[var(--om-accent-soft)] [&_blockquote[data-type=note]]:border-[var(--om-accent)] [&_blockquote[data-type=note]]:rounded-r-2xl [&_blockquote[data-type=note]]:py-2 [&_blockquote[data-type=note]]:font-normal [&_blockquote[data-type=quote]]:bg-[var(--om-surface-2)] [&_blockquote[data-type=quote]]:border [&_blockquote[data-type=quote]]:border-[var(--om-accent)] [&_blockquote[data-type=quote]]:rounded-2xl [&_blockquote[data-type=quote]]:p-3 [&_mark]:bg-[var(--om-warning-soft)] [&_mark]:px-0.5 [&_mark]:rounded [&_mark]:font-medium note-content"
                      dangerouslySetInnerHTML={{
                        __html: contentToHtml(content),
                      }}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Titre de la note"
                    className="w-full px-4 py-3 rounded-2xl border border-[var(--om-line)] text-[var(--om-text)] text-base font-medium focus:border-[var(--om-accent)] focus:outline-none"
                  />
                  <RichTextEditor
                    key={note?.id ?? todo.id}
                    initialHtml={content}
                    onChange={setContent}
                    placeholder="Rédigez votre note liée à cette tâche…"
                    className="h-[300px]"
                  />
                  {error && <p className="text-sm text-[var(--om-danger)]">{error}</p>}
                </>
              )}
            </>
          )}
        </div>
        {note?.id && !loading && !isEditingExisting ? (
          <div className="px-5 py-4 border-t border-[var(--om-line)] flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => onDelete?.(note)}
              className="px-4 py-2 rounded-2xl border border-[var(--om-danger)] text-[var(--om-danger)] text-sm font-medium hover:bg-[var(--om-danger-soft)]"
            >
              Supprimer
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsEditingExisting(true)}
                className="px-4 py-2 rounded-2xl bg-[var(--om-accent)] text-[var(--om-on-accent)] text-sm font-medium hover:bg-[var(--om-accent-hover)]"
              >
                Éditer
              </button>
            </div>
          </div>
        ) : (
          <div className="px-5 py-4 border-t border-[var(--om-line)] flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-2xl border border-[var(--om-line)] text-[var(--om-muted)] text-sm font-medium hover:bg-[var(--om-surface-2)]"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSaveClick}
              disabled={saving || loading}
              className="px-5 py-2 rounded-2xl bg-[var(--om-accent)] text-[var(--om-on-accent)] text-sm font-medium disabled:opacity-60"
            >
              {saving ? 'Enregistrement...' : 'Enregistrer la note'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Todos() {
  return <TodosContent />;
}

export default Todos;
