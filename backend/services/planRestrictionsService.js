const { Op } = require('sequelize');
const User = require('../models/User');
const MarkdownDomain = require('../models/MarkdownDomain');
const MarkdownChapter = require('../models/MarkdownChapter');
const MarkdownSection = require('../models/MarkdownSection');
const Routine = require('../models/Routine');
const TodoItem = require('../models/TodoItem');
const FlashcardDeck = require('../models/FlashcardDeck');
const FlashcardChapter = require('../models/FlashcardChapter');
const Flashcard = require('../models/Flashcard');
const Note = require('../models/Note');
const Domain = require('../models/Domain');

/**
 * Définition des limites par plan (abonnement : free, pro, premium).
 * routinesPerDay = max de routines par jour de la semaine (ex. 5 le lundi, 5 le mardi…), pas par semaine.
 */
const PLAN_LIMITS = {
  free: {
    aiGenerations: 1,
    domainsPerso: 3,
    domainsPro: 1,
    routinesPerDay: 5, // par jour de la semaine (lundi, mardi, …)
    todos: 7,
    flashcardCollections: 1,
    flashcardGroups: 1,
    flashcards: 20,
    notes: 10,
    bibliDomains: 3,
    bibliChaptersPerDomain: 5,
    bibliSectionsPerChapter: 5,
    domainImports: 3,
  },
  pro: {
    aiGenerations: 10,
    domainsPerso: 5,
    domainsPro: 3,
    routinesPerDay: 20, // par jour de la semaine
    todos: 50,
    flashcardCollections: 10,
    flashcardGroups: 120,
    flashcards: 200,
    notes: 50,
    bibliDomains: 10,
    bibliChaptersPerDomain: 30,
    bibliSectionsPerChapter: 50,
    domainImports: 10,
  },
  premium: {
    aiGenerations: 50,
    domainsPerso: 5,
    domainsPro: 5,
    routinesPerDay: 100, // par jour de la semaine
    todos: 500,
    flashcardCollections: 100,
    flashcardGroups: 400,
    flashcards: 1000,
    notes: 1000,
    bibliDomains: 100,
    bibliChaptersPerDomain: 200,
    bibliSectionsPerChapter: 500,
    domainImports: Number.MAX_SAFE_INTEGER,
  },
};

/** Tout plan dont l'id commence par admin_ est considéré comme admin (aucune limite). */
function isAdminPlan(plan) {
  return typeof plan === 'string' && plan.startsWith('admin_');
}

/**
 * Limites illimitées pour les plans admin (mêmes clés que les autres plans, valeurs à l'infini).
 */
function getUnlimitedLimits() {
  const keys = Object.keys(PLAN_LIMITS.premium);
  return Object.fromEntries(keys.map((k) => [k, Number.MAX_SAFE_INTEGER]));
}

/**
 * Récupère le plan de l'utilisateur
 */
async function getUserPlan(userId) {
  const user = await User.findByPk(userId, {
    attributes: ['subscription_plan'],
  });
  return user?.subscription_plan || 'free';
}

/**
 * Récupère les limites du plan de l'utilisateur.
 * Les plans admin_... ont des possibilités illimitées (aucune limite).
 */
async function getUserLimits(userId) {
  const plan = await getUserPlan(userId);
  if (isAdminPlan(plan)) return getUnlimitedLimits();
  return PLAN_LIMITS[plan] || PLAN_LIMITS.free;
}

/**
 * Vérifie si l'utilisateur peut créer un domaine markdown
 */
async function canCreateMarkdownDomain(userId) {
  const limits = await getUserLimits(userId);
  const count = await MarkdownDomain.count({
    where: { user_id: userId },
  });
  return {
    allowed: count < limits.bibliDomains,
    current: count,
    limit: limits.bibliDomains,
    plan: await getUserPlan(userId),
  };
}

/**
 * Vérifie si l'utilisateur peut créer un chapitre dans un domaine markdown
 */
