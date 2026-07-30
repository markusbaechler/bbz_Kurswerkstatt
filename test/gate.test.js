'use strict';
/* Gate-Box-Controller (Etappe 2, Task 5): offen[]/entschieden[] sitzen im Dossier
   (Meta-Spec §3.2, Entscheid Markus 2026-07-30) — offenErfassen haengt einen Punkt an
   ein Gate oder einen Schritt, offenEntscheiden/offenVerschieben setzen ihn um. Alle
   drei schreiben ueber controller.dossierSchreiben (dieselbe Warteschlange wie
   quelleErfassen/quelleEntfernen). Kein Netz noetig: graph.ablegen wird ueberschrieben.

   Identitaets-Guard (Pflicht laut Task-Brief): der Index eines offenen Punkts kann sich
   zwischen Render und Ausfuehrung der Warteschlange verschoben haben (ein anderer Klick,
   ein 412-Retry). offenEntscheiden/offenVerschieben vergleichen deshalb das am Knopf
   mitgegebene data-was mit d.offen[index].was VOR dem eigentlichen Schreiben — stimmt es
   nicht mehr, bricht der Mutator mit null ab (kein PUT), statt am falschen Eintrag zu
   aendern. */
const test = require('node:test');
const assert = require('node:assert');

const { controller, state, graph } = require('../app.js');
require('../dossier.js');
require('../inhalt.js');
const { INHALT } = require('./fixture.js');

function dossierMit(offen) {
  return { dossier: 1, kurs: 'DBS-001', scope: {}, regulatorik: {}, content_modus: 'quellengestuetzt',
    quellen: [], status: {}, offen: offen || [], entschieden: [] };
}

function setzeKurs() {
  state.data.kurse = [{ id: '1', kursId: 'DBS-001', kurstitel: 'Derivate Basis',
    kompetenzfeld: 'Vermögen & Vorsorge', schritt: 2, status: 'inArbeit', prio: null, bemerkung: '' }];
  state.position.kursId = 'DBS-001';
}

function els(werte) {
  const melde = { hidden: true, textContent: '' };
  const felder = Object.assign({ 'offen-melde': melde }, werte || {});
  global.document = {
    getElementById: function (id) { return felder[id] || null; },
    querySelectorAll: function () { return []; }
  };
  return melde;
}

/* ---------- gateKlick (Etappe 2, Task 6): _final, _gate.md, Dossier-Status final ----------
   Schritt 2 des Fixture-Kontrakts fuehrt ein echtes Gate (Gate 1 · 4-Augen, Ordner
   02_lernziele, Lieferobjekt lernziele-drehbuch, Endung xlsx) — genau der Fall, den
   inhalt.gateAdressat(2) auf 'gate-1' abbildet. setzeKursMitInhalt() ergaenzt setzeKurs()
   um ein geladenes state.data.inhalt, das gateKlick fuer ablageVon/gateAdressat/
   geltendeDatei/finalName braucht — die Gate-Box-Tests oben brauchten das nie, weil
   offenErfassen & Co. nie in den Ablage-Kontrakt schauen. */

function setzeKursMitInhalt() {
  setzeKurs();
  state.data.inhalt = JSON.parse(JSON.stringify(INHALT));
  state.data.dateien = {};
}

function elsGate(werte) {
  const melde = { hidden: true, textContent: '' };
  const felder = Object.assign({ 'gate-melde': melde }, werte || {});
  global.document = {
    getElementById: function (id) { return felder[id] || null; },
    querySelectorAll: function () { return []; }
  };
  return melde;
}

test('gateKlick ohne geladenes Dossier bricht ab, kein Netzzugriff', () => {
  setzeKursMitInhalt();
  state.data.dossier = {};
  state.fehlerHinweis = null;
  const melde = elsGate({});
  let gerufen = false;
  graph.ordnerInhalt = function () { gerufen = true; return Promise.resolve([]); };

  controller.gateKlick('2', { disabled: false });

  assert.strictEqual(gerufen, false, 'trotz ungeladenem Dossier wurde der Ordner gelesen');
  assert.match(melde.textContent, /nicht geladen/);
  assert.match(state.fehlerHinweis || '', /nicht geladen/);
  delete global.document;
});

