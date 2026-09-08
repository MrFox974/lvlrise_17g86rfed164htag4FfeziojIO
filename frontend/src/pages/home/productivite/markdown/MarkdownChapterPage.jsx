import { useState, useCallback } from 'react';
import { useLoaderData, useNavigate, Link } from 'react-router-dom';
import { useDemoBasePath, useDemoMode } from '../../../../hooks/useDemoMode';
import DemoBlockModal from '../../../../components/DemoBlockModal';
import UpgradeModal from '../../../../components/UpgradeModal';
import { useUpgradeModal, isPlanLimitError } from '../../../../hooks/useUpgradeModal';
import MarkdownReadingView from '../../../../components/MarkdownReadingView';
import { downloadContentAsPdf } from '../../../../utils/downloadPdf';
import MarkdownDocumentEditor from '../../../../components/MarkdownDocumentEditor';
import {
  fetchDomains,
  updateChapter,
  createSection,
  updateSection,
  deleteSection,
} from '../../../../utils/markdownApi';

const DEMO_CHAPTER_HTML = [
  '<h2>Mémo — Construire un système fiable (sans se noyer dans les détails)</h2>',
  '',
  '<p>',
  'Quand on veut aller vite, on a tendance à empiler des solutions “qui marchent” sans vraiment poser de cadre. Le problème, c’est qu’un projet n’échoue pas sur une grosse erreur spectaculaire, mais sur une accumulation de petites frictions : une donnée mal nommée, une règle implicite oubliée, un comportement non documenté, une exception gérée “plus tard”, puis une autre… et, au bout de quelques semaines, chaque modification devient risquée. L’objectif de ce mémo est simple : garder une trajectoire claire. On ne cherche pas la perfection, on cherche la stabilité : des décisions explicites, des conventions répétables, et une manière de vérifier rapidement que ce qu’on vient de changer est cohérent.',
  '</p>',
  '',
  '<p>',
  'Une bonne pratique est de raisonner en “contrats” : ce que chaque couche promet à la suivante. Par exemple, le backend promet des réponses structurées et des codes HTTP fiables ; le frontend promet une UI qui reste utilisable même quand l’API est lente ; la base promet une structure stable et des migrations traçables. Tant que ces contrats tiennent, le projet avance sans douleur. Et quand ça casse, on sait précisément où regarder. Le piège classique est de confondre “ça s’affiche” avec “c’est correct”. Ici, on vise plutôt : “ça s’affiche”, “c’est explicable”, “c’est testable”, et “c’est maintenable”.',
  '</p>',
  '',
  '<h3>Citation (pour garder le cap)</h3>',
  '<blockquote>',
  '<p>« Ce qui se mesure s’améliore. Ce qui se clarifie se simplifie. »</p>',
  '<p>— Principe de travail</p>',
  '</blockquote>',
  '',
  '<h3>Bloc note (mémo) — Les 4 questions à se poser avant de coder</h3>',
  '<blockquote data-type="note">',
  '<p><strong>Mémo</strong> : avant d’ajouter une fonctionnalité, réponds mentalement à ces quatre questions :</p>',
  '<ul>',
  '<li><strong>Quoi</strong> : quel comportement exact l’utilisateur attend ?</li>',
  '<li><strong>Pourquoi</strong> : quel problème réel ça résout (et pour qui) ?</li>',
  '<li><strong>Où</strong> : à quel endroit du code cette responsabilité doit vivre ?</li>',
  '<li><strong>Comment vérifier</strong> : comment je sais que c’est OK (cas nominal + cas erreur) ?</li>',
  '</ul>',
  '<p>',
  'Si une seule réponse est floue, tu vas compenser par des patchs, et le coût se paiera plus tard. L’idée n’est pas de ralentir, mais de réduire la “reprise” : mieux réfléchir 2 minutes que réparer 2 heures.',
  '</p>',
  '</blockquote>',
  '',
  '<h3>Bloc de code — Exemple d’API claire (contrat lisible)</h3>',
  '<p>',
  'Quand l’API renvoie des erreurs cohérentes, le frontend peut afficher des messages utiles sans bricoler. Évite les réponses “string” imprévisibles ; préfère des objets structurés : <code>{ error, details }</code>.',
  '</p>',
  '<pre><code class="language-js">// Exemple de réponse d’erreur côté backend\n',
  'return res.status(400).json({\n',
  '  error: \"Le montant est requis et doit être supérieur à 0\",\n',
  '  details: \"amount must be a positive number\",\n',
  '});</code></pre>',
  '',
  '<h3>Bloc note (mémo) — “UI first” : l’interface doit rester vivante</h3>',
  '<blockquote data-type="note">',
  '<p>',
  '<strong>Mémo</strong> : l’utilisateur préfère un écran qui répond tout de suite (même avec un skeleton) plutôt qu’un écran figé. Si une requête est lente, montre la structure immédiatement, puis remplis. Même principe pour l’édition : l’éditeur doit être prêt, et l’enregistrement doit être “prévisible” (loading + confirmation).',
  '</p>',
  '</blockquote>',
  '',
  '<h3>Bloc de code — Check rapide avant push</h3>',
  '<p>',
  'Avant de pousser, adopte une routine courte, quasi automatique. L’idée n’est pas d’être strict, mais de réduire les surprises.',
  '</p>',
  '<pre><code class="language-bash"># Frontend',
  'cd frontend',
  'npm run build',
  '',
  '# Backend (si tu as des scripts/tests)',
  'cd ../backend',
  'node -v</code></pre>',
  '',
  '<h3>Gros paragraphe — Organiser ses notes sans se perdre</h3>',
  '<p>',
  'Une connaissance utile est une connaissance retrouvable. Le piège, ce n’est pas d’écrire trop peu, c’est d’écrire sans structure. Structure minimale : un titre clair, des sous-titres courts, puis des blocs “intention” (ce que je veux retenir), “procédure” (les étapes), “exemples” (un ou deux cas concrets), et “pièges” (les erreurs fréquentes). Les blocs note sont parfaits pour les pièges et les résumés. Les citations servent à ancrer une règle. Les blocs de code sont indispensables pour éviter la mémoire floue : un exemple exact vaut mieux que dix phrases vagues. Et surtout : si une note n’est jamais relue, elle devient du bruit ; donc écris comme si tu devais te convaincre toi-même dans 3 mois, un jour de fatigue.',
  '</p>',
  '',
  '<h3>Mini-résumé</h3>',
  '<ul>',
  '<li><strong>Clarté</strong> : contrat lisible entre les couches (API, UI, DB).</li>',
  '<li><strong>Rituel</strong> : petit check avant push pour éviter les retours en arrière.</li>',
  '<li><strong>Mémo</strong> : blocs note pour l’essentiel, code pour le concret.</li>',
  '</ul>',
].join('');