async function canCreateMarkdownChapter(userId, domainId) {
  const limits = await getUserLimits(userId);
  const count = await MarkdownChapter.count({
    where: { domain_id: domainId },
  });
  return {
    allowed: count < limits.bibliChaptersPerDomain,
    current: count,
    limit: limits.bibliChaptersPerDomain,
    plan: await getUserPlan(userId),
  };
}

/**
 * Vérifie si l'utilisateur peut créer un sous-chapitre dans un chapitre markdown
 */
async function canCreateMarkdownSection(userId, chapterId) {
  const limits = await getUserLimits(userId);
  const count = await MarkdownSection.count({
    where: { chapter_id: chapterId },
  });
  return {
    allowed: count < limits.bibliSectionsPerChapter,
    current: count,
    limit: limits.bibliSectionsPerChapter,
    plan: await getUserPlan(userId),
  };
}

/**
 * Vérifie si l'utilisateur peut créer une routine pour un jour de la semaine donné.
 * routinesPerDay = limite par jour de la semaine (ex. 5 routines le lundi, 5 le mardi, etc.).
 * @param {number} userId
 * @param {number} dayOfWeek - 0 = lundi, 6 = dimanche
 */
async function canCreateRoutine(userId, dayOfWeek) {
  const limits = await getUserLimits(userId);
  const day = Number.isInteger(dayOfWeek) && dayOfWeek >= 0 && dayOfWeek <= 6
    ? dayOfWeek
    : (new Date().getDay() + 6) % 7;

  const count = await Routine.count({
    where: {
      user_id: userId,
      day_of_week: day,
    },
  });
  return {
    allowed: count < limits.routinesPerDay,
    current: count,
    limit: limits.routinesPerDay,
    plan: await getUserPlan(userId),
  };
}

/**
 * Vérifie si l'utilisateur peut créer une tâche (todo)
 */
async function canCreateTodo(userId) {
  const limits = await getUserLimits(userId);
  const count = await TodoItem.count({
    where: { user_id: userId },
  });
  return {
    allowed: count < limits.todos,
    current: count,
    limit: limits.todos,
    plan: await getUserPlan(userId),
  };
}

/**
 * Vérifie si l'utilisateur peut créer une collection (deck) de flashcards
 */
async function canCreateFlashcardDeck(userId) {
  const limits = await getUserLimits(userId);
  const count = await FlashcardDeck.count({
    where: { user_id: userId },
  });
  return {
    allowed: count < limits.flashcardCollections,
    current: count,
    limit: limits.flashcardCollections,
    plan: await getUserPlan(userId),
  };
}

/**
 * Vérifie si l'utilisateur peut créer un groupe (chapter) de flashcards dans un deck
 */
async function canCreateFlashcardChapter(userId, deckId) {
  const limits = await getUserLimits(userId);
  const count = await FlashcardChapter.count({
    where: { deck_id: deckId },
  });
  return {
    allowed: count < limits.flashcardGroups,
    current: count,
    limit: limits.flashcardGroups,
    plan: await getUserPlan(userId),
  };
}

/**
 * Vérifie si l'utilisateur peut créer une flashcard
 */
async function canCreateFlashcard(userId) {
  const limits = await getUserLimits(userId);
  // Une carte ne porte pas de user_id : elle appartient à un deck, lui-même
  // rattaché à l'utilisateur. Compter sur flashcard.user_id faisait échouer la
  // requête SQL, donc toute création de carte renvoyait une erreur 500.
  const decks = await FlashcardDeck.findAll({
    where: { user_id: userId },
    attributes: ['id'],
    raw: true,
  });
  const count = decks.length
    ? await Flashcard.count({ where: { deck_id: { [Op.in]: decks.map((d) => d.id) } } })
    : 0;
  return {
    allowed: count < limits.flashcards,
    current: count,
    limit: limits.flashcards,
    plan: await getUserPlan(userId),
  };
}

/**
 * Vérifie si l'utilisateur peut créer une note
 */
async function canCreateNote(userId) {
  const limits = await getUserLimits(userId);
  const count = await Note.count({
    where: { user_id: userId },
  });
  return {
    allowed: count < limits.notes,
    current: count,
    limit: limits.notes,
    plan: await getUserPlan(userId),
  };
}

