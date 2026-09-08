#!/usr/bin/env node
/**
 * Migration : ajoute la colonne day_of_week à la table routine.
 * À exécuter une fois en prod si la colonne n'existe pas.
 * Usage: node scripts/add-routine-day-of-week.js
 */
require('dotenv').config();

const { sequelize } = require('../config/database');

async function migrate() {
  try {
    await sequelize.authenticate();
    await sequelize.query(`
      ALTER TABLE routine
      ADD COLUMN IF NOT EXISTS day_of_week INTEGER NOT NULL DEFAULT 0;
    `);
    console.log('Colonne day_of_week ajoutée ou déjà présente.');
    process.exit(0);
  } catch (error) {
    console.error('Erreur migration:', error);
    process.exit(1);
  }
}

migrate();
