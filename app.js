// =====================================================================
// Point d'entrée de l'application Vite & Gourmand
// Lancement : npm start (production) ou npm run dev (développement)
// =====================================================================
const path = require('path');
const express = require('express');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);

const db = require('./config/db');
const { connecterMongo } = require('./config/mongo');
const { protectionCsrf } = require('./middlewares/securite');

const app = express();
const enProduction = process.env.NODE_ENV === 'production';

if (enProduction && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET doit être défini en production.');
}

// --- Moteur de vues EJS : les pages HTML sont générées côté serveur
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// --- Fonctions de mise en forme utilisables dans toutes les vues
app.locals.STATUTS = require('./services/commandes').STATUTS;
app.locals.euros = (n) => Number(n).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
app.locals.dateFr = (d) => new Date(d).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' });
app.locals.dateHeureFr = (d) => new Date(d).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' });

// Sur Render, l'application est derrière un proxy HTTPS : nécessaire pour les cookies "secure"
if (enProduction) app.set('trust proxy', 1);

// --- En-têtes de sécurité HTTP
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff'); // le navigateur ne devine pas le type des fichiers
  res.set('X-Frame-Options', 'DENY'); // interdit d'afficher le site dans une iframe (clickjacking)
  res.set('Referrer-Policy', 'same-origin');
  // N'autorise que les scripts, styles et images servis par notre propre serveur (limite les failles XSS)
  res.set('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; object-src 'none'; frame-ancestors 'none'");
  next();
});

// --- Fichiers statiques (CSS, JS, images) et bibliothèque Chart.js
app.use(express.static(path.join(__dirname, 'public')));
app.use('/vendor', express.static(path.join(__dirname, 'node_modules/chart.js/dist')));

// --- Lecture des formulaires (urlencoded) et des requêtes fetch (JSON)
app.use(express.urlencoded({ extended: false, limit: '100kb' }));
app.use(express.json({ limit: '100kb' }));

// --- Sessions stockées dans PostgreSQL (table "session") : elles survivent aux redémarrages
app.use(
  session({
    store: new PgSession({ pool: db.pool, tableName: 'session' }),
    secret: process.env.SESSION_SECRET || 'secret-de-developpement-uniquement',
    resave: false,
    saveUninitialized: false,
    name: 'vg.sid',
    cookie: {
      httpOnly: true, // inaccessible au JavaScript du navigateur
      sameSite: 'lax', // non envoyé par les formulaires d'autres sites
      secure: enProduction, // HTTPS uniquement en production
      maxAge: 2 * 60 * 60 * 1000, // 2 heures
    },
  })
);

// --- Variables disponibles dans toutes les vues : utilisateur connecté, message, horaires
app.use(async (req, res, next) => {
  res.locals.utilisateur = req.session.utilisateur || null;
  res.locals.message = req.session.message || null;
  delete req.session.message;
  res.locals.cheminActuel = req.path;
  try {
    const resultat = await db.query('SELECT * FROM horaire ORDER BY ordre');
    res.locals.horaires = resultat.rows;
  } catch {
    res.locals.horaires = [];
  }
  next();
});

// --- Protection CSRF de tous les formulaires (après les variables, pour pouvoir afficher la page d'erreur)
app.use(protectionCsrf);

// --- Routes
app.use('/', require('./routes/public'));
app.use('/', require('./routes/auth'));
app.use('/', require('./routes/commandes'));
app.use('/employe', require('./routes/employe'));
app.use('/admin', require('./routes/admin'));

// --- Page 404
app.use((req, res) => {
  res.status(404).render('erreur', { titre: 'Page introuvable', message: "Cette page n'existe pas." });
});

// --- Erreurs inattendues : on n'affiche jamais le détail technique à l'utilisateur
app.use((erreur, req, res, next) => {
  console.error(erreur);
  res.status(500).render('erreur', { titre: 'Erreur', message: 'Une erreur est survenue. Merci de réessayer plus tard.' });
});

const port = process.env.PORT || 3000;
connecterMongo()
  .catch((erreur) => console.error('Connexion MongoDB impossible :', erreur.message))
  .finally(() => app.listen(port, () => console.log(`Vite & Gourmand démarré sur http://localhost:${port}`)));
