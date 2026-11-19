const test = require('node:test');
const assert = require('node:assert');
const v = require('../services/validation');
const { distanceVolOiseau, CUISINE } = require('../services/livraison');

test('mot de passe : les règles de l\'énoncé sont appliquées', () => {
  assert.ok(v.estMotDePasseFort('Exemple#Valide1'), 'mot de passe conforme');
  assert.ok(!v.estMotDePasseFort('Court#1A'), 'moins de 10 caractères');
  assert.ok(!v.estMotDePasseFort('sansmajuscule#1'), 'pas de majuscule');
  assert.ok(!v.estMotDePasseFort('SANSMINUSCULE#1'), 'pas de minuscule');
  assert.ok(!v.estMotDePasseFort('SansChiffre#abc'), 'pas de chiffre');
  assert.ok(!v.estMotDePasseFort('SansSpecial123'), 'pas de caractère spécial');
});

test('e-mail, téléphone et code postal', () => {
  assert.ok(v.estEmailValide('client@exemple.fr'));
  assert.ok(!v.estEmailValide('client@exemple'));
  assert.ok(v.estTelephoneValide('06 12 34 56 78'));
  assert.ok(v.estTelephoneValide('+33612345678'));
  assert.ok(!v.estTelephoneValide('12345'));
  assert.ok(v.estCodePostalValide('33000'));
  assert.ok(!v.estCodePostalValide('3300'));
});

test('distance à vol d\'oiseau Bordeaux → Mérignac (environ 6 km)', () => {
  const merignac = { latitude: 44.8386, longitude: -0.6436 };
  const km = distanceVolOiseau(CUISINE, merignac);
  assert.ok(km > 5 && km < 7, `distance obtenue : ${km}`);
});
