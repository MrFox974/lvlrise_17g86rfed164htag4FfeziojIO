const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');
const User = require('./User');
const Domain = require('./Domain');

const LearningTime = sequelize.define(
  'learning_time',
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
    domain_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'domain', key: 'id' },
      onDelete: 'CASCADE',
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    minutes: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    tableName: 'learning_time',
    freezeTableName: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [{ unique: true, fields: ['user_id', 'domain_id', 'date'] }],
  }
);

LearningTime.belongsTo(User, { foreignKey: 'user_id' });
LearningTime.belongsTo(Domain, { foreignKey: 'domain_id' });

module.exports = LearningTime;
