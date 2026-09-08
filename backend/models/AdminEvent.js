const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');

const AdminEvent = sequelize.define(
  'admin_event',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    event_type: {
      type: DataTypes.STRING(80),
      allowNull: false,
    },
    payload: {
      type: DataTypes.JSONB,
      allowNull: true,
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
    tableName: 'admin_event',
    freezeTableName: true,
    timestamps: false,
  }
);

module.exports = AdminEvent;
