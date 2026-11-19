// Tests de bout en bout : on simule de vrais visiteurs qui naviguent sur le site
// (requêtes HTTP, cookies de session, jetons CSRF) et on vérifie les réponses.
//
// Usage : npm run test:e2e
//
// Le script :
//   1. lit la configuration de test dans .env.test (jamais .env) ;
//   2. vérifie qu'il ne vise PAS la base de production (sinon il s'arrête) ;
//   3. remet la base de test dans l'état des données de démonstration (init-db) ;
//   4. démarre l'application en local, lance les vérifications, puis l'arrête.
//
// Aucun mot de passe n'est écrit ici : ceux des comptes de démonstration sont lus
// dans .env.test, ceux des comptes créés pendant le test sont tirés au hasard.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn, execFileSync } = require('child_process');

const RACINE = path.join(__dirname, '..');
const FICHIER_TEST = path.join(RACINE, '.env.test');
const FICHIER_PROD = path.join(RACINE, '.env');

// ---------------------------------------------------------------------------
// 1. Configuration et garde-fous
// ---------------------------------------------------------------------------
function arreter(message) {
  console.error('\nTests annulés : ' + message + '\n');
  process.exit(1);
}

// Lit un fichier .env sans modifier process.env (pour comparer avec la production)
function lireEnv(fichier) {
  if (!fs.existsSync(fichier)) return {};
  return Object.fromEntries(
    fs.readFileSync(fichier, 'utf8').split('\n')
      .map((ligne) => ligne.match(/^([A-Z0-9_]+)=(.*)$/))
      .filter(Boolean)
      .map(([, cle, valeur]) => [cle, valeur.trim().replace(/^"(.*)"$/, '$1')])
  );
}

if (!fs.existsSync(FICHIER_TEST)) {
  arreter('fichier .env.test introuvable. Copiez .env.test.example en .env.test et remplissez-le (voir README).');
}
const test = lireEnv(FICHIER_TEST);
const prod = lireEnv(FICHIER_PROD);

if (!test.DATABASE_URL) arreter('DATABASE_URL est vide dans .env.test.');
if (test.DATABASE_URL === prod.DATABASE_URL) {
  arreter('.env.test utilise la même base PostgreSQL que .env (production). Utilisez une base de test séparée.');
}
if (test.MONGODB_URI && test.MONGODB_URI === prod.MONGODB_URI) {
  arreter('.env.test utilise le même MongoDB que .env (production). Laissez MONGODB_URI vide dans .env.test.');
}
if (test.NODE_ENV === 'production') arreter('NODE_ENV=production est interdit dans .env.test.');
for (const cle of ['E2E_MDP_ADMIN', 'E2E_MDP_EMPLOYE', 'E2E_MDP_CLIENT']) {
  if (!test[cle]) arreter(`${cle} est vide dans .env.test (mot de passe du compte de démonstration, voir le manuel).`);
}

const PORT = test.PORT || '3001';
const BASE = `http://localhost:${PORT}`; // toujours en local : jamais le site en ligne

// Variables transmises à init-db et à l'application : UNIQUEMENT celles de .env.test.
// (On ne laisse passer aucune variable du terminal, qui pourrait pointer vers la production.)
const ENV_TEST = { PATH: process.env.PATH, ...test, PORT, NODE_ENV: test.NODE_ENV || 'test' };

// ---------------------------------------------------------------------------
// 2. Petits outils
// ---------------------------------------------------------------------------
let echecs = 0;
function ok(condition, libelle) {
  console.log((condition ? '✔ ' : '✖ ') + libelle);
  if (!condition) echecs++;
}

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const dansNJours = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
// Mot de passe aléatoire qui respecte les règles de l'énoncé
const motDePasseAleatoire = () => 'Aa1#' + crypto.randomBytes(6).toString('hex');

