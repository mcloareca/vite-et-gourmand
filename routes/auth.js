// Inscription, connexion, déconnexion et réinitialisation du mot de passe.
const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const db = require('../config/db');
const { envoyerMail } = require('../config/mail');
const v = require('../services/validation');

const router = express.Router();

// Contre les attaques par force brute : 10 tentatives ÉCHOUÉES par quart d'heure et par adresse IP
// (une connexion réussie n'est pas comptée)
const limiteTentatives = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  handler: (req, res) =>
    res.status(429).render('erreur', { titre: 'Trop de tentatives', message: 'Trop de tentatives. Réessayez dans 15 minutes.' }),
});

// Empreinte SHA-256 : on stocke l'empreinte du jeton de réinitialisation, pas le jeton lui-même
const empreinte = (jeton) => crypto.createHash('sha256').update(jeton).digest('hex');

// Récupère les champs du formulaire de profil, nettoyés
function lireProfil(body) {
  return {
    nom: v.texte(body.nom, 50),
    prenom: v.texte(body.prenom, 50),
    email: v.texte(body.email).toLowerCase(),
    telephone: v.texte(body.telephone, 20),
    adresse_postale: v.texte(body.adresse_postale),
    code_postal: v.texte(body.code_postal, 10),
    ville: v.texte(body.ville, 100),
  };
}

// ---------- Inscription ----------
router.get('/inscription', (req, res) => {
  res.render('inscription', { titre: 'Créer un compte', erreurs: [], valeurs: {} });
});

router.post('/inscription', limiteTentatives, async (req, res) => {
  const valeurs = lireProfil(req.body);
  const erreurs = v.verifierProfil(valeurs);
  if (!v.estMotDePasseFort(req.body.password)) {
    erreurs.push('Le mot de passe doit contenir au moins 10 caractères, dont une majuscule, une minuscule, un chiffre et un caractère spécial.');
  }
  if (req.body.password !== req.body.confirmation) erreurs.push('Les deux mots de passe ne correspondent pas.');
  if (!req.body.rgpd) erreurs.push('Vous devez accepter la politique de confidentialité.');
  if (erreurs.length) return res.status(400).render('inscription', { titre: 'Créer un compte', erreurs, valeurs });

  const hash = await bcrypt.hash(req.body.password, 10);
  try {
    await db.query(
      `INSERT INTO utilisateur (email, password, nom, prenom, telephone, adresse_postale, code_postal, ville, role_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1)`, // 1 = rôle "utilisateur"
      [valeurs.email, hash, valeurs.nom, valeurs.prenom, valeurs.telephone, valeurs.adresse_postale, valeurs.code_postal, valeurs.ville]
    );
  } catch (erreur) {
    if (erreur.code === '23505') {
      // 23505 = violation de contrainte UNIQUE : l'e-mail existe déjà
      return res.status(400).render('inscription', { titre: 'Créer un compte', erreurs: ['Un compte existe déjà avec cet e-mail.'], valeurs });
    }
    throw erreur;
  }

  await envoyerMail(
    valeurs.email,
    'Bienvenue chez Vite & Gourmand',
    `Bonjour ${valeurs.prenom},\n\nVotre compte a bien été créé. Vous pouvez dès maintenant commander nos menus.\n\nÀ bientôt,\nJulie et José`
  );
  req.session.message = 'Votre compte a été créé. Vous pouvez vous connecter.';
  res.redirect('/connexion');
});

// ---------- Connexion ----------
router.get('/connexion', (req, res) => {
  res.render('connexion', { titre: 'Connexion', erreur: null, email: '' });
});

router.post('/connexion', limiteTentatives, async (req, res, next) => {
  const email = v.texte(req.body.email).toLowerCase();
  const resultat = await db.query(
    `SELECT u.*, r.libelle AS role FROM utilisateur u JOIN role r ON r.role_id = u.role_id WHERE u.email = $1`,
    [email]
  );
  const compte = resultat.rows[0];
  const motDePasseCorrect = compte && (await bcrypt.compare(req.body.password || '', compte.password));

  // Même message dans tous les cas : on ne révèle pas si l'e-mail existe
  if (!motDePasseCorrect || !compte.actif) {
    return res.status(401).render('connexion', { titre: 'Connexion', erreur: 'E-mail ou mot de passe incorrect.', email });
  }

  const retour = req.session.retourApresConnexion;
  // Nouvelle session après connexion : empêche la "fixation de session"
  req.session.regenerate((erreur) => {
    if (erreur) return next(erreur);
    req.session.utilisateur = { id: compte.utilisateur_id, prenom: compte.prenom, nom: compte.nom, email: compte.email, role: compte.role };
    const espaces = { utilisateur: '/compte', employe: '/employe', administrateur: '/admin' };
    res.redirect(retour || espaces[compte.role]);
  });
});

router.post('/deconnexion', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('vg.sid');
    res.redirect('/');
  });
});

// ---------- Mot de passe oublié ----------
router.get('/mot-de-passe-oublie', (req, res) => {
  res.render('mot-de-passe-oublie', { titre: 'Mot de passe oublié' });
});

router.post('/mot-de-passe-oublie', limiteTentatives, async (req, res) => {
  const email = v.texte(req.body.email).toLowerCase();
  const jeton = crypto.randomBytes(32).toString('hex');
  const resultat = await db.query(
    `UPDATE utilisateur SET reset_token_hash = $1, reset_expire = NOW() + INTERVAL '1 hour'
     WHERE email = $2 AND actif = TRUE RETURNING prenom`,
    [empreinte(jeton), email]
  );
  if (resultat.rows.length) {
    const lien = `${process.env.APP_URL || 'http://localhost:3000'}/reinitialiser/${jeton}`;
    await envoyerMail(email, 'Réinitialisation de votre mot de passe',
      `Bonjour ${resultat.rows[0].prenom},\n\nPour choisir un nouveau mot de passe, cliquez sur ce lien (valable 1 heure) :\n${lien}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message.`);
  }
  // Message identique que le compte existe ou non
  req.session.message = 'Si un compte existe avec cet e-mail, un lien de réinitialisation vient de vous être envoyé.';
  res.redirect('/connexion');
});

router.get('/reinitialiser/:jeton', (req, res) => {
  res.render('reinitialiser', { titre: 'Nouveau mot de passe', jeton: req.params.jeton, erreur: null });
});

router.post('/reinitialiser/:jeton', limiteTentatives, async (req, res) => {
  const jeton = req.params.jeton;
  const afficherErreur = (erreur) => res.status(400).render('reinitialiser', { titre: 'Nouveau mot de passe', jeton, erreur });

  if (!v.estMotDePasseFort(req.body.password)) {
    return afficherErreur('Le mot de passe doit contenir au moins 10 caractères, dont une majuscule, une minuscule, un chiffre et un caractère spécial.');
  }
  if (req.body.password !== req.body.confirmation) return afficherErreur('Les deux mots de passe ne correspondent pas.');

  const hash = await bcrypt.hash(req.body.password, 10);
  const resultat = await db.query(
    `UPDATE utilisateur SET password = $1, reset_token_hash = NULL, reset_expire = NULL
     WHERE reset_token_hash = $2 AND reset_expire > NOW() RETURNING utilisateur_id`,
    [hash, empreinte(jeton)]
  );
  if (!resultat.rows.length) return afficherErreur('Ce lien est invalide ou a expiré. Refaites une demande.');

  req.session.message = 'Votre mot de passe a été modifié. Vous pouvez vous connecter.';
  res.redirect('/connexion');
});

module.exports = router;
