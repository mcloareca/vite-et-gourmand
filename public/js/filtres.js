// Filtre dynamique des menus : met à jour la liste sans recharger la page.
// Le serveur renvoie le fragment HTML de la liste (même modèle EJS que la page complète).
const formulaire = document.getElementById('filtres');
const liste = document.getElementById('liste-menus');
let minuterie;

async function actualiserMenus() {
  const parametres = new URLSearchParams(new FormData(formulaire));
  const reponse = await fetch('/menus/filtrer?' + parametres);
  if (!reponse.ok) return;
  liste.innerHTML = await reponse.text();
  // On garde les filtres dans l'adresse de la page (partage, bouton retour)
  history.replaceState(null, '', '/menus?' + parametres);
}

// "input" se déclenche à chaque frappe : on attend 300 ms de pause avant d'interroger le serveur
formulaire.addEventListener('input', () => {
  clearTimeout(minuterie);
  minuterie = setTimeout(actualiserMenus, 300);
});

// Le bouton "Filtrer" reste utile au clavier : on évite juste le rechargement
formulaire.addEventListener('submit', (evenement) => {
  evenement.preventDefault();
  actualiserMenus();
});
