'use strict';
/* dossierSpeichern darf nie schreiben, solange das Dossier noch nicht geladen ist —
   sonst faellt dossier.ausWerten auf dossier.neu() zurueck und ein bereits auf
   SharePoint liegendes Dossier verliert beim Sichern quellen/status/offen/entschieden
   (Review-Finding, Fix-Runde 1). Reiner Guard, kein Netz noetig: graph.ablegen wird
   ueberschrieben und darf in keinem der beiden Faelle aufgerufen werden. */
const test = require('node:test');
const assert = require('node:assert');

const { controller, state, graph } = require('../app.js');
require('../dossier.js');
/* dossierSpeichern ruft seit Etappe 1e Task 6 root.inhalt.BRIEFING_FELDER auf
   (die ziel/speicherName-Zuordnung fuer regulatorik) — ohne diesen Require
   waere root.inhalt in diesem Testprozess undefined. */
require('../inhalt.js');

function melde() {
  const el = { hidden: true, textContent: '' };
  global.document = {
    getElementById: function (id) { return id === 'briefing-felder-melde' ? el : null; },
    querySelectorAll: function () { return []; }   /* briefingFelderAusFormular liest hierueber */
  };
  return el;
}

test('fehlender Kursordner — eigene Meldung statt dauerhaftes "wird noch geladen" (M-3)', () => {
  state.position.kursId = 'DBS-001';
  state.data.dossier = {};              /* nie geladen worden, weil dossierNachladen nie anlief */
  state.data.ordner = { 'DBS-001': null };   /* nachgesehen, kein Ordner da */
  const el = melde();
  let abgelegt = false;
  graph.ablegen = function () { abgelegt = true; return Promise.resolve(); };
  const knopf = { disabled: false };

  controller.dossierSpeichern(knopf);

  assert.strictEqual(abgelegt, false, 'graph.ablegen wurde trotz fehlendem Kursordner aufgerufen');
  assert.strictEqual(el.hidden, false);
  assert.match(el.textContent, /Kein Kursordner/);
  assert.doesNotMatch(el.textContent, /noch geladen/, 'die irrefuehrende Ladeanzeige haette hier ewig gestanden');
  delete global.document;
  state.data.ordner = {};
});

test('kein Dossier angefordert (undefined) — dossierSpeichern bricht ab, statt zu ueberschreiben', () => {
  state.position.kursId = 'DBS-001';
  state.data.dossier = {};   /* frisch, kein Eintrag fuer DBS-001 */
  const el = melde();
  let abgelegt = false;
  graph.ablegen = function () { abgelegt = true; return Promise.resolve(); };
  const knopf = { disabled: false };

  controller.dossierSpeichern(knopf);

  assert.strictEqual(abgelegt, false, 'graph.ablegen wurde trotz ungeladenem Dossier aufgerufen');
  assert.strictEqual(state.data.dossier['DBS-001'], undefined, 'ein Platzhalter-Dossier wurde geschrieben');
  assert.strictEqual(el.hidden, false);
  assert.match(el.textContent, /noch geladen/);
  assert.strictEqual(knopf.disabled, false, 'der Knopf wurde gesperrt, obwohl gar nicht gesichert wird');
  delete global.document;
});

test('Dossier laedt noch (null) — dossierSpeichern bricht ebenfalls ab', () => {
  state.position.kursId = 'DBS-001';
  state.data.dossier = { 'DBS-001': null };   /* Ladevorgang laeuft */
  const el = melde();
  let abgelegt = false;
  graph.ablegen = function () { abgelegt = true; return Promise.resolve(); };
  const knopf = { disabled: false };

  controller.dossierSpeichern(knopf);

  assert.strictEqual(abgelegt, false, 'graph.ablegen wurde waehrend der Ladephase aufgerufen');
  assert.strictEqual(state.data.dossier['DBS-001'], null, 'der Ladezustand wurde ueberschrieben');
  assert.match(el.textContent, /noch geladen/);
  delete global.document;
});

