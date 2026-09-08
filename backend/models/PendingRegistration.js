const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');

/**
 * Inscriptions en attente de vérification email.
 * L'utilisateur n'est créé qu'après clic sur le lien de vérification.
 * Permet de réinscrire avec la même adresse si le mail n'a pas été reçu.
 */
const PendingRegistration = sequelize.define(
  'pending_registration',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    username: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    token: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    tableName: 'pending_registration',
    freezeTableName: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [{ fields: ['token'] }, { fields: ['email'] }],
  }
);

module.exports = PendingRegistration;
