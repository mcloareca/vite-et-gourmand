// Fonctions de validation des formulaires, utilisées côté serveur.
// Les attributs HTML (required, pattern...) aident l'utilisateur, mais ne suffisent pas :
// un utilisateur malveillant peut les contourner, donc le serveur revérifie tout.

// 10 caractères minimum, au moins une minuscule, une majuscule, un chiffre et un caractère spécial
const REGEX_MOT_DE_PASSE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{10,}$/;
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REGEX_TELEPHONE = /^(\+33|0)[1-9](\s?\d{2}){4}$/;
const REGEX_CODE_POSTAL = /^\d{5}$/;

const estMotDePasseFort = (mdp) => typeof mdp === 'string' && REGEX_MOT_DE_PASSE.test(mdp);
const estEmailValide = (email) => typeof email === 'string' && email.length <= 255 && REGEX_EMAIL.test(email);
const estTelephoneValide = (tel) => typeof tel === 'string' && REGEX_TELEPHONE.test(tel.trim());
const estCodePostalValide = (cp) => typeof cp === 'string' && REGEX_CODE_POSTAL.test(cp.trim());

// Texte obligatoire, nettoyé des espaces, avec une longueur maximale
function texte(valeur, max = 255) {
  if (typeof valeur !== 'string') return '';
  return valeur.trim().slice(0, max);
}

// Nombre entier positif ou null
function entier(valeur) {
  const n = Number(valeur);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

// Vérifie les champs du formulaire d'inscription ou de profil. Renvoie la liste des erreurs.
function verifierProfil(donnees) {
  const erreurs = [];
  if (!donnees.nom || !donnees.prenom) erreurs.push('Le nom et le prénom sont obligatoires.');
  if (!estEmailValide(donnees.email)) erreurs.push("L'adresse e-mail n'est pas valide.");
  if (!estTelephoneValide(donnees.telephone)) erreurs.push("Le numéro de GSM n'est pas valide (ex : 06 12 34 56 78).");
  if (!donnees.adresse_postale || !donnees.ville) erreurs.push("L'adresse postale est obligatoire.");
  if (!estCodePostalValide(donnees.code_postal)) erreurs.push('Le code postal doit contenir 5 chiffres.');
  return erreurs;
}

module.exports = {
  REGEX_MOT_DE_PASSE,
  estMotDePasseFort,
  estEmailValide,
  estTelephoneValide,
  estCodePostalValide,
  texte,
  entier,
  verifierProfil,
};
