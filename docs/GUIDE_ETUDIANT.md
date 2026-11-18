# Guide étudiant : comprendre le code de Vite & Gourmand

Ce guide explique comment l'application fonctionne, dans l'ordre où une requête la traverse.
Il sert à réviser et à préparer les questions du jury.

## 1. À quoi sert chaque dossier

```
vite-et-gourmand/
├── app.js              Point d'entrée : configure Express et branche toutes les routes
├── config/             Connexions aux services extérieurs
│   ├── db.js           PostgreSQL (bibliothèque pg)
│   ├── mongo.js        MongoDB (statistiques)
│   └── mail.js         Envoi des e-mails (Nodemailer)
├── middlewares/
│   └── securite.js     Contrôle d'accès (connecté ? quel rôle ?) et protection CSRF
├── services/           Règles métier, sans lien avec HTTP
│   ├── prix.js         Calcul du prix d'une commande (testé)
│   ├── livraison.js    Distance de livraison calculée depuis l'adresse
│   ├── validation.js   Vérification des champs de formulaire
│   └── commandes.js    Création, modification, changement de statut d'une commande
├── routes/             Une route = une URL + ce que le serveur fait quand on l'appelle
│   ├── public.js       Accueil, menus, détail, contact, pages légales
│   ├── auth.js         Inscription, connexion, mot de passe oublié
│   ├── commandes.js    Commander un menu + espace utilisateur (/compte)
│   ├── employe.js      Espace employé (/employe)
│   └── admin.js        Espace administrateur (/admin)
├── views/              Modèles EJS = pages HTML avec des trous remplis par le serveur
│   └── partials/       Morceaux réutilisés (en-tête, pied de page, liste des menus...)
├── public/             Fichiers envoyés tels quels au navigateur
│   ├── css/style.css   Toute la mise en forme
│   ├── js/             3 petits scripts : filtres, prix en direct, graphique
│   └── images/menus/   Images des menus (fichiers du dépôt, pas d'upload)
├── database/           creation.sql (tables) et donnees.sql (données de démo)
├── scripts/            init-db.js (installe la base) et sync-stats.js (remplit MongoDB)
├── tests/              Tests automatiques (npm test)
└── docs/               Documentation
```

Il n'y a volontairement **pas** de dossiers « controllers », « models » ou « repositories » : chaque fichier de route contient
directement ses requêtes SQL. On lit une fonctionnalité de haut en bas dans un seul fichier.
Seule la logique utilisée à plusieurs endroits (prix, commandes, validation) est sortie dans `services/`.

## 2. Le point d'entrée : app.js

`npm start` lance `node app.js`. Ce fichier, lu de haut en bas :

1. configure EJS comme moteur de vues ;
2. ajoute des **middlewares**, des fonctions exécutées à chaque requête, dans l'ordre :
   en-têtes de sécurité → fichiers statiques → lecture des formulaires → session → variables communes aux vues → CSRF ;
3. branche les routes (`app.use('/employe', require('./routes/employe'))`) ;
4. définit la page 404 et la gestion des erreurs ;
5. se connecte à MongoDB puis démarre le serveur sur le port 3000 (ou `PORT`).

Un middleware a la forme `(req, res, next) => { ...; next(); }`. Appeler `next()` passe au suivant ;
répondre (`res.render`, `res.redirect`) arrête la chaîne.

## 3. Comment le navigateur communique avec le serveur

Le modèle est le plus classique du web : **le serveur fabrique les pages HTML**.

1. Le navigateur demande `GET /menus/2`.
2. Express trouve la route `router.get('/menus/:id', ...)` dans `routes/public.js`.
3. La route interroge PostgreSQL, puis appelle `res.render('menu-detail', { menu, plats })`.
4. EJS remplace les `<%= ... %>` du modèle par les données et renvoie du HTML complet.

Les formulaires sont de vrais formulaires HTML (`<form method="post">`) : ils fonctionnent même sans JavaScript.
Après un POST réussi, le serveur répond par une **redirection** (`res.redirect`) : recharger la page ne renvoie pas le formulaire.

JavaScript n'est utilisé que pour trois améliorations (dossier `public/js/`) :

