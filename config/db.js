// Connexion à PostgreSQL avec la bibliothèque "pg".
// Un "pool" garde quelques connexions ouvertes et les réutilise entre les requêtes.
const { Pool, types } = require('pg');

// Les colonnes DATE sont renvoyées telles quelles ("2026-12-24") plutôt que converties
// en objet Date JavaScript (qui pourrait décaler le jour à cause du fuseau horaire).
types.setTypeParser(1082, (valeur) => valeur);

// La chaîne de connexion Neon contient "sslmode=require" : la connexion est chiffrée (SSL).
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Toutes les requêtes passent par cette fonction.
// Les valeurs sont TOUJOURS passées dans "parametres" ($1, $2...) et jamais concaténées
// dans le texte SQL : c'est ce qui protège contre les injections SQL.
function query(texteSql, parametres = []) {
  return pool.query(texteSql, parametres);
}

module.exports = { pool, query };