// Un « navigateur » : garde son cookie de session entre les requêtes
function navigateur() {
  let cookie = '';
  async function req(chemin, options = {}) {
    const r = await fetch(BASE + chemin, { redirect: 'manual', ...options, headers: { ...(options.headers || {}), cookie } });
    const setCookie = r.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    return { status: r.status, location: r.headers.get('location'), texte: await r.text() };
  }
  // Récupère le jeton CSRF d'une page (champ caché _csrf)
  async function csrf(chemin) {
    const r = await req(chemin);
    const m = r.texte.match(/name="_csrf" value="([a-f0-9]+)"/);
    return m && m[1];
  }
  // Envoie un formulaire comme un vrai navigateur : on ouvre d'abord la page pour avoir le jeton
  async function post(chemin, champs, pageDuFormulaire) {
    const jeton = await csrf(pageDuFormulaire || chemin);
    const corps = new URLSearchParams({ _csrf: jeton });
    for (const [cle, valeur] of Object.entries(champs)) [].concat(valeur).forEach((v) => corps.append(cle, v));
    return req(chemin, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: corps.toString() });
  }
  return { req, csrf, post };
}

const compter = (texte, motif) => (texte.match(motif) || []).length;

// ---------------------------------------------------------------------------
// 3. Les vérifications
// ---------------------------------------------------------------------------
async function verifications(journalServeur) {
  // --- Visiteur ---
  const visiteur = navigateur();
  let r = await visiteur.req('/');
  ok(r.status === 200 && r.texte.includes('chapon était délicieux'), 'accueil : avis validés affichés');
  ok(r.texte.includes('Dimanche') && r.texte.includes('Fermé'), 'pied de page : horaires');
  r = await visiteur.req('/menus');
  ok(compter(r.texte, /class="carte"/g) === 6, 'vue globale : 6 menus');
  r = await visiteur.req('/menus/filtrer?prix_max=100');
  ok(compter(r.texte, /class="carte"/g) === 2 && !r.texte.includes('<html'), 'filtre prix max 100 € → 2 menus (fragment HTML seul)');
  r = await visiteur.req('/menus/filtrer?prix_min=100&prix_max=200');
  ok(compter(r.texte, /class="carte"/g) === 2, 'fourchette 100–200 € → 2 menus');
  r = await visiteur.req('/menus/filtrer?theme=1');
  ok(compter(r.texte, /class="carte"/g) === 1, 'filtre thème Noël → 1 menu');
  r = await visiteur.req('/menus/filtrer?regime=3');
  ok(compter(r.texte, /class="carte"/g) === 1, 'filtre régime vegan → 1 menu');
  r = await visiteur.req('/menus/filtrer?personnes=4');
  ok(compter(r.texte, /class="carte"/g) === 4, 'filtre 4 convives → 4 menus');
  r = await visiteur.req('/menus/filtrer?theme=1%20OR%201=1');
  ok(r.status === 200, 'filtre avec une valeur malveillante (injection SQL) : pas d\'erreur');
  r = await visiteur.req('/menus/1');
  ok(r.texte.includes('Conditions de ce menu') && r.texte.includes('Allergènes : Gluten, Sulfites'), 'détail d\'un menu : conditions et allergènes');
  r = await visiteur.req('/commande?menu=1');
  ok(r.status === 302 && r.location === '/connexion', 'commander sans être connecté → page de connexion');
  r = await visiteur.req('/employe');
  ok(r.status === 302, 'espace employé sans connexion → redirection');

  // --- Contact ---
  r = await visiteur.post('/contact', { titre: 'Question', description: 'Livrez-vous à Arcachon ?', email: 'pas-un-mail' });
  ok(r.status === 400, 'contact : e-mail invalide refusé');
  r = await visiteur.post('/contact', { titre: 'Question', description: 'Livrez-vous à Arcachon ?', email: 'visiteur@exemple.fr' });
  ok(r.status === 302, 'contact : message envoyé');

  // --- Inscription et connexion ---
  const client = navigateur();
  const email = `test${Date.now()}@exemple.fr`;
  const mdpClient = motDePasseAleatoire();
  const profil = { nom: 'Test', prenom: 'Alex', email, telephone: '0611223344', adresse_postale: '1 rue Test', code_postal: '33000', ville: 'Bordeaux', rgpd: '1' };
  r = await client.post('/inscription', { ...profil, password: 'faible', confirmation: 'faible' });
  ok(r.status === 400 && r.texte.includes('au moins 10 caractères'), 'inscription : mot de passe faible refusé');
  r = await client.post('/inscription', { ...profil, password: mdpClient, confirmation: mdpClient });
  ok(r.status === 302 && r.location === '/connexion', 'inscription réussie');
  r = await client.post('/inscription', { ...profil, password: mdpClient, confirmation: mdpClient });
  ok(r.status === 400 && r.texte.includes('existe déjà'), 'inscription : e-mail déjà utilisé refusé');

  r = await client.post('/connexion', { email, password: 'mauvais' });
  ok(r.status === 401, 'connexion : mauvais mot de passe refusé');
  await client.req('/commande?menu=2'); // l'application mémorise la page demandée
  r = await client.post('/connexion', { email, password: mdpClient });
  ok(r.status === 302 && r.location === '/commande?menu=2', 'connexion → retour automatique vers la commande');

  // --- Protection CSRF ---
  r = await client.req('/commande', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'menu_id=2' });
  ok(r.status === 403, 'formulaire envoyé sans jeton CSRF refusé');

  // --- Commande ---
  r = await client.req('/commande?menu=2');
  ok(r.texte.includes('value="Alex"') && r.texte.includes('value="0611223344"'), 'commande : informations du client pré-remplies');
  ok(r.texte.includes('<option value="2" data-min="4"') && /value="2"[^>]*selected/.test(r.texte), 'commande : menu pré-sélectionné');

  // Estimation du prix : Mérignac (environ 7 km), 9 personnes (au moins 4 + 5 → réduction de 10 %)
  const jeton = await client.csrf('/commande?menu=2');
  const champs = { menu_id: '2', date_prestation: dansNJours(20), heure_livraison: '12:00', adresse_livraison: '60 avenue du Maréchal de Lattre de Tassigny', code_postal: '33700', ville_livraison: 'Mérignac', nombre_personne: '9' };
  const estimer = (donnees) => client.req('/commande/estimation', { method: 'POST', headers: { 'content-type': 'application/json', 'x-csrf-token': jeton }, body: JSON.stringify(donnees) });
  r = await estimer(champs);
  const prix = r.status === 200 ? JSON.parse(r.texte).prix : {};
  ok(prix.prixMenu === 360 && prix.reduction === 36 && prix.distanceKm === 7 && prix.prixLivraison === 9.13 && prix.prixTotal === 333.13,
    `estimation Mérignac, 9 personnes : ${JSON.stringify(prix)}`);
  r = await estimer({ ...champs, nombre_personne: '3' });
  ok(r.status === 400, 'estimation sous le minimum de personnes refusée');
  r = await estimer({ ...champs, distance_km: '0', adresse_livraison: 'zzzz qqqq', ville_livraison: 'xxxx', code_postal: '00000' });
  ok(r.status === 400 && r.texte.includes('introuvable'), 'adresse introuvable refusée (distance envoyée par le client ignorée)');

  r = await client.post('/commande', { ...champs }, '/commande?menu=2');
  ok(r.status === 400 && r.texte.includes('conditions générales'), 'commande sans acceptation des CGV refusée');
  r = await client.post('/commande', { ...champs, distance_km: '0', prix_total: '1', cgv: '1' }, '/commande?menu=2');
  ok(r.status === 302 && /^\/compte\/commandes\/\d+$/.test(r.location || ''), 'commande créée');
  const urlCommande = r.location;
  const idCommande = urlCommande.split('/').pop();
  r = await client.req(urlCommande);
  ok(r.texte.includes('333,13') && r.texte.includes('En attente de validation'), 'prix recalculé par le serveur : 333,13 € (prix envoyé par le client ignoré)');
  r = await visiteur.req('/menus/2');
  ok(r.texte.includes('Encore 9 commandes'), 'stock du menu diminué (10 → 9)');

  // Modification par le client (le menu ne doit pas changer)
  await client.post(urlCommande + '/modifier', { ...champs, menu_id: '1', nombre_personne: '4', adresse_livraison: '5 rue Sainte-Catherine', code_postal: '33000', ville_livraison: 'Bordeaux' }, urlCommande + '/modifier');
  r = await client.req(urlCommande);
  ok(r.texte.includes('Menu de Pâques – 4 personnes') && r.texte.includes('160,00'), 'modification : 4 personnes à Bordeaux = 160 €, menu inchangé');

  // --- Contrôles d'accès ---
  const autreClient = navigateur();
  await autreClient.post('/connexion', { email: 'client@exemple.fr', password: test.E2E_MDP_CLIENT });
  r = await autreClient.req(urlCommande);
  ok(r.status === 404, 'un autre client ne peut pas voir cette commande (404)');
  r = await autreClient.req('/employe');
  ok(r.status === 403, 'un utilisateur n\'accède pas à l\'espace employé (403)');

  // --- Employé ---
  const employe = navigateur();
  r = await employe.post('/connexion', { email: 'julie@vite-gourmand.fr', password: test.E2E_MDP_EMPLOYE });
  ok(r.location === '/employe', 'connexion employée');
  r = await employe.req('/admin/employes');
  ok(r.status === 403, 'un employé n\'accède pas à l\'administration (403)');
  r = await employe.req('/employe?statut=en_attente');
  ok(r.texte.includes('VG-DEMO-0004') && !r.texte.includes('VG-DEMO-0001'), 'filtre des commandes par statut');
  r = await employe.req('/employe?client=' + encodeURIComponent(email));
  ok(compter(r.texte, /Gérer/g) === 1, 'filtre des commandes par client');

  const urlEmploye = '/employe/commandes/' + idCommande;
  await employe.post(urlEmploye + '/statut', { statut: 'accepte' }, urlEmploye);
  r = await client.req(urlCommande);
  ok(r.texte.includes('Suivi de la commande') && r.texte.includes('Acceptée') && !r.texte.includes('Annuler la commande'), 'client : suivi visible, bouton d\'annulation retiré après acceptation');
  await client.post(urlCommande + '/annuler', {}, urlCommande);
  r = await client.req(urlCommande);
  ok(!r.texte.includes('statut-annulee'), 'client : annulation refusée par le serveur après acceptation');

  await employe.post(urlEmploye + '/annuler', { mode_contact: 'gsm', motif: '' }, urlEmploye);
  r = await employe.req(urlEmploye);
  ok(!r.texte.includes('statut-annulee'), 'employé : annulation sans motif refusée');
  await employe.post(urlEmploye + '/statut', { statut: 'attente_materiel' }, urlEmploye);
  await employe.post(urlEmploye + '/statut', { statut: 'terminee' }, urlEmploye);
  r = await employe.req(urlEmploye);
  ok(r.texte.includes('Restitué') && r.texte.includes('statut-terminee'), 'matériel prêté puis restitué, commande terminée');

  // --- Avis ---
  await client.post(urlCommande + '/avis', { note: '7', description: 'x' }, urlCommande);
  await client.post(urlCommande + '/avis', { note: '5', description: 'Excellent repas de test' }, urlCommande);
  await client.post(urlCommande + '/avis', { note: '1', description: 'Doublon' }, urlCommande);
  r = await client.req(urlCommande);
  ok(r.texte.includes('5/5') && r.texte.includes('en attente de validation'), 'avis enregistré (note 7 refusée, second avis ignoré)');
  r = await employe.req('/employe/avis');
  const blocAvis = r.texte.split('<li class="bloc">').find((bloc) => bloc.includes('Excellent repas de test')) || '';
  const idAvis = (blocAvis.match(/avis\/(\d+)/) || [])[1];
  await employe.post('/employe/avis/' + idAvis, { statut: 'valide' }, '/employe/avis');
  r = await visiteur.req('/');
  ok(r.texte.includes('Excellent repas de test'), 'avis validé par l\'employé visible sur l\'accueil');

  // Annulation par l'employé d'une commande de démonstration : motif obligatoire, stock rendu
  await employe.post('/employe/commandes/4/annuler', { mode_contact: 'mail', motif: 'Client indisponible à cette date' }, '/employe/commandes/4');
  r = await employe.req('/employe/commandes/4');
  ok(r.texte.includes('Client indisponible') && r.texte.includes('contacté par e-mail'), 'employé : annulation avec motif et mode de contact');
  r = await visiteur.req('/menus/4');
  ok(r.texte.includes('Encore 13 commandes'), 'annulation : stock rendu (12 → 13)');

  // --- Menus, plats, horaires ---
  r = await employe.post('/employe/menus', { titre: 'Menu test', description: 'Description', theme_id: '3', regime_id: '1', nombre_personne_minimum: '3', prix_minimum: '99.90', conditions: 'Aucune', quantite_restante: '4', plats: ['2', '7'], images: ['classique-1.svg', '../../app.js'] }, '/employe/menus/nouveau');
  ok(r.location === '/employe/menus', 'employé : création d\'un menu');
  r = await visiteur.req('/menus');
  const idMenu = (r.texte.match(/href="\/menus\/(\d+)">Voir le détail<span class="visually-hidden"> du Menu test/) || [])[1];
  r = await visiteur.req('/menus/' + idMenu);
  ok(r.texte.includes('Velouté de potimarron') && r.texte.includes('classique-1.svg') && !r.texte.includes('app.js'), 'menu créé avec ses plats et son image (chemin malveillant ignoré)');
  await employe.post(`/employe/menus/${idMenu}/supprimer`, {}, '/employe/menus');
  r = await visiteur.req('/menus/' + idMenu);
  ok(r.status === 404, 'employé : suppression d\'un menu jamais commandé');
  await employe.post('/employe/menus/1/supprimer', {}, '/employe/menus');
  r = await visiteur.req('/menus/1');
  ok(r.status === 200, 'menu déjà commandé : suppression refusée (historique conservé)');
  await employe.post('/employe/plats', { titre_plat: 'Plat test', type: 'plat', allergenes: ['1', '2'] }, '/employe/plats');
  r = await employe.req('/employe/plats');
  ok(/Plat test[\s\S]{0,80}Gluten, Lait/.test(r.texte), 'employé : création d\'un plat avec ses allergènes');
  await employe.post('/employe/horaires', { ouverture_7: '10:00', fermeture_7: '13:00' }, '/employe/horaires');
  r = await visiteur.req('/');
  ok(r.texte.includes('10:00 – 13:00'), 'employé : horaires modifiés (dimanche ouvert)');

  // --- Administrateur ---
  const admin = navigateur();
  r = await admin.post('/connexion', { email: 'jose@vite-gourmand.fr', password: test.E2E_MDP_ADMIN });
  ok(r.location === '/admin', 'connexion administrateur');
  r = await admin.req('/employe');
  ok(r.status === 200, 'l\'administrateur accède aussi à l\'espace employé');
  const emailEmploye = `employe${Date.now()}@vite-gourmand.fr`;
  const mdpEmploye = motDePasseAleatoire();
  await admin.post('/admin/employes', { prenom: 'Léa', nom: 'Nouvelle', email: emailEmploye, password: 'faible' }, '/admin/employes');
  await admin.post('/admin/employes', { prenom: 'Léa', nom: 'Nouvelle', email: emailEmploye, password: mdpEmploye, role_id: '3' }, '/admin/employes');
  r = await admin.req('/admin/employes');
  ok(r.texte.includes(emailEmploye), 'administrateur : création d\'un compte employé');
  const nouvelEmploye = navigateur();
  r = await nouvelEmploye.post('/connexion', { email: emailEmploye, password: mdpEmploye });
  ok(r.location === '/employe', 'nouveau compte : rôle employé (rôle administrateur envoyé ignoré)');
  r = await admin.req('/admin/employes');
  const idEmploye = ((r.texte.split(emailEmploye)[1] || '').match(/employes\/(\d+)\/actif/) || [])[1];
  await admin.post(`/admin/employes/${idEmploye}/actif`, { actif: 'false' }, '/admin/employes');
  r = await nouvelEmploye.req('/employe');
  ok(r.status === 302, 'compte désactivé : session coupée immédiatement');
  r = await nouvelEmploye.post('/connexion', { email: emailEmploye, password: mdpEmploye });
  ok(r.status === 401, 'compte désactivé : connexion refusée');
  r = await admin.req('/admin/statistiques');
  ok(r.status === 200, 'page statistiques accessible' + (r.texte.includes('MongoDB n\'est pas connecté') ? ' (sans MongoDB en test)' : ' (avec MongoDB)'));

  // --- Mot de passe oublié (le lien est lu dans le journal du serveur, car les mails n'y sont pas envoyés) ---
  const oubli = navigateur();
  r = await oubli.post('/mot-de-passe-oublie', { email: 'inconnu@exemple.fr' });
  ok(r.status === 302, 'mot de passe oublié : même réponse pour un e-mail inconnu');
  r = await oubli.post('/mot-de-passe-oublie', { email });
  await pause(300);
  const liens = [...journalServeur().matchAll(/\/reinitialiser\/[a-f0-9]+/g)];
  const lien = liens.length ? liens[liens.length - 1][0] : '/reinitialiser/absent';
  ok(liens.length === 1, 'un seul lien de réinitialisation envoyé (rien pour l\'e-mail inconnu)');
  r = await oubli.post(lien, { password: 'faible', confirmation: 'faible' }, lien);
  ok(r.status === 400, 'réinitialisation : mot de passe faible refusé');
  const nouveauMdp = motDePasseAleatoire();
  r = await oubli.post(lien, { password: nouveauMdp, confirmation: nouveauMdp }, lien);
  ok(r.status === 302 && r.location === '/connexion', 'réinitialisation : mot de passe changé');
  const autreMdp = motDePasseAleatoire();
  r = await oubli.post(lien, { password: autreMdp, confirmation: autreMdp }, lien);
  ok(r.status === 400, 'réinitialisation : lien utilisable une seule fois');
  r = await navigateur().post('/connexion', { email, password: nouveauMdp });
  ok(r.location === '/compte', 'connexion avec le nouveau mot de passe');

  // --- Déconnexion ---
  await client.post('/deconnexion', {}, '/compte');
  r = await client.req('/compte');
  ok(r.status === 302, 'déconnexion : espace client inaccessible');
}

