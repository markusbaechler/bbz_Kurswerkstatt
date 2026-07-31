'use strict';
/* Z7 — der Quellen-Spiegel-Waechter. Live-Befund VL-002 (2026-07-31, zweimal):
   das Dossier bekam eine 15. Quelle, aber das abgelegte Briefing (der
   Frontmatter-Spiegel, den die KI daraus schreibt) trug still die alten 14 —
   niemand sah es, bis die KI-Ausgabe Widersprueche zeigte.

   inhalt.quellenSpiegel(text, d) vergleicht per Q-ID (Regex \bQ-\d{3}\b ueber
   den Dokumenttext), NIE per Zeilen-Syntax: welche Q-IDs aus d.quellen im
   Text NICHT vorkommen. Der Contract-Steckbrief (xlsx) ist im Browser nicht
   lesbar und wird hier bewusst NICHT geprueft — das laeuft ueber
   contract-pruefen/T11 (s. CLAUDE.md). */
const test = require('node:test');
const assert = require('node:assert/strict');

require('../app.js');
const { inhalt } = require('../inhalt.js');
require('../dossier.js');
const { ansichten } = require('../ansichten.js');
const { INHALT, KURSE } = require('./fixture.js');

const AFL = KURSE[1]; // Schritt 1, offen (s. ansichten.test.js)

function dossierMitQuellen(ids, extra) {
  return Object.assign({
    dossier: 1, kurs: 'AFL-001', scope: {}, regulatorik: {}, content_modus: 'quellengestuetzt',
    quellen: ids.map(function (id, n) {
      return { id: id, titel: 'Quelle ' + n, stand: '2026', datei: id + '.pdf' };
    }),
    status: {}, offen: [], entschieden: []
  }, extra || {});
}

/* ---------- inhalt.quellenSpiegel: reine Funktion ---------- */

test('quellenSpiegel: text == null heisst keine Aussage moeglich', () => {
  const d = dossierMitQuellen(['Q-001']);
  assert.strictEqual(inhalt.quellenSpiegel(null, d), null);
  assert.strictEqual(inhalt.quellenSpiegel(undefined, d), null);
});

test('quellenSpiegel: fehlende Q-ID wird gemeldet, gesamt zaehlt alle Quellen', () => {
  const d = dossierMitQuellen(['Q-001', 'Q-002', 'Q-003']);
  const text = 'Quellen: Q-001, Q-002.';
  const r = inhalt.quellenSpiegel(text, d);
  assert.deepStrictEqual(r.fehlend, ['Q-003']);
  assert.strictEqual(r.gesamt, 3);
});

test('quellenSpiegel: vollstaendiger Spiegel liefert eine leere fehlend-Liste', () => {
  const d = dossierMitQuellen(['Q-001', 'Q-002']);
  const text = 'Q-001 und Q-002 sind beide belegt.';
  const r = inhalt.quellenSpiegel(text, d);
  assert.deepStrictEqual(r.fehlend, []);
  assert.strictEqual(r.gesamt, 2);
});

test('quellenSpiegel: ohne Quellen im Dossier gibt es nichts zu vermissen', () => {
  const d = dossierMitQuellen([]);
  const r = inhalt.quellenSpiegel('irgendein Text ohne Q-IDs', d);
  assert.deepStrictEqual(r.fehlend, []);
  assert.strictEqual(r.gesamt, 0);
});

/* Q-ID-Matching ist unabhaengig vom Zeilenformat — kein Zeilen-Parser, reines
   Vorkommen der Q-ID irgendwo im Text. Ein Briefing, das dieselbe Quelle mit
   einem anderen Trennzeichen oder in YAML-Frontmatter nennt, zaehlt trotzdem
   als gespiegelt. */
test('quellenSpiegel: Matching ist unabhaengig vom Zeilen-/Trennzeichen-Format', () => {
  const d = dossierMitQuellen(['Q-001', 'Q-002']);
  const text = 'quellen:\n  - id: Q-001\n    titel: X\n---\nQ-002 | irgendwo mitten im Satz erwaehnt.';
  const r = inhalt.quellenSpiegel(text, d);
  assert.deepStrictEqual(r.fehlend, []);
});

