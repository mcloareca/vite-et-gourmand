# Matrice de conformité : énoncé Studi ↔ application

Légende :
- ✅ **Testé** : fonctionne, vérifié par un test automatique ou manuel
- 🟡 **Codé, non testé** : le code existe mais n'a pas encore été vérifié dans les conditions réelles
- ❌ **À faire** : pas encore réalisé
- ⚠️ **Écart** : choix différent de l'énoncé, justifié

Les tests « locaux » ont été faits le 18/11/2026 sur un PostgreSQL de test local, **sans MongoDB ni SMTP réels**.
Le 18/11/2026, les mêmes tests de bout en bout (65 vérifications) ont été rejoués en local **avec les vraies bases Neon (PostgreSQL) et MongoDB Atlas** : tous passent. Le SMTP réel n'est toujours pas testé.
Le 19/11/2026, les tests de bout en bout (56 vérifications HTTP ; la réinitialisation du mot de passe, qui lit le lien dans les journaux, n'est vérifiable qu'en local) ont été rejoués **sur le site en production** : tous passent, sauf la requête volontairement malveillante `theme=1 OR 1=1`, bloquée en amont par le pare-feu Cloudflare de Render (403, avant même l'application). Statistiques MongoDB écrites par le serveur Render = commandes PostgreSQL. Données de démonstration réinitialisées ensuite.

## Fonctionnalités

| Exigence de l'énoncé | État | Où dans le code | Vérification |
|---|---|---|---|
| Accueil : présentation, professionnalisme, avis validés | ✅ | `views/accueil.ejs`, `routes/public.js` | test e2e : seuls les avis validés s'affichent |
| Menu : accueil, menus, connexion, contact | ✅ | `views/partials/tete.ejs` | navigateur |
| Pied de page : horaires lundi → dimanche, mentions légales, CGV | ✅ | `views/partials/pied.ejs` | test e2e |
| Vue globale : titre, description, nb personnes min, prix, bouton détail | ✅ | `views/partials/liste-menus.ejs` | test e2e |
| Filtres prix max, fourchette, thème, régime, nb personnes | ✅ | `routes/public.js` (`chercherMenus`) | test e2e (5 filtres) |
| Filtres sans rechargement de page | ✅ | `public/js/filtres.js` | navigateur : liste mise à jour, aucune navigation |
| Menu : titre, galerie, description, thème, plats, allergènes, min, prix, conditions, régime, stock | ✅ | `database/creation.sql`, `views/menu-detail.ejs` | test e2e |
| Un plat dans plusieurs menus | ✅ | table `menu_plat` | données de démo |
| Conditions du menu mises en évidence | ✅ | `.conditions` dans `menu-detail.ejs` et `commande.ejs` | navigateur |
| Bouton commander → connexion si visiteur, puis retour | ✅ | `exigerConnexion`, `retourApresConnexion` | test e2e |
| Création de compte (nom, prénom, GSM, e-mail, adresse, mot de passe fort) | ✅ | `routes/auth.js` | test e2e (mdp faible refusé, doublon refusé) |
| Rôle « utilisateur » à l'inscription | ✅ | `routes/auth.js` (role_id fixé à 1) | test e2e |
| Mail de bienvenue | 🟡 | `routes/auth.js` | déclenché (console) ; envoi SMTP réel non testé |
| Connexion e-mail + mot de passe | ✅ | `routes/auth.js` | test e2e |
| Mot de passe oublié par lien mail | ✅ | `routes/auth.js` | test e2e (lien à usage unique) ; envoi SMTP réel non testé |
| Commande : infos client pré-remplies | ✅ | `views/commande.ejs` | test e2e |
| Commande : adresse, date, heure, lieu | ✅ | `services/commandes.js` | test e2e |
| Livraison hors Bordeaux 5 € + 0,59 €/km | ✅ | `services/prix.js`, `services/livraison.js` | tests unitaires + e2e (API Adresse réelle) |
| Menu pré-sélectionné depuis le détail | ✅ | `routes/commandes.js` | test e2e |
| Minimum de personnes obligatoire | ✅ | `services/prix.js` | tests unitaires + e2e |
| −10 % à partir de minimum + 5 personnes | ✅ | `services/prix.js` | tests unitaires (seuils) |
| Détail du prix avant validation | ✅ | `public/js/commande.js`, `/commande/estimation` | navigateur + e2e |
| Mail de confirmation de commande | 🟡 | `routes/commandes.js` | déclenché (console) |
| Espace utilisateur : commandes détaillées, modifier ses informations | ✅ | `routes/commandes.js`, `views/compte/` | test e2e |
| Annulation / modification client tant que non « accepté », menu non modifiable | ✅ | `routes/commandes.js` | test e2e (refus côté serveur après acceptation) |
| Suivi : tous les statuts avec date et heure | ✅ | table `suivi_commande`, `detail-commande.ejs` | test e2e |
| Commande terminée → mail invitant à donner un avis | 🟡 | `routes/employe.js` | déclenché (console) |
| Avis : note 1 à 5 + commentaire | ✅ | `routes/commandes.js` | test e2e (note 7 refusée, un seul avis) |
| Employé : modifier/supprimer menus, plats, horaires | ✅ | `routes/employe.js` | test e2e |
| Employé : annulation avec mode de contact + motif | ✅ | `routes/employe.js` | test e2e |
| Employé : modification du contenu d'une commande après contact | ⚠️ | — | non implémenté : l'employé gère le statut et l'annulation ; la modification du contenu reste à faire par le client tant que la commande est en attente |
| Filtre des commandes par statut et par client | ✅ | `routes/employe.js` | test e2e |
| Statuts accepté → … → terminée | ✅ | `services/commandes.js` | test e2e |
| Statut retour matériel → mail 600 € / 10 jours ouvrés | 🟡 | `routes/employe.js` | déclenché (console) |
| Employé : valider / refuser les avis | ✅ | `routes/employe.js` | test e2e |
| Admin : créer un employé (e-mail + mot de passe), mail sans mot de passe | ✅ | `routes/admin.js` | test e2e (mail déclenché, sans mot de passe) |
| Admin : désactiver un employé | ✅ | `routes/admin.js` | test e2e (session coupée, connexion refusée) |
| Admin créé par nous, impossible d'en créer depuis l'app | ✅ | `donnees.sql`, `routes/admin.js` | test e2e (role_id envoyé ignoré) |
| Admin : tout ce que fait un employé | ✅ | `exigerRole('employe', 'administrateur')` | test e2e |
| Admin : graphique commandes par menu depuis NoSQL | ✅ | `config/mongo.js`, `views/admin/statistiques.ejs` | testé en local avec MongoDB Atlas : graphique affiché, chiffres identiques à PostgreSQL |
| Admin : CA par menu, filtres menu et durée | ✅ | `config/mongo.js` | filtres menu et période testés avec Atlas ; total 833,72 € = PostgreSQL |
| Pas de double comptage dans MongoDB | ✅ | index unique + upsert | testé : 5 commandes → 5 documents après plusieurs changements de statut ; commande annulée exclue |
| Contact : titre, description, e-mail → mail à l'entreprise | ✅ | `routes/public.js` | test e2e (mail déclenché) |
| RGPD | 🟡 | mentions légales, consentement à l'inscription, cookie technique uniquement | pas de suppression de compte en libre-service (sur demande via contact) |
| Accessibilité RGAA | 🟡 | labels, lien d'évitement, focus visible, `aria-live`, tableaux avec `caption`/`scope` | audit complet (contrastes, lecteur d'écran) à faire |
| Responsive | ✅ | `public/css/style.css` | navigateur 375 px : pas de défilement horizontal |
| Application déployée | ✅ | `render.yaml` | https://vite-et-gourmand-dsz4.onrender.com — tests de bout en bout rejoués en production le 19/11/2026 (Neon + Atlas) |

