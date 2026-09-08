const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');

/**
 * Un nœud de débat : la question centrale (`kind = 'general'`) ou un sous-débat.
 *
 * Les cinq étapes se parcourent nœud par nœud, jamais au niveau du débat entier :
 * on peut avoir tranché sur le congé parental sans avoir encore d'avis sur la
 * question générale. `step_done` retient l'étape la plus avancée atteinte (0 à 5),
 * ce qui permet de rouvrir une étape passée sans faire reculer la progression.
 */
const DebateNode = sequelize.define(
  'debate_node',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    debate_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'debate', key: 'id' },
      onDelete: 'CASCADE',
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'user', key: 'id' },
      onDelete: 'CASCADE',
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    kind: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: 'sub',
    },
    step_done: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    opinion: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    /** Position finale : 'pour', 'nuance', 'contre' — nulle tant qu'on n'a pas tranché. */
    side: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    position: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    tableName: 'debate_node',
    freezeTableName: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

module.exports = DebateNode;
