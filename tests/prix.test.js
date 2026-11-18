// Tests du calcul de prix : lancer avec "npm test"
// node:test et node:assert sont fournis par Node.js, aucune bibliothèque à installer.
const test = require('node:test');
const assert = require('node:assert');
const { calculerPrix } = require('../services/prix');

// Menu de Pâques des données de démo : 160 € pour 4 personnes minimum (40 € / personne)
const paques = { prixMinimum: 160, nombreMinimum: 4 };

test('au nombre minimum, le prix est exactement le prix minimum', () => {
  const r = calculerPrix({ ...paques, nombrePersonnes: 4, estBordeaux: true });
  assert.strictEqual(r.prixMenu, 160);
  assert.strictEqual(r.reduction, 0);
  assert.strictEqual(r.prixTotal, 160);
  assert.strictEqual(r.prixParPersonne, 40);
});

test('en dessous du minimum, la commande est refusée', () => {
  assert.throws(() => calculerPrix({ ...paques, nombrePersonnes: 3, estBordeaux: true }));
});

test('un nombre de personnes non entier est refusé', () => {
  assert.throws(() => calculerPrix({ ...paques, nombrePersonnes: 4.5, estBordeaux: true }));
});

test('minimum + 4 personnes : pas encore de réduction', () => {
  const r = calculerPrix({ ...paques, nombrePersonnes: 8, estBordeaux: true });
  assert.strictEqual(r.prixMenu, 320);
  assert.strictEqual(r.reduction, 0);
  assert.strictEqual(r.prixTotal, 320);
});

test('minimum + 5 personnes : réduction de 10 %', () => {
  const r = calculerPrix({ ...paques, nombrePersonnes: 9, estBordeaux: true });
  assert.strictEqual(r.prixMenu, 360);
  assert.strictEqual(r.reduction, 36);
  assert.strictEqual(r.prixTotal, 324);
});

test('la livraison à Bordeaux est gratuite, même avec une distance', () => {
  const r = calculerPrix({ ...paques, nombrePersonnes: 4, estBordeaux: true, distanceKm: 12 });
  assert.strictEqual(r.prixLivraison, 0);
});

test('hors Bordeaux : 5 € + 0,59 € par km', () => {
  const r = calculerPrix({ ...paques, nombrePersonnes: 4, estBordeaux: false, distanceKm: 8 });
  assert.strictEqual(r.prixLivraison, 9.72); // 5 + 8 × 0,59
  assert.strictEqual(r.prixTotal, 169.72);
});

test('la distance est arrondie au kilomètre supérieur', () => {
  const r = calculerPrix({ ...paques, nombrePersonnes: 4, estBordeaux: false, distanceKm: 7.2 });
  assert.strictEqual(r.distanceKm, 8);
  assert.strictEqual(r.prixLivraison, 9.72);
});

test('la réduction ne s\'applique pas à la livraison (commande de démo VG-DEMO-0002)', () => {
  const r = calculerPrix({ ...paques, nombrePersonnes: 9, estBordeaux: false, distanceKm: 8 });
  assert.strictEqual(r.prixTotal, 333.72); // 360 - 36 + 9,72
});

test('arrondi au centime quand le prix par personne ne tombe pas juste', () => {
  // 100 € pour 3 personnes = 33,333... € / personne
  const r = calculerPrix({ prixMinimum: 100, nombreMinimum: 3, nombrePersonnes: 4, estBordeaux: true });
  assert.strictEqual(r.prixMenu, 133.33);
  // 8 personnes (≥ 3 + 5) : 266,67 € puis 10 % = 26,67 €
  const r2 = calculerPrix({ prixMinimum: 100, nombreMinimum: 3, nombrePersonnes: 8, estBordeaux: true });
  assert.strictEqual(r2.prixMenu, 266.67);
  assert.strictEqual(r2.reduction, 26.67);
  assert.strictEqual(r2.prixTotal, 240);
});

test('les centimes sont exacts (pas d\'erreur de virgule flottante)', () => {
  const r = calculerPrix({ prixMinimum: 70.1, nombreMinimum: 2, nombrePersonnes: 3, estBordeaux: false, distanceKm: 3 });
  assert.strictEqual(r.prixMenu, 105.15);
  assert.strictEqual(r.prixLivraison, 6.77);
  assert.strictEqual(r.prixTotal, 111.92);
});