## Écarts assumés avec le MCD de l'annexe

| MCD | Application | Raison |
|---|---|---|
| `plat.photo` en BLOB | Images en fichiers statiques, chemin en base (`image_menu`) | Plus simple, base plus légère, pas d'upload à sécuriser |
| `menu.prix_par_personne` | `menu.prix_minimum` (prix pour le nombre minimum) | Correspond au texte de l'énoncé ; le prix par personne est calculé |
| Relations plat ↔ menu et plat ↔ allergène | Tables `menu_plat`, `plat_allergene` | Traduction standard des relations n,n du MCD |
| — | Tables `suivi_commande`, `image_menu`, `session` | Suivi horodaté, galerie, sessions persistantes |

## Livrables Studi

| Livrable | État |
|---|---|
| Dépôt GitHub public | ❌ dépôt local prêt, dépôt GitHub à créer |
| Branches main / develop / feature | ✅ en local |
| README d'installation locale | ✅ `README.md` |
| Fichiers SQL de création et de données | ✅ `database/` |
| Manuel d'utilisation PDF avec identifiants | 🟡 `docs/livrables/Manuel_utilisation_Vite_et_Gourmand.pdf` (lien de production et capture des statistiques à ajouter) |
| Charte graphique PDF (palette, police, 3 maquettes bureau + 3 mobiles) | ✅ `docs/livrables/Charte_graphique_Vite_et_Gourmand.pdf` (wireframes + mockups) |
| Documentation gestion de projet + lien outil (Trello/Notion/Jira) | 🟡 PDF prêt ; tableau Notion à importer depuis le CSV et à publier |
| Documentation technique (choix techniques, environnement, MCD, diagrammes de cas d'utilisation et de séquence, déploiement) | ✅ `docs/livrables/Documentation_technique_Vite_et_Gourmand.pdf` (à mettre à jour après le déploiement) |
| Copie à rendre (Word) | 🟡 brouillon rempli ; liens, identité et veille à compléter |
| Lien de déploiement + identifiants admin | ❌ |
