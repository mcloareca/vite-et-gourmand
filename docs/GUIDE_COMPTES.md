# Créer et connecter les comptes (GitHub, Neon, MongoDB Atlas, Render, Brevo)

Durée estimée : 45 minutes à 1 heure. Toutes les offres utilisées sont gratuites, sans carte bancaire
(si un service en demande une, arrêtez-vous et prévenez-moi).

Règle d'or : **les mots de passe et chaînes de connexion ne vont que dans le fichier `.env` (sur votre Mac)
et dans Render**. Ne les collez jamais dans le chat, dans un fichier du dépôt ou sur GitHub.

---

## Étape 1 – GitHub (dépôt public)

1. Allez sur https://github.com et connectez-vous (ou créez un compte).
2. En haut à droite : **+** → **New repository**.
3. *Repository name* : `vite-et-gourmand`. Cochez **Public**. Ne cochez **rien** d'autre (pas de README, pas de .gitignore, pas de licence).
4. Cliquez **Create repository**. Notez l'adresse affichée, du type `https://github.com/VOTRE-PSEUDO/vite-et-gourmand.git`.
5. Créez un jeton d'accès (GitHub n'accepte plus le mot de passe dans le terminal) :
   photo de profil → **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)**
   → **Generate new token (classic)**. Note : `ECF`, expiration : 30 jours, cochez **repo**, puis **Generate token**.
   Copiez le jeton (il ne s'affiche qu'une fois).
6. Dans le Terminal du Mac, tapez (en remplaçant VOTRE-PSEUDO) :

   ```bash
   cd ~/vite-et-gourmand
   git remote add origin https://github.com/VOTRE-PSEUDO/vite-et-gourmand.git
   git push -u origin main develop
   ```

   *Username* : votre pseudo GitHub. *Password* : collez le **jeton** (rien ne s'affiche pendant la saisie, c'est normal).
7. Rechargez la page GitHub : le code et les deux branches doivent apparaître.

## Étape 2 – Neon (PostgreSQL)

1. Allez sur https://neon.tech → **Sign up** (le plus simple : *Continue with GitHub*).
2. Créez un projet : nom `vite-et-gourmand`, version PostgreSQL proposée par défaut, région **AWS Europe Central 1 (Frankfurt)**.
3. Sur le tableau de bord du projet, cliquez **Connect**. Copiez la chaîne de connexion
   (elle commence par `postgresql://` et finit par `sslmode=require`). Cliquez sur l'œil pour afficher le mot de passe avant de copier.
4. Sur votre Mac, créez le fichier `.env` :

   ```bash
   cd ~/vite-et-gourmand
   cp .env.example .env
   open -e .env
   ```

   Collez la chaîne après `DATABASE_URL=` (sans espace ni guillemets). Enregistrez (Cmd+S).

## Étape 3 – MongoDB Atlas

1. Allez sur https://www.mongodb.com/cloud/atlas/register et créez un compte.
2. Créez un cluster : choisissez l'offre **Free**, fournisseur AWS, région **Frankfurt (eu-central-1)**, nom `vite-gourmand`. Cliquez **Create Deployment**.
3. Atlas propose de créer un utilisateur de base de données : nom `vg_app`, cliquez **Autogenerate Secure Password**, **copiez le mot de passe**, puis **Create Database User**.
4. Menu de gauche **Network Access** (ou *Security → Network Access*) → **Add IP Address** → **Allow Access from Anywhere** (`0.0.0.0/0`) → **Confirm**.
   (Nécessaire : Render n'a pas d'adresse IP fixe sur l'offre gratuite. La sécurité repose sur l'utilisateur et son mot de passe.)
5. Retour sur le cluster → **Connect** → **Drivers** → copiez la chaîne `mongodb+srv://vg_app:<db_password>@...`.
6. Dans `.env`, collez-la après `MONGODB_URI=` **en remplaçant `<db_password>`** (chevrons compris) par le mot de passe copié à l'étape 3. Enregistrez.

## Étape 4 – Prévenez-moi

Écrivez simplement « .env rempli » dans le chat (sans coller son contenu).
Je lancerai alors l'installation de la base Neon et de MongoDB, puis les tests avec les vraies bases.

## Étape 5 – Brevo (envoi réel des e-mails), recommandé

1. Allez sur https://www.brevo.com et créez un compte gratuit (300 e-mails par jour).
2. Menu **Senders, domains & dedicated IPs** → **Senders** → ajoutez votre adresse e-mail comme expéditeur et validez-la via le mail reçu.
3. Menu **SMTP & API** → onglet **SMTP** → **Generate a new SMTP key**. Notez le *Login* (de la forme `xxxx@smtp-brevo.com`) et la clé.
4. Dans `.env` :

   ```
   SMTP_HOST=smtp-relay.brevo.com
   SMTP_PORT=587
   SMTP_USER=le login affiché par Brevo
   SMTP_PASS=la clé SMTP
   MAIL_FROM="Vite & Gourmand <l-adresse-validee-a-l-etape-2>"
   CONTACT_EMAIL=l'adresse qui doit recevoir les messages de contact
   ```

   L'adresse de `MAIL_FROM` doit être exactement celle validée chez Brevo, sinon les mails sont refusés.

## Étape 6 – Render (mise en ligne)

À faire **après** l'étape 4 (une fois la base installée).

1. Allez sur https://render.com → **Get Started** → *Sign up with GitHub* (autorisez l'accès au dépôt `vite-et-gourmand`).
2. **New** → **Blueprint** → choisissez le dépôt `vite-et-gourmand` → branche `main`.
   Render lit le fichier `render.yaml` du dépôt et prépare le service `vite-et-gourmand` (offre Free, Francfort).
3. Render demande les valeurs des variables secrètes. Recopiez-les depuis votre `.env` :
   `DATABASE_URL`, `MONGODB_URI`, `CONTACT_EMAIL`, et si vous avez fait l'étape 5 : `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`.
   Pour `APP_URL`, mettez `https://vite-et-gourmand.onrender.com` (à corriger à l'étape 5 si Render donne une autre adresse).
   `SESSION_SECRET` est généré automatiquement par Render.
4. Cliquez **Apply** / **Deploy Blueprint**. Le premier déploiement prend 2 à 5 minutes (onglet **Logs**).
5. Quand le statut est **Live**, notez l'adresse affichée (`https://....onrender.com`).
   Si elle diffère de celle saisie pour `APP_URL`, corrigez la variable dans **Environment** (le service redémarre).
6. Envoyez-moi l'adresse du site : je lancerai les vérifications en production.

## En cas de problème

- `git push` refusé (*Authentication failed*) : vous avez saisi le mot de passe GitHub au lieu du jeton (étape 1.5).
- Render en échec : onglet **Logs**, copiez-moi les dernières lignes **en masquant toute chaîne de connexion**.
- Le site met une minute à s'afficher : normal sur l'offre gratuite après 15 minutes sans visite.
