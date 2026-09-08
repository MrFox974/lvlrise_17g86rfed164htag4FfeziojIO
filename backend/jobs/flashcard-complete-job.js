/**
 * Complément d'une collection de flashcards, exécuté en arrière-plan.
 *
 * À la différence de `flashcard-generation-job`, aucun plan n'est demandé au
 * modèle : les groupes existent déjà et ce sont eux le plan. Chaque groupe est
 * étoffé à partir de son propre titre — qui en dit le thème — et des cartes
 * qu'il contient, pour que les cartes ajoutées prolongent le groupe au lieu de
 * répéter ce qu'il couvre déjà.
 *
 * Les cartes sont enregistrées groupe par groupe : une panne au huitième groupe
 * laisse les sept premiers utilisables.
 */
const FlashcardJob = require('../models/FlashcardJob');
const FlashcardDeck = require('../models/FlashcardDeck');
const FlashcardChapter = require('../models/FlashcardChapter');
const Flashcard = require('../models/Flashcard');
const generationService = require('../services/flashcard-generation.service');
const planRestrictionsService = require('../services/planRestrictionsService');
const pushService = require('../services/push.service');

/** Part de la progression consacrée à la lecture de la collection. */
const SETUP_PROGRESS = 8;

async function update(job, fields) {
  Object.assign(job, fields);
  // Sequelize ne détecte pas la mutation d'une colonne JSON réassignée à une
  // valeur structurellement proche : sans ce marquage, `stats` peut ne pas être écrit.
  if (fields.stats !== undefined) job.changed('stats', true);
  await job.save();
}

async function isCanceled(jobId) {
  const fresh = await FlashcardJob.findByPk(jobId, { attributes: ['status'] });
  return !fresh || fresh.status === 'canceled';
}

/**
 * Périmètre confié au modèle pour un groupe.
 *
 * Le titre du groupe porte déjà le thème ; ce qu'il faut ajouter, c'est
 * l'intention — prolonger sans redire — et la consigne éventuelle de
 * l'utilisateur.
 */
function buildFocus(refinePrompt, existingCount) {
  const base = existingCount > 0
    ? `Étoffer ce groupe, qui contient déjà ${existingCount} carte(s). Reste `
      + 'strictement dans son thème et complète ce qui n\'y est pas encore traité : '
      + 'angles voisins, cas particuliers, nuances. Ne reformule aucune carte existante.'
    : 'Ce groupe est vide : pose les cartes fondatrices de son thème.';
  const refine = (refinePrompt || '').trim();
  return refine ? `${base}\nConsigne de l'utilisateur : ${refine}` : base;
}

async function notifyDone(job, deck, cardsCreated) {
  try {
    await pushService.sendToUser(job.user_id, {
      title: 'Collection complétée 🎴',
      body: `« ${deck.name} » — ${cardsCreated} carte${cardsCreated > 1 ? 's' : ''} ajoutée${cardsCreated > 1 ? 's' : ''}.`,
      tag: `lvlrise-flashcard-job-${job.id}`,
      url: '/home/flashcards',
    });
  } catch (error) {
    console.error('[flashcard-complete] notification impossible :', error.message);
  }
}

async function notifyFailed(job, message) {
  try {
    await pushService.sendToUser(job.user_id, {
      title: 'Complément interrompu',
      body: message.slice(0, 150),
      tag: `lvlrise-flashcard-job-${job.id}`,
      url: '/home/flashcards',
    });
  } catch {
    /* silencieux */
  }
}

/**
 * Étoffe les groupes d'une collection existante.
 * @param {number} jobId
 */
