// Formulaire de commande : affiche le détail du prix avant validation.
// Le calcul est fait par le SERVEUR (/commande/estimation) avec la même fonction que la commande réelle :
// le navigateur ne calcule rien lui-même, il affiche seulement le résultat.
const formulaire = document.getElementById('form-commande');
const zonePrix = document.getElementById('detail-prix');
const champMenu = document.getElementById('menu_id');
const champNombre = document.getElementById('nombre_personne');
let minuterie;

const euros = (n) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });

// Quand on change de menu, le minimum de personnes et les conditions changent aussi
function mettreAJourMinimum() {
  const option = champMenu.tagName === 'SELECT' ? champMenu.selectedOptions[0] : champMenu;
  const minimum = Number(option.dataset.min);
  champNombre.min = minimum;
  document.getElementById('nb-min').textContent = minimum;
  if (Number(champNombre.value) < minimum) champNombre.value = minimum;
  document.getElementById('conditions-menu').textContent = option.dataset.conditions || 'Aucune condition particulière.';
}

function afficherMessage(texte) {
  zonePrix.replaceChildren();
  const p = document.createElement('p');
  p.textContent = texte; // textContent (et non innerHTML) : aucun risque d'injection de code
  zonePrix.append(p);
}

async function estimerPrix() {
  const donnees = Object.fromEntries(new FormData(formulaire));
  if (!donnees.date_prestation || !donnees.adresse_livraison || !donnees.code_postal || !donnees.ville_livraison) return;
  afficherMessage('Calcul en cours…');

  const reponse = await fetch('/commande/estimation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': donnees._csrf },
    body: JSON.stringify(donnees),
  });
  const resultat = await reponse.json();
  if (!reponse.ok) return afficherMessage(resultat.erreurs.join(' '));

  const prix = resultat.prix;
  const lignes = [
    [`Menu (${donnees.nombre_personne} pers. × ${euros(prix.prixParPersonne)})`, euros(prix.prixMenu)],
  ];
  if (prix.reduction > 0) lignes.push(['Réduction de 10 %', '− ' + euros(prix.reduction)]);
  lignes.push([prix.distanceKm > 0 ? `Livraison à ${resultat.ville} (${prix.distanceKm} km)` : `Livraison à ${resultat.ville}`, euros(prix.prixLivraison)]);
  lignes.push(['Total', euros(prix.prixTotal)]);

  const tableau = document.createElement('table');
  tableau.className = 'tableau-prix';
  lignes.forEach(([libelle, montant], i) => {
    const ligne = tableau.insertRow();
    if (i === lignes.length - 1) ligne.className = 'total';
    const entete = document.createElement('th');
    entete.scope = 'row';
    entete.textContent = libelle;
    ligne.append(entete);
    ligne.insertCell().textContent = montant;
  });
  zonePrix.replaceChildren(tableau);
}

if (champMenu.tagName === 'SELECT') champMenu.addEventListener('change', mettreAJourMinimum);
formulaire.addEventListener('input', () => {
  clearTimeout(minuterie);
  minuterie = setTimeout(estimerPrix, 500);
});
estimerPrix(); // si le formulaire est déjà rempli (modification d'une commande)
