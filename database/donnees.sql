-- =====================================================================
-- Vite & Gourmand : données de démonstration
-- À exécuter après creation.sql.
-- Comptes de test (mots de passe hachés avec bcrypt, voir docs/MANUEL_UTILISATION.md) :
--   administrateur : jose@vite-gourmand.fr   / Jose#Admin2026
--   employé        : julie@vite-gourmand.fr  / Julie#Employe2026
--   utilisateur    : client@exemple.fr       / Client#Test2026
-- =====================================================================

INSERT INTO role (role_id, libelle) VALUES
  (1, 'utilisateur'), (2, 'employe'), (3, 'administrateur');

-- Le compte administrateur est créé ici : l'application ne permet pas d'en créer.
INSERT INTO utilisateur (email, password, nom, prenom, telephone, adresse_postale, code_postal, ville, role_id) VALUES
  ('jose@vite-gourmand.fr',  '$2b$10$kog8QUgJtb0D7ae21wzk0ebWdzw7SZ9q58zXyCqhPyIFzN3MhM9EK', 'Martin', 'José',  '0600000001', '10 quai des Chartrons', '33000', 'Bordeaux', 3),
  ('julie@vite-gourmand.fr', '$2b$10$3D6DpCgj0el9e7CPnSBgFesUaKMHKmdKcMb0C4Vhd5.q35s.69ILi', 'Martin', 'Julie', '0600000002', '10 quai des Chartrons', '33000', 'Bordeaux', 2),
  ('client@exemple.fr',      '$2b$10$iKHTwGeQ9xzKu8AA/Tjcw.HrlbHw5SsllMTVbyGbDJHTLnIwnPC6K', 'Durand', 'Camille', '0612345678', '5 rue Sainte-Catherine', '33000', 'Bordeaux', 1);

INSERT INTO theme (libelle) VALUES ('Noël'), ('Pâques'), ('Classique'), ('Événement');
INSERT INTO regime (libelle) VALUES ('Classique'), ('Végétarien'), ('Vegan'), ('Sans gluten');

INSERT INTO allergene (libelle) VALUES
  ('Gluten'), ('Lait'), ('Œufs'), ('Fruits à coque'), ('Poisson'), ('Crustacés'), ('Céleri'), ('Moutarde'), ('Soja'), ('Sulfites');

INSERT INTO plat (titre_plat, type) VALUES
  ('Foie gras maison et chutney de figues', 'entree'),   -- 1
  ('Velouté de potimarron', 'entree'),                   -- 2
  ('Salade de chèvre chaud aux noix', 'entree'),         -- 3
  ('Tartare de légumes croquants', 'entree'),            -- 4
  ('Chapon rôti aux marrons', 'plat'),                   -- 5
  ('Gigot d''agneau de sept heures', 'plat'),            -- 6
  ('Pavé de saumon à l''oseille', 'plat'),               -- 7
  ('Risotto aux champignons', 'plat'),                   -- 8
  ('Curry de légumes au lait de coco', 'plat'),          -- 9
  ('Bûche chocolat praliné', 'dessert'),                 -- 10
  ('Nid de Pâques au chocolat', 'dessert'),              -- 11
  ('Tarte fine aux pommes', 'dessert'),                  -- 12
  ('Salade de fruits frais', 'dessert'),                 -- 13
  ('Canelés bordelais', 'dessert');                      -- 14

INSERT INTO plat_allergene (plat_id, allergene_id) VALUES
  (1, 1), (1, 10), (2, 2), (2, 7), (3, 1), (3, 2), (3, 4), (5, 7), (6, 10),
  (7, 5), (7, 2), (8, 2), (9, 9), (10, 1), (10, 2), (10, 3), (10, 4),
  (11, 1), (11, 2), (11, 3), (12, 1), (12, 2), (12, 3), (14, 1), (14, 2), (14, 3);

INSERT INTO menu (titre, description, theme_id, regime_id, nombre_personne_minimum, prix_minimum, conditions, quantite_restante) VALUES
  ('Menu de Noël traditionnel', 'Un repas de fête généreux autour du chapon rôti, pour réunir toute la famille.', 1, 1, 6, 270.00,
   'Commande au moins 14 jours avant la prestation. Plats à conserver au réfrigérateur et à réchauffer avant le service.', 8),
  ('Menu de Pâques', 'Le gigot d''agneau de sept heures et un dessert chocolaté pour célébrer le printemps.', 2, 1, 4, 160.00,
   'Commande au moins 7 jours avant la prestation. À conserver entre 0 et 4 °C.', 10),
  ('Menu classique bordelais', 'Le savoir-faire de la maison : poisson frais et canelés bordelais.', 3, 1, 2, 70.00,
   'Commande au moins 3 jours avant la prestation.', 20),
  ('Menu végétarien du marché', 'Des légumes de saison travaillés simplement, sans viande ni poisson.', 3, 2, 4, 120.00,
   'Commande au moins 5 jours avant la prestation. Contient des produits laitiers.', 12),
  ('Menu vegan', '100 % végétal, coloré et parfumé.', 3, 3, 2, 60.00,
   'Commande au moins 5 jours avant la prestation.', 15),
  ('Buffet événement', 'Une formule complète pour vos anniversaires, mariages et séminaires. Matériel de service prêté sur demande.', 4, 1, 20, 700.00,
   'Commande au moins 3 semaines avant la prestation. Le matériel prêté doit être restitué sous 10 jours ouvrés (voir CGV).', 5);

