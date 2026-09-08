const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');

/**
 * Groupe de to-do de l'utilisateur.
 *
 * Un groupe n'était jusqu'ici qu'une colonne `group_name` sur les tâches : un
 * groupe sans tâche n'avait rien à quoi se raccrocher et disparaissait au
 * rechargement. Il existe désormais pour lui-même, ce qui le rend visible même
 * vide et sur tous les appareils de l'utilisateur.
 *
 * « Main » n'est pas stocké ici : c'est le groupe par défaut, toujours présent.
 */
const TodoGroup = sequelize.define(
  'todo_group',
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
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    position: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    tableName: 'todo_group',
    freezeTableName: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [{ unique: true, fields: ['user_id', 'name'] }],
  }
);

module.exports = TodoGroup;
