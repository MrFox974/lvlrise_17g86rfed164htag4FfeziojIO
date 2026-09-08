#!/usr/bin/env node
/**
 * Migration : ajoute la colonne done à la table routine.
 * Usage: node scripts/add-routine-done.js
 */
require('dotenv').config();

const { sequelize } = require('../config/database');

async function migrate() {
  try {
    await sequelize.authenticate();
    await sequelize.query(`
      ALTER TABLE routine
      ADD COLUMN IF NOT EXISTS done BOOLEAN NOT NULL DEFAULT false;
    `);
    console.log('Colonne done ajoutée ou déjà présente.');
    process.exit(0);
  } catch (error) {
    console.error('Erreur migration:', error);
    process.exit(1);
  }
}

migrate();
