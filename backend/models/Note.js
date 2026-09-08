const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');
const User = require('./User');
const TodoItem = require('./TodoItem');

const Note = sequelize.define(
  'note',
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
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    todo_item_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'todo_item', key: 'id' },
      onDelete: 'SET NULL',
    },
  },
  {
    tableName: 'note',
    freezeTableName: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

Note.belongsTo(User, { foreignKey: 'user_id' });
Note.belongsTo(TodoItem, { foreignKey: 'todo_item_id', as: 'todoItem' });

module.exports = Note;