async function runFlashcardCompleteJob(jobId) {
  const job = await FlashcardJob.findByPk(jobId);
  if (!job) return;
  if (job.status !== 'queued') return;

  const stats = {
    generated: 0,
    duplicates: 0,
    shortened: 0,
    truncated: 0,
    failedGroups: [],
    // Ce travail ajoute toujours à une collection existante.
    append: true,
  };

  try {
    generationService.assertConfigured();

    const deck = await FlashcardDeck.findOne({
      where: { id: job.deck_id, user_id: job.user_id },
    });
    if (!deck) throw new Error('La collection à compléter n\'existe plus.');

    await update(job, { status: 'running', step: 'Lecture des groupes…', progress: 3 });

    // Un seul groupe ou tous : c'est le seul écart entre les deux portées.
    const where = { deck_id: deck.id };
    if (job.chapter_mode === 'fixed' && job.chapter_id) where.id = job.chapter_id;
    const chapters = await FlashcardChapter.findAll({
      where,
      order: [['position', 'ASC'], ['id', 'ASC']],
    });
    if (chapters.length === 0) {
      throw new Error(
        job.chapter_mode === 'fixed'
          ? 'Ce groupe de cartes n\'existe plus.'
          : 'Cette collection n\'a aucun groupe de cartes à compléter. Créez-en un d\'abord.'
      );
    }

    const cardRestriction = await planRestrictionsService.canCreateFlashcard(job.user_id);
    let available = Math.max(0, cardRestriction.limit - cardRestriction.current);
    if (available === 0) {
      throw new Error(
        `Limite de flashcards atteinte pour votre plan ${cardRestriction.plan} `
        + `(${cardRestriction.current}/${cardRestriction.limit}).`
      );
    }

    // Toutes les cartes de la collection : le dédoublonnage porte sur l'ensemble,
    // pour qu'un groupe ne reprenne pas ce qu'un autre traite déjà.
    const deckCards = await Flashcard.findAll({
      where: { deck_id: deck.id },
      attributes: ['front', 'chapter_id', 'position'],
      raw: true,
    });
    const seen = new Set();
    deckCards.forEach((c) => seen.add(generationService.frontKey(c.front)));
    let cardPosition = deckCards.reduce((max, c) => Math.max(max, (c.position ?? 0) + 1), 0);

    await update(job, {
      groups_total: chapters.length,
      step: `Complément des groupes (0/${chapters.length})…`,
      progress: SETUP_PROGRESS,
    });

    let cardsCreated = 0;

    for (const [index, chapter] of chapters.entries()) {
      if (await isCanceled(job.id)) return;

      const progressAfter = SETUP_PROGRESS
        + Math.round(((index + 1) / chapters.length) * (100 - SETUP_PROGRESS));

      if (available <= 0) {
        // Quota épuisé : on s'arrête proprement, ce qui est écrit reste acquis.
        await update(job, { groups_done: index + 1, stats, progress: progressAfter });
        continue;
      }

      const groupFronts = deckCards
        .filter((c) => String(c.chapter_id) === String(chapter.id))
        .map((c) => c.front);
      const otherFronts = deckCards
        .filter((c) => String(c.chapter_id) !== String(chapter.id))
        .map((c) => c.front);
      const perGroup = Math.min(job.card_count, available);

      let rawCards = [];
      try {
        rawCards = await generationService.generateGroupCards({
          subject: job.subject,
          collectionName: deck.name,
          group: {
            title: chapter.title,
            focus: buildFocus(job.refine_prompt, groupFronts.length),
            cardCount: perGroup,
          },
          level: job.level,
          language: job.language,
          // `generateGroupCards` ne retient que les dernières : les cartes du
          // groupe visé passent en queue, ce sont elles qu'il ne faut pas redire.
          existingFronts: [...otherFronts, ...groupFronts],
        });
      } catch (error) {
        console.error(`[flashcard-complete] groupe « ${chapter.title} » échoué :`, error.message);
        stats.failedGroups.push(chapter.title);
        await update(job, { groups_done: index + 1, stats, progress: progressAfter });
        continue;
      }

      const prepared = await generationService.prepareCards(rawCards, seen, job.language);
      stats.duplicates += prepared.duplicates;
      stats.shortened += prepared.shortened;
      stats.truncated += prepared.truncated;

      const accepted = prepared.accepted.slice(0, available);
      if (accepted.length > 0) {
        await Flashcard.bulkCreate(
          accepted.map((card) => ({
            deck_id: deck.id,
            chapter_id: chapter.id,
            front: card.front,
            back: card.back,
            position: cardPosition++,
          }))
        );
        cardsCreated += accepted.length;
        stats.generated += accepted.length;
        available -= accepted.length;
        // Les cartes fraîches comptent pour les groupes suivants.
        accepted.forEach((c) => deckCards.push({
          front: c.front,
          chapter_id: chapter.id,
          position: cardPosition,
        }));
      }

      await update(job, {
        groups_done: index + 1,
        cards_created: cardsCreated,
        stats,
        step: `Complément des groupes (${index + 1}/${chapters.length})…`,
        progress: progressAfter,
      });
    }

    if (cardsCreated === 0) {
      throw new Error(
        'Aucune carte nouvelle n\'a pu être générée : les groupes couvrent déjà '
        + 'leur thème. Ajoutez une consigne pour cibler un angle précis.'
      );
    }

    await update(job, {
      status: 'ready',
      step: `${cardsCreated} carte${cardsCreated > 1 ? 's' : ''} ajoutée${cardsCreated > 1 ? 's' : ''}.`,
      progress: 100,
      cards_created: cardsCreated,
      stats,
      finished_at: new Date(),
    });

    await notifyDone(job, deck, cardsCreated);
  } catch (error) {
    console.error('[flashcard-complete] échec :', error);
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

module.exports = { runFlashcardCompleteJob };
