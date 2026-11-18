// Espace employé (/employe) : accessible aux employés ET à l'administrateur.
const fs = require('fs');
const path = require('path');
const express = require('express');
const db = require('../config/db');
const { envoyerMail } = require('../config/mail');
const { exigerRole } = require('../middlewares/securite');
const v = require('../services/validation');
const cmd = require('../services/commandes');

const router = express.Router();
router.use(exigerRole('employe', 'administrateur'));

// Un champ de formulaire répété (cases à cocher) arrive en tableau, ou en texte s'il n'y en a qu'un
const enTableau = (valeur) => [].concat(valeur || []).map(Number).filter(Number.isInteger);

const retour = (req, res, message, url) => {
  req.session.message = message;
  res.redirect(url);
};

// ===================== Commandes =====================
router.get('/', async (req, res) => {
  const statut = v.texte(req.query.statut, 30);
  const client = v.texte(req.query.client, 100);
  const commandes = await db.query(
    `SELECT c.*, m.titre AS menu_titre, u.nom, u.prenom, u.email
     FROM commande c JOIN menu m ON m.menu_id = c.menu_id JOIN utilisateur u ON u.utilisateur_id = c.utilisateur_id
     WHERE ($1 = '' OR c.statut = $1)
       AND ($2 = '' OR u.nom ILIKE '%' || $2 || '%' OR u.prenom ILIKE '%' || $2 || '%' OR u.email ILIKE '%' || $2 || '%')
     ORDER BY c.date_prestation`,
    [statut, client]
  );
  res.render('employe/commandes', { titre: 'Espace employé', commandes: commandes.rows, filtres: { statut, client } });
});

router.get('/commandes/:id', async (req, res) => {
  const commande = await cmd.chargerCommande(Number(req.params.id) || 0);
  if (!commande) return res.status(404).render('erreur', { titre: 'Commande introuvable', message: "Cette commande n'existe pas." });
  const suivi = await db.query('SELECT * FROM suivi_commande WHERE commande_id = $1 ORDER BY date_modification, suivi_id', [commande.commande_id]);
  res.render('employe/commande', { titre: 'Commande ' + commande.numero_commande, commande, suivi: suivi.rows });
});

// Statuts qu'un employé peut choisir (l'annulation passe par un formulaire dédié)
const STATUTS_EMPLOYE = ['accepte', 'en_preparation', 'en_livraison', 'livre', 'attente_materiel', 'terminee'];

router.post('/commandes/:id/statut', async (req, res) => {
  const commande = await cmd.chargerCommande(Number(req.params.id) || 0);
  const statut = req.body.statut;
  const url = '/employe/commandes/' + req.params.id;
  if (!commande || !STATUTS_EMPLOYE.includes(statut)) return retour(req, res, 'Statut invalide.', url);
  if (['annulee', 'terminee'].includes(commande.statut)) return retour(req, res, 'Cette commande est clôturée.', url);

  if (statut === 'attente_materiel') {
    await cmd.changerStatut(commande.commande_id, statut, { pret_materiel: true });
    await envoyerMail(commande.email, 'Restitution du matériel prêté',
      `Bonjour ${commande.prenom},\n\nVotre commande ${commande.numero_commande} a été livrée avec du matériel prêté.\n` +
      `Merci de nous contacter pour organiser sa restitution. Si le matériel n'est pas restitué sous 10 jours ouvrés, ` +
      `des frais de 600 € vous seront facturés, conformément à nos conditions générales de vente.\n\nJulie et José`);
  } else if (statut === 'terminee') {
    await cmd.changerStatut(commande.commande_id, statut, { restitution_materiel: commande.pret_materiel });
    await envoyerMail(commande.email, 'Votre commande est terminée : donnez-nous votre avis',
      `Bonjour ${commande.prenom},\n\nVotre commande ${commande.numero_commande} est terminée. Merci de votre confiance !\n` +
      `Connectez-vous à votre espace pour nous donner votre avis : ${process.env.APP_URL || 'http://localhost:3000'}/compte\n\nJulie et José`);
  } else {
    await cmd.changerStatut(commande.commande_id, statut);
  }
  retour(req, res, 'Statut mis à jour : ' + cmd.STATUTS[statut], url);
});

// Annulation : l'employé doit avoir contacté le client et indiquer le mode de contact et le motif
router.post('/commandes/:id/annuler', async (req, res) => {
  const commande = await cmd.chargerCommande(Number(req.params.id) || 0);
  const url = '/employe/commandes/' + req.params.id;
  const modeContact = req.body.mode_contact;
  const motif = v.texte(req.body.motif, 500);
  if (!commande || ['annulee', 'terminee'].includes(commande.statut)) return retour(req, res, 'Cette commande ne peut pas être annulée.', url);
  if (!['gsm', 'mail'].includes(modeContact) || !motif) {
    return retour(req, res, "Indiquez le mode de contact utilisé et le motif de l'annulation.", url);
  }
  await cmd.changerStatut(commande.commande_id, 'annulee', { mode_contact: modeContact, motif_annulation: motif });
  retour(req, res, 'La commande a été annulée.', url);
});

