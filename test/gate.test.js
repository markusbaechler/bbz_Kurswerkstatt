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
