const { Sequelize } = require('sequelize');

require('dotenv').config();

// Supporte à la fois les anciens noms (DB_*) et les nouveaux test (DATABASE_*)
// IMPORTANT: utiliser ?? (pas ||) pour ne pas transformer '' en undefined
const DB_NAME = process.env.DATABASE_NAME ?? process.env.DB_NAME ?? '';
const DB_USER = process.env.DATABASE_USER ?? process.env.DB_USER ?? '';
const DB_PASSWORD = process.env.DATABASE_PASSWORD ?? process.env.DB_PASSWORD ?? '';
const DB_HOST = process.env.DATABASE_HOST ?? process.env.DB_HOST ?? 'localhost';
const DB_PORT_RAW = process.env.DATABASE_PORT ?? process.env.DB_PORT ?? 5432;
const DB_PORT = Number(DB_PORT_RAW);

// Validation en production : ne pas utiliser localhost
if (process.env.NODE_ENV === 'production' && (DB_HOST === 'localhost' || DB_HOST === '127.0.0.1')) {
  console.error('ERREUR CRITIQUE: DATABASE_HOST est défini sur localhost en production.');
  console.error('Veuillez configurer les variables d\'environnement dans AWS Lambda:');
  console.error('- DATABASE_HOST: doit pointer vers votre instance RDS PostgreSQL');
  console.error('- DATABASE_NAME, DATABASE_USER, DATABASE_PASSWORD doivent également être définis');
  console.error('Vous pouvez les configurer dans:');
  console.error('1. Console AWS Lambda > Configuration > Variables d\'environnement');
  console.error('2. Ou via SSM Parameter Store / Secrets Manager dans serverless.yml');
}

if (!Number.isFinite(DB_PORT)) {
  console.error('DATABASE_PORT invalide. Valeur reçue:', DB_PORT_RAW);
}

// RDS impose SSL : on l'active quand on n'est pas en localhost
const useSSL = DB_HOST && !DB_HOST.includes('localhost') && DB_HOST !== '127.0.0.1';

const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
  host: DB_HOST,
  port: DB_PORT,
  dialect: 'postgres',
  logging: false,
  dialectOptions: useSSL
    ? { ssl: { require: true, rejectUnauthorized: false } }
    : {},
  pool: {
    max: 1,
    min: 0,
    acquire: 10000,
    idle: 10000,
  },
});


const connectToDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('Connexion établie avec succés.');
  } catch (error) {
    console.error('Impossible de se connecter à la base de données:', error);
    throw error;
  }
};

const connectModels = async (force) => {
  try {
    await sequelize.sync(force);
    console.log('All models were synchronized successfully.');
  } catch (error) {
    console.error('Impossible de synchroniser les models :', error);
    throw error;
  }
};



module.exports = { sequelize, connectToDB, connectModels }