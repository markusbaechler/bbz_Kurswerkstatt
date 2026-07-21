const test = require('node:test');
const assert = require('node:assert');

const { inhalt } = require('../inhalt.js');
const { INHALT } = require('./fixture.js');

function kopie() { return JSON.parse(JSON.stringify(INHALT)); }

test('vollstaendige Inhalte werden nicht beanstandet', () => {
  assert.deepStrictEqual(inhalt.pruefe(INHALT), []);
});

test('fehlende Inhalte werden beanstandet', () => {
  assert.ok(inhalt.pruefe(null).length > 0);
});

test('weniger als 9 Schritte faellt auf', () => {
  const i = kopie();
  i.schritte.schritte.pop();
  assert.ok(inhalt.pruefe(i).some(x => /8 statt 9/.test(x)));
});

test('ein Schritt ohne Zweck faellt auf', () => {
  const i = kopie();
  i.schritte.schritte[2].zweck = '';
  assert.ok(inhalt.pruefe(i).some(x => /Schritt 3: zweck fehlt/.test(x)));
});

test('HF in schritte.json faellt auf — es gehoert in hf.json', () => {
  const i = kopie();
  i.schritte.schritte[0].prim = ['HF8'];
  assert.ok(inhalt.pruefe(i).some(x => /HF gehoert nicht/.test(x)));
});

test('eine unaufloesbare Werkzeug-Referenz faellt auf', () => {
  const i = kopie();
  i.werkzeuge.schrittWerkzeuge['4'].push('gibtsnicht');
  assert.ok(inhalt.pruefe(i).some(x => /unbekanntes Werkzeug gibtsnicht/.test(x)));
});

test('doppelte Werkzeug-IDs fallen auf', () => {
  const i = kopie();
  i.werkzeuge.liste.push(i.werkzeuge.liste[0]);
  assert.ok(inhalt.pruefe(i).some(x => /doppelte IDs/.test(x)));
});

test('ein fehlendes Referenzwerk faellt auf', () => {
  const i = kopie();
  delete i.referenz.didaktik;
  assert.ok(inhalt.pruefe(i).some(x => /didaktik/.test(x)));
});

/* --- Zugriffshelfer --- */

test('schritt() findet ueber Zahl und Zeichenkette', () => {
  assert.strictEqual(inhalt.schritt(INHALT, 4).nm, 'Green-field W-Content');
  assert.strictEqual(inhalt.schritt(INHALT, '4').nm, 'Green-field W-Content');
});

test('schritt() liefert null statt einer Ausnahme', () => {
  assert.strictEqual(inhalt.schritt(INHALT, 99), null);
});

test('werkzeugeVon liefert die Werkzeuge des Schritts', () => {
  const w = inhalt.werkzeugeVon(INHALT, 4).map(x => x.id);
  assert.deepStrictEqual(w, ['guide-4', 'prompt-greenfield']);
});

test('anleitungVon liefert genau die Anleitung', () => {
  assert.strictEqual(inhalt.anleitungVon(INHALT, 4).id, 'guide-4');
});

test('hilfsmittelVon laesst die Anleitung weg', () => {
  const h = inhalt.hilfsmittelVon(INHALT, 4).map(x => x.id);
  assert.deepStrictEqual(h, ['prompt-greenfield']);
});

test('phaseVon ordnet den Schritt seiner Phase zu', () => {
  assert.strictEqual(inhalt.phaseVon(INHALT, 4).nm, 'Inhalt entwerfen');
  assert.strictEqual(inhalt.phaseVon(INHALT, 1).nm, 'Vorbereiten');
  assert.strictEqual(inhalt.phaseVon(INHALT, 9).nm, 'Abnehmen & sichern');
});

/* --- Ablage-Kontrakt --- */

test('ablageVon baut Ordner und Dateiname aus dem Kontrakt', () => {
  const a = inhalt.ablageVon(INHALT, 4, 'DBS-001');
  assert.strictEqual(a.ordner, '04_greenfield');
  assert.strictEqual(a.datei, 'DBS-001_greenfield_v{N}.md');
  assert.strictEqual(a.format, 'text');
  assert.strictEqual(a.gate, null);
});

test('ablageVon kennt feste Dateinamen ohne Version', () => {
  const a = inhalt.ablageVon(INHALT, 2, 'DBS-001');
  assert.strictEqual(a.datei, 'DBS-001_manifest.json');
});

test('ablageVon gibt das Gate mit aus', () => {
  assert.strictEqual(inhalt.ablageVon(INHALT, 3, 'DBS-001').gate, 'Gate 1 · 4-Augen');
  assert.strictEqual(inhalt.ablageVon(INHALT, 6, 'DBS-001').gate, 'Sign-off');
});

test('Schritt 5 und 6 schreiben in dieselbe Datei', () => {
  const a5 = inhalt.ablageVon(INHALT, 5, 'DBS-001');
  const a6 = inhalt.ablageVon(INHALT, 6, 'DBS-001');
  assert.strictEqual(a5.ordner, a6.ordner);
  assert.strictEqual(a5.datei, a6.datei);
});

test('ablageVon liefert die zulaessigen Wege', () => {
  assert.deepStrictEqual(inhalt.ablageVon(INHALT, 7, 'DBS-001').wege, ['C']);
  assert.deepStrictEqual(inhalt.ablageVon(INHALT, 3, 'DBS-001').wege, ['C', 'hand']);
});

/* --- Laden --- */

test('laden meldet fehlende Pflichtdateien beim Namen', async () => {
  const graphMock = { zentralLaden: () => Promise.resolve({ schritte: INHALT.schritte }) };
  await assert.rejects(() => inhalt.laden(graphMock), /fehlen: ablage-kontrakt, werkzeuge, referenz/);
});

test('laden verzeiht ein fehlendes hf.json — es ist abkoppelbar', async () => {
  const ohneHf = kopie();
  delete ohneHf.hf;
  const graphMock = { zentralLaden: () => Promise.resolve(ohneHf) };
  const r = await inhalt.laden(graphMock);
  assert.strictEqual(r.hf, undefined);
  assert.strictEqual(r.schritte.schritte.length, 9);
});

test('laden bricht bei inhaltlich kaputten Dateien ab', async () => {
  const kaputt = kopie();
  kaputt.schritte.schritte = [];
  const graphMock = { zentralLaden: () => Promise.resolve(kaputt) };
  await assert.rejects(() => inhalt.laden(graphMock), /unvollstaendig/);
});
