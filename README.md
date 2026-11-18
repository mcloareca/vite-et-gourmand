# Vite & Gourmand

Application web du traiteur bordelais **Vite & Gourmand** (ECF du titre professionnel Développeur Web et Web Mobile, Studi).
Les visiteurs consultent les menus, les clients commandent et suivent leurs commandes, les employés gèrent les commandes,
les menus et les avis, l'administrateur gère les employés et consulte les statistiques.

- **Front** : HTML5, CSS3 (Flexbox, Grid), JavaScript natif, pages générées par EJS
- **Back** : Node.js 22+ et Express 5
- **Base relationnelle** : PostgreSQL (hébergée sur Neon)
- **Base NoSQL** : MongoDB (hébergée sur MongoDB Atlas), pour les statistiques
- **Déploiement** : Render

**Application en ligne** : https://vite-et-gourmand-dsz4.onrender.com
(offre gratuite : la première page peut mettre environ une minute à s’afficher après 15 minutes sans visite)

Identifiants de démonstration : voir `docs/livrables/Manuel_utilisation_Vite_et_Gourmand.pdf`.

Documentation : [docs/GUIDE_ETUDIANT.md](docs/GUIDE_ETUDIANT.md) (fonctionnement), [docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md),
[docs/MATRICE_CONFORMITE.md](docs/MATRICE_CONFORMITE.md) (énoncé ↔ code), [docs/SUIVI.md](docs/SUIVI.md) (avancement).

## Installation en local

### 1. Prérequis

- [Node.js](https://nodejs.org) 22 ou plus récent (`node -v` pour vérifier)
- Git
- Une base PostgreSQL : un projet gratuit [Neon](https://neon.tech) ou un PostgreSQL installé localement
- Une base MongoDB : un cluster gratuit [MongoDB Atlas](https://www.mongodb.com/atlas) ou un MongoDB local
  (facultatif : sans MongoDB, l'application fonctionne mais la page Statistiques affiche un avertissement)

### 2. Récupérer le projet et installer les dépendances

```bash
git clone <url-du-depot>
cd vite-et-gourmand
npm install
```

### 3. Configurer les variables d'environnement

```bash
cp .env.example .env
```

Puis remplir `.env` : `DATABASE_URL` (chaîne de connexion PostgreSQL), `MONGODB_URI` (chaîne MongoDB),
`SESSION_SECRET` (longue chaîne aléatoire). Les variables `SMTP_*` sont facultatives : si elles sont vides,
les e-mails sont affichés dans la console au lieu d'être envoyés.

### 4. Créer la base et les données de démonstration

```bash
npm run init-db
```

Ce script exécute `database/creation.sql` puis `database/donnees.sql`, et copie les commandes dans MongoDB.
**Attention : il efface toutes les données existantes.**
Les deux fichiers SQL peuvent aussi être exécutés à la main (psql, console SQL de Neon...).

### 5. Lancer l'application

```bash
npm run dev
```

Ouvrir http://localhost:3000. (`npm run dev` redémarre automatiquement à chaque modification ; `npm start` pour la production.)

### 6. Lancer les tests

```bash
npm test
```

## Comptes de démonstration

| Rôle | E-mail | Mot de passe |
|---|---|---|
| Administrateur | jose@vite-gourmand.fr | Jose#Admin2026 |
| Employé | julie@vite-gourmand.fr | Julie#Employe2026 |
| Utilisateur | client@exemple.fr | Client#Test2026 |

## Organisation Git

- `main` : version stable, déployée
- `develop` : intégration des fonctionnalités
- `feature/...` : une branche par fonctionnalité, créée depuis `develop` et fusionnée dans `develop` après test

Le détail est dans [docs/GUIDE_ETUDIANT.md](docs/GUIDE_ETUDIANT.md#8-comment-git-est-utilisé).
