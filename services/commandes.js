// Règles métier des commandes, partagées entre l'espace client et l'espace employé.
const crypto = require('crypto');
const db = require('../config/db');
const { enregistrerStatCommande } = require('../config/mongo');
const { calculerPrix } = require('./prix');
const { localiserAdresse } = require('./livraison');
const v = require('./validation');

// Libellés affichés pour chaque statut (la clé est la valeur stockée en base)
const STATUTS = {
  en_attente: 'En attente de validation',
  accepte: 'Acceptée',
  en_preparation: 'En préparation',
  en_livraison: 'En cours de livraison',
  livre: 'Livrée',
  attente_materiel: 'En attente du retour de matériel',
  terminee: 'Terminée',
  annulee: 'Annulée',
};

// Lit et vérifie le formulaire de commande, localise l'adresse et calcule le prix.
// Renvoie { erreurs: [...] } ou { donnees, prix, livraison }.
async function preparerCommande(body, menu) {
  const donnees = {
    date_prestation: v.texte(body.date_prestation, 10),
    heure_livraison: v.texte(body.heure_livraison, 5),
    adresse_livraison: v.texte(body.adresse_livraison),
    code_postal: v.texte(body.code_postal, 10),
    ville_livraison: v.texte(body.ville_livraison, 100),
    nombre_personne: Number(body.nombre_personne),
  };

  const erreurs = [];
  const demain = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(donnees.date_prestation) || donnees.date_prestation < demain) {
    erreurs.push('La date de prestation doit être au minimum demain.');
  }
  if (!/^\d{2}:\d{2}$/.test(donnees.heure_livraison)) erreurs.push("L'heure de livraison n'est pas valide.");
  if (!donnees.adresse_livraison || !donnees.ville_livraison) erreurs.push("L'adresse de livraison est obligatoire.");
  if (!v.estCodePostalValide(donnees.code_postal)) erreurs.push('Le code postal doit contenir 5 chiffres.');
  if (!Number.isInteger(donnees.nombre_personne) || donnees.nombre_personne < menu.nombre_personne_minimum) {
    erreurs.push(`Ce menu se commande pour ${menu.nombre_personne_minimum} personnes minimum.`);
  }
  if (erreurs.length) return { erreurs };

  // La distance est calculée par le serveur à partir de l'adresse (jamais saisie par le client)
  let livraison;
  try {
    livraison = await localiserAdresse(donnees.adresse_livraison, donnees.code_postal, donnees.ville_livraison);
  } catch {
    return { erreurs: ["Le calcul de la distance de livraison est momentanément indisponible. Réessayez dans quelques instants."] };
  }
  if (!livraison) return { erreurs: ["Adresse de livraison introuvable. Vérifiez l'adresse, le code postal et la ville."] };

  const prix = calculerPrix({
    prixMinimum: menu.prix_minimum,
    nombreMinimum: menu.nombre_personne_minimum,
    nombrePersonnes: donnees.nombre_personne,
    estBordeaux: livraison.estBordeaux,
    distanceKm: livraison.distanceKm,
  });
  donnees.ville_livraison = livraison.ville; // ville normalisée par l'API Adresse
  return { erreurs: [], donnees, prix, livraison };
}

// Charge une commande avec le titre du menu.
// Si utilisateurId est donné, la commande doit lui appartenir (un client ne voit pas celles des autres).
async function chargerCommande(commandeId, utilisateurId = null) {
  const resultat = await db.query(
    `SELECT c.*, m.titre AS menu_titre, m.nombre_personne_minimum, m.prix_minimum,
            u.nom, u.prenom, u.email, u.telephone
     FROM commande c
     JOIN menu m ON m.menu_id = c.menu_id
     JOIN utilisateur u ON u.utilisateur_id = c.utilisateur_id
     WHERE c.commande_id = $1 AND ($2::int IS NULL OR c.utilisateur_id = $2)`,
    [commandeId, utilisateurId]
  );
  return resultat.rows[0] || null;
}

