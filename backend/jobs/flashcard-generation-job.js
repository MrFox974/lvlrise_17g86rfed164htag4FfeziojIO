/**
 * Génération d'une collection de flashcards, exécutée en arrière-plan.
 *
 * Lancé par une invocation Lambda asynchrone (ou setImmediate en local) juste
 * après la réponse 202 : l'utilisateur peut fermer l'application, la génération
 * se poursuit et il est averti par notification push quand c'est prêt.
 *
 * Les cartes sont enregistrées groupe par groupe, pas à la fin : une panne au
 * huitième groupe laisse les sept premiers utilisables, et la progression est
 * visible en temps réel.
 */
const FlashcardJob = require('../models/FlashcardJob');
const FlashcardDeck = require('../models/FlashcardDeck');
const FlashcardChapter = require('../models/FlashcardChapter');
const Flashcard = require('../models/Flashcard');
const generationService = require('../services/flashcard-generation.service');
const planRestrictionsService = require('../services/planRestrictionsService');
const uploadService = require('../services/upload.service');
const pushService = require('../services/push.service');

/** Part de la progression consacrée au plan, avant la première carte. */
const PLAN_PROGRESS = 10;

/**
 * En deçà, le texte tiré des documents joints ne permet pas de produire des
 * cartes qui portent réellement sur eux.
 */
const MIN_SOURCE_CHARS = 200;

async function update(job, fields) {
  Object.assign(job, fields);
  // Sequelize ne détecte pas la mutation d'une colonne JSON réassignée à une
  // valeur structurellement proche : sans ce marquage, `stats` peut ne pas être
  // écrit.
  if (fields.stats !== undefined) job.changed('stats', true);
  await job.save();
}

/** Le job a-t-il été annulé entre-temps ? Relu en base à chaque groupe. */
async function isCanceled(jobId) {
  const fresh = await FlashcardJob.findByPk(jobId, { attributes: ['status'] });
  return !fresh || fresh.status === 'canceled';
}

async function notifyDone(job, deck, cardsCreated, createdDeck = true) {
  try {
    await pushService.sendToUser(job.user_id, {
      title: createdDeck ? 'Collection prête 🎴' : 'Nouvelles cartes prêtes 🎴',
      body: `« ${deck.name} » — ${cardsCreated} carte${cardsCreated > 1 ? 's' : ''} à réviser.`,
      tag: `lvlrise-flashcard-job-${job.id}`,
      url: '/home/flashcards',
    });
  } catch (error) {
    // L'absence de notification ne remet pas en cause la collection produite.
    console.error('[flashcard-job] notification impossible :', error.message);
  }
}

async function notifyFailed(job, message) {
  try {
    await pushService.sendToUser(job.user_id, {
      title: 'Génération interrompue',
      body: message.slice(0, 150),
      tag: `lvlrise-flashcard-job-${job.id}`,
      url: '/home/flashcards',
    });
  } catch {
    /* silencieux */
  }
}

/**
 * Exécute la génération complète d'une collection.
 * @param {number} jobId
 */
