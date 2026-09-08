const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');
const User = require('./User');

const Routine = sequelize.define(
  'routine',
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
    label: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    position: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    done: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    day_of_week: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    // Heure locale du rappel, format 'HH:MM'. NULL = pas de notification.
    reminder_time: {
      type: DataTypes.STRING(5),
      allowNull: true,
    },
    // 'morning' (bonjour) ou 'night' (bonne nuit) : la routine porte le message
    // de la journée, envoyé à reminder_time. Un seul par jour de la semaine.
    greeting: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
  },
  {
    tableName: 'routine',
    freezeTableName: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

Routine.belongsTo(User, { foreignKey: 'user_id' });

module.exports = Routine;
