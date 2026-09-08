/**
 * Génération d'une carte à l'unité, exécutée en arrière-plan.
 *
 * Même principe que la génération d'une collection : le contrôleur répond 202
 * et le travail se poursuit dans une invocation séparée. L'utilisateur peut
 * fermer l'application, la réflexion continue et il retrouve ses propositions
 * en revenant — une notification push l'avertit dès qu'elles sont prêtes.
 *
 * Différence essentielle : rien n'est écrit dans la collection ici. Le job
 * dépose ses propositions et s'arrête ; c'est l'utilisateur qui décide ensuite
 * lesquelles deviennent des cartes (voir `acceptJobProposals` du contrôleur).
 */
const FlashcardJob = require('../models/FlashcardJob');
const FlashcardDeck = require('../models/FlashcardDeck');
const singleCardService = require('../services/flashcard-single-card.service');
const uploadService = require('../services/upload.service');
const pushService = require('../services/push.service');

/**
 * Une carte à l'unité se contente de bien moins de texte qu'une collection : la
 * photo d'un panneau ou la description d'un objet suffit à définir un terme.
 */
const MIN_SOURCE_CHARS = 40;

async function update(job, fields) {
  Object.assign(job, fields);
  // Sequelize ne détecte pas la mutation d'une colonne JSON réassignée à une
  // valeur structurellement proche : sans ce marquage, rien n'est écrit.
  if (fields.stats !== undefined) job.changed('stats', true);
  if (fields.proposals !== undefined) job.changed('proposals', true);
  await job.save();
}

async function notifyReady(job, count) {
  try {
    await pushService.sendToUser(job.user_id, {
      title: 'Carte prête 🎴',
      body: count > 1
        ? `${count} propositions à valider pour « ${job.subject} ».`
        : `« ${job.subject} » : la carte vous attend.`,
      tag: `lvlrise-flashcard-job-${job.id}`,
      url: '/home/productivite/carte-mentale',
    });
  } catch (error) {
    // L'absence de notification ne remet pas en cause le travail produit.
    console.error('[flashcard-single-card] notification impossible :', error.message);
  }
}

async function notifyFailed(job, message) {
  try {
    await pushService.sendToUser(job.user_id, {
      title: 'Génération interrompue',
      body: message.slice(0, 150),
      tag: `lvlrise-flashcard-job-${job.id}`,
      url: '/home/productivite/carte-mentale',
    });
  } catch {
    /* silencieux */
  }
}

/** Le job a-t-il été annulé entre-temps ? */
async function isCanceled(jobId) {
  const fresh = await FlashcardJob.findByPk(jobId, { attributes: ['status'] });
  return !fresh || fresh.status === 'canceled';
}

/**
 * Exécute la génération d'une carte à l'unité.
 * @param {number} jobId
 */
async function runFlashcardSingleCardJob(jobId) {
  const job = await FlashcardJob.findByPk(jobId);
  if (!job) return;
  if (job.status !== 'queued') return; // déjà traité ou annulé

  try {
    const deck = await FlashcardDeck.findOne({
      where: { id: job.deck_id, user_id: job.user_id },
    });
    if (!deck) throw new Error('La collection visée n\'existe plus.');

    await update(job, { status: 'running', step: 'Lecture des documents…', progress: 10 });

    const uploadIds = job.upload_ids || [];
    const sourceText = await uploadService.getCombinedText(job.user_id, uploadIds);

    // Des documents joints dont rien n'a été tiré : la carte porterait sur autre
    // chose que ce qui a été fourni. On s'arrête et on le dit.
    if (uploadIds.length > 0 && sourceText.trim().length < MIN_SOURCE_CHARS) {
      throw new Error(
        'Les documents joints n\'ont pas pu être lus. Reprenez la photo bien cadrée et '
        + 'dans le bon sens, ou joignez un PDF contenant du texte sélectionnable.'
      );
    }

    if (await isCanceled(job.id)) return;

    await update(job, { step: 'Rédaction de la carte…', progress: 45 });

    const result = await singleCardService.generateCardProposals({
      query: job.subject,
      level: job.level,
      language: job.language,
      sourceText,
    });

    if (await isCanceled(job.id)) return;

    const count = result.proposals.length;
    await update(job, {
      status: 'ready',
      step: count > 1
        ? `${count} propositions à valider.`
        : 'Carte prête.',
      progress: 100,
      proposals: result.proposals,
      stats: {
        single: true,
        intent: result.intent,
        correction: result.correction,
        notice: result.notice,
        proposed: count,
        published: false,
      },
      finished_at: new Date(),
    });

    await notifyReady(job, count);
  } catch (error) {
    console.error('[flashcard-single-card] échec :', error);
    const fresh = await FlashcardJob.findByPk(jobId);
    if (!fresh || fresh.status === 'canceled') return;
    await update(fresh, {
      status: 'error',
      step: null,
      error: error.message,
      finished_at: new Date(),
    });
    await notifyFailed(fresh, error.message);
  }
}

module.exports = { runFlashcardSingleCardJob };