test('gateKlick mit einem offenen Punkt an diesem Gate blockiert ohne jeden Graph-Aufruf (S2)', () => {
  setzeKursMitInhalt();
  state.data.dossier = { 'DBS-001': dossierMit([{ was: 'Bloom-Stufe pruefen', wo: 'LZ-004', fuer: 'gate-1' }]) };
  state.fehlerHinweis = null;
  const melde = elsGate({ 'gate-zweitpruefung': { value: 'N. N.' } });
  let gerufen = false;
  graph.ordnerInhalt = function () { gerufen = true; return Promise.resolve([]); };

  controller.gateKlick('2', { disabled: false });

  assert.strictEqual(gerufen, false, 'trotz offenem Punkt wurde der Ordner gelesen');
  assert.match(melde.textContent, /Offene Punkte/);
  assert.match(state.fehlerHinweis || '', /Offene Punkte/);
  delete global.document;
});

test('gateKlick ohne Zweitpruefung blockiert, kein Graph-Aufruf (Gate 1 ist 4-Augen)', () => {
  setzeKursMitInhalt();
  state.data.dossier = { 'DBS-001': dossierMit([]) };
  const melde = elsGate({ 'gate-zweitpruefung': { value: '' } });
  let gerufen = false;
  graph.ordnerInhalt = function () { gerufen = true; return Promise.resolve([]); };

  controller.gateKlick('2', { disabled: false });

  assert.strictEqual(gerufen, false, 'trotz fehlender Zweitpruefung wurde der Ordner gelesen');
  assert.match(melde.textContent, /Zweitpr.fung fehlt/);
  delete global.document;
});

