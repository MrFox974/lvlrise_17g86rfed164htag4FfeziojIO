import { useState, useCallback, useRef, useEffect } from 'react';
import { useLoaderData, useNavigate } from 'react-router-dom';
import { useDemoMode, useDemoBasePath } from '../../../../hooks/useDemoMode';
import DemoBlockModal from '../../../../components/DemoBlockModal';
import UpgradeModal from '../../../../components/UpgradeModal';
import FilePicker from '../../../../components/FilePicker';
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
  createDomain,
  updateDomain,
  deleteDomain,
  reorderDomains,
  fetchPublicDomains,
  importDomain,
  generateDomainWithAI,
  getDomainGenerationStatus,
  resumeDomainGeneration,
} from '../../../../utils/markdownApi';
import MarkdownReadingView from '../../../../components/MarkdownReadingView';

function DomainItem({ domain, basePath, onDeleteRequest, onEdit, isDragging, editingDomainId }) {
  const navigate = useNavigate();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: domain.id });

  const [swipingDomainId, setSwipingDomainId] = useState(null);
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
      if (e.target.closest('[aria-label="Réordonner"]')) return;
      if (e.target.closest('a')) return; // Ne pas démarrer le swipe si on clique sur le lien
      swipeStartX.current = e.touches ? e.touches[0].clientX : e.clientX;
      setSwipingDomainId(domain.id);
      setSwipeOffset(0);
    },
    [domain.id, isDragging]
  );

  const handleSwipeMove = useCallback(
    (e) => {
      if (swipingDomainId !== domain.id || isDragging) return;
      swipeCurrentX.current = e.touches ? e.touches[0].clientX : e.clientX;
      const diff = swipeStartX.current - swipeCurrentX.current;
      if (diff > 0) {
        setSwipeOffset(Math.min(diff, 100));
      }
    },
    [swipingDomainId, domain.id, isDragging]
  );

  const handleSwipeEnd = useCallback(() => {
    const shouldDelete = swipeOffset > 50 && swipingDomainId === domain.id;
    setSwipingDomainId(null);
    setSwipeOffset(0);
    if (shouldDelete) {
      didSwipeRef.current = true;
      onDeleteRequest(domain.id);
    } else {
      didSwipeRef.current = false;
    }
  }, [swipeOffset, swipingDomainId, domain.id, onDeleteRequest]);

  if (editingDomainId === domain.id) {
    return null; // L'éditeur est affiché séparément
  }

  return (
    <li
      ref={setNodeRef}
      style={{ ...style, touchAction: 'pan-y' }}
      className={`relative overflow-hidden rounded-2xl ${isDragging ? 'opacity-50' : ''}`}
      onTouchStart={handleSwipeStart}
      onTouchMove={handleSwipeMove}
      onTouchEnd={handleSwipeEnd}
      onMouseDown={handleSwipeStart}
      onMouseMove={handleSwipeMove}
      onMouseUp={handleSwipeEnd}
      onMouseLeave={handleSwipeEnd}
    >
      {/* Bouton supprimer derrière - masqué sauf lors du slide */}
      <div
        className="absolute right-0 top-0 bottom-0 flex items-center justify-center bg-[var(--om-danger)] text-[var(--om-on-accent)] px-6 rounded-r-2xl cursor-pointer z-0 transition-transform duration-300 ease-out"
        style={{
          minWidth: '100px',
          transform: `translateX(${swipingDomainId === domain.id && swipeOffset > 0 ? '0' : '100%'})`,
          opacity: swipingDomainId === domain.id && swipeOffset > 0 ? 1 : 0,
          pointerEvents: swipingDomainId === domain.id && swipeOffset > 0 ? 'auto' : 'none',
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDeleteRequest(domain.id);
        }}
      >
        <span className="text-base font-medium">Supprimer</span>
      </div>

      {/* Carte domaine au-dessus */}
      <div
        className="relative z-10 transition-transform duration-300 ease-out bg-[var(--om-surface)] rounded-2xl"
        style={{ transform: `translateX(-${swipingDomainId === domain.id ? swipeOffset : 0}px)` }}
      >
        <div
          role="button"
          tabIndex={0}
          className={`rounded-2xl border overflow-hidden cursor-pointer ${domain.generation_status === 'generating' ? 'domain-generating' : 'border-[var(--om-line)] bg-[var(--om-surface)]'} shadow-[var(--om-shadow)] hover:border-[var(--om-accent)]/50 hover:bg-[var(--om-accent)]/5 transition-all`}
            onClick={(e) => {
              if (e.target.closest('[aria-label="Modifier"]') || e.target.closest('[aria-label="Réordonner"]')) return;
              // Si un swipe de suppression vient d'avoir lieu, on ignore le clic pour éviter d'ouvrir le domaine
              if (didSwipeRef.current) {
                didSwipeRef.current = false;
                return;
              }
              if (swipingDomainId === domain.id && swipeOffset > 0) return;
              navigate(`${basePath}/productivite/markdown/domain/${domain.id}`);
            }}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            if (e.target.closest('[aria-label="Modifier"]') || e.target.closest('[aria-label="Réordonner"]')) return;
            e.preventDefault();
            navigate(`${basePath}/productivite/markdown/domain/${domain.id}`);
          }}
        >
          <div className="p-5">
            <div className="flex justify-between items-start gap-2 min-h-[75px]">
              <div className="min-w-0 flex-1 flex flex-col h-full">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <h2 className="text-lg font-medium text-[var(--om-text)] inline">
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
                  </h2>
                  {domain.generation_status === 'generating' && (
                    <div className="flex-shrink-0 self-center ml-1">
                      <svg
                        className="animate-spin h-5 w-5 text-[var(--om-accent)]"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                    </div>
                  )}
                </div>
                {domain.generation_status === 'generating' ? (
                  <p className="text-base text-[var(--om-accent)] flex-shrink-0 font-medium">
                    Domaine en cours de création...
                  </p>
                ) : domain.description ? (
                  <p className="text-base text-[var(--om-muted)] line-clamp-2 flex-shrink-0">
                    {domain.description.length > 150 
                      ? `${domain.description.substring(0, 150)}...` 
                      : domain.description}
                  </p>
                ) : null}
                {domain.generation_status !== 'generating' && (
                  <p className="text-xs text-[var(--om-muted)] mt-auto">
                    {(domain.chapters?.length ?? 0)} chapitre(s)
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onEdit(domain);
                  }}
                  className="p-2 text-[var(--om-muted)] hover:text-[var(--om-accent)] transition-colors"
                  aria-label="Modifier"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                </button>
                <div
                  className="flex items-center"
                  onPointerDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  onClick={(e) => e.preventDefault()}
                >
                  <div
                    {...attributes}
                    {...listeners}
                    className="p-2 cursor-grab active:cursor-grabbing text-[var(--om-muted)] hover:text-[var(--om-accent)] touch-none flex items-center"
                    aria-label="Réordonner"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 6h2v2H8V6zm0 5h2v2H8v-2zm0 5h2v2H8v-2zm5-10h2v2h-2V6zm0 5h2v2h-2v-2zm0 5h2v2h-2v-2z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}

