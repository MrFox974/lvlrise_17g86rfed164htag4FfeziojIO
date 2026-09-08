const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');
const FlashcardDeck = require('./FlashcardDeck');

const FlashcardChapter = sequelize.define(
  'flashcard_chapter',
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
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    position: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    tableName: 'flashcard_chapter',
    freezeTableName: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

module.exports = FlashcardChapter;