| Script | Ce qu'il fait | Comment |
|---|---|---|
| `filtres.js` | Met à jour la liste des menus sans recharger (exigé par l'énoncé) | `fetch('/menus/filtrer?...')` renvoie un **fragment HTML**, produit par le même modèle EJS que la page, inséré avec `innerHTML` |
| `commande.js` | Affiche le détail du prix avant validation | `fetch('/commande/estimation')` en POST JSON ; le **serveur** calcule, le navigateur affiche |
| `statistiques.js` | Dessine le graphique de l'admin | Chart.js lit les données placées dans un attribut `data-stats` |

Choix important : le prix n'est **jamais** calculé dans le navigateur. Il n'existe qu'une seule fonction de calcul,
côté serveur, utilisée à la fois pour l'aperçu et pour la commande réelle. Le client ne peut donc pas tricher sur le prix.

## 4. Comment les routes sont organisées

| Fichier | Préfixe | Qui peut y accéder |
|---|---|---|
| `public.js` | `/`, `/menus`, `/contact`... | Tout le monde |
| `auth.js` | `/inscription`, `/connexion`... | Tout le monde |
| `commandes.js` | `/commande`, `/compte` | Personnes connectées (`exigerConnexion`) |
| `employe.js` | `/employe` | Employés et administrateur (`exigerRole('employe', 'administrateur')`) |
| `admin.js` | `/admin` | Administrateur uniquement (`exigerRole('administrateur')`) |

Convention : `GET` affiche une page, `POST` modifie des données. Chaque `POST` vérifie le jeton CSRF.

## 5. Comment les données sont enregistrées

### PostgreSQL (données de l'application)

Le schéma (`database/creation.sql`) reprend le MCD de l'énoncé, avec quatre ajouts nécessaires :

- `menu_plat` et `plat_allergene` : tables d'association, car un plat peut être dans plusieurs menus
  et contenir plusieurs allergènes (relations « plusieurs à plusieurs ») ;
- `image_menu` : la galerie d'images d'un menu ;
- `suivi_commande` : une ligne par changement de statut, avec la date et l'heure (suivi exigé par l'énoncé).

Écart avec le MCD : l'image d'un plat n'est pas stockée en BLOB. Les images sont des fichiers du dépôt
(`public/images/menus`) et la base ne garde que leur chemin. C'est plus simple et plus léger pour la base.

Toutes les requêtes passent par `db.query(texteSql, valeurs)` avec des paramètres `$1, $2...` :

```js
db.query('SELECT * FROM menu WHERE menu_id = $1', [id]);
```

PostgreSQL reçoit la requête et les valeurs **séparément**. Une valeur contenant du SQL (`1 OR 1=1`) reste une simple valeur :
c'est la protection contre les **injections SQL**. On ne construit jamais une requête en collant des chaînes de caractères.

Pour la création d'une commande, on utilise une **transaction** (`BEGIN` ... `COMMIT`) dans `services/commandes.js` :
vérification du stock, décrément du stock, création de la commande et premier statut sont enregistrés tous ensemble ou pas du tout.
`SELECT ... FOR UPDATE` verrouille le menu pour que deux clients ne prennent pas la dernière place en même temps.

### MongoDB (statistiques)

À chaque création ou modification d'une commande, `enregistrerStatCommande` (`config/mongo.js`) copie un résumé
dans la collection `commandes_stats` :

```js
{ commande_id: 12, menu_id: 2, menu_titre: 'Menu de Pâques', prix_total: 333.13, statut: 'accepte', date_commande: ... }
```

- **Pas de double comptage** : un index unique sur `commande_id` et un `updateOne(..., { upsert: true })`.
  Si le document existe, il est mis à jour ; sinon il est créé. Une commande = un document, toujours.
- La page Statistiques fait une agrégation MongoDB (`$match` puis `$group` par menu) pour compter les commandes
  et additionner le chiffre d'affaires, en excluant les commandes annulées. Les données affichées viennent donc
  réellement de MongoDB, pas de PostgreSQL.
