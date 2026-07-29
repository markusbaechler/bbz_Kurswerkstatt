'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { dossier } = require('../dossier.js');

test('neu() liefert ein leeres, gueltiges Dossier', () => {
  const d = dossier.neu('VL-001');
  assert.equal(d.kurs, 'VL-001');
  assert.equal(d.dossier, 1);
  assert.equal(d.content_modus, 'quellengestuetzt');
  assert.deepEqual(d.quellen, []);
  assert.deepEqual(dossier.pruefe(d), []);
});

test('ausWerten() uebernimmt Formularwerte in scope und bewahrt den Rest', () => {
  const alt = dossier.neu('VL-001');
  alt.quellen.push({ id: 'Q-001', titel: 'X', stand: '2026', datei: 'x.pdf' });
  const d = dossier.ausWerten('VL-001', { zielgruppe: ' Beratende ', leer: '' }, alt, '2026-07-29T18:00:00Z');
  assert.equal(d.scope.zielgruppe, 'Beratende');       /* getrimmt */
  assert.equal('leer' in d.scope, false);              /* Leeres faellt weg */
  assert.equal(d.quellen.length, 1);                   /* Quellen ueberleben das Formular */
  assert.equal(d.stand, '2026-07-29T18:00:00Z');
  assert.notEqual(d, alt);                             /* Kopie, kein Durchgriff */
});

test('text()/lesen() ist ein verlustfreier Kreis', () => {
  const d = dossier.ausWerten('VL-001', { kurszweck: 'Derivate verstehen' }, null, null);
  const zurueck = dossier.lesen(dossier.text(d));
  assert.deepEqual(zurueck, d);
});

test('lesen() weist Unbrauchbares ab statt es zu reparieren', () => {
  assert.equal(dossier.lesen('kein json'), null);
  assert.equal(dossier.lesen(''), null);
  assert.equal(dossier.lesen('{"dossier":99,"kurs":"X"}'), null);  /* fremde Schema-Version */
});

test('pruefe() benennt fehlende Pflichtteile', () => {
  const p = dossier.pruefe({ dossier: 1 });
  assert.ok(p.some(x => /kurs/.test(x)));
  assert.ok(p.some(x => /scope/.test(x)));
});

test('DATEI() baut den Dateinamen aus der Kurs-ID', () => {
  assert.equal(dossier.DATEI('VL-001'), 'VL-001_dossier.json');
});
