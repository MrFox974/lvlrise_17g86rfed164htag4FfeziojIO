const fs = require('fs');
const path = require('path');
const { sequelize } = require('./config/database');

async function runMigration() {
  const filePath = path.join(__dirname, 'migrations', '007-single-card-generation.sql');
  console.log('Exécution de la migration SQL:', filePath);

  const sql = fs.readFileSync(filePath, 'utf8');

  try {
    await sequelize.authenticate();
    console.log('Connexion DB OK, lancement de la migration...');
    await sequelize.query(sql);
    console.log('Migration 007-single-card-generation.sql exécutée avec succès.');
  } catch (error) {
    console.error('Erreur lors de la migration 007-single-card-generation.sql:', error);
    process.exitCode = 1;
  } finally {
    await sequelize.close().catch(() => {});
  }
}

runMigration();