test('geladenes Dossier — dossierSpeichern legt ab und bewahrt bestehende Quellen', async () => {
  state.position.kursId = 'DBS-001';
  const bestehend = {
    dossier: 1, kurs: 'DBS-001', stand: null, scope: {}, content_modus: 'quellengestuetzt',
    quellen: [{ id: 'Q-001', titel: 'X', stand: '2026', datei: 'x.pdf' }],
    status: {}, offen: [], entschieden: []
  };
  state.data.dossier = { 'DBS-001': bestehend };
  state.data.dossierETag = {};
  const el = melde();
  let geschrieben = null;
  graph.ablegen = function (kursId, ordner, datei, text) { geschrieben = { kursId, ordner, datei, text }; return Promise.resolve({ eTag: 'W/"1"' }); };
  const knopf = { disabled: false };

  /* Seit Etappe 1e (Task 1) laeuft das Schreiben ueber die Warteschlange
     controller.dossierSchreiben — dieselbe Pruefabsicht (ablegen wird aufgerufen,
     bestehende Quellen bleiben erhalten), aber nicht mehr synchron abgeschlossen:
     der Mutator wird erst im naechsten Mikrotask der Kette angewandt. */
  await controller.dossierSpeichern(knopf);

  assert.ok(geschrieben, 'graph.ablegen wurde nicht aufgerufen, obwohl das Dossier geladen war');
  assert.strictEqual(geschrieben.kursId, 'DBS-001');
  assert.strictEqual(geschrieben.ordner, '');
  assert.strictEqual(geschrieben.datei, 'DBS-001_dossier.json');
  const d = JSON.parse(geschrieben.text);
  assert.strictEqual(d.quellen.length, 1, 'die bestehende Quelle ist beim Sichern verloren gegangen');
  assert.strictEqual(knopf.disabled, true, 'der Knopf wird waehrend des Sicherns nicht gesperrt');
  delete global.document;
});

/* ---------- Etappe 1e, Task 6: regulatorik ---------- */

test('dossierSpeichern schreibt Rechtsstand, SAQ-Haekchen und Zusatz nach regulatorik, nicht nach scope', async () => {
  state.position.kursId = 'DBS-001';
  const bestehend = {
    dossier: 1, kurs: 'DBS-001', stand: null, scope: {}, regulatorik: {},
    content_modus: 'quellengestuetzt', quellen: [], status: {}, offen: [], entschieden: []
  };
  state.data.dossier = { 'DBS-001': bestehend };
  state.data.dossierETag = {};
  let geschrieben = null;
  graph.ablegen = function (kursId, ordner, datei, text) { geschrieben = text; return Promise.resolve({ eTag: 'W/"1"' }); };
  const knopf = { disabled: false };

  const felder = [
    { dataset: { feld: 'zielgruppe' }, value: 'Kundenberater' },
    { dataset: { feld: 'reg_zusatz' }, value: 'Rezertifizierung IK' },
    { dataset: { feld: 'rechtsstand' }, value: '1.1.2026' },
    { dataset: { feld: 'saq_rezert' }, type: 'checkbox', checked: true }
  ];
  global.document = {
    getElementById: function (id) { return id === 'briefing-felder-melde' ? { hidden: true, textContent: '' } : null; },
    querySelectorAll: function (sel) { return sel === '[data-feld]' ? felder : []; }
  };

  await controller.dossierSpeichern(knopf);

  assert.ok(geschrieben, 'graph.ablegen wurde nicht aufgerufen');
  const d = JSON.parse(geschrieben);
  assert.strictEqual(d.scope.zielgruppe, 'Kundenberater', 'ein regulaeres scope-Feld landet nicht mehr in scope');
  assert.strictEqual('reg_zusatz' in d.scope, false, 'reg_zusatz landete faelschlich weiterhin in scope');
  assert.strictEqual(d.regulatorik.zusatz, 'Rezertifizierung IK');
  assert.strictEqual(d.regulatorik.stand, '1.1.2026');
  assert.strictEqual(d.regulatorik.saq_rezert, true);
  delete global.document;
});
