// Connexion à MongoDB (base NoSQL), utilisée pour les statistiques de l'administrateur.
//
// Pour chaque commande, on enregistre un document dans la collection "commandes_stats" :
//   { commande_id, menu_id, menu_titre, prix_total, statut, date_commande }
// Un index UNIQUE sur commande_id garantit qu'une commande n'est jamais comptée deux fois :
// on fait un "upsert" (mise à jour si le document existe, création sinon).
const { MongoClient } = require('mongodb');

let collection = null;

async function connecterMongo() {
  if (!process.env.MONGODB_URI) {
    console.warn('MONGODB_URI absent : les statistiques NoSQL sont désactivées.');
    return;
  }
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  collection = client.db('vite_gourmand').collection('commandes_stats');
  await collection.createIndex({ commande_id: 1 }, { unique: true });
  console.log('Connecté à MongoDB');
}

// À appeler après chaque création ou modification d'une commande dans PostgreSQL.
// "commande" contient les colonnes de la table commande + menu_titre.
async function enregistrerStatCommande(commande) {
  if (!collection) return;
  try {
    await collection.updateOne(
      { commande_id: commande.commande_id },
      {
        $set: {
          menu_id: commande.menu_id,
          menu_titre: commande.menu_titre,
          prix_total: Number(commande.prix_total),
          statut: commande.statut,
          date_commande: new Date(commande.date_commande),
        },
      },
      { upsert: true }
    );
  } catch (erreur) {
    // La commande est déjà enregistrée dans PostgreSQL : on ne bloque pas le client.
    // "npm run sync-stats" permet de resynchroniser MongoDB à tout moment.
    console.error('Erreur MongoDB (statistiques) :', erreur.message);
  }
}

// Nombre de commandes et chiffre d'affaires par menu (commandes annulées exclues).
// filtres : { menuId, debut, fin } (tous optionnels)
async function statistiquesParMenu({ menuId, debut, fin } = {}) {
  if (!collection) return null;
  const filtre = { statut: { $ne: 'annulee' } };
  if (menuId) filtre.menu_id = menuId;
  if (debut || fin) {
    filtre.date_commande = {};
    if (debut) filtre.date_commande.$gte = debut;
    if (fin) filtre.date_commande.$lte = fin;
  }
  return collection
    .aggregate([
      { $match: filtre },
      {
        $group: {
          _id: '$menu_id',
          menu_titre: { $first: '$menu_titre' },
          nombre_commandes: { $sum: 1 },
          chiffre_affaires: { $sum: '$prix_total' },
        },
      },
      { $sort: { nombre_commandes: -1 } },
    ])
    .toArray();
}

// Vide la collection (utilisé uniquement par scripts/init-db.js lors d'une réinstallation)
async function viderStats() {
  if (collection) await collection.deleteMany({});
}

module.exports = { connecterMongo, enregistrerStatCommande, statistiquesParMenu, viderStats };
