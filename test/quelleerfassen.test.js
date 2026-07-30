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
    'quelle-datei': { files: (werte && werte.datei) ? [werte.datei] : [] },
    'quelle-url': { value: (werte && werte.url) || '' }
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

/* ---------- I10 (Etappe 1e Task 4): Waisen-Datei nach gelungenem Upload benennen ----------
   Scheitert NACH einem erfolgreichen Upload nur noch der Dossier-Eintrag (graph.ablegen
   schlaegt fehl), liegt die Datei bereits in 03_content/quellen, ohne dass das Dossier von
   ihr weiss. Die Meldung muss den Dateinamen nennen und sagen, dass ein erneutes
   "Quelle erfassen" mit derselben Datei gefahrlos ist (graph.hochladen legt unter demselben,
   bereinigten Namen ab und ueberschreibt — kein Duplikat, keine zweite Waise).

   Fix-Runde 1, Review-Finding 2: die lokale sag()-Meldung schreibt in den beim Klick
   eingefangenen #quelle-melde-Knoten — ein Zwischen-Render (z. B. ein spaeter eintreffendes
   dossierNachladen/briefingNachladen aus derselben Ansicht) haengt diesen Knoten aus, die
   Waisen-Datei-Meldung erreicht dann niemanden mehr. Seither traegt zusaetzlich
   state.fehlerHinweis dieselbe Meldung — der lebt im State, nicht im DOM-Knoten, und
   ueberlebt damit jeden Zwischen-Render. */
test('Upload gelingt, Dossier-Ablage scheitert danach: die Meldung nennt die Datei und sagt, ein erneuter Versuch sei sicher (I10)', async () => {
  state.position.kursId = 'DBS-001';
  state.data.dossier = { 'DBS-001': { dossier: 1, kurs: 'DBS-001', scope: {}, content_modus: 'quellengestuetzt',
    quellen: [], status: {}, offen: [], entschieden: [] } };
  state.hinweis = null;
  state.fehlerHinweis = null;
  const melde = els({ titel: 'SSPA Map', herausgeber: 'SSPA', stand: '2025', datei: { name: 'SSPA Map.pdf' } });
  let hochgeladen = false;
  graph.hochladen = function () { hochgeladen = true; return Promise.resolve(); };
  graph.ablegen = function () { return Promise.reject(new Error('Graph 500')); };
  const knopf = { disabled: false };

  await controller.quelleErfassen(knopf);

  assert.strictEqual(hochgeladen, true, 'der Upload haette gelingen sollen — sonst ist die Datei keine Waise');
  assert.strictEqual(melde.hidden, false);
  assert.match(melde.textContent, /sspa-map\.pdf/, 'die Meldung nennt nicht den (bereinigten) Dateinamen');
  assert.match(melde.textContent, /erneutes .Quelle erfassen. mit derselben Datei ist sicher/,
    'die Meldung beruhigt nicht, dass ein erneuter Versuch mit derselben Datei gefahrlos ist');
  assert.strictEqual(knopf.disabled, false, 'der Knopf blieb gesperrt — ein erneuter Versuch waere nicht moeglich');

  /* Fix-Runde 1, Finding 2: dieselbe Meldung muss AUCH in state.fehlerHinweis stehen — der
     lokale melde-Knoten allein reicht nicht, weil ein Zwischen-Render ihn aushaengen kann. */
  assert.match(state.fehlerHinweis || '', /sspa-map\.pdf/,
    'state.fehlerHinweis nennt nicht den Dateinamen — die Meldung haengt nur am DOM-Knoten');
  assert.match(state.fehlerHinweis || '', /erneutes .Quelle erfassen. mit derselben Datei ist sicher/,
    'state.fehlerHinweis enthaelt nicht den Retry-sicher-Satz');
  delete global.document;
});

