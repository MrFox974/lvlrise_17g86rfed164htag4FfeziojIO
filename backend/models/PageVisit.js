const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');

const PageVisit = sequelize.define(
  'page_visit',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    path: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: 'page_visit',
    freezeTableName: true,
    timestamps: false,
  }
);

module.exports = PageVisit;
