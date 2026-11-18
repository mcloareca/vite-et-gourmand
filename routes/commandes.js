// Commande d'un menu et espace utilisateur (/compte).
const express = require('express');
const db = require('../config/db');
const { envoyerMail } = require('../config/mail');
const { exigerConnexion } = require('../middlewares/securite');
const v = require('../services/validation');
const cmd = require('../services/commandes');

const router = express.Router();

const chargerMenu = async (menuId) =>
  (await db.query('SELECT * FROM menu WHERE menu_id = $1', [Number(menuId) || 0])).rows[0];

const chargerProfil = async (utilisateurId) =>
  (await db.query('SELECT * FROM utilisateur WHERE utilisateur_id = $1', [utilisateurId])).rows[0];

// ---------- Formulaire de commande ----------
// Accessible uniquement connecté : un visiteur est redirigé vers /connexion puis revient ici.
router.get('/commande', exigerConnexion, async (req, res) => {
  const menus = await db.query('SELECT menu_id, titre, nombre_personne_minimum, conditions FROM menu ORDER BY titre');
  const profil = await chargerProfil(req.session.utilisateur.id);
  const menuChoisi = menus.rows.find((m) => m.menu_id === Number(req.query.menu)) || menus.rows[0];
  res.render('commande', {
    titre: 'Commander un menu',
    menus: menus.rows,
    menuChoisi,
    profil,
    valeurs: {
      adresse_livraison: profil.adresse_postale,
      code_postal: profil.code_postal,
      ville_livraison: profil.ville,
      nombre_personne: menuChoisi ? menuChoisi.nombre_personne_minimum : 1,
    },
    erreurs: [],
    modification: null,
  });
});

// Estimation du prix appelée en JavaScript (fetch) pendant que le client remplit le formulaire.
// Le calcul est fait par le serveur avec la même fonction que pour la commande réelle.
router.post('/commande/estimation', exigerConnexion, async (req, res) => {
  const menu = await chargerMenu(req.body.menu_id);
  if (!menu) return res.status(400).json({ erreurs: ['Menu introuvable.'] });
  const resultat = await cmd.preparerCommande(req.body, menu);
  if (resultat.erreurs.length) return res.status(400).json({ erreurs: resultat.erreurs });
  res.json({ prix: resultat.prix, ville: resultat.livraison.ville });
});

router.post('/commande', exigerConnexion, async (req, res) => {
  const menu = await chargerMenu(req.body.menu_id);
  if (!menu) return res.redirect('/menus');

  const resultat = await cmd.preparerCommande(req.body, menu);
  if (!req.body.cgv) resultat.erreurs.push('Vous devez accepter les conditions générales de vente et les conditions du menu.');
  if (resultat.erreurs.length) {
    const menus = await db.query('SELECT menu_id, titre, nombre_personne_minimum, conditions FROM menu ORDER BY titre');
    return res.status(400).render('commande', {
      titre: 'Commander un menu', menus: menus.rows, menuChoisi: menu,
      profil: await chargerProfil(req.session.utilisateur.id),
      valeurs: req.body, erreurs: resultat.erreurs, modification: null,
    });
  }

  const commandeId = await cmd.creerCommande(req.session.utilisateur.id, menu.menu_id, resultat.donnees, resultat.prix);
  if (!commandeId) {
    req.session.message = "Désolé, ce menu n'est plus disponible (stock épuisé).";
    return res.redirect('/menus/' + menu.menu_id);
  }

  const commande = await cmd.chargerCommande(commandeId);
  await envoyerMail(commande.email, `Confirmation de votre commande ${commande.numero_commande}`,
    `Bonjour ${commande.prenom},\n\nNous avons bien reçu votre commande :\n` +
    `- Menu : ${commande.menu_titre} pour ${commande.nombre_personne} personnes\n` +
    `- Prestation le ${commande.date_prestation} à ${commande.heure_livraison}\n` +
    `- Adresse : ${commande.adresse_livraison}, ${commande.code_postal} ${commande.ville_livraison}\n` +
    `- Total : ${commande.prix_total} €\n\nNotre équipe va la valider rapidement.\nJulie et José`);

  req.session.message = 'Votre commande a été enregistrée. Un e-mail de confirmation vous a été envoyé.';
  res.redirect('/compte/commandes/' + commandeId);
});

// ---------- Espace utilisateur ----------
router.get('/compte', exigerConnexion, async (req, res) => {
  const [profil, commandes] = await Promise.all([
    chargerProfil(req.session.utilisateur.id),
    db.query(
      `SELECT c.*, m.titre AS menu_titre FROM commande c JOIN menu m ON m.menu_id = c.menu_id
       WHERE c.utilisateur_id = $1 ORDER BY c.date_commande DESC`,
      [req.session.utilisateur.id]
    ),
  ]);
  res.render('compte/index', { titre: 'Mon espace', profil, commandes: commandes.rows, erreurs: [] });
});

