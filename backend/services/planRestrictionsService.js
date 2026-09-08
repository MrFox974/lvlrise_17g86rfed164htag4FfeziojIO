const { Op } = require('sequelize');
const User = require('../models/User');
const Routine = require('../models/Routine');
const TodoItem = require('../models/TodoItem');
const FlashcardDeck = require('../models/FlashcardDeck');
const FlashcardChapter = require('../models/FlashcardChapter');
const Flashcard = require('../models/Flashcard');

/**
 * Définition des limites par plan (abonnement : free, pro, premium).
 * routinesPerDay = max de routines par jour de la semaine (ex. 5 le lundi, 5 le mardi…), pas par semaine.
 */
const PLAN_LIMITS = {
  free: {
    routinesPerDay: 5, // par jour de la semaine (lundi, mardi, …)
    todos: 7,
    flashcardCollections: 1,
    flashcardGroups: 1,
    flashcards: 20,
  },
  pro: {
    routinesPerDay: 20, // par jour de la semaine
    todos: 50,
    flashcardCollections: 10,
    flashcardGroups: 120,
    flashcards: 200,
  },
  premium: {
    routinesPerDay: 100, // par jour de la semaine
    todos: 500,
    flashcardCollections: 100,
    flashcardGroups: 400,
    flashcards: 1000,
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

module.exports = {
  PLAN_LIMITS,
  getUserPlan,
  getUserLimits,
  canCreateRoutine,
  canCreateTodo,
  canCreateFlashcardDeck,
  canCreateFlashcardChapter,
  canCreateFlashcard,
};
