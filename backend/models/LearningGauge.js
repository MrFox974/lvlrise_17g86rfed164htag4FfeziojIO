const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');
const User = require('./User');

const LearningGauge = sequelize.define(
  'learning_gauge',
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
    category: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    values: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {},
    },
  },
  {
    tableName: 'learning_gauge',
    freezeTableName: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

LearningGauge.belongsTo(User, { foreignKey: 'user_id' });

module.exports = LearningGauge;
