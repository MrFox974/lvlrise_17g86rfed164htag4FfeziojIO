const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');

const MarkdownChapter = sequelize.define(
  'markdown_chapter',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    domain_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'markdown_domain', key: 'id' },
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
    position: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    tableName: 'markdown_chapter',
    freezeTableName: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

module.exports = MarkdownChapter;
