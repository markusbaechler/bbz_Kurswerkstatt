'use strict';
/* Datei ablegen und Dossier-Eintrag sind EIN Vorgang (Spec §5.6) — quelleErfassen
   darf kein Hochladen anstossen, solange Feld oder Datei fehlen, und muss nach dem
   Hochladen den Dossier-Eintrag mit derselben Quelle ablegen. Kein Netz noetig:
   graph.hochladen/graph.ablegen werden ueberschrieben. */
const test = require('node:test');
const assert = require('node:assert');

const { controller, state, graph } = require('../app.js');
require('../dossier.js');

function els(werte) {
  const melde = { hidden: true, textContent: '' };
  const felder = {
    'quelle-melde': melde,
    'quelle-titel': { value: (werte && werte.titel) || '' },
    'quelle-herausgeber': { value: (werte && werte.herausgeber) || '' },
    'quelle-stand': { value: (werte && werte.stand) || '' },
    'quelle-datei': { files: (werte && werte.datei) ? [werte.datei] : [] }
  };
  global.document = {
    getElementById: function (id) { return felder[id] || null; },
    querySelectorAll: function () { return []; }
  };
  return melde;
}

test('quelleErfassen ohne Dossier bricht ab, statt zu ueberschreiben', () => {
  state.position.kursId = 'DBS-001';
  state.data.dossier = {};
  const melde = els({ titel: 'X', stand: '2026', datei: { name: 'x.pdf' } });
  let hochgeladen = false;
  graph.hochladen = function () { hochgeladen = true; return Promise.resolve(); };
  const knopf = { disabled: false };

  controller.quelleErfassen(knopf);

  assert.strictEqual(hochgeladen, false, 'graph.hochladen wurde trotz ungeladenem Dossier aufgerufen');
  assert.strictEqual(melde.hidden, false);
  assert.match(melde.textContent, /noch nicht geladen/);
  delete global.document;
});

test('fehlender Kursordner — eigene Meldung statt "Dossier noch nicht geladen" (M-3)', () => {
  state.position.kursId = 'DBS-001';
  state.data.dossier = {};
  state.data.ordner = { 'DBS-001': null };   /* nachgesehen, kein Ordner da */
  const melde = els({ titel: 'X', stand: '2026', datei: { name: 'x.pdf' } });
  let hochgeladen = false;
  graph.hochladen = function () { hochgeladen = true; return Promise.resolve(); };
  const knopf = { disabled: false };

  controller.quelleErfassen(knopf);

  assert.strictEqual(hochgeladen, false, 'graph.hochladen wurde trotz fehlendem Kursordner aufgerufen');
  assert.strictEqual(melde.hidden, false);
  assert.match(melde.textContent, /Kein Kursordner/);
  delete global.document;
  state.data.ordner = {};
});

test('ohne gewaehlte Datei kommt eine Meldung, kein Upload', () => {
  state.position.kursId = 'DBS-001';
  state.data.dossier = { 'DBS-001': { dossier: 1, kurs: 'DBS-001', scope: {}, content_modus: 'quellengestuetzt',
    quellen: [], status: {}, offen: [], entschieden: [] } };
  const melde = els({ titel: 'X', stand: '2026' });   /* keine Datei */
  let hochgeladen = false;
  graph.hochladen = function () { hochgeladen = true; return Promise.resolve(); };
  const knopf = { disabled: false };

  controller.quelleErfassen(knopf);

  assert.strictEqual(hochgeladen, false, 'graph.hochladen wurde ohne Datei aufgerufen');
  assert.strictEqual(melde.hidden, false);
  assert.match(melde.textContent, /Datei w.hlen/);
  delete global.document;
});

test('unvollstaendige Felder erzeugen die Fehlermeldung aus quelleNeu, kein Upload', () => {
  state.position.kursId = 'DBS-001';
  state.data.dossier = { 'DBS-001': { dossier: 1, kurs: 'DBS-001', scope: {}, content_modus: 'quellengestuetzt',
    quellen: [], status: {}, offen: [], entschieden: [] } };
  const melde = els({ datei: { name: 'sspa.pdf' } });   /* Titel und Stand fehlen */
  let hochgeladen = false;
  graph.hochladen = function () { hochgeladen = true; return Promise.resolve(); };
  const knopf = { disabled: false };

  controller.quelleErfassen(knopf);

  assert.strictEqual(hochgeladen, false, 'graph.hochladen wurde trotz unvollstaendiger Felder aufgerufen');
  assert.strictEqual(melde.hidden, false);
  assert.match(melde.textContent, /unvollständig/);
  assert.strictEqual(knopf.disabled, false, 'der Knopf wurde gesperrt, obwohl gar nicht hochgeladen wird');
  delete global.document;
});

