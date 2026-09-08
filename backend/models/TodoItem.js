const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');
const User = require('./User');

const TodoItem = sequelize.define(
  'todo_item',
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
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    tag: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'à faire',
    },
    progress: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    position: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    completed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    group_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: 'Main',
    },
  },
  {
    tableName: 'todo_item',
    freezeTableName: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

TodoItem.belongsTo(User, { foreignKey: 'user_id' });

module.exports = TodoItem;