router.post('/compte/profil', exigerConnexion, async (req, res) => {
  const valeurs = {
    nom: v.texte(req.body.nom, 50), prenom: v.texte(req.body.prenom, 50), email: v.texte(req.body.email).toLowerCase(),
    telephone: v.texte(req.body.telephone, 20), adresse_postale: v.texte(req.body.adresse_postale),
    code_postal: v.texte(req.body.code_postal, 10), ville: v.texte(req.body.ville, 100),
  };
  const erreurs = v.verifierProfil(valeurs);
  if (!erreurs.length) {
    try {
      await db.query(
        `UPDATE utilisateur SET nom = $1, prenom = $2, email = $3, telephone = $4, adresse_postale = $5, code_postal = $6, ville = $7
         WHERE utilisateur_id = $8`,
        [valeurs.nom, valeurs.prenom, valeurs.email, valeurs.telephone, valeurs.adresse_postale, valeurs.code_postal, valeurs.ville, req.session.utilisateur.id]
      );
      Object.assign(req.session.utilisateur, { nom: valeurs.nom, prenom: valeurs.prenom, email: valeurs.email });
      req.session.message = 'Vos informations ont été mises à jour.';
      return res.redirect('/compte');
    } catch (erreur) {
      if (erreur.code !== '23505') throw erreur;
      erreurs.push('Cette adresse e-mail est déjà utilisée par un autre compte.');
    }
  }
  const commandes = await db.query(
    'SELECT c.*, m.titre AS menu_titre FROM commande c JOIN menu m ON m.menu_id = c.menu_id WHERE c.utilisateur_id = $1 ORDER BY c.date_commande DESC',
    [req.session.utilisateur.id]
  );
  res.status(400).render('compte/index', { titre: 'Mon espace', profil: { ...valeurs }, commandes: commandes.rows, erreurs });
});

// Détail d'une commande du client connecté (avec suivi et avis)
router.get('/compte/commandes/:id', exigerConnexion, async (req, res) => {
  const commande = await cmd.chargerCommande(Number(req.params.id) || 0, req.session.utilisateur.id);
  if (!commande) return res.status(404).render('erreur', { titre: 'Commande introuvable', message: "Cette commande n'existe pas." });
  const [suivi, avis] = await Promise.all([
    db.query('SELECT * FROM suivi_commande WHERE commande_id = $1 ORDER BY date_modification, suivi_id', [commande.commande_id]),
    db.query('SELECT * FROM avis WHERE commande_id = $1', [commande.commande_id]),
  ]);
  res.render('compte/commande', { titre: 'Commande ' + commande.numero_commande, commande, suivi: suivi.rows, avis: avis.rows[0] });
});

// Annulation par le client : uniquement tant que la commande n'est pas acceptée
router.post('/compte/commandes/:id/annuler', exigerConnexion, async (req, res) => {
  const commande = await cmd.chargerCommande(Number(req.params.id) || 0, req.session.utilisateur.id);
  if (!commande || commande.statut !== 'en_attente') {
    req.session.message = 'Cette commande ne peut plus être annulée. Contactez-nous.';
  } else {
    await cmd.changerStatut(commande.commande_id, 'annulee', { motif_annulation: 'Annulée par le client' });
    req.session.message = 'Votre commande a été annulée.';
  }
  res.redirect('/compte/commandes/' + req.params.id);
});

// Modification par le client : uniquement "en attente", tout sauf le menu
router.get('/compte/commandes/:id/modifier', exigerConnexion, async (req, res) => {
  const commande = await cmd.chargerCommande(Number(req.params.id) || 0, req.session.utilisateur.id);
  if (!commande || commande.statut !== 'en_attente') return res.redirect('/compte');
  const menu = await chargerMenu(commande.menu_id);
  res.render('commande', {
    titre: 'Modifier ma commande', menus: [menu], menuChoisi: menu,
    profil: await chargerProfil(req.session.utilisateur.id), valeurs: commande, erreurs: [], modification: commande,
  });
});

router.post('/compte/commandes/:id/modifier', exigerConnexion, async (req, res) => {
  const commande = await cmd.chargerCommande(Number(req.params.id) || 0, req.session.utilisateur.id);
  if (!commande || commande.statut !== 'en_attente') return res.redirect('/compte');
  const menu = await chargerMenu(commande.menu_id); // le menu ne peut pas changer
  const resultat = await cmd.preparerCommande(req.body, menu);
  if (resultat.erreurs.length) {
    return res.status(400).render('commande', {
      titre: 'Modifier ma commande', menus: [menu], menuChoisi: menu,
      profil: await chargerProfil(req.session.utilisateur.id), valeurs: req.body, erreurs: resultat.erreurs, modification: commande,
    });
  }
  await cmd.modifierCommande(commande.commande_id, resultat.donnees, resultat.prix);
  req.session.message = 'Votre commande a été modifiée.';
  res.redirect('/compte/commandes/' + commande.commande_id);
});

// Avis : possible une seule fois, quand la commande est terminée
router.post('/compte/commandes/:id/avis', exigerConnexion, async (req, res) => {
  const commande = await cmd.chargerCommande(Number(req.params.id) || 0, req.session.utilisateur.id);
  const note = Number(req.body.note);
  const description = v.texte(req.body.description, 500);
  if (!commande || commande.statut !== 'terminee') {
    req.session.message = 'Vous pourrez donner votre avis une fois la commande terminée.';
  } else if (!Number.isInteger(note) || note < 1 || note > 5 || !description) {
    req.session.message = 'Merci de choisir une note entre 1 et 5 et d\'écrire un commentaire.';
  } else {
    // ON CONFLICT : si un avis existe déjà pour cette commande, on n'en crée pas un second
    await db.query(
      `INSERT INTO avis (commande_id, utilisateur_id, note, description) VALUES ($1, $2, $3, $4)
       ON CONFLICT (commande_id) DO NOTHING`,
      [commande.commande_id, req.session.utilisateur.id, note, description]
    );
    req.session.message = 'Merci pour votre avis ! Il sera publié après validation par notre équipe.';
  }
  res.redirect('/compte/commandes/' + req.params.id);
});

module.exports = router;
