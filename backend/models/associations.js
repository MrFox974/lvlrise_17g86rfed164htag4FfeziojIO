/**
 * Associations entre modèles (évite les dépendances circulaires).
 * Charger ce fichier après tous les modèles.
 */
const User = require('./User');
const EmailVerificationToken = require('./EmailVerificationToken');
const FlashcardDeck = require('./FlashcardDeck');
const FlashcardChapter = require('./FlashcardChapter');
const Flashcard = require('./Flashcard');

FlashcardDeck.hasMany(FlashcardChapter, { foreignKey: 'deck_id', as: 'chapters' });
FlashcardChapter.belongsTo(FlashcardDeck, { foreignKey: 'deck_id' });
FlashcardDeck.hasMany(Flashcard, { foreignKey: 'deck_id', as: 'flashcards' });
Flashcard.belongsTo(FlashcardDeck, { foreignKey: 'deck_id' });
FlashcardChapter.hasMany(Flashcard, { foreignKey: 'chapter_id', as: 'cards' });
Flashcard.belongsTo(FlashcardChapter, { foreignKey: 'chapter_id', as: 'chapter' });

User.hasMany(EmailVerificationToken, { foreignKey: 'user_id' });
EmailVerificationToken.belongsTo(User, { foreignKey: 'user_id' });