/**
 * Vérifie si l'utilisateur peut créer un domaine de développement (perso ou pro)
 */
async function canCreateDomain(userId, type = 'perso') {
  const limits = await getUserLimits(userId);
  const isPro = type === 'pro';
  const limit = isPro ? limits.domainsPro : limits.domainsPerso;
  const count = await Domain.count({
    where: { user_id: userId, type },
  });
  return {
    allowed: count < limit,
    current: count,
    limit,
    plan: await getUserPlan(userId),
  };
}

/**
 * Vérifie si l'utilisateur peut générer un domaine avec l'IA (bibliothèque).
 *
 * Exclusions du quota :
 * - La première génération personnalisée lors de l'inscription : lorsqu'une personne s'inscrit
 *   et choisit de commencer en personnalisant avec l'IA, le domaine généré à la fin de l'onboarding
 *   ne compte PAS comme 1 génération de domaine IA (bibliothèque).
 * - Les domaines annulés en moins d'1 minute ne comptent PAS dans le quota.
 *
 * Comptabilisation : seuls les domaines créés APRÈS onboarding_completed_at et non annulés
 * (ou annulés après >= 1 min) sont comptés.
 */
async function canGenerateDomainWithAI(userId) {
  const limits = await getUserLimits(userId);
  
  // Récupérer la date de fin d'onboarding pour exclure les domaines créés pendant l'onboarding
  const user = await User.findByPk(userId, {
    attributes: ['onboarding_completed_at'],
  });
  
  let count;
  if (user?.onboarding_completed_at) {
    // Compter uniquement les domaines créés APRÈS l'onboarding
    // ET qui ne sont pas annulés en moins d'1 minute
    const domains = await MarkdownDomain.findAll({
      where: {
        user_id: userId,
        created_at: {
          [Op.gt]: user.onboarding_completed_at,
        },
      },
      attributes: ['id', 'generation_cancelled', 'generation_started_at', 'created_at', 'updated_at'],
    });
    
    // Filtrer les domaines annulés en moins d'1 minute
    count = domains.filter((domain) => {
      if (!domain.generation_cancelled) {
        return true; // Non annulé, compte
      }
      // Annulé : vérifier la durée entre le début et l'annulation (updated_at)
      const startedAt = domain.generation_started_at || domain.created_at;
      const cancelledAt = domain.updated_at; // updated_at est mis à jour lors de l'annulation
      const durationMs = new Date(cancelledAt).getTime() - new Date(startedAt).getTime();
      const durationMinutes = durationMs / (1000 * 60);
      return durationMinutes >= 1; // Compte seulement si >= 1 minute
    }).length;
  } else {
    // Si l'onboarding n'est pas terminé, ne pas compter les domaines créés pendant l'onboarding
    // (on considère qu'ils sont tous créés pendant l'onboarding)
    count = 0;
  }
  
  return {
    allowed: count < limits.aiGenerations,
    current: count,
    limit: limits.aiGenerations,
    plan: await getUserPlan(userId),
  };
}

/**
 * Vérifie si l'utilisateur peut importer un domaine public (limite par plan).
 */
async function canImportDomain(userId) {
  const limits = await getUserLimits(userId);
  const count = await MarkdownDomain.count({
    where: {
      user_id: userId,
      imported_from_domain_id: { [Op.ne]: null },
    },
  });
  return {
    allowed: count < limits.domainImports,
    current: count,
    limit: limits.domainImports,
    plan: await getUserPlan(userId),
  };
}

module.exports = {
  PLAN_LIMITS,
  getUserPlan,
  getUserLimits,
  canCreateMarkdownDomain,
  canCreateMarkdownChapter,
  canCreateMarkdownSection,
  canCreateRoutine,
  canCreateTodo,
  canCreateFlashcardDeck,
  canCreateFlashcardChapter,
  canCreateFlashcard,
  canCreateNote,
  canCreateDomain,
  canGenerateDomainWithAI,
  canImportDomain,
};
