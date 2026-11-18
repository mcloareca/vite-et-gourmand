// Calcul du prix d'une commande.
// Toute la règle tarifaire est ici, dans une seule fonction testée (tests/prix.test.js).
//
// Règles (énoncé + choix documentés dans docs/GUIDE_ETUDIANT.md) :
//  1. Un menu a un prix pour son nombre minimum de personnes.
//     Prix par personne = prix minimum / nombre minimum.
//     Prix du menu = prix par personne × nombre de personnes.
//  2. Réduction de 10 % sur le prix du menu si nombre de personnes ≥ minimum + 5.
//  3. Livraison gratuite à Bordeaux, sinon 5 € + 0,59 € par kilomètre.
//     La distance est arrondie au kilomètre supérieur.
//
// Pour éviter les erreurs d'arrondi des nombres à virgule (0.1 + 0.2 !== 0.3),
// tous les calculs sont faits en centimes (nombres entiers), puis convertis en euros.

const REDUCTION_POURCENTAGE = 10;
const PERSONNES_EN_PLUS_POUR_REDUCTION = 5;
const LIVRAISON_BASE_CENTIMES = 500; // 5,00 €
const LIVRAISON_PAR_KM_CENTIMES = 59; // 0,59 €

function calculerPrix({ prixMinimum, nombreMinimum, nombrePersonnes, estBordeaux, distanceKm }) {
  if (!Number.isInteger(nombrePersonnes) || nombrePersonnes < nombreMinimum) {
    throw new Error(`Le nombre de personnes doit être au moins de ${nombreMinimum}.`);
  }

  const prixMinimumCentimes = Math.round(Number(prixMinimum) * 100);
  // On multiplie avant de diviser : au nombre minimum, on retrouve exactement le prix minimum.
  const prixMenu = Math.round((prixMinimumCentimes * nombrePersonnes) / nombreMinimum);

  let reduction = 0;
  if (nombrePersonnes >= nombreMinimum + PERSONNES_EN_PLUS_POUR_REDUCTION) {
    reduction = Math.round((prixMenu * REDUCTION_POURCENTAGE) / 100);
  }

  let livraison = 0;
  let km = 0;
  if (!estBordeaux) {
    km = Math.ceil(Number(distanceKm) || 0);
    livraison = LIVRAISON_BASE_CENTIMES + km * LIVRAISON_PAR_KM_CENTIMES;
  }

  return {
    prixParPersonne: prixMinimumCentimes / nombreMinimum / 100, // indicatif, pour l'affichage
    prixMenu: prixMenu / 100,
    reduction: reduction / 100,
    prixLivraison: livraison / 100,
    distanceKm: km,
    prixTotal: (prixMenu - reduction + livraison) / 100,
  };
}

module.exports = { calculerPrix };