/* Mutationsprobe (im Report festgehalten): den fehlend-Vergleich (die
   .filter-Zeile) im Kopf auskommentiert -> dieser Test muss rot werden. */
test('quellenSpiegel: Q-0158 ist NICHT Q-015 (Wortgrenze, kein Praefix-/Substring-Treffer)', () => {
  const d = dossierMitQuellen(['Q-015']);
  const r = inhalt.quellenSpiegel('Diese Quelle ist Q-0158, nicht dieselbe.', d);
  assert.deepStrictEqual(r.fehlend, ['Q-015']);
});

/* ---------- Ansicht: Schritt 1 und Schritt 2 ---------- */

test('Schritt 1: fehlende Q-ID im geltenden Briefing zeigt den Spiegel-Kasten', () => {
  const d = dossierMitQuellen(['Q-001', 'Q-002']);
  const props = { ordnerFehlt: false, dossier: d, briefing: 'Nur Q-001 ist hier erwaehnt.' };
  const html = ansichten.einSchritt(INHALT, AFL, 1, null, props);
  assert.match(html, /class="box achtung"/);
  assert.match(html, /Quellen-Spiegel/);
  assert.match(html, /Q-002/);
});

test('Schritt 1: vollstaendiger Spiegel zeigt keinen Kasten', () => {
  const d = dossierMitQuellen(['Q-001', 'Q-002']);
  const props = { ordnerFehlt: false, dossier: d, briefing: 'Q-001 und Q-002 sind beide belegt.' };
  const html = ansichten.einSchritt(INHALT, AFL, 1, null, props);
  assert.doesNotMatch(html, /Quellen-Spiegel/);
});

test('Schritt 1: briefing == null (laedt/fehlt noch) zeigt keinen Spiegel-Kasten', () => {
  const d = dossierMitQuellen(['Q-001', 'Q-002']);
  const props1 = { ordnerFehlt: false, dossier: d, briefing: null };
  const props2 = { ordnerFehlt: false, dossier: d, briefing: '' };
  assert.doesNotMatch(ansichten.einSchritt(INHALT, AFL, 1, null, props1), /Quellen-Spiegel/);
  assert.doesNotMatch(ansichten.einSchritt(INHALT, AFL, 1, null, props2), /Quellen-Spiegel/);
});

test('Schritt 2: fehlende Q-ID im geltenden Briefing zeigt den Spiegel-Kasten', () => {
  const d = dossierMitQuellen(['Q-001', 'Q-002'], { status: { briefing: 'final' } });
  const props = { dossier: d, briefing: 'Nur Q-001 ist hier erwaehnt.' };
  const html = ansichten.einSchritt(INHALT, AFL, 2, null, props);
  assert.match(html, /class="box achtung"/);
  assert.match(html, /Quellen-Spiegel/);
  assert.match(html, /Q-002/);
});

test('Schritt 2: vollstaendiger Spiegel zeigt keinen Spiegel-Kasten (Kein-freigegebenes-Briefing-Kasten bleibt unberuehrt)', () => {
  const d = dossierMitQuellen(['Q-001', 'Q-002'], { status: { briefing: 'final' } });
  const props = { dossier: d, briefing: 'Q-001 und Q-002 sind beide belegt.' };
  const html = ansichten.einSchritt(INHALT, AFL, 2, null, props);
  assert.doesNotMatch(html, /Quellen-Spiegel/);
});

test('Schritt 2: kein freigegebenes Briefing (briefing leer) zeigt keinen Spiegel-Kasten, nur den bestehenden', () => {
  const d = dossierMitQuellen(['Q-001', 'Q-002']);
  const props = { dossier: d, briefing: '' };
  const html = ansichten.einSchritt(INHALT, AFL, 2, null, props);
  assert.match(html, /Kein freigegebenes Briefing/);
  assert.doesNotMatch(html, /Quellen-Spiegel/);
});
