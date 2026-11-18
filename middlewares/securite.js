// Middlewares de sécurité : contrôle d'accès et protection CSRF.
const crypto = require('crypto');

// Bloque l'accès aux pages réservées aux personnes connectées
function exigerConnexion(req, res, next) {
  if (!req.session.utilisateur) {
    req.session.retourApresConnexion = req.originalUrl; // pour revenir à la page après connexion
    return res.redirect('/connexion');
  }
  next();
}

// Bloque l'accès si le rôle de l'utilisateur ne fait pas partie de la liste.
// Exemple : exigerRole('employe', 'administrateur')
function exigerRole(...rolesAutorises) {
  return (req, res, next) => {
    const utilisateur = req.session.utilisateur;
    if (!utilisateur) return res.redirect('/connexion');
    if (!rolesAutorises.includes(utilisateur.role)) {
      return res.status(403).render('erreur', { titre: 'Accès refusé', message: "Vous n'avez pas accès à cette page." });
    }
    next();
  };
}

// Protection CSRF (Cross-Site Request Forgery) :
// chaque session reçoit un jeton secret, ajouté en champ caché "_csrf" dans tous les formulaires.
// Un site malveillant ne connaît pas ce jeton : ses requêtes POST sont refusées.
function protectionCsrf(req, res, next) {
  if (!req.session.csrf) req.session.csrf = crypto.randomBytes(24).toString('hex');
  res.locals.csrfToken = req.session.csrf;

  if (req.method === 'POST') {
    const jetonRecu = (req.body && req.body._csrf) || req.get('x-csrf-token');
    if (jetonRecu !== req.session.csrf) {
      return res.status(403).render('erreur', {
        titre: 'Formulaire expiré',
        message: 'Le formulaire a expiré. Rechargez la page et recommencez.',
      });
    }
  }
  next();
}

module.exports = { exigerConnexion, exigerRole, protectionCsrf };
