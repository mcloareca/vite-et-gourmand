-- =====================================================================
-- Vite & Gourmand : création de la base PostgreSQL
-- Basé sur le MCD de l'annexe 1 de l'énoncé, complété par :
--   - les tables d'association menu_plat et plat_allergene (relations n,n)
--   - image_menu (galerie d'images d'un menu)
--   - suivi_commande (historique des statuts avec date et heure)
--   - session (sessions de connexion, utilisée par connect-pg-simple)
-- Ce script supprime puis recrée toutes les tables : à n'utiliser qu'à l'installation.
-- =====================================================================

DROP TABLE IF EXISTS session, avis, suivi_commande, commande, image_menu, menu_plat,
  plat_allergene, allergene, plat, menu, theme, regime, horaire, utilisateur, role CASCADE;

CREATE TABLE role (
  role_id  INT PRIMARY KEY,
  libelle  VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE utilisateur (
  utilisateur_id   SERIAL PRIMARY KEY,
  email            VARCHAR(255) NOT NULL UNIQUE,
  password         VARCHAR(255) NOT NULL,          -- hash bcrypt, jamais le mot de passe en clair
  nom              VARCHAR(50)  NOT NULL,
  prenom           VARCHAR(50)  NOT NULL,
  telephone        VARCHAR(20)  NOT NULL DEFAULT '',
  adresse_postale  VARCHAR(255) NOT NULL DEFAULT '',
  code_postal      VARCHAR(10)  NOT NULL DEFAULT '',
  ville            VARCHAR(100) NOT NULL DEFAULT '',
  pays             VARCHAR(50)  NOT NULL DEFAULT 'France',
  role_id          INT NOT NULL REFERENCES role(role_id),
  actif            BOOLEAN NOT NULL DEFAULT TRUE,  -- FALSE = compte désactivé (départ d'un employé)
  reset_token_hash VARCHAR(64),                    -- empreinte SHA-256 du lien de réinitialisation
  reset_expire     TIMESTAMPTZ
);

CREATE TABLE theme (
  theme_id SERIAL PRIMARY KEY,
  libelle  VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE regime (
  regime_id SERIAL PRIMARY KEY,
  libelle   VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE menu (
  menu_id                 SERIAL PRIMARY KEY,
  titre                   VARCHAR(100) NOT NULL,
  description             TEXT NOT NULL,
  theme_id                INT NOT NULL REFERENCES theme(theme_id),
  regime_id               INT NOT NULL REFERENCES regime(regime_id),
  nombre_personne_minimum INT NOT NULL CHECK (nombre_personne_minimum > 0),
  prix_minimum            NUMERIC(10,2) NOT NULL CHECK (prix_minimum > 0), -- prix pour le nombre minimum de personnes
  conditions              TEXT NOT NULL DEFAULT '',
  quantite_restante       INT NOT NULL DEFAULT 0 CHECK (quantite_restante >= 0)
);

CREATE TABLE image_menu (
  image_id         SERIAL PRIMARY KEY,
  menu_id          INT NOT NULL REFERENCES menu(menu_id) ON DELETE CASCADE,
  chemin           VARCHAR(255) NOT NULL,            -- ex : /images/menus/noel-1.svg (fichier du dépôt)
  texte_alternatif VARCHAR(255) NOT NULL DEFAULT ''
);

CREATE TABLE plat (
  plat_id    SERIAL PRIMARY KEY,
  titre_plat VARCHAR(100) NOT NULL,
  type       VARCHAR(10) NOT NULL CHECK (type IN ('entree', 'plat', 'dessert'))
);

CREATE TABLE allergene (
  allergene_id SERIAL PRIMARY KEY,
  libelle      VARCHAR(50) NOT NULL UNIQUE
);

-- Un plat peut être présent dans plusieurs menus
CREATE TABLE menu_plat (
  menu_id INT REFERENCES menu(menu_id) ON DELETE CASCADE,
  plat_id INT REFERENCES plat(plat_id) ON DELETE CASCADE,
  PRIMARY KEY (menu_id, plat_id)
);

-- Un plat peut contenir plusieurs allergènes
CREATE TABLE plat_allergene (
  plat_id      INT REFERENCES plat(plat_id) ON DELETE CASCADE,
  allergene_id INT REFERENCES allergene(allergene_id) ON DELETE CASCADE,
  PRIMARY KEY (plat_id, allergene_id)
);

CREATE TABLE horaire (
  horaire_id      SERIAL PRIMARY KEY,
  jour            VARCHAR(10) NOT NULL UNIQUE,
  ordre           INT NOT NULL,                      -- 1 = lundi ... 7 = dimanche (pour l'affichage)
  heure_ouverture VARCHAR(5),                        -- NULL = fermé ce jour-là
  heure_fermeture VARCHAR(5)
);

CREATE TABLE commande (
  commande_id          SERIAL PRIMARY KEY,
  numero_commande      VARCHAR(50) NOT NULL UNIQUE,
  utilisateur_id       INT NOT NULL REFERENCES utilisateur(utilisateur_id),
  menu_id              INT NOT NULL REFERENCES menu(menu_id),  -- pas de CASCADE : on garde l'historique
  date_commande        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  date_prestation      DATE NOT NULL,
  heure_livraison      VARCHAR(5) NOT NULL,
  adresse_livraison    VARCHAR(255) NOT NULL,
  code_postal          VARCHAR(10) NOT NULL,
  ville_livraison      VARCHAR(100) NOT NULL,
  distance_km          INT NOT NULL DEFAULT 0,               -- calculée par le serveur, jamais saisie
  nombre_personne      INT NOT NULL CHECK (nombre_personne > 0),
  prix_menu            NUMERIC(10,2) NOT NULL,
  reduction            NUMERIC(10,2) NOT NULL DEFAULT 0,
  prix_livraison       NUMERIC(10,2) NOT NULL DEFAULT 0,
  prix_total           NUMERIC(10,2) NOT NULL,
  statut               VARCHAR(30) NOT NULL DEFAULT 'en_attente',
  pret_materiel        BOOLEAN NOT NULL DEFAULT FALSE,
  restitution_materiel BOOLEAN NOT NULL DEFAULT FALSE,
  mode_contact         VARCHAR(10),                          -- 'gsm' ou 'mail' (annulation par un employé)
  motif_annulation     TEXT
);

CREATE TABLE suivi_commande (
  suivi_id          SERIAL PRIMARY KEY,
  commande_id       INT NOT NULL REFERENCES commande(commande_id) ON DELETE CASCADE,
  statut            VARCHAR(30) NOT NULL,
  date_modification TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE avis (
  avis_id        SERIAL PRIMARY KEY,
  commande_id    INT NOT NULL UNIQUE REFERENCES commande(commande_id) ON DELETE CASCADE, -- un avis par commande
  utilisateur_id INT NOT NULL REFERENCES utilisateur(utilisateur_id),
  note           INT NOT NULL CHECK (note BETWEEN 1 AND 5),
  description    VARCHAR(500) NOT NULL,
  statut         VARCHAR(20) NOT NULL DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'valide', 'refuse')),
  date_avis      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table des sessions (format imposé par la bibliothèque connect-pg-simple)
CREATE TABLE session (
  sid    VARCHAR NOT NULL PRIMARY KEY,
  sess   JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);
CREATE INDEX idx_session_expire ON session (expire);
