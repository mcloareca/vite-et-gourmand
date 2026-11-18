// Espace administrateur (/admin) : comptes employés et statistiques MongoDB.
// L'administrateur a aussi accès à tout l'espace employé (/employe).
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { envoyerMail } = require('../config/mail');
const { statistiquesParMenu } = require('../config/mongo');
const { exigerRole } = require('../middlewares/securite');
const v = require('../services/validation');

const router = express.Router();
router.use(exigerRole('administrateur'));

router.get('/', (req, res) => res.redirect('/admin/employes'));

// ---------- Comptes employés ----------
router.get('/employes', async (req, res) => {
  const employes = await db.query('SELECT utilisateur_id, email, nom, prenom, actif FROM utilisateur WHERE role_id = 2 ORDER BY nom');
  res.render('admin/employes', { titre: 'Comptes employés', employes: employes.rows });
});

router.post('/employes', async (req, res) => {
  const email = v.texte(req.body.email).toLowerCase();
  const nom = v.texte(req.body.nom, 50);
  const prenom = v.texte(req.body.prenom, 50);
  const retour = (message) => { req.session.message = message; res.redirect('/admin/employes'); };

  if (!v.estEmailValide(email) || !nom || !prenom) return retour('E-mail, nom et prénom sont obligatoires.');
  if (!v.estMotDePasseFort(req.body.password)) {
    return retour('Le mot de passe doit contenir au moins 10 caractères, dont une majuscule, une minuscule, un chiffre et un caractère spécial.');
  }
  try {
    // role_id 2 = employé. Le rôle est fixé ici : impossible de créer un administrateur depuis l'application.
    await db.query('INSERT INTO utilisateur (email, password, nom, prenom, role_id) VALUES ($1, $2, $3, $4, 2)',
      [email, await bcrypt.hash(req.body.password, 10), nom, prenom]);
  } catch (erreur) {
    if (erreur.code === '23505') return retour('Un compte existe déjà avec cet e-mail.');
    throw erreur;
  }
  // Le mot de passe n'est PAS envoyé par mail
  await envoyerMail(email, 'Votre compte employé Vite & Gourmand',
    `Bonjour ${prenom},\n\nUn compte employé a été créé pour vous. Votre identifiant est : ${email}\n` +
    `Pour obtenir votre mot de passe, rapprochez-vous de l'administrateur.\n\nJosé`);
  retour('Le compte employé a été créé.');
});

// Activer / désactiver un compte employé (départ de l'entreprise)
router.post('/employes/:id/actif', async (req, res) => {
  const id = Number(req.params.id) || 0;
  const actif = req.body.actif === 'true';
  await db.query('UPDATE utilisateur SET actif = $1 WHERE utilisateur_id = $2 AND role_id = 2', [actif, id]);
  if (!actif) {
    // Déconnexion immédiate : on supprime les sessions en cours de cet employé
    await db.query("DELETE FROM session WHERE (sess -> 'utilisateur' ->> 'id')::int = $1", [id]);
  }
  req.session.message = actif ? 'Le compte a été réactivé.' : 'Le compte a été désactivé.';
  res.redirect('/admin/employes');
});

// ---------- Statistiques (données lues dans MongoDB) ----------
router.get('/statistiques', async (req, res) => {
  const filtres = {
    menu: v.entier(req.query.menu) || null,
    debut: /^\d{4}-\d{2}-\d{2}$/.test(req.query.debut) ? req.query.debut : '',
    fin: /^\d{4}-\d{2}-\d{2}$/.test(req.query.fin) ? req.query.fin : '',
  };
  const stats = await statistiquesParMenu({
    menuId: filtres.menu,
    debut: filtres.debut ? new Date(filtres.debut + 'T00:00:00') : null,
    fin: filtres.fin ? new Date(filtres.fin + 'T23:59:59') : null,
  });
  const menus = await db.query('SELECT menu_id, titre FROM menu ORDER BY titre');
  res.render('admin/statistiques', { titre: 'Statistiques', stats, menus: menus.rows, filtres });
});

module.exports = router;
