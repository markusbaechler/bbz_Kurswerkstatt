'use strict';
/* Etappe 1c: Quelle entfernen (Entscheid Markus, 2026-07-30). Dossier-Eintrag
   zuerst raus, danach — nur bei einer Datei-Quelle — die Datei per Graph DELETE
   in den SharePoint-Papierkorb. Kein Netz noetig: graph.driveId/kursOrdner und
   auth.token werden ueberschrieben, global.fetch gemockt (Muster aus
   quelleerfassen.test.js, dort wird graph.ablegen/hochladen ueberschrieben —
   hier ist graph.dateiLoeschen selbst das zu pruefende Netzwerk-Stueck). */
const test = require('node:test');
const assert = require('node:assert');

const { controller, state, graph, auth } = require('../app.js');
require('../dossier.js');
require('../inhalt.js');   /* app.js liest den Quellen-Ordner jetzt ueber root.inhalt.quellenOrdner() (Audit I3) */

/* ---------- graph.dateiLoeschen ---------- */

function netzMocken(status) {
  graph.driveId = function () { return Promise.resolve('DID'); };
  graph.kursOrdner = function () { return Promise.resolve({ id: 'ORD' }); };
  auth.token = function () { return Promise.resolve('TOKEN'); };
  const aufrufe = [];
  global.fetch = function (url, init) {
    aufrufe.push({ url, init });
    return Promise.resolve({ status: status, ok: status >= 200 && status < 300 });
  };
  return aufrufe;
}

test('dateiLoeschen(): 204 gilt als geloescht und leert den Dateien-Cache', async () => {
  const aufrufe = netzMocken(204);
  state.data.dateien['DBS-001/03_content/quellen'] = ['irgendwas'];

  const ok = await graph.dateiLoeschen('DBS-001', '03_content/quellen', 'x.pdf');

  assert.strictEqual(ok, true);
  assert.strictEqual(aufrufe.length, 1);
  assert.strictEqual(aufrufe[0].init.method, 'DELETE');
  assert.match(aufrufe[0].url, /drives\/DID\/items\/ORD:\/03_content\/quellen\/x\.pdf$/);
  assert.strictEqual(aufrufe[0].init.headers.Authorization, 'Bearer TOKEN');
  assert.strictEqual('DBS-001/03_content/quellen' in state.data.dateien, false);
  delete global.fetch;
});

test('dateiLoeschen(): 404 gilt als erledigt — Datei war schon weg', async () => {
  netzMocken(404);
  const ok = await graph.dateiLoeschen('DBS-001', '03_content/quellen', 'x.pdf');
  assert.strictEqual(ok, true);
  delete global.fetch;
});

test('dateiLoeschen(): jeder andere Status wirft', async () => {
  netzMocken(500);
  await assert.rejects(
    () => graph.dateiLoeschen('DBS-001', '03_content/quellen', 'x.pdf'),
    /500/
  );
  delete global.fetch;
});

/* ---------- controller.quelleEntfernen ---------- */

function melde() {
  const m = { hidden: true, textContent: '' };
  global.document = { getElementById: function (id) { return id === 'quelle-melde' ? m : null; } };
  return m;
}

function dossierMit(quellen) {
  return { dossier: 1, kurs: 'DBS-001', scope: {}, content_modus: 'quellengestuetzt',
    quellen: quellen, status: {}, offen: [], entschieden: [] };
}

test('Bestaetigung verneint: weder ablegen noch dateiLoeschen wird gerufen', () => {
  state.position.kursId = 'DBS-001';
  state.data.ordner = { 'DBS-001': { id: 'ORD' } };
  state.data.dossier = { 'DBS-001': dossierMit([{ id: 'Q-001', titel: 'A', stand: '2025', datei: 'a.pdf' }]) };
  melde();
  controller._bestaetige = function () { return false; };
  let abgelegt = false, geloescht = false;
  graph.ablegen = function () { abgelegt = true; return Promise.resolve(); };
  graph.dateiLoeschen = function () { geloescht = true; return Promise.resolve(true); };
  const knopf = { disabled: false, dataset: { quelle: 'Q-001' } };

  controller.quelleEntfernen(knopf);

  assert.strictEqual(abgelegt, false, 'graph.ablegen wurde trotz verneinter Bestaetigung aufgerufen');
  assert.strictEqual(geloescht, false, 'graph.dateiLoeschen wurde trotz verneinter Bestaetigung aufgerufen');
  delete global.document;
});

test('Link-Quelle: nur Dossier-Ablage, kein dateiLoeschen', async () => {
  state.position.kursId = 'DBS-001';
  state.data.ordner = { 'DBS-001': { id: 'ORD' } };
  state.data.dossier = { 'DBS-001': dossierMit(
    [{ id: 'Q-001', titel: 'A', stand: '2025', url: 'https://x.ch', abgerufen: '2026-07-30' }]) };
  melde();
  controller._bestaetige = function () { return true; };
  let abgelegtMit = null, geloescht = false;
  graph.ablegen = function (kursId, ordner, datei, text) {
    abgelegtMit = { kursId, ordner, datei, text };
    return Promise.resolve();
  };
  graph.dateiLoeschen = function () { geloescht = true; return Promise.resolve(true); };
  const echtesRender = controller.render;
  controller.render = function () {};
  const knopf = { disabled: false, dataset: { quelle: 'Q-001' } };

  await controller.quelleEntfernen(knopf);

  assert.ok(abgelegtMit, 'graph.ablegen wurde nicht aufgerufen');
  const d = JSON.parse(abgelegtMit.text);
  assert.strictEqual(d.quellen.length, 0);
  assert.strictEqual(geloescht, false, 'graph.dateiLoeschen wurde bei einer Link-Quelle aufgerufen');
  assert.strictEqual(state.data.dossier['DBS-001'].quellen.length, 0);

  controller.render = echtesRender;
  delete global.document;
});

