# Suivi d'avancement

Chaque étape indique ce qui est **terminé et testé**, ce qui est **codé mais pas encore testé**, et ce qui **reste à faire**.

## Étape 1 – 18/11/2026 : socle complet de l'application

**Terminé et testé** (PostgreSQL de test local, 14 tests unitaires + 65 vérifications de bout en bout + contrôles dans le navigateur) :
- Base PostgreSQL : `creation.sql` et `donnees.sql` s'exécutent sans erreur
- Pages publiques, filtres dynamiques, détail des menus
- Inscription, connexion, déconnexion, mot de passe oublié, limitation des tentatives
- Commande complète : pré-remplissage, distance calculée depuis l'adresse (API Adresse réelle), prix détaillé, stock
- Espace utilisateur : profil, commandes, modification, annulation, suivi, avis
- Espace employé : statuts, annulation motivée, menus, plats, horaires, avis
- Espace administrateur : création et désactivation d'employés
- Sécurité : CSRF, contrôle des rôles, accès aux commandes d'autrui refusé, champs falsifiés ignorés
- Affichage mobile (375 px)

**Codé mais pas encore testé** :
- Statistiques MongoDB : testées à l'étape 3 (voir plus bas)
- Envoi réel des e-mails : en attente d'un compte SMTP (les 7 types de mails sont bien déclenchés, affichés dans la console)

**Reste à faire** :
- Créer les comptes GitHub (dépôt public), Neon, MongoDB Atlas, Render, SMTP → déploiement
- Tester les statistiques MongoDB et les mails en conditions réelles
- Remplacer les illustrations SVG par de vraies photos libres de droits (facultatif)
- Livrables : charte graphique et maquettes, manuel d'utilisation PDF, gestion de projet (outil + documentation),
  diagrammes (cas d'utilisation, séquence, MCD), copie à rendre
- Audit d'accessibilité RGAA plus poussé

## Étape 2 – 18/11/2026 : livrables documentaires

**Produit** (dossier `docs/livrables/`, sources HTML dans `docs/livrables/sources/`) :
- Wireframes (3 bureau + 3 mobile) et mockups (3 bureau + 3 mobile, captures de l'interface réalisée) : `maquettes/`
- `Charte_graphique_Vite_et_Gourmand.pdf` : palette, contrastes calculés, typographie, composants, maquettes
- `Documentation_technique_Vite_et_Gourmand.pdf` : choix techniques, environnement, architecture, modèle de données,
  cas d'utilisation, 2 diagrammes de séquence, sécurité, tests, déploiement, limites
- `Manuel_utilisation_Vite_et_Gourmand.pdf` : identifiants et parcours des 4 rôles
- `Gestion_de_projet_Vite_et_Gourmand.pdf` + `gestion-projet-taches.csv` (import Notion)
- `ECF_TPDeveloppeurWebEtWebMobile_copiearendre_NOM_Prenom.docx` : brouillon rempli

**Reste à compléter dans les documents** (surligné ou marqué « [à compléter] ») :
- Liens GitHub, Notion, Render ; nom, prénom, date de naissance ; éditeur de code utilisé
- Veille sécurité : à personnaliser avec la veille réellement effectuée
- Capture de la page Statistiques (nécessite MongoDB) dans le manuel
- Dates des étapes déploiement et rendu dans la gestion de projet

## Étape 3 – 18/11/2026 : vraies bases de données

**Terminé et testé (en local, avec les bases cloud)** :
- PostgreSQL sur Neon (Francfort) et MongoDB Atlas (cluster gratuit, Francfort) : connexions vérifiées
- `npm run init-db` exécuté : tables et données de démonstration dans Neon, 4 commandes copiées dans MongoDB
- Tests de bout en bout rejoués avec ces bases : 65 vérifications, toutes réussies
- Statistiques MongoDB : graphique affiché (navigateur, aucune erreur console), tableau du chiffre d'affaires,
  filtres par menu et par période ; chiffres identiques à PostgreSQL ; un seul document par commande
  (pas de double comptage) ; commandes annulées exclues
- Données de démonstration remises à zéro après les tests (`npm run init-db`)

**Reste à faire** :
- Pousser le dépôt sur GitHub, déployer sur Render, vérifier en production
- Envoi réel des e-mails (SMTP Brevo) : non testé

## Étape 4 – 18–19/11/2026 : mise en production

**Terminé et vérifié en production** (https://vite-et-gourmand-dsz4.onrender.com) :
- Dépôt public GitHub : https://github.com/mcloareca/vite-et-gourmand (branches `main` et `develop`)
- Service Render (offre gratuite, Blueprint `render.yaml`), connecté à Neon et à MongoDB Atlas
- Pages publiques, en-têtes de sécurité (CSP, X-Frame-Options), cookie de session `Secure` + `HttpOnly`
- Tests de bout en bout rejoués sur la production : tout passe (la requête malveillante de test est bloquée
  par le pare-feu Cloudflare de Render avant d'atteindre l'application)
- Statistiques : les documents MongoDB écrits par le serveur Render correspondent aux commandes PostgreSQL
- Données de démonstration réinitialisées après les tests ; capture de la page Statistiques en production

**Problèmes rencontrés et résolus** : IP Access List Atlas limitée à l'adresse de création (ajout de `0.0.0.0/0`) ;
mot de passe Atlas laissé entre chevrons ; suffixe `-dsz4` ajouté par Render (APP_URL corrigée).

**Limites restantes** :
- Envoi réel des e-mails non configuré ni testé (mails écrits dans les journaux Render)
- Réveil du serveur gratuit : environ 50 secondes après 15 minutes sans visite
- Réinitialisation du mot de passe : vérifiée en local seulement (le lien n'est lisible que dans les journaux tant que le SMTP n'est pas configuré)

**Reste à faire par l'étudiant** : nom, prénom, date de naissance, éditeur de code et veille sécurité dans la copie ;
~~tableau Notion public et son lien~~ (fait le 19/11/2026, voir étape 6).

## Étape 5 – 19/11/2026 : tests de bout en bout dans le dépôt

- `tests/e2e.js` + commande `npm run test:e2e` : 64 vérifications HTTP, explications dans le README
- Configuration séparée `.env.test` (ignorée par Git, modèle `.env.test.example`) ; aucun mot de passe dans le code des tests
- Garde-fous testés : refus si `.env.test` absent, même base PostgreSQL ou même MongoDB que `.env`, mots de passe
  de démonstration manquants, port déjà occupé ; seules les variables de `.env.test` sont transmises
- Vérifié : 64/64 sur une base PostgreSQL locale temporaire, deux fois de suite ; base de production inchangée
- Non vérifié : le lancement sur une branche Neon de test (à créer par l'étudiant, voir README)

## Étape 6 – 19/11/2026 : lien Notion

- Tableau Kanban public : https://tan-spy-72f.notion.site/41d9578884e98030a108d6349b30cea1?v=41d9578884e98082a505000c4754a05d
- Lien ajouté dans la gestion de projet (PDF), la copie à rendre, la matrice de conformité et le README
