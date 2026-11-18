// Copie toutes les commandes PostgreSQL dans MongoDB (collection commandes_stats).
// Grâce à l'upsert sur commande_id, on peut le lancer plusieurs fois sans créer de doublon.
// Usage : npm run sync-stats
const db = require('../config/db');
const { connecterMongo, enregistrerStatCommande, viderStats } = require('../config/mongo');

// repartirDeZero = true : on vide d'abord MongoDB (après une réinstallation de PostgreSQL)
async function synchroniser(repartirDeZero = false) {
  if (!process.env.MONGODB_URI) {
    console.warn('MONGODB_URI absent : synchronisation MongoDB ignorée.');
    return;
  }
  await connecterMongo();
  if (repartirDeZero) await viderStats();
  const commandes = await db.query(
    'SELECT c.*, m.titre AS menu_titre FROM commande c JOIN menu m ON m.menu_id = c.menu_id'
  );
  for (const commande of commandes.rows) await enregistrerStatCommande(commande);
  console.log(`${commandes.rows.length} commande(s) synchronisée(s) dans MongoDB`);
}

module.exports = { synchroniser };

// Lancé directement (npm run sync-stats) et non importé par init-db.js
if (require.main === module) {
  synchroniser()
    .catch((erreur) => { console.error(erreur.message); process.exitCode = 1; })
    .finally(() => { db.pool.end(); process.exit(); });
}