test('Datei-Quelle: erst ablegen, dann dateiLoeschen mit Ordner und Dateiname (Reihenfolge)', async () => {
  state.position.kursId = 'DBS-001';
  state.data.ordner = { 'DBS-001': { id: 'ORD' } };
  state.data.dossier = { 'DBS-001': dossierMit(
    [{ id: 'Q-001', titel: 'A', stand: '2025', datei: 'a.pdf' }]) };
  melde();
  controller._bestaetige = function () { return true; };
  const reihenfolge = [];
  let abgelegtMit = null, geloeschtMit = null;
  graph.ablegen = function (kursId, ordner, datei, text) {
    reihenfolge.push('ablegen');
    abgelegtMit = { kursId, ordner, datei, text };
    return Promise.resolve();
  };
  graph.dateiLoeschen = function (kursId, ordner, datei) {
    reihenfolge.push('dateiLoeschen');
    geloeschtMit = { kursId, ordner, datei };
    return Promise.resolve(true);
  };
  const echtesRender = controller.render;
  controller.render = function () {};
  const knopf = { disabled: false, dataset: { quelle: 'Q-001' } };

  await controller.quelleEntfernen(knopf);

  assert.deepStrictEqual(reihenfolge, ['ablegen', 'dateiLoeschen'], 'ablegen muss vor dateiLoeschen laufen');
  assert.ok(abgelegtMit, 'graph.ablegen wurde nicht aufgerufen');
  const d = JSON.parse(abgelegtMit.text);
  assert.strictEqual(d.quellen.length, 0);
  assert.ok(geloeschtMit, 'graph.dateiLoeschen wurde nicht aufgerufen');
  assert.strictEqual(geloeschtMit.kursId, 'DBS-001');
  assert.strictEqual(geloeschtMit.ordner, '03_content/quellen');
  assert.strictEqual(geloeschtMit.datei, 'a.pdf');
  assert.strictEqual(state.data.dossier['DBS-001'].quellen.length, 0);

  controller.render = echtesRender;
  delete global.document;
});

test('dateiLoeschen scheitert: State traegt trotzdem das bereinigte Dossier, plus Meldung', async () => {
  state.position.kursId = 'DBS-001';
  state.data.ordner = { 'DBS-001': { id: 'ORD' } };
  state.data.dossier = { 'DBS-001': dossierMit(
    [{ id: 'Q-001', titel: 'A', stand: '2025', datei: 'a.pdf' }]) };
  const m = melde();
  controller._bestaetige = function () { return true; };
  graph.ablegen = function () { return Promise.resolve(); };
  graph.dateiLoeschen = function () { return Promise.reject(new Error('Graph 500')); };
  const echtesRender = controller.render;
  let gerendert = false;
  controller.render = function () { gerendert = true; };
  const knopf = { disabled: false, dataset: { quelle: 'Q-001' } };

  await controller.quelleEntfernen(knopf);

  assert.strictEqual(state.data.dossier['DBS-001'].quellen.length, 0,
    'das bereinigte Dossier muss trotz fehlgeschlagenem Datei-Loeschen im State stehen');
  assert.strictEqual(m.hidden, false);
  assert.match(m.textContent, /03_content\/quellen/);
  assert.ok(gerendert, 'controller.render() wurde nicht aufgerufen');

  controller.render = echtesRender;
  delete global.document;
});

test('unbekannte id: Meldung "Quelle nicht gefunden", kein ablegen', () => {
  state.position.kursId = 'DBS-001';
  state.data.ordner = { 'DBS-001': { id: 'ORD' } };
  state.data.dossier = { 'DBS-001': dossierMit([{ id: 'Q-001', titel: 'A', stand: '2025', datei: 'a.pdf' }]) };
  const m = melde();
  controller._bestaetige = function () { return true; };
  let abgelegt = false;
  graph.ablegen = function () { abgelegt = true; return Promise.resolve(); };
  const knopf = { disabled: false, dataset: { quelle: 'Q-099' } };

  controller.quelleEntfernen(knopf);

  assert.strictEqual(abgelegt, false, 'graph.ablegen wurde trotz unbekannter id aufgerufen');
  assert.strictEqual(m.hidden, false);
  assert.match(m.textContent, /nicht gefunden/);
  delete global.document;
});

test('Knopf wird waehrend des Vorgangs gesperrt', async () => {
  state.position.kursId = 'DBS-001';
  state.data.ordner = { 'DBS-001': { id: 'ORD' } };
  state.data.dossier = { 'DBS-001': dossierMit([{ id: 'Q-001', titel: 'A', stand: '2025', datei: 'a.pdf' }]) };
  melde();
  controller._bestaetige = function () { return true; };
  let sperreBeimAblegen = null;
  const knopf = { disabled: false, dataset: { quelle: 'Q-001' } };
  graph.ablegen = function () { sperreBeimAblegen = knopf.disabled; return Promise.resolve(); };
  graph.dateiLoeschen = function () { return Promise.resolve(true); };
  const echtesRender = controller.render;
  controller.render = function () {};

  await controller.quelleEntfernen(knopf);

  assert.strictEqual(sperreBeimAblegen, true, 'der Knopf war beim Ablegen nicht gesperrt');

  controller.render = echtesRender;
  delete global.document;
});
