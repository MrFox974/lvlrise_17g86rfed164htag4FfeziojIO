require('dotenv').config();

const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const { DataTypes } = require('sequelize');
const { connectToDB, connectModels, sequelize } = require('./config/database');

const app = express();

// Configuration CORS : origines autorisées (séparées par des virgules dans CORS_ORIGIN)
// Ex. CORS_ORIGIN=https://lvlrise.com,https://www.lvlrise.com
const allowedOriginsRaw = (process.env.CORS_ORIGIN || 'http://localhost:5173').trim();
const allowedOrigins = allowedOriginsRaw
  .split(',')
  .map((o) => o.trim().replace(/\/$/, ''))
  .filter(Boolean);

const isOriginAllowed = (origin) => !origin || allowedOrigins.includes(origin);

// Un seul middleware CORS pour éviter le header Access-Control-Allow-Origin en double
app.use(cors({
  origin: function (origin, callback) {
    if (isOriginAllowed(origin)) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-CSRF-Token']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

require('./models/User');
require('./models/EmailVerificationToken');
require('./models/PendingRegistration');
require('./models/Routine');
require('./models/RoutineCompletion');
require('./models/RoutineDaySnapshot');
require('./models/TodoItem');
require('./models/FlashcardDeck');
require('./models/FlashcardChapter');
require('./models/Flashcard');
require('./models/AdminEvent');
require('./models/PageVisit');
require('./models/OnboardingSession');
require('./models/PushSubscription');
require('./models/NotificationLog');
require('./models/FlashcardJob');
require('./models/Upload');
require('./models/associations');

app.use('/api', require('./router/routine.route'));
app.use('/api', require('./router/todo.route'));
app.use('/api', require('./router/flashcard.route'));
app.use('/api', require('./router/stats.route'));
app.use('/api', require('./router/auth.route'));
app.use('/api', require('./router/onboarding.route'));
app.use('/api', require('./router/payment.route'));
app.use('/api', require('./router/admin.route'));
app.use('/api', require('./router/track.route'));
app.use('/api', require('./router/push.route'));
app.use('/api', require('./router/upload.route'));

// Middleware de gestion d'erreur global
app.use((err, req, res, next) => {
  console.error('Express error:', err);
  const origin = req.headers.origin;
  const ok = isOriginAllowed(origin);

  // Ajoute les headers CORS même en cas d'erreur
  if (ok && origin) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  }

  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    details: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  });
});

// Promesse partagée : résout quand la DB est prête (pour Lambda cold start)
// force: false = créer les tables si absentes, ne pas supprimer les données
const dbReadyPromise = (async () => {
  try {
    await connectToDB();
    await connectModels({ force: false });
    const qi = sequelize.getQueryInterface();
    // Colonnes user pour OAuth (Google / Apple) — ajout si absentes
    const userOAuthCols = [
      { name: 'auth_provider', def: { type: DataTypes.STRING(20), allowNull: true, defaultValue: 'local' } },
      { name: 'google_id', def: { type: DataTypes.STRING(255), allowNull: true } },
      { name: 'apple_id', def: { type: DataTypes.STRING(255), allowNull: true } },
      { name: 'refresh_token', def: { type: DataTypes.TEXT, allowNull: true } },
    ];
    for (const c of userOAuthCols) {
      try {
        await qi.addColumn('user', c.name, c.def);
        console.log('Colonne user.' + c.name + ' ajoutée.');
      } catch (e) {
        if (!e.message?.includes('already exists')) console.warn('user.' + c.name + ':', e.message);
      }
    }
    // Colonnes Stripe abonnement
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
        if (!e.message?.includes('already exists')) console.warn('user.' + c.name + ':', e.message);
      }
    }
    try {
      await qi.addColumn('onboarding_session', 'generation_log', { type: DataTypes.JSON });
      console.log('Colonne onboarding_session.generation_log ajoutée.');
    } catch (e) {
      if (!e.message?.includes('already exists')) console.warn('onboarding_session.generation_log:', e.message);
    }
    try {
      await qi.addColumn('user', 'onboarding_completed_at', { type: DataTypes.DATE, allowNull: true });
      console.log('Colonne user.onboarding_completed_at ajoutée.');
    } catch (e) {
      if (!e.message?.includes('already exists')) console.warn('user.onboarding_completed_at:', e.message);
    }
    try {
      await qi.addColumn('user', 'email_verified', { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false });
      console.log('Colonne user.email_verified ajoutée.');
    } catch (e) {
      if (!e.message?.includes('already exists')) console.warn('user.email_verified:', e.message);
    }
    try {
      await qi.addColumn('user', 'email_verified_at', { type: DataTypes.DATE, allowNull: true });
      console.log('Colonne user.email_verified_at ajoutée.');
    } catch (e) {
      if (!e.message?.includes('already exists')) console.warn('user.email_verified_at:', e.message);
    }
    try {
      await qi.addColumn('onboarding_session', 'generation_started_at', { type: DataTypes.DATE, allowNull: true });
      console.log('Colonne onboarding_session.generation_started_at ajoutée.');
    } catch (e) {
      if (!e.message?.includes('already exists')) console.warn('onboarding_session.generation_started_at:', e.message);
    }
    try {
      await qi.addColumn('onboarding_session', 'generation_cancelled', { type: DataTypes.BOOLEAN, defaultValue: false });
      console.log('Colonne onboarding_session.generation_cancelled ajoutée.');
    } catch (e) {
      if (!e.message?.includes('already exists')) console.warn('onboarding_session.generation_cancelled:', e.message);
    }
    // Première réussite d'une carte : sert à distinguer les cartes jamais sues.
    try {
      await qi.addColumn('flashcard', 'learned_at', { type: DataTypes.DATE, allowNull: true });
      console.log('Colonne flashcard.learned_at ajoutée.');
    } catch (e) {
      if (!e.message?.includes('already exists')) console.warn('flashcard.learned_at:', e.message);
    }
    // Dernière révision : alimente le cadran flashcards de la vue d'ensemble.
    try {
      await qi.addColumn('flashcard', 'last_reviewed_at', { type: DataTypes.DATE, allowNull: true });
      console.log('Colonne flashcard.last_reviewed_at ajoutée.');
    } catch (e) {
      if (!e.message?.includes('already exists')) console.warn('flashcard.last_reviewed_at:', e.message);
    }
    // Carte à l'unité : nature du travail, destination des cartes et propositions
    // en attente de validation.
    try {
      await qi.addColumn('flashcard_job', 'mode', { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'deck' });
      console.log('Colonne flashcard_job.mode ajoutée.');
    } catch (e) {
      if (!e.message?.includes('already exists')) console.warn('flashcard_job.mode:', e.message);
    }
    try {
      await qi.addColumn('flashcard_job', 'chapter_mode', { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'auto' });
      console.log('Colonne flashcard_job.chapter_mode ajoutée.');
    } catch (e) {
      if (!e.message?.includes('already exists')) console.warn('flashcard_job.chapter_mode:', e.message);
    }
    try {
      await qi.addColumn('flashcard_job', 'chapter_id', { type: DataTypes.INTEGER, allowNull: true });
      console.log('Colonne flashcard_job.chapter_id ajoutée.');
    } catch (e) {
      if (!e.message?.includes('already exists')) console.warn('flashcard_job.chapter_id:', e.message);
    }
    try {
      await qi.addColumn('flashcard_job', 'proposals', { type: DataTypes.JSON, allowNull: true });
      console.log('Colonne flashcard_job.proposals ajoutée.');
    } catch (e) {
      if (!e.message?.includes('already exists')) console.warn('flashcard_job.proposals:', e.message);
    }
    // Mode « compléter » : consigne facultative, distincte du sujet d'origine.
    try {
      await qi.addColumn('flashcard_job', 'refine_prompt', { type: DataTypes.TEXT, allowNull: true });
      console.log('Colonne flashcard_job.refine_prompt ajoutée.');
    } catch (e) {
      if (!e.message?.includes('already exists')) console.warn('flashcard_job.refine_prompt:', e.message);
    }
    // Photo sans texte : ce qui est stocké est une description, pas une transcription.
    try {
      await qi.addColumn('upload', 'content_kind', { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'text' });
      console.log('Colonne upload.content_kind ajoutée.');
    } catch (e) {
      if (!e.message?.includes('already exists')) console.warn('upload.content_kind:', e.message);
    }
  } catch (err) {
    console.error('Failed to init database:', err);
    throw err;
  }
})();

module.exports = app;
module.exports.dbReadyPromise = dbReadyPromise;