test('ohne Datei und ohne Link kommt eine eigene Meldung, kein Upload', () => {
  state.position.kursId = 'DBS-001';
  state.data.dossier = { 'DBS-001': { dossier: 1, kurs: 'DBS-001', scope: {}, content_modus: 'quellengestuetzt',
    quellen: [], status: {}, offen: [], entschieden: [] } };
  const melde = els({ titel: 'X', stand: '2026' });   /* weder Datei noch Link */
  let hochgeladen = false;
  graph.hochladen = function () { hochgeladen = true; return Promise.resolve(); };
  const knopf = { disabled: false };

  controller.quelleErfassen(knopf);

  assert.strictEqual(hochgeladen, false, 'graph.hochladen wurde ohne Datei und Link aufgerufen');
  assert.strictEqual(melde.hidden, false);
  assert.match(melde.textContent, /Datei w.hlen oder Link angeben/);
  delete global.document;
});

test('Nur-URL-Pfad: kein Upload, Dossier-Ablage enthaelt url und ein Abrufdatum von heute', async () => {
  state.position.kursId = 'DBS-001';
  state.data.dossier = { 'DBS-001': { dossier: 1, kurs: 'DBS-001', scope: {}, content_modus: 'quellengestuetzt',
    quellen: [], status: {}, offen: [], entschieden: [] } };
  els({ titel: 'Ausschreibung', herausgeber: 'SSPA', stand: '2026', url: 'https://sspa.ch/ausschreibung' });
  let hochgeladen = false;
  graph.hochladen = function () { hochgeladen = true; return Promise.resolve(); };
  let abgelegtMit = null;
  graph.ablegen = function (kursId, ordner, datei, text) {
    abgelegtMit = { kursId, ordner, datei, text };
    return Promise.resolve();
  };
  const knopf = { disabled: false };

  await controller.quelleErfassen(knopf);

  assert.strictEqual(hochgeladen, false, 'graph.hochladen wurde beim Nur-URL-Pfad aufgerufen');
  assert.ok(abgelegtMit, 'graph.ablegen wurde nicht aufgerufen');
  const d = JSON.parse(abgelegtMit.text);
  assert.strictEqual(d.quellen.length, 1);
  assert.strictEqual(d.quellen[0].id, 'Q-001');
  assert.strictEqual(d.quellen[0].url, 'https://sspa.ch/ausschreibung');
  assert.match(d.quellen[0].abgerufen, /^\d{4}-\d{2}-\d{2}$/, 'kein YYYY-MM-DD-Abrufdatum');
  assert.strictEqual('datei' in d.quellen[0], false);
  assert.strictEqual(state.data.dossier['DBS-001'].quellen.length, 1);
  delete global.document;
});

test('Datei UND Link zugleich: Meldung aus quelleNeu, kein Upload, keine Ablage', () => {
  state.position.kursId = 'DBS-001';
  state.data.dossier = { 'DBS-001': { dossier: 1, kurs: 'DBS-001', scope: {}, content_modus: 'quellengestuetzt',
    quellen: [], status: {}, offen: [], entschieden: [] } };
  const melde = els({ titel: 'X', stand: '2026', datei: { name: 'x.pdf' }, url: 'https://x.ch' });
  let hochgeladen = false;
  graph.hochladen = function () { hochgeladen = true; return Promise.resolve(); };
  let abgelegt = false;
  graph.ablegen = function () { abgelegt = true; return Promise.resolve(); };
  const knopf = { disabled: false };

  controller.quelleErfassen(knopf);

  assert.strictEqual(hochgeladen, false, 'graph.hochladen wurde trotz doppelter Angabe aufgerufen');
  assert.strictEqual(abgelegt, false, 'graph.ablegen wurde trotz doppelter Angabe aufgerufen');
  assert.strictEqual(melde.hidden, false);
  assert.match(melde.textContent, /entweder/i);
  assert.strictEqual(knopf.disabled, false, 'der Knopf wurde gesperrt, obwohl gar nichts abgelegt wird');
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