// Crée la commande : vérifie le stock, le décrémente et enregistre le premier statut,
// le tout dans une TRANSACTION (soit tout est enregistré, soit rien).
async function creerCommande(utilisateurId, menuId, donnees, prix) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    // FOR UPDATE verrouille la ligne du menu : deux commandes simultanées ne peuvent pas prendre le dernier stock
    const stock = await client.query('SELECT quantite_restante FROM menu WHERE menu_id = $1 FOR UPDATE', [menuId]);
    if (!stock.rows.length || stock.rows[0].quantite_restante <= 0) {
      await client.query('ROLLBACK');
      return null;
    }
    await client.query('UPDATE menu SET quantite_restante = quantite_restante - 1 WHERE menu_id = $1', [menuId]);

    const numero = 'VG-' + new Date().toISOString().slice(0, 10).replaceAll('-', '') + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
    const resultat = await client.query(
      `INSERT INTO commande (numero_commande, utilisateur_id, menu_id, date_prestation, heure_livraison, adresse_livraison,
         code_postal, ville_livraison, distance_km, nombre_personne, prix_menu, reduction, prix_livraison, prix_total)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING commande_id`,
      [numero, utilisateurId, menuId, donnees.date_prestation, donnees.heure_livraison, donnees.adresse_livraison,
       donnees.code_postal, donnees.ville_livraison, prix.distanceKm, donnees.nombre_personne,
       prix.prixMenu, prix.reduction, prix.prixLivraison, prix.prixTotal]
    );
    const commandeId = resultat.rows[0].commande_id;
    await client.query("INSERT INTO suivi_commande (commande_id, statut) VALUES ($1, 'en_attente')", [commandeId]);
    await client.query('COMMIT');

    await synchroniserStat(commandeId);
    return commandeId;
  } catch (erreur) {
    await client.query('ROLLBACK');
    throw erreur;
  } finally {
    client.release(); // rend la connexion au pool
  }
}

// Modifie une commande encore "en attente" (tout sauf le menu)
async function modifierCommande(commandeId, donnees, prix) {
  await db.query(
    `UPDATE commande SET date_prestation = $1, heure_livraison = $2, adresse_livraison = $3, code_postal = $4,
       ville_livraison = $5, distance_km = $6, nombre_personne = $7, prix_menu = $8, reduction = $9,
       prix_livraison = $10, prix_total = $11
     WHERE commande_id = $12 AND statut = 'en_attente'`,
    [donnees.date_prestation, donnees.heure_livraison, donnees.adresse_livraison, donnees.code_postal,
     donnees.ville_livraison, prix.distanceKm, donnees.nombre_personne, prix.prixMenu, prix.reduction,
     prix.prixLivraison, prix.prixTotal, commandeId]
  );
  await synchroniserStat(commandeId);
}

// Change le statut, l'ajoute à l'historique (suivi) et met à jour MongoDB.
// "complements" permet d'enregistrer en même temps le motif d'annulation, le prêt de matériel...
async function changerStatut(commandeId, statut, complements = {}) {
  await db.query(
    `UPDATE commande SET statut = $1,
       pret_materiel = COALESCE($2, pret_materiel),
       restitution_materiel = COALESCE($3, restitution_materiel),
       mode_contact = COALESCE($4, mode_contact),
       motif_annulation = COALESCE($5, motif_annulation)
     WHERE commande_id = $6`,
    [statut, complements.pret_materiel ?? null, complements.restitution_materiel ?? null,
     complements.mode_contact ?? null, complements.motif_annulation ?? null, commandeId]
  );
  await db.query('INSERT INTO suivi_commande (commande_id, statut) VALUES ($1, $2)', [commandeId, statut]);
  // Une commande annulée libère sa place dans le stock du menu
  if (statut === 'annulee') {
    await db.query(
      'UPDATE menu SET quantite_restante = quantite_restante + 1 WHERE menu_id = (SELECT menu_id FROM commande WHERE commande_id = $1)',
      [commandeId]
    );
  }
  await synchroniserStat(commandeId);
}

// Copie la commande dans MongoDB (upsert : jamais de doublon)
async function synchroniserStat(commandeId) {
  const commande = await chargerCommande(commandeId);
  if (commande) await enregistrerStatCommande(commande);
}

module.exports = { STATUTS, preparerCommande, chargerCommande, creerCommande, modifierCommande, changerStatut };
