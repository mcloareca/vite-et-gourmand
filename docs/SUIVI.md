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
- Statistiques MongoDB (graphique et chiffre d'affaires) : en attente d'un cluster Atlas
- Envoi réel des e-mails : en attente d'un compte SMTP (les 7 types de mails sont bien déclenchés, affichés dans la console)

**Reste à faire** :
- Créer les comptes GitHub (dépôt public), Neon, MongoDB Atlas, Render, SMTP → déploiement
- Tester les statistiques MongoDB et les mails en conditions réelles
- Remplacer les illustrations SVG par de vraies photos libres de droits (facultatif)
- Livrables : charte graphique et maquettes, manuel d'utilisation PDF, gestion de projet (outil + documentation),
  diagrammes (cas d'utilisation, séquence, MCD), copie à rendre
- Audit d'accessibilité RGAA plus poussé
