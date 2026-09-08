#!/usr/bin/env node
/**
 * Script de synchronisation des tables en base.
 * À exécuter une fois (local ou CI) pour créer les tables manquantes.
 * Usage: node scripts/sync-db.js
 * Ou avec les variables d'environnement de prod (depuis serverless.yml)
 */
require('dotenv').config();

const { sequelize, connectModels } = require('../config/database');
const { DataTypes } = require('sequelize');

// Charge tous les modèles pour qu'ils soient enregistrés
require('../models/User');
require('../models/Routine');
require('../models/RoutineCompletion');
require('../models/RoutineDaySnapshot');
require('../models/TodoItem');
require('../models/TodoGroup');
require('../models/FlashcardDeck');
require('../models/FlashcardChapter');
require('../models/Flashcard');
require('../models/PushSubscription');
require('../models/NotificationLog');
require('../models/FlashcardJob');
require('../models/Upload');
require('../models/associations');

async function sync() {
  try {
    console.log('Connexion à la base de données...');
    await sequelize.authenticate();
    console.log('Synchronisation des modèles...');
    await connectModels({ force: false }); // force: false = créer si absent, ne pas supprimer
    const qi = sequelize.getQueryInterface();
    try {
      await qi.addColumn('markdown_chapter', 'content', { type: DataTypes.TEXT });
      console.log('Colonne markdown_chapter.content ajoutée.');
    } catch (e) {
      if (!e.message?.includes('already exists')) console.warn('Colonne content:', e.message);
    }
    try {
      await qi.addColumn('flashcard', 'chapter_id', { type: DataTypes.INTEGER, allowNull: true });
      console.log('Colonne flashcard.chapter_id ajoutée.');
    } catch (e) {
      if (!e.message?.includes('already exists')) console.warn('Colonne chapter_id:', e.message);
    }
    const flashcardCols = [
      { name: 'lapses', def: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 } },
      { name: 'response_time_sec', def: { type: DataTypes.INTEGER, allowNull: true } },
      { name: 'mistake_reason', def: { type: DataTypes.TEXT, allowNull: true } },
      { name: 'tags', def: { type: DataTypes.TEXT, allowNull: true } },
      { name: 'notes', def: { type: DataTypes.TEXT, allowNull: true } },
      { name: 'source', def: { type: DataTypes.TEXT, allowNull: true } },
    ];
    for (const c of flashcardCols) {
      try {
        await qi.addColumn('flashcard', c.name, c.def);
        console.log('Colonne flashcard.' + c.name + ' ajoutée.');
      } catch (e) {
        if (!e.message?.includes('already exists')) console.warn('Colonne ' + c.name + ':', e.message);
      }
    }
    try {
      await qi.changeColumn('flashcard', 'interval_days', { type: DataTypes.DECIMAL(6, 3), allowNull: false, defaultValue: 0 });
      console.log('Colonne flashcard.interval_days mise à jour (DECIMAL).');
    } catch (e) {
      if (!e.message?.includes('already exists') && !e.message?.includes('type')) console.warn('interval_days:', e.message);
    }
    try {
      await qi.addColumn('domain', 'type', {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'perso',
      });
      console.log('Colonne domain.type ajoutée.');
    } catch (e) {
      if (!e.message?.includes('already exists')) console.warn('Colonne domain.type:', e.message);
    }
    try {
      await qi.addColumn('markdown_domain', 'is_public', {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
      console.log('Colonne markdown_domain.is_public ajoutée.');
    } catch (e) {
      if (!e.message?.includes('already exists')) console.warn('Colonne markdown_domain.is_public:', e.message);
    }
    // OAuth (Google, Apple) + refresh_token, onboarding_completed_at
    const userOAuthCols = [
      { name: 'auth_provider', def: { type: DataTypes.STRING(20), allowNull: true, defaultValue: 'local' } },
      { name: 'google_id', def: { type: DataTypes.STRING(255), allowNull: true } },
      { name: 'apple_id', def: { type: DataTypes.STRING(255), allowNull: true } },
      { name: 'refresh_token', def: { type: DataTypes.TEXT, allowNull: true } },
      { name: 'onboarding_completed_at', def: { type: DataTypes.DATE, allowNull: true } },
    ];
    for (const c of userOAuthCols) {
      try {
        await qi.addColumn('user', c.name, c.def);
        console.log('Colonne user.' + c.name + ' ajoutée.');
      } catch (e) {
        if (!e.message?.includes('already exists')) console.warn('Colonne user.' + c.name + ':', e.message);
      }
    }
    try {
      await qi.changeColumn('user', 'password', { type: DataTypes.STRING(255), allowNull: true });
      console.log('Colonne user.password : allowNull mis à jour.');
    } catch (e) {
      if (!e.message?.includes('already exists') && !e.message?.includes('column') && !e.message?.includes('does not exist')) {
        console.warn('user.password allowNull:', e.message);
      }
    }
    // Stripe abonnement
    const userStripeCols = [
      { name: 'stripe_customer_id', def: { type: DataTypes.STRING(255), allowNull: true } },
      { name: 'stripe_subscription_id', def: { type: DataTypes.STRING(255), allowNull: true } },
      { name: 'subscription_current_period_start', def: { type: DataTypes.DATE, allowNull: true } },
      { name: 'subscription_current_period_end', def: { type: DataTypes.DATE, allowNull: true } },
    ];
    for (const c of userStripeCols) {
      try {
        await qi.addColumn('user', c.name, c.def);
        console.log('Colonne user.' + c.name + ' ajoutée.');
      } catch (e) {
        if (!e.message?.includes('already exists')) console.warn('Colonne user.' + c.name + ':', e.message);
      }
    }
    console.log('Tables créées avec succès.');
    process.exit(0);
  } catch (error) {
    console.error('Erreur lors de la synchronisation:', error);
    process.exit(1);
  }
}

sync();
