const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');
const User = require('./User');

const OnboardingSession = sequelize.define(
  'onboarding_session',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      references: { model: 'user', key: 'id' },
      onDelete: 'CASCADE',
    },
    step_index: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    responses: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {},
    },
    domains_gauges_percent: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'in_progress',
    },
    generation_progress: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    generation_step: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    generation_log: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    generation_started_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },
    generation_cancelled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    tableName: 'onboarding_session',
    freezeTableName: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

OnboardingSession.belongsTo(User, { foreignKey: 'user_id' });

module.exports = OnboardingSession;
