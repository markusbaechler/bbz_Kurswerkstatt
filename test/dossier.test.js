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

test('statusVon() ist ohne Eintrag entwurf — nie undefined', () => {
  assert.equal(dossier.statusVon(dossier.neu('X'), 'briefing'), 'entwurf');
});

test('statusSetzen() schreibt nur bekannte Werte', () => {
  const d = dossier.neu('X');
  dossier.statusSetzen(d, 'briefing', 'final');
  assert.equal(dossier.statusVon(d, 'briefing'), 'final');
  assert.throws(() => dossier.statusSetzen(d, 'briefing', 'fertig'));  /* KWKurse-Vokabular ist hier falsch */
});

test('banner() wird gerendert, nie getippt: final ist bannerfrei', () => {
  assert.equal(dossier.banner('final'), null);
  assert.match(dossier.banner('entwurf'), /ENTWURF/);
  assert.match(dossier.banner('validiert'), /VALIDIERT/);
});

test('quelleNeu() vergibt fortlaufende IDs und verlangt titel, stand, datei', () => {
  const d = dossier.neu('X');
  const q = dossier.quelleNeu(d, { titel: 'SSPA Map', herausgeber: 'SSPA', stand: '2025', datei: 'sspa-map-2025.pdf' });
  assert.equal(q.id, 'Q-001');
  assert.equal(dossier.quelleNeu(d, { titel: 'B', stand: '2026', datei: 'b.pdf' }).id, 'Q-002');
  assert.throws(() => dossier.quelleNeu(d, { titel: 'ohne Stand', datei: 'x.pdf' }), /stand/);
});

test('positivliste() ist die Liste der Dateinamen — Eingabe fuer den Auftrag', () => {
  const d = dossier.neu('X');
  dossier.quelleNeu(d, { titel: 'A', stand: '2025', datei: 'a.pdf' });
  assert.deepEqual(dossier.positivliste(d), ['a.pdf']);
});

test('quellenDateiname() bereinigt wie der Ablage-Kontrakt es verlangt', () => {
  /* Unterstrich, Umlaute, Leerzeichen — genau die Faelle, an denen Dateien
     unsichtbar wurden (AFL-001_lernziele_drehbuch_v1.xlsx, 2026-07-22). */
  assert.equal(dossier.quellenDateiname('AHV Merkblatt_2.01 (gültig).pdf'), 'ahv-merkblatt-2-01-gueltig.pdf');
  assert.equal(dossier.quellenDateiname('map.PDF'), 'map.pdf');
});
