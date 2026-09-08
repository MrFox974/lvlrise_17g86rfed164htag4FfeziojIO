const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');
const User = require('./User');

/**
 * Abonnement Web Push d'un navigateur (un par appareil / navigateur).
 * endpoint est unique : c'est l'identifiant délivré par le service de push
 * (FCM pour Chrome, Mozilla autopush, Apple Push pour Safari/iOS).
 */
const PushSubscription = sequelize.define(
  'push_subscription',
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
    endpoint: {
      type: DataTypes.TEXT,
      allowNull: false,
      unique: true,
    },
    p256dh: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    auth: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // Passe à false après un échec définitif (404/410) : on garde la ligne
    // le temps d'un cycle avant suppression, utile pour le debug.
    enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    last_success_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: 'push_subscription',
    freezeTableName: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [{ fields: ['user_id'] }],
  }
);

PushSubscription.belongsTo(User, { foreignKey: 'user_id' });

module.exports = PushSubscription;