// ---------------------------------------------------------------------------
// 4. Déroulement : base de test → serveur local → vérifications → arrêt
// ---------------------------------------------------------------------------
(async () => {
  // Le port ne doit pas déjà être utilisé (sinon on testerait un autre serveur, peut-être relié à la production)
  const dejaOccupe = await fetch(BASE).then(() => true, () => false);
  if (dejaOccupe) arreter(`le port ${PORT} est déjà utilisé. Arrêtez l'application qui tourne dessus, puis relancez.`);

  console.log('Remise à zéro de la base de TEST (données de démonstration)…');
  execFileSync(process.execPath, ['--no-warnings', 'scripts/init-db.js'], { cwd: RACINE, env: ENV_TEST, stdio: 'inherit' });

  console.log(`Démarrage de l'application de test sur ${BASE}…\n`);
  const serveur = spawn(process.execPath, ['--no-warnings', 'app.js'], { cwd: RACINE, env: ENV_TEST });
  let journal = '';
  serveur.stdout.on('data', (d) => { journal += d; });
  serveur.stderr.on('data', (d) => { journal += d; });

  try {
    let pret = false;
    for (let i = 0; i < 60 && !pret; i++) {
      await pause(500);
      pret = await fetch(BASE).then((r) => r.ok, () => false);
    }
    if (!pret) throw new Error('l\'application ne répond pas. Journal du serveur :\n' + journal);

    await verifications(() => journal);
  } catch (erreur) {
    console.error('\nERREUR pendant les tests :', erreur.message);
    echecs++;
  } finally {
    serveur.kill();
  }

  console.log(echecs ? `\n${echecs} vérification(s) en échec` : '\nToutes les vérifications passent');
  console.log('La base de test contient maintenant des données de test ; elle sera remise à zéro au prochain lancement.');
  process.exit(echecs ? 1 : 0);
})();