const DEMO_SECTIONS = [
  {
    title: 'Part 1. Exemple visuel',
    content: [
      '<p>Cette section contient un exemple plus concret : une <strong>citation</strong>, un <strong>bloc note</strong> et un <strong>bloc de code</strong>.</p>',
      '<blockquote><p>« Ce qui se conçoit bien s’énonce clairement. »</p></blockquote>',
      '<blockquote data-type="note"><p><strong>Mémo</strong> : plus c’est simple à lire, plus c’est simple à maintenir.</p></blockquote>',
      '<pre><code class="language-bash">npm run dev</code></pre>',
    ].join(''),
  },
  {
    title: 'Part 2. Bloc note',
    content: [
      '<blockquote data-type="note">',
      '<p><strong>Rappel</strong> : garde tes chapitres courts et scindés en sections.</p>',
      '</blockquote>',
      '<p>Ensuite, étoffe progressivement.</p>',
    ].join(''),
  },
];

function MarkdownChapterPage() {
  const navigate = useNavigate();
  const basePath = useDemoBasePath();
  const loaderData = useLoaderData();
  const { domain, chapter } = loaderData;
  const [editingChapter, setEditingChapter] = useState(false);
  const [localChapter, setLocalChapter] = useState(chapter);
  const [sections, setSections] = useState(chapter?.sections ?? []);
  const [showNewSection, setShowNewSection] = useState(false);
  const [editingSection, setEditingSection] = useState(null);
  const [viewingSection, setViewingSection] = useState(null);
  const [showDemoBlockModal, setShowDemoBlockModal] = useState(false);
  const isDemo = useDemoMode();
  const { showUpgradeModal, hideUpgradeModal, upgradeModalProps } = useUpgradeModal();

  const currentChapter = localChapter ?? chapter;

  const refreshData = useCallback(async () => {
    if (!domain?.id) return;
    const domains = await fetchDomains();
    const d = domains.find((x) => x.id === domain.id);
    const ch = d?.chapters?.find((c) => c.id === chapter?.id);
    if (ch) {
      setLocalChapter(ch);
      setSections(ch.sections ?? []);
    }
  }, [domain?.id, chapter?.id]);

  const formatChapterTitle = useCallback((raw, index) => {
    const t = raw.trim();
    if (/^Chap\s*\d+\s*[.:]/.test(t)) return t;
    return `Chap ${index}. ${t}`;
  }, []);

  const handleSaveChapter = useCallback(
    async ({ title, content }) => {
      const chapters = domain?.chapters ?? [];
      const chapterIndex = chapters.findIndex((c) => c.id === chapter?.id) + 1 || 1;
      const formattedTitle = formatChapterTitle(title, chapterIndex);
      await updateChapter(domain.id, chapter.id, {
        title: formattedTitle,
        content,
      });
      setEditingChapter(false);
      refreshData();
    },
    [domain?.id, domain?.chapters, chapter?.id, formatChapterTitle, refreshData]
  );

  const formatSectionTitle = useCallback((raw, sectionsInChapter) => {
    const t = raw.trim();
    if (/^Part\s*\d+\s*[.:]/.test(t)) return t;
    return `Part ${(sectionsInChapter?.length ?? 0) + 1}. ${t}`;
  }, []);

  const handleSaveSection = useCallback(
    async ({ title, content }) => {
      try {
        // En mode démo, bloquer la création de sous-chapitres supplémentaires (mais permettre l'édition)
        if (!editingSection && isDemo) {
          setShowDemoBlockModal(true);
          return;
        }

        let formattedTitle = title;
        if (editingSection) {
          const idx =
            (sections?.findIndex((s) => s.id === editingSection.id) ?? -1) + 1 || 1;
          formattedTitle = formatSectionTitle(title, sections?.slice(0, idx - 1));
          await updateSection(domain.id, chapter.id, editingSection.id, {
            title: formattedTitle,
            content,
          });
        } else {
          formattedTitle = formatSectionTitle(title, sections);
          await createSection(domain.id, chapter.id, formattedTitle, content);
        }
        setEditingSection(null);
        setShowNewSection(false);
        setViewingSection(null);
        refreshData();
    } catch (error) {
      const limitError = isPlanLimitError(error);
      if (limitError) {
        showUpgradeModal(limitError.restriction, limitError.featureName || 'sous-chapitres');
      }
    }
    },
    [domain?.id, chapter?.id, editingSection, sections, formatSectionTitle, refreshData, isDemo, showUpgradeModal]
  );

  const handleDeleteSection = useCallback(
    async (section) => {
      if (!window.confirm('Supprimer cette section ?')) return;
      await deleteSection(domain.id, chapter.id, section.id);
      setViewingSection(null);
      setEditingSection(null);
      refreshData();
    },
    [domain?.id, chapter?.id, refreshData]
  );

  const handleInsertDemo = useCallback(async () => {
    if (!domain?.id || !chapter?.id) return;

    const ok = window.confirm(
      'Insérer un contenu démo dans ce chapitre ?\n\nCela remplacera le contenu actuel du chapitre.'
    );
    if (!ok) return;

    await updateChapter(domain.id, chapter.id, {
      title: currentChapter.title,
      content: DEMO_CHAPTER_HTML,
    });

    const existingTitles = new Set((sections || []).map((s) => (s.title || '').trim()));

    for (const demo of DEMO_SECTIONS) {
      if (existingTitles.has(demo.title.trim())) continue;
      try {
        await createSection(domain.id, chapter.id, demo.title, demo.content);
      } catch {
        // ignore (ex: contrainte unique côté DB si existant)
      }
    }

    setViewingSection(null);
    setEditingSection(null);
    setShowNewSection(false);
    await refreshData();
  }, [domain?.id, chapter?.id, currentChapter.title, sections, refreshData]);

  if (!domain || !chapter) {
    return (
      <div className="px-4 md:px-6 lg:px-8 pt-1 pb-6 max-w-4xl mx-auto text-center">
        <p className="text-[var(--om-muted)] mb-4">Chapitre introuvable.</p>
        <Link to={`${basePath}/productivite/markdown`} className="text-[var(--om-accent)] hover:underline">
          ← Retour aux domaines
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 md:px-6 lg:px-8 pt-1 pb-6 max-w-4xl mx-auto">
      <nav className="flex items-center gap-2 text-base text-[var(--om-muted)] mb-6 flex-wrap">
        <button
          type="button"
          onClick={() => navigate(`${basePath}/productivite`)}
          className="hover:text-[var(--om-accent)]"
        >
          Productivité
        </button>
        <span> / </span>
        <Link to={`${basePath}/productivite/markdown`} className="hover:text-[var(--om-accent)]">
          Bibliothèque
        </Link>
        <span> / </span>
        <Link
          to={`${basePath}/productivite/markdown/domain/${domain.id}`}
          className="hover:text-[var(--om-accent)]"
        >
          {(() => {
            const m = domain.name?.match(/^(.+)\s+(\(par @[^)]+\))$/);
            if (m) {
              return <>{m[1]}<span className="text-[var(--om-muted)]">{' '}{m[2]}</span></>;
            }
            return domain.name;
          })()}
        </Link>
        <span> / </span>
        <span className="text-[var(--om-text)] font-medium">{currentChapter.title}</span>
      </nav>

      {editingChapter ? (
        <MarkdownDocumentEditor
          documentKey={`chapter-${chapter.id}`}
          title={currentChapter.title}
          content={currentChapter.content ?? ''}
          onSave={handleSaveChapter}
          onBack={() => setEditingChapter(false)}
          saveLabel="Enregistrer le chapitre"
          titlePlaceholder="Titre du chapitre"
          showDelete={false}
        />
      ) : (
        <>
          <div className="mb-8">
            <div className="flex justify-between items-start gap-4 mb-4">
              <div className="flex-1" />
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const safeName = (currentChapter.title || 'chapitre').replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 50);
                    downloadContentAsPdf(
                      currentChapter.title,
                      currentChapter.content ?? '',
                      `${safeName}.pdf`
                    );
                  }}
                  className="px-5 py-2.5 rounded-2xl border border-[var(--om-line)] text-[var(--om-text)] text-base font-medium hover:bg-[var(--om-surface-2)]"
                >
                  Télécharger
                </button>
                <button
                  type="button"
                  onClick={() => setEditingChapter(true)}
                  className="px-5 py-2.5 rounded-2xl bg-[var(--om-accent)] text-[var(--om-on-accent)] text-base font-medium hover:bg-[var(--om-accent-hover)]"
                >
                  Modifier le chapitre
                </button>
              </div>
            </div>
            <MarkdownReadingView
              title={currentChapter.title}
              content={currentChapter.content ?? ''}
              onEdit={null}
              editLabel="Modifier le chapitre"
            />
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={handleInsertDemo}
                className="px-5 py-2.5 rounded-2xl border border-[var(--om-line)] bg-[var(--om-surface)] text-base font-medium text-[var(--om-text)] hover:bg-[var(--om-surface-2)]"
              >
                Insérer une démo (mise en forme)
              </button>
            </div>
          </div>

          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium text-[var(--om-text)]">
              Sous-parties (sections)
            </h2>
            <button
              type="button"
              onClick={() => {
                setShowNewSection(true);
                setEditingSection(null);
                setViewingSection(null);
              }}
              className="px-4 py-2 rounded-2xl bg-[var(--om-accent)] text-[var(--om-on-accent)] text-sm font-medium hover:bg-[var(--om-accent-hover)]"
            >
              + Nouvelle section
            </button>
          </div>

          {(showNewSection || editingSection) && (
            <div className="om-card p-5 mb-6">
              <MarkdownDocumentEditor
                documentKey={editingSection ? `section-${editingSection.id}` : 'section-new'}
                title={editingSection?.title}
                content={editingSection?.content ?? ''}
                onSave={handleSaveSection}
                onDelete={editingSection ? () => handleDeleteSection(editingSection) : undefined}
                onBack={() => {
                  setShowNewSection(false);
                  setEditingSection(null);
                }}
                saveLabel={editingSection ? 'Enregistrer la section' : 'Créer la section'}
                deleteLabel="Supprimer la section"
                titlePlaceholder="Titre de la section"
                showDelete={!!editingSection}
              />
            </div>
          )}

          {viewingSection && !editingSection && !showNewSection && (
            <div className="mb-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-medium text-[var(--om-text)]">
                  {viewingSection.title}
                </h3>
                <div className="flex gap-2">
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
                    className="px-3 py-1.5 rounded-[10px] border border-[var(--om-line)] text-sm font-medium hover:bg-[var(--om-surface-2)]"
                  >
                    Télécharger
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingSection(viewingSection)}
                    className="px-3 py-1.5 rounded-[10px] bg-[var(--om-accent)] text-[var(--om-on-accent)] text-sm font-medium"
                  >
                    Modifier
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewingSection(null)}
                    className="px-3 py-1.5 rounded-[10px] border border-[var(--om-line)] text-sm"
                  >
                    Fermer
                  </button>
                </div>
              </div>
              <MarkdownReadingView
                title={viewingSection.title}
                content={viewingSection.content ?? ''}
                onEdit={() => setEditingSection(viewingSection)}
                editLabel="Modifier"
              />
            </div>
          )}

          {sections.length === 0 && !showNewSection ? (
            <p className="text-[var(--om-muted)] py-6">
              Aucune section. Ajoutez des sous-parties avec « + Nouvelle section ».
            </p>
          ) : (
            <ul className="space-y-2">
              {sections.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setViewingSection(s);
                      setShowNewSection(false);
                      setEditingSection(null);
                    }}
                    className="w-full text-left rounded-2xl border border-[var(--om-line)] bg-[var(--om-surface)] p-4 shadow-[var(--om-shadow)] hover:border-[var(--om-accent)]/50 hover:bg-[var(--om-accent)]/5 transition-all"
                  >
                    <span className="font-medium text-[var(--om-text)]">{s.title}</span>
                    <p className="text-sm text-[var(--om-muted)] truncate mt-0.5">
                      {s.content?.slice(0, 80) || 'Vide'}
                      {s.content && s.content.length > 80 ? '…' : ''}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
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

export default MarkdownChapterPage;
