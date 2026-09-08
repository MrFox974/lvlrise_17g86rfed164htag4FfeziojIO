const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');
const User = require('./User');

/**
 * Snapshot des stats routines par date (total, done) pour les jours passés.
 * Permet d'afficher les statistiques du calendrier même après suppression ou modification des routines.
 */
const RoutineDaySnapshot = sequelize.define(
  'routine_day_snapshot',
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
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    total: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    done: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    tableName: 'routine_day_snapshot',
    freezeTableName: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [{ unique: true, fields: ['user_id', 'date'] }],
  }
);

RoutineDaySnapshot.belongsTo(User, { foreignKey: 'user_id' });

module.exports = RoutineDaySnapshot;
