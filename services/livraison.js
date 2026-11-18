// Calcul de la distance de livraison à partir de l'adresse saisie.
//
// Le client ne saisit JAMAIS la distance : le serveur la calcule.
// 1. L'adresse est envoyée à l'API Adresse officielle de l'État (api-adresse.data.gouv.fr),
//    gratuite et sans clé. Elle renvoie la ville normalisée et les coordonnées GPS.
// 2. On calcule la distance à vol d'oiseau entre la cuisine (Bordeaux) et l'adresse
//    avec la formule de Haversine.
//
// Limite connue (documentée) : la distance à vol d'oiseau est plus courte que la distance
// par la route. C'est un compromis simple ; un calcul routier demanderait un service
// externe supplémentaire avec une clé d'API.

// Adresse de la cuisine Vite & Gourmand (place de la Bourse, Bordeaux)
const CUISINE = { latitude: 44.8412, longitude: -0.5695 };
const CODE_INSEE_BORDEAUX = '33063';

// Distance en km entre deux points GPS (formule de Haversine)
function distanceVolOiseau(a, b) {
  const rayonTerre = 6371;
  const enRadians = (deg) => (deg * Math.PI) / 180;
  const dLat = enRadians(b.latitude - a.latitude);
  const dLon = enRadians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(enRadians(a.latitude)) * Math.cos(enRadians(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * rayonTerre * Math.asin(Math.sqrt(h));
}

// Renvoie { ville, codePostal, estBordeaux, distanceKm } ou null si l'adresse est introuvable.
async function localiserAdresse(adresse, codePostal, ville) {
  const recherche = `${adresse} ${codePostal} ${ville}`;
  const url = 'https://api-adresse.data.gouv.fr/search/?limit=1&q=' + encodeURIComponent(recherche);

  const reponse = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!reponse.ok) throw new Error('Service de géolocalisation indisponible');
  const donnees = await reponse.json();

  const resultat = donnees.features && donnees.features[0];
  // Un score faible signifie que l'API n'a pas vraiment reconnu l'adresse
  if (!resultat || resultat.properties.score < 0.5) return null;

  const [longitude, latitude] = resultat.geometry.coordinates;
  const estBordeaux = resultat.properties.citycode === CODE_INSEE_BORDEAUX;
  return {
    ville: resultat.properties.city,
    codePostal: resultat.properties.postcode,
    estBordeaux,
    distanceKm: estBordeaux ? 0 : Math.ceil(distanceVolOiseau(CUISINE, { latitude, longitude })),
  };
}

module.exports = { localiserAdresse, distanceVolOiseau, CUISINE };