- Si MongoDB est indisponible au moment d'une commande, la commande est quand même enregistrée dans PostgreSQL
  (c'est la source de vérité). `npm run sync-stats` recopie toutes les commandes dans MongoDB sans créer de doublon.

Pourquoi deux bases ? L'énoncé impose une base NoSQL. Les statistiques s'y prêtent bien : ce sont des documents
indépendants, qu'on agrège sans jointure.

## 6. Comment fonctionne l'authentification

1. **Inscription** : le mot de passe est vérifié (10 caractères, majuscule, minuscule, chiffre, caractère spécial)
   puis **haché avec bcrypt** (`bcrypt.hash`). On ne stocke jamais le mot de passe, seulement son empreinte.
   Le rôle est toujours « utilisateur » (fixé dans la requête SQL, pas lu depuis le formulaire).
2. **Connexion** : on cherche l'utilisateur par e-mail, puis `bcrypt.compare` compare le mot de passe saisi à l'empreinte.
   Le message d'erreur est le même que l'e-mail existe ou non (on ne renseigne pas un attaquant).
3. **Session** : en cas de succès, le serveur crée une nouvelle session (`req.session.regenerate`) et y range
   `{ id, prenom, nom, email, role }`. Le navigateur reçoit seulement un cookie `vg.sid` contenant un identifiant aléatoire.
   Les sessions sont stockées dans la table `session` de PostgreSQL (bibliothèque `connect-pg-simple`) :
   elles survivent à un redémarrage du serveur, contrairement au stockage en mémoire par défaut d'express-session.
4. **Contrôle d'accès** : les middlewares `exigerConnexion` et `exigerRole` (`middlewares/securite.js`)
   lisent `req.session.utilisateur` avant chaque page protégée.
   Un client ne voit que ses commandes : les requêtes contiennent `AND utilisateur_id = $2`.
5. **Mot de passe oublié** : un jeton aléatoire est envoyé par mail. La base ne garde que son empreinte SHA-256
   et une date d'expiration (1 heure). Le lien ne sert qu'une fois.
6. **Désactivation d'un employé** : `actif = FALSE` bloque la connexion, et ses sessions en cours sont supprimées.
7. **Administrateur** : il est créé dans `donnees.sql`. Aucune route ne permet de créer un compte avec le rôle administrateur.

### Mesures de sécurité (liste pour la copie)

| Risque | Protection | Où |
|---|---|---|
| Injection SQL | Requêtes paramétrées `$1` | partout (`config/db.js`) |
| XSS (injection de script) | EJS échappe tout avec `<%= %>` ; `textContent` en JS ; en-tête Content-Security-Policy | vues, `app.js` |
| CSRF | Jeton secret par session dans chaque formulaire | `middlewares/securite.js` |
| Vol de mot de passe | Hachage bcrypt | `routes/auth.js` |
| Force brute | 10 échecs max par 15 min et par IP (express-rate-limit) | `routes/auth.js` |
| Vol de session | Cookie `httpOnly`, `sameSite=lax`, `secure` en production, nouvelle session à la connexion | `app.js`, `routes/auth.js` |
| Accès non autorisé | `exigerConnexion`, `exigerRole`, filtre `utilisateur_id` | `middlewares/securite.js`, routes |
| Données falsifiées | Validation serveur de tous les champs ; prix et distance recalculés par le serveur | `services/` |
| Clickjacking | En-têtes `X-Frame-Options: DENY` et `frame-ancestors 'none'` | `app.js` |
| Secrets dans le code | Variables d'environnement, `.env` ignoré par Git | `.env.example`, `.gitignore` |

## 7. Comment le prix d'une commande est calculé

Tout est dans `services/prix.js`, fonction `calculerPrix`. L'énoncé donne « le prix pour le nombre de personnes minimum »
sans préciser comment calculer pour plus de personnes. **Choix retenu et documenté** : le prix est proportionnel.

1. **Prix par personne** = prix minimum ÷ nombre minimum de personnes.
2. **Prix du menu** = prix minimum × nombre de personnes ÷ nombre minimum (on multiplie avant de diviser :
   au nombre minimum, on retombe exactement sur le prix affiché).
3. **Réduction** : 10 % du prix du menu si nombre de personnes ≥ minimum + 5.
   (« 5 personnes de plus que le minimum » : interprété comme « au moins 5 de plus ».)
4. **Livraison** : 0 € si la ville est Bordeaux. Sinon 5 € + 0,59 € × km, distance arrondie au km supérieur.
   La réduction ne s'applique pas à la livraison.
5. **Total** = prix du menu − réduction + livraison.

Les calculs sont faits **en centimes** (nombres entiers) puis convertis en euros, car en JavaScript `0.1 + 0.2` donne
`0.30000000000000004`. Arrondi au centime le plus proche (`Math.round`).

Exemple (commande de démonstration) : Menu de Pâques, 160 € pour 4 personnes, 9 personnes à Mérignac (8 km) :
160 × 9 ÷ 4 = 360 € ; réduction 36 € (9 ≥ 4 + 5) ; livraison 5 + 8 × 0,59 = 9,72 € ; **total 333,72 €**.

### La distance de livraison

Le client ne saisit **jamais** de distance. `services/livraison.js` :

1. envoie l'adresse à l'**API Adresse** de l'État (`api-adresse.data.gouv.fr`, gratuite, sans clé) ;
2. récupère la ville officielle (code INSEE 33063 = Bordeaux) et les coordonnées GPS ;
3. calcule la distance à vol d'oiseau entre la cuisine et l'adresse (formule de Haversine).

**Limite assumée** : la distance à vol d'oiseau est plus courte que la distance par la route (de l'ordre de 20 à 30 %).
Un calcul routier nécessiterait un service supplémentaire avec une clé d'API (OpenRouteService, Google...).
Ce choix est indiqué au client dans les CGV. Si l'API Adresse ne reconnaît pas l'adresse, la commande est refusée
avec un message clair. Si l'API est en panne, la commande est momentanément impossible.

