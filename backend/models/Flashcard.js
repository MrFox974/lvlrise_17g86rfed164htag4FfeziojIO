const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');

/**
 * Flashcard - Carte pour répétition espacée (algorithme SM-2 / Anki)
 * - ease_factor : facteur de facilité (1.1 à 2.5)
 * - interval_days : intervalle en jours avant prochaine révision
 * - repetitions : nombre de révisions réussies consécutives
 */
const Flashcard = sequelize.define(
  'flashcard',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    deck_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'flashcard_deck', key: 'id' },
      onDelete: 'CASCADE',
    },
    chapter_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'flashcard_chapter', key: 'id' },
      onDelete: 'SET NULL',
    },
    front: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    back: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    ease_factor: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 2.5,
    },
    interval_days: {
      type: DataTypes.DECIMAL(6, 3),
      allowNull: false,
      defaultValue: 0,
    },
    repetitions: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    next_review_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    /**
     * Date de la première réussite (note « Bien » ou « Facile »).
     * Tant qu'elle est nulle, la carte n'a jamais été sue : c'est ce qui la
     * signale comme nouvelle dans l'interface. Un oubli ultérieur remet
     * `repetitions` à zéro mais ne la rend pas neuve à nouveau.
     */
    learned_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    position: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    lapses: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    response_time_sec: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    mistake_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    tags: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'JSON array of tags',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    source: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: 'flashcard',
    freezeTableName: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

module.exports = Flashcard;