async function runFlashcardGenerationJob(jobId) {
  const job = await FlashcardJob.findByPk(jobId);
  if (!job) return;
  if (job.status !== 'queued') return; // déjà traité ou annulé

  const stats = {
    requested: job.card_count,
    generated: 0,
    duplicates: 0,
    shortened: 0,
    truncated: 0,
    failedGroups: [],
    // Ajout de cartes à une collection existante : conservé d'un enregistrement
    // à l'autre, c'est ce qui distingue ce travail d'une création.
    append: Boolean(job.deck_id),
  };

  // Un job qui connaît déjà sa collection vient d'un ajout de cartes : elle
  // existe et il faut la compléter, pas en créer une seconde.
  const targetDeck = job.deck_id
    ? await FlashcardDeck.findOne({ where: { id: job.deck_id, user_id: job.user_id } })
    : null;

  try {
    generationService.assertConfigured();
    if (job.deck_id && !targetDeck) {
      throw new Error('La collection à compléter n\'existe plus.');
    }
    await update(job, { status: 'running', step: 'Lecture des documents…', progress: 2 });

    // Texte des pièces jointes : c'est la source de référence quand il y en a.
    const uploadIds = job.upload_ids || [];
    const sourceText = await uploadService.getCombinedText(job.user_id, uploadIds);

    // L'utilisateur a joint des documents mais rien n'en a été tiré (lecture
    // échouée, fichier expiré). Générer quand même reviendrait à inventer un
    // contenu sans rapport avec ce qu'il a fourni : on s'arrête et on le dit.
    if (uploadIds.length > 0 && sourceText.trim().length < MIN_SOURCE_CHARS) {
      throw new Error(
        'Les documents joints n\'ont pas pu être lus, ou leur contenu est trop court. '
        + 'Les cartes auraient porté sur autre chose que vos documents : la génération '
        + 'est annulée. Reprenez la photo bien cadrée et dans le bon sens, ou joignez '
        + 'un PDF contenant du texte sélectionnable.'
      );
    }

    await update(job, { step: 'Conception du plan…', progress: 4 });
    const plan = await generationService.generatePlan(
      job.subject,
      job.card_count,
      job.level,
      job.language,
      sourceText
    );

    if (await isCanceled(job.id)) return;

    // Deux cas : le job naît avec une collection (on y ajoute des cartes), ou
    // il en crée une. Dans le second cas la collection est créée dès que le
    // plan tient : les cartes s'y ajoutent ensuite, ce qui rend la progression
    // visible et sauve le travail partiel.
    let deck = targetDeck;
    const createdDeck = !deck;
    if (createdDeck) {
      const maxPos = await FlashcardDeck.max('position', { where: { user_id: job.user_id } });
      deck = await FlashcardDeck.create({
        user_id: job.user_id,
        name: plan.name,
        description: plan.description,
        position: (maxPos ?? -1) + 1,
      });
    }

    const groupRestriction = await planRestrictionsService.canCreateFlashcardChapter(job.user_id, deck.id);
    // Le quota porte sur la collection entière : les groupes déjà présents
    // comptent, sinon un ajout ferait sauter la limite du plan.
    const maxGroups = Math.max(0, groupRestriction.limit - groupRestriction.current);

    // Destination choisie par l'utilisateur. « auto » laisse le plan créer ses
    // groupes ; « none » range tout hors groupe ; « fixed » vise un groupe
    // existant, qu'on vérifie ici — supprimé entre-temps, les cartes restent
    // dans la collection sans groupe plutôt que d'être perdues.
    const chapterMode = job.chapter_mode || 'auto';
    let fixedChapterId = null;
    if (chapterMode === 'fixed' && job.chapter_id) {
      const target = await FlashcardChapter.findOne({
        where: { id: job.chapter_id, deck_id: deck.id },
      });
      fixedChapterId = target ? target.id : null;
    }

    await update(job, {
      deck_id: deck.id,
      groups_total: plan.groups.length,
      step: `Rédaction des cartes (0/${plan.groups.length})…`,
      progress: PLAN_PROGRESS,
    });

    const seen = new Set();
    // Cartes déjà dans la collection : elles servent de repoussoir pour ne pas
    // regénérer ce que l'utilisateur possède déjà.
    const existingCards = createdDeck
      ? []
      : await Flashcard.findAll({
          where: { deck_id: deck.id },
          attributes: ['front', 'position'],
          raw: true,
        });
    const existingFronts = existingCards.map((c) => c.front);
    existingFronts.forEach((front) => seen.add(generationService.frontKey(front)));
    let cardPosition = existingCards.reduce((max, c) => Math.max(max, (c.position ?? 0) + 1), 0);
    let cardsCreated = 0;
    let chaptersCreated = 0;
    // Les nouveaux groupes se rangent après ceux déjà présents.
    const chapterPositionBase = createdDeck
      ? 0
      : await FlashcardChapter.count({ where: { deck_id: deck.id } });

    for (const [index, group] of plan.groups.entries()) {
      if (await isCanceled(job.id)) return;

      let rawCards = [];
      try {
        rawCards = await generationService.generateGroupCards({
          subject: job.subject,
          collectionName: plan.name,
          group,
          level: job.level,
          language: job.language,
          existingFronts,
          sourceText,
        });
      } catch (error) {
        console.error(`[flashcard-job] groupe « ${group.title} » échoué :`, error.message);
        stats.failedGroups.push(group.title);
        await update(job, {
          groups_done: index + 1,
          stats,
          progress: PLAN_PROGRESS + Math.round(((index + 1) / plan.groups.length) * (100 - PLAN_PROGRESS)),
        });
        continue;
      }

      const prepared = await generationService.prepareCards(rawCards, seen, job.language);
      stats.duplicates += prepared.duplicates;
      stats.shortened += prepared.shortened;
      stats.truncated += prepared.truncated;

      if (prepared.accepted.length > 0) {
        // Au-delà du quota de groupes du plan, les cartes restent dans la
        // collection sans groupe plutôt que d'être perdues.
        // Le quota se compte sur les groupes RÉELLEMENT créés : un groupe qui a
        // échoué ne doit pas consommer une place au passage.
        let chapterId = chapterMode === 'fixed' ? fixedChapterId : null;
        if (chapterMode === 'auto' && chaptersCreated < maxGroups) {
          const chapter = await FlashcardChapter.create({
            deck_id: deck.id,
            title: group.title,
            position: chapterPositionBase + chaptersCreated,
          });
          chapterId = chapter.id;
          chaptersCreated += 1;
        }

        await Flashcard.bulkCreate(
          prepared.accepted.map((card) => ({
            deck_id: deck.id,
            chapter_id: chapterId,
            front: card.front,
            back: card.back,
            position: cardPosition++,
          }))
        );

        cardsCreated += prepared.accepted.length;
        stats.generated += prepared.accepted.length;
        prepared.accepted.forEach((c) => existingFronts.push(c.front));
      }

      await update(job, {
        groups_done: index + 1,
        cards_created: cardsCreated,
        stats,
        step: `Rédaction des cartes (${index + 1}/${plan.groups.length})…`,
        progress: PLAN_PROGRESS + Math.round(((index + 1) / plan.groups.length) * (100 - PLAN_PROGRESS)),
      });
    }

    if (cardsCreated === 0) {
      // Collection vide : on la supprime plutôt que de laisser une coquille.
      // Une collection existante, elle, ne doit évidemment rien perdre.
      if (createdDeck) await deck.destroy();
      throw new Error(
        createdDeck
          ? 'Aucune carte n\'a pu être générée pour ce sujet. Reformulez votre demande.'
          : 'Aucune carte nouvelle n\'a pu être générée : la collection couvre déjà ce sujet. Précisez votre demande.'
      );
    }

    await update(job, {
      status: 'ready',
      step: `${cardsCreated} carte${cardsCreated > 1 ? 's' : ''} générée${cardsCreated > 1 ? 's' : ''}.`,
      progress: 100,
      cards_created: cardsCreated,
      stats,
      finished_at: new Date(),
    });

    await notifyDone(job, deck, cardsCreated, createdDeck);
  } catch (error) {
    console.error('[flashcard-job] échec :', error);
    const fresh = await FlashcardJob.findByPk(jobId);
    if (!fresh || fresh.status === 'canceled') return;
    await update(fresh, {
      status: 'error',
      step: null,
      error: error.message,
      stats,
      finished_at: new Date(),
    });
    await notifyFailed(fresh, error.message);
  }
}

module.exports = { runFlashcardGenerationJob };