test('voller Durchlauf: umbenennen -> Protokoll ablegen -> Dossier-Status final, genau in dieser Reihenfolge', async () => {
  setzeKursMitInhalt();
  state.data.dossier = { 'DBS-001': dossierMit([]) };
  state.data.dossierETag = {};
  state.hinweis = null;
  state.fehlerHinweis = null;
  elsGate({ 'gate-zweitpruefung': { value: 'N. N.' }, 'gate-geprueft': { value: '9 Lernziele' } });
  controller._bestaetige = function () { return true; };

  const rufe = [];
  graph.ordnerInhalt = function () {
    return Promise.resolve([{ name: 'DBS-001_lernziele-drehbuch_v3.xlsx' }]);
  };
  graph.umbenennen = function (kursId, ordner, von, nach) {
    rufe.push({ art: 'umbenennen', kursId: kursId, ordner: ordner, von: von, nach: nach });
    return Promise.resolve(nach);
  };
  graph.ablegen = function (kursId, ordner, datei, text) {
    rufe.push({ art: 'ablegen', kursId: kursId, ordner: ordner, datei: datei, text: text });
    return Promise.resolve({ eTag: 'W/"1"' });
  };

  await controller.gateKlick('2', { disabled: false });

  assert.strictEqual(rufe.length, 3, 'erwartet: umbenennen, Protokoll ablegen, Dossier ablegen — ' + JSON.stringify(rufe));
  assert.strictEqual(rufe[0].art, 'umbenennen');
  assert.strictEqual(rufe[0].ordner, '02_lernziele');
  assert.strictEqual(rufe[0].von, 'DBS-001_lernziele-drehbuch_v3.xlsx');
  assert.strictEqual(rufe[0].nach, 'DBS-001_lernziele-drehbuch_final.xlsx');
  assert.strictEqual(rufe[1].art, 'ablegen');
  assert.strictEqual(rufe[1].ordner, '02_lernziele');
  assert.strictEqual(rufe[1].datei, '_gate.md');
  assert.match(rufe[1].text, /^# Gate 1 · 4-Augen — DBS-001/);
  assert.match(rufe[1].text, /Freigegeben:  DBS-001_lernziele-drehbuch_v3\.xlsx/);
  assert.match(rufe[1].text, /Umbenannt in: DBS-001_lernziele-drehbuch_final\.xlsx/);
  assert.strictEqual(rufe[2].art, 'ablegen');
  assert.strictEqual(rufe[2].ordner, '', 'der Dossier-Schreiber legt in der Kursordner-Wurzel ab');
  const dossierGeschrieben = JSON.parse(rufe[2].text);
  assert.strictEqual(dossierGeschrieben.status['lernziele-drehbuch'], 'final');
  assert.strictEqual(state.data.dossier['DBS-001'].status['lernziele-drehbuch'], 'final',
    'der State wurde nach dem Schreiben nicht aktualisiert');
  assert.match(state.hinweis || '', /Gate durchlaufen/);
  delete global.document;
});

test('bricht die Person die Bestaetigung ab, wird nichts geschrieben und keine Erfolgsmeldung gezeigt', async () => {
  setzeKursMitInhalt();
  state.data.dossier = { 'DBS-001': dossierMit([]) };
  state.data.dossierETag = {};
  state.hinweis = null;
  elsGate({ 'gate-zweitpruefung': { value: 'N. N.' } });
  controller._bestaetige = function () { return false; };
  let geschrieben = false;
  graph.ordnerInhalt = function () {
    return Promise.resolve([{ name: 'DBS-001_lernziele-drehbuch_v3.xlsx' }]);
  };
  graph.umbenennen = function () { geschrieben = true; return Promise.resolve(); };
  graph.ablegen = function () { geschrieben = true; return Promise.resolve({ eTag: 'W/"1"' }); };

  await controller.gateKlick('2', { disabled: false });

  assert.strictEqual(geschrieben, false, 'trotz abgebrochener Bestaetigung wurde geschrieben');
  assert.strictEqual(state.hinweis, null, 'trotz Abbruch wurde eine Erfolgsmeldung gesetzt');
  controller._bestaetige = function () { return true; };
  delete global.document;
});

/* ---------- Idempotenz: Wiedereinstieg nach einem Teilfehler doppelt nichts ---------- */

test('Wiedereinstieg (a): _final liegt schon, das Protokoll fehlt -> Umbenennung entfaellt, Protokoll und Status werden nachgezogen', async () => {
  setzeKursMitInhalt();
  state.data.dossier = { 'DBS-001': dossierMit([]) };
  state.data.dossierETag = {};
  state.hinweis = null;
  elsGate({ 'gate-zweitpruefung': { value: 'N. N.' } });
  let umbenannt = false;
  const rufe = [];
  graph.ordnerInhalt = function () {
    return Promise.resolve([{ name: 'DBS-001_lernziele-drehbuch_final.xlsx' }]);
  };
  graph.umbenennen = function () { umbenannt = true; return Promise.resolve(); };
  graph.ablegen = function (kursId, ordner, datei, text) {
    rufe.push({ ordner: ordner, datei: datei, text: text });
    return Promise.resolve({ eTag: 'W/"1"' });
  };

  await controller.gateKlick('2', { disabled: false });

  assert.strictEqual(umbenannt, false, 'bei bereits vorhandener _final haette nicht umbenannt werden duerfen');
  assert.strictEqual(rufe.length, 2, 'Protokoll und Dossier-Status — ' + JSON.stringify(rufe));
  assert.strictEqual(rufe[0].ordner, '02_lernziele');
  assert.strictEqual(rufe[0].datei, '_gate.md');
  assert.match(rufe[0].text, /Freigegeben:  unbekannt \(Wiedereinstieg\)/,
    'der von-Name ist ohne die _vN-Datei nicht mehr rekonstruierbar');
  assert.match(rufe[0].text, /Umbenannt in: DBS-001_lernziele-drehbuch_final\.xlsx/);
  assert.strictEqual(rufe[1].ordner, '');
  const dossierGeschrieben = JSON.parse(rufe[1].text);
  assert.strictEqual(dossierGeschrieben.status['lernziele-drehbuch'], 'final');
  delete global.document;
});

test('Wiedereinstieg (b): _final UND Protokoll liegen schon -> nur noch der Dossier-Status', async () => {
  setzeKursMitInhalt();
  state.data.dossier = { 'DBS-001': dossierMit([]) };
  state.data.dossierETag = {};
  state.hinweis = null;
  elsGate({ 'gate-zweitpruefung': { value: 'N. N.' } });
  let umbenannt = false;
  const rufe = [];
  graph.ordnerInhalt = function () {
    return Promise.resolve([
      { name: 'DBS-001_lernziele-drehbuch_final.xlsx' },
      { name: '_gate.md' }
    ]);
  };
  graph.umbenennen = function () { umbenannt = true; return Promise.resolve(); };
  graph.ablegen = function (kursId, ordner, datei, text) {
    rufe.push({ ordner: ordner, datei: datei, text: text });
    return Promise.resolve({ eTag: 'W/"1"' });
  };

  await controller.gateKlick('2', { disabled: false });

  assert.strictEqual(umbenannt, false);
  assert.strictEqual(rufe.length, 1, 'es haette nur noch der Dossier-Status geschrieben werden duerfen — ' + JSON.stringify(rufe));
  assert.strictEqual(rufe[0].ordner, '', 'das einzige Schreiben muss der Dossier-Schreiber sein, kein zweites Protokoll');
  const dossierGeschrieben = JSON.parse(rufe[0].text);
  assert.strictEqual(dossierGeschrieben.status['lernziele-drehbuch'], 'final');
  delete global.document;
});

/* ---------- offenErfassen ---------- */

test('offenErfassen ohne geladenes Dossier bricht ab, kein PUT (Guard wie quelleErfassen/dossierSpeichern)', () => {
  setzeKurs();
  state.data.dossier = {};
  state.hinweis = null;
  state.fehlerHinweis = null;
  const melde = els({ 'offen-was': { value: 'X' }, 'offen-wo': { value: 'LZ-001' }, 'offen-fuer': { value: 'gate-1' } });
  let geschrieben = false;
  graph.ablegen = function () { geschrieben = true; return Promise.resolve({ eTag: 'W/"1"' }); };

  controller.offenErfassen({ dataset: {} });

  assert.strictEqual(geschrieben, false, 'graph.ablegen wurde trotz ungeladenem Dossier aufgerufen');
  assert.strictEqual(melde.hidden, false);
  assert.match(melde.textContent, /noch nicht geladen/);
  delete global.document;
});

test('offenErfassen schreibt einen neuen Punkt durch die Warteschlange', async () => {
  setzeKurs();
  state.data.dossier = { 'DBS-001': dossierMit([]) };
  state.data.dossierETag = {};
  state.hinweis = null;
  state.fehlerHinweis = null;
  els({ 'offen-was': { value: 'Bloom-Stufe pruefen' }, 'offen-wo': { value: 'LZ-004' },
        'offen-fuer': { value: 'gate-1' } });
  let abgelegtMit = null;
  graph.ablegen = function (kursId, ordner, datei, text) {
    abgelegtMit = { kursId, ordner, datei, text };
    return Promise.resolve({ eTag: 'W/"1"' });
  };

  await controller.offenErfassen({ dataset: {} });

  assert.ok(abgelegtMit, 'graph.ablegen (ueber dossierSchreiben) wurde nicht aufgerufen');
  const d = JSON.parse(abgelegtMit.text);
  assert.strictEqual(d.offen.length, 1);
  assert.deepStrictEqual(d.offen[0], { was: 'Bloom-Stufe pruefen', wo: 'LZ-004', fuer: 'gate-1' });
  assert.strictEqual(state.data.dossier['DBS-001'].offen.length, 1,
    'der State wurde nach dem Schreiben nicht aktualisiert');
  assert.match(state.hinweis || '', /erfasst/);
  delete global.document;
});

test('offenErfassen ohne "was" (S1-Verstoss aus dossier.offenNeu) meldet in state.fehlerHinweis, kein PUT', async () => {
  setzeKurs();
  state.data.dossier = { 'DBS-001': dossierMit([]) };
  state.data.dossierETag = {};
  state.fehlerHinweis = null;
  const melde = els({ 'offen-was': { value: '' }, 'offen-wo': { value: 'LZ-004' },
        'offen-fuer': { value: 'gate-1' } });
  let geschrieben = false;
  graph.ablegen = function () { geschrieben = true; return Promise.resolve({ eTag: 'W/"1"' }); };

  await controller.offenErfassen({ dataset: {} });

  assert.strictEqual(geschrieben, false, 'graph.ablegen wurde trotz fehlendem "was" aufgerufen');
  assert.strictEqual(melde.hidden, false);
  assert.match(melde.textContent, /was fehlt/);
  assert.match(state.fehlerHinweis || '', /was fehlt/,
    'der S1-Fehler aus dossier.offenNeu landet nicht in state.fehlerHinweis');
  delete global.document;
});

/* ---------- offenEntscheiden ---------- */

test('offenEntscheiden ohne geladenes Dossier bricht ab, kein PUT', () => {
  setzeKurs();
  state.data.dossier = {};
  state.fehlerHinweis = null;
  const melde = els({});
  let geschrieben = false;
  graph.ablegen = function () { geschrieben = true; return Promise.resolve({ eTag: 'W/"1"' }); };

  controller.offenEntscheiden({ dataset: { index: '0', was: 'X' } });

  assert.strictEqual(geschrieben, false);
  assert.match(melde.textContent, /noch nicht geladen/);
  delete global.document;
});

test('offenEntscheiden setzt wer/wann, verschiebt den Punkt nach entschieden[]', async () => {
  setzeKurs();
  state.data.dossier = { 'DBS-001': dossierMit([{ was: 'Bloom-Stufe pruefen', wo: 'LZ-004', fuer: 'gate-1' }]) };
  state.data.dossierETag = {};
  state.hinweis = null;
  state.fehlerHinweis = null;
  els({ 'offen-wer-0': { value: 'Markus' }, 'offen-wann-0': { value: '2026-07-30' } });
  let abgelegtMit = null;
  graph.ablegen = function (kursId, ordner, datei, text) {
    abgelegtMit = { kursId, ordner, datei, text };
    return Promise.resolve({ eTag: 'W/"1"' });
  };

  await controller.offenEntscheiden({ dataset: { index: '0', was: 'Bloom-Stufe pruefen' } });

  assert.ok(abgelegtMit, 'graph.ablegen wurde nicht aufgerufen');
  const d = JSON.parse(abgelegtMit.text);
  assert.strictEqual(d.offen.length, 0);
  assert.strictEqual(d.entschieden.length, 1);
  assert.deepStrictEqual(d.entschieden[0],
    { was: 'Bloom-Stufe pruefen', wo: 'LZ-004', wer: 'Markus', wann: '2026-07-30' });
  assert.match(state.hinweis || '', /Entschieden/);
  delete global.document;
});

/* ---------- Identitaets-Guard: Mutationsprobe-Anker ----------
   Diese beiden Tests sind der Beweis, dass der Guard wirklich schreibt: ohne ihn
   (Zeile "if (!eintrag || eintrag.was !== wasErwartet) return null;" entfernt oder
   auskommentiert) veraendert offenEntscheiden/offenVerschieben den FALSCHEN Eintrag,
   statt abzubrechen — beide Tests werden dann rot. Kommando + Beleg im Report. */

test('offenEntscheiden mit verschobenem Index (Identitaet stimmt nicht mehr) bricht OHNE Schreiben ab', async () => {
  setzeKurs();
  /* Zwischen Render und Klick hat sich die Liste veraendert: an Index 0 steht jetzt
     ein ANDERER Punkt als der, den die Person im Formular sah (data-was). */
  state.data.dossier = { 'DBS-001': dossierMit([
    { was: 'Anderer Punkt (zwischenzeitlich verschoben)', wo: 'LZ-009', fuer: 'gate-1' }
  ]) };
  state.data.dossierETag = {};
  state.hinweis = null;
  state.fehlerHinweis = null;
  els({ 'offen-wer-0': { value: 'Markus' }, 'offen-wann-0': { value: '2026-07-30' } });
  let geschrieben = false;
  graph.ablegen = function () { geschrieben = true; return Promise.resolve({ eTag: 'W/"1"' }); };

  await controller.offenEntscheiden({ dataset: { index: '0', was: 'Bloom-Stufe pruefen' } });

  assert.strictEqual(geschrieben, false, 'trotz veraltetem Index wurde geschrieben — der Identitaets-Guard fehlt');
  assert.strictEqual(state.data.dossier['DBS-001'].offen.length, 1,
    'der falsche Eintrag wurde trotzdem veraendert');
  assert.strictEqual(state.data.dossier['DBS-001'].offen[0].was, 'Anderer Punkt (zwischenzeitlich verschoben)');
  assert.match(state.fehlerHinweis || '', /Liste hat sich ge.ndert/);
  delete global.document;
});

test('offenVerschieben mit verschobenem Index bricht OHNE Schreiben ab', async () => {
  setzeKurs();
  state.data.dossier = { 'DBS-001': dossierMit([
    { was: 'Anderer Punkt (zwischenzeitlich verschoben)', wo: 'LZ-009', fuer: 'gate-1' }
  ]) };
  state.data.dossierETag = {};
  state.hinweis = null;
  state.fehlerHinweis = null;
  els({ 'offen-ziel-0': { value: 'schritt-3' }, 'offen-begruendung-0': { value: 'gehoert zu Schritt 3' } });
  let geschrieben = false;
  graph.ablegen = function () { geschrieben = true; return Promise.resolve({ eTag: 'W/"1"' }); };

  await controller.offenVerschieben({ dataset: { index: '0', was: 'Bloom-Stufe pruefen' } });

  assert.strictEqual(geschrieben, false, 'trotz veraltetem Index wurde geschrieben — der Identitaets-Guard fehlt');
  assert.strictEqual(state.data.dossier['DBS-001'].offen[0].fuer, 'gate-1',
    'der falsche Eintrag wurde trotzdem verschoben');
  assert.match(state.fehlerHinweis || '', /Liste hat sich ge.ndert/);
  delete global.document;
});

/* ---------- offenVerschieben (Erfolgsfall) ---------- */

test('offenVerschieben setzt neues Ziel und Begruendung am richtigen Eintrag', async () => {
  setzeKurs();
  state.data.dossier = { 'DBS-001': dossierMit([{ was: 'Bloom-Stufe pruefen', wo: 'LZ-004', fuer: 'gate-1' }]) };
  state.data.dossierETag = {};
  state.hinweis = null;
  state.fehlerHinweis = null;
  els({ 'offen-ziel-0': { value: 'schritt-3' }, 'offen-begruendung-0': { value: 'gehoert zu Schritt 3' } });
  let abgelegtMit = null;
  graph.ablegen = function (kursId, ordner, datei, text) {
    abgelegtMit = { kursId, ordner, datei, text };
    return Promise.resolve({ eTag: 'W/"1"' });
  };

  await controller.offenVerschieben({ dataset: { index: '0', was: 'Bloom-Stufe pruefen' } });

  assert.ok(abgelegtMit, 'graph.ablegen wurde nicht aufgerufen');
  const d = JSON.parse(abgelegtMit.text);
  assert.strictEqual(d.offen.length, 1);
  assert.strictEqual(d.offen[0].fuer, 'schritt-3');
  assert.strictEqual(d.offen[0].begruendung, 'gehoert zu Schritt 3');
  assert.match(state.hinweis || '', /Verschoben/);
  delete global.document;
});
