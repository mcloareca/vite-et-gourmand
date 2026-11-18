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
