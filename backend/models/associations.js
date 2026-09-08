/**
 * Associations entre modèles (évite les dépendances circulaires).
 * Charger ce fichier après tous les modèles.
 */
const User = require('./User');
const EmailVerificationToken = require('./EmailVerificationToken');
const FlashcardDeck = require('./FlashcardDeck');
const FlashcardChapter = require('./FlashcardChapter');
const Flashcard = require('./Flashcard');
const MarkdownDomain = require('./MarkdownDomain');
const MarkdownChapter = require('./MarkdownChapter');
const MarkdownSection = require('./MarkdownSection');

FlashcardDeck.hasMany(FlashcardChapter, { foreignKey: 'deck_id', as: 'chapters' });
FlashcardChapter.belongsTo(FlashcardDeck, { foreignKey: 'deck_id' });
FlashcardDeck.hasMany(Flashcard, { foreignKey: 'deck_id', as: 'flashcards' });
Flashcard.belongsTo(FlashcardDeck, { foreignKey: 'deck_id' });
FlashcardChapter.hasMany(Flashcard, { foreignKey: 'chapter_id', as: 'cards' });
Flashcard.belongsTo(FlashcardChapter, { foreignKey: 'chapter_id', as: 'chapter' });

MarkdownDomain.hasMany(MarkdownChapter, { foreignKey: 'domain_id', as: 'chapters' });
MarkdownChapter.belongsTo(MarkdownDomain, { foreignKey: 'domain_id', as: 'domain' });

MarkdownChapter.hasMany(MarkdownSection, { foreignKey: 'chapter_id', as: 'sections' });
MarkdownSection.belongsTo(MarkdownChapter, { foreignKey: 'chapter_id', as: 'chapter' });

User.hasMany(EmailVerificationToken, { foreignKey: 'user_id' });
EmailVerificationToken.belongsTo(User, { foreignKey: 'user_id' });

const Debate = require('./Debate');
const DebateNode = require('./DebateNode');
const DebateArgument = require('./DebateArgument');

Debate.hasMany(DebateNode, { foreignKey: 'debate_id', as: 'nodes' });
DebateNode.belongsTo(Debate, { foreignKey: 'debate_id', as: 'debate' });

DebateNode.hasMany(DebateArgument, { foreignKey: 'node_id', as: 'arguments' });
DebateArgument.belongsTo(DebateNode, { foreignKey: 'node_id', as: 'node' });