INSERT INTO menu_plat (menu_id, plat_id) VALUES
  (1, 1), (1, 5), (1, 10),
  (2, 3), (2, 6), (2, 11),
  (3, 2), (3, 7), (3, 14),
  (4, 3), (4, 8), (4, 12),
  (5, 4), (5, 9), (5, 13),
  (6, 1), (6, 2), (6, 6), (6, 7), (6, 12), (6, 14);

INSERT INTO image_menu (menu_id, chemin, texte_alternatif) VALUES
  (1, '/images/menus/noel-1.svg', 'Illustration du menu de Noël'),
  (1, '/images/menus/noel-2.svg', 'Illustration de la bûche de Noël'),
  (2, '/images/menus/paques-1.svg', 'Illustration du menu de Pâques'),
  (2, '/images/menus/paques-2.svg', 'Illustration du nid de Pâques'),
  (3, '/images/menus/classique-1.svg', 'Illustration du menu classique'),
  (3, '/images/menus/classique-2.svg', 'Illustration des canelés'),
  (4, '/images/menus/vegetarien-1.svg', 'Illustration du menu végétarien'),
  (4, '/images/menus/vegetarien-2.svg', 'Illustration du risotto'),
  (5, '/images/menus/vegan-1.svg', 'Illustration du menu vegan'),
  (5, '/images/menus/vegan-2.svg', 'Illustration du curry de légumes'),
  (6, '/images/menus/evenement-1.svg', 'Illustration du buffet'),
  (6, '/images/menus/evenement-2.svg', 'Illustration d''une table dressée');

INSERT INTO horaire (jour, ordre, heure_ouverture, heure_fermeture) VALUES
  ('Lundi', 1, '09:00', '18:00'), ('Mardi', 2, '09:00', '18:00'), ('Mercredi', 3, '09:00', '18:00'),
  ('Jeudi', 4, '09:00', '18:00'), ('Vendredi', 5, '09:00', '20:00'), ('Samedi', 6, '10:00', '20:00'),
  ('Dimanche', 7, NULL, NULL);

-- Commandes de démonstration (prix calculés avec les règles de services/prix.js)
INSERT INTO commande (numero_commande, utilisateur_id, menu_id, date_commande, date_prestation, heure_livraison,
  adresse_livraison, code_postal, ville_livraison, distance_km, nombre_personne, prix_menu, reduction, prix_livraison, prix_total, statut) VALUES
  -- 6 personnes, Bordeaux : 270,00 €, pas de réduction, livraison offerte
  ('VG-DEMO-0001', 3, 1, '2025-12-01 10:00+01', '2025-12-24', '19:00', '5 rue Sainte-Catherine', '33000', 'Bordeaux', 0, 6, 270.00, 0, 0, 270.00, 'terminee'),
  -- 9 personnes (≥ 4 + 5) à Mérignac 8 km : 360,00 - 36,00 + (5 + 8 × 0,59 = 9,72) = 333,72 €
  ('VG-DEMO-0002', 3, 2, '2026-03-20 15:30+01', '2026-04-05', '12:00', '1 avenue de la Marne', '33700', 'Mérignac', 8, 9, 360.00, 36.00, 9.72, 333.72, 'terminee'),
  -- 2 personnes, Bordeaux : 70,00 €
  ('VG-DEMO-0003', 3, 3, '2026-10-02 09:15+02', '2026-10-10', '20:00', '5 rue Sainte-Catherine', '33000', 'Bordeaux', 0, 2, 70.00, 0, 0, 70.00, 'livre'),
  -- 4 personnes, Bordeaux : 120,00 €, en attente de validation
  ('VG-DEMO-0004', 3, 4, '2026-11-10 18:00+01', '2026-12-05', '12:30', '5 rue Sainte-Catherine', '33000', 'Bordeaux', 0, 4, 120.00, 0, 0, 120.00, 'en_attente');

INSERT INTO suivi_commande (commande_id, statut, date_modification) VALUES
  (1, 'en_attente', '2025-12-01 10:00+01'), (1, 'accepte', '2025-12-02 09:00+01'), (1, 'en_preparation', '2025-12-24 10:00+01'),
  (1, 'en_livraison', '2025-12-24 18:00+01'), (1, 'livre', '2025-12-24 18:45+01'), (1, 'terminee', '2025-12-24 18:50+01'),
  (2, 'en_attente', '2026-03-20 15:30+01'), (2, 'accepte', '2026-03-21 09:00+01'), (2, 'terminee', '2026-04-05 14:00+02'),
  (3, 'en_attente', '2026-10-02 09:15+02'), (3, 'accepte', '2026-10-03 09:00+02'), (3, 'livre', '2026-10-10 20:10+02'),
  (4, 'en_attente', '2026-11-10 18:00+01');

INSERT INTO avis (commande_id, utilisateur_id, note, description, statut) VALUES
  (1, 3, 5, 'Un réveillon parfait, le chapon était délicieux et la livraison ponctuelle.', 'valide'),
  (2, 3, 4, 'Très bon gigot, toute la famille a apprécié. Un peu de retard à la livraison.', 'valide');

-- Les SERIAL n'avancent pas quand on force des identifiants : rien à corriger ici car aucun id n'est forcé
-- (sauf role_id qui n'est pas un SERIAL).
