const express = require('express');
const route = express.Router();
const controller = require('../controllers/flashcard.controller');
const { authMiddlewares } = require('../middlewares/authMiddlewares');

route.get('/flashcard-decks', authMiddlewares, controller.getAllDecks);
route.post('/flashcard-decks', authMiddlewares, controller.createDeck);
route.post('/flashcard-decks/generate', authMiddlewares, controller.generateDeck);
route.get('/flashcard-jobs', authMiddlewares, controller.listGenerationJobs);
route.get('/flashcard-jobs/:id', authMiddlewares, controller.getGenerationJob);
route.delete('/flashcard-jobs/:id', authMiddlewares, controller.cancelGenerationJob);
// Propositions d'une carte à l'unité retenues par l'utilisateur.
route.post('/flashcard-jobs/:id/accept', authMiddlewares, controller.acceptJobProposals);
route.put('/flashcard-decks/:id', authMiddlewares, controller.updateDeck);
route.delete('/flashcard-decks/:id', authMiddlewares, controller.deleteDeck);

route.get('/flashcard-decks/:deckId/chapters', authMiddlewares, controller.getChapters);
route.post('/flashcard-decks/:deckId/chapters', authMiddlewares, controller.createChapter);
route.put('/flashcard-decks/:deckId/chapters/reorder', authMiddlewares, controller.reorderChapters);
route.put('/flashcard-decks/:deckId/chapters/:chapterId', authMiddlewares, controller.updateChapter);
route.delete('/flashcard-decks/:deckId/chapters/:chapterId', authMiddlewares, controller.deleteChapter);

route.get('/flashcard-decks/:deckId/cards', authMiddlewares, controller.getCardsByDeck);
// Avant `/cards/:cardId` : sans quoi « generate » serait pris pour un id.
route.post('/flashcard-decks/:deckId/cards/generate', authMiddlewares, controller.generateDeckCards);
route.post('/flashcard-decks/:deckId/cards/generate-one', authMiddlewares, controller.generateSingleCard);
// Étoffe les groupes existants à partir de leur propre thème.
route.post('/flashcard-decks/:deckId/complete', authMiddlewares, controller.completeDeck);
route.get('/flashcard-decks/:deckId/generation-context', authMiddlewares, controller.getDeckGenerationContext);
route.put('/flashcard-decks/:deckId/chapters/:chapterId/cards/reorder', authMiddlewares, controller.reorderCards);
route.post('/flashcard-decks/:deckId/cards', authMiddlewares, controller.createCard);
route.put('/flashcard-decks/:deckId/cards/:cardId', authMiddlewares, controller.updateCard);
route.delete('/flashcard-decks/:deckId/cards/:cardId', authMiddlewares, controller.deleteCard);

route.get('/flashcard-decks/:deckId/due-cards', authMiddlewares, controller.getDueCards);
route.post('/flashcard-decks/:deckId/cards/:cardId/review', authMiddlewares, controller.reviewCard);

module.exports = route;
