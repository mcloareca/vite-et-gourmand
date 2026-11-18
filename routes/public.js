// Pages accessibles à tous : accueil, menus, détail d'un menu, contact, pages légales.
const express = require('express');
const rateLimit = require('express-rate-limit');
const db = require('../config/db');
const { envoyerMail } = require('../config/mail');
const { texte, estEmailValide } = require('../services/validation');

const router = express.Router();

// Recherche des menus selon les filtres. Utilisée par la page /menus et par le filtre dynamique.
// La requête SQL est construite morceau par morceau, mais les valeurs restent des paramètres ($1, $2...).
async function chercherMenus(filtres) {
  const conditions = [];
  const valeurs = [];
  const ajouter = (condition, valeur) => {
    valeurs.push(valeur);
    conditions.push(condition.replace('?', '$' + valeurs.length));
  };

  if (Number(filtres.prix_min) > 0) ajouter('m.prix_minimum >= ?', Number(filtres.prix_min));
  if (Number(filtres.prix_max) > 0) ajouter('m.prix_minimum <= ?', Number(filtres.prix_max));
  if (Number(filtres.theme) > 0) ajouter('m.theme_id = ?', Number(filtres.theme));
  if (Number(filtres.regime) > 0) ajouter('m.regime_id = ?', Number(filtres.regime));
  // "Nombre de personnes" : on affiche les menus commandables pour ce nombre de convives
  if (Number(filtres.personnes) > 0) ajouter('m.nombre_personne_minimum <= ?', Number(filtres.personnes));

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const resultat = await db.query(
    `SELECT m.*, t.libelle AS theme, r.libelle AS regime,
            (SELECT chemin FROM image_menu i WHERE i.menu_id = m.menu_id ORDER BY image_id LIMIT 1) AS image,
            (SELECT texte_alternatif FROM image_menu i WHERE i.menu_id = m.menu_id ORDER BY image_id LIMIT 1) AS image_alt
     FROM menu m
     JOIN theme t ON t.theme_id = m.theme_id
     JOIN regime r ON r.regime_id = m.regime_id
     ${where}
     ORDER BY m.prix_minimum`,
    valeurs
  );
  return resultat.rows;
}

// --- Accueil : présentation + avis validés
router.get('/', async (req, res) => {
  const avis = await db.query(
    `SELECT a.note, a.description, u.prenom, m.titre AS menu
     FROM avis a
     JOIN utilisateur u ON u.utilisateur_id = a.utilisateur_id
     JOIN commande c ON c.commande_id = a.commande_id
     JOIN menu m ON m.menu_id = c.menu_id
     WHERE a.statut = 'valide'
     ORDER BY a.date_avis DESC LIMIT 6`
  );
  res.render('accueil', { titre: 'Accueil', avis: avis.rows });
});

// --- Vue globale des menus avec filtres
router.get('/menus', async (req, res) => {
  const [menus, themes, regimes] = await Promise.all([
    chercherMenus(req.query),
    db.query('SELECT * FROM theme ORDER BY libelle'),
    db.query('SELECT * FROM regime ORDER BY libelle'),
  ]);
  res.render('menus', { titre: 'Nos menus', menus, themes: themes.rows, regimes: regimes.rows, filtres: req.query });
});

// --- Filtre dynamique : renvoie uniquement la liste des menus (fragment HTML),
// insérée dans la page par public/js/filtres.js sans recharger la page.
router.get('/menus/filtrer', async (req, res) => {
  const menus = await chercherMenus(req.query);
  res.render('partials/liste-menus', { menus });
});

// --- Détail d'un menu
router.get('/menus/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(404).render('erreur', { titre: 'Menu introuvable', message: "Ce menu n'existe pas." });

  const menu = await db.query(
    `SELECT m.*, t.libelle AS theme, r.libelle AS regime
     FROM menu m JOIN theme t ON t.theme_id = m.theme_id JOIN regime r ON r.regime_id = m.regime_id
     WHERE m.menu_id = $1`,
    [id]
  );
  if (menu.rows.length === 0) return res.status(404).render('erreur', { titre: 'Menu introuvable', message: "Ce menu n'existe pas." });

  const [images, plats] = await Promise.all([
    db.query('SELECT * FROM image_menu WHERE menu_id = $1 ORDER BY image_id', [id]),
    db.query(
      `SELECT p.titre_plat, p.type, STRING_AGG(a.libelle, ', ' ORDER BY a.libelle) AS allergenes
       FROM menu_plat mp
       JOIN plat p ON p.plat_id = mp.plat_id
       LEFT JOIN plat_allergene pa ON pa.plat_id = p.plat_id
       LEFT JOIN allergene a ON a.allergene_id = pa.allergene_id
       WHERE mp.menu_id = $1
       GROUP BY p.plat_id ORDER BY p.titre_plat`,
      [id]
    ),
  ]);

  res.render('menu-detail', { titre: menu.rows[0].titre, menu: menu.rows[0], images: images.rows, plats: plats.rows });
});

// --- Contact
router.get('/contact', (req, res) => {
  res.render('contact', { titre: 'Contact', erreurs: [], valeurs: {} });
});

// Limite à 5 messages par quart d'heure et par adresse IP (anti-spam)
const limiteContact = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5 });

router.post('/contact', limiteContact, async (req, res) => {
  const valeurs = { titre: texte(req.body.titre, 100), description: texte(req.body.description, 2000), email: texte(req.body.email) };
  const erreurs = [];
  if (!valeurs.titre || !valeurs.description) erreurs.push('Le titre et la description sont obligatoires.');
  if (!estEmailValide(valeurs.email)) erreurs.push("L'adresse e-mail n'est pas valide.");
  if (erreurs.length) return res.status(400).render('contact', { titre: 'Contact', erreurs, valeurs });

  await envoyerMail(
    process.env.CONTACT_EMAIL || 'contact@vite-gourmand.fr',
    `[Contact] ${valeurs.titre}`,
    `Message de ${valeurs.email} :\n\n${valeurs.description}`
  );
  req.session.message = 'Votre message a bien été envoyé. Nous vous répondrons rapidement.';
  res.redirect('/contact');
});

// --- Pages légales
router.get('/mentions-legales', (req, res) => res.render('mentions-legales', { titre: 'Mentions légales' }));
router.get('/cgv', (req, res) => res.render('cgv', { titre: 'Conditions générales de vente' }));

module.exports = router;
