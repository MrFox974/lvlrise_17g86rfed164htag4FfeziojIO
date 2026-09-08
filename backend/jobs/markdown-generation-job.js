/**
 * Job de génération d'un domaine Markdown (exécuté en arrière-plan).
 * Utilisé par le controller (setImmediate en local) et par le handler Lambda (invocation async en prod).
 */
const MarkdownDomain = require('../models/MarkdownDomain');
const MarkdownChapter = require('../models/MarkdownChapter');
const MarkdownSection = require('../models/MarkdownSection');
const markdownGenerationService = require('../services/markdown-generation.service');
const uploadService = require('../services/upload.service');

/**
 * Exécute la génération complète d'un domaine (structure + chapitres + sections).
 * @param {number} domainId - ID du domaine à générer
 */
async function runDomainGenerationJob(domainId) {
  const domain = await MarkdownDomain.findByPk(domainId);
  if (!domain) return;

  const domainDescription = domain.description || domain.name;
  const domainName = domain.name;
  const formationMode = markdownGenerationService.inferFormationMode(domainDescription);

  // Documents joints par l'utilisateur : lus une seule fois, puis transmis à
  // chaque appel de rédaction. Ils font autorité sur le contenu du parcours.
  const sourceText = await uploadService
    .getCombinedText(domain.user_id, domain.upload_ids || [])
    .catch(() => '');

  const log = [];
  const addLog = (message, status = 'done') => {
    log.push({ message, status, at: new Date().toISOString() });
  };
  const updateProgress = async (step, progress, logMsg) => {
    if (logMsg) addLog(logMsg, 'running');
    const currentDomain = await MarkdownDomain.findByPk(domain.id);
    if (!currentDomain) return;
    const safeProgress = (step === 'initialisation' && progress === 0)
      ? 0
      : Math.min(100, Math.max(1, Math.round(progress)));
    try {
      await currentDomain.update({
        generation_step: step,
        generation_progress: safeProgress,
        generation_log: log,
      });
    } catch (updateErr) {
      if (updateErr.name === 'SequelizeForeignKeyConstraintError' ||
          (updateErr.parent && updateErr.parent.code === '23503')) {
        return;
      }
      throw updateErr;
    }
  };

  const checkCancelled = async () => {
    const currentDomain = await MarkdownDomain.findByPk(domain.id);
    if (!currentDomain) return true;
    return currentDomain.generation_cancelled === true;
  };

  try {
    addLog('Étape 1/3 : Génération de la structure du programme...', 'running');
    await updateProgress('initialisation', 3, 'Structure en cours...');
    if (await checkCancelled()) {
      addLog('Génération annulée par l\'utilisateur.', 'error');
      const currentDomain = await MarkdownDomain.findByPk(domain.id);
      if (currentDomain) {
        try {
          await currentDomain.update({
            generation_status: null,
            generation_step: 'cancelled',
            generation_log: log,
          });
        } catch (updateErr) {
          if (updateErr.name !== 'SequelizeForeignKeyConstraintError' &&
              (!updateErr.parent || updateErr.parent.code !== '23503')) {
            console.error('Erreur lors de la mise à jour après annulation:', updateErr);
          }
        }
      }
      return;
    }

    let structure = await markdownGenerationService.generateStructure(domainDescription, formationMode, sourceText);
    if (!structure || !structure.chapters?.length) {
      addLog('Structure échouée, nouvelle tentative...', 'running');
      structure = await markdownGenerationService.generateStructure(domainDescription, formationMode, sourceText);
    }
    if (!structure || !structure.chapters?.length) {
      addLog('Utilisation de la structure de secours (appels séquentiels)...', 'running');
      structure = markdownGenerationService.getFallbackStructure(domainDescription);
    }

    if (structure && structure.chapters?.length > 0) {
      const currentDomain = await MarkdownDomain.findByPk(domain.id);
      if (!currentDomain) {
        addLog('Domaine supprimé pendant la génération. Arrêt de la génération.', 'error');
        return;
      }
      try {
        await currentDomain.update({ name: structure.name, description: structure.description });
      } catch (updateErr) {
        if (updateErr.name === 'SequelizeForeignKeyConstraintError' ||
            (updateErr.parent && updateErr.parent.code === '23503')) {
          addLog('Domaine supprimé pendant la génération. Arrêt de la génération.', 'error');
          return;
        }
        throw updateErr;
      }

      const totalSteps = structure.chapters.reduce((acc, ch) => acc + 1 + (ch.sections?.length || 0), 0);
      let step = 0;
      const displayName = structure.name || domainName;
      const previousChaptersWithSections = [];

      for (let i = 0; i < structure.chapters.length; i++) {
        if (await checkCancelled()) {
          addLog('Génération annulée par l\'utilisateur.', 'error');
          const currentDomain = await MarkdownDomain.findByPk(domain.id);
          if (currentDomain) {
            try {
              await currentDomain.update({
                generation_status: null,
                generation_step: 'cancelled',
                generation_log: log,
              });
            } catch (updateErr) {
              if (updateErr.name !== 'SequelizeForeignKeyConstraintError' &&
                  (!updateErr.parent || updateErr.parent.code !== '23503')) {
                console.error('Erreur lors de la mise à jour après annulation:', updateErr);
              }
            }
          }
          return;
        }

        const ch = structure.chapters[i];
        step++;
        const pct = Math.round((step / totalSteps) * 100);
        await updateProgress(`Chapitre ${i + 1}`, pct, `Appel ${step} : Chapitre "${ch.title}" (contexte: structure)...`);
        addLog(`Appel ${step} : Génération chapitre ${i + 1} : ${ch.title}...`, 'running');

        const chResult = await markdownGenerationService.generateChapterContent(
          displayName,
          structure,
          i,
          previousChaptersWithSections,
          formationMode,
          sourceText
        );
        const chContent = chResult?.content || '';

        if (await checkCancelled()) {
          addLog('Génération annulée par l\'utilisateur avant création du chapitre.', 'error');
          return;
        }

        const chPos = await MarkdownChapter.max('position', { where: { domain_id: domain.id } });
        let chapter;
        try {
          chapter = await MarkdownChapter.create({
            domain_id: domain.id,
            title: chResult?.title || ch.title,
            content: chContent,
            position: (chPos ?? -1) + 1,
          });
        } catch (createErr) {
          if (createErr.name === 'SequelizeForeignKeyConstraintError' ||
              (createErr.parent && createErr.parent.code === '23503')) {
            addLog('Domaine supprimé pendant la génération. Arrêt de la génération.', 'error');
            return;
          }
          throw createErr;
        }

        const sections = ch.sections || [];
        const previousSectionsInChapter = [];
        const chapterSectionsForContext = [];

        for (let j = 0; j < sections.length; j++) {
          if (await checkCancelled()) {
            addLog('Génération annulée par l\'utilisateur.', 'error');
            const currentDomain = await MarkdownDomain.findByPk(domain.id);
            if (currentDomain) {
              try {
                await currentDomain.update({
                  generation_status: null,
                  generation_step: 'cancelled',
                  generation_log: log,
                });
              } catch (updateErr) {
                if (updateErr.name !== 'SequelizeForeignKeyConstraintError' &&
                    (!updateErr.parent || updateErr.parent.code !== '23503')) {
                  console.error('Erreur lors de la mise à jour après annulation:', updateErr);
                }
              }
            }
            return;
          }

          step++;
          const pctSec = Math.round((step / totalSteps) * 100);
          const ctxDesc = j === 0
            ? `structure + chapitre ${i + 1}`
            : `structure + chap ${i + 1} + sous-chap 1 à ${j}`;
          await updateProgress(`Sous-ch. ${j + 1}/${sections.length}`, pctSec, `Appel ${step} : Sous-chap "${sections[j].title}" (contexte: ${ctxDesc})...`);
          addLog(`Appel ${step} : Génération sous-chapitre ${j + 1} du ch. ${i + 1} : ${sections[j].title}...`, 'running');

          const secResult = await markdownGenerationService.generateSectionContent(
            displayName,
            structure,
            chResult?.title || ch.title,
            chContent,
            sections[j].title,
            previousSectionsInChapter,
            formationMode,
            sourceText
          );

          if (secResult) {
            if (await checkCancelled()) {
              addLog('Génération annulée par l\'utilisateur avant création de la section.', 'error');
              return;
            }
            const secPos = await MarkdownSection.max('position', { where: { chapter_id: chapter.id } });
            try {
              await MarkdownSection.create({
                chapter_id: chapter.id,
                title: secResult.title,
                content: secResult.content,
                position: (secPos ?? -1) + 1,
              });
              previousSectionsInChapter.push({ title: secResult.title, content: secResult.content });
              chapterSectionsForContext.push({ title: secResult.title, content: secResult.content });
            } catch (createErr) {
              if (createErr.name === 'SequelizeForeignKeyConstraintError' ||
                  (createErr.parent && createErr.parent.code === '23503')) {
                addLog('Domaine ou chapitre supprimé pendant la génération. Arrêt de la génération.', 'error');
                return;
              }
              throw createErr;
            }
            if (secResult.content.includes('Contenu à compléter selon vos recherches')) {
              addLog(`Sous-chapitre ${j + 1} créé avec contenu minimal (génération partiellement échouée)`, 'running');
            } else {
              addLog(`Sous-chapitre ${j + 1} créé avec succès`, 'done');
            }
          } else {
            if (await checkCancelled()) {
              addLog('Génération annulée par l\'utilisateur avant création de la section vide.', 'error');
              return;
            }
            addLog(`Avertissement : sous-chapitre ${j + 1} non créé (génération vide). Création d'une section vide.`, 'running');
            const secPos = await MarkdownSection.max('position', { where: { chapter_id: chapter.id } });
            try {
              await MarkdownSection.create({
                chapter_id: chapter.id,
                title: sections[j].title,
                content: `### ${sections[j].title}\n\nContenu à compléter selon vos recherches sur ce sujet.`,
                position: (secPos ?? -1) + 1,
              });
              previousSectionsInChapter.push({ title: sections[j].title, content: '' });
              chapterSectionsForContext.push({ title: sections[j].title, content: '' });
            } catch (createErr) {
              if (createErr.name === 'SequelizeForeignKeyConstraintError' ||
                  (createErr.parent && createErr.parent.code === '23503')) {
                addLog('Domaine ou chapitre supprimé pendant la génération. Arrêt de la génération.', 'error');
                return;
              }
              throw createErr;
            }
          }
        }

        previousChaptersWithSections.push({
          title: chResult?.title || ch.title,
          content: chContent,
          sections: chapterSectionsForContext,
        });
      }

      const finalDomain = await MarkdownDomain.findByPk(domain.id);
      if (!finalDomain) {
        addLog('Domaine supprimé pendant la génération. Arrêt de la génération.', 'error');
        return;
      }
      const chapterCount = await MarkdownChapter.count({ where: { domain_id: domain.id } });
      if (chapterCount === 0) {
        throw new Error('Aucun chapitre n\'a pu être généré. Veuillez réessayer.');
      }
      addLog('Génération terminée avec succès (appels séquentiels).', 'done');
      try {
        await finalDomain.update({
          generation_status: null,
          generation_progress: 100,
          generation_step: 'completed',
          generation_log: log,
        });
      } catch (updateErr) {
        if (updateErr.name === 'SequelizeForeignKeyConstraintError' ||
            (updateErr.parent && updateErr.parent.code === '23503')) {
          return;
        }
        throw updateErr;
      }
    }
  } catch (bgError) {
    console.error('Erreur lors de la génération en arrière-plan:', bgError);
    try {
      const currentDomain = await MarkdownDomain.findByPk(domain.id);
      if (!currentDomain) return;
      if (bgError.name === 'SequelizeForeignKeyConstraintError' ||
          (bgError.parent && bgError.parent.code === '23503')) {
        return;
      }
      const errorLog = currentDomain.generation_log || [];
      errorLog.push({
        message: `Erreur : ${bgError.message}`,
        status: 'error',
        at: new Date().toISOString(),
      });
      await currentDomain.update({
        generation_status: 'error',
        generation_step: 'error',
        generation_log: errorLog,
      });
    } catch (updateErr) {
      if (updateErr.name === 'SequelizeForeignKeyConstraintError' ||
          (updateErr.parent && updateErr.parent.code === '23503')) {
        return;
      }
      console.error('Erreur lors de la mise à jour du statut d\'erreur:', updateErr);
    }
  }
}

