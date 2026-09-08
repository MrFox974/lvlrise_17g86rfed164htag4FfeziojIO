const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');
const User = require('./User');

/**
 * Un débat : le sujet sur lequel on veut se forger un avis.
 *
 * Le débat porte le cadrage (termes, limites, tensions) : ce qui est écrit ici
 * vaut pour la question centrale comme pour tous ses sous-débats, sinon chaque
 * branche redéfinirait les mots de son côté et les avis ne se compareraient plus.
 */
const Debate = sequelize.define(
  'debate',
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
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    question: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: 'Pour ou contre ?',
    },
    desc_termes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    desc_limites: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    desc_tensions: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: 'debate',
    freezeTableName: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

Debate.belongsTo(User, { foreignKey: 'user_id' });

module.exports = Debate;
