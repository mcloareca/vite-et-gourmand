# Déploiement

État au 18/11/2026 : **pas encore déployé**. Les comptes nécessaires doivent être créés par le propriétaire du projet.

## Hébergeurs choisis

Limites des offres gratuites vérifiées en novembre 2026 :

| Service | Rôle | Offre gratuite | Limites à connaître |
|---|---|---|---|
| Render | Application Node.js | Web Service « Free » | Mise en veille après 15 min sans visite : la première page met environ 1 minute à charger. 750 h/mois |
| Neon | PostgreSQL | Free | 1 Go de stockage par projet, 100 h de calcul/mois. Pas d'expiration |
| MongoDB Atlas | MongoDB | Cluster Free (ex-M0) | 512 Mo, 100 opérations/s, partagé. Un cluster gratuit par projet |

PostgreSQL gratuit de Render écarté : la base expire 30 jours après sa création.

**Conseil pour le jury** : ouvrir le site une minute avant la démonstration pour réveiller le serveur Render.

## Étapes

### 1. GitHub
1. Créer un dépôt **public** `vite-et-gourmand`.
2. `git remote add origin <url>` puis `git push -u origin main develop`.

### 2. Neon (PostgreSQL)
1. Créer un projet (région Europe, Francfort).
2. Copier la chaîne de connexion (`postgresql://...?sslmode=require`).
3. En local, la mettre dans `.env` (`DATABASE_URL=...`) puis lancer `npm run init-db`.

### 3. MongoDB Atlas
1. Créer un cluster gratuit (région Europe).
2. *Database Access* : créer un utilisateur avec un mot de passe.
3. *Network Access* : autoriser `0.0.0.0/0` (Render n'a pas d'adresse IP fixe sur l'offre gratuite).
4. Copier la chaîne `mongodb+srv://...` dans `.env` (`MONGODB_URI=...`) puis `npm run sync-stats`.

### 4. Render (application)
1. *New → Web Service*, connecter le dépôt GitHub, branche `main`.
2. Runtime : Node. Build command : `npm install`. Start command : `npm start`. Plan : Free.
3. Variables d'environnement :
   `NODE_ENV=production`, `DATABASE_URL`, `MONGODB_URI`, `SESSION_SECRET` (longue chaîne aléatoire),
   `APP_URL` (adresse Render, ex. `https://vite-et-gourmand.onrender.com`), `CONTACT_EMAIL`, et les variables `SMTP_*`.
4. Chaque `git push` sur `main` redéploie automatiquement.

### 5. E-mails (SMTP)
Un service SMTP gratuit (par exemple Brevo, 300 mails/jour) fournit `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`.
Sans ces variables, les mails sont seulement écrits dans les journaux de Render.

## Vérifications après déploiement
- [ ] La page d'accueil s'affiche en HTTPS
- [ ] Connexion avec les trois comptes de démonstration
- [ ] Passer une commande hors Bordeaux et vérifier le prix
- [ ] La page Statistiques affiche le graphique (MongoDB connecté)
- [ ] Un mail de bienvenue arrive réellement (SMTP)
