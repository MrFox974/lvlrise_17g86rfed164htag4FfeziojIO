const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');
const User = require('./User');

/**
 * Journal des notifications envoyées : sert de garde-fou anti-doublon.
 * Le scheduler tourne toutes les 5 minutes avec une fenêtre de rattrapage ;
 * l'index unique (user_id, kind, ref_date, routine_id) garantit qu'une même
 * notification ne part qu'une seule fois par jour.
 *
 * routine_id vaut 0 (et non NULL) pour les notifications non liées à une
 * routine : en PostgreSQL, NULL ne déclenche pas de conflit d'unicité.
 */
const NotificationLog = sequelize.define(
  'notification_log',
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
    kind: {
      type: DataTypes.STRING(30),
      allowNull: false,
    },
    ref_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    routine_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    sent_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: 'notification_log',
    freezeTableName: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { unique: true, fields: ['user_id', 'kind', 'ref_date', 'routine_id'] },
    ],
  }
);

NotificationLog.belongsTo(User, { foreignKey: 'user_id' });

/** Types de notifications envoyées par le scheduler. */
NotificationLog.KINDS = {
  ROUTINE_REMINDER: 'routine_reminder',
  MORNING_GREETING: 'morning_greeting',
  NIGHT_GREETING: 'night_greeting',
  TODO_REMINDER: 'todo_reminder',
  DAILY_REPORT: 'daily_report',
};

module.exports = NotificationLog;
