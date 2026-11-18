// Crée les tables et insère les données de démonstration dans PostgreSQL,
// puis copie les commandes dans MongoDB pour les statistiques.
// Usage : npm run init-db   (ATTENTION : efface toutes les données existantes)
const fs = require('fs');
const path = require('path');
const db = require('../config/db');

async function executerFichier(nom) {
  const sql = fs.readFileSync(path.join(__dirname, '../database', nom), 'utf8');
  await db.query(sql);
  console.log(`${nom} exécuté`);
}

(async () => {
  try {
    await executerFichier('creation.sql');
    await executerFichier('donnees.sql');
    await require('./sync-stats').synchroniser(true);
  } catch (erreur) {
    console.error('Erreur :', erreur.message);
    process.exitCode = 1;
  } finally {
    await db.pool.end();
    process.exit(); // ferme aussi la connexion MongoDB
  }
})();
