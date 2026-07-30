'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { dossier } = require('../dossier.js');

test('S1: ein offener Punkt braucht was, wo und einen gueltigen Adressaten', () => {
  const d = dossier.neu('VL-001');
  assert.throws(() => dossier.offenNeu(d, { was: 'x', wo: 'M05', fuer: 'irgendwann' }), /Gate oder Schritt/);
  assert.throws(() => dossier.offenNeu(d, { was: '', wo: 'M05', fuer: 'gate-1' }), /was/);
  const e = dossier.offenNeu(d, { was: 'Bloom-Stufe LZ-003 klaeren', wo: '1_Lernziele', fuer: 'gate-1' });
  assert.deepStrictEqual(d.offen, [e]);
});

test('offenEntscheiden verlangt Person und Datum und verschiebt den Punkt', () => {
  const d = dossier.neu('VL-001');
  dossier.offenNeu(d, { was: 'x', wo: 'M05', fuer: 'gate-1' });
  assert.throws(() => dossier.offenEntscheiden(d, 0, { wer: '', wann: '2026-07-30' }), /wer/);
  const e = dossier.offenEntscheiden(d, 0, { wer: 'Markus', wann: '2026-07-30' });
  assert.strictEqual(d.offen.length, 0);
  assert.deepStrictEqual(d.entschieden, [e]);
  assert.strictEqual(e.wer, 'Markus');
});

test('S2: verschieben nur begruendet und an ein gueltiges Ziel', () => {
  const d = dossier.neu('VL-001');
  dossier.offenNeu(d, { was: 'x', wo: 'M05', fuer: 'gate-1' });
  assert.throws(() => dossier.offenVerschieben(d, 0, 'gate-2', ''), /[Bb]egruendung/);
  dossier.offenVerschieben(d, 0, 'gate-2', 'braucht die Excel aus Schritt 2');
  assert.strictEqual(d.offen[0].fuer, 'gate-2');
  assert.ok(d.offen[0].begruendung);
  assert.strictEqual(dossier.offenFuer(d, 'gate-1').length, 0);
});

test('ein falscher Index laesst das Dossier unangetastet', () => {
  const d = dossier.neu('VL-001');
  assert.strictEqual(dossier.offenEntscheiden(d, 3, { wer: 'M', wann: 'x' }), null);
  assert.strictEqual(dossier.offenVerschieben(d, 3, 'gate-2', 'weil'), null);
});
