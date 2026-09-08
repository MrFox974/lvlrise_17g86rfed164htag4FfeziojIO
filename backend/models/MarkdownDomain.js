const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');
const User = require('./User');

const MarkdownDomain = sequelize.define(
  'markdown_domain',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'user', key: 'id' },
      onDelete: 'CASCADE',
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    position: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    is_public: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    generation_status: {
      type: DataTypes.STRING(20),
      allowNull: true,
      defaultValue: null, // null = terminé ou pas de génération, 'generating' = en cours
    },
    generation_progress: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null, // 0-100
    },
    generation_step: {
      type: DataTypes.STRING(100),
      allowNull: true,
      defaultValue: null,
    },
    generation_log: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: null,
    },
    imported_from_domain_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
    },
    generation_started_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },
    generation_cancelled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    /**
     * Fichiers joints servant de source au parcours (voir modèle Upload).
     * Le texte qui en est extrait fait autorité sur les connaissances générales
     * du modèle lors de la rédaction.
     */
    upload_ids: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    tableName: 'markdown_domain',
    freezeTableName: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

MarkdownDomain.belongsTo(User, { foreignKey: 'user_id' });

module.exports = MarkdownDomain;
