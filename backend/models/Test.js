const { sequelize }  = require('../config/database')
const { DataTypes } = require('sequelize')

const Test = sequelize.define(
  'test',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    email: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    password: {
      type: DataTypes.TEXT,
      allowNull: true,
    }

  },
  {
    tableName: 'test',      // nom EXACT de la table dans RDS
    freezeTableName: true,   // empêche Sequelize de mettre un "s" ou de changer la casse
    timestamps: false,
    // Ne pas définir les colonnes qui n'existent pas
    // Sequelize va automatiquement récupérer la structure de la table
  },
); 


module.exports = Test