function MarkdownHome() {
  const navigate = useNavigate();
  const isDemo = useDemoMode();
  const basePath = useDemoBasePath();
  const { domains = [] } = useLoaderData();
  const [localDomains, setLocalDomains] = useState(domains);
  const [showDemoBlockModal, setShowDemoBlockModal] = useState(false);
  const [showChoiceModal, setShowChoiceModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [editingDomain, setEditingDomain] = useState(null);
  const [showParcourirModal, setShowParcourirModal] = useState(false);
  const [parcourirSearch, setParcourirSearch] = useState('');
  const [publicDomains, setPublicDomains] = useState([]);
  const [parcourirLoading, setParcourirLoading] = useState(false);
  const [selectedPublicDomain, setSelectedPublicDomain] = useState(null);
  const [importingDomainId, setImportingDomainId] = useState(null);
  const [showAIGenerateModal, setShowAIGenerateModal] = useState(false);
  const [aiDescription, setAiDescription] = useState('');
  // Documents joints servant de source au parcours généré.
  const [aiUploads, setAiUploads] = useState([]);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [isGeneratingDomain, setIsGeneratingDomain] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStep, setGenerationStep] = useState('');
  const [generatingDomainId, setGeneratingDomainId] = useState(null);
  const [showAlreadyGeneratingModal, setShowAlreadyGeneratingModal] = useState(false);
  const { showUpgradeModal, hideUpgradeModal, upgradeModalProps } = useUpgradeModal();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleCreate = useCallback(async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await createDomain(name, description);
      setName('');
      setDescription('');
      setShowCreateModal(false);
      const list = await fetchDomains();
      setLocalDomains(list);
    } catch (error) {
      const limitError = isPlanLimitError(error);
      if (limitError) {
        showUpgradeModal(limitError.restriction, limitError.featureName || 'domaines');
      }
    } finally {
      setLoading(false);
    }
  }, [name, description, showUpgradeModal]);

  const openParcourirModal = useCallback(() => {
    if (isDemo) {
      setShowDemoBlockModal(true);
      return;
    }
    setShowParcourirModal(true);
    setParcourirSearch('');
    setSelectedPublicDomain(null);
    setPublicDomains([]);
    setParcourirLoading(true);
    fetchPublicDomains('')
      .then(setPublicDomains)
      .catch(() => setPublicDomains([]))
      .finally(() => setParcourirLoading(false));
  }, [isDemo]);

  const searchPublicDomains = useCallback(() => {
    setParcourirLoading(true);
    fetchPublicDomains(parcourirSearch)
      .then(setPublicDomains)
      .catch(() => setPublicDomains([]))
      .finally(() => setParcourirLoading(false));
  }, [parcourirSearch]);

  const handleImportDomain = useCallback(
    async (domainId) => {
      setImportingDomainId(domainId);
      try {
        await importDomain(domainId);
        setShowParcourirModal(false);
        setSelectedPublicDomain(null);
        const list = await fetchDomains();
        setLocalDomains(list);
      } catch (error) {
        const limitError = isPlanLimitError(error);
        if (limitError) {
          showUpgradeModal(limitError.restriction, limitError.featureName || 'imports de domaines');
        }
      } finally {
        setImportingDomainId(null);
      }
    },
    [showUpgradeModal]
  );

  const openChoiceModal = useCallback(() => {
    setShowChoiceModal(true);
  }, []);
  const closeChoiceModal = useCallback(() => setShowChoiceModal(false), []);
  const chooseManually = useCallback(() => {
    if (isDemo) {
      setShowChoiceModal(false);
      setShowDemoBlockModal(true);
      return;
    }
    setShowChoiceModal(false);
    setShowCreateModal(true);
  }, [isDemo]);

  const handleDeleteDomain = useCallback(async (domainId) => {
    setLoading(true);
    try {
      // Vérifier si le domaine est en cours de génération
      const domain = localDomains.find(d => d.id === domainId);
      if (domain && domain.generation_status === 'generating') {
        // Annuler la génération avant de supprimer
        try {
          await cancelDomainGeneration(domainId);
        } catch (cancelErr) {
          console.warn('Erreur lors de l\'annulation de la génération avant suppression:', cancelErr);
          // Continuer quand même la suppression même si l'annulation échoue
        }
      }
      
      await deleteDomain(domainId);
      const list = await fetchDomains();
      setLocalDomains(list);
      setShowDeleteConfirm(null);
      
      // Si c'était le domaine en cours de génération, réinitialiser l'état
      if (generatingDomainId === domainId) {
        setIsGeneratingDomain(false);
        setGeneratingDomainId(null);
        setGenerationProgress(0);
        setGenerationStep('');
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [localDomains, generatingDomainId]);

  const handleDragStart = useCallback((event) => {
    setActiveId(event.active.id);
  }, []);

  const handleDragEnd = useCallback(
    async (event) => {
      setActiveId(null);
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = localDomains.findIndex((d) => d.id === active.id);
      const newIndex = localDomains.findIndex((d) => d.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      const reordered = arrayMove(localDomains, oldIndex, newIndex);
      setLocalDomains(reordered);
      try {
        await reorderDomains(reordered.map((d) => d.id));
        const list = await fetchDomains();
        setLocalDomains(list);
      } catch {
        setLocalDomains(localDomains);
      }
    },
    [localDomains]
  );

  const handleSaveDomain = useCallback(
    async ({ name, description }) => {
      setLoading(true);
      try {
        await updateDomain(editingDomain.id, { name, description });
        setEditingDomain(null);
        const list = await fetchDomains();
        setLocalDomains(list);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    },
    [editingDomain]
  );

  const handleGenerateWithAI = useCallback(async () => {
    if (!aiDescription.trim()) return;
    if (isGeneratingDomain) {
      setShowAIGenerateModal(false);
      setShowAlreadyGeneratingModal(true);
      return;
    }

    setAiGenerating(true);
    setIsGeneratingDomain(true);
    setGenerationProgress(0);
    setGenerationStep('Initialisation...');
    setGeneratingDomainId(null);

    try {
      const domain = await generateDomainWithAI(aiDescription, aiUploads.map((u) => u.id));
      // Le domaine est créé immédiatement avec generation_status='generating'
      // On récupère son ID pour poller son statut
      if (domain && domain.id) {
        setGeneratingDomainId(domain.id);
        // Afficher immédiatement la barre de progression sous le header (sans refresh)
        try {
          window.dispatchEvent(
            new CustomEvent('markdown:domain-generation-started', {
              detail: { domainId: domain.id },
            })
          );
        } catch (eventErr) {
          console.warn('Impossible de déclencher l’événement de génération:', eventErr);
        }

        // Optionnel: afficher le domaine dans la liste sans attendre un refresh
        setLocalDomains((prev) => {
          const alreadyThere = prev.some((d) => d.id === domain.id);
          if (alreadyThere) return prev;
          return [
            {
              ...domain,
              generation_status: 'generating',
              generation_progress: domain.generation_progress ?? 0,
              generation_step: domain.generation_step ?? 'initialisation',
              generation_log: domain.generation_log ?? [],
            },
            ...prev,
          ];
        });
      } else {
        // Si l'API retourne le domaine complet (génération synchrone terminée)
        setGenerationProgress(100);
        setGenerationStep('Terminé');
        setShowAIGenerateModal(false);
        setAiDescription('');
        const list = await fetchDomains();
        setLocalDomains(list);
        setTimeout(() => {
          setIsGeneratingDomain(false);
          setGenerationProgress(0);
          setGenerationStep('');
          setGeneratingDomainId(null);
        }, 2000);
      }
    } catch (error) {
      // Pas de message d'erreur : si un domain_id a été créé, la reprise auto se fera via le popup
      const domainId = error.response?.data?.domain_id || null;
      if (domainId) {
        setGeneratingDomainId(domainId);
        setGenerationStep('En cours...');
      } else {
        setIsGeneratingDomain(false);
        setGenerationProgress(0);
        setGenerationStep('');
        
        // Vérifier si c'est une erreur de limite de plan
        const limitError = isPlanLimitError(error);
        if (limitError) {
          showUpgradeModal(limitError.restriction, limitError.featureName || 'générations IA');
        }
      }
    } finally {
      setAiGenerating(false);
    }
  }, [aiDescription, aiUploads, isGeneratingDomain, showUpgradeModal]);

  // Polling du statut de génération en temps réel
  useEffect(() => {
    if (!isGeneratingDomain || !generatingDomainId) return;

    let cancelled = false;
    let pollCount = 0;
    const maxPolls = 600; // Maximum 10 minutes (600 * 1s)

    const pollStatus = async () => {
      if (cancelled || pollCount >= maxPolls) {
        if (pollCount >= maxPolls) {
          console.warn('Polling timeout - arrêt du suivi de génération');
          setIsGeneratingDomain(false);
        }
        return;
      }

      try {
        const status = await getDomainGenerationStatus(generatingDomainId);
        pollCount++;

        if (status.generation_status === 'generating') {
          // Mise à jour de la progression réelle (jamais afficher "error")
          setGenerationProgress(status.generation_progress || 0);
          setGenerationStep(
            status.generation_step === 'error' ? 'En cours...' : (status.generation_step || 'En cours...')
          );
          
          // Continuer le polling
          setTimeout(pollStatus, 1000); // Poll toutes les secondes
        } else if (status.generation_progress === 100 || (status.generation_status === null && status.generation_progress >= 100)) {
          // Génération terminée (uniquement si progress === 100)
          setGenerationProgress(100);
          setGenerationStep('Terminé');
          setIsGeneratingDomain(false);
          setShowAIGenerateModal(false);
          setAiDescription('');
          
          // Rafraîchir la liste des domaines
          const list = await fetchDomains();
          setLocalDomains(list);
          
          // Réinitialiser après 2 secondes
          setTimeout(() => {
            setGenerationProgress(0);
            setGenerationStep('');
            setGeneratingDomainId(null);
          }, 2000);
        } else if (status.generation_status === null) {
          // Statut null mais génération pas terminée : continuer à poller
          // (peut arriver au début avant que le backend initialise le statut)
          setTimeout(pollStatus, 1000);
        } else if (status.generation_status === 'error') {
          // Reprise automatique sans afficher d'erreur : on garde une progression neutre
          try {
            await resumeDomainGeneration(generatingDomainId);
            setGenerationStep('En cours...');
            setTimeout(pollStatus, 2000);
          } catch {
            setTimeout(pollStatus, 2000);
          }
        }
      } catch (error) {
        console.warn('Erreur lors du polling du statut (génération continue côté backend):', error);
        // En cas d'erreur, continuer à poller (peut être temporaire)
        // La génération continue côté backend même si le frontend a une erreur
        if (!cancelled && pollCount < maxPolls) {
          setTimeout(pollStatus, 2000); // Poll moins fréquemment en cas d'erreur
        } else if (pollCount >= maxPolls) {
          console.warn('Polling timeout - arrêt du suivi de génération (la génération continue côté backend)');
          setIsGeneratingDomain(false);
        }
      }
    };

    // Démarrer le polling après un court délai
    const timer = setTimeout(pollStatus, 500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isGeneratingDomain, generatingDomainId]);

  // Vérifier s'il y a des domaines en cours de génération au chargement et reprendre le polling
  useEffect(() => {
    const checkGeneratingDomains = async () => {
      try {
        const domains = await fetchDomains();
        const generatingDomain = domains.find(d => d.generation_status === 'generating');
        
        if (generatingDomain) {
          // Reprendre le suivi de la génération en cours (affichage neutre, pas d'erreur)
          setIsGeneratingDomain(true);
          setGeneratingDomainId(generatingDomain.id);
          setGenerationProgress(generatingDomain.generation_progress || 0);
          setGenerationStep(
            generatingDomain.generation_status === 'error' || generatingDomain.generation_step === 'error'
              ? 'En cours...'
              : (generatingDomain.generation_step || 'En cours...')
          );
          
          // Vérifier aussi le statut détaillé pour s'assurer que la génération continue
          try {
            const status = await getDomainGenerationStatus(generatingDomain.id);
            if (status.generation_status === 'generating') {
              // La génération continue, le polling reprendra automatiquement via l'autre useEffect
              setGenerationProgress(status.generation_progress || 0);
              setGenerationStep(status.generation_step || 'En cours...');
            } else if (status.generation_progress === 100 || (status.generation_status === null && status.generation_progress >= 100)) {
              // Génération terminée pendant l'absence (uniquement si progress === 100)
              setIsGeneratingDomain(false);
              setGenerationProgress(100);
              setGenerationStep('Terminé');
              // Rafraîchir la liste
              const list = await fetchDomains();
              setLocalDomains(list);
            } else if (status.generation_status === null) {
              // Statut null mais génération pas terminée : continuer à poller
              // (peut arriver au début avant que le backend initialise le statut)
              // Le polling reprendra automatiquement via l'autre useEffect
            } else if (status.generation_status === 'error') {
              // Reprise automatique sans afficher d'erreur : garder affichage neutre
              setGenerationStep('En cours...');
              try {
                await resumeDomainGeneration(generatingDomain.id);
              } catch {
                // continuer à poller
              }
            }
          } catch (statusErr) {
            console.warn('Erreur lors de la vérification du statut détaillé:', statusErr);
            // Continuer quand même, le polling reprendra
          }
        }
      } catch (error) {
        console.error('Erreur lors de la vérification des domaines en génération:', error);
      }
    };

    checkGeneratingDomains();
  }, []);

  return (
    <div className="px-4 md:px-6 lg:px-8 pt-1 pb-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between gap-3 mb-3.5">
        <div className="flex flex-col min-w-0">
          <h1 className="text-[17px] md:text-[19px] font-medium tracking-[-0.01em] text-[var(--om-text)]">
            Bibliothèque
          </h1>
          <span className="text-xs text-[var(--om-muted)]">
            Vos domaines, chapitres et contenus.
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={openParcourirModal}
            className="om-btn om-btn-ghost px-4 py-2.5 text-[13px]"
          >
            Parcourir
          </button>
          <button
            type="button"
            onClick={openChoiceModal}
            className="om-icon-btn om-icon-btn-accent w-[38px] h-[38px]"
            title="Créer un domaine"
            aria-label="Créer un domaine"
          >
            <i className="ph ph-plus text-[17px]" aria-hidden />
          </button>
        </div>
      </div>

      {/* La progression de génération s'affiche maintenant sous le header via OnboardingGenerationPopup */}

      {/* Pop-up de choix : IA ou création manuelle */}
      {showChoiceModal && (
        <div
          className="fixed inset-0 bg-[var(--om-scrim-solid)]/50 flex items-center justify-center z-50 p-4"
          onClick={closeChoiceModal}
        >
          <div
            className="bg-[var(--om-surface)] rounded-2xl p-6 max-w-md w-full shadow-[var(--om-shadow-lg)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-medium text-[var(--om-text)] mb-2">
              Créer un domaine
            </h3>
            <p className="text-sm text-[var(--om-muted)] mb-6">
              Comment souhaitez-vous créer votre domaine ?
            </p>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => {
                  if (isDemo) {
                    closeChoiceModal();
                    setShowDemoBlockModal(true);
                    return;
                  }
                  if (isGeneratingDomain) {
                    closeChoiceModal();
                    setShowAlreadyGeneratingModal(true);
                    return;
                  }
                  closeChoiceModal();
                  setShowAIGenerateModal(true);
                }}
                className="w-full px-4 py-3 rounded-2xl border border-[var(--om-line)] bg-[var(--om-surface-2)]/50 text-[var(--om-text)] text-sm font-medium hover:border-[var(--om-accent)]/50 hover:bg-[var(--om-accent)]/5 transition-all flex items-center gap-3 text-left"
              >
                <span
                  className="shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center bg-[var(--om-surface)] border border-[var(--om-line)] text-[var(--om-muted)]"
                  aria-hidden
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
                    />
                  </svg>
                </span>
                Générer un domaine avec l&apos;IA
              </button>
              <button
                type="button"
                onClick={chooseManually}
                className="w-full px-4 py-3 rounded-2xl border border-[var(--om-line)] bg-[var(--om-surface-2)]/50 text-[var(--om-text)] text-sm font-medium hover:border-[var(--om-accent)]/50 hover:bg-[var(--om-accent)]/5 transition-all flex items-center gap-3 text-left"
              >
                <span
                  className="shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center bg-[var(--om-surface)] border border-[var(--om-line)] text-[var(--om-muted)]"
                  aria-hidden
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                </span>
                Créer manuellement un domaine
              </button>
            </div>
            <button
              type="button"
              onClick={closeChoiceModal}
              className="mt-4 w-full px-4 py-2.5 rounded-2xl border border-[var(--om-line)] text-[var(--om-muted)] text-sm font-medium hover:bg-[var(--om-surface-2)] transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Pop-up de création manuelle (2 champs) */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-[var(--om-scrim-solid)]/50 flex items-center justify-center z-50 p-4"
          onClick={() => {
            setShowCreateModal(false);
            setName('');
            setDescription('');
          }}
        >
          <div
            className="bg-[var(--om-surface)] rounded-2xl p-6 max-w-md w-full shadow-[var(--om-shadow-lg)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-medium text-[var(--om-text)] mb-4">
              Créer un domaine
            </h3>
            <input
              type="text"
              placeholder="Nom du domaine"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border border-[var(--om-line)] text-[var(--om-text)] mb-3 focus:border-[var(--om-accent)] focus:outline-none"
            />
            <textarea
              placeholder="Description (optionnel)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-4 py-3 rounded-2xl border border-[var(--om-line)] text-[var(--om-text)] mb-4 resize-none focus:border-[var(--om-accent)] focus:outline-none"
            />
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  setName('');
                  setDescription('');
                }}
                className="px-4 py-2 rounded-2xl border border-[var(--om-line)] text-[var(--om-muted)] text-sm font-medium hover:bg-[var(--om-surface-2)]"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={loading}
                className="px-4 py-2 rounded-2xl bg-[var(--om-accent)] text-[var(--om-on-accent)] font-medium hover:bg-[var(--om-accent-hover)] disabled:opacity-60"
              >
                {loading ? 'Création…' : 'Créer le domaine'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingDomain && (
        <div className="mb-6 om-card p-5">
          <div className="space-y-4">
            <div className="flex flex-wrap justify-between items-center gap-4">
              <button
                type="button"
                onClick={() => setEditingDomain(null)}
                className="text-[var(--om-accent)] hover:underline font-medium"
              >
                ← Retour
              </button>
              <button
                type="button"
                onClick={async () => {
                  const nameInput = document.getElementById('domain-name-input');
                  const descInput = document.getElementById('domain-desc-input');
                  if (nameInput && descInput) {
                    await handleSaveDomain({
                      name: nameInput.value,
                      description: descInput.value,
                    });
                  }
                }}
                disabled={loading}
                className="px-4 py-2 rounded-2xl bg-[var(--om-accent)] text-[var(--om-on-accent)] text-sm font-medium hover:bg-[var(--om-accent-hover)] disabled:opacity-60"
              >
                {loading ? 'Enregistrement…' : 'Enregistrer le domaine'}
              </button>
            </div>
            <input
              id="domain-name-input"
              type="text"
              placeholder="Nom du domaine"
              defaultValue={editingDomain.name}
              className="w-full px-4 py-3 rounded-2xl border border-[var(--om-line)] text-[var(--om-text)] font-medium text-lg focus:border-[var(--om-accent)] focus:outline-none"
            />
            <textarea
              id="domain-desc-input"
              placeholder="Description (optionnel)"
              defaultValue={editingDomain.description || ''}
              rows={3}
              className="w-full px-4 py-3 rounded-2xl border border-[var(--om-line)] text-[var(--om-text)] resize-none focus:border-[var(--om-accent)] focus:outline-none"
            />
          </div>
        </div>
      )}

      {localDomains.length === 0 ? (
        <p className="text-[var(--om-muted)] py-12 text-center">
          Aucun domaine. Créez-en un pour commencer.
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={localDomains.map((d) => d.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="space-y-3">
              {localDomains.map((d) => (
                <DomainItem
                  key={d.id}
                  domain={d}
                  basePath={basePath}
                  onDeleteRequest={(id) => setShowDeleteConfirm(id)}
                  onEdit={(domain) => setEditingDomain(domain)}
                  isDragging={activeId === d.id}
                  editingDomainId={editingDomain?.id}
                />
              ))}
            </ul>
          </SortableContext>
          <DragOverlay dropAnimation={null}>
            {activeId ? (() => {
              const domain = localDomains.find((d) => d.id === activeId);
              if (!domain) return null;
              const name = domain.name;
              const m = name?.match(/^(.+)\s+(\(par @[^)]+\))$/);
              return (
                <div className="w-full text-left rounded-2xl border border-[var(--om-line)] bg-[var(--om-surface)] shadow-[var(--om-shadow-lg)] overflow-hidden cursor-grabbing">
                  <div className="p-5">
                    <div className="flex justify-between items-start gap-2 min-h-[75px]">
                      <div className="min-w-0 flex-1 flex flex-col h-full">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <h2 className="text-lg font-medium text-[var(--om-text)] inline">
                            {m ? (
                              <>{m[1]}<span className="text-[var(--om-muted)] font-normal">{' '}{m[2]}</span></>
                            ) : (
                              name
                            )}
                          </h2>
                          {domain.generation_status === 'generating' && (
                            <div className="flex-shrink-0 self-center ml-1">
                              <svg className="animate-spin h-5 w-5 text-[var(--om-accent)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                            </div>
                          )}
                        </div>
                        {domain.generation_status === 'generating' ? (
                          <p className="text-base text-[var(--om-accent)] flex-shrink-0 font-medium">Domaine en cours de création...</p>
                        ) : domain.description ? (
                          <p className="text-base text-[var(--om-muted)] line-clamp-2 flex-shrink-0">
                            {domain.description.length > 150 ? `${domain.description.substring(0, 150)}...` : domain.description}
                          </p>
                        ) : null}
                        {domain.generation_status !== 'generating' && (
                          <p className="text-xs text-[var(--om-muted)] mt-auto">
                            {(domain.chapters?.length ?? 0)} chapitre(s)
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="p-2 text-[var(--om-muted)] flex items-center">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 6h2v2H8V6zm0 5h2v2H8v-2zm0 5h2v2H8v-2zm5-10h2v2h-2V6zm0 5h2v2h-2v-2zm0 5h2v2h-2v-2z" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })() : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Pop-up Parcourir : domaines publics */}
      {showParcourirModal && (
        <div
          className="fixed inset-0 bg-[var(--om-scrim-solid)]/50 flex items-center justify-center z-50 p-4"
          onClick={() => {
            setShowParcourirModal(false);
            setSelectedPublicDomain(null);
          }}
        >
          <div
            className="bg-[var(--om-surface)] rounded-2xl shadow-[var(--om-shadow-lg)] max-w-2xl w-full max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-[var(--om-line)]">
              <h3 className="text-lg font-medium text-[var(--om-text)] mb-4">
                Domaines partagés
              </h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Rechercher par mots-clés…"
                  value={parcourirSearch}
                  onChange={(e) => setParcourirSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchPublicDomains()}
                  className="flex-1 px-4 py-3 rounded-2xl border border-[var(--om-line)] text-[var(--om-text)] focus:border-[var(--om-accent)] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={searchPublicDomains}
                  disabled={parcourirLoading}
                  className="px-4 py-2 rounded-2xl bg-[var(--om-accent)] text-[var(--om-on-accent)] text-sm font-medium hover:bg-[var(--om-accent-hover)] disabled:opacity-60 shrink-0"
                >
                  Rechercher
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 min-h-0">
              {selectedPublicDomain ? (
                <div>
                  <button
                    type="button"
                    onClick={() => setSelectedPublicDomain(null)}
                    className="text-[var(--om-accent)] hover:underline font-medium mb-4"
                  >
                    ← Retour à la liste
                  </button>
                  <div className="flex justify-between items-center gap-4 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <h4 className="text-lg font-medium text-[var(--om-text)] truncate">
                        {selectedPublicDomain.name}
                      </h4>
                      {selectedPublicDomain.isOwn && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--om-accent)]/20 text-[var(--om-accent)] shrink-0">
                          Votre domaine
                        </span>
                      )}
                    </div>
                    {!selectedPublicDomain.isOwn && (
                      <button
                        type="button"
                        onClick={() => handleImportDomain(selectedPublicDomain.id)}
                        disabled={importingDomainId === selectedPublicDomain.id}
                        className="px-4 py-2 rounded-2xl bg-[var(--om-accent)] text-[var(--om-on-accent)] text-sm font-medium hover:bg-[var(--om-accent-hover)] disabled:opacity-60 shrink-0"
                      >
                        {importingDomainId === selectedPublicDomain.id
                          ? 'Import…'
                          : 'Importer'}
                      </button>
                    )}
                  </div>
                  {selectedPublicDomain.user && (
                    <p className="text-sm text-[var(--om-muted)] mb-4">
                      par @{selectedPublicDomain.user.username}
                    </p>
                  )}
                  <div className="rounded-2xl border border-[var(--om-line)] bg-[var(--om-surface-2)]/30 p-4 mb-4 max-h-48 overflow-y-auto">
                    <p className="text-xs font-medium text-[var(--om-muted)] uppercase mb-2">
                      Parcours de formation
                    </p>
                    {(() => {
                      const chs = [...(selectedPublicDomain.chapters || [])].sort(
                        (a, b) => (a.position ?? 0) - (b.position ?? 0)
                      );
                      const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
                      if (chs.length === 0) {
                        return (
                          <p className="text-[var(--om-muted)] italic text-sm">Aucun chapitre.</p>
                        );
                      }
                      return (
                        <div className="text-sm text-[var(--om-text)] space-y-1">
                          {chs.map((ch, i) => {
                            const sections = [...(ch.sections || [])].sort(
                              (a, b) => (a.position ?? 0) - (b.position ?? 0)
                            );
                            return (
                              <div key={ch.id}>
                                <div className="font-medium">
                                  {roman[Math.min(i, roman.length - 1)]} – {ch.title}
                                </div>
                                {sections.length > 0 && (
                                  <div className="ml-4 mt-0.5 space-y-0.5 text-[var(--om-muted)]">
                                    {sections.map((sec, j) => (
                                      <div key={sec.id}>
                                        {j + 1}. {sec.title}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                  <div className="rounded-2xl border border-[var(--om-line)] bg-[var(--om-surface-2)]/30 p-4 mb-4 max-h-60 overflow-y-auto">
                    <p className="text-xs font-medium text-[var(--om-muted)] uppercase mb-2">
                      Aperçu du premier chapitre
                    </p>
                    {(() => {
                      const chs = [...(selectedPublicDomain.chapters || [])].sort(
                        (a, b) => (a.position ?? 0) - (b.position ?? 0)
                      );
                      const first = chs[0];
                      if (!first) {
                        return (
                          <p className="text-[var(--om-muted)] italic">Aucun chapitre.</p>
                        );
                      }
                      const content =
                        first.content ||
                        (first.sections?.[0]?.content) ||
                        '';
                      return content ? (
                        <MarkdownReadingView
                          title={first.title}
                          content={content}
                          onEdit={null}
                          editLabel="Modifier"
                        />
                      ) : (
                        <p className="text-[var(--om-muted)] italic">
                          Chapitre &laquo;{first.title}&raquo; sans contenu.
                        </p>
                      );
                    })()}
                  </div>
                  {selectedPublicDomain.isOwn && (
                    <p className="text-sm text-[var(--om-muted)] italic py-2">
                      Ce domaine vous appartient. Vous ne pouvez pas l&apos;importer.
                    </p>
                  )}
                </div>
              ) : parcourirLoading && publicDomains.length === 0 ? (
                <p className="text-[var(--om-muted)] py-8 text-center">
                  Chargement…
                </p>
              ) : publicDomains.length === 0 ? (
                <p className="text-[var(--om-muted)] py-8 text-center">
                  Aucun domaine public trouvé.
                </p>
              ) : (
                <ul className="space-y-2">
                  {publicDomains.map((d) => (
                    <li key={d.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedPublicDomain(d)}
                        className="w-full text-left rounded-2xl border border-[var(--om-line)] bg-[var(--om-surface)] p-4 hover:border-[var(--om-accent)]/50 hover:bg-[var(--om-accent)]/5 transition-all"
                      >
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-[var(--om-text)]">
                            {d.name}
                          </h4>
                          {d.isOwn && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--om-accent)]/20 text-[var(--om-accent)]">
                              Votre domaine
                            </span>
                          )}
                        </div>
                        {d.user && (
                          <p className="text-sm text-[var(--om-muted)] mt-1">
                            par @{d.user.username}
                          </p>
                        )}
                        <p className="text-xs text-[var(--om-muted)] mt-2">
                          {(d.chapters?.length ?? 0)} chapitre(s)
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="p-4 border-t border-[var(--om-line)]">
              <button
                type="button"
                onClick={() => {
                  setShowParcourirModal(false);
                  setSelectedPublicDomain(null);
                }}
                className="w-full px-4 py-2 rounded-2xl border border-[var(--om-line)] text-[var(--om-muted)] text-sm font-medium hover:bg-[var(--om-surface-2)]"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pop-up de génération avec IA */}
      {showAIGenerateModal && (
        <div
          className="fixed inset-0 bg-[var(--om-scrim-solid)]/50 flex items-center justify-center z-50 p-4"
          onClick={() => {
            if (!aiGenerating) {
              setShowAIGenerateModal(false);
              setAiDescription('');
            }
          }}
        >
          <div
            className="bg-[var(--om-surface)] rounded-2xl shadow-[var(--om-shadow-lg)] max-w-3xl w-full max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-[var(--om-line)]">
              <h3 className="text-xl font-medium text-[var(--om-text)] mb-2">
                Générer un domaine avec l&apos;IA
              </h3>
              <p className="text-sm text-[var(--om-muted)]">
                Décrivez en détail le domaine de connaissances que vous souhaitez créer. L&apos;IA générera un programme complet avec au minimum 4 chapitres, chacun contenant au minimum 3 sous-chapitres détaillés.
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-6 min-h-0">
              <textarea
                placeholder="Exemple : Créez un programme complet sur l'histoire de la philosophie occidentale, de l'Antiquité grecque jusqu'à l'époque contemporaine. Le programme doit couvrir les grands courants de pensée, les philosophes majeurs, et les concepts fondamentaux..."
                value={aiDescription}
                onChange={(e) => setAiDescription(e.target.value)}
                disabled={aiGenerating}
                rows={12}
                className="w-full px-4 py-3 rounded-2xl border border-[var(--om-line)] text-[var(--om-text)] resize-none focus:border-[var(--om-accent)] focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
              />
              <div className="mt-4">
                <FilePicker
                  uploads={aiUploads}
                  onChange={setAiUploads}
                  disabled={aiGenerating || isGeneratingDomain}
                />
              </div>
              {(aiGenerating || isGeneratingDomain) && (
                <div className="mt-4 flex flex-col gap-2 p-4 rounded-2xl bg-[var(--om-surface-2)]/50 border border-[var(--om-line)]">
                  <div className="flex items-center gap-3 text-[var(--om-muted)]">
                    <svg
                      className="animate-spin h-5 w-5 shrink-0"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    <span className="text-sm">
                      Génération en cours... Cela peut prendre entre 2 à 6 minutes.
                    </span>
                  </div>
                  {(generationStep || generationProgress > 0) && (
                    <div className="text-sm text-[var(--om-text)] font-medium">
                      {generationStep && <span className="block">{generationStep}</span>}
                      <span className="text-[var(--om-accent)]">{generationProgress}%</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="p-6 border-t border-[var(--om-line)] flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => {
                  if (!aiGenerating) {
                    setShowAIGenerateModal(false);
                    setAiDescription('');
                  }
                }}
                disabled={aiGenerating}
                className="px-4 py-2 rounded-2xl border border-[var(--om-line)] text-[var(--om-muted)] text-sm font-medium hover:bg-[var(--om-surface-2)] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleGenerateWithAI}
                disabled={!aiDescription.trim() || aiGenerating || isGeneratingDomain}
                className="px-4 py-2 rounded-2xl bg-[var(--om-accent)] text-[var(--om-on-accent)] text-sm font-medium hover:bg-[var(--om-accent-hover)] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {(aiGenerating || isGeneratingDomain) ? 'Génération...' : 'Générer le domaine'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pop-up de confirmation de suppression */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-[var(--om-scrim-solid)]/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--om-surface)] rounded-2xl p-6 max-w-md w-full shadow-[var(--om-shadow-lg)]">
            <h3 className="text-lg font-medium text-[var(--om-text)] mb-2">
              Supprimer le domaine ?
            </h3>
            <p className="text-sm text-[var(--om-muted)] mb-6">
              Cette action est irréversible. Le domaine et tous ses chapitres seront supprimés.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 rounded-2xl border border-[var(--om-line)] text-[var(--om-muted)] text-sm font-medium hover:bg-[var(--om-surface-2)]"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => handleDeleteDomain(showDeleteConfirm)}
                disabled={loading}
                className="px-4 py-2 rounded-2xl bg-[var(--om-danger)] text-[var(--om-on-accent)] text-sm font-medium hover:bg-[var(--om-danger-strong)] disabled:opacity-60"
              >
                {loading ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pop-up : génération déjà en cours */}
      {showAlreadyGeneratingModal && (
        <div className="fixed inset-0 bg-[var(--om-scrim-solid)]/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--om-surface)] rounded-2xl p-6 max-w-md w-full shadow-[var(--om-shadow-lg)]">
            <h3 className="text-lg font-medium text-[var(--om-text)] mb-2">
              Génération déjà en cours
            </h3>
            <p className="text-sm text-[var(--om-muted)] mb-6">
              Un domaine est déjà en cours de génération. Merci d&apos;attendre la fin de cette opération avant d&apos;en lancer une nouvelle.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowAlreadyGeneratingModal(false)}
                className="px-4 py-2 rounded-2xl bg-[var(--om-accent)] text-[var(--om-on-accent)] text-sm font-medium hover:bg-[var(--om-accent-hover)]"
              >
                Compris
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

export default MarkdownHome;