// ===================== Menus =====================
// Les images sont des fichiers présents dans le dépôt (public/images/menus) : pas d'upload.
const imagesDisponibles = () =>
  fs.readdirSync(path.join(__dirname, '../public/images/menus')).filter((f) => /\.(svg|jpe?g|png|webp)$/i.test(f));

async function donneesFormulaireMenu() {
  const [themes, regimes, plats] = await Promise.all([
    db.query('SELECT * FROM theme ORDER BY libelle'),
    db.query('SELECT * FROM regime ORDER BY libelle'),
    db.query('SELECT * FROM plat ORDER BY type, titre_plat'),
  ]);
  return { themes: themes.rows, regimes: regimes.rows, plats: plats.rows, images: imagesDisponibles() };
}

router.get('/menus', async (req, res) => {
  const menus = await db.query(
    'SELECT m.*, t.libelle AS theme FROM menu m JOIN theme t ON t.theme_id = m.theme_id ORDER BY m.titre'
  );
  res.render('employe/menus', { titre: 'Gestion des menus', menus: menus.rows });
});

router.get('/menus/nouveau', async (req, res) => {
  res.render('employe/menu-form', { titre: 'Nouveau menu', menu: {}, platsMenu: [], imagesMenu: [], ...(await donneesFormulaireMenu()) });
});

router.get('/menus/:id/modifier', async (req, res) => {
  const id = Number(req.params.id) || 0;
  const menu = (await db.query('SELECT * FROM menu WHERE menu_id = $1', [id])).rows[0];
  if (!menu) return res.redirect('/employe/menus');
  const platsMenu = (await db.query('SELECT plat_id FROM menu_plat WHERE menu_id = $1', [id])).rows.map((r) => r.plat_id);
  const imagesMenu = (await db.query('SELECT chemin FROM image_menu WHERE menu_id = $1', [id])).rows.map((r) => path.basename(r.chemin));
  res.render('employe/menu-form', { titre: 'Modifier le menu', menu, platsMenu, imagesMenu, ...(await donneesFormulaireMenu()) });
});

// Création (pas d'id) ou modification (id) d'un menu, avec ses plats et ses images, dans une transaction
async function enregistrerMenu(req, res, id) {
  const m = {
    titre: v.texte(req.body.titre, 100),
    description: v.texte(req.body.description, 2000),
    theme_id: v.entier(req.body.theme_id),
    regime_id: v.entier(req.body.regime_id),
    nombre_personne_minimum: v.entier(req.body.nombre_personne_minimum),
    prix_minimum: Number(req.body.prix_minimum),
    conditions: v.texte(req.body.conditions, 2000),
    quantite_restante: v.entier(req.body.quantite_restante),
  };
  const images = [].concat(req.body.images || []).filter((f) => imagesDisponibles().includes(f));
  if (!m.titre || !m.description || !m.theme_id || !m.regime_id || !m.nombre_personne_minimum || !(m.prix_minimum > 0) || m.quantite_restante === null) {
    return retour(req, res, 'Tous les champs obligatoires doivent être remplis correctement.', id ? `/employe/menus/${id}/modifier` : '/employe/menus/nouveau');
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const valeurs = [m.titre, m.description, m.theme_id, m.regime_id, m.nombre_personne_minimum, m.prix_minimum, m.conditions, m.quantite_restante];
    if (id) {
      await client.query(
        `UPDATE menu SET titre=$1, description=$2, theme_id=$3, regime_id=$4, nombre_personne_minimum=$5,
           prix_minimum=$6, conditions=$7, quantite_restante=$8 WHERE menu_id=$9`, [...valeurs, id]);
      await client.query('DELETE FROM menu_plat WHERE menu_id = $1', [id]);
      await client.query('DELETE FROM image_menu WHERE menu_id = $1', [id]);
    } else {
      const r = await client.query(
        `INSERT INTO menu (titre, description, theme_id, regime_id, nombre_personne_minimum, prix_minimum, conditions, quantite_restante)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING menu_id`, valeurs);
      id = r.rows[0].menu_id;
    }
    for (const platId of enTableau(req.body.plats)) {
      await client.query('INSERT INTO menu_plat (menu_id, plat_id) VALUES ($1, $2)', [id, platId]);
    }
    for (const fichier of images) {
      await client.query('INSERT INTO image_menu (menu_id, chemin, texte_alternatif) VALUES ($1, $2, $3)',
        [id, '/images/menus/' + fichier, 'Illustration du ' + m.titre]);
    }
    await client.query('COMMIT');
  } catch (erreur) {
    await client.query('ROLLBACK');
    throw erreur;
  } finally {
    client.release();
  }
  retour(req, res, 'Le menu a été enregistré.', '/employe/menus');
}

