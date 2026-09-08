const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');

const User = sequelize.define(
  'user',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    username: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: true, // Null pour les utilisateurs OAuth (Google, Apple)
    },
    auth_provider: {
      type: DataTypes.STRING(20),
      allowNull: true,
      defaultValue: 'local',
    },
    google_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: true,
    },
    apple_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: true,
    },
    refresh_token: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    subscription_plan: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: 'free',
    },
    stripe_customer_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    stripe_subscription_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    subscription_current_period_start: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    subscription_current_period_end: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    onboarding_completed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    email_verified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    email_verified_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    home_cards_order: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: ['priorities', 'learning', 'routines'],
    },
    // Fuseau IANA (ex. 'Europe/Paris'), détecté par le navigateur à l'abonnement
    // aux notifications. La Lambda tourne en UTC : sans ça, impossible d'envoyer
    // un rappel « à 8h » à la bonne heure locale.
    timezone: {
      type: DataTypes.STRING(64),
      allowNull: false,
      defaultValue: 'Europe/Paris',
    },
  },
  {
    tableName: 'user',
    freezeTableName: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

module.exports = User;
