const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');
const User = require('./User');
const Routine = require('./Routine');

const RoutineCompletion = sequelize.define(
  'routine_completion',
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
    routine_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'routine', key: 'id' },
      onDelete: 'CASCADE',
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    done: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    tableName: 'routine_completion',
    freezeTableName: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { unique: true, fields: ['user_id', 'routine_id', 'date'] },
    ],
  }
);

RoutineCompletion.belongsTo(User, { foreignKey: 'user_id' });
RoutineCompletion.belongsTo(Routine, { foreignKey: 'routine_id' });

module.exports = RoutineCompletion;