test('mit Datei und Feldern: Upload nach 03_content/quellen mit bereinigtem Namen, danach Dossier-Ablage mit Q-001', async () => {
  state.position.kursId = 'DBS-001';
  state.data.dossier = { 'DBS-001': { dossier: 1, kurs: 'DBS-001', scope: {}, content_modus: 'quellengestuetzt',
    quellen: [], status: {}, offen: [], entschieden: [] } };
  const melde = els({ titel: 'SSPA Map', herausgeber: 'SSPA', stand: '2025', datei: { name: 'SSPA Map (Ünterstrich).PDF' } });
  let hochgeladenMit = null;
  let abgelegtMit = null;
  graph.hochladen = function (kursId, ordner, name, datei) {
    hochgeladenMit = { kursId, ordner, name, datei };
    return Promise.resolve();
  };
  graph.ablegen = function (kursId, ordner, datei, text) {
    abgelegtMit = { kursId, ordner, datei, text };
    return Promise.resolve();
  };
  const knopf = { disabled: false };

  await controller.quelleErfassen(knopf);

  assert.ok(hochgeladenMit, 'graph.hochladen wurde nicht aufgerufen');
  assert.strictEqual(hochgeladenMit.kursId, 'DBS-001');
  assert.strictEqual(hochgeladenMit.ordner, '03_content/quellen');
  assert.strictEqual(hochgeladenMit.name, 'sspa-map-uenterstrich.pdf', 'der Dateiname wurde nicht bereinigt');

  assert.ok(abgelegtMit, 'graph.ablegen wurde nicht aufgerufen');
  assert.strictEqual(abgelegtMit.kursId, 'DBS-001');
  assert.strictEqual(abgelegtMit.ordner, '');
  assert.strictEqual(abgelegtMit.datei, 'DBS-001_dossier.json');
  const d = JSON.parse(abgelegtMit.text);
  assert.strictEqual(d.quellen.length, 1);
  assert.strictEqual(d.quellen[0].id, 'Q-001');
  assert.strictEqual(d.quellen[0].datei, 'sspa-map-uenterstrich.pdf');
  assert.strictEqual(state.data.dossier['DBS-001'].quellen.length, 1, 'der Zustand wurde nach dem Ablegen nicht aktualisiert');
  delete global.document;
});

/* ---------- contentModus ---------- */

test('contentModus ohne geladenes Dossier tut nichts', () => {
  state.position.kursId = 'DBS-001';
  state.data.dossier = {};
  let abgelegt = false;
  graph.ablegen = function () { abgelegt = true; return Promise.resolve(); };

  controller.contentModus({ value: 'quellenfrei' });

  assert.strictEqual(abgelegt, false, 'graph.ablegen wurde trotz ungeladenem Dossier aufgerufen');
});

test('contentModus legt den gewaehlten Modus ab', async () => {
  state.position.kursId = 'DBS-001';
  state.data.dossier = { 'DBS-001': { dossier: 1, kurs: 'DBS-001', scope: {}, content_modus: 'quellengestuetzt',
    quellen: [], status: {}, offen: [], entschieden: [] } };
  let abgelegtMit = null;
  graph.ablegen = function (kursId, ordner, datei, text) {
    abgelegtMit = { kursId, ordner, datei, text };
    return Promise.resolve();
  };

  await controller.contentModus({ value: 'quellenfrei' });

  assert.ok(abgelegtMit, 'graph.ablegen wurde nicht aufgerufen');
  const d = JSON.parse(abgelegtMit.text);
  assert.strictEqual(d.content_modus, 'quellenfrei');
  assert.strictEqual(state.data.dossier['DBS-001'].content_modus, 'quellenfrei');
});

test('contentModus faengt einen Fehler beim PUT ab: Meldung statt unhandled rejection, State bleibt beim alten Modus, Radio wird neu gezeichnet (M-2)', async () => {
  state.position.kursId = 'DBS-001';
  state.data.dossier = { 'DBS-001': { dossier: 1, kurs: 'DBS-001', scope: {}, content_modus: 'quellengestuetzt',
    quellen: [], status: {}, offen: [], entschieden: [] } };
  const melde = { hidden: true, textContent: '' };
  global.document = {
    getElementById: function (id) { return id === 'quelle-melde' ? melde : null; },
    querySelectorAll: function () { return []; }
  };
  graph.ablegen = function () { return Promise.reject(new Error('Graph 500')); };
  let gerendert = false;
  const echtesRender = controller.render;
  controller.render = function () { gerendert = true; };

  await controller.contentModus({ value: 'quellenfrei' });

  assert.strictEqual(state.data.dossier['DBS-001'].content_modus, 'quellengestuetzt',
    'der State wurde trotz fehlgeschlagenem PUT auf den neuen Modus gesetzt');
  assert.strictEqual(melde.hidden, false);
  assert.match(melde.textContent, /Graph 500/);
  assert.ok(gerendert, 'controller.render() wurde im catch nicht aufgerufen — das Radio bliebe auf dem falschen Wert stehen');

  controller.render = echtesRender;
  delete global.document;
});