Les tests (`tests/prix.test.js`) vérifient : le prix au minimum, le refus sous le minimum, le seuil de réduction
(minimum + 4 : non, minimum + 5 : oui), la livraison, l'arrondi des kilomètres et des centimes.

## 8. Comment Git est utilisé

- `main` : la version stable, celle qui est déployée sur Render.
- `develop` : la branche d'intégration.
- `feature/<nom>` : une branche par fonctionnalité, créée depuis `develop`.

Cycle d'une fonctionnalité :

```bash
git switch develop
git switch -c feature/espace-employe
# ... développement + commits ...
npm test                          # on teste avant de fusionner
git switch develop
git merge --no-ff feature/espace-employe
# quand develop est testé :
git switch main
git merge --no-ff develop
git push origin main develop
```

`--no-ff` garde une trace visible de chaque fusion dans l'historique.
Le fichier `.env` (mots de passe des bases) est dans `.gitignore` : il n'est jamais envoyé sur GitHub.

## 9. Comment l'application est déployée

Voir [DEPLOIEMENT.md](DEPLOIEMENT.md) pour les étapes détaillées. En résumé :

- **Render** héberge l'application Node.js. À chaque `git push` sur `main`, Render relance `npm install` puis `npm start`.
- **Neon** héberge PostgreSQL, **MongoDB Atlas** héberge MongoDB. Les deux ont des offres gratuites sans date d'expiration.
- Les secrets (`DATABASE_URL`, `MONGODB_URI`, `SESSION_SECRET`, SMTP) sont saisis dans les variables d'environnement de Render.

Pourquoi pas la base PostgreSQL gratuite de Render ? Elle expire 30 jours après sa création, un risque pour l'ECF.

## 10. Les parties complexes mais nécessaires

| Élément | Pourquoi on ne pouvait pas faire plus simple |
|---|---|
| Sessions dans PostgreSQL | Le stockage mémoire par défaut perd les connexions à chaque redémarrage et n'est pas prévu pour la production |
| Jeton CSRF | Sans lui, un site malveillant pourrait faire passer une commande ou annuler une commande à la place d'un client connecté |
| Transaction + `FOR UPDATE` | Sans elle, deux commandes simultanées pourraient dépasser le stock |
| Calcul en centimes | Sans cela, des erreurs d'arrondi apparaissent sur les prix |
| Géolocalisation de l'adresse | L'énoncé facture au kilomètre ; laisser le client saisir la distance permettrait de tricher |
| Synchronisation MongoDB | Imposée par l'énoncé (graphique alimenté par une base NoSQL) |
