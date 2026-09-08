#!/usr/bin/env node
/**
 * Seed : crée 5 routines lifestyle pour un utilisateur.
 * Usage: node scripts/seed-routines.js
 * Env: SEED_USER_ID=2 pour forcer l'utilisateur (optionnel)
 */
require('dotenv').config();

const { sequelize, connectToDB } = require('../config/database');
require('../models/Routine');

const LIFESTYLE_ROUTINES = [
  'Réveil 6h',
  'Méditation 10 min',
  'Sport 30 min',
  'Lecture 20 min',
  'Coucher 22h',
];

async function seed() {
  try {
    await connectToDB();

    let userId = parseInt(process.env.SEED_USER_ID, 10);
    if (Number.isNaN(userId)) {
      const [rows] = await sequelize.query(
        'SELECT id FROM "user" ORDER BY id ASC LIMIT 1'
      );
      const firstUser = rows?.[0];
      userId = firstUser?.id;
    }

    if (!userId) {
      console.log('Aucun utilisateur trouvé. Créez un compte ou définissez SEED_USER_ID=2');
      process.exit(1);
    }

    const RoutineModel = sequelize.model('routine');
    const count = await RoutineModel.count({ where: { user_id: userId } });
    if (count > 0) {
      console.log(`${count} routine(s) existante(s) pour l'utilisateur ${userId}. Seed ignoré.`);
      process.exit(0);
    }

    await RoutineModel.bulkCreate(
      LIFESTYLE_ROUTINES.map((label, i) => ({
        user_id: userId,
        label,
        position: i,
        done: false,
        day_of_week: 0,
      }))
    );
    console.log(`5 routines lifestyle créées pour l'utilisateur ${userId}.`);
    process.exit(0);
  } catch (error) {
    console.error('Erreur seed routines:', error);
    process.exit(1);
  }
}

seed();
