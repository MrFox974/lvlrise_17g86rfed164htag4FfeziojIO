const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');

/**
 * Un argument capté dans une source, rattaché à un nœud de débat.
 *
 * `tags` mélange volontairement la nature de l'argument (Factuel, Conceptuel,
 * Normatif) et son plan de discussion (Économique, Juridique…) : c'est la même
 * liste de mots-clés côté lecture, et les filtres savent à quelle famille chaque
 * mot appartient. `date_label` reste du texte libre (« 03/2024 ») parce qu'une
 * source se date souvent au mois, parfois à l'année, rarement au jour.
 */
const DebateArgument = sequelize.define(
  'debate_argument',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    node_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'debate_node', key: 'id' },
      onDelete: 'CASCADE',
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'user', key: 'id' },
      onDelete: 'CASCADE',
    },
    /** 'pour' ou 'contre' : le camp que l'argument sert. */
    side: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: 'pour',
    },
    text: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    tags: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    source: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    support: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    date_label: {
      type: DataTypes.STRING(40),
      allowNull: true,
    },
    /** 'verifie', 'nuance', 'faux' — nul tant que l'argument n'a pas été vérifié. */
    verdict: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    note: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    position: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    tableName: 'debate_argument',
    freezeTableName: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

module.exports = DebateArgument;