router.post('/menus', (req, res) => enregistrerMenu(req, res, null));
router.post('/menus/:id', (req, res) => enregistrerMenu(req, res, Number(req.params.id) || 0));

router.post('/menus/:id/supprimer', async (req, res) => {
  try {
    await db.query('DELETE FROM menu WHERE menu_id = $1', [Number(req.params.id) || 0]);
    retour(req, res, 'Le menu a été supprimé.', '/employe/menus');
  } catch (erreur) {
    // 23503 = clé étrangère : des commandes utilisent ce menu, on garde l'historique
    if (erreur.code !== '23503') throw erreur;
    retour(req, res, 'Ce menu a déjà été commandé : il ne peut pas être supprimé. Mettez son stock à 0 pour le retirer de la vente.', '/employe/menus');
  }
});

// ===================== Plats =====================
router.get('/plats', async (req, res) => {
  const [plats, allergenes] = await Promise.all([
    db.query(
      `SELECT p.*, STRING_AGG(a.libelle, ', ' ORDER BY a.libelle) AS allergenes, ARRAY_AGG(a.allergene_id) AS allergene_ids
       FROM plat p LEFT JOIN plat_allergene pa ON pa.plat_id = p.plat_id LEFT JOIN allergene a ON a.allergene_id = pa.allergene_id
       GROUP BY p.plat_id ORDER BY p.type, p.titre_plat`),
    db.query('SELECT * FROM allergene ORDER BY libelle'),
  ]);
  const enEdition = plats.rows.find((p) => p.plat_id === Number(req.query.modifier)) || null;
  res.render('employe/plats', { titre: 'Gestion des plats', plats: plats.rows, allergenes: allergenes.rows, enEdition });
});

async function enregistrerPlat(req, res, id) {
  const titre = v.texte(req.body.titre_plat, 100);
  const type = req.body.type;
  if (!titre || !['entree', 'plat', 'dessert'].includes(type)) return retour(req, res, 'Titre et type obligatoires.', '/employe/plats');
  if (id) {
    await db.query('UPDATE plat SET titre_plat = $1, type = $2 WHERE plat_id = $3', [titre, type, id]);
    await db.query('DELETE FROM plat_allergene WHERE plat_id = $1', [id]);
  } else {
    id = (await db.query('INSERT INTO plat (titre_plat, type) VALUES ($1, $2) RETURNING plat_id', [titre, type])).rows[0].plat_id;
  }
  for (const allergeneId of enTableau(req.body.allergenes)) {
    await db.query('INSERT INTO plat_allergene (plat_id, allergene_id) VALUES ($1, $2)', [id, allergeneId]);
  }
  retour(req, res, 'Le plat a été enregistré.', '/employe/plats');
}

router.post('/plats', (req, res) => enregistrerPlat(req, res, null));
router.post('/plats/:id', (req, res) => enregistrerPlat(req, res, Number(req.params.id) || 0));
router.post('/plats/:id/supprimer', async (req, res) => {
  await db.query('DELETE FROM plat WHERE plat_id = $1', [Number(req.params.id) || 0]);
  retour(req, res, 'Le plat a été supprimé.', '/employe/plats');
});

// ===================== Horaires =====================
router.get('/horaires', (req, res) => res.render('employe/horaires', { titre: 'Horaires' }));

router.post('/horaires', async (req, res) => {
  const heure = (h) => (/^\d{2}:\d{2}$/.test(h) ? h : null); // vide = fermé
  const horaires = await db.query('SELECT horaire_id FROM horaire');
  for (const { horaire_id } of horaires.rows) {
    const ferme = req.body['ferme_' + horaire_id];
    await db.query('UPDATE horaire SET heure_ouverture = $1, heure_fermeture = $2 WHERE horaire_id = $3', [
      ferme ? null : heure(req.body['ouverture_' + horaire_id]),
      ferme ? null : heure(req.body['fermeture_' + horaire_id]),
      horaire_id,
    ]);
  }
  retour(req, res, 'Les horaires ont été mis à jour.', '/employe/horaires');
});

// ===================== Avis =====================
router.get('/avis', async (req, res) => {
  const avis = await db.query(
    `SELECT a.*, u.prenom, u.nom, c.numero_commande FROM avis a
     JOIN utilisateur u ON u.utilisateur_id = a.utilisateur_id JOIN commande c ON c.commande_id = a.commande_id
     ORDER BY (a.statut = 'en_attente') DESC, a.date_avis DESC`);
  res.render('employe/avis', { titre: 'Avis clients', avis: avis.rows });
});

router.post('/avis/:id', async (req, res) => {
  if (['valide', 'refuse'].includes(req.body.statut)) {
    await db.query('UPDATE avis SET statut = $1 WHERE avis_id = $2', [req.body.statut, Number(req.params.id) || 0]);
  }
  retour(req, res, "L'avis a été traité.", '/employe/avis');
});

module.exports = router;