/**
 * Exécute la reprise de la génération d'un domaine depuis le point d'arrêt (chapitres/sections déjà créés).
 * Utilisé par le controller (setImmediate en local) et par le handler Lambda (invocation async en prod).
 * @param {number} domainId - ID du domaine à reprendre
 */
async function runDomainGenerationResumeJob(domainId) {
  const domain = await MarkdownDomain.findByPk(domainId);
  if (!domain) return;

  const existingChapters = await MarkdownChapter.findAll({
    where: { domain_id: domain.id },
    order: [['position', 'ASC']],
    include: [
      {
        model: MarkdownSection,
        as: 'sections',
        required: false,
        order: [['position', 'ASC']],
      },
    ],
  });

  const domainDescription = domain.description || domain.name;
  const formationMode = markdownGenerationService.inferFormationMode(domainDescription);
  // Mêmes documents joints qu'à la première tentative : une reprise ne doit pas
  // produire des chapitres qui ignorent les sources fournies.
  const sourceText = await uploadService
    .getCombinedText(domain.user_id, domain.upload_ids || [])
    .catch(() => '');
  let structure = await markdownGenerationService.generateStructure(domainDescription, formationMode, sourceText);
  if (!structure || !structure.chapters?.length) {
    structure = markdownGenerationService.getFallbackStructure(domainDescription);
  }
  if (!structure || !structure.chapters?.length) return;

  const totalSteps = structure.chapters.reduce((acc, ch) => acc + 1 + (ch.sections?.length || 0), 0);
  const completedSteps = existingChapters.reduce((acc, ch) => acc + 1 + (ch.sections?.length || 0), 0);
  const startChapterIndex = existingChapters.length;
  const previousChaptersWithSections = existingChapters.map((ch) => ({
    title: ch.title,
    content: ch.content || '',
    sections: (ch.sections || []).map((sec) => ({
      title: sec.title,
      content: sec.content || '',
    })),
  }));

  const log = domain.generation_log || [];
  const addLog = (message, status = 'done') => {
    log.push({ message, status, at: new Date().toISOString() });
  };
  const updateProgress = async (step, progress, logMsg) => {
    if (logMsg) addLog(logMsg, 'running');
    const currentDomain = await MarkdownDomain.findByPk(domain.id);
    if (!currentDomain) return;
    const safeProgress = Math.min(100, Math.max(1, Math.round(progress)));
    try {
      await currentDomain.update({
        generation_step: step,
        generation_progress: safeProgress,
        generation_log: log,
      });
    } catch (updateErr) {
      if (updateErr.name === 'SequelizeForeignKeyConstraintError' ||
          (updateErr.parent && updateErr.parent.code === '23503')) {
        return;
      }
      throw updateErr;
    }
  };

  const checkCancelled = async () => {
    const currentDomain = await MarkdownDomain.findByPk(domain.id);
    if (!currentDomain) return true;
    return currentDomain.generation_cancelled === true;
  };

  let step = completedSteps;
  const displayName = structure.name || domain.name;

  try {
    for (let i = startChapterIndex; i < structure.chapters.length; i++) {
      if (await checkCancelled()) {
        addLog('Génération annulée par l\'utilisateur.', 'error');
        const currentDomain = await MarkdownDomain.findByPk(domain.id);
        if (currentDomain) {
          try {
            await currentDomain.update({
              generation_status: null,
              generation_step: 'cancelled',
              generation_log: log,
            });
          } catch (updateErr) {
            if (updateErr.name !== 'SequelizeForeignKeyConstraintError' &&
                (!updateErr.parent || updateErr.parent.code !== '23503')) {
              console.error('Erreur lors de la mise à jour après annulation:', updateErr);
            }
          }
        }
        return;
      }

      const ch = structure.chapters[i];
      step++;
      const pct = Math.round((step / totalSteps) * 100);
      await updateProgress(`Chapitre ${i + 1}`, pct, `Reprise : Génération chapitre ${i + 1} : ${ch.title}...`);
      addLog(`Reprise : Génération chapitre ${i + 1} : ${ch.title}...`, 'running');

      const chResult = await markdownGenerationService.generateChapterContent(
        displayName,
        structure,
        i,
        previousChaptersWithSections,
        formationMode,
        sourceText
      );

      if (!chResult?.content) {
        addLog(`Avertissement : chapitre ${i + 1} non créé (génération vide).`, 'running');
        continue;
      }

      const chContent = chResult.content;
      const chPos = await MarkdownChapter.max('position', { where: { domain_id: domain.id } });
      let chapter;
      try {
        chapter = await MarkdownChapter.create({
          domain_id: domain.id,
          title: chResult.title || ch.title,
          content: chContent,
          position: (chPos ?? -1) + 1,
        });
      } catch (createErr) {
        if (createErr.name === 'SequelizeForeignKeyConstraintError' ||
            (createErr.parent && createErr.parent.code === '23503')) {
          addLog('Domaine supprimé pendant la génération. Arrêt de la génération.', 'error');
          return;
        }
        throw createErr;
      }

      const sections = ch.sections || [];
      const previousSectionsInChapter = [];
      const chapterSectionsForContext = [];

      for (let j = 0; j < sections.length; j++) {
        if (await checkCancelled()) {
          addLog('Génération annulée par l\'utilisateur.', 'error');
          const currentDomain = await MarkdownDomain.findByPk(domain.id);
          if (currentDomain) {
            try {
              await currentDomain.update({
                generation_status: null,
                generation_step: 'cancelled',
                generation_log: log,
              });
            } catch (updateErr) {
              if (updateErr.name !== 'SequelizeForeignKeyConstraintError' &&
                  (!updateErr.parent || updateErr.parent.code !== '23503')) {
                console.error('Erreur lors de la mise à jour après annulation:', updateErr);
              }
            }
          }
          return;
        }
        step++;
        const pctSec = Math.round((step / totalSteps) * 100);
        await updateProgress(`Sous-ch. ${j + 1}/${sections.length}`, pctSec, `Reprise : Génération sous-chapitre ${j + 1} du chapitre ${i + 1}...`);
        addLog(`Reprise : Génération sous-chapitre ${j + 1} du chapitre ${i + 1}...`, 'running');

        const secResult = await markdownGenerationService.generateSectionContent(
          displayName,
          structure,
          chResult.title || ch.title,
          chContent,
          sections[j].title,
          previousSectionsInChapter,
          formationMode,
          sourceText
        );

        if (secResult) {
          const secPos = await MarkdownSection.max('position', { where: { chapter_id: chapter.id } });
          await MarkdownSection.create({
            chapter_id: chapter.id,
            title: secResult.title,
            content: secResult.content,
            position: (secPos ?? -1) + 1,
          });
          previousSectionsInChapter.push({ title: secResult.title, content: secResult.content });
          chapterSectionsForContext.push({ title: secResult.title, content: secResult.content });
          addLog(`Sous-chapitre ${j + 1} créé avec succès`, 'done');
        }
      }

      previousChaptersWithSections.push({
        title: chResult.title || ch.title,
        content: chContent,
        sections: chapterSectionsForContext,
      });
      addLog(`Chapitre ${i + 1} créé.`, 'done');
    }

    addLog('Génération reprise et terminée avec succès.', 'done');
    const finalDomain = await MarkdownDomain.findByPk(domain.id);
    if (finalDomain) {
      await finalDomain.update({
        generation_status: null,
        generation_progress: 100,
        generation_step: 'completed',
        generation_log: log,
      });
    }
  } catch (bgError) {
    console.error('Erreur lors de la reprise de la génération:', bgError);
    const currentDomain = await MarkdownDomain.findByPk(domain.id);
    if (currentDomain) {
      const errorLog = currentDomain.generation_log || [];
      errorLog.push({
        message: `Erreur lors de la reprise : ${bgError.message}`,
        status: 'error',
        at: new Date().toISOString(),
      });
      await currentDomain.update({
        generation_status: 'error',
        generation_step: 'error',
        generation_log: errorLog,
      });
    }
  }
}

module.exports = { runDomainGenerationJob, runDomainGenerationResumeJob };
