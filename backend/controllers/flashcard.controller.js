const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const FlashcardDeck = require('../models/FlashcardDeck');
const FlashcardChapter = require('../models/FlashcardChapter');
const Flashcard = require('../models/Flashcard');
const FlashcardJob = require('../models/FlashcardJob');
const spacedRepetitionService = require('../services/spaced-repetition.service');
const planRestrictionsService = require('../services/planRestrictionsService');
const flashcardGenerationService = require('../services/flashcard-generation.service');
const { isLambda, invokeWorkerAsync } = require('../utils/invoke-worker');
const { runFlashcardGenerationJob } = require('../jobs/flashcard-generation-job');
const { runFlashcardSingleCardJob } = require('../jobs/flashcard-single-card-job');
const { runFlashcardCompleteJob } = require('../jobs/flashcard-complete-job');
const { FRONT_MAX_CHARS, BACK_MAX_CHARS, fitText } = require('../utils/flashcard-limits');

/**
 * Liste des decks de l'utilisateur
 */
exports.getAllDecks = async (req, res) => {
  try {
    const decks = await FlashcardDeck.findAll({
      where: { user_id: req.user_id },
      order: [['position', 'ASC'], ['created_at', 'DESC']],
      include: [
        {
          model: Flashcard,
          as: 'flashcards',
          attributes: ['id'],
        },
      ],
    });

    const deckIds = decks.map((d) => d.id);
    const now = new Date();
    const dueCountRows = await Flashcard.findAll({
      where: {
        deck_id: { [Op.in]: deckIds },
        [Op.or]: [{ next_review_at: null }, { next_review_at: { [Op.lte]: now } }],
      },
      attributes: [[sequelize.fn('COUNT', sequelize.col('id')), 'count'], 'deck_id'],
      group: ['deck_id'],
      raw: true,
    });
    const dueCountMap = Object.fromEntries(dueCountRows.map((r) => [r.deck_id, parseInt(r.count, 10)]));

    const decksWithCount = decks.map((d) => {
      const data = d.toJSON();
      data.card_count = data.flashcards?.length ?? 0;
      data.due_count = dueCountMap[d.id] ?? 0;
      delete data.flashcards;
      return data;
    });

    res.json({ decks: decksWithCount });
  } catch (error) {
    console.error('Erreur lors de la récupération des decks:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

/**
 * Créer un deck
 */
exports.createDeck = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Le nom de la collection est requis' });
    }

    // Vérification des restrictions du plan
    const restriction = await planRestrictionsService.canCreateFlashcardDeck(req.user_id);
    if (!restriction.allowed) {
      return res.status(403).json({
        error: `Limite de collections atteinte pour votre plan ${restriction.plan}. Vous avez ${restriction.current}/${restriction.limit} collections. Passez à un plan supérieur pour créer plus de collections.`,
        restriction: {
          current: restriction.current,
          limit: restriction.limit,
          plan: restriction.plan,
        },
      });
    }

    const maxPos = await FlashcardDeck.max('position', {
      where: { user_id: req.user_id },
    });
    const position = (maxPos ?? -1) + 1;

    const deck = await FlashcardDeck.create({
      user_id: req.user_id,
      name: String(name).trim(),
      description: description ? String(description).trim() : null,
      position,
    });

    res.status(201).json({ deck });
  } catch (error) {
    console.error('Erreur lors de la création du deck:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

/** Vue du job transmise au navigateur. */
function summarizeJob(job) {
  return {
    id: job.id,
    subject: job.subject,
    mode: job.mode || 'deck',
    status: job.status,
    step: job.step,
    progress: job.progress,
    deck_id: job.deck_id,
    chapter_mode: job.chapter_mode || 'auto',
    chapter_id: job.chapter_id,
    refine_prompt: job.refine_prompt || null,
    groups_total: job.groups_total,
    groups_done: job.groups_done,
    cards_created: job.cards_created,
    card_count: job.card_count,
    proposals: job.proposals || null,
    stats: job.stats,
    error: job.error,
    created_at: job.created_at,
    finished_at: job.finished_at,
    done: job.status === 'ready',
    failed: job.status === 'error',
  };
}

/**
 * Destination des cartes dans la collection, telle que demandée par le
 * navigateur : rien (groupes déduits du plan), « none » (hors groupe), ou
 * l'identifiant d'un groupe existant.
 * Un groupe qui n'appartient pas à la collection est ignoré plutôt que refusé :
 * la génération vaut mieux qu'une erreur pour un choix devenu caduc.
 *
 * @returns {Promise<{ chapter_mode: 'auto'|'none'|'fixed', chapter_id: ?number }>}
 */
async function resolveChapterTarget(deckId, chapterId) {
  if (chapterId == null || chapterId === '' || chapterId === 'auto') {
    return { chapter_mode: 'auto', chapter_id: null };
  }
  if (chapterId === 'none') {
    return { chapter_mode: 'none', chapter_id: null };
  }
  const id = parseInt(chapterId, 10);
  if (!Number.isInteger(id)) return { chapter_mode: 'auto', chapter_id: null };

  const chapter = await FlashcardChapter.findOne({ where: { id, deck_id: deckId } });
  return chapter
    ? { chapter_mode: 'fixed', chapter_id: chapter.id }
    : { chapter_mode: 'none', chapter_id: null };
}

/**
 * Génération déjà en cours qui empêcherait celle qu'on demande.
 *
 * La contrainte est par nature de travail, pas globale : une carte à l'unité
 * est l'affaire de quelques secondes et n'a aucune raison d'attendre la fin
 * d'une collection de cinquante cartes. Deux travaux de MÊME nature, en
 * revanche, se marcheraient dessus (double consommation du quota, deux
 * collections concurrentes).
 */
function findRunningJob(userId, mode) {
  const isSingle = mode === 'single';
  return FlashcardJob.findOne({
    where: {
      user_id: userId,
      status: { [Op.in]: ['queued', 'running'] },
      // Les jobs créés avant l'arrivée de la colonne `mode` sont des générations
      // de collection : d'où le NULL rangé du côté « pas une carte à l'unité ».
      ...(isSingle
        ? { mode: 'single' }
        : { [Op.or]: [{ mode: null }, { mode: { [Op.ne]: 'single' } }] }),
    },
  });
}

/**
 * Lance la génération d'une collection en arrière-plan.
 * Body: { subject, cardCount?, level?, language?, uploadIds? }
 *
 * Répond immédiatement en 202 : le travail se poursuit côté serveur même si
 * l'utilisateur ferme l'application, et une notification push l'avertit quand
 * la collection est prête.
 */
exports.generateDeck = async (req, res) => {
  try {
    const { subject, cardCount, level, language, uploadIds } = req.body || {};
    if (!subject || !String(subject).trim()) {
      return res.status(400).json({ error: 'Le sujet est requis' });
    }

    // Quota de collections.
    const deckRestriction = await planRestrictionsService.canCreateFlashcardDeck(req.user_id);
    if (!deckRestriction.allowed) {
      return res.status(403).json({
        error: `Limite de collections atteinte pour votre plan ${deckRestriction.plan}. Vous avez ${deckRestriction.current}/${deckRestriction.limit} collections.`,
        restriction: deckRestriction,
      });
    }

    // Quota de cartes : on ne génère jamais plus que ce que le plan autorise,
    // sinon la moitié des cartes serait rejetée après un long temps d'attente.
    const cardRestriction = await planRestrictionsService.canCreateFlashcard(req.user_id);
    const available = Math.max(0, cardRestriction.limit - cardRestriction.current);
    if (available === 0) {
      return res.status(403).json({
        error: `Limite de flashcards atteinte pour votre plan ${cardRestriction.plan}. Vous avez ${cardRestriction.current}/${cardRestriction.limit} cartes.`,
        restriction: cardRestriction,
      });
    }

    const asked = Number(cardCount) || flashcardGenerationService.DEFAULT_CARDS;
    const effectiveCount = flashcardGenerationService.clampCardCount(Math.min(asked, available));

    // Une seule génération de collection à la fois : deux jobs simultanés
    // produiraient deux collections concurrentes et doubleraient la
    // consommation du quota.
    const running = await findRunningJob(req.user_id, 'deck');
    if (running) {
      return res.status(409).json({
        error: 'Une génération est déjà en cours.',
        job: summarizeJob(running),
      });
    }

    const job = await FlashcardJob.create({
      user_id: req.user_id,
      subject: String(subject).trim(),
      mode: 'deck',
      card_count: effectiveCount,
      level: level || 'intermediaire',
      language: language && String(language).trim() ? String(language).trim() : 'français',
      upload_ids: Array.isArray(uploadIds)
        ? uploadIds.map((id) => parseInt(id, 10)).filter(Number.isInteger).slice(0, 10)
        : [],
      status: 'queued',
      step: 'En attente de démarrage…',
    });

    // En Lambda : nouvelle invocation asynchrone, qui survit à la réponse HTTP.
    // En local : setImmediate dans le même processus.
    if (isLambda()) {
      invokeWorkerAsync({ internal: 'run-flashcard-generation', jobId: job.id }).catch((err) =>
        console.error('Invoke worker run-flashcard-generation:', err)
      );
    } else {
      setImmediate(() => runFlashcardGenerationJob(job.id));
    }

    res.status(202).json({
      job: summarizeJob(job),
      // Signalé honnêtement plutôt que silencieusement raboté.
      capped: effectiveCount < asked ? { asked, generated: effectiveCount, reason: 'quota' } : null,
    });
  } catch (error) {
    console.error('Erreur lors du lancement de la génération:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
};

/**
 * POST /api/flashcard-decks/:deckId/cards/generate
 * Ajoute des cartes générées à une collection existante.
 *
 * Même mécanique que la génération d'une collection, à ceci près que le job
 * naît avec sa collection : le worker y ajoute ses cartes au lieu d'en créer
 * une nouvelle.
 */
exports.generateDeckCards = async (req, res) => {
  try {
    const { deckId } = req.params;
    const { subject, cardCount, level, language, uploadIds, chapterId } = req.body || {};

    const deck = await FlashcardDeck.findOne({
      where: { id: deckId, user_id: req.user_id },
    });
    if (!deck) {
      return res.status(404).json({ error: 'Collection introuvable' });
    }
    if (!subject || !String(subject).trim()) {
      return res.status(400).json({ error: 'Le sujet est requis' });
    }

    const cardRestriction = await planRestrictionsService.canCreateFlashcard(req.user_id);
    const available = Math.max(0, cardRestriction.limit - cardRestriction.current);
    if (available === 0) {
      return res.status(403).json({
        error: `Limite de flashcards atteinte pour votre plan ${cardRestriction.plan}. Vous avez ${cardRestriction.current}/${cardRestriction.limit} cartes.`,
        restriction: cardRestriction,
      });
    }

    const asked = Number(cardCount) || flashcardGenerationService.DEFAULT_CARDS;
    const effectiveCount = flashcardGenerationService.clampCardCount(Math.min(asked, available));

    const running = await findRunningJob(req.user_id, 'cards');
    if (running) {
      return res.status(409).json({
        error: 'Une génération est déjà en cours.',
        job: summarizeJob(running),
      });
    }

    const target = await resolveChapterTarget(deck.id, chapterId);

    const job = await FlashcardJob.create({
      user_id: req.user_id,
      subject: String(subject).trim(),
      mode: 'cards',
      card_count: effectiveCount,
      level: level || 'intermediaire',
      language: language && String(language).trim() ? String(language).trim() : 'français',
      upload_ids: Array.isArray(uploadIds)
        ? uploadIds.map((id) => parseInt(id, 10)).filter(Number.isInteger).slice(0, 10)
        : [],
      // Collection connue dès le départ : le worker complète au lieu de créer.
      deck_id: deck.id,
      chapter_mode: target.chapter_mode,
      chapter_id: target.chapter_id,
      // `deck_id` finit par être renseigné aussi pour une création : ce drapeau
      // est ce qui permet de distinguer les deux, y compris côté navigateur.
      stats: { append: true },
      status: 'queued',
      step: 'En attente de démarrage…',
    });

    if (isLambda()) {
      invokeWorkerAsync({ internal: 'run-flashcard-generation', jobId: job.id }).catch((err) =>
        console.error('Invoke worker run-flashcard-generation:', err)
      );
    } else {
      setImmediate(() => runFlashcardGenerationJob(job.id));
    }

    res.status(202).json({
      job: summarizeJob(job),
      capped: effectiveCount < asked ? { asked, generated: effectiveCount, reason: 'quota' } : null,
    });
  } catch (error) {
    console.error('Erreur lors du lancement de la génération de cartes:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
};

/**
 * POST /api/flashcard-decks/:deckId/cards/generate-one
 * Génère UNE carte (ou quelques propositions) à partir d'une demande libre :
 * un mot, une description qui cherche son mot, une question, éventuellement
 * accompagnés de documents.
 *
 * Body: { query, level?, language?, uploadIds?, chapterId? }
 *
 * Comme pour une collection, la réponse est immédiate : la réflexion se
 * poursuit côté serveur. À la différence d'une collection, rien n'est écrit
 * dans la collection : les propositions attendent la validation de
 * l'utilisateur (voir acceptJobProposals).
 */
exports.generateSingleCard = async (req, res) => {
  try {
    const { deckId } = req.params;
    const { query, level, language, uploadIds, chapterId } = req.body || {};

    const deck = await FlashcardDeck.findOne({
      where: { id: deckId, user_id: req.user_id },
    });
    if (!deck) {
      return res.status(404).json({ error: 'Collection introuvable' });
    }
    if (!query || !String(query).trim()) {
      return res.status(400).json({ error: 'Indiquez un mot, une notion ou une question' });
    }

    // Le quota est vérifié dès maintenant : inutile de faire réfléchir le
    // serveur pour des cartes qui ne pourront pas être enregistrées.
    const cardRestriction = await planRestrictionsService.canCreateFlashcard(req.user_id);
    if (cardRestriction.limit - cardRestriction.current <= 0) {
      return res.status(403).json({
        error: `Limite de flashcards atteinte pour votre plan ${cardRestriction.plan}. Vous avez ${cardRestriction.current}/${cardRestriction.limit} cartes.`,
        restriction: cardRestriction,
      });
    }

    const running = await findRunningJob(req.user_id, 'single');
    if (running) {
      return res.status(409).json({
        error: 'Une carte est déjà en cours de rédaction.',
        job: summarizeJob(running),
      });
    }

    const target = await resolveChapterTarget(deck.id, chapterId);

    const job = await FlashcardJob.create({
      user_id: req.user_id,
      subject: String(query).trim().slice(0, 2000),
      mode: 'single',
      card_count: 1,
      level: level || 'intermediaire',
      language: language && String(language).trim() ? String(language).trim() : 'français',
      upload_ids: Array.isArray(uploadIds)
        ? uploadIds.map((id) => parseInt(id, 10)).filter(Number.isInteger).slice(0, 10)
        : [],
      deck_id: deck.id,
      // Une carte à l'unité ne crée jamais de groupe : c'est soit celui qu'on a
      // choisi, soit aucun.
      chapter_mode: target.chapter_mode === 'auto' ? 'none' : target.chapter_mode,
      chapter_id: target.chapter_id,
      stats: { single: true, published: false },
      status: 'queued',
      step: 'En attente de démarrage…',
    });

    if (isLambda()) {
      invokeWorkerAsync({ internal: 'run-flashcard-single-card', jobId: job.id }).catch((err) =>
        console.error('Invoke worker run-flashcard-single-card:', err)
      );
    } else {
      setImmediate(() => runFlashcardSingleCardJob(job.id));
    }

    res.status(202).json({ job: summarizeJob(job) });
  } catch (error) {
    console.error('Erreur lors du lancement de la rédaction d\'une carte:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
};

/**
 * POST /api/flashcard-jobs/:id/accept
 * Enregistre les propositions retenues par l'utilisateur.
 * Body: { cards: [{ front, back }], chapterId? }
 *
 * Le navigateur envoie ce qu'il a gardé — l'utilisateur ayant écarté le reste
 * d'un glissement — et le job est marqué publié : rouvrir la fenêtre ne
 * représentera plus des propositions déjà traitées.
 */
exports.acceptJobProposals = async (req, res) => {
  try {
    const job = await FlashcardJob.findOne({
      where: { id: parseInt(req.params.id, 10), user_id: req.user_id },
    });
    if (!job) return res.status(404).json({ error: 'Génération introuvable' });
    if (job.status !== 'ready') {
      return res.status(409).json({ error: 'Cette génération n\'est pas terminée.' });
    }

    const deck = await FlashcardDeck.findOne({
      where: { id: job.deck_id, user_id: req.user_id },
    });
    if (!deck) return res.status(404).json({ error: 'Collection introuvable' });

    // Abandon assumé : l'utilisateur repart d'une autre demande. Le job est
    // soldé pour que ses propositions ne lui soient pas resservies à la
    // prochaine ouverture.
    if (req.body?.discard === true) {
      job.stats = { ...(job.stats || {}), published: true, kept: 0 };
      job.changed('stats', true);
      await job.save();
      return res.json({ cards: [], created: 0, capped: null });
    }

    const requested = Array.isArray(req.body?.cards) ? req.body.cards.slice(0, 10) : [];
    const cards = requested
      .map((card) => ({
        front: fitText(card?.front, FRONT_MAX_CHARS),
        back: fitText(card?.back, BACK_MAX_CHARS),
      }))
      .filter((card) => card.front && card.back);

    if (cards.length === 0) {
      return res.status(400).json({ error: 'Aucune carte à enregistrer' });
    }

    // Quota : on n'enregistre que ce qui tient dans le plan, et on le dit.
    const restriction = await planRestrictionsService.canCreateFlashcard(req.user_id);
    const available = Math.max(0, restriction.limit - restriction.current);
    if (available === 0) {
      return res.status(403).json({
        error: `Limite de flashcards atteinte pour votre plan ${restriction.plan}. Vous avez ${restriction.current}/${restriction.limit} cartes.`,
        restriction,
      });
    }
    const kept = cards.slice(0, available);

    const target = await resolveChapterTarget(
      deck.id,
      req.body?.chapterId !== undefined ? req.body.chapterId : job.chapter_id
    );
    const chapterId = target.chapter_mode === 'fixed' ? target.chapter_id : null;

    const maxPos = await Flashcard.max('position', { where: { deck_id: deck.id } });
    let position = (maxPos ?? -1) + 1;

    const created = await Flashcard.bulkCreate(
      kept.map((card) => ({
        deck_id: deck.id,
        chapter_id: chapterId,
        front: card.front,
        back: card.back,
        position: position++,
      }))
    );

    job.cards_created = (job.cards_created || 0) + created.length;
    job.stats = { ...(job.stats || {}), published: true, kept: created.length };
    // Colonne JSON réassignée : Sequelize ne voit pas toujours la mutation.
    job.changed('stats', true);
    await job.save();

    res.status(201).json({
      cards: created,
      created: created.length,
      capped: kept.length < cards.length
        ? { asked: cards.length, created: kept.length, reason: 'quota' }
        : null,
    });
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement des propositions:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

/**
 * POST /api/flashcard-decks/:deckId/complete
 * Étoffe les groupes d'une collection : chacun est complété à partir de son
 * propre thème et des cartes qu'il contient déjà.
 * Body: { scope?: 'all'|<chapterId>, cardsPerGroup?, refinePrompt? }
 *
 * Le sujet n'est pas demandé : c'est celui d'origine de la collection, retrouvé
 * ici. Demander à l'utilisateur de le retaper reviendrait à lui faire refaire
 * le travail de cadrage qu'il a déjà fait.
 */
exports.completeDeck = async (req, res) => {
  try {
    const { deckId } = req.params;
    const { scope, cardsPerGroup, refinePrompt } = req.body || {};

    const deck = await FlashcardDeck.findOne({
      where: { id: deckId, user_id: req.user_id },
    });
    if (!deck) {
      return res.status(404).json({ error: 'Collection introuvable' });
    }

    // Portée : tous les groupes, ou un seul.
    let chapterMode = 'all';
    let chapterId = null;
    if (scope != null && scope !== '' && scope !== 'all') {
      const id = parseInt(scope, 10);
      if (!Number.isInteger(id)) {
        return res.status(400).json({ error: 'Groupe de cartes invalide' });
      }
      const chapter = await FlashcardChapter.findOne({ where: { id, deck_id: deck.id } });
      if (!chapter) {
        return res.status(404).json({ error: 'Groupe de cartes introuvable' });
      }
      chapterMode = 'fixed';
      chapterId = chapter.id;
    }

    const chapterCount = await FlashcardChapter.count({ where: { deck_id: deck.id } });
    if (chapterCount === 0) {
      return res.status(400).json({
        error: 'Cette collection n\'a aucun groupe de cartes. Créez-en un avant de compléter.',
      });
    }

    const cardRestriction = await planRestrictionsService.canCreateFlashcard(req.user_id);
    const available = Math.max(0, cardRestriction.limit - cardRestriction.current);
    if (available === 0) {
      return res.status(403).json({
        error: `Limite de flashcards atteinte pour votre plan ${cardRestriction.plan}. Vous avez ${cardRestriction.current}/${cardRestriction.limit} cartes.`,
        restriction: cardRestriction,
      });
    }

    const askedPerGroup = Number(cardsPerGroup) || 5;
    const perGroup = Math.max(1, Math.min(20, askedPerGroup));

    const running = await findRunningJob(req.user_id, 'complete');
    if (running) {
      return res.status(409).json({
        error: 'Une génération est déjà en cours.',
        job: summarizeJob(running),
      });
    }

    // Sujet d'origine de la collection : celui de sa génération, à défaut son
    // nom et sa description.
    const sourceJob = await FlashcardJob.findOne({
      where: {
        user_id: req.user_id,
        deck_id: deck.id,
        [Op.or]: [{ mode: null }, { mode: { [Op.notIn]: ['single', 'complete'] } }],
      },
      order: [['created_at', 'DESC']],
    });
    const subject = sourceJob
      ? sourceJob.subject
      : (deck.description ? `${deck.name} — ${deck.description}` : deck.name);

    const job = await FlashcardJob.create({
      user_id: req.user_id,
      subject,
      mode: 'complete',
      // Plafond par groupe : le total dépend du nombre de groupes traités.
      card_count: perGroup,
      level: sourceJob ? sourceJob.level : 'intermediaire',
      language: sourceJob ? sourceJob.language : 'français',
      deck_id: deck.id,
      chapter_mode: chapterMode,
      chapter_id: chapterId,
      refine_prompt: refinePrompt && String(refinePrompt).trim()
        ? String(refinePrompt).trim().slice(0, 2000)
        : null,
      stats: { append: true },
      status: 'queued',
      step: 'En attente de démarrage…',
    });

    if (isLambda()) {
      invokeWorkerAsync({ internal: 'run-flashcard-complete', jobId: job.id }).catch((err) =>
        console.error('Invoke worker run-flashcard-complete:', err)
      );
    } else {
      setImmediate(() => runFlashcardCompleteJob(job.id));
    }

    res.status(202).json({ job: summarizeJob(job) });
  } catch (error) {
    console.error('Erreur lors du lancement du complément de collection:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
};

/**
 * GET /api/flashcard-decks/:deckId/generation-context
 * Sujet et réglages ayant servi à créer la collection, pour les reproposer
 * tels quels quand on y ajoute des cartes. À défaut de génération d'origine
 * (collection créée à la main), le nom et la description en tiennent lieu.
 */
exports.getDeckGenerationContext = async (req, res) => {
  try {
    const { deckId } = req.params;
    const deck = await FlashcardDeck.findOne({
      where: { id: deckId, user_id: req.user_id },
    });
    if (!deck) {
      return res.status(404).json({ error: 'Collection introuvable' });
    }

    // Une carte à l'unité porte sur un mot, pas sur le sujet de la collection :
    // la reprendre ici proposerait « carthésien » comme sujet d'un lot entier.
    const job = await FlashcardJob.findOne({
      where: {
        user_id: req.user_id,
        deck_id: deck.id,
        [Op.or]: [{ mode: null }, { mode: { [Op.ne]: 'single' } }],
      },
      order: [['created_at', 'DESC']],
    });

    const fallbackSubject = deck.description
      ? `${deck.name} — ${deck.description}`
      : deck.name;

    res.json({
      context: {
        subject: job ? job.subject : fallbackSubject,
        level: job ? job.level : 'intermediaire',
        language: job ? job.language : 'français',
        card_count: job ? job.card_count : null,
        from_generation: Boolean(job),
      },
    });
  } catch (error) {
    console.error('Erreur lecture du contexte de génération:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

/** GET /api/flashcard-jobs/:id — état d'une génération. */
exports.getGenerationJob = async (req, res) => {
  try {
    const job = await FlashcardJob.findOne({
      where: { id: parseInt(req.params.id, 10), user_id: req.user_id },
    });
    if (!job) return res.status(404).json({ error: 'Génération introuvable' });
    res.json({ job: summarizeJob(job) });
  } catch (error) {
    console.error('Erreur lecture job flashcards:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

/**
 * GET /api/flashcard-jobs — générations récentes.
 * Sert à retrouver une génération lancée avant la fermeture de l'application.
 */
exports.listGenerationJobs = async (req, res) => {
  try {
    const jobs = await FlashcardJob.findAll({
      where: { user_id: req.user_id },
      order: [['created_at', 'DESC']],
      limit: 10,
    });
    res.json({ jobs: jobs.map(summarizeJob) });
  } catch (error) {
    console.error('Erreur liste jobs flashcards:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

/**
 * DELETE /api/flashcard-jobs/:id — annule une génération en cours.
 * Le worker relit le statut entre deux groupes et s'arrête de lui-même ; les
 * cartes déjà écrites sont conservées.
 */
exports.cancelGenerationJob = async (req, res) => {
  try {
    const job = await FlashcardJob.findOne({
      where: { id: parseInt(req.params.id, 10), user_id: req.user_id },
    });
    if (!job) return res.status(404).json({ error: 'Génération introuvable' });

    if (!FlashcardJob.TERMINAL_STATUSES.includes(job.status)) {
      await job.update({ status: 'canceled', step: 'Génération annulée.', finished_at: new Date() });
    }
    res.json({ job: summarizeJob(job) });
  } catch (error) {
    console.error('Erreur annulation job flashcards:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

/**
 * Mettre à jour un deck
 */
exports.updateDeck = async (req, res) => {
  try {
    const { id } = req.params;
    const deck = await FlashcardDeck.findOne({
      where: { id, user_id: req.user_id },
    });
    if (!deck) {
      return res.status(404).json({ error: 'Collection introuvable' });
    }

    const { name, description } = req.body;
    if (name !== undefined) deck.name = String(name).trim();
    if (description !== undefined) deck.description = description ? String(description).trim() : null;
    await deck.save();

    res.json({ deck });
  } catch (error) {
    console.error('Erreur lors de la mise à jour du deck:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

/**
 * Supprimer un deck
 */
exports.deleteDeck = async (req, res) => {
  try {
    const { id } = req.params;
    const deck = await FlashcardDeck.findOne({
      where: { id, user_id: req.user_id },
    });
    if (!deck) {
      return res.status(404).json({ error: 'Collection introuvable' });
    }
    await deck.destroy();
    res.status(204).send();
  } catch (error) {
    console.error('Erreur lors de la suppression du deck:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

/**
 * Liste des chapitres d'un deck
 */
exports.getChapters = async (req, res) => {
  try {
    const { deckId } = req.params;
    const deck = await FlashcardDeck.findOne({
      where: { id: deckId, user_id: req.user_id },
    });
    if (!deck) {
      return res.status(404).json({ error: 'Collection introuvable' });
    }
    const chapters = await FlashcardChapter.findAll({
      where: { deck_id: deckId },
      order: [['position', 'ASC'], ['created_at', 'ASC']],
    });
    res.json({ chapters });
  } catch (error) {
    console.error('Erreur lors de la récupération des chapitres:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

exports.createChapter = async (req, res) => {
  try {
    const { deckId } = req.params;
    const { title } = req.body;
    const deck = await FlashcardDeck.findOne({
      where: { id: deckId, user_id: req.user_id },
    });
    if (!deck) {
      return res.status(404).json({ error: 'Collection introuvable' });
    }
    if (!title || !String(title).trim()) {
      return res.status(400).json({ error: 'Le titre du chapitre est requis' });
    }

    // Vérification des restrictions du plan
    const restriction = await planRestrictionsService.canCreateFlashcardChapter(req.user_id, deckId);
    if (!restriction.allowed) {
      return res.status(403).json({
        error: `Limite de groupes atteinte pour votre plan ${restriction.plan}. Cette collection a déjà ${restriction.current}/${restriction.limit} groupes. Passez à un plan supérieur pour créer plus de groupes.`,
        restriction: {
          current: restriction.current,
          limit: restriction.limit,
          plan: restriction.plan,
        },
      });
    }

    const maxPos = await FlashcardChapter.max('position', { where: { deck_id: deckId } });
    const position = (maxPos ?? -1) + 1;
    const chapter = await FlashcardChapter.create({
      deck_id: deckId,
      title: String(title).trim(),
      position,
    });
    res.status(201).json({ chapter });
  } catch (error) {
    console.error('Erreur lors de la création du chapitre:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

exports.updateChapter = async (req, res) => {
  try {
    const { deckId, chapterId } = req.params;
    const deck = await FlashcardDeck.findOne({
      where: { id: deckId, user_id: req.user_id },
    });
    if (!deck) {
      return res.status(404).json({ error: 'Collection introuvable' });
    }
    const chapter = await FlashcardChapter.findOne({
      where: { id: chapterId, deck_id: deckId },
    });
    if (!chapter) {
      return res.status(404).json({ error: 'Chapitre introuvable' });
    }
    const { title } = req.body;
    if (title !== undefined) chapter.title = String(title).trim();
    await chapter.save();
    res.json({ chapter });
  } catch (error) {
    console.error('Erreur lors de la mise à jour du chapitre:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

exports.deleteChapter = async (req, res) => {
  try {
    const { deckId, chapterId } = req.params;
    const deck = await FlashcardDeck.findOne({
      where: { id: deckId, user_id: req.user_id },
    });
    if (!deck) {
      return res.status(404).json({ error: 'Collection introuvable' });
    }
    const chapter = await FlashcardChapter.findOne({
      where: { id: chapterId, deck_id: deckId },
    });
    if (!chapter) {
      return res.status(404).json({ error: 'Chapitre introuvable' });
    }
    await chapter.destroy();
    res.status(204).send();
  } catch (error) {
    console.error('Erreur lors de la suppression du chapitre:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

/**
 * Réorganiser les chapitres d'un deck
 */
exports.reorderChapters = async (req, res) => {
  try {
    const { deckId } = req.params;
    const { chapter_ids } = req.body;

    const deck = await FlashcardDeck.findOne({
      where: { id: deckId, user_id: req.user_id },
    });
    if (!deck) {
      return res.status(404).json({ error: 'Collection introuvable' });
    }

    if (!Array.isArray(chapter_ids)) {
      return res.status(400).json({ error: 'chapter_ids doit être un tableau' });
    }

    const chapterIds = chapter_ids.map((id) => (typeof id === 'number' ? id : parseInt(String(id), 10)));
    if (chapterIds.some((n) => isNaN(n))) {
      return res.status(400).json({ error: 'chapter_ids contient des valeurs invalides' });
    }

    const chapters = await FlashcardChapter.findAll({
      where: { id: { [Op.in]: chapterIds }, deck_id: deckId },
    });

    if (chapters.length !== chapterIds.length) {
      return res.status(400).json({ error: 'Certains chapitres sont introuvables' });
    }

    await Promise.all(
      chapterIds.map((chapterId, index) =>
        FlashcardChapter.update({ position: index }, { where: { id: chapterId, deck_id: deckId } })
      )
    );

    const updatedChapters = await FlashcardChapter.findAll({
      where: { deck_id: deckId },
      order: [['position', 'ASC'], ['created_at', 'ASC']],
    });

    res.json({ chapters: updatedChapters });
  } catch (error) {
    console.error('Erreur reorderChapters:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

/**
 * Réorganiser les cartes d'un chapitre (ou cartes sans chapitre si chapterId = 'none')
 */
exports.reorderCards = async (req, res) => {
  try {
    const { deckId, chapterId } = req.params;
    const { card_ids } = req.body;

    const deck = await FlashcardDeck.findOne({
      where: { id: deckId, user_id: req.user_id },
    });
    if (!deck) {
      return res.status(404).json({ error: 'Collection introuvable' });
    }

    if (!Array.isArray(card_ids)) {
      return res.status(400).json({ error: 'card_ids doit être un tableau' });
    }

    const cardIds = card_ids.map((id) => (typeof id === 'number' ? id : parseInt(String(id), 10)));
    if (cardIds.some((n) => isNaN(n))) {
      return res.status(400).json({ error: 'card_ids contient des valeurs invalides' });
    }

    const chapterFilter = chapterId === 'none' ? null : chapterId;

    const cards = await Flashcard.findAll({
      where: {
        id: { [Op.in]: cardIds },
        deck_id: deckId,
        ...(chapterFilter === null
          ? { chapter_id: null }
          : { chapter_id: chapterFilter }),
      },
    });

    if (cards.length !== cardIds.length) {
      return res.status(400).json({ error: 'Certaines cartes sont introuvables' });
    }

    if (chapterFilter !== null) {
      const chapter = await FlashcardChapter.findOne({
        where: { id: chapterFilter, deck_id: deckId },
      });
      if (!chapter) {
        return res.status(404).json({ error: 'Chapitre introuvable' });
      }
    }

    const cardsToUpdate = cardIds.map((id) => cards.find((c) => c.id === id)).filter(Boolean);
    const minPos = Math.min(...cardsToUpdate.map((c) => c.position ?? 0));

    await Promise.all(
      cardIds.map((cardId, index) =>
        Flashcard.update(
          { position: minPos + index },
          {
            where: {
              id: cardId,
              deck_id: deckId,
              ...(chapterFilter === null ? { chapter_id: null } : { chapter_id: chapterFilter }),
            },
          }
        )
      )
    );

    const updatedCards = await Flashcard.findAll({
      where: { deck_id: deckId },
      order: [['position', 'ASC'], ['created_at', 'ASC']],
      include: [
        { model: FlashcardChapter, as: 'chapter', required: false, attributes: ['id', 'title'] },
      ],
    });

    res.json({ cards: updatedCards });
  } catch (error) {
    console.error('Erreur reorderCards:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

/**
 * Liste des cartes d'un deck (avec infos chapitre)
 */
exports.getCardsByDeck = async (req, res) => {
  try {
    const { deckId } = req.params;
    const deck = await FlashcardDeck.findOne({
      where: { id: deckId, user_id: req.user_id },
    });
    if (!deck) {
      return res.status(404).json({ error: 'Collection introuvable' });
    }

    const cards = await Flashcard.findAll({
      where: { deck_id: deckId },
      order: [['position', 'ASC'], ['created_at', 'ASC']],
      include: [
        {
          model: FlashcardChapter,
          as: 'chapter',
          required: false,
          attributes: ['id', 'title'],
        },
      ],
    });

    res.json({ cards });
  } catch (error) {
    console.error('Erreur lors de la récupération des cartes:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

/**
 * Créer une carte
 * Body: { front, back, chapter_id?, tags?, notes?, source? }
 */
exports.createCard = async (req, res) => {
  try {
    const { deckId } = req.params;
    const { front, back, chapter_id, tags, notes, source } = req.body;

    const deck = await FlashcardDeck.findOne({
      where: { id: deckId, user_id: req.user_id },
    });
    if (!deck) {
      return res.status(404).json({ error: 'Collection introuvable' });
    }
    if (!front || !String(front).trim()) {
      return res.status(400).json({ error: 'Le recto est requis' });
    }
    if (!back || !String(back).trim()) {
      return res.status(400).json({ error: 'Le verso est requis' });
    }

    // Vérification des restrictions du plan
    const restriction = await planRestrictionsService.canCreateFlashcard(req.user_id);
    if (!restriction.allowed) {
      return res.status(403).json({
        error: `Limite de flashcards atteinte pour votre plan ${restriction.plan}. Vous avez ${restriction.current}/${restriction.limit} flashcards. Passez à un plan supérieur pour créer plus de flashcards.`,
        restriction: {
          current: restriction.current,
          limit: restriction.limit,
          plan: restriction.plan,
        },
      });
    }

    const maxPos = await Flashcard.max('position', { where: { deck_id: deckId } });
    const position = (maxPos ?? -1) + 1;

    let chapterId = null;
    if (chapter_id != null) {
      const ch = await FlashcardChapter.findOne({
        where: { id: chapter_id, deck_id: deckId },
      });
      if (ch) chapterId = ch.id;
    }
    const tagsStr = Array.isArray(tags)
      ? JSON.stringify(tags)
      : typeof tags === 'string' && tags.trim()
        ? tags.trim()
        : null;
    const card = await Flashcard.create({
      deck_id: deckId,
      chapter_id: chapterId,
      front: String(front).trim(),
      back: String(back).trim(),
      position,
      tags: tagsStr,
      notes: notes ? String(notes).trim() : null,
      source: source ? String(source).trim() : null,
    });

    res.status(201).json({ card });
  } catch (error) {
    console.error('Erreur lors de la création de la carte:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

/**
 * Mettre à jour une carte
 */
exports.updateCard = async (req, res) => {
  try {
    const { deckId, cardId } = req.params;
    const deck = await FlashcardDeck.findOne({
      where: { id: deckId, user_id: req.user_id },
    });
    if (!deck) {
      return res.status(404).json({ error: 'Collection introuvable' });
    }

    const card = await Flashcard.findOne({
      where: { id: cardId, deck_id: deckId },
    });
    if (!card) {
      return res.status(404).json({ error: 'Carte introuvable' });
    }

    const { front, back, chapter_id, tags, notes, source } = req.body;
    if (front !== undefined) card.front = String(front).trim();
    if (back !== undefined) card.back = String(back).trim();
    if (chapter_id !== undefined) {
      if (chapter_id == null || chapter_id === '') {
        card.chapter_id = null;
      } else {
        const ch = await FlashcardChapter.findOne({
          where: { id: chapter_id, deck_id: deckId },
        });
        card.chapter_id = ch ? ch.id : null;
      }
    }
    if (tags !== undefined) {
      card.tags = Array.isArray(tags)
        ? JSON.stringify(tags)
        : typeof tags === 'string'
          ? (tags.trim() || null)
          : null;
    }
    if (notes !== undefined) card.notes = notes ? String(notes).trim() : null;
    if (source !== undefined) card.source = source ? String(source).trim() : null;
    await card.save();

    res.json({ card });
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la carte:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

/**
 * Supprimer une carte
 */
exports.deleteCard = async (req, res) => {
  try {
    const { deckId, cardId } = req.params;
    const deck = await FlashcardDeck.findOne({
      where: { id: deckId, user_id: req.user_id },
    });
    if (!deck) {
      return res.status(404).json({ error: 'Collection introuvable' });
    }

    const card = await Flashcard.findOne({
      where: { id: cardId, deck_id: deckId },
    });
    if (!card) {
      return res.status(404).json({ error: 'Carte introuvable' });
    }
    await card.destroy();
    res.status(204).send();
  } catch (error) {
    console.error('Erreur lors de la suppression de la carte:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

/**
 * Cartes à réviser aujourd'hui pour un deck (next_review_at <= maintenant ou null)
 */
exports.getDueCards = async (req, res) => {
  try {
    const { deckId } = req.params;
    const deck = await FlashcardDeck.findOne({
      where: { id: deckId, user_id: req.user_id },
    });
    if (!deck) {
      return res.status(404).json({ error: 'Collection introuvable' });
    }

    const now = new Date();
    const cards = await Flashcard.findAll({
      where: {
        deck_id: deckId,
        [Op.or]: [{ next_review_at: null }, { next_review_at: { [Op.lte]: now } }],
      },
      order: [['position', 'ASC'], ['created_at', 'ASC']],
    });

    res.json({ cards });
  } catch (error) {
    console.error('Erreur lors de la récupération des cartes à réviser:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

/**
 * Enregistrer une révision (qualité 1-4)
 * Body: { quality, responseTimeSec?, mistakeReason? }
 */
exports.reviewCard = async (req, res) => {
  try {
    const { deckId, cardId } = req.params;
    const { quality, responseTimeSec, mistakeReason } = req.body;

    const deck = await FlashcardDeck.findOne({
      where: { id: deckId, user_id: req.user_id },
    });
    if (!deck) {
      return res.status(404).json({ error: 'Collection introuvable' });
    }

    const card = await Flashcard.findOne({
      where: { id: cardId, deck_id: deckId },
    });
    if (!card) {
      return res.status(404).json({ error: 'Carte introuvable' });
    }

    const q = typeof quality === 'number' ? quality : parseInt(quality, 10);
    if (Number.isNaN(q) || q < 1 || q > 4) {
      return res.status(400).json({ error: 'La qualité doit être entre 1 et 4' });
    }

    const rt = responseTimeSec != null ? parseInt(responseTimeSec, 10) : null;
    const { nextIntervalDays, easeFactor, repetitions, lapses, reason } =
      spacedRepetitionService.computeNextReview(card, q, Number.isNaN(rt) ? null : rt);
    const nextDate = spacedRepetitionService.getNextReviewDate(nextIntervalDays);

    card.ease_factor = easeFactor;
    card.interval_days = nextIntervalDays;
    card.repetitions = repetitions;
    card.lapses = lapses;
    card.next_review_at = nextDate;
    card.last_reviewed_at = new Date();
    // « Bien » ou « Facile » : la carte cesse définitivement d'être neuve.
    if (q >= 3 && !card.learned_at) card.learned_at = new Date();
    if (rt != null) card.response_time_sec = rt;
    if (mistakeReason != null && String(mistakeReason).trim()) {
      card.mistake_reason = String(mistakeReason).trim();
    }
    await card.save();

    res.json({
      card,
      next_review_at: nextDate,
      reason: reason || undefined,
    });
  } catch (error) {
    console.error('Erreur lors de la révision:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